# Usage Dashboard（原生用量看板）

A native PI-Desktop usage dashboard. It is the first consumer of the host's
official read-only usage contract `pi.usage.listTurns` (PI-Desktop host
PR #503) and renders that fact stream as a local board: metric cards, a
365-day activity heatmap, a model-share donut, per-model daily trend lines,
top sessions and activity streaks — in a light and a dark palette.

原生用量看板：PI-Desktop 官方只读用量接口 `pi.usage.listTurns`（宿主 PR #503）
的首个消费者。把官方事实面渲染成本地看板：指标卡、365 天活动热力图、模型占比
环形图、分模型每日趋势线、Top 会话与连续使用天数，深浅两套主题。

## Scope and differentiation / 定位与差异化

- **Official contract only.** All data comes from `pi.usage.listTurns`. The
  plugin never reads transcript files, the host database, or any other AI
  tool's local data. It covers PI-Desktop's native usage only.
  只用正式契约：数据全部来自 `pi.usage.listTurns`，不直读转录本、宿主数据库或
  其他工具的本地文件；仅覆盖 PI-Desktop 原生用量。
- Differs from `pi.token-insights`, which aggregates multiple tools and reads
  host records directly: this plugin is a thin, permission-minimal renderer of
  the official fact interface.
  与 pi.token-insights（多工具聚合、直读宿主库）差异化：本插件是正式事实接口
  之上的薄渲染层，权限最小化。

## Data channel / 数据通道

The panel bridge is read-only, so the plugin process does all host access
(the pattern `pi.token-insights` established):

1. `onLoad` (and the `usageDashboard.open` command) walks the full history:
   windows of 365 days walked backwards from now (`toMs = previous fromMs − 1`),
   each window paged by cursor until `nextCursor = null`; the first fully empty
   window ends the walk; a `turnId` set dedupes across window seams.
2. The deduped turns go through the pure aggregator `lib/aggregate.js`
   (`aggregateCube(turns, nowMs)`, clock injected for testability).
3. The cube is published via `pi.plugin.setSettings({ usageCube, scanState })`;
   the panel polls plugin settings and renders. Range switching (7/30/90/365
   days) is a renderer-side filter over the cube's daily rows — no second walk.

## Accounting / 聚合口径（v3.1）

- **Headline tokens = `inputTokens + outputTokens`.** Cache read, cache write
  and reasoning tokens appear only in a diagnostics line and never enter the
  headline. headline 仅计输入 + 输出；缓存读/写与推理 token 只进诊断行。
- Cards: total tokens, turn count, session count (deduped `sessionId`),
  peak day (max daily headline + its date), current/longest streak.
- Daily keys are **local-calendar days** built from `endedAt`, so the heatmap
  is not shifted by timezone conversion.
- Streaks (v1, simple): a day is active when its headline > 0; the current
  streak anchors on today and falls back to yesterday; any one-day gap breaks
  a run. 口径最简实现，见 `lib/aggregate.js` 注释。
- The panel recomputes everything that *can* be derived from daily rows for
  the selected range (totals, turns, peak, model shares, trend). Session count,
  the diagnostics line and the Top-sessions list are all-history figures and
  labelled as such — a session spans days, so it cannot be counted from daily
  rows without lying.

## Privacy / 隐私

Read-only aggregation over the official interface. Counts only — never message
text, tool arguments, project paths or credentials. At most an 8-character
session id prefix is kept. Nothing is written outside this plugin's own
settings, and no network request is made. Every number stays on this device.

只读聚合、仅计数：不读取消息正文/工具参数/项目路径/凭据，最多保留 8 位
session id 前缀；除自身插件设置外不写任何位置，不发起网络请求。

## Permissions / 权限

- `ui.panel` — the dashboard panel
- `usage.read` — read aggregate token usage through the host's official interface

## Panel

- 7/30/90/365-day range switch (renderer-side filtering), language follows the
  system with an EN/中文 override, theme follows `prefers-color-scheme` with a
  light/dark override (both persisted locally).
- Charts are hand-rolled SVG: week-column heatmap with month axis and legend,
  donut with center total and a two-column legend, daily trend with per-model
  toggleable lines.
- Accessibility: `sr-only` data tables twin the heatmap and the trend chart,
  the donut carries an aria-label summarizing the shares, and all controls are
  focusable buttons.

## Host requirement / 宿主要求

`pi.usage.listTurns` is provided by PI-Desktop (host PR #503). On builds
without it the panel shows an explicit "host interface not available" state
instead of an empty board. 面板对未提供该接口的旧版本宿主显示明确提示，
而不是伪装成“没有用量”。

## Development

```bash
node --check plugins/io.github.muzimu217.usage-dashboard/main.js
node --check plugins/io.github.muzimu217.usage-dashboard/lib/aggregate.js
node --test tests/usage-dashboard.test.mjs
```
