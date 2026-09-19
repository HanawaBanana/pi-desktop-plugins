---
name: desktop-mcp
description: "PI-Desktop MCP 连接失败、市场下载连不上、basic-memory / Context7 / Fetch。只改 ~/.agents/servers。stdio 用绝对路径可执行文件，http 用 HTTPS。不要用 PI CLI adapter、Codex 包装器或裸 npx。"
---

# Desktop MCP

PI-Desktop 的用户 MCP 与 PI CLI、Codex、ZCode **不同步**。某一条产品线能用，只证明那条已接通。

先加载 `pi-desktop-install-guard` 做产品线分类。本技能只处理 **PI-Desktop 用户 MCP**。

## 看哪份文件

| 登记面 | 路径 | 角色 |
| --- | --- | --- |
| Desktop 全局用户 MCP | `~/.agents/servers/<id>.json` | MCP 页列出的就是这里 |
| Desktop 项目用户 MCP | `<工作区>/.agents/servers` | 项目级；空则只有全局 |
| Desktop 开关缓存 | `~/.pi-desktop/agent-capabilities/mcp.json` | 不是服务器清单 |
| Desktop 插件 MCP | manifest 声明 + `mcp.server.local` / `mcp.server.remote` | 声明式贡献，不是抄包装器路径 |
| PI CLI | `npm:pi-mcp-adapter`；Pi 覆盖 `~/.pi/agent/mcp.json` | 不要用它「同步」Desktop |
| Codex | `config.toml` 的 `mcp_servers` | 不要把包装器路径抄进 Desktop |

密钥只放该条目的 `env` / `headers`。MCP 字面量、主题 CSS、manifest 里不放密钥。

工具名以**当前 Desktop 会话实际暴露的**为准。不要假设 CLI 的 `bm_recall` 或 Codex 的 `mcp__basic_memory__...` 在这里存在。

## 条目形状

每条 JSON：`id`、`label`、`description`、`transport`（只允许 `stdio` 或 `http`）、`enabled`。

**stdio**

- 必须有 `command`；不要设 `url` / `headers`
- `args` 为字符串数组；`env` 可选
- 宿主 `spawn(command, args, { cwd: homedir(), shell: false })`
- 用户 MCP 的 `commandPolicy` 为 `trusted`：允许绝对路径，禁止 `..`
- 裸命令名须匹配 `^[A-Za-z0-9][A-Za-z0-9._+-]*$`
- Windows 上 `npx` 常是 `npx.cmd` / `npx.ps1`，`shell: false` 不会跑它们 → 记 `spawn npx ENOENT`
- 握手时限 **10000ms**。超时记 `mcp initialize timed out after 10000ms`

**http**

- 必须有绝对 `http:` / `https:` URL
- 不要设 `command` / `args` / `env`
- `headers` 可选

市场下载只当草稿。stdio 优先本机已装的**绝对路径**可执行文件。会冷启动超过 10 秒的 `uvx` 不适合这个时限。需要 Node 包时不要写裸 `npx`。远程服务用 `transport: http` + HTTPS URL。

## Basic Memory

`--project` 取 `~/.basic-memory/config.json` 里指向**笔记库根**的项目名，不是 `remember` / `decisions` 这类文件夹。不要把 MCP `command` 指到这些文件夹。

完成标准：握手 < 10s，MCP 页出现工具数，`bm project ls` 能看到目标库里的笔记。

已验证形状（把路径换成这台机器上的真实 `bm` 可执行文件）：

```json
{
  "id": "io-github-basicmachines-co-basic-memory",
  "transport": "stdio",
  "command": "<absolute-path-to-bm.exe>",
  "args": ["mcp", "--project", "<name-in-config.json>"]
}
```

CLI `--version` 与握手里的 FastMCP 横幅版本可以不同，不要当成装错了主程序。

## Context7 一类远程服务

```json
{
  "id": "context7",
  "transport": "http",
  "url": "https://mcp.context7.com/mcp"
}
```

若再要 Key，只加 `headers`，不要改回 `npx`。

## 改完怎么生效

改 JSON 后在 MCP 页把开关关再开（或离开再进入）。不要杀 PI-Desktop。

完成标准：当前 Desktop 会话能列出该服务器的工具。
