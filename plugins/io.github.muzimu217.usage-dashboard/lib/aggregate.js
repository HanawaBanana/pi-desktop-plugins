/**
 * Shared aggregation layer for the Usage Dashboard plugin.
 *
 * The same file is required by the plugin process (main.js) and loaded as a
 * plain script by the panel, so a number shown on screen and a number computed
 * in the plugin can never drift apart. The module is a pure function layer:
 * turns in, cube out, no host access, no clock reads (time is always injected).
 *
 * Aggregation contract (v3.1, this plugin's own accounting):
 *   - Headline tokens = inputTokens + outputTokens. Cache reads, cache writes
 *     and reasoning are diagnostic figures only and never enter the headline.
 *   - Day keys are local-calendar days (YYYY-MM-DD) taken from `endedAt`,
 *     because the reader runs on the same machine as the conversations. An
 *     ISO-UTC key would shift early-morning turns into the previous column.
 *   - A day is "active" when its headline total is > 0. Streaks (v1, simple):
 *     the current streak counts consecutive active days ending today, or
 *     ending yesterday when today is not active yet; the longest streak is the
 *     longest run anywhere in history. Any gap of one day breaks a run.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UsageDashboardAggregate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const DAY_MS = 86_400_000;
  /** Model id used when a turn arrives without one. Localized in the panel. */
  const UNKNOWN_MODEL = "unknown";
  /** Sessions ranked in the panel; the cube keeps the top 8 by headline. */
  const TOP_SESSIONS = 8;
  /** Donut slices drawn before everything else collapses into "other". */
  const TOP_MODELS_DRAWN = 6;

  function count(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  /** Local-calendar day key from an epoch-ms timestamp. */
  function dayKeyFromTimestamp(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function dayKeyFromDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  /** Parse `YYYY-MM-DD` into a local-midnight Date (never `new Date(key)`,
   *  which parses as UTC midnight and re-shifts through the local zone). */
  function dateFromDayKey(key) {
    const [year, month, day] = String(key).split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  /** Local-timezone day shift; `setDate` normalises month/year rollover. */
  function shiftDayKey(key, days) {
    const date = dateFromDayKey(key);
    date.setDate(date.getDate() + days);
    return dayKeyFromDate(date);
  }

  function todayKey() {
    return dayKeyFromDate(new Date());
  }

  /** Whole days between two day keys (positive when `toKey` is later). */
  function daysBetweenKeys(fromKey, toKey) {
    const from = dateFromDayKey(fromKey);
    const to = dateFromDayKey(toKey);
    return Math.round((to.getTime() - from.getTime()) / DAY_MS);
  }

  /**
   * Streaks over daily rows. v1 rule: activity is a day with headline > 0;
   * the current streak anchors on today and falls back to yesterday, so a
   * morning check does not read "streak broken" before the first coffee.
   */
  function streakFromDays(daily, today) {
    const active = new Set(
      (Array.isArray(daily) ? daily : [])
        .filter((day) => count(day && day.tokens) > 0)
        .map((day) => day.date),
    );
    if (!active.size) return { current: 0, longest: 0, includesToday: false };

    let current = 0;
    let includesToday = false;
    const cursor = dateFromDayKey(today);
    if (active.has(dayKeyFromDate(cursor))) {
      includesToday = true;
    } else {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (active.has(dayKeyFromDate(cursor))) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const keys = [...active].sort();
    let longest = 0;
    let run = 0;
    let previous = null;
    for (const key of keys) {
      run = previous && daysBetweenKeys(previous, key) === 1 ? run + 1 : 1;
      if (run > longest) longest = run;
      previous = key;
    }
    return { current, longest, includesToday };
  }

  /** Headline figure for one turn: input + output, nothing else. */
  function headlineOf(turn) {
    return count(turn && turn.inputTokens) + count(turn && turn.outputTokens);
  }

  /** Defensive copy of one host turn; hostile or missing fields become 0/"". */
  function normalizeTurn(turn, index) {
    const source = turn && typeof turn === "object" ? turn : {};
    const startedAt = count(source.startedAt) || 0;
    const endedAt = count(source.endedAt) || startedAt;
    const turnId = String(source.turnId ?? "").trim();
    return {
      turnId: turnId || `turn:${String(source.sessionId ?? "")}:${endedAt}:${index}`,
      sessionId: String(source.sessionId ?? "").trim(),
      sessionTitle: String(source.sessionTitle ?? "").trim(),
      projectId: String(source.projectId ?? "").trim(),
      providerId: String(source.providerId ?? "").trim(),
      modelId: String(source.modelId ?? "").trim(),
      startedAt,
      endedAt,
      inputTokens: count(source.inputTokens),
      outputTokens: count(source.outputTokens),
      cacheReadTokens: count(source.cacheReadTokens),
      cacheWriteTokens: count(source.cacheWriteTokens),
      reasoningTokens: count(source.reasoningTokens),
    };
  }

  function emptyCube(nowMs) {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: nowMs,
      cards: {
        totalTokens: 0,
        turnCount: 0,
        sessionCount: 0,
        peakDay: null,
        currentStreak: 0,
        longestStreak: 0,
        streakIncludesToday: false,
      },
      daily: [],
      dailyByModel: [],
      models: [],
      topSessions: [],
      diagnostics: { cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 },
      depth: { firstEndedAt: 0, lastEndedAt: 0, activeDays: 0 },
    };
  }

  function isCube(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        Number(value.schemaVersion) === SCHEMA_VERSION &&
        Array.isArray(value.daily) &&
        Array.isArray(value.models) &&
        value.cards &&
        typeof value.cards.totalTokens === "number",
    );
  }

  /**
   * Aggregate normalized turns into the published cube.
   *
   * @param turns raw turn objects from the host's listTurns (deduped already,
   *   but a second belt-and-braces dedupe by turnId happens here)
   * @param nowMs injected clock so "today" and the streaks are testable
   */
  function aggregateCube(turns, nowMs) {
    const cube = emptyCube(nowMs);
    const rows = (Array.isArray(turns) ? turns : []).map(normalizeTurn);
    const seen = new Set();

    const dailyMap = new Map(); // date -> { tokens, turns }
    const dailyModelMap = new Map(); // date -> Map(modelId -> tokens)
    const modelMap = new Map(); // modelId -> tokens
    const sessions = new Map(); // sessionId -> aggregate

    for (const turn of rows) {
      if (seen.has(turn.turnId)) continue;
      seen.add(turn.turnId);
      if (turn.endedAt <= 0) continue;

      const headline = headlineOf(turn);
      cube.cards.turnCount += 1;
      cube.cards.totalTokens += headline;
      cube.diagnostics.cacheReadTokens += turn.cacheReadTokens;
      cube.diagnostics.cacheWriteTokens += turn.cacheWriteTokens;
      cube.diagnostics.reasoningTokens += turn.reasoningTokens;
      if (cube.depth.firstEndedAt === 0 || turn.endedAt < cube.depth.firstEndedAt) {
        cube.depth.firstEndedAt = turn.endedAt;
      }
      if (turn.endedAt > cube.depth.lastEndedAt) cube.depth.lastEndedAt = turn.endedAt;

      const date = dayKeyFromTimestamp(turn.endedAt);
      const day = dailyMap.get(date) || { tokens: 0, turns: 0 };
      day.tokens += headline;
      day.turns += 1;
      dailyMap.set(date, day);

      const modelId = turn.modelId || UNKNOWN_MODEL;
      modelMap.set(modelId, (modelMap.get(modelId) || 0) + headline);
      const byModel = dailyModelMap.get(date) || new Map();
      byModel.set(modelId, (byModel.get(modelId) || 0) + headline);
      dailyModelMap.set(date, byModel);

      const sessionKey = turn.sessionId || `turn:${turn.turnId}`;
      const session = sessions.get(sessionKey) || {
        sessionId: sessionKey,
        sessionTitle: turn.sessionTitle,
        tokens: 0,
        turnCount: 0,
        lastEndedAt: 0,
      };
      session.tokens += headline;
      session.turnCount += 1;
      if (!session.sessionTitle && turn.sessionTitle) session.sessionTitle = turn.sessionTitle;
      if (turn.endedAt > session.lastEndedAt) session.lastEndedAt = turn.endedAt;
      sessions.set(sessionKey, session);
    }

    cube.cards.sessionCount = sessions.size;
    cube.depth.activeDays = dailyMap.size;

    // Daily series, ascending. Local day keys compare correctly as strings.
    cube.daily = [...dailyMap.entries()]
      .map(([date, day]) => ({ date, tokens: day.tokens, turns: day.turns }))
      .sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : 0));

    cube.dailyByModel = [...dailyModelMap.entries()]
      .flatMap(([date, byModel]) =>
        [...byModel.entries()].map(([modelId, tokens]) => ({ date, modelId, tokens })),
      )
      .sort((left, right) =>
        left.date < right.date ? -1 : left.date > right.date ? 1 : left.modelId < right.modelId ? -1 : 1,
      );

    const total = cube.cards.totalTokens;
    cube.models = [...modelMap.entries()]
      .map(([modelId, tokens]) => ({
        modelId,
        tokens,
        share: total > 0 ? Math.round((tokens / total) * 1000) / 10 : 0,
      }))
      .sort((left, right) => right.tokens - left.tokens);

    cube.topSessions = [...sessions.values()]
      .sort((left, right) => right.tokens - left.tokens)
      .slice(0, TOP_SESSIONS)
      .map((session) => ({
        sessionId: session.sessionId.slice(0, 8),
        sessionTitle: session.sessionTitle,
        tokens: session.tokens,
        turnCount: session.turnCount,
        lastEndedAt: session.lastEndedAt,
      }));

    const peak = cube.daily.reduce(
      (best, day) => (day.tokens > best.tokens ? { date: day.date, tokens: day.tokens } : best),
      { date: null, tokens: 0 },
    );
    cube.cards.peakDay = peak.tokens > 0 ? peak : null;

    const streak = streakFromDays(cube.daily, dayKeyFromTimestamp(nowMs));
    cube.cards.currentStreak = streak.current;
    cube.cards.longestStreak = streak.longest;
    cube.cards.streakIncludesToday = streak.includesToday;

    return cube;
  }

  return {
    SCHEMA_VERSION,
    DAY_MS,
    UNKNOWN_MODEL,
    TOP_SESSIONS,
    TOP_MODELS_DRAWN,
    aggregateCube,
    count,
    dayKeyFromDate,
    dayKeyFromTimestamp,
    dateFromDayKey,
    daysBetweenKeys,
    headlineOf,
    isCube,
    normalizeTurn,
    shiftDayKey,
    streakFromDays,
    todayKey,
  };
});
