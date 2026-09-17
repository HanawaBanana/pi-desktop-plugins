/**
 * Usage Dashboard panel.
 *
 * A panel window has no `pi` object — it reads plugin settings through
 * window.pluginBridge, which passes the same permission gate the plugin
 * process does. This file is read-only with respect to the host: it renders
 * the usage cube the plugin process published and never writes anything back.
 *
 * Range switching (7/30/90/365 days) is a renderer-side filter over the
 * cube's daily rows; charts are drawn as SVG with no chart library, and both
 * palettes come from this panel's own design tokens (see panel.css).
 */

const bridge = window.pluginBridge;
const A = window.UsageDashboardAggregate;

const PREFS_KEY = "usageDashboard.prefs.v1";
/**
 * Poll cadence. A panel is its own window: it is very often visible while
 * some other window has focus, so polling follows *visibility*.
 */
const POLL_MS = 1_500;
const POLL_HIDDEN_MS = 6_000;
const RANGES = [7, 30, 90, 365];
const HEAT_WEEKS = 53;
const TREND_TOP_MODELS = 5;

/* --------------------------------------------------------------------- i18n */

const STRINGS = {
  en: {
    title: "Usage Dashboard",
    subtitle: "PI-Desktop native usage",
    refresh: "Refresh from settings",
    rescanHint: "Run “Usage Dashboard: Open” from the command palette to rescan now.",
    themeAuto: "Theme: Auto",
    themeLight: "Theme: Light",
    themeDark: "Theme: Dark",
    langAuto: "Lang: Auto",
    langEn: "Lang: EN",
    langZh: "Lang: 中文",
    rangeLabel: "Time range",
    range7: "7D",
    range30: "30D",
    range90: "90D",
    range365: "1Y",
    /* cards */
    totalTokens: "Total tokens",
    turnCount: "Turns",
    sessionCount: "Sessions",
    peakDay: "Peak day",
    inRange: (days) => `last ${days} days`,
    allTime: "all history",
    noPeak: "—",
    /* heatmap */
    activity: "Activity",
    activityNote: "last 365 days · a day counts when tokens > 0",
    streakCurrent: (days) => `${days}-day streak`,
    streakThroughYesterday: (days) => `${days}-day streak, through yesterday`,
    streakNone: "No streak yet",
    streakLongest: (days) => `longest ${days}`,
    less: "Less",
    more: "More",
    heatAria: (total, peak, date) => `Activity heatmap of the last 365 days: ${total} tokens total, peak ${peak} on ${date}.`,
    heatCell: (date, tokens, turns) => `${date} · ${tokens} tokens · ${turns} ${turns === 1 ? "turn" : "turns"}`,
    heatEmpty: (date) => `${date} · no activity`,
    heatFuture: (date) => `${date}`,
    heatTableCaption: "Daily token totals for the last 365 days",
    columnDate: "Date",
    columnTokens: "Tokens",
    /* donut */
    modelUsage: "Model share",
    modelsInHistory: (count) => `${count} ${count === 1 ? "model" : "models"} in range`,
    otherModel: "Other",
    unknownModel: "Unknown model",
    donutCenterLabel: "tokens in range",
    donutAria: (parts) => `Model share: ${parts}.`,
    /* trend */
    trend: "Trend",
    trendNote: "daily tokens · tap a legend entry to hide a model",
    trendTotal: "Total",
    trendAria: (days, total, peak, date) => `Daily token trend over the last ${days} days: ${total} tokens total, peak ${peak} on ${date}.`,
    trendTableCaption: "Daily token totals by model",
    /* sessions */
    topSessions: "Top sessions",
    sessionsNote: "all history · 8-char id, full title never leaves this device",
    sessionTurns: (count) => `${count} ${count === 1 ? "turn" : "turns"}`,
    lastActive: (label) => `active ${label}`,
    noTitle: "Untitled session",
    /* diagnostics + provenance */
    diagnostics: (read, write, reasoning) =>
      `Diagnostics, not in the totals: cache read ${read} · cache write ${write} · reasoning ${reasoning} (all history)`,
    provenance: (turns, windows, time) =>
      `From PI-Desktop's official usage interface (pi.usage.listTurns): ${turns} turns across ${windows} windows · counts only, no message content · updated ${time}`,
    disclaimer: "This board aggregates PI-Desktop's native usage through the formal contract only. It never reads message text, keeps at most an 8-character session id prefix, and every number stays on this device.",
    /* states */
    scanning: (windows, turns) => `Walking usage history… ${windows} window${windows === 1 ? "" : "s"}, ${turns} turns so far`,
    scanFailed: (message) => `Last walk failed: ${message}`,
    scanUnsupported: "This PI-Desktop build does not expose pi.usage.listTurns yet.",
    loadingTitle: "Reading your native usage",
    loadingBody: "The plugin is walking your PI-Desktop usage history through the official interface.",
    emptyTitle: "Nothing counted yet",
    emptyBody:
      "The dashboard reads PI-Desktop's native usage. Have a conversation first (and make sure usage indexing is on in the app's settings), then rescan — this page fills itself in.",
    failedTitle: "Could not walk the usage history",
    unsupportedTitle: "Host interface not available",
    unsupportedBody:
      "This panel is built on pi.usage.listTurns, a read-only interface shipped by PI-Desktop. Your current build does not expose it yet — update PI-Desktop, then run “Usage Dashboard: Open” again.",
    errorTitle: "Could not read the dashboard",
    errorBody: "The panel could not reach its plugin settings. Try again, or reopen the panel from the command palette.",
    retry: "Try again",
  },
  zh: {
    title: "原生用量看板",
    subtitle: "PI-Desktop 原生用量",
    refresh: "从设置刷新",
    rescanHint: "在命令面板运行「Usage Dashboard: Open」可立即重新扫描。",
    themeAuto: "主题：跟随系统",
    themeLight: "主题：浅色",
    themeDark: "主题：深色",
    langAuto: "语言：跟随系统",
    langEn: "语言：EN",
    langZh: "语言：中文",
    rangeLabel: "时间范围",
    range7: "7天",
    range30: "30天",
    range90: "90天",
    range365: "1年",
    totalTokens: "总 Tokens",
    turnCount: "回合数",
    sessionCount: "会话数",
    peakDay: "峰值日",
    inRange: (days) => `近 ${days} 天`,
    allTime: "全部历史",
    noPeak: "—",
    activity: "活动",
    activityNote: "近 365 天 · 当日 tokens > 0 记为活跃",
    streakCurrent: (days) => `连续 ${days} 天`,
    streakThroughYesterday: (days) => `连续 ${days} 天，停在昨天`,
    streakNone: "还没有连续记录",
    streakLongest: (days) => `最长 ${days} 天`,
    less: "少",
    more: "多",
    heatAria: (total, peak, date) => `近 365 天活动热力图：共 ${total} tokens，峰值 ${peak}（${date}）。`,
    heatCell: (date, tokens, turns) => `${date} · ${tokens} tokens · ${turns} 个回合`,
    heatEmpty: (date) => `${date} · 无活动`,
    heatFuture: (date) => `${date}`,
    heatTableCaption: "近 365 天每日 token 合计",
    columnDate: "日期",
    columnTokens: "Tokens",
    modelUsage: "模型占比",
    modelsInHistory: (count) => `范围内 ${count} 个模型`,
    otherModel: "其他",
    unknownModel: "未知模型",
    donutCenterLabel: "范围内 tokens",
    donutAria: (parts) => `模型占比：${parts}。`,
    trend: "趋势",
    trendNote: "每日 tokens · 点击图例可隐藏某个模型",
    trendTotal: "总量",
    trendAria: (days, total, peak, date) => `近 ${days} 天每日 token 趋势：共 ${total} tokens，峰值 ${peak}（${date}）。`,
    trendTableCaption: "按模型分列的每日 token 合计",
    topSessions: "消耗最多的会话",
    sessionsNote: "全部历史 · 仅显示 8 位短 id，完整标题不离开本机",
    sessionTurns: (count) => `${count} 个回合`,
    lastActive: (label) => `${label}活跃`,
    noTitle: "未命名会话",
    diagnostics: (read, write, reasoning) =>
      `诊断行（不计入总量）：缓存读取 ${read} · 缓存写入 ${write} · 推理 ${reasoning}（全部历史）`,
    provenance: (turns, windows, time) =>
      `来自 PI-Desktop 正式用量接口（pi.usage.listTurns）：${windows} 个窗口共 ${turns} 个回合 · 仅计数，无消息正文 · ${time} 更新`,
    disclaimer: "本看板仅通过正式契约聚合 PI-Desktop 原生用量：不读取消息正文，最多保留 8 位 session id 前缀，所有数字都留在这台设备上。",
    scanning: (windows, turns) => `正在回走用量历史…已扫 ${windows} 个窗口、${turns} 个回合`,
    scanFailed: (message) => `上次扫描失败：${message}`,
    scanUnsupported: "当前版本的 PI-Desktop 尚未提供 pi.usage.listTurns 接口。",
    loadingTitle: "正在读取原生用量",
    loadingBody: "插件正在通过官方接口回走你在 PI-Desktop 的用量历史。",
    emptyTitle: "还没有可统计的数据",
    emptyBody: "看板读取 PI-Desktop 的原生用量。先发起一段对话（并确认应用设置中已开启用量记录），再重新扫描，这一页会自己长出来。",
    failedTitle: "用量历史回走失败",
    unsupportedTitle: "宿主接口未就绪",
    unsupportedBody: "本面板基于 PI-Desktop 提供的只读接口 pi.usage.listTurns 构建。当前版本尚未提供该接口——请升级 PI-Desktop 后再次运行「Usage Dashboard: Open」。",
    errorTitle: "无法读取面板数据",
    errorBody: "面板读不到自己的插件设置。可以重试，或从命令面板重新打开面板。",
    retry: "重试",
  },
};

