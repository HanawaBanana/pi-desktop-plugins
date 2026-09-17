---
name: desktop-plugin-author
description: "PI-Desktop 写插件、改 manifest、做面板/工具/技能包、对照官方模板和市场上架字段。用 PluginScaffold → Check → Pack。不要写成 PI CLI 的 SKILL.md 包。"
---

# 写 Desktop 插件

本技能只**写** PI-Desktop 插件。先加载 `pi-desktop-install-guard` 分清产品线。迁自 zcode / Codex / PI CLI 先 `desktop-migrate`。钉住正式安装再回到 install-guard。

对照清单：[plugin-author-checklist.md](../references/plugin-author-checklist.md)。

## 选模板

用 `PluginScaffold`，不要手搓目录。完成：制作目录存在，且已作为目录插件加载。

| 要交付的面 | 模板 | 官方对照 |
| --- | --- | --- |
| 只要技能说明 | `skill-pack` | 本包；市场「C盘防垃圾」是技能+工具 |
| 只要面板 | `panel-basic` | `demo.hello` 的面板部分 |
| 只要 Agent 工具 | `agent-tool-basic` | `demo.hello` 的 `echo_text` |
| 面板 + 命令 + 工具 + 设置 | `full-demo` | 实用模板 `demo.workspace-summary` |
| 演示高风险授权 | 不要当默认 | `demo.workspace-notes` 只示范授权形状 |

市场上架从 `demo.workspace-summary` 抄布局，不要从 Hello 扩。高风险权限不要因为 notes demo 有就申请。

## 改 manifest

必填：`schemaVersion`、`id`、`name`、`version`、`main`。所有路径相对插件根，不得逃出。

`id` 匹配 `[a-zA-Z0-9][a-zA-Z0-9._-]*`。本机插件用 `local.`。改显示名或版本不要改 `id`。上官方市场时 `id` 必须全局唯一；社区常用 `io.github.<user>.<name>`。不要把 `official` / `verified` 写进 registry。

交付版本写进磁盘 `manifest.json`，不要停在脚手架 `0.1.0`。

市场上架再补这些（CONTRIBUTING + 三个官方 demo +「C盘防垃圾」）：

- `i18n.en` 与 `i18n.zh-CN`：`name`、`description`、`safetyNotes`
- `author`、`engines.piDesktop` `>=0.2.0`、`categories`、`changelog`、`safetyNotes`
- README 用中英写清**项目用途**和**不是什么**
- 有面板：`ui.panel` + `ui.title.en` / `ui.title.zh-CN`；`pi.ui.openPanel()` **不要**传 `title`
- 有工具：`contributes.agentTools` + `agent.tool.register`；运行时名前缀 `plugin_<id_safe>_`
- 有命令 / 设置：写进 `contributes`

完成：PluginCheck 不再报缺字段；中英用途与 `safetyNotes` 一致。

## 写技能

`contributes.skills` 列出具体 `.md` 路径。每个**文件名**唯一；front matter `name` 用 `^[a-z0-9-]+$`，并与文件名对齐。要生效必须有 `agent.prompt.inject`。插件树内不要把 `SKILL.md` 当入口。中文概览页不要列入 `contributes.skills`。上限 32 个、每个 128 KiB、description 240 字符。

完成：每个入口能单独打开，运行时 ID 没有折叠。

## 权限与入口

只申请用到的权限。未声明的调用运行时失败。放宽 `permissions` 或 `manifest.fs` 要用户在插件页显式重载。

`main.js` 在独立进程里跑，没有宿主环境变量，只有全局 `pi`。导出无参 `onLoad` / `onUnload`。`onLoad` 15s，其他钩子 5s，Agent 工具 110s。未捕获错误会整包回滚到 `load_error`。

面板用 `window.pluginBridge`，不是 `pi`。宿主占 46px 透明拖动带；固定/粘顶 UI 用 `top: var(--pi-plugin-titlebar-height, 46px)`。不要再做一条窗口标题栏。

`fs.write` / `fs.delete` 禁止整树；`net.domains` 空则无出网。密钥不进包、不进 manifest / 技能正文 / MCP 字面量。

高风险（写盘、联网、密钥、注入、本地 MCP 等）按 SECURITY：能力/数据流矩阵、负路径、来源说明。技能包的 `agent.prompt.inject` 警告可接受，仍要在 README 写清只注入说明。

## 开发循环

1. `PluginScaffold`（立刻加载）。
2. 改源码。目录加载保存即热更新。保持 PI-Desktop 存活。
3. `PluginCheck`。错误必须修。
4. `PluginPack` 得到 store-only `.piplug`。不要用系统 zip/tar。
5. 请用户在插件页装 `.piplug`（install-guard 的钉住步骤）。

`PluginCheck` / `PluginPack` 的 `directory` 是工具工作区相对路径。

## 上官方市场

仓库 `vastsa/pi-desktop-plugins`。`plugins.aiuo.net` 未上线。步骤见清单「上架」节。完成：fork 里有 `plugins/<id>/`，catalog 的 sha256 与 `.piplug` 一致，PR 打开。不要手改 `catalog.json`。
