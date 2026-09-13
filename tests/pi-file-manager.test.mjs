import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pluginRoot = join(root, "plugins/pi.file-manager");

const manifest = JSON.parse(readFileSync(join(pluginRoot, "manifest.json"), "utf8"));
const mainRaw = readFileSync(join(pluginRoot, "main.js"), "utf8");
const viewHtml = readFileSync(join(pluginRoot, "views/index.html"), "utf8");

/**
 * Source with block and line comments removed, so structural assertions do not
 * trip over prose that explains why the gateway is bypassed.
 */
const mainSource = mainRaw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Loads the plugin the way the host does: a CommonJS entry in a Node process
 * with a global `pi`. `workspace.get()` is pointed at a disposable project
 * root so the path guard and the write path can be exercised for real.
 */
function loadPlugin(workspacePath) {
  const require = createRequire(import.meta.url);
  const dataDir = mkdtempSync(join(tmpdir(), "pifm-data-"));
  let settings = {};
  global.pi = {
    plugin: {
      getId: () => "pi.file-manager",
      getManifest: () => manifest,
      getSettings: async () => ({ ...settings }),
      setSettings: async (partial) => {
        settings = { ...settings, ...partial };
      },
      getDataPath: async () => dataDir,
    },
    workspace: {
      get: async () => (workspacePath ? { path: workspacePath, name: "project" } : null),
    },
  };
  delete require.cache[require.resolve(join(pluginRoot, "main.js"))];
  const mod = require(join(pluginRoot, "main.js"));
  return { mod, invoke: (channel, payload) => mod.onPanelInvoke(channel, payload ?? {}), dataDir };
}

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), "pifm-proj-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "app.ts"), "const a = 1;\n");
  writeFileSync(join(dir, ".env"), "SECRET=1\n");
  writeFileSync(join(dir, "key.pem"), "-----BEGIN CERTIFICATE-----\n");
  mkdirSync(join(dir, ".git"));
  writeFileSync(join(dir, ".git", "config"), "[core]\n");
  return dir;
}

test("manifest declares the exact release identity and capabilities", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "pi.file-manager");
  assert.equal(manifest.version, "0.3.0");
  // 市场目录读的是顶层这两个字段（见 scripts/rebuild_catalog.py）
  assert.ok(manifest.safetyNotes, "top-level safetyNotes feeds the catalog");
  assert.ok(manifest.changelog, "changelog feeds the plugin detail page");
  assert.equal(manifest.main, "main.js");
  assert.match(manifest.engines.piDesktop, /^>=0\.9\.0$/);
  // A work-panel view, not a detached panel: exactly one permission.
  assert.deepEqual(manifest.permissions, ["ui.view"]);
  assert.equal(manifest.ui, undefined, "declares no ui.panel entry");
  assert.deepEqual(manifest.contributes.views, [
    {
      id: "manager",
      title: { en: "File Manager", "zh-CN": "文件管理器" },
      icon: "folder",
      entry: "views/index.html",
      order: 40,
    },
  ]);
  assert.ok(manifest.i18n?.en?.name);
  assert.ok(manifest.i18n?.en?.description);
  assert.ok(manifest.i18n?.en?.safetyNotes);
  assert.ok(manifest.i18n?.["zh-CN"]?.name);
  assert.ok(manifest.i18n?.["zh-CN"]?.description);
  assert.ok(manifest.i18n?.["zh-CN"]?.safetyNotes);
});

test("the view entry is a file:// safe classic script", () => {
  // The host loads a docked view over file://, where Chromium blocks ESM and
  // crossorigin assets. A module script or a crossorigin link would blank the
  // pane, so both must stay absent, and the chrome marker must be declared.
  assert.match(viewHtml, /<meta\s+name="pi-plugin-chrome"\s+content="v2"\s*\/>/);
  assert.doesNotMatch(viewHtml, /type="module"/);
  assert.doesNotMatch(viewHtml, /crossorigin/);
  assert.match(viewHtml, /<script\s+src="\.\/assets\/index\.js"[^>]*><\/script>/);
});

test("only ui.view is declared, and the plugin never calls the pi.fs gateway", () => {
  // File access deliberately bypasses the host gateway (manifest.fs cannot
  // express a whole-tree write), so no fs permission may be claimed.
  assert.deepEqual(manifest.permissions, ["ui.view"]);
  assert.equal(manifest.fs, undefined, "declares no manifest.fs scope");
  assert.equal(manifest.net, undefined, "declares no egress allowlist");
  assert.doesNotMatch(mainSource, /pi\.fs\./);
});

