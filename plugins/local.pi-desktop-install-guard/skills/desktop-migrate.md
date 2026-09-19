---
name: desktop-migrate
description: "把 zcode、Codex、PI CLI 的技能或 MCP 迁进 PI-Desktop。改写成唯一入口文件名和 .piplug，MCP 写成 Desktop 的 servers JSON。不要原样拷贝 SKILL.md 包、pi-mcp-adapter 或 Codex wrapper。"
---

# 迁进 Desktop

上游能跑，不表示可以原样丢进 PI-Desktop。必须改写，再按 `pi-desktop-install-guard` **钉住**。

先加载 `pi-desktop-install-guard`。MCP 条目本身走 `desktop-mcp`。本技能只处理「从别的产品线搬过来」。

## 改写清单

完成标准：改写后的树是合法 Desktop 插件或合法 Desktop 用户 MCP；没有另一条产品线的入口文件、包装器路径或 package 布局。

1. 每个技能改成唯一入口文件名（与 front matter `name`、目录名对齐，`^[a-z0-9-]+$`）。插件树里去掉作为入口的 `SKILL.md`。
2. 脚本路径改成插件目录或当前 `source:dev` 目录，不要指向已删交接包。
3. Key 不进包。需要密钥的脚本只读用户本机密钥文件，且只放进请求头，不写进 manifest / 技能正文 / MCP 字面量。
4. 工作流、记忆、媒体、架构图默认分包。不要把无关能力塞进同一个 `.piplug`。
5. 不要运行目标为 Codex 的安装脚本（例如 awesome-gpt-image-2 的 `npm run install:skill`）。
6. 不要把 Codex MCP 包装器、ZCode MCP URL、PI CLI package、`SKILL.md` 目录互抄。
7. 画图类：对用户说「用 gpt 画」/「用 grok 画」；出图走各自接口；视频只走 Grok。不要混用已断的提供商。

迁的是 **PI CLI 包** 而用户要的是 CLI：停，改走 `pi install` / `~/.pi/agent/packages` + `pi.skills` → `SKILL.md`。不要为了「方便」写成 `.piplug`。

迁的是 **Desktop 插件**：改写完成后继续钉住步骤（Check → Pack → 插件页装 `.piplug`）。

## 不要当作已完成的信号

- 磁盘上有上游目录
- 在 Codex / ZCode / PI CLI 里能调用同名能力
- PluginCheck 通过但还停在 `source:dev`
- 插件页显示脚手架名或 `0.1.0`

以上任何一条都不等于 Desktop 已安装。
