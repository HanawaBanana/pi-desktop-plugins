# Agents Anywhere Remote Plugin for Pi-Desktop

本插件基于开源跨设备 Agent 工作台 **[Agents Anywhere](https://www.agents-anywhere.com/)**（[GitHub 仓库](https://github.com/anywhere-labs/Agents-Anywhere)），为 **Pi-Desktop** 提供手机端（iOS / Android / Web）远程查看、实时会话控制与交互审批能力。

---

## 一、功能特性

- **跨设备反向隧道**：基于 WSS 长连接实现内网穿透，无需配置公网 IP 或打洞端口。
- **双向会话流同步**：手机端与 PC 桌面端双向同步会话历史、运行中状态与实时响应。
- **思考流式展开与折叠**：手机端完整展示 Agent 深度思考链（Chain of Thought），支持打字时展开、生成答案后自动折叠。
- **远程操作控制**：在手机上随时发起新任务、发送指令、中止运行中的异常任务。
- **安全沙箱与最小权限**：受 Pi-Desktop 插件权限体系监管，仅开放经用户显式授权的 `desktop.control` 与网络白名单通道。

---

## 二、目录结构

```text
pi.agents-anywhere/
├── manifest.json       # 插件清单（声明权限、面板视图与网络白名单）
├── main.js             # 插件核心服务（WebSocket 通信、RPC 路由与事件监听）
├── views/
│   └── panel.html      # Pi-Desktop 右侧工作区原生互联管理面板
└── README.md           # 本说明文档
```

---

## 三、快速开始

### 1. 获取移动端配对凭证
1. 在手机上安装 **Agents Anywhere** 客户端（iOS TestFlight / Android APK / 打开 [web.agents-anywhere.com](https://web.agents-anywhere.com)）。
2. 登录账号后，在底部点击 **「设备」** $\rightarrow$ **「添加设备 (Add Connector)」**。
3. 复制生成的专属凭证：
   - `Connector ID`（如 `conn_xxx`）
   - `Connector Token`（如 `cxt_xxx`）

### 2. 在 Pi-Desktop 中加载插件
1. 打开 Pi-Desktop 桌面端，进入「设置 $\rightarrow$ 插件 / Extensions $\rightarrow$ 开发中插件」。
2. 点击「加载未打包插件」，选择本插件目录 `examples/plugins/pi.agents-anywhere`。
3. 宿主弹出权限申请提示（申请 `net.websocket` 和 `desktop.control`），点击 **「允许并启用」**。

### 3. 连接与联调
1. 点击桌面右侧工作面板中的 **「远程助手」**（图标为 🌐/🔗）。
2. 将手机端生成的 `Connector ID` 和 `Connector Token` 填入输入框，点击 **「保存并立即连接」**。
3. 状态徽标变为绿色 **「在线 (已连接)」**。
4. 打开手机端 Agents Anywhere，即可在设备列表中看到本台电脑，可随时发送 Prompt 远程指挥！
