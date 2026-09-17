import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pluginRoot = join(here, "../plugins/io.github.muzimu217.usage-dashboard");
const plugin = require(join(pluginRoot, "main.js"));
const aggregate = require(join(pluginRoot, "lib/aggregate.js"));
const manifest = JSON.parse(readFileSync(join(pluginRoot, "manifest.json"), "utf8"));
const panelSource = readFileSync(join(pluginRoot, "renderer/panel.js"), "utf8");
const panelHtml = readFileSync(join(pluginRoot, "renderer/index.html"), "utf8");
const panelCss = readFileSync(join(pluginRoot, "renderer/panel.css"), "utf8");

const DAY_MS = 86_400_000;
/** A fixed "now": 2026-09-17 12:00 local time, so streaks are deterministic. */
const NOW = new Date(2026, 8, 17, 12, 0, 0).getTime();

function turn({ turnId, at, input = 0, output = 0, cacheRead = 0, cacheWrite = 0, reasoning = 0, modelId = "alpha", sessionId = "session-aaaaaaaa", sessionTitle = "A session" }) {
  return {
    turnId,
    sessionId,
    sessionTitle,
    projectId: "project-1",
    providerId: "local",
    modelId,
    startedAt: at - 60_000,
    endedAt: at,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    reasoningTokens: reasoning,
  };
}

const at = (month, day, hour = 10) => new Date(2026, month, day, hour).getTime();

/* ---------------------------------------------------------------- manifest */

test("manifest declares the contract-only reader and the two minimal permissions", () => {
  assert.equal(manifest.id, "io.github.muzimu217.usage-dashboard");
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.author, "muzimu217");
  assert.equal(manifest.main, "main.js");
  assert.deepEqual(manifest.permissions, ["ui.panel", "usage.read"]);
  assert.equal(manifest.ui.panel, "renderer/index.html");
  assert.equal(manifest.ui.width, 960);
  assert.equal(manifest.ui.height, 720);
  assert.equal(manifest.ui.title.en, "Usage Dashboard");
  assert.equal(manifest.ui.title["zh-CN"], "原生用量看板");

  const command = manifest.contributes.commands[0];
  assert.equal(command.id, "usageDashboard.open");
  for (const keyword of ["usage", "用量", "统计"]) {
    assert.ok(command.keywords.includes(keyword), `keywords should include ${keyword}`);
  }

  for (const locale of ["en", "zh-CN"]) {
    const entry = manifest.i18n[locale];
    assert.ok(entry.name && entry.description && entry.safetyNotes, `${locale} metadata is complete`);
  }
  assert.match(manifest.i18n.en.safetyNotes, /read-only/i);
  assert.match(manifest.i18n.en.safetyNotes, /never reads message text/i);
  assert.match(manifest.i18n["zh-CN"].safetyNotes, /只读/);
  assert.match(manifest.i18n["zh-CN"].safetyNotes, /消息正文/);
});

