# 写插件对照清单

给 `desktop-plugin-author` 用。官方来源：宿主 `plugin-development.md`、市场 [CONTRIBUTING.md](https://github.com/vastsa/pi-desktop-plugins/blob/main/CONTRIBUTING.md)、[SECURITY.md](https://github.com/vastsa/pi-desktop-plugins/blob/main/SECURITY.md)、`demo.hello` / `demo.workspace-summary` / `demo.workspace-notes`、已上架「C盘防垃圾」。

本文件不是技能入口，不要写进 `contributes.skills`。

## 形状

- [ ] 产品线是 PI-Desktop，不是 PI CLI `SKILL.md` 包
- [ ] 用 `PluginScaffold` 模板，未手搓逃逸路径
- [ ] `schemaVersion` / `id` / `name` / `version` / `main` 齐全；版本不是脚手架 `0.1.0`
- [ ] 本机 `id` 用 `local.`；上市场则全局唯一
- [ ] 技能入口文件名唯一、kebab `name`、有 `agent.prompt.inject`、无入口 `SKILL.md`
- [ ] 权限最小；工具/面板/MCP/主题都有对应声明
- [ ] 无密钥、无符号链接、无整树写删
- [ ] PluginCheck 无 error；PluginPack 为 store-only zip
- [ ] README 写清用途、不是什么、权限、数据流

## 市场上架字段

- [ ] `i18n.en` + `i18n.zh-CN`（name / description / safetyNotes）
- [ ] `author`
- [ ] `engines.piDesktop` `>=0.2.0`
- [ ] `categories`（不要自己标 `official`，那是仓库维护者的）
- [ ] `changelog`、`safetyNotes`
- [ ] 中英 README 项目用途
- [ ] 有面板则 `ui.title` 中英；打开面板不传 `title`
- [ ] 许可文件（MIT 或与上游一致）并在 README 写明

## 面板（有 UI 时）

- [ ] `renderer/` 入口写在 `ui.panel`
- [ ] 固定/粘顶从 `--pi-plugin-titlebar-height` 起，不重做标题栏
- [ ] 只用 `pluginBridge` 固定通道

## 上架

```text
fork vastsa/pi-desktop-plugins
copy dest → plugins/<id>/
python3 scripts/pack_plugin.py plugins/<id>
python3 scripts/security_audit.py --check-packages
python3 scripts/rebuild_catalog.py
PR → vastsa/pi-desktop-plugins
```

- [ ] 包根有 `manifest.json`
- [ ] catalog 的 sha256 / 体积与 `.piplug` 一致（脚本生成，不手改）
- [ ] 高风险有能力/数据流矩阵；`agent.prompt.inject` 技能包在 README 写明只注入
- [ ] 合并后：插件页 Marketplace → Refresh from repo

本地钉住仍走插件页装 `.piplug`，不要手填 `marketplace.*`。
