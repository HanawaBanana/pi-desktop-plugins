# PI Matt 工作流 / PI Matt Workflow

**项目用途：** 把 [Matt Pocock Skills](https://github.com/mattpocock/skills) 装进 **PI-Desktop**：规划、实现、测试、评审。另有一条 PI 原生门闸，避免把普通问答当成项目执行。

**不是：** 不含 Basic Memory、中转站媒体、画图风格库、MCP。那些要单独装。

**Purpose:** Matt Pocock engineering skills for **PI-Desktop** (plan, implement, test, review), plus one PI-native gate so a general question is not treated as project execution.

**Not included:** Basic Memory, media generation, image styles, or MCP. Install those separately.

本包只注入技能。不写文件、不拉起 MCP、不注册工具。

Instruction documents only. No file writes, MCP, or agent tools.

## 含什么 / Included

- 工程：`ask-matt`、`setup-matt-pocock-skills`、`grill-with-docs`、`to-spec`、`to-tickets`、`implement`、`tdd`、`code-review` 等
- 生产力：`grill-me`、`handoff`、`writing-for-agents` 等
- 门闸：`skills/pi-matt-workflow.md`

每个上游 `SKILL.md` 已改成唯一文件名，避免 PI-Desktop 把技能折成一个。

Each upstream `SKILL.md` is renamed to a unique filename so PI-Desktop does not collapse them.

上游来源：`mattpocock/skills` commit `959a8e9f1edc3adbe2f7e3054bb6fbefa6696260`（MIT，见 `THIRD_PARTY_LICENSE_MATT.txt`）。

## 权限 / Permissions

| 权限 | 用途 |
|---|---|
| `agent.prompt.inject` | 注入 Matt 技能说明 |

## 安装 / Install

插件页安装 `.piplug`。范围由你在插件页选择（本机可锁到指定项目）。

Install the `.piplug` from the Plugins page. Scope is whatever you set there.