/* -------------------------------------------------------------------- state */

const state = {
  locale: "en",
  t: STRINGS.en,
  prefs: defaultPrefs(),
  cube: null,
  scanState: null,
  range: 30,
  status: "loading",
  lastCubeAt: 0,
  pollTimer: null,
  darkQuery: window.matchMedia("(prefers-color-scheme: dark)"),
};

function defaultPrefs() {
  return { theme: "auto", locale: "auto", hiddenModels: [] };
}

/* ------------------------------------------------------------------ helpers */

function el(id) {
  return document.getElementById(id);
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs || {})) node.setAttribute(name, String(value));
  return node;
}

function readStore(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* a panel that cannot persist preferences still works */
  }
}

function intlLocale() {
  return state.locale === "zh" ? "zh-CN" : "en-US";
}

function compact(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  if (abs >= 1e12) return `${(amount / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;
  return String(Math.round(amount));
}

function grouped(value) {
  return Number(value || 0).toLocaleString(intlLocale());
}

function share(part, whole) {
  const total = Number(whole || 0);
  if (total <= 0) return 0;
  return Math.round((Number(part || 0) / total) * 1000) / 10;
}

function modelLabel(modelId) {
  if (!modelId || modelId === A.UNKNOWN_MODEL) return state.t.unknownModel;
  return modelId;
}

function formatDay(dayKey, options) {
  try {
    return new Intl.DateTimeFormat(intlLocale(), options || { month: "short", day: "numeric" }).format(
      A.dateFromDayKey(dayKey),
    );
  } catch {
    return dayKey;
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "—";
  try {
    return new Intl.DateTimeFormat(intlLocale(), { timeStyle: "short" }).format(new Date(timestamp));
  } catch {
    return "—";
  }
}

function relativeTime(timestamp) {
  if (!timestamp) return "—";
  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: "auto" });
  const diffMs = timestamp - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(diffMs / 3_600_000);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(diffMs / 86_400_000);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return formatDay(A.dayKeyFromTimestamp(timestamp), { month: "short", day: "numeric" });
}

/** Round the axis top up to 1/2/2.5/5 × 10ⁿ so gridlines read as round numbers. */
function niceCeil(value) {
  if (value <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(value));
  const normalized = value / base;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * base;
}

/* ------------------------------------------------------- theme and language */

function applyPreferences() {
  const base = state.prefs.theme === "auto" ? (state.darkQuery.matches ? "dark" : "light") : state.prefs.theme;
  if (state.prefs.theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = state.prefs.theme;
  document.documentElement.style.colorScheme = base;

  const locale =
    state.prefs.locale === "auto"
      ? String(navigator.language || "en").toLowerCase().startsWith("zh")
        ? "zh"
        : "en"
      : state.prefs.locale;
  state.locale = locale;
  state.t = STRINGS[locale] || STRINGS.en;
}

function setPrefs(patch) {
  state.prefs = { ...state.prefs, ...patch };
  writeStore(PREFS_KEY, state.prefs);
  applyPreferences();
  render();
}

/* ----------------------------------------------------------------- range math */

function rangeWindow() {
  const today = A.todayKey();
  return { sinceDay: A.shiftDayKey(today, -(state.range - 1)), untilDay: today };
}

/**
 * The renderer-side view of the cube for the selected range: everything here
 * is re-derived from the cube's daily rows, so switching ranges never needs a
 * new walk. Session count and the diagnostics line stay all-time (a session
 * spans days, so it cannot be counted from daily rows without lying).
 */
function computeRangeView() {
  const cube = state.cube;
  const { sinceDay, untilDay } = rangeWindow();
  const daily = cube.daily.filter((day) => day.date >= sinceDay && day.date <= untilDay);
  const dailyByModel = cube.dailyByModel.filter((row) => row.date >= sinceDay && row.date <= untilDay);

  let totalTokens = 0;
  let turnCount = 0;
  let peak = { date: null, tokens: 0 };
  for (const day of daily) {
    totalTokens += day.tokens;
    turnCount += day.turns;
    if (day.tokens > peak.tokens) peak = { date: day.date, tokens: day.tokens };
  }

  const byModel = new Map();
  for (const row of dailyByModel) byModel.set(row.modelId, (byModel.get(row.modelId) || 0) + row.tokens);
  const models = [...byModel.entries()]
    .map(([modelId, tokens]) => ({ modelId, tokens, share: share(tokens, totalTokens) }))
    .sort((left, right) => right.tokens - left.tokens);

  return { sinceDay, untilDay, daily, dailyByModel, totalTokens, turnCount, peak, models };
}

/* ------------------------------------------------------------------- render */

function setStatusKind() {
  if (state.status === "error") return "error";
  const scan = state.scanState;
  if (!A.isCube(state.cube)) {
    if (scan?.status === "unsupported") return "unsupported";
    if (scan?.status === "failed") return "failed";
    return "loading";
  }
  if (state.cube.cards.turnCount === 0) return scan?.status === "scanning" ? "loading" : "empty";
  return "ready";
}

function renderState(kind) {
  const t = state.t;
  const box = el("stateBox");
  const actions = el("stateActions");
  clear(actions);
  const show = (title, body) => {
    el("stateTitle").textContent = title;
    el("stateBody").textContent = body;
    box.hidden = false;
  };
  box.hidden = true;
  el("skeleton").hidden = true;
  el("content").hidden = true;

  if (kind === "loading") {
    el("skeleton").hidden = false;
    return;
  }
  if (kind === "empty") {
    show(t.emptyTitle, `${t.emptyBody} ${t.rescanHint}`);
    return;
  }
  if (kind === "failed") {
    show(t.failedTitle, state.scanState?.message || t.errorBody);
    return;
  }
  if (kind === "unsupported") {
    show(t.unsupportedTitle, t.unsupportedBody);
    return;
  }
  if (kind === "error") {
    show(t.errorTitle, t.errorBody);
    const retry = make("button", "primary-button", t.retry);
    retry.type = "button";
    retry.addEventListener("click", () => void poll(true));
    actions.appendChild(retry);
    return;
  }
  el("content").hidden = false;
}

function renderStaticText() {
  const t = state.t;
  document.title = t.title;
  el("appTitle").textContent = `${t.title} · ${t.subtitle}`;
  el("refreshBtn").title = t.refresh;
  el("refreshBtn").setAttribute("aria-label", t.refresh);
  el("rangeSwitch").setAttribute("aria-label", t.rangeLabel);
  el("cardTotalLabel").textContent = t.totalTokens;
  el("cardTurnsLabel").textContent = t.turnCount;
  el("cardSessionsLabel").textContent = t.sessionCount;
  el("cardPeakLabel").textContent = t.peakDay;
  el("heatTitle").textContent = t.activity;
  el("donutTitle").textContent = t.modelUsage;
  el("trendTitle").textContent = t.trend;
  el("sessionsTitle").textContent = t.topSessions;
  el("themeBtn").textContent =
    state.prefs.theme === "auto" ? t.themeAuto : state.prefs.theme === "light" ? t.themeLight : t.themeDark;
  el("langBtn").textContent =
    state.prefs.locale === "auto" ? t.langAuto : state.prefs.locale === "en" ? t.langEn : t.langZh;
}

function renderRanges() {
  const t = state.t;
  const row = el("rangeSwitch");
  clear(row);
  for (const days of RANGES) {
    const button = make("button", "segment", t[`range${days}`]);
    button.type = "button";
    button.dataset.range = String(days);
    button.setAttribute("aria-pressed", state.range === days ? "true" : "false");
    button.addEventListener("click", () => {
      if (state.range === days) return;
      state.range = days;
      writeStore(`${PREFS_KEY}.range`, { range: days });
      render();
    });
    row.appendChild(button);
  }
}

function renderCards(view) {
  const t = state.t;
  const cube = state.cube;
  el("cardTotal").textContent = compact(view.totalTokens);
  el("cardTotal").title = grouped(view.totalTokens);
  el("cardTotalNote").textContent = t.inRange(state.range);

  el("cardTurns").textContent = grouped(view.turnCount);
  el("cardTurnsNote").textContent = t.inRange(state.range);

  el("cardSessions").textContent = grouped(cube.cards.sessionCount);
  el("cardSessions").title = grouped(cube.cards.sessionCount);
  el("cardSessionsNote").textContent = t.allTime;

  if (view.peak.date) {
    el("cardPeak").textContent = compact(view.peak.tokens);
    el("cardPeak").title = grouped(view.peak.tokens);
    el("cardPeakNote").textContent = formatDay(view.peak.date, { year: "numeric", month: "short", day: "numeric" });
  } else {
    el("cardPeak").textContent = t.noPeak;
    el("cardPeakNote").textContent = t.inRange(state.range);
  }
}

/* ----------------------------------------------------------------- heatmap */

const HEAT = { cell: 11, gap: 3, step: 14, left: 30, top: 16 };

function heatLevels(values) {
  const sorted = values.filter((value) => value > 0).sort((left, right) => left - right);
  if (!sorted.length) return [0, 0, 0, 0];
  const at = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  return [at(0.25), at(0.5), at(0.75), at(0.92)];
}

function renderHeatmap() {
  const t = state.t;
  const host = el("heatHost");
  const tableWrap = el("heatTableWrap");
  clear(host);
  clear(tableWrap);

  const dailyMap = new Map(state.cube.daily.map((day) => [day.date, day]));
  const today = A.dateFromDayKey(A.todayKey());
  const todayKey = A.dayKeyFromDate(today);
  const offsetToMonday = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - offsetToMonday - (HEAT_WEEKS - 1) * 7);

  const observed = [];
  for (const [date, day] of dailyMap) {
    if (date >= A.dayKeyFromDate(start) && date <= todayKey) observed.push(day);
  }
  const thresholds = heatLevels(observed.map((day) => day.tokens));
  const heatTotal = observed.reduce((sum, day) => sum + day.tokens, 0);
  const heatPeak = observed.reduce(
    (best, day) => (day.tokens > best.tokens ? day : best),
    { date: null, tokens: 0 },
  );

  const width = HEAT.left + HEAT_WEEKS * HEAT.step + 4;
  const height = HEAT.top + 7 * HEAT.step + 36;
  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "heatmap",
    role: "img",
    "aria-label": t.heatAria(
      compact(heatTotal),
      compact(heatPeak.tokens),
      heatPeak.date ? formatDay(heatPeak.date) : "—",
    ),
  });

  // Weekday axis in the left gutter (Mon / Wed / Fri), month axis above.
  const weekdayNames = [];
  const monday = new Date(2024, 0, 1);
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    weekdayNames.push(new Intl.DateTimeFormat(intlLocale(), { weekday: "short" }).format(date));
  }
  weekdayNames.forEach((name, index) => {
    if (index % 2 === 1) return;
    const label = svgEl("text", {
      class: "heat-text",
      x: HEAT.left - 8,
      y: HEAT.top + index * HEAT.step + 9,
      "text-anchor": "end",
    });
    label.textContent = name;
    svg.appendChild(label);
  });

  let lastMonth = -1;
  for (let week = 0; week < HEAT_WEEKS; week += 1) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + week * 7);
    const month = weekStart.getMonth();
    if (month !== lastMonth) {
      const label = svgEl("text", {
        class: "heat-text",
        x: HEAT.left + week * HEAT.step,
        y: 10,
      });
      label.textContent = new Intl.DateTimeFormat(intlLocale(), { month: "short" }).format(
        new Date(weekStart.getFullYear(), month, 1),
      );
      svg.appendChild(label);
      lastMonth = month;
    }
  }

  const cells = [];
  for (let week = 0; week < HEAT_WEEKS; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + day);
      const key = A.dayKeyFromDate(date);
      const entry = dailyMap.get(key);
      const total = entry?.tokens || 0;
      const turns = entry?.turns || 0;
      const future = key > todayKey;
      const level =
        future || total <= 0 ? 0 : total <= thresholds[0] ? 1 : total <= thresholds[1] ? 2 : total <= thresholds[2] ? 3 : 4;
      const rect = svgEl("rect", {
        class: `heat-cell heat-${level}${key === todayKey ? " heat-today" : ""}`,
        x: HEAT.left + week * HEAT.step,
        y: HEAT.top + day * HEAT.step,
        width: HEAT.cell,
        height: HEAT.cell,
        rx: 2.5,
      });
      const tip = svgEl("title");
      tip.textContent = future
        ? t.heatFuture(formatDay(key))
        : total > 0
          ? t.heatCell(formatDay(key), grouped(total), turns)
          : t.heatEmpty(formatDay(key));
      rect.appendChild(tip);
      svg.appendChild(rect);
      if (!future) cells.push({ date: key, tokens: total });
    }
  }

  // Legend strip inside the SVG: Less ▢▢▢▢▢ More.
  const legendY = HEAT.top + 7 * HEAT.step + 18;
  const lessText = svgEl("text", { class: "heat-text", x: HEAT.left, y: legendY + 9 });
  lessText.textContent = t.less;
  svg.appendChild(lessText);
  for (let level = 0; level < 5; level += 1) {
    svg.appendChild(
      svgEl("rect", {
        class: `heat-cell heat-${level}`,
        x: HEAT.left + 34 + level * (HEAT.cell + 3),
        y: legendY,
        width: HEAT.cell,
        height: HEAT.cell,
        rx: 2.5,
      }),
    );
  }
  const moreText = svgEl("text", {
    class: "heat-text",
    x: HEAT.left + 34 + 5 * (HEAT.cell + 3) + 6,
    y: legendY + 9,
  });
  moreText.textContent = t.more;
  svg.appendChild(moreText);
  host.appendChild(svg);

  // Screen-reader twin: the same daily values as a real table.
  const table = make("table", null);
  const caption = make("caption", null, t.heatTableCaption);
  table.appendChild(caption);
  const head = make("thead");
  const headRow = make("tr");
  headRow.appendChild(make("th", null, t.columnDate)).scope = "col";
  headRow.appendChild(make("th", null, t.columnTokens)).scope = "col";
  head.appendChild(headRow);
  const body = make("tbody");
  for (const cell of cells) {
    const row = make("tr");
    row.appendChild(make("th", null, cell.date)).scope = "row";
    row.appendChild(make("td", null, String(cell.tokens)));
    body.appendChild(row);
  }
  table.appendChild(head);
  table.appendChild(body);
  tableWrap.appendChild(table);

  const streak = state.cube.cards;
  el("streakNote").textContent =
    streak.currentStreak > 0
      ? `${streak.streakIncludesToday ? t.streakCurrent(streak.currentStreak) : t.streakThroughYesterday(streak.currentStreak)} · ${t.streakLongest(streak.longestStreak)}`
      : `${t.streakNone}${streak.longestStreak > 0 ? ` · ${t.streakLongest(streak.longestStreak)}` : ""}`;
}

/* -------------------------------------------------------------------- donut */

function renderDonut(view) {
  const t = state.t;
  const host = el("donutHost");
  clear(host);
  el("donutNote").textContent = t.modelsInHistory(view.models.length);

  const total = view.totalTokens;
  if (total <= 0 || !view.models.length) {
    host.appendChild(make("div", "empty-row", t.noPeak));
    return;
  }

  const drawn = view.models.slice(0, A.TOP_MODELS_DRAWN);
  const restTokens = view.models.slice(A.TOP_MODELS_DRAWN).reduce((sum, model) => sum + model.tokens, 0);
  const slices = drawn.map((model) => ({ label: modelLabel(model.modelId), tokens: model.tokens }));
  if (restTokens > 0) slices.push({ label: t.otherModel, tokens: restTokens });

  const aria = slices.map((slice) => `${slice.label} ${share(slice.tokens, total)}%`).join(", ");
  const svg = svgEl("svg", { viewBox: "0 0 42 42", class: "donut", role: "img", "aria-label": t.donutAria(aria) });
  let offset = 0;
  slices.forEach((slice, index) => {
    const fraction = slice.tokens / total;
    svg.appendChild(
      svgEl("circle", {
        class: `donut-seg donut-${index}`,
        cx: 21,
        cy: 21,
        r: 15.9,
        fill: "none",
        "stroke-dasharray": `${fraction * 100} ${100 - fraction * 100}`,
        "stroke-dashoffset": 25 - offset * 100,
      }),
    );
    offset += fraction;
  });
  const totalText = svgEl("text", { class: "donut-total", x: 21, y: 20.5, "text-anchor": "middle" });
  totalText.textContent = compact(total);
  const label = svgEl("text", { class: "donut-label", x: 21, y: 25.5, "text-anchor": "middle" });
  label.textContent = t.donutCenterLabel;
  svg.appendChild(totalText);
  svg.appendChild(label);
  host.appendChild(svg);

  // Two legend columns so long model ids truncate inside their own cell
  // instead of pushing the values off the panel edge.
  const legend = make("ul", "donut-legend");
  slices.forEach((slice, index) => {
    const item = make("li");
    item.appendChild(make("span", `swatch swatch-${index}`));
    item.appendChild(make("span", "legend-name", slice.label));
    item.appendChild(make("span", "legend-value", `${share(slice.tokens, total)}% · ${compact(slice.tokens)}`));
    legend.appendChild(item);
  });
  host.appendChild(legend);
}

/* -------------------------------------------------------------------- trend */

function renderTrend(view) {
  const t = state.t;
  const host = el("trendHost");
  const tableWrap = el("trendTableWrap");
  const legendHost = el("trendLegend");
  clear(host);
  clear(tableWrap);
  clear(legendHost);

  // Gap-filled date axis from the range start to today, so a quiet week is a
  // flat line rather than a compressed zigzag.
  const dates = [];
  const totals = [];
  const dailyMap = new Map(view.daily.map((day) => [day.date, day]));
  for (let key = view.sinceDay; key <= view.untilDay; key = A.shiftDayKey(key, 1)) {
    dates.push(key);
    totals.push(dailyMap.get(key)?.tokens || 0);
  }
  el("trendNote").textContent = t.trendNote;

  if (!dates.length) return;

  const hidden = new Set(state.prefs.hiddenModels);
  const cellByModelDate = new Map(
    view.dailyByModel.map((row) => [`${row.date}|${row.modelId}`, row.tokens]),
  );
  const series = view.models
    .slice(0, TREND_TOP_MODELS)
    .map((model) => ({
      modelId: model.modelId,
      tokens: model.tokens,
      values: dates.map((date) => cellByModelDate.get(`${date}|${model.modelId}`) || 0),
    }))
    .filter((entry) => !hidden.has(entry.modelId));

  const rangeTotal = view.totalTokens;
  const peak = Math.max(0, ...totals, ...series.flatMap((entry) => entry.values));
  const peakDate = dates[totals.indexOf(peak)] || null;
  const axisMax = niceCeil(peak);

  const W = 560;
  const H = 240;
  const left = 46;
  const right = 10;
  const top = 12;
  const bottom = 28;
  const plotWidth = W - left - right;
  const plotHeight = H - top - bottom;
  const xAt = (index) =>
    left + (dates.length === 1 ? plotWidth / 2 : (index / (dates.length - 1)) * plotWidth);
  const yAt = (value) => top + plotHeight - (value / axisMax) * plotHeight;
  const toPoints = (values) => values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ");

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "trend",
    role: "img",
    "aria-label": t.trendAria(state.range, compact(rangeTotal), compact(peak), peakDate ? formatDay(peakDate) : "—"),
  });

  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    const value = axisMax * fraction;
    const y = yAt(value);
    svg.appendChild(
      svgEl("line", { class: "trend-axis", x1: left, y1: y, x2: W - right, y2: y }),
    );
    const tick = svgEl("text", { class: "trend-tick", x: left - 8, y: y + 3, "text-anchor": "end" });
    tick.textContent = compact(value);
    svg.appendChild(tick);
  }

  if (totals.length > 0) {
    svg.appendChild(
      svgEl("polygon", {
        class: "trend-area",
        points: `${left},${top + plotHeight} ${toPoints(totals)} ${xAt(totals.length - 1)},${top + plotHeight}`,
      }),
    );
    svg.appendChild(svgEl("polyline", { class: "trend-line trend-total", points: toPoints(totals) }));
  }
  series.forEach((entry, index) => {
    svg.appendChild(
      svgEl("polyline", { class: `trend-line trend-model-${index + 1}`, points: toPoints(entry.values) }),
    );
  });

  const labelCount = Math.min(5, dates.length);
  for (let position = 0; position < labelCount; position += 1) {
    const index = labelCount === 1 ? 0 : Math.round((position / (labelCount - 1)) * (dates.length - 1));
    const tick = svgEl("text", {
      class: "trend-tick",
      x: xAt(index),
      y: H - 8,
      "text-anchor": "middle",
    });
    tick.textContent = dates[index].slice(5);
    svg.appendChild(tick);
  }
  host.appendChild(svg);

  // Legend chips: the total is fixed, each model line toggles off and on.
  const totalChip = make("button", "legend-chip");
  totalChip.type = "button";
  totalChip.setAttribute("aria-pressed", "true");
  totalChip.disabled = true;
  totalChip.appendChild(make("span", "swatch swatch-0"));
  totalChip.appendChild(make("span", null, t.trendTotal));
  legendHost.appendChild(totalChip);
  view.models.slice(0, TREND_TOP_MODELS).forEach((model, modelIndex) => {
    const chip = make("button", "legend-chip");
    chip.type = "button";
    const on = !hidden.has(model.modelId);
    chip.setAttribute("aria-pressed", on ? "true" : "false");
    chip.classList.toggle("is-off", !on);
    // Same palette slot as this model's trend line (trend-model-N).
    chip.appendChild(make("span", `swatch swatch-${modelIndex + 1}`));
    chip.appendChild(make("span", "legend-name", modelLabel(model.modelId)));
    chip.appendChild(make("span", "legend-value", compact(model.tokens)));
    chip.addEventListener("click", () => {
      const next = new Set(state.prefs.hiddenModels);
      if (next.has(model.modelId)) next.delete(model.modelId);
      else next.add(model.modelId);
      setPrefs({ hiddenModels: [...next] });
    });
    legendHost.appendChild(chip);
  });

  // Screen-reader twin of the plotted lines.
  const table = make("table", null);
  table.appendChild(make("caption", null, t.trendTableCaption));
  const head = make("thead");
  const headRow = make("tr");
  headRow.appendChild(make("th", null, t.columnDate)).scope = "col";
  headRow.appendChild(make("th", null, t.trendTotal)).scope = "col";
  for (const entry of series) headRow.appendChild(make("th", null, modelLabel(entry.modelId))).scope = "col";
  head.appendChild(headRow);
  const body = make("tbody");
  dates.forEach((date, index) => {
    const row = make("tr");
    row.appendChild(make("th", null, date)).scope = "row";
    row.appendChild(make("td", null, String(totals[index])));
    for (const entry of series) row.appendChild(make("td", null, String(entry.values[index])));
    body.appendChild(row);
  });
  table.appendChild(head);
  table.appendChild(body);
  tableWrap.appendChild(table);
}

/* ----------------------------------------------------------------- sessions */

function renderSessions() {
  const t = state.t;
  const host = el("sessionList");
  clear(host);
  const rows = state.cube.topSessions || [];
  el("sessionsNote").textContent = t.sessionsNote;
  if (!rows.length) {
    host.appendChild(make("div", "empty-row", t.emptyTitle));
    return;
  }
  const max = rows.reduce((best, row) => Math.max(best, row.tokens), 0) || 1;
  rows.forEach((row, index) => {
    const node = make("div", "session-row");
    const main = make("div", "session-main");
    const title = make("div", "session-title");
    title.appendChild(make("span", "session-rank", String(index + 1)));
    title.appendChild(make("span", null, row.sessionTitle || t.noTitle));
    node.title = `${row.sessionTitle || t.noTitle} · ${grouped(row.tokens)}`;
    main.appendChild(title);

    const meta = make("div", "session-meta");
    meta.appendChild(make("span", "session-id", `#${row.sessionId}`));
    meta.appendChild(make("span", null, t.sessionTurns(row.turnCount)));
    meta.appendChild(make("span", null, t.lastActive(relativeTime(row.lastEndedAt))));
    main.appendChild(meta);
    node.appendChild(main);

    const tail = make("div", "session-tail");
    tail.appendChild(make("span", "session-tokens", compact(row.tokens)));
    const bar = make("div", "session-bar");
    const fill = make("i");
    fill.style.width = `${Math.max(2, Math.round((row.tokens / max) * 100))}%`;
    bar.appendChild(fill);
    tail.appendChild(bar);
    node.appendChild(tail);
    host.appendChild(node);
  });
}