test("the panel source renders its own charts and carries both palettes and i18n", () => {
  assert.match(panelSource, /function renderHeatmap\(/);
  assert.match(panelSource, /function renderDonut\(/);
  assert.match(panelSource, /function renderTrend\(/);
  // Same compact number format as token-insights: 1.2K / 3.4M.
  assert.match(panelSource, /function compact\(value\)/);
  assert.match(panelSource, /toFixed\(1\)\}K/);
  assert.match(panelSource, /toFixed\(2\)\}M/);
  // Panel reads settings and nothing else.
  assert.match(panelSource, /window\.pluginBridge/);
  assert.match(panelSource, /plugin\.getSettings/);
  // English and Chinese string tables with a parity hook.
  assert.match(panelSource, /title: "Usage Dashboard"/);
  assert.match(panelSource, /title: "原生用量看板"/);
  assert.match(panelSource, /i18nKeyDiff/);
  // Accessibility twins for the charts.
  assert.match(panelHtml, /class="sr-only" id="heatTableWrap"/);
  assert.match(panelHtml, /class="sr-only" id="trendTableWrap"/);
  assert.match(panelHtml, /connect-src 'none'/);
  // Both palettes: system following plus explicit overrides.
  assert.match(panelCss, /@media \(prefers-color-scheme: dark\)/);
  assert.match(panelCss, /:root\[data-theme="dark"\]/);
  assert.match(panelCss, /:root\[data-theme="light"\]/);
});

/* -------------------------------------------------------------- aggregation */

test("headline tokens are input + output; cache and reasoning stay diagnostic", () => {
  const turns = [
    turn({
      turnId: "t1",
      at: at(8, 10, 10),
      input: 10,
      output: 5,
      cacheRead: 100,
      cacheWrite: 50,
      reasoning: 7,
    }),
  ];
  const cube = aggregate.aggregateCube(turns, NOW);

  assert.equal(aggregate.isCube(cube), true);
  assert.equal(cube.cards.totalTokens, 15);
  assert.equal(cube.cards.turnCount, 1);
  assert.equal(cube.cards.sessionCount, 1);
  assert.deepEqual(cube.diagnostics, {
    cacheReadTokens: 100,
    cacheWriteTokens: 50,
    reasoningTokens: 7,
  });
  // Local-calendar day key from endedAt, not an ISO-UTC string.
  assert.equal(cube.daily[0].date, "2026-09-10");
  assert.equal(cube.daily[0].tokens, 15);
  assert.equal(cube.daily[0].turns, 1);
});

test("multi-day, multi-model history produces ranked models, shares, peak day and top sessions", () => {
  const turns = [
    turn({ turnId: "a1", at: at(8, 10, 9), input: 100, output: 20, modelId: "alpha", sessionId: "s1", sessionTitle: "Refactor" }),
    turn({ turnId: "b1", at: at(8, 10, 11), input: 30, output: 10, modelId: "beta", sessionId: "s2", sessionTitle: "Chores" }),
    turn({ turnId: "a2", at: at(8, 11, 15), input: 50, output: 0, modelId: "alpha", sessionId: "s1", sessionTitle: "Refactor" }),
  ];
  const cube = aggregate.aggregateCube(turns, NOW);

  assert.equal(cube.cards.totalTokens, 210);
  assert.equal(cube.cards.turnCount, 3);
  assert.equal(cube.cards.sessionCount, 2);
  assert.deepEqual(cube.cards.peakDay, { date: "2026-09-10", tokens: 160 });

  assert.deepEqual(
    cube.daily.map((day) => [day.date, day.tokens]),
    [["2026-09-10", 160], ["2026-09-11", 50]],
  );
  assert.deepEqual(
    cube.dailyByModel.map((row) => [row.date, row.modelId, row.tokens]),
    [["2026-09-10", "alpha", 120], ["2026-09-10", "beta", 40], ["2026-09-11", "alpha", 50]],
  );

  assert.deepEqual(
    cube.models.map((model) => [model.modelId, model.tokens, model.share]),
    [["alpha", 170, 81], ["beta", 40, 19]],
  );

  assert.equal(cube.topSessions.length, 2);
  assert.deepEqual(cube.topSessions[0], {
    sessionId: "s1", // 8-character prefix of the full session id
    sessionTitle: "Refactor",
    tokens: 170,
    turnCount: 2,
    lastEndedAt: at(8, 11, 15),
  });
  assert.equal(cube.topSessions[1].sessionId, "s2");
});

test("streaks follow local calendar days, fall back to yesterday, and cache-only days are not active", () => {
  const turns = [
    // Current run: today + yesterday.
    turn({ turnId: "d1", at: at(8, 17, 9), input: 6, output: 4 }),
    turn({ turnId: "d2", at: at(8, 16, 9), input: 3, output: 2 }),
    // A gap on Sep 15, then a lone active day.
    turn({ turnId: "d3", at: at(8, 14, 9), input: 3, output: 0 }),
    // The longest run: Sep 3–5.
    turn({ turnId: "d4", at: at(8, 3, 9), input: 2, output: 1 }),
    turn({ turnId: "d5", at: at(8, 4, 9), input: 2, output: 1 }),
    turn({ turnId: "d6", at: at(8, 5, 9), input: 2, output: 1 }),
    // A cache-only day: diagnostics only, never an active headline day.
    turn({ turnId: "d7", at: at(8, 13, 9), input: 0, output: 0, cacheRead: 400 }),
  ];
  const cube = aggregate.aggregateCube(turns, NOW);

  assert.equal(cube.cards.currentStreak, 2);
  assert.equal(cube.cards.streakIncludesToday, true);
  assert.equal(cube.cards.longestStreak, 3);
  assert.equal(cube.diagnostics.cacheReadTokens, 400);
  assert.equal(cube.cards.totalTokens, 27);
  assert.ok(!cube.daily.some((day) => day.date === "2026-09-13" && day.tokens > 0));

  // With no turn today the streak runs through yesterday instead of breaking.
  const yesterdayCube = aggregate.aggregateCube(
    [turn({ turnId: "y1", at: at(8, 16, 9), input: 5, output: 1 })],
    NOW,
  );
  assert.equal(yesterdayCube.cards.currentStreak, 1);
  assert.equal(yesterdayCube.cards.streakIncludesToday, false);
});

test("the aggregator dedupes by turnId and survives hostile fields", () => {
  const cube = aggregate.aggregateCube(
    [
      turn({ turnId: "same", at: at(8, 10, 9), input: 7, output: 1 }),
      turn({ turnId: "same", at: at(8, 10, 9), input: 7, output: 1 }),
      // Missing model falls into the "unknown" bucket; negative counts clamp to 0.
      { turnId: "raw", endedAt: at(8, 10, 12), modelId: "", inputTokens: -5, outputTokens: 3 },
      // No endedAt: startedAt carries the day.
      { turnId: "nostamp", startedAt: at(8, 10, 8), inputTokens: 1, outputTokens: 1 },
    ],
    NOW,
  );
  assert.equal(cube.cards.turnCount, 3);
  assert.equal(cube.cards.totalTokens, 13);
  assert.equal(cube.models.some((model) => model.modelId === aggregate.UNKNOWN_MODEL), true);
  assert.equal(aggregate.isCube(null), false);
  assert.equal(aggregate.isCube({ schemaVersion: 99 }), false);
});

/* ------------------------------------------------------- listTurns walk-back */

/**
 * A fake host implementing the pi.usage.listTurns contract: keyset cursor
 * pagination in ascending endedAt order, inclusive endpoints, at most the
 * requested limit per page.
 */
function fakeHost({ windows, onCall }) {
  let windowIndex = 0;
  let pageIndex = 0;
  return async (input) => {
    onCall?.({ ...input });
    const current = windows[Math.min(windowIndex, windows.length - 1)];
    const pages = current.pages;
    const page = pages[Math.min(pageIndex, pages.length - 1)];
    pageIndex += 1;
    if (pageIndex >= pages.length) {
      pageIndex = 0;
      windowIndex += 1;
    }
    return page;
  };
}

test("collectTurns walks 365-day windows backwards, pages by cursor, dedupes and stops at an empty window", async () => {
  const windowDays = 365;
  const fromOf = (toMs) => toMs - (windowDays * DAY_MS - 1);
  const now = NOW;
  const w1From = fromOf(now);
  const w2To = w1From - 1;
  const w2From = fromOf(w2To);

  const calls = [];
  const host = fakeHost({
    windows: [
      {
        pages: [
          {
            turns: [
              turn({ turnId: "t1", at: now - DAY_MS, input: 1, output: 1 }),
              turn({ turnId: "t2", at: now - 2 * DAY_MS, input: 1, output: 1 }),
            ],
            nextCursor: "cursor-1",
          },
          { turns: [turn({ turnId: "t3", at: now - 3 * DAY_MS, input: 1, output: 1 })], nextCursor: null },
        ],
      },
      {
        pages: [
          {
            turns: [
              turn({ turnId: "t4", at: w2To - DAY_MS, input: 1, output: 1 }),
              // The seam duplicate: the same turnId the first window already
              // served; the walk must not count it twice.
              turn({ turnId: "t3", at: w2To - 2 * DAY_MS, input: 1, output: 1 }),
            ],
            nextCursor: null,
          },
        ],
      },
      { pages: [{ turns: [], nextCursor: null }] },
      // A lying host that keeps serving rows must still be bounded; with an
      // honest empty window the walk stops here.
      { pages: [{ turns: [turn({ turnId: "never", at: 1, input: 1, output: 1 })], nextCursor: null }] },
    ],
    onCall: (call) => calls.push(call),
  });

  const progress = [];
  const { turns, windowsWalked } = await plugin.__test.collectTurns(host, now, (step) => progress.push(step));

  assert.equal(calls.length, 4, "two pages in window 1, then windows 2 and 3");
  assert.equal(calls[0].toMs, now);
  assert.equal(calls[0].fromMs, w1From);
  assert.equal(calls[0].cursor, undefined, "the first page is sent without a cursor");
  assert.equal(calls[0].limit, 500);
  assert.equal(calls[1].cursor, "cursor-1");
  assert.equal(calls[2].toMs, w2To, "the next window ends 1ms before the previous one began");
  assert.equal(calls[2].fromMs, w2From);
  for (const call of calls) {
    assert.ok(call.toMs - call.fromMs <= windowDays * DAY_MS, "every window respects the 365-day cap");
  }
  assert.deepEqual(progress, [
    { windowsWalked: 1, turnsFound: 3 },
    { windowsWalked: 2, turnsFound: 4 },
    { windowsWalked: 3, turnsFound: 4 },
  ]);
  assert.equal(windowsWalked, 3);
  assert.deepEqual(
    turns.map((item) => item.turnId),
    ["t1", "t2", "t3", "t4"],
  );
  assert.equal(turns[0].inputTokens, 1);
});

test("normalizeTurn clamps hostile numbers and falls back to startedAt", () => {
  const normalized = plugin.__test.normalizeTurn(
    { turnId: "x", startedAt: at(8, 10, 9), inputTokens: -4, outputTokens: "8", cacheReadTokens: null },
    3,
  );
  assert.equal(normalized.inputTokens, 0);
  assert.equal(normalized.outputTokens, 8);
  assert.equal(normalized.cacheReadTokens, 0);
  assert.equal(normalized.endedAt, at(8, 10, 9));
  assert.equal(normalized.modelId, "");
});

/* ------------------------------------------------------------- host wiring */

test("onLoad publishes the cube through settings and the open command rescans", async () => {
  const previousPi = globalThis.pi;
  const calls = { registered: [], unregistered: [], timeline: [], settings: [] };
  try {
    // The turn sits in the current window; every older window answers empty,
    // so the walk stops after the second window.
    let firstCall = true;
    globalThis.pi = {
      usage: {
        listTurns: async () => {
          if (firstCall) {
            firstCall = false;
            return {
              turns: [turn({ turnId: "live", at: Date.now(), input: 12, output: 3 })],
              nextCursor: null,
            };
          }
          return { turns: [], nextCursor: null };
        },
      },
      plugin: {
        setSettings: async (value) => calls.settings.push(value),
      },
      commands: {
        register: async (command) => calls.registered.push(command),
        unregister: async (id) => calls.unregistered.push(id),
      },
      ui: {
        openPanel: async () => calls.timeline.push("panel"),
        showToast: () => undefined,
      },
    };

    await plugin.onLoad();
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(calls.registered[0].id, "usageDashboard.open");
    assert.deepEqual(calls.registered[0].keywords.slice(0, 4), ["usage", "tokens", "stats", "dashboard"]);
    const ready = calls.settings.filter((entry) => entry.scanState?.status === "ready");
    assert.equal(ready.length, 1);
    assert.equal(ready[0].usageCube.cards.totalTokens, 15);
    assert.equal(ready[0].scanState.windowsWalked, 2, "the second window is empty and stops the walk");

    calls.timeline.length = 0;
    calls.settings.length = 0;
    await calls.registered[0].run();
    assert.deepEqual(calls.timeline, ["panel"]);
    // The command opens first and rescans behind itself (fire-and-forget), so
    // the fresh cube lands a tick later.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const rescanned = calls.settings.filter((entry) => entry.scanState?.status === "ready");
    assert.equal(rescanned.length, 1, "the command triggered a fresh walk");

    await plugin.onUnload();
    assert.deepEqual(calls.unregistered, ["usageDashboard.open"]);
  } finally {
    await plugin.onUnload().catch(() => undefined);
    globalThis.pi = previousPi;
  }
});

test("a host without the contract publishes an unsupported state instead of an empty board", async () => {
  const previousPi = globalThis.pi;
  const settings = [];
  try {
    globalThis.pi = {
      usage: undefined,
      plugin: { setSettings: async (value) => settings.push(value) },
      commands: { register: async () => undefined, unregister: async () => undefined },
      ui: { openPanel: async () => undefined, showToast: () => undefined },
    };
    const result = await plugin.__test.refreshCube("probe");
    assert.equal(result, null);
    assert.equal(settings.at(-1).scanState.status, "unsupported");
    assert.ok(settings.at(-1).usageCube === undefined, "no cube is published, so the old one survives");
  } finally {
    globalThis.pi = previousPi;
  }
});
