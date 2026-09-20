# PI-Desktop Plugins

[English](./README.md)

[PI-Desktop](https://github.com/vastsa/PI-Desktop) 的插件源码与开发仓库：放着插件源码、可安装的 `.piplug` 包，以及构建它们的脚本。

> **发布走插件中心。** [plugins.aiuo.net](https://plugins.aiuo.net) 是客户端默认的目录源，也是目前唯一受支持的发布渠道：创建插件 → 绑定插件所在仓库 → 打标签 → 提交版本。平台负责打包、审查源码、记录 SHA-256，并把 `catalog.json` + `packages/` 同步到
> [AIUO-Net/pi-desktop-plugins](https://github.com/AIUO-Net/pi-desktop-plugins) 作为 GitHub 备用源。只往本仓库提交，不再等于发布。
## 📦 仓库内容

| 路径 | 说明 |
|------|------|
| `catalog.json` | 本仓库插件的目录索引，由 `scripts/rebuild_catalog.py` 生成 |
| `packages/*.piplug` | 打包好的插件安装包，由 `scripts/pack_plugin.py` 生成 |
| `plugins/<id>/` | 插件源码目录，每个插件一个文件夹 |
| `scripts/` | 开发辅助脚本（`pack_plugin.py`、`rebuild_catalog.py`、`security_audit.py`） |
| `tests/`、`website/` | 插件测试与市场网站 |

## 🎯 可用插件

插件中心才是实时列表：每个插件的最新版本都在那儿，也包括作者在自己仓库发布的插件。本仓库保留 `plugins/` 下的插件源码。

### 官方插件（PI-Desktop 团队维护）

| 插件 | 说明 | 作者 |
|------|------|------|
| **pi.todo** | 小清新待办：四象限矩阵 + 简单列表双布局，支持到期提醒与 AI 工具集成 | PI-Desktop |
| **pi.token-insights** | Token 用量分析仪表盘：追踪 PI-Desktop、Claude Code、Codex 等工具的 Token 消耗 | PI-Desktop |
| **pi.gitlens** | GitLens 风格的本地 Git 管理，停靠在右侧工作面板（仅人机 UI，无 Agent 工具） | PI-Desktop |
| **pi.ssh-manager** | 本地优先的 SSH 主机管理与 AI 远程命令工具，支持面板临时密码且不持久化凭据 | PI-Desktop |
| **pi.terminal** | 受 Otty 启发的交互式终端，只停靠在右侧工作面板；多标签、跨平台 shell | PI-Desktop |
| **pi.session-orchestrator** | 会话编排器：让 Agent 并行创建真实持久化 Worker Session，进行多轮督导并验收最终报告 | PI-Desktop |

### 社区插件

本仓库内的源码：

| 插件 | 说明 | 作者 |
|------|------|------|
| **pi.scratch-calc** | 草稿计算器：多行演算、历史记录、百分比/乘方/π/e 支持，暗色模式 | Tioit-Wang |
| **pi.super-domain-man** | 超级域名侠：多平台 DNS 记录管理与 SSL 证书监控/申请工具 | Tioit-Wang |
| **pi.markdown** | 本地 Markdown 笔记：所见即所得编辑、目录大纲、代码高亮、Mermaid / KaTeX | Tioit-Wang |
| **pi.clipboard-history** | 剪贴板历史：运行期间捕获文本，保留 30 天，一键还原 | Tioit-Wang |
| **pi.log-viewer** | 大日志查看器：流式分页、实时跟随、搜索高亮、多文件页签 | Tioit-Wang |
| **pi.file-manager** | 文件管理器：目录树、代码高亮编辑、Markdown 预览、图片音视频与 CSV/JSON 查看、SQLite 只读浏览与 SQL 查询、右键文件操作、按文件名搜索 | Tioit-Wang |
| **pi.bianqian** | Markdown 桌面便签：多便签、实时预览、任务列表、荧光笔与回收站 | ZY |
| **io.github.muzimu217.session-import** | 已迁移至独立仓库：[muzimu217/pi-desktop-session-import](https://github.com/muzimu217/pi-desktop-session-import)，发布于[插件中心](https://plugins.aiuo.net/) | 一体化会话导入与熔炉：导入 ZCode、WorkBuddy、Claude Code、Codex、OpenCode、Pi 的会话，再蒸馏成项目约定与可复用做法 | muzimu217 |
| **io.github.muzimu217.deps-audit** | 依赖漏洞扫描：唤起 osv-scanner 扫描工作区，列出 OSV 依赖漏洞，让 Agent 给出升级或修复 patch | muzimu217 |
| **io.github.liushunqiu.pi-idea-git** | IDEA 风格 Git 工具窗口：暂存/未暂存分组、按代码块暂存与还原、提交、分支切换、图形化日志与储藏 | liushunqiu |
| **pi.workspace-file-guard** | C盘防垃圾：防止模型把测试、日志、缓存、临时文件写到系统盘、桌面、下载，垃圾只待在当前项目的 Temp 或 scratch | xingleiwu |
| **pi.goal-x** | 为 PI-Desktop 提供持久化工作区目标、任务证据与宿主完成审计 | Goal X contributors |
| **pi.parchment** | 羊皮纸主题：米色纸面背景配淡网格，墨色用户气泡，纸色助手卡片，等宽字体元信息行（纯样式） | pkmcenter |
| **pi.obsidian-theme** | 黑曜石主题：深蓝青全局主题，按实测参考图校准——分层表面阶梯、用 1px 发丝边框而非发光建立层级、实心青绿选中态、四档文字层级（纯样式） | ily55421 |

插件中心上由作者自有仓库发布：

| 插件 | 说明 | 作者 |
|------|------|------|
| **cc.mcii.session-notify** | 会话通知：监听全部会话状态变化，把标题和状态推到飞书、钉钉、企业微信、KOOK、Server酱、Telegram 或通用 Webhook；不读消息正文 | LectWolf |
| **cc.mcii.session-usage** | 会话用量：输入 `/usage` 查看当前会话的输入、输出、缓存命中、缓存创建与命中率 | LectWolf |
| **cn.star.computer-use** | 复刻 Codex 的操控功能，让 AI 直接操控电脑完成简单作业 | TheFalreStar |
| **cn.star.grok-enhance** | 给 Grok 加执行纪律，并在每轮第一请求直接激活 Grep / Glob（以及已装的 memory / skill_manage） | TheFalreStar |
| **cn.star.skill-learning** | 把做完的一件事沉淀成 SKILL，下次同类活直接复用；会话较长时在后台自行复盘 | TheFalreStar |
| **cn.star.user-profile** | 本地记录「用户是谁」和「这台机器怎么用」，每轮注入系统提示，Agent 用 `memory` 工具写入；不接远程记忆服务 | TheFalreStar |
| **io.github.catdford.color-picker** | 浏览 Tailwind / Material 全量色板，放大镜从图片取色，按和谐规则或让 AI 生成配色，检查 WCAG 对比度与色盲模拟，导出 CSS 变量 / Tailwind / JSON，也能装成 PI-Desktop 主题 | catdford |
| **local.pi-markdown** | 本地 Markdown 笔记：所见即所得编辑（Typora 风格 Milkdown Crepe）、米白/黑夜双主题、5 级目录与大纲、代码高亮、Mermaid 与 KaTeX、全局搜索、导出 Markdown/HTML/图像，以及只读预览 Agent 工具 preview_file | Tioit-Wang |
| **pi.theme.studio** | 主题工坊：内置 5 套配色，可视化调出属于自己的主题并一键应用，覆盖全部 56 个 `--ds-*` token，点预览区域即可编辑（整窗/左栏/中栏/右栏/标题栏/会话区/输入栏），带实时预览与 WCAG 对比度检查，另带 4 个 Agent 工具 | Tioit-Wang |

### 示例插件（学习参考）

| 插件 | 说明 |
|------|------|
| **demo.hello** | 最小示例：面板 + 命令 + 工具注册 |
| **demo.workspace-summary** | 实用模板：扫描工作区并生成摘要 |
| **demo.workspace-notes** | 高风险能力演示：文件读写 + 网络请求 |

## 🚀 安装插件

1. 打开 PI-Desktop → **插件**
2. 进入 **市场** 页面
3. 点击 **刷新** 加载最新目录
4. 浏览并安装插件

默认源是插件中心：

```text
https://plugins.aiuo.net/catalog.json
```

同一页面还能切换到客户端内置的备用源——GitHub 镜像
（`raw.githubusercontent.com/AIUO-Net/pi-desktop-plugins/main/catalog.json`）和 CNB 镜像，用于插件中心不可达的网络。

## 🛠️ 开发自己的插件

### 快速开始

```bash
# 1) Fork + 克隆仓库
git clone https://github.com/<you>/pi-desktop-plugins.git
cd pi-desktop-plugins

# 2) 复制模板开始开发
cp -R plugins/demo.workspace-summary plugins/my.plugin-id

# 3) 修改插件内容
#    - 更新 manifest.json 中的 id/name/version/description
#    - 实现 main.js 逻辑
#    - 创建 renderer/index.html（可选，用于面板 UI）

# 4) 打包插件
python3 scripts/pack_plugin.py plugins/my.plugin-id

# 5) 在 PI-Desktop 中测试
#    - 使用「加载开发插件」功能
#    - 或直接安装生成的 .piplug 文件

# 6) 发布前跑一遍发布门禁
python3 scripts/security_audit.py --check-packages
```

### 发布到插件中心

开发在本仓库，发布在插件中心。两条路，同一个后端：

- **控制台** — 登录 [plugins.aiuo.net](https://plugins.aiuo.net) → **我的插件** → **创建插件**：上传包、绑定插件所在的仓库、提交。后续版本在插件自己的页面提交。
- **AI 客户端** — 装上发布 skill，让 Agent 跑完整流程：

  ```text
  https://plugins.aiuo.net/skill.md
  ```

  skill 通过 MCP 地址 `https://plugins.aiuo.net/mcp` 调用，凭证是[控制台 → 令牌](https://plugins.aiuo.net/console/publish/tokens)生成的个人访问令牌，存放在 `~/.pi-desktop/plugin-center.token`。调用时要把本地 `manifest.json` 的字段连同源码文件一起提交——`ui`、`contributes`、`activationEvents`、`fs`、`net` 一个都不能漏，漏了装出来的插件是坏的。

一次发布需要三样东西：

1. **打好标签的源码仓库**：推送插件并给版本打标签（如 `v0.4.8`），标签或 commit SHA 就是源码审查读取的 `sourceRef`。
2. **已绑定的仓库**：插件通过控制台的「源码仓库」绑定到一个仓库（GitHub App 授权）。绑定是源码审查和目录 source pin 的依据，之后非管理员无法更换。
3. **一个没发布过的版本号**，并附发布说明。平台审查源码、管理员审批后，版本带着 SHA-256 与安装量上线。

`pi.`、`demo.` 是保留命名空间，发布需要管理员身份。

### 目录结构

```
plugins/<id>/
├── manifest.json      # 必需：插件元信息
├── main.js            # 必需：插件入口（CJS，导出 onLoad()/onUnload()）
├── renderer/          # 可选：面板 UI
│   ├── index.html
│   ├── style.css
│   └── script.js
├── README.md          # 推荐：插件说明文档
└── skills/            # 可选：AI Agent 工具定义
```

### manifest.json 关键字段

```json
{
  "schemaVersion": 1,
  "id": "my.plugin-id",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "插件功能描述",
  "i18n": {
    "en": { "name": "My Plugin", "description": "What it does" },
    "zh-CN": { "name": "我的插件", "description": "插件功能描述" }
  },
  "author": "your-name",
  "main": "main.js",
  "categories": ["productivity"],
  "permissions": ["ui.panel"],
  "engines": { "piDesktop": ">=0.2.0" }
}
```

### 常用权限

| 权限 | 用途 |
|------|------|
| `ui.panel` | 打开隔离面板 |
| `fs.read.workspace` | 读取工作区文件 |
| `fs.write.workspace` | 修改工作区文件 |
| `clipboard.read` / `clipboard.write` | 剪贴板读写 |
| `notify` | 本地通知 |
| `net.fetch` | 外部网络请求 |
| `shell.openExternal` | 打开外部链接 |
| `agent.tool.register` | 注册 AI Agent 工具 |

> **提示**：只申请所需的最小权限集。高风险权限会在安装时提示用户确认。

## 🔐 安全审查
插件审查是发布门禁。详见 [SECURITY.md](./SECURITY.md)，其中规定了后门、数据外传、凭据、远程代码、混淆、持久化和破坏性操作的一票否决规则、风险分级、安装包检查与漏洞报告流程。新增插件或行为变更必须通过 `python3 scripts/security_audit.py --check-packages`；高风险变更还需要两名独立维护者复核。
## 📋 贡献流程

1. Fork 本仓库
2. 从示例模板创建你的插件
3. 在 PI-Desktop 中充分测试
4. 提交 Pull Request（确保 `id` 唯一、使用语义化版本号、文档清晰）

Pull Request 只是把源码加进本仓库；要让用户真正装到，需要去插件中心发布——见上面的[发布到插件中心](#发布到插件中心)。

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 📦 打包约束

- 包根目录必须包含 `manifest.json`
- 不允许符号链接或路径穿越
- 使用 store-compressed zip 格式打包为 `.piplug`
- 最大包体积 50MB
- 不要期望宿主端 `npm install`，请自行打包依赖

## 📄 License

MIT