test("path guard refuses escapes and credential paths", async (t) => {
  const project = makeProject();
  const { mod, invoke } = loadPlugin(project);
  t.after(() => {
    rmSync(project, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  for (const candidate of [
    "../outside.txt",
    "..\\..\\outside.txt",
    "src/../../outside.txt",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
  ]) {
    const result = await invoke("fm.read", { path: candidate });
    assert.equal(result.ok, false, `absolute/traversal path must be refused: ${candidate}`);
  }

  for (const candidate of [".env", ".git/config", "key.pem"]) {
    const read = await invoke("fm.read", { path: candidate });
    assert.equal(read.ok, false, `credential path must not be readable: ${candidate}`);
    assert.equal(read.code, "DENIED_PATH");
    const write = await invoke("fm.write", { path: candidate, text: "x", eol: "lf", bom: false });
    assert.equal(write.ok, false, `credential path must not be writable: ${candidate}`);
  }

  // Listing hides credential paths but never hides the project's own files.
  const listed = await invoke("fm.list", { path: "" });
  const names = listed.entries.map((entry) => entry.name);
  assert.ok(!names.includes(".env"), "listing omits .env");
  assert.ok(!names.includes("key.pem"), "listing omits key.pem");
  assert.ok(!names.includes(".git"), "listing omits .git");
  assert.ok(names.includes("src"), "listing keeps ordinary directories");
});

test("a symlink that resolves outside the project root is refused", async (t) => {
  const project = makeProject();
  const outside = mkdtempSync(join(tmpdir(), "pifm-outside-"));
  writeFileSync(join(outside, "secret.txt"), "outside\n");
  const { mod, invoke } = loadPlugin(project);
  t.after(() => {
    rmSync(project, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  try {
    symlinkSync(outside, join(project, "link-out"), "junction");
  } catch (error) {
    t.skip(`symlink creation unavailable: ${error.code ?? error.message}`);
    return;
  }

  const escaped = await invoke("fm.read", { path: "link-out/secret.txt" });
  assert.equal(escaped.ok, false, "must not read through an out-of-root symlink");
  assert.equal(escaped.code, "SYMLINK_ESCAPE");

  const listed = await invoke("fm.list", { path: "" });
  const link = listed.entries.find((entry) => entry.name === "link-out");
  assert.equal(link.isSymlink, true);
  assert.equal(link.isDirectory, false, "a symlinked directory is never expandable");
  assert.equal(link.outside, true);
});

test("writes are atomic and refuse to clobber an out-of-editor change", async (t) => {
  const project = makeProject();
  const { mod, invoke } = loadPlugin(project);
  t.after(() => {
    rmSync(project, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  const before = await invoke("fm.read", { path: "src/app.ts" });
  assert.equal(before.kind, "text");
  assert.equal(before.text, "const a = 1;\n");

  const saved = await invoke("fm.write", {
    path: "src/app.ts",
    text: "const a = 42;\n",
    expectedMtimeMs: before.mtimeMs,
    expectedSize: before.size,
    eol: "lf",
    bom: false,
  });
  assert.equal(saved.ok, true);
  assert.equal(readFileSync(join(project, "src", "app.ts"), "utf8"), "const a = 42;\n");
  // Atomic write means the temp file never survives a successful save.
  assert.deepEqual(
    readdirSync(join(project, "src")),
    ["app.ts"],
    "no temp-file residue after a successful write",
  );

  // The file changes underneath the editor: the next save must conflict
  // instead of silently overwriting, and must leave the disk untouched.
  writeFileSync(join(project, "src", "app.ts"), "const externally = 1;\n");
  const conflict = await invoke("fm.write", {
    path: "src/app.ts",
    text: "const fromEditor = 1;\n",
    expectedMtimeMs: before.mtimeMs,
    expectedSize: before.size,
    eol: "lf",
    bom: false,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "CONFLICT");
  assert.equal(
    readFileSync(join(project, "src", "app.ts"), "utf8"),
    "const externally = 1;\n",
    "a conflicting write must not touch the file",
  );
});

test("ignore rules hide entries only when a rule file exists", async (t) => {
  const project = makeProject();
  mkdirSync(join(project, "dist"));
  writeFileSync(join(project, "dist", "bundle.js"), "// built\n");
  const { mod, invoke } = loadPlugin(project);
  t.after(() => {
    rmSync(project, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  const withoutRules = await invoke("fm.list", { path: "" });
  assert.equal(withoutRules.ignoreActive, false);
  assert.ok(
    withoutRules.entries.some((entry) => entry.name === "dist"),
    "with no rule file nothing is filtered out",
  );

  writeFileSync(join(project, ".gitignore"), "dist/\n");
  const withRules = await invoke("fm.list", { path: "" });
  assert.equal(withRules.ignoreActive, true);
  assert.equal(
    withRules.entries.find((entry) => entry.name === "dist").ignored,
    true,
    "a .gitignore rule marks the entry as ignored",
  );
});

test("search paginates without dropping matches", async (t) => {
  const project = makeProject();
  for (let index = 0; index < 5; index += 1) {
    mkdirSync(join(project, "deep", "nested"), { recursive: true });
    writeFileSync(join(project, "deep", "nested", `hit-${index}.txt`), `${index}\n`);
  }
  const { mod, invoke } = loadPlugin(project);
  t.after(() => {
    rmSync(project, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  const found = [];
  let cursor = null;
  let rounds = 0;
  for (;;) {
    const page = await invoke("fm.search", { query: "hit-", cursor, limit: 2 });
    found.push(...page.matches.map((match) => match.path));
    cursor = page.nextCursor;
    rounds += 1;
    if (page.done || rounds > 20) break;
  }
  assert.equal(found.length, 5, "every match is returned across pages");
  assert.equal(new Set(found).size, 5, "no duplicate matches across pages");
  assert.ok(rounds >= 3, "the small limit actually forced pagination");
});

test("mutating channels refuse to run without an open project", async (t) => {
  const { mod, invoke } = loadPlugin(null);
  t.after(() => delete global.pi);
  await mod.onLoad();

  const hello = await invoke("fm.hello");
  assert.equal(hello.ok, true);
  assert.equal(hello.root, null);

  for (const [channel, payload] of [
    ["fm.list", { path: "" }],
    ["fm.read", { path: "a.txt" }],
    ["fm.create", { parent: "", name: "a.txt" }],
    ["fm.search", { query: "a" }],
  ]) {
    const result = await invoke(channel, payload);
    assert.equal(result.ok, false, `${channel} must fail without a workspace`);
    assert.equal(result.code, "NO_WORKSPACE");
  }
});

test("unknown channels answer UNSUPPORTED instead of throwing", async (t) => {
  const project = makeProject();
  const { mod, invoke } = loadPlugin(project);
  t.after(() => {
    rmSync(project, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  const result = await invoke("fm.does-not-exist");
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNSUPPORTED");
});

test("images, media and oversized files are classified without shipping the wrong bytes", async (t) => {
  const project = makeProject();
  const { mod, invoke } = loadPlugin(project);
  t.after(() => {
    rmSync(project, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  // The docked view runs under file://, so a project path would resolve against
  // the view itself. Images therefore travel as data URIs.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
    "base64",
  );
  writeFileSync(join(project, "dot.png"), png);
  const image = await invoke("fm.read", { path: "dot.png" });
  assert.equal(image.kind, "image");
  assert.equal(image.mime, "image/png");
  assert.equal(image.text, undefined, "images never carry text");
  assert.ok(image.dataUri.startsWith("data:image/png;base64,"));
  assert.ok(Buffer.from(image.dataUri.split(",")[1], "base64").equals(png), "bytes survive the round trip");

  writeFileSync(join(project, "clip.mp4"), Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]));
  const media = await invoke("fm.read", { path: "clip.mp4" });
  assert.equal(media.kind, "media");
  assert.equal(media.mime, "video/mp4");

  writeFileSync(join(project, "huge.txt"), "a".repeat(2 * 1024 * 1024 + 1));
  const huge = await invoke("fm.read", { path: "huge.txt" });
  assert.equal(huge.kind, "tooLarge");
  assert.equal(huge.limit, 2 * 1024 * 1024, "the limit is reported so the UI can name it");

  // A .db that is not a database (Windows thumbs.db is an OLE file) must fall
  // back to a plain read instead of claiming to be browsable.
  writeFileSync(join(project, "thumbs.db"), "not a database at all");
  const decoy = await invoke("fm.read", { path: "thumbs.db" });
  assert.equal(decoy.kind, "text");
  const decoyOpen = await invoke("fm.sqlite.open", { path: "thumbs.db" });
  assert.equal(decoyOpen.ok, false);
  assert.equal(decoyOpen.code, "NOT_SQLITE");
});

test("sqlite browsing is read-only and the query box refuses writes", async (t) => {
  let sqlite = null;
  try {
    sqlite = createRequire(import.meta.url)("node:sqlite");
  } catch {
    sqlite = null;
  }
  if (!sqlite) {
    t.skip("node:sqlite is unavailable in this runtime");
    return;
  }

  const project = makeProject();
  const dbPath = join(project, "app.db");
  const db = new sqlite.DatabaseSync(dbPath);
  db.exec("create table users (id integer primary key, name text, score real, photo blob)");
  const insert = db.prepare("insert into users (name, score, photo) values (?, ?, ?)");
  for (let index = 1; index <= 12; index += 1) {
    insert.run(`user-${index}`, index, new Uint8Array([1, 2, 3]));
  }
  insert.run(null, null, null);
  db.close();

  const { mod, invoke } = loadPlugin(project);
  t.after(async () => {
    // 插件会把数据库句柄缓存起来（60 秒闲置才关），不先卸载的话 Windows
    // 上删不掉临时目录（EBUSY）。
    await mod.onUnload();
    rmSync(project, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  const read = await invoke("fm.read", { path: "app.db" });
  assert.equal(read.kind, "sqlite", "the header decides; the bytes stay in the plugin process");
  assert.equal(read.dataUri, undefined);
  assert.equal(read.text, undefined);
  assert.ok(read.info.pageSize > 0 && read.info.libraryVersion > 3000000);

  const open = await invoke("fm.sqlite.open", { path: "app.db" });
  assert.equal(open.ok, true);
  assert.ok(open.objects.some((entry) => entry.type === "table" && entry.name === "users"));
  assert.ok(
    String(open.objects.find((entry) => entry.name === "users").sql).startsWith("CREATE TABLE"),
    "the create statement is available for the structure view",
  );

  const page = await invoke("fm.sqlite.rows", { path: "app.db", object: "users", page: 1, pageSize: 5 });
  assert.equal(page.rows.length, 5);
  assert.equal(page.hasMore, true);
  assert.equal(page.columns[0].name, "rowid");
  assert.equal(page.estimate, 13, "row counts are estimated from max(rowid)");
  assert.equal(page.rows[0][4], "[blob 3 B]", "blobs are summarised, never shipped");

  const last = await invoke("fm.sqlite.rows", { path: "app.db", object: "users", page: 3, pageSize: 5 });
  assert.equal(last.rows.length, 3);
  assert.equal(last.hasMore, false);
  assert.equal(last.rows[2][2], null, "SQL NULL stays distinct from an empty string");

  const missing = await invoke("fm.sqlite.rows", { path: "app.db", object: "nope", page: 1, pageSize: 5 });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "SQLITE_NO_SUCH_OBJECT");

  const injected = await invoke("fm.sqlite.rows", {
    path: "app.db",
    object: 'users"; drop table users; --',
    page: 1,
    pageSize: 5,
  });
  assert.equal(injected.ok, false, "object names are matched against the schema, never interpolated");

  const selected = await invoke("fm.sqlite.query", {
    path: "app.db",
    sql: "select name from users where score > 10 order by score desc",
    limit: 10,
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.rows.length, 2);
  assert.equal(typeof selected.elapsedMs, "number");

  // node:sqlite happily prepares "select 1; drop table users" and runs only the
  // first statement, so multi-statement input must be rejected by the plugin.
  for (const [sql, label] of [
    ["drop table users", "DDL"],
    ["delete from users", "delete"],
    ["insert into users (name) values ('mallory')", "insert"],
    ["select 1; drop table users", "multi-statement"],
    ["with x as (select 1) delete from users", "CTE-prefixed delete"],
    ["attach database 'other.db' as other", "attach"],
    ["pragma writable_schema = 1", "writable_schema"],
  ]) {
    const refused = await invoke("fm.sqlite.query", { path: "app.db", sql, limit: 10 });
    assert.equal(refused.ok, false, `${label} must be refused`);
  }

  const pragma = await invoke("fm.sqlite.query", {
    path: "app.db",
    sql: "pragma table_info(users)",
    limit: 20,
  });
  assert.equal(pragma.ok, true, "read-only pragmas stay available");

  // The database must still be intact after all of that.
  const verify = new sqlite.DatabaseSync(dbPath, { readOnly: true });
  assert.equal(verify.prepare("select count(*) as n from users").get().n, 13);
  verify.close();
});

test("viewer preferences round-trip and clamp", async (t) => {
  const project = makeProject();
  const { mod, invoke } = loadPlugin(project);
  t.after(() => {
    rmSync(project, { recursive: true, force: true });
    delete global.pi;
  });
  await mod.onLoad();

  const hello = await invoke("fm.hello");
  assert.equal(hello.prefs.tablePageSize, 1000, "table paging defaults to 1000 rows");
  assert.equal(hello.prefs.csvTable, true);
  assert.equal(hello.prefs.jsonTree, false);

  const set = await invoke("fm.prefs.set", {
    partial: { csvTable: false, jsonTree: true, tablePageSize: 2000 },
  });
  assert.equal(set.prefs.csvTable, false);
  assert.equal(set.prefs.jsonTree, true);
  assert.equal(set.prefs.tablePageSize, 2000);

  const clamped = await invoke("fm.prefs.set", { partial: { tablePageSize: 99999 } });
  assert.equal(clamped.prefs.tablePageSize, 5000, "page size is clamped to 5000 rows");

  const ignored = await invoke("fm.prefs.set", { partial: { tablePageSize: "big" } });
  assert.equal(ignored.prefs.tablePageSize, 5000, "non-numeric prefs are ignored, not coerced");
});
