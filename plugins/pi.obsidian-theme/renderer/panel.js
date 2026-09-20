/**
 * Obsidian Theme — info panel.
 *
 * Read-only documentation page: it applies the localized strings and follows
 * the app's light/dark palette through the shared appearance adapter. It calls
 * no host API beyond the appearance channel, so `ui.panel` is the only
 * permission it needs.
 */
(function () {
  "use strict";

  var STRINGS = {
    en: {
      title: "Obsidian Theme",
      subtitle: "Deep blue-grey · teal accent",
      aboutHeading: "About",
      about:
        "This plugin contributes one global theme (CSS only) and nothing else. Apply it in Settings → Theme and search Obsidian.",
      ladderHeading: "Elevation",
      applyHeading: "Apply & revert",
      apply1: "Open Settings → Theme and search Obsidian.",
      apply2: "Pick Obsidian Dark. The whole app repaints instantly.",
      apply3:
        "To revert, choose Light, Dark or System — the plugin can stay installed with no effect.",
      paletteHeading: "Palette",
      safety: "Pure styling: no network, file, clipboard, shell or agent access.",
      names: {
        app: "App background",
        rail: "Sidebar rail",
        card: "Card / composer",
        border: "Border",
        title: "Title text",
        body: "Body text",
        dim: "Secondary text",
        accent: "Teal accent",
        info: "Info",
        warn: "Warning",
        danger: "Danger",
      },
    },
    "zh-CN": {
      title: "黑曜石主题",
      subtitle: "深蓝灰 · 青绿强调",
      aboutHeading: "关于",
      about:
        "本插件只贡献一个全局主题（仅 CSS），不提供其他功能。在「设置 → 主题」中搜索「Obsidian」即可应用。",
      ladderHeading: "海拔层级",
      applyHeading: "应用与恢复",
      apply1: "打开「设置 → 主题」，搜索 Obsidian。",
      apply2: "选择「Obsidian Dark」，整个界面会立即换色。",
      apply3:
        "恢复：切回「浅色 / 深色 / 系统」即可，插件可以保留安装且不产生任何影响。",
      paletteHeading: "色板",
      safety: "纯样式插件：无网络、文件、剪贴板、命令执行或智能体权限。",
      names: {
        app: "应用底色",
        rail: "侧栏",
        card: "卡片 / 输入框",
        border: "边框",
        title: "标题文字",
        body: "正文文字",
        dim: "次级文字",
        accent: "青绿强调色",
        info: "信息",
        warn: "提醒",
        danger: "异常",
      },
    },
  };

  var SWATCH_IDS = {
    app: "c-app",
    rail: "c-rail",
    card: "c-card",
    border: "c-border",
    title: "c-title",
    body: "c-body",
    dim: "c-dim",
    accent: "c-accent",
    info: "c-info",
    warn: "c-warn",
    danger: "c-danger",
  };

  function setText(id, value) {
    var node = document.getElementById(id);
    // textContent, never innerHTML: this page renders no author-controlled
    // markup and must not become an injection sink.
    if (node && typeof value === "string") node.textContent = value;
  }

  function locale() {
    if (window.__appearance && typeof window.__appearance.current === "function") {
      var current = window.__appearance.current();
      if (current && current.locale) return current.locale;
    }
    return navigator.language || "en";
  }

  function apply() {
    var table = String(locale()).toLowerCase().indexOf("zh") === 0
      ? STRINGS["zh-CN"]
      : STRINGS.en;

    setText("t-title", table.title);
    setText("t-subtitle", table.subtitle);
    setText("t-about-h", table.aboutHeading);
    setText("t-about", table.about);
    setText("t-ladder-h", table.ladderHeading);
    setText("t-apply-h", table.applyHeading);
    setText("t-apply-1", table.apply1);
    setText("t-apply-2", table.apply2);
    setText("t-apply-3", table.apply3);
    setText("t-palette-h", table.paletteHeading);
    setText("t-safety", table.safety);

    for (var key in SWATCH_IDS) {
      if (Object.prototype.hasOwnProperty.call(SWATCH_IDS, key)) {
        setText(SWATCH_IDS[key], table.names[key]);
      }
    }

    document.documentElement.lang =
      table === STRINGS["zh-CN"] ? "zh-CN" : "en";
  }

  // Paint the localized copy first, then re-localize if the app switches
  // language. Theme (light/dark) repainting is owned by appearance-boot.js.
  apply();
  if (window.__appearance && typeof window.__appearance.onLocaleChange === "function") {
    window.__appearance.onLocaleChange(apply);
  }
})();
