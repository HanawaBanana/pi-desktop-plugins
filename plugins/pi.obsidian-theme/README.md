# Obsidian Theme / 黑曜石主题

A deep blue-grey global theme for PI-Desktop, tuned for long reading: a layered surface ladder instead of one flat black, hierarchy carried by 1px hairline borders rather than glow, a low-saturation teal accent, and a four-step text scale. Styling only — no features.

PI-Desktop 深蓝灰全局主题，为长时间阅读调校：分层海拔而非一片死黑、用 1px 发丝边框而非发光建立层级、低饱和青绿强调色、四档文字层级。纯样式，无额外功能。

## Palette / 色板

| Role / 用途 | Value | | Role / 用途 | Value |
|---|---|---|---|---|
| App base / 应用底色 | `#0F1B26` | | Title text / 标题 | `#F2F7FA` |
| Rails / 侧栏 | `#12202C` | | Body prose / 正文 | `#C4D2DD` |
| Reading column / 阅读区 | `#0E1A25` | | Secondary / 次级 | `#8FA3B4` |
| Card / composer / 卡片 | `#182835` | | Hints / 弱提示 | `#6A7E8F` |
| Raised / 悬浮 | `#1E3040` | | Accent / 强调 | `#5CD0B8` |
| Hover | `#223648` | | Border / 边框 | `#2A4054` |
| Field / 输入框 | `#1B2C3B` | | Inset / 凹陷 | `#091219` |
| Selected row / 选中态 | `#1B4F53`→`#15414A` | | Info / Warning / Danger | `#7FB4F0` `#E8C878` `#E78282` |

No pure black, no pure white. / 不使用纯黑，不使用纯白。

## What it does / 功能

- One global theme, selectable in **Settings → Theme → search "Obsidian" / 设置 → 主题 → 搜索 "Obsidian"**.
- **Elevation ladder.** Eight distinct surface tones from `#091219` (inset) through `#0F1B26` (app) to `#223648` (hover), so the three columns and the cards inside them stop merging. A card now separates from the canvas it sits on; in the previous build that measured zero.
- **Hierarchy from borders, not glow.** Every panel, card, field and code block carries a 1px `#2A4054` / `#1C2B3A` edge. All bloom and drop-glow shadows were removed.
- **Four text steps for reading comfort.** Titles `#F2F7FA`, body prose `#C4D2DD`, secondary `#8FA3B4`, hints `#6A7E8F`. Body prose dropped from 17:1 to 11.3:1 against its background — still AAA, far less glaring — while secondary text went slightly up.
- **Accent used as a material, sparingly.** `#5CD0B8` on selection, the send button, `.btn-primary`, focus rings and the active session rail; nothing else.
- **Fields read as fields.** Lighter than the canvas with a hairline edge, so the composer stays visible; selected rows get a solid teal fill (`#1B4F53`) rather than a wash.
- Code cards and blockquotes sit on `#16242F`; blockquotes carry a `#5CD0B8` rule; tables get a real row seam; meta and path lines are monospace.
- 海拔阶梯：从 `#091219`（凹陷）到 `#223648`（hover）共八档表面色，三栏与其内部卡片不再糊成一片。
- 层级靠边框而非发光：所有面板、卡片、输入框、代码块都带 1px 实色发丝边（`#2A4054` / `#1C2B3A`），发光阴影全部移除。
- 四档文字：标题 / 正文 / 次级 / 弱提示。正文对比度由 17:1 降到 11.3:1（仍是 AAA）不再刺眼，次级文字略有提升。
- 强调色克制使用：仅选中态、发送按钮、主按钮、聚焦描边与当前会话条目。
- 输入框比画布更亮并带发丝边，因此输入区不会再"消失"；选中行用实心 `#1B4F53` 而非半透明罩色。
- 代码卡片与引用块底色 `#16242F`，引用块配 `#5CD0B8` 竖条；表格补上行分隔线；元信息与路径行改用等宽字体。

## Reverting / 恢复

Pick Light / Dark / System in the theme picker — the plugin can stay installed without effect. Or uninstall the plugin.

在主题选择器中切回浅色 / 深色 / 系统即可；插件保留安装也无副作用，或直接卸载。

## Permissions / 权限

