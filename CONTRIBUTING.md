# Contributing plugins to PI-Desktop

This repository holds the plugin sources, the tooling that builds them, and the packages and catalog
this repository serves.

Releases are published on the plugin center:

```text
https://plugins.aiuo.net
```

The center is the client's default catalog source (`https://plugins.aiuo.net/catalog.json`). It binds
each plugin to the repository it lives in, audits the source, serves the `.piplug` packages and
mirrors `catalog.json` + `packages/` to
[AIUO-Net/pi-desktop-plugins](https://github.com/AIUO-Net/pi-desktop-plugins) for the GitHub backup
channel. Adding a plugin to this repository is one way in; publishing your own repository on the
center is the other.

## Quick start

```bash
# 1) fork + clone
git clone https://github.com/<you>/pi-desktop-plugins.git
cd pi-desktop-plugins

# 2) copy the practical template
cp -R plugins/demo.workspace-summary plugins/my.plugin-id

# 3) edit manifest + code
#    - change id/name/version/description
#    - implement main.js
#    - optional renderer/index.html

# 4) pack
python3 scripts/pack_plugin.py plugins/my.plugin-id

# 5) run the release gates
python3 scripts/security_audit.py --check-packages

# 6) open a PR to vastsa/pi-desktop-plugins, or publish your own repository on the plugin center
```

## Plugin layout

```text
plugins/<id>/
  manifest.json      # required
  main.js            # required entry
  renderer/          # optional isolated panel UI
  README.md          # shown in marketplace detail
  skills/            # optional
```

### manifest.json minimum

```json
{
  "schemaVersion": 1,
  "id": "my.plugin-id",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "What it does",
  "i18n": {
    "en": {
      "name": "My Plugin",
      "description": "What it does"
    },
    "zh-CN": {
      "name": "我的插件",
      "description": "插件功能简介"
    }
  },
  "author": "your-name",
  "main": "main.js",
  "permissions": ["ui.panel"],
  "engines": { "piDesktop": ">=0.2.0" }
}
```

Use BCP-47 locale keys in `i18n`. The marketplace discovers available locale
options from these keys, so additional locales do not require a website code
change. The website falls back to English when its own UI copy is not yet
translated, while plugin metadata falls back to English, Simplified Chinese,
then the base manifest fields.

### Recommended fields for marketplace quality

- `categories`: e.g. `["productivity", "official"]`
- `i18n`: localized `name`, `description`, `safetyNotes` and optional `readmeMarkdown`
- `changelog`: short release notes for the current version
- `safetyNotes`: plain-language risk summary
- `ui.panel`: isolated panel html entry
- `contributes.commands` / `contributes.agentTools` / `contributes.settings`

### Panel title and host chrome compatibility

Panel titles must provide both English and Simplified Chinese so PI-Desktop can
follow the active application language:

```json
{
  "ui": {
    "panel": "renderer/index.html",
    "title": {
      "en": "My Plugin",
      "zh-CN": "我的插件"
    }
  }
}
```

Do not hard-code a replacement title when opening the panel from a command. Use
`pi.ui.openPanel()` without a `title` option so the host can resolve the
localized manifest title. PI-Desktop reserves exactly a 46px transparent drag
band at the top of every panel and renders a minimal three-button window-control
capsule in the top-right corner. The band is intentionally not clickable; the
host may show a development hint for it. Normal-flow plugin content is offset
below the band automatically. Plugins own every other visible part of the
panel, and must not implement a second draggable window titlebar. A plugin
element that is fixed or sticky to the window edge must begin at
`top: var(--pi-plugin-titlebar-height, 46px)`; sticky elements inside their own
scrollable views can keep their local `top: 0` behavior.

## Local verification in PI-Desktop

Before opening a PR:

1. Open PI-Desktop → **Plugins**
2. Use **Load dev plugin** and choose `plugins/<id>`
3. Confirm:
   - command palette entry works
   - panel opens (if declared)
   - agent tool appears with forced prefix `plugin_<id_safe>_<tool>`
   - undeclared permissions fail cleanly

Or install the packed artifact:

1. `python3 scripts/pack_plugin.py plugins/<id>`
2. PI-Desktop → **Install .piplug**
3. Review permissions carefully

## Packaging rules

- Root of the package must contain `manifest.json`
- No symlinks
- No path traversal
- Prefer store-compressed `.piplug`
- Max package size: 50MB
- Do not expect host-side `npm install` at install time; bundle dependencies yourself

## Permission policy

Request the minimum set:

| Permission | Use |
|---|---|
| `ui.panel` | Open isolated panel |
| `fs.read.workspace` | Read project files |
| `fs.write.workspace` | Modify project files |
| `clipboard.read` / `clipboard.write` | Clipboard access |
| `notify` | Local notifications |
| `net.fetch` | Outbound network |
| `shell.openExternal` | Open external links |
| `agent.tool.register` | Expose tools to the agent |
| `usage.read` | Read aggregate local token usage without message content |

High-risk permissions are reviewed in the install UI. Auto-update will not silently expand permissions.

## Security review gate
Read [SECURITY.md](./SECURITY.md) before submitting a plugin. This repository does not accept backdoors, hidden data collection or exfiltration, remote code loading, unexplained obfuscation, hard-coded credentials, persistence, security-control changes, or destructive operations without explicit user confirmation.
Run the fail-closed preflight after packing:
```bash
python3 scripts/security_audit.py --check-packages
```
Resolve every blocker. Manual-review signals are expected for legitimate high-risk capabilities, but they still require maintainer sign-off. For filesystem writes/deletes, network, credentials, native binaries, shell/PTY, SSH, background services, prompt injection, or desktop control, include a capability/data-flow matrix, negative-path tests, dependency provenance, and two independent maintainer approvals. Review both `plugins/<id>/` and the `.piplug` contents; a passing script or test suite is not proof that a plugin has no backdoor.
## PR checklist

- [ ] Unique `id`
- [ ] Semantic `version`
- [ ] README explains what/why/permissions
- [ ] `python3 scripts/pack_plugin.py ...` succeeds
- [ ] `python3 scripts/rebuild_catalog.py` updated `catalog.json`
- [ ] Package sha256 in catalog matches the `.piplug`
- [ ] Tested via Load dev plugin and/or Install .piplug
- [ ] No secrets in source or package
- [ ] `python3 scripts/security_audit.py --check-packages` passes with zero blockers
- [ ] High-risk changes have two independent maintainer approvals and a recorded capability/data-flow review

## After merge

Merging adds the plugin to this repository, its packages and its catalog — it does not by itself
ship a release to users. Releases live on the plugin center:

1. Create the plugin (or submit a new version) on [plugins.aiuo.net](https://plugins.aiuo.net) —
   see [Publish a Plugin](./README.md#publish-a-plugin) in the README
2. Push the plugin's own repository and tag the version; that tag is the `sourceRef` the review reads
3. After the audit and approval the version appears in `https://plugins.aiuo.net/catalog.json`,
   which is what PI-Desktop's **Plugins → Marketplace** loads

## Template recommendation

Start from:

- `plugins/demo.workspace-summary` for a real productivity plugin
- `plugins/demo.hello` for the smallest command/panel/tool sample
- `plugins/demo.workspace-notes` for high-risk capability demos
