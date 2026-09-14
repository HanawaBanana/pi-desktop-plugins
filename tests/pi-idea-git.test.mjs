import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const pluginRoot = join(root, "plugins/io.github.liushunqiu.pi-idea-git");
const require = createRequire(import.meta.url);

const manifest = JSON.parse(
  readFileSync(join(pluginRoot, "manifest.json"), "utf8"),
);
const mainSource = readFileSync(join(pluginRoot, "main.js"), "utf8");
const commitHtml = readFileSync(
  join(pluginRoot, "views/commit.html"),
  "utf8",
);
const gitHtml = readFileSync(join(pluginRoot, "views/git.html"), "utf8");

test("manifest declares the expected identity, permissions and contributions", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "io.github.liushunqiu.pi-idea-git");
  assert.equal(manifest.version, "0.3.0");
  assert.match(manifest.engines.piDesktop, /^>=/);
  assert.deepEqual(manifest.permissions, [
    "ui.panel",
    "ui.view",
    "clipboard.write",
    "fs.read",
    "models.list",
    "agent.complete",
  ]);
  assert.equal(typeof manifest.i18n.en.name, "string");
  assert.equal(typeof manifest.i18n["zh-CN"].name, "string");
  assert.ok(manifest.i18n.en.safetyNotes.length > 0);
  assert.ok(manifest.i18n["zh-CN"].safetyNotes.length > 0);
  assert.equal(typeof manifest.ui.title.en, "string");
  assert.equal(typeof manifest.ui.title["zh-CN"], "string");
  assert.deepEqual(
    manifest.contributes.views.map((v) => v.id),
    ["commit", "git"],
  );
  assert.deepEqual(
    manifest.contributes.commands.map((c) => c.id),
    ["pi-idea-git.open", "pi-idea-git.refresh"],
  );
});

test("main entry exposes the plugin lifecycle and panel invoke", () => {
  const main = require(join(pluginRoot, "main.js"));
  assert.equal(typeof main.onLoad, "function");
  assert.equal(typeof main.onUnload, "function");
  assert.equal(typeof main.onPanelInvoke, "function");
});

test("git executes via spawn with argument arrays and no shell", () => {
  assert.match(mainSource, /spawn\(binary, args,/);
  assert.doesNotMatch(mainSource, /shell\s*:\s*true/);
});

test("work-panel views are self-contained pages", () => {
  assert.ok(commitHtml.includes("<!doctype html>") || commitHtml.includes("<!DOCTYPE html>"));
  assert.ok(gitHtml.includes("<!doctype html>") || gitHtml.includes("<!DOCTYPE html>"));
  assert.ok(commitHtml.length > 100_000);
  assert.ok(gitHtml.length > 100_000);
});
