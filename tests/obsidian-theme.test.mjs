import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const pluginRoot = join(root, "plugins", "pi.obsidian-theme");
const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(join(pluginRoot, "manifest.json"), "utf8"));
const themeCss = readFileSync(join(pluginRoot, "themes", "obsidian.css"), "utf8");
const panelHtml = readFileSync(join(pluginRoot, "renderer", "index.html"), "utf8");

test("Obsidian theme declares the exact release identity and capabilities", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "pi.obsidian-theme");
  assert.equal(manifest.version, "3.0.0");
  assert.equal(manifest.author, "ily55421");
  assert.deepEqual(manifest.categories, ["theme", "community"]);
  assert.equal(manifest.main, "main.js");
  assert.equal(manifest.ui.panel, "renderer/index.html");
  assert.deepEqual(manifest.ui.title, {
    en: "Obsidian Theme",
    "zh-CN": "黑曜石主题",
  });
  // Styling only: no filesystem, network, clipboard, shell or agent access.
  assert.deepEqual(manifest.permissions, ["ui.panel", "ui.theme"]);
  assert.deepEqual(manifest.contributes.themes, [
    {
      id: "obsidian",
      label: "Obsidian Dark",
      base: "dark",
      path: "themes/obsidian.css",
    },
  ]);
  assert.ok(manifest.i18n?.en?.safetyNotes);
  assert.ok(manifest.i18n?.["zh-CN"]?.safetyNotes);
});

test("the theme ships no network, font or external references", () => {
  // The host sanitizes theme CSS; a self-contained sheet keeps it that way.
  assert.doesNotMatch(themeCss, /@import/);
  assert.doesNotMatch(themeCss, /@font-face/);
  assert.doesNotMatch(themeCss, /https?:\/\//);
  assert.doesNotMatch(themeCss, /expression\s*\(|javascript:/i);

  // Every url() must be an inline data: payload. Parsing the references beats a
  // lookahead regex here: `url("data:...` backtracks into a false positive.
  const references = [...themeCss.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/g)].map(
    (match) => match[2],
  );
  assert.ok(references.length > 0, "the sheet is expected to carry its noise tile");
  for (const reference of references) {
    assert.ok(
      reference.startsWith("data:"),
      `theme CSS must not reference an external URL: ${reference}`,
    );
  }
});

test("the panel documents the host-owned 46px chrome contract", () => {
  assert.match(panelHtml, /<meta\s+name="pi-plugin-chrome"\s+content="v3"\s*\/>/);
  assert.match(panelHtml, /three-button[\s\S]*window-control capsule/);
  assert.match(panelHtml, /var\(--pi-plugin-titlebar-height, 46px\)/);
});

test("the panel carries no external script or inline handler", () => {
  assert.doesNotMatch(panelHtml, /<script[^>]+src\s*=\s*["'](?:https?:|data:)/i);
  assert.doesNotMatch(panelHtml, /\son[a-z]+\s*=\s*["']/i);
});

test("main.js registers exactly one command and unregisters it", async () => {
  const registered = [];
  const unregistered = [];
  global.pi = {
    commands: {
      register: async (command) => registered.push(command),
      unregister: async (id) => unregistered.push(id),
    },
    ui: { openPanel: async () => {} },
  };

  const main = require(join(pluginRoot, "main.js"));
  await main.onLoad();
  assert.equal(registered.length, 1);
  assert.equal(registered[0].id, "obsidian-theme.open");
  assert.equal(typeof registered[0].run, "function");

  await main.onUnload();
  assert.deepEqual(unregistered, ["obsidian-theme.open"]);
  delete global.pi;
});