| Permission | Why / 原因 |
|---|---|
| `ui.panel` | Bilingual info panel: palette reference and elevation preview / 双语说明面板：色板参考与海拔预览 |
| `ui.theme` | Contribute the global theme / 贡献全局主题 |

## Safety / 安全

CSS is sanitized by the host on load (256 KiB cap, no `@import`, no markup, no scripts, no external URLs — only `data:` URLs and manifest-declared assets are allowed). This sheet carries exactly one reference: a base64 `data:` SVG noise tile. The plugin makes no network requests, reads no files, and stores no data.

CSS 由宿主在加载时净化（上限 256 KiB，禁止 `@import`、标记、脚本与外部 URL，仅允许 `data:` URL 与清单声明的资源）。本样式表只含一个引用：一个 base64 的 `data:` SVG 噪点贴图。插件不发起网络请求、不读取文件、不存储数据。

## Files / 文件

| File | Purpose / 作用 |
|---|---|
| `manifest.json` | Identity, permissions, the `contributes.themes` entry / 标识、权限、主题贡献声明 |
| `main.js` | Registers the one "open panel" command / 注册唯一的打开面板命令 |
| `themes/obsidian.css` | The theme itself / 主题本体 |
| `renderer/index.html` | Info panel / 说明面板 |
| `renderer/panel.js` | Panel copy + locale switching / 面板文案与语言切换 |
| `renderer/appearance-boot.js` | Shared appearance adapter, pre-paint / 共享外观适配器（首帧） |
| `renderer/appearance.js` | Shared appearance adapter, live updates / 共享外观适配器（实时更新） |
| `renderer/capsule-retint.js` | Retints the host window-control capsule / 重染宿主窗口控制胶囊 |

## Notes on the 3.0.0 revision / 3.0.0 改版说明

The 2.0.0 build was measured against a reference screenshot, and the finding was
not about lightness at all — it was **hue**. Blue-minus-red on the 2.0.0 canvas
was 7, i.e. grey; the reference sits at 21–24. Every surface now carries a real
blue lead (measured 23 across the whole rendered frame).

A band scan also **disproved the gradient theory**: the reference panels are
essentially flat (drift −0.11…−0.23 pts), so hierarchy is carried instead by
real 1px borders and by a confident selected fill. 2.0.0 used a 13% accent wash
for selection, which measured as nothing; the solid `#1B4F53` gradient now lifts
+3.6 pts over a plain row, matching the reference's own +2.1.

Fluorescent mint was replaced by a lower-chroma teal and confined to selection,
primary actions and focus. Bloom shadows gave way to a 3–5% top light, grain was
cut to 0.035, radius was pulled onto one 8/10/12 ladder, prose line-height was
raised to 1.72, and the scrollbars — which the host builds out of
`--ds-text-primary`, now near-white — were pinned back so they stop reading as
bright bars.

## Notes on the 2.0.0 revision / 2.0.0 改版说明

The 1.0.0 build was measured against a real screenshot and two of its ideas were wrong:

1. **Semi-transparent white tiles cannot separate dark surfaces.** `--ds-tile` at 3.5% white over a near-black canvas produced a card that was optically identical to the page it sat on. The fix is opaque step values plus solid 1px borders.
2. **`soft-light` grain is a no-op on near-black.** Its effect scales with `backdrop × (1 − backdrop)`, which is ~0.04 at `#0a0e0c`. Grain is now a faint `overlay` film at 0.05 opacity, kept because it still breaks up large flat fills.

Recessing the composer into a darker well also backfired — it simply disappeared. Fields are lighter than the canvas again.

1.0.0 版本经真实截图测量后，发现两处判断失误：

1. **半透明白色色块无法分隔深色表面**：近黑画布上叠 3.5% 白，卡片与页面在视觉上完全相同。改用不透明分档色值 + 实色 1px 边框。
2. **`soft-light` 噪点在近黑背景上等于没有**：其强度与 `背景 × (1 − 背景)` 成正比，在 `#0a0e0c` 处仅约 0.04。现改为 0.05 不透明度的 `overlay` 薄膜，保留它是因为仍能打破大面积纯色。

此外把输入框做成比画布更暗的"凹井"也适得其反——它直接看不见了，现已改回比画布更亮。