function renderDiag() {
  const t = state.t;
  const diag = state.cube.diagnostics || {};
  el("diagLine").textContent = t.diagnostics(
    compact(diag.cacheReadTokens || 0),
    compact(diag.cacheWriteTokens || 0),
    compact(diag.reasoningTokens || 0),
  );
}

function renderStatus() {
  const t = state.t;
  const line = el("statusLine");
  const scan = state.scanState;
  if (!scan) {
    line.hidden = true;
    line.textContent = "";
    return;
  }
  if (scan.status === "scanning") {
    line.hidden = false;
    line.className = "statusline is-busy";
    line.textContent = t.scanning(Number(scan.windowsWalked || 0), Number(scan.turnsFound || 0));
    return;
  }
  if (scan.status === "failed") {
    line.hidden = false;
    line.className = "statusline is-error";
    line.textContent = t.scanFailed(scan.message || "—");
    return;
  }
  if (scan.status === "unsupported") {
    line.hidden = false;
    line.className = "statusline is-error";
    line.textContent = t.scanUnsupported;
    return;
  }
  line.hidden = true;
  line.textContent = "";
}

function renderProvenance() {
  const t = state.t;
  const cube = state.cube;
  // The footer must never outlive its cube: without one it goes quiet rather
  // than quoting numbers the charts no longer show.
  if (!A.isCube(cube)) {
    el("provenanceLine").textContent = "";
    el("disclaimerLine").textContent = t.disclaimer;
    return;
  }
  const scan = cube.scan || {};
  el("provenanceLine").textContent = t.provenance(
    grouped(scan.turnsScanned ?? cube.cards.turnCount),
    grouped(scan.windowsWalked ?? 1),
    formatTime(cube.generatedAt),
  );
  el("disclaimerLine").textContent = t.disclaimer;
}

