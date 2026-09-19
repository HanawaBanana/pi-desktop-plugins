/**
 * Usage Dashboard — a native PI-Desktop usage board built on the official
 * read-only usage contract (`pi.usage.listTurns`, host PR #503).
 *
 * The panel bridge is read-only, so — exactly like the data-channel pattern
 * this repo established — the plugin process is the only side that talks to
 * the host. It walks the full history in 365-day windows, aggregates the
 * turns into a cube and publishes the cube through plugin settings:
 *
 *   usageCube    the aggregated cube the panel filters and renders locally
 *   scanState    whether a walk is running / finished / failed / unsupported
 *
 * This plugin covers PI-Desktop's native usage only, through the formal
 * contract. It never reads message text, transcript files or any host
 * database directly, never touches the network, and writes nothing outside
 * its own plugin settings.
 */

const { aggregateCube, isCube, normalizeTurn } = require("./lib/aggregate");

const DAY_MS = 86_400_000;
/** One walk window, the widest the contract allows. */
const WINDOW_DAYS = 365;
/** A window with zero turns ends the walk; this cap bounds a lying host. */
const MAX_WINDOWS = 8;
/** Contract maximum page size — fewest round trips per window. */
const PAGE_LIMIT = 500;

let walking = null;

/* ---------------------------------------------------------------- scanning */

/** The host feature this plugin is built on; absent in older builds. */
function listTurnsApi() {
  const usage = globalThis.pi?.usage;
  return typeof usage?.listTurns === "function" ? usage.listTurns.bind(usage) : null;
}

/**
 * Walk the whole history backwards from `nowMs` in 365-day windows:
 * the next window ends one millisecond before the previous one began, each
 * window pages by cursor until the host reports `nextCursor: null`, and the
 * first fully empty window proves there is nothing older to find. A turnId
 * set dedupes across window boundaries, since an inclusive-endpoint window
 * can re-serve a turn whose `endedAt` sits exactly on the seam.
 */
async function collectTurns(listTurns, nowMs, onWindowDone) {
  const seen = new Set();
  const turns = [];
  let toMs = nowMs;
  let windowsWalked = 0;

  for (let window = 0; window < MAX_WINDOWS; window += 1) {
    const fromMs = toMs - (WINDOW_DAYS * DAY_MS - 1);
    let cursor = null;
    let rowsInWindow = 0;

    do {
      // `cursor` is omitted rather than null: the contract calls it opaque,
      // so the first page is sent without it instead of with a null value.
      const page = await listTurns({ fromMs, toMs, cursor: cursor || undefined, limit: PAGE_LIMIT });
      for (const raw of page?.turns || []) {
        rowsInWindow += 1;
        const turn = normalizeTurn(raw, turns.length);
        if (seen.has(turn.turnId)) continue;
        seen.add(turn.turnId);
        turns.push(turn);
      }
      cursor = typeof page?.nextCursor === "string" && page.nextCursor ? page.nextCursor : null;
    } while (cursor);

    windowsWalked += 1;
    if (onWindowDone) onWindowDone({ windowsWalked, turnsFound: turns.length });
    if (rowsInWindow === 0) break;
    toMs = fromMs - 1;
  }

  return { turns, windowsWalked };
}

/**
 * Rescan and publish. Concurrent callers share one walk: the load hook and
 * the open command both want the same fresh cube, not two of them.
 */
function refreshCube(reason = "manual") {
  if (walking) return walking;
  walking = (async () => {
    const startedAt = Date.now();
    try {
      const listTurns = listTurnsApi();
      if (!listTurns) {
        // Older host without the contract: say so instead of showing an empty
        // board that reads as "no usage", which would be a lie.
        await pi.plugin.setSettings({
          scanState: {
            status: "unsupported",
            startedAt,
            finishedAt: Date.now(),
            reason,
            message:
              "This PI-Desktop build does not expose pi.usage.listTurns yet. Update the app, then run Usage Dashboard: Open again.",
          },
        });
        return null;
      }

      await pi.plugin.setSettings({
        scanState: { status: "scanning", startedAt, reason, windowsWalked: 0, turnsFound: 0 },
      });

      const { turns, windowsWalked } = await collectTurns(listTurns, startedAt, (progress) => {
        void pi.plugin.setSettings({ scanState: { status: "scanning", startedAt, reason, ...progress } }).catch(
          () => undefined,
        );
      });

      const cube = aggregateCube(turns, Date.now());
      cube.scan = { reason, windowsWalked, turnsScanned: turns.length, durationMs: Date.now() - startedAt };
      await pi.plugin.setSettings({
        usageCube: cube,
        scanState: {
          status: "ready",
          startedAt,
          finishedAt: Date.now(),
          reason,
          windowsWalked,
          turnsFound: turns.length,
        },
      });
      return cube;
    } catch (error) {
      await pi.plugin
        .setSettings({
          scanState: {
            status: "failed",
            startedAt,
            finishedAt: Date.now(),
            reason,
            message: String(error?.message || error),
          },
        })
        .catch(() => undefined);
      throw error;
    } finally {
      walking = null;
    }
  })();
  return walking;
}

/* --------------------------------------------------------------- lifecycle */

async function onLoad() {
  await pi.commands.register({
    id: "usageDashboard.open",
    title: "Usage Dashboard: Open",
    keywords: ["usage", "tokens", "stats", "dashboard", "用量", "统计", "看板"],
    category: "Productivity",
    run: async () => {
      // Open now, walk behind it: the panel renders the previous cube and
      // switches to the fresh one as soon as it lands in settings.
      await pi.ui.openPanel();
      void refreshCube("command").catch((error) =>
        pi.ui.showToast(`Usage Dashboard walk failed: ${error.message}`, "warn"),
      );
    },
  });

  void refreshCube("load").catch(() => undefined);
}

async function onUnload() {
  await pi.commands.unregister("usageDashboard.open");
}

module.exports = {
  onLoad,
  onUnload,
  __test: {
    aggregateCube,
    collectTurns,
    isCube,
    normalizeTurn,
    refreshCube,
    DAY_MS,
    MAX_WINDOWS,
    PAGE_LIMIT,
    WINDOW_DAYS,
  },
};
