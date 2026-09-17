# 一次装到位 / PI-Desktop Install Guard

**项目用途：** 给 **PI-Desktop** 写插件、装插件、迁技能、修 MCP。让 Agent 按官方模板写好，再一次装到正式路径（`.piplug` → `source:installed`），并且不要和 **PI CLI** 搞混。

**不是：** 不是给 Windows 桌面装应用、快捷方式、文件夹，也不是还原桌面布局。本包不碰桌面图标。

This is a **PI-Desktop skill pack**. It teaches the agent how to **write** Desktop plugins (official templates + marketplace fields) and how to install them in one pass, without mixing them with PI CLI packages, Codex MCP wrappers, or same-named `SKILL.md` folders.

It is **not** a Windows desktop installer and does **not** restore desktop shortcuts or layout.

本包只注入规则。不改 `registry.json`、不替你点安装、不拉起 MCP、不读密钥。

The plugin only injects instructions. It does not edit the registry, click Install, start MCP, or read secrets.

## 你怎么用 / When to use

| 你说 | 它做什么 | English |
|---|---|---|
| 做个 Desktop 插件 / 写插件 / 装插件 | 先按官方模板写，再 PluginScaffold → Check → Pack → 请你在插件页装 `.piplug` | Write against official templates, then scaffold, check, pack, install |
| 插件页还是 0.1.0 / 脚手架名 | 不手改登记；打包后再在插件页装一次 | Do not hand-edit the registry; pack and install again |
| MCP 连接失败 | 只改 `~/.agents/servers`；stdio 用绝对路径；http 用 HTTPS | Edit Desktop user MCP only; absolute stdio; HTTPS for http |
| 把 Codex / zcode / PI CLI 的技能搬过来 | 改写成唯一入口文件名，再钉成 `.piplug` | Rewrite unique skill filenames, then nail a `.piplug` |
| 这是给 PI 命令行用的 | 停，改走 `pi install` / `SKILL.md` | Stop; that is PI CLI, not this plugin |

## 技能文件 / Skills

入口文件名必须互不相同，否则 PI-Desktop 会把技能折成一个。

Skill entry filenames must be unique or PI-Desktop folds them into one runtime id.

| 文件 | 何时用 | When |
|---|---|---|
| `skills/pi-desktop-install-guard.md` | 分类 + 钉住插件 | Classify product line and nail the plugin |
| `skills/desktop-plugin-author.md` | 怎么写插件（模板、manifest、市场上架） | How to write a plugin |
| `skills/desktop-mcp.md` | Desktop 用户 MCP | Desktop user MCP only |
| `skills/desktop-migrate.md` | 从其他产品线改写 | Rewrite from zcode / Codex / PI CLI |

例外手改登记：`references/recovery.md`（不当作技能入口）。

## 权限 / Permissions

| 权限 | 用途 |
|---|---|
| `agent.prompt.inject` | 把安装与写作规则注入 Agent。不写盘、不联网、不改桌面。 |

## 能力 / 数据流

| 能力 | 数据 | 方向 |
|---|---|---|
| `agent.prompt.inject` | 本插件 `skills/*.md` 与 `references/recovery.md` | 注入当前会话；不读聊天记录、不外传 |
| 文件系统 / 网络 / 剪贴板 / MCP / Windows 桌面 | 无 | 不申请、不使用 |

## 安装本插件 / Install this plugin

开发：插件页已指向本目录时，保存即热更新。`source:dev` 只表示正在做，不等于已安装。

给以后用：插件页安装 `dist/local.pi-desktop-install-guard-1.2.0.piplug`。

不要手改 `registry.json`。不要把本目录登记成 PI CLI package。

## 许可 / License

MIT。规则来自本机已验证的 PI-Desktop 安装/迁移经验，不是官方市场插件。