function render() {
  renderStaticText();
  renderRanges();
  renderStatus();

  const kind = setStatusKind();
  renderState(kind);
  renderProvenance();
  if (kind !== "ready") return;

  const view = computeRangeView();
  renderCards(view);
  renderHeatmap();
  renderDonut(view);
  renderTrend(view);
  renderSessions();
  renderDiag();
  renderProvenance();
}

/* -------------------------------------------------------------------- data */

async function poll(force) {
  let settings;
  try {
    settings = await bridge.invoke("plugin.getSettings");
  } catch {
    state.status = "error";
    render();
    return;
  }
  state.status = "ok";

  // Only repaint when something actually changed: the charts are hundreds of
  // SVG nodes, so re-rendering on an unchanged settings read would churn the
  // DOM fifteen hundred times a minute for no visible reason.
  let dirty = Boolean(force);

  const scan = settings?.scanState || null;
  if (JSON.stringify(scan) !== JSON.stringify(state.scanState)) {
    state.scanState = scan;
    dirty = true;
  }

  const cube = settings?.usageCube;
  if (A.isCube(cube) && cube.generatedAt !== state.lastCubeAt) {
    state.lastCubeAt = cube.generatedAt;
    state.cube = cube;
    dirty = true;
  } else if (!A.isCube(cube) && state.cube) {
    state.cube = null;
    state.lastCubeAt = 0;
    dirty = true;
  }

  if (dirty) render();
}

