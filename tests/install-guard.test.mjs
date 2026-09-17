import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(root, "plugins", "local.pi-desktop-install-guard");
const manifest = JSON.parse(readFileSync(join(pluginRoot, "manifest.json"), "utf8"));
const main = require(join(pluginRoot, "main.js"));

test("install-guard manifest identity, permissions, and marketplace fields", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "local.pi-desktop-install-guard");
  assert.equal(manifest.version, "1.2.0");
  assert.equal(manifest.main, "main.js");
  assert.equal(manifest.author, "YahooYuan666");
  assert.deepEqual(manifest.permissions, ["agent.prompt.inject"]);
  assert.equal(manifest.engines.piDesktop, ">=0.2.0");
  assert.ok(manifest.i18n.en.name);
  assert.ok(manifest.i18n.en.description);
  assert.ok(manifest.i18n.en.safetyNotes);
  assert.ok(manifest.i18n["zh-CN"].name);
  assert.ok(manifest.i18n["zh-CN"].description);
  assert.ok(manifest.i18n["zh-CN"].safetyNotes);
  assert.match(manifest.description, /PI-Desktop/);
  assert.doesNotMatch(manifest.description, /还原桌面/);
  assert.ok(!manifest.contributes.agentTools);
  assert.ok(!manifest.ui);
});

test("install-guard skill entries are unique kebab files and export empty lifecycle", () => {
  const skills = manifest.contributes.skills;
  assert.deepEqual(skills, [
    "skills/pi-desktop-install-guard.md",
    "skills/desktop-plugin-author.md",
    "skills/desktop-mcp.md",
    "skills/desktop-migrate.md",
  ]);
  const names = new Set();
  for (const relativePath of skills) {
    assert.equal(existsSync(join(pluginRoot, relativePath)), true, relativePath);
    assert.notEqual(basename(relativePath), "SKILL.md");
    const body = readFileSync(join(pluginRoot, relativePath), "utf8");
    const match = body.match(/^name:\s*([a-z0-9-]+)\s*$/m);
    assert.ok(match, `kebab name missing in ${relativePath}`);
    assert.equal(match[1] + ".md", basename(relativePath));
    assert.equal(names.has(match[1]), false, `duplicate skill name ${match[1]}`);
    names.add(match[1]);
  }
  assert.equal(typeof main.onLoad, "function");
  assert.equal(typeof main.onUnload, "function");
  assert.equal(existsSync(join(pluginRoot, "README.md")), true);
  assert.equal(existsSync(join(pluginRoot, "LICENSE")), true);
  assert.equal(existsSync(join(pluginRoot, "references", "plugin-author-checklist.md")), true);
  const readme = readFileSync(join(pluginRoot, "README.md"), "utf8");
  assert.match(readme, /PI-Desktop/);
  assert.match(readme, /Windows desktop installer/i);
});
