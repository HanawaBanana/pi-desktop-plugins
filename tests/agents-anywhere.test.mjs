import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const pluginRoot = join(root, "plugins", "pi.agents-anywhere");
const manifest = JSON.parse(readFileSync(join(pluginRoot, "manifest.json"), "utf8"));
const catalog = JSON.parse(readFileSync(join(root, "catalog.json"), "utf8"));

test("Agents Anywhere plugin declares the expected identity and permissions", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "pi.agents-anywhere");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.main, "main.js");
  assert.deepEqual(manifest.permissions, [
    "ui.view",
    "net.fetch",
    "net.websocket",
    "desktop.control",
  ]);
  assert.deepEqual(manifest.net?.domains, [
    "api.agents-anywhere.com",
    "web.agents-anywhere.com",
  ]);
  assert.ok(manifest.i18n?.en?.safetyNotes);
  assert.ok(manifest.i18n?.["zh-CN"]?.safetyNotes);
});

test("Agents Anywhere plugin package exists and is registered in marketplace catalog", () => {
  const packagePath = join(root, "packages", `pi.agents-anywhere-${manifest.version}.piplug`);
  assert.ok(existsSync(packagePath), "piplug package file must exist");

  const entry = catalog.plugins.find((p) => p.id === "pi.agents-anywhere");
  assert.ok(entry, "plugin must be listed in catalog.json");
  assert.equal(entry.name, manifest.name);
  assert.equal(entry.author, manifest.author);

  const versionEntry = entry.versions.find((v) => v.version === manifest.version);
  assert.ok(versionEntry, "matching version entry must exist in catalog");
  assert.equal(versionEntry.url, `packages/pi.agents-anywhere-${manifest.version}.piplug`);
  assert.ok(versionEntry.shasum && versionEntry.shasum.length === 64);
});