function startPolling() {
  stopPolling();
  const cadence = document.hidden ? POLL_HIDDEN_MS : POLL_MS;
  state.pollTimer = window.setInterval(() => void poll(false), cadence);
}

function stopPolling() {
  if (state.pollTimer) window.clearInterval(state.pollTimer);
  state.pollTimer = null;
}

/* ------------------------------------------------------------------- events */

function bindEvents() {
  el("refreshBtn").addEventListener("click", () => void poll(true));
  el("themeBtn").addEventListener("click", () => {
    const next = state.prefs.theme === "auto" ? "light" : state.prefs.theme === "light" ? "dark" : "auto";
    setPrefs({ theme: next });
  });
  el("langBtn").addEventListener("click", () => {
    const next = state.prefs.locale === "auto" ? "en" : state.prefs.locale === "en" ? "zh" : "auto";
    setPrefs({ locale: next });
  });

  // While following the system, an OS palette change re-skins live.
  state.darkQuery.addEventListener?.("change", () => {
    if (state.prefs.theme === "auto") render();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void poll(false);
    startPolling();
  });
}

/* --------------------------------------------------------------------- init */

async function init() {
  state.prefs = readStore(PREFS_KEY, defaultPrefs());
  const storedRange = readStore(`${PREFS_KEY}.range`, { range: 30 });
  state.range = RANGES.includes(Number(storedRange.range)) ? Number(storedRange.range) : 30;
  applyPreferences();
  renderStaticText();
  render();
  bindEvents();
  await poll(true);
  startPolling();
}

/** Test surface for the verification harness; unused in normal operation. */
window.__usageDashboard = {
  state,
  poll,
  render,
  computeRangeView,
  setRange(days) {
    state.range = days;
    render();
  },
  setPrefs,
  i18nKeyDiff() {
    const en = Object.keys(STRINGS.en).sort();
    const zh = Object.keys(STRINGS.zh).sort();
    return {
      missingInZh: en.filter((key) => !zh.includes(key)),
      missingInEn: zh.filter((key) => !en.includes(key)),
      typeMismatch: en.filter((key) => zh.includes(key) && typeof STRINGS.en[key] !== typeof STRINGS.zh[key]),
    };
  },
};

void init();
