---
name: pi-desktop-install-guard
description: "PI-Desktop 做插件、装 .piplug、迁技能、修 MCP、恢复显示错版本。先分清 Desktop 还是 PI CLI，再 PluginScaffold → Check → Pack → 插件页钉住。不要把 PI CLI 包、同名 SKILL.md 或 Codex MCP 当 Desktop 插件。"
---

# 一次装到位

**钉住** PI-Desktop 的正式安装。这是给 **PI-Desktop 装插件**，不是给 Windows 桌面装软件，也不还原桌面图标。文件在场、`status: ready`、打包通过，都不能单独证明已安装。

长期可用 = **产品线**正确 + 能力边界独立 + 正式安装路径钉住 + 唯一运行时入口 + 实际加载验证。

先加载本技能。写插件再加载 `desktop-plugin-author`。MCP 再加载 `desktop-mcp`。从 zcode / Codex / PI CLI 迁能力再加载 `desktop-migrate`。例外手改 registry 见 [recovery.md](../references/recovery.md)。

## 先分类

动手前先回答两问。用户没说清就问一句，不要猜。

1. **产品线**：PI-Desktop，还是 PI CLI？
2. **贡献面**：插件、技能，还是 MCP？

| 产品线 | 配置 | 正式副本 | 技能入口 | 官方安装器 | 产物 |
| --- | --- | --- | --- | --- | --- |
| PI-Desktop | `~/.pi-desktop/plugins/registry.json` | `~/.pi-desktop/plugins/installed/<id>` | `manifest.contributes.skills` 列出**具体 `.md` 路径** | `PluginScaffold` / `PluginCheck` / `PluginPack` | `dist/<id>-<version>.piplug` |
| PI CLI | `~/.pi/agent/settings.json` 的 `packages` | `~/.pi/agent/packages/<name>` 或 `npm:<pkg>` | `package.json` 的 `pi.skills` 指向目录，目录内 **`SKILL.md`** | `pi install` | npm pack / 本地 package |

当前会话是 PI-Desktop 时，只走 Desktop 列。PI CLI 的完成标准：CLI 能加载该 Skill，路径不指向 `~/.pi-desktop/plugins`。不要把 A 的目录写进 B 的配置。

MCP 按产品线隔离，见 `desktop-mcp`。Desktop 的用户 MCP 在 `~/.agents/servers`，不是 `agent-capabilities/mcp.json`，也不是 PI CLI 的 `pi-mcp-adapter`。

## 钉住 Desktop 插件

完成标准（**四方一致**）：

- 磁盘 `manifest.json` 的 `name` / `version` 就是要交付的版本，不是脚手架 `0.1.0`
- registry 同一套 `name` / `version`，`source` 为 `installed`（本地 `.piplug`）或 `marketplace`（市场）
- `path` 指向 `~/.pi-desktop/plugins/installed/<id>`，且该处仍有 `manifest.json`
- 代表性 Skill 能分别打开，运行时 ID 没有折叠

步骤：

1. `PluginScaffold` 建骨架（立刻加载）。完成：制作目录存在，且已作为目录插件加载。写插件细节见 `desktop-plugin-author`。
2. 改 manifest / 技能 / `main.js`。目录加载保存即热更新。保持 PI-Desktop 进程存活。
3. 技能入口：`contributes.skills` 里每个路径的**文件名**唯一；front matter `name` 用 `^[a-z0-9-]+$`，并与文件名对齐。要生效必须有 `agent.prompt.inject`。插件树内不要把 `SKILL.md` 当入口。中文概览页不要写进 `contributes.skills`。正文标题可以是中文。上限：32 个技能、每个 128 KiB、description 240 字符。
4. `PluginCheck`。错误必须修。技能包上 `agent.prompt.inject` 的 high-risk 警告可接受。
5. `PluginPack` 生成 `dist/<id>-<version>.piplug`（store-only 未压缩 zip）。完成：文件存在且不是 deflate。不要用系统 `zip` / `tar`。
6. 请用户在**插件页**安装该 `.piplug`。完成：`source` 变成 `installed`，`path` 指向 `installed/<id>`。不要手填 `marketplace.*`（`official` / `verified`）。
7. 对用户只报告：是否已安装、显示名和版本、是否还要在插件页装一次 `.piplug`。

`id` 用 `local.` 前缀。改显示名或版本不要改 `id`。全局能力用 `scope: { "mode": "global", "projects": [] }`。

## 金标准形状

对照市场插件「C盘防垃圾」：

- `source: marketplace`（本地等价是插件页装 `.piplug` → `source: installed`）
- `status: ready` 只说明没 `load_error`，不能证明版本不是脚手架
- `path` 在 `installed/<id>`。宿主可能混用斜杠，保持原样
- 纯技能包只要 `agent.prompt.inject`。有工具才声明 `contributes.agentTools` 并申请 `agent.tool.register`

`source:dev` 只用于制作：监视任意源目录热加载，该目录必须一直存在且含 `manifest.json`。dest 被删会报 `manifest.json missing`，即使 `installed/` 里已有正式文件。dev **不等于**已安装。

只改 `registry.json` 会被宿主用 dest 上的脚手架缓存盖回去。正式安装器可用时走插件页。

## 工作区与垃圾文件

`PluginCheck` / `PluginPack` 的 `directory` 是工具工作区相对路径，不一定等于 `workspace-file-guard` 的 `projectRoot`。动手前重新解析三棵树：当前工作区、`registry.path`（dev 时）、`plugins/installed/<id>`。

测试、草稿、日志只进当前工作区 `Temp/` 或 `$PI_SCRATCH_DIR`。密钥不进包。放宽 `permissions` 或 `manifest.fs` 需要用户在插件页显式重载。

## 分包

工作流、记忆、媒体、架构图默认独立安装。本包只覆盖 Desktop 的安装钉住，不含那些能力。

## 验证顺序

Check → Pack（需分发时）→ 磁盘清单 → 登记的 name/version/source/path → 代表性 Skill 或 MCP 工具实际加载。

## 执行检查清单

- 已区分本次是 PI CLI 还是 PI-Desktop
- 已区分要动的是插件、技能还是 MCP
- 已区分制作目录、`source:dev` 路径、`installed/` 正式副本
- 每个 Skill 入口文件名唯一；插件树内无作为入口的 `SKILL.md`
- 需要分发时已 PluginPack；请用户在插件页装 `.piplug`
- registry 与磁盘 manifest 四方一致，且 path 下 `manifest.json` 存在
- 没有脚手架版本、空 dest、重复注入或打包进 Key
- 未强杀 PI-Desktop
