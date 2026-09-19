/**
 * Read-only access to PI-Desktop's own local records.
 *
 * Two things the panel cannot get any other way:
 *   readHostAppearance   the app's theme/locale, so the panel can follow it
 *   readProviderLabels   provider display names, so a ranking shows "openlux"
 *                        instead of the configuration UUID the transcript holds
 *
 * The panel bridge exposes no channel for either, so the plugin process resolves
 * them here and hands the result to the panel through plugin settings.
 *
 * Everything here is strictly read-only and stays on this device:
 *   pi.usage.listTurns (official host contract) → completed-turn usage
 *   ~/.pi-desktop/pi.sqlite            kv(ns='app', key='app') → { theme, language }
 *                                      providers(id, name)     → display names
 *                                      turns (completed usage) → subagent-inclusive
 *                                      remainders, only on hosts without the API
 *   ~/.pi-desktop/plugins/registry.json + the theme plugin's manifest + CSS
 *
 * No message text, tool arguments, session ids or project paths are touched, no
 * credential column is read, and no filesystem path ever leaves this module.
 */

const { existsSync, readFileSync, statSync } = require("node:fs");
const path = require("node:path");

/** Mirrors the host's own theme-css guard (plugin-sdk `sanitizeThemeCss`). */
const THEME_CSS_MAX_BYTES = 256 * 1024;
/** A stat() round is cheap; a full re-read is not. Cache until a file moves. */
let cache = null;

function themeCssIsSafe(css) {
  if (!css || !css.trim()) return false;
  if (Buffer.byteLength(css, "utf8") > THEME_CSS_MAX_BYTES) return false;
  if (/@import\b/i.test(css)) return false;
  if (/<\/?\s*style/i.test(css) || /<!--/.test(css)) return false;
  if (/javascript\s*:/i.test(css) || /expression\s*\(/i.test(css)) return false;
  let wellFormed = 0;
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    wellFormed += 1;
    if (!/^data:/i.test(match[2].trim())) return false;
  }
  if ((css.match(/url\(/gi) ?? []).length !== wellFormed) return false;
  return true;
}

/** `<data>/plugins/data/<pluginId>` → `<data>`; the host owns that layout. */
function hostRootFromDataPath(dataPath) {
  return path.resolve(String(dataPath || ""), "..", "..", "..");
}

function safeStat(file) {
  try {
    const stat = statSync(file);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return "-";
  }
}

/**
 * Open the host database read-only. `node:sqlite` is only available on newer
 * runtimes, so a failure here is expected rather than exceptional.
 */
function openHostDb(dbFile) {
  let sqlite;
  try {
    sqlite = require("node:sqlite");
  } catch {
    return null;
  }
  if (!sqlite?.DatabaseSync) return null;
  try {
    return new sqlite.DatabaseSync(dbFile, { readOnly: true });
  } catch {
    return null;
  }
}

function closeQuietly(db) {
  try {
    db?.close();
  } catch {
    /* closing a failed handle is not interesting */
  }
}

function readSettingsViaSqlite(dbFile) {
  const db = openHostDb(dbFile);
  if (!db) return null;
  try {
    const row = db
      .prepare("SELECT value_json FROM kv WHERE ns = ? AND key = ? LIMIT 1")
      .get("app", "app");
    if (!row?.value_json) return null;
    const parsed = JSON.parse(String(row.value_json));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  } finally {
    closeQuietly(db);
  }
}

/**
 * `providerId → display name`, for the ids PI-Desktop writes into transcripts.
 *
 * Only the id and name columns are selected: nothing about credentials, base
 * urls or configuration is read. Providers the user has since deleted simply
 * stay unresolved, and the panel keeps showing the raw id.
 */
function readProviderLabels(hostRoot) {
  const dbFile = path.join(String(hostRoot || ""), "pi.sqlite");
  if (!existsSync(dbFile)) return {};
  const db = openHostDb(dbFile);
  if (!db) return {};
  try {
    const rows = db.prepare("SELECT id, name FROM providers").all();
    const labels = {};
    for (const row of rows || []) {
      const id = String(row?.id ?? "").trim();
      const name = String(row?.name ?? "").trim();
      if (id && name) labels[id] = name;
    }
    return labels;
  } catch {
    return {};
  } finally {
    closeQuietly(db);
  }
}

/**
 * Fallback reader for runtimes without `node:sqlite`: the settings record is a
 * flat JSON string inside the page data, so the newest copy can be recovered by
 * scanning bytes. The write-ahead log is scanned last because it holds the most
 * recent commit.
 */
function readSettingsViaScan(files) {
  const OBJECT = /\{[^{}]*"language"\s*:\s*"[^"]*"[^{}]*\}/g;
  let found = null;
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file).toString("latin1");
    } catch {
      continue;
    }
    for (const match of text.matchAll(OBJECT)) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed && typeof parsed === "object" && "theme" in parsed) found = parsed;
      } catch {
        /* a partial page match is not a settings record */
      }
    }
    if (!found) {
      // Last resort: the two keys we actually need, most recent occurrence.
      const theme = [...text.matchAll(/"theme"\s*:\s*"((?:plugin:)?[A-Za-z0-9._:-]+)"/g)].pop();
      const language = [...text.matchAll(/"language"\s*:\s*"([A-Za-z-]{2,10})"/g)].pop();
      if (theme || language) {
        found = { theme: theme?.[1], language: language?.[1] };
      }
    }
  }
  return found;
}

function resolveInsidePlugin(pluginPath, relative) {
  const root = path.resolve(pluginPath);
  const target = path.resolve(root, String(relative || ""));
  return target === root || target.startsWith(root + path.sep) ? target : null;
}

/**
 * `plugin:<pluginId>:<themeId>` → the palette the host would inject. The theme
 * id never contains a colon, the plugin id never does either, but splitting from
 * the right keeps us safe if that ever changes.
 */
function resolvePluginTheme(hostRoot, preference) {
  if (!preference.startsWith("plugin:")) return null;
  const rest = preference.slice("plugin:".length);
  const cut = rest.lastIndexOf(":");
  if (cut <= 0) return null;
  const pluginId = rest.slice(0, cut);
  const themeId = rest.slice(cut + 1);
  let registry;
  try {
    registry = JSON.parse(readFileSync(path.join(hostRoot, "plugins", "registry.json"), "utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(registry)) return null;
  const entry = registry.find((item) => item?.id === pluginId && item?.enabled !== false);
  if (!entry?.path) return null;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.join(entry.path, "manifest.json"), "utf8"));
  } catch {
    return null;
  }
  const themes = manifest?.contributes?.themes;
  if (!Array.isArray(themes)) return null;
  const declared = themes.find((theme) => String(theme?.id ?? "") === themeId);
  if (!declared?.path) return null;
  const cssPath = resolveInsidePlugin(entry.path, declared.path);
  if (!cssPath || !existsSync(cssPath)) return null;
  let css;
  try {
    css = readFileSync(cssPath, "utf8").replace(/^\uFEFF/, "").trim();
  } catch {
    return null;
  }
  if (!themeCssIsSafe(css)) return null;
  return {
    id: preference,
    themeId,
    label: String(declared.label ?? "").trim() || themeId,
    base: declared.base === "light" ? "light" : "dark",
    css,
  };
}

function normalizeTheme(value) {
  const text = String(value ?? "").trim();
  if (text.startsWith("plugin:")) return text;
  if (text === "light" || text === "dark" || text === "system") return text;
  return "system";
}

function normalizeLocale(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * Resolve the appearance the host is currently showing.
 *
 * Never throws: an unreadable host (missing file, unknown schema, older runtime)
 * returns `ok: false`, which the panel treats as "follow the OS and let the user
 * choose" rather than as an error page.
 */
function readHostAppearance(hostRoot) {
  const root = String(hostRoot || "");
  const dbFile = path.join(root, "pi.sqlite");
  const walFile = `${dbFile}-wal`;
  const registryFile = path.join(root, "plugins", "registry.json");
  const fingerprint = [dbFile, walFile, registryFile].map(safeStat).join("|");
  if (cache && cache.fingerprint === fingerprint) return cache.value;

  let settings = null;
  let source = null;
  if (existsSync(dbFile)) {
    settings = readSettingsViaSqlite(dbFile);
    if (settings) source = "sqlite";
    if (!settings) {
      settings = readSettingsViaScan([dbFile, walFile].filter((file) => existsSync(file)));
      if (settings) source = "scan";
    }
  }

  const value = settings
    ? (() => {
        const preference = normalizeTheme(settings.theme);
        const pluginTheme = resolvePluginTheme(root, preference);
        return {
          ok: true,
          source,
          readAt: Date.now(),
          themePreference: preference,
          // A plugin theme that no longer resolves falls back to `system`,
          // exactly like the host shell does.
          base: pluginTheme ? pluginTheme.base : preference.startsWith("plugin:") ? "system" : preference,
          locale: normalizeLocale(settings.language),
          pluginTheme,
        };
      })()
    : {
        ok: false,
        source: null,
        readAt: Date.now(),
        themePreference: null,
        base: "system",
        locale: null,
        pluginTheme: null,
        reason: existsSync(dbFile) ? "UNREADABLE_SETTINGS" : "NO_HOST_SETTINGS",
      };

  cache = { fingerprint, value };
  return value;
}

/**
 * Completed-turn usage from the host. Prefers the official read-only
 * `pi.usage.listTurns` contract (which already excludes soft-deleted sessions
 * and carries no message text); hosts without it fall back to the direct
 * database read below. Either way only token counts and ids leave this module.
 */
async function readCompletedTurnUsage(hostRoot, pi) {
  const listTurns = typeof pi !== "undefined" ? pi?.usage?.listTurns : undefined;
  if (typeof listTurns === "function") {
    try {
      return await readCompletedTurnUsageViaApi(pi);
    } catch (error) {
      // An older or momentarily unhappy host must never cost the panel its
      // PI-Desktop numbers, so the database read stays as a safety net.
      warnApiFallbackOnce(error);
    }
  }
  return readCompletedTurnUsageFromDb(hostRoot);
}

/** The largest window the contract accepts, so walks never exceed one window. */
const API_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
/** A window with no completed turns means everything older is done; 8 windows ≈ 8 years. */
const API_MAX_WINDOWS = 8;
/** The contract's page ceiling; the fewest round trips per window. */
const API_PAGE_LIMIT = 500;

let apiFallbackWarned = false;

function warnApiFallbackOnce(error) {
  if (apiFallbackWarned) return;
  apiFallbackWarned = true;
  try {
    console.warn(
      `[pi.token-insights] pi.usage.listTurns failed (${String(error?.message || error)}); reading the host database instead.`,
    );
  } catch {
    /* a broken console must not break the scan */
  }
}

/**
 * Walks completed turns backward through the official `pi.usage.listTurns`
 * contract: at most 365 days per window, every page of each window via the
 * keyset cursor, and the walk stops at the first window with no rows at all.
 * A `turnId` set dedupes across windows so a turn straddling a boundary can
 * never be counted twice. Returns the same `{ events, diagnostics }` shape as
 * the database reader, with `filesScanned` counting pages fetched.
 */
async function readCompletedTurnUsageViaApi(pi) {
  const result = {
    events: [],
    diagnostics: { sourceId: "pi-desktop", filesScanned: 0, filesSkipped: 0, malformedLines: 0, usageMessages: 0 },
  };
  const seenTurnIds = new Set();
  let toMs = Date.now();
  for (let windowIndex = 0; windowIndex < API_MAX_WINDOWS; windowIndex += 1) {
    // Inclusive endpoints, so the span stays within the contract's 365-day cap.
    const fromMs = toMs - API_WINDOW_MS + 1;
    let cursor = null;
    let rowsInWindow = 0;
    do {
      const input = { fromMs, toMs, limit: API_PAGE_LIMIT };
      // `cursor` is optional in the contract; a strict host may reject null.
      if (cursor) input.cursor = cursor;
      const page = await pi.usage.listTurns(input);
      result.diagnostics.filesScanned += 1;
      for (const row of page?.turns || []) {
        rowsInWindow += 1;
        const turnId = String(row?.turnId || "");
        if (turnId) {
          if (seenTurnIds.has(turnId)) continue;
          seenTurnIds.add(turnId);
        }
        const event = turnEventFromApiRow(row);
        if (!event) continue;
        result.events.push(event);
        result.diagnostics.usageMessages += 1;
      }
      cursor = page?.nextCursor || null;
    } while (cursor);
    if (rowsInWindow === 0) break;
    toMs = fromMs - 1;
  }
  return result;
}

/**
 * One contract row → the event shape the aggregator already consumes.
 * The contract carries no `total`, so it is the sum of the five components;
 * rows with no tokens at all are skipped, exactly like the database reader.
 */
function turnEventFromApiRow(row) {
  const n = (value) => {
    const parsedNumber = Number(value);
    return Number.isFinite(parsedNumber) ? Math.max(0, parsedNumber) : 0;
  };
  const input = n(row?.inputTokens);
  const output = n(row?.outputTokens);
  const cacheRead = n(row?.cacheReadTokens);
  const cacheWrite = n(row?.cacheWriteTokens);
  const reasoning = n(row?.reasoningTokens);
  if (!input && !output && !cacheRead && !cacheWrite && !reasoning) return null;
  const timestamp = Number(row?.endedAt);
  const sessionId = String(row?.sessionId || "").trim();
  if (!sessionId || !Number.isFinite(timestamp)) return null;
  return {
    sourceId: "pi-desktop",
    sessionId: `pi-desktop:${sessionId}`,
    timestamp,
    modelId: String(row.modelId || "Unknown model"),
    providerId: String(row.providerId || "Unknown provider"),
    tokens: {
      input,
      output,
      cacheRead,
      cacheWrite,
      reasoning,
      total: input + output + cacheRead + cacheWrite + reasoning,
    },
  };
}

/**
 * Completed-turn usage from the host database. Only token columns and ids;
 * no message text. Fallback for hosts without `pi.usage.listTurns` — the API
 * path is preferred because it also excludes soft-deleted sessions.
 */
function readCompletedTurnUsageFromDb(hostRoot) {
  const result = {
    events: [],
    diagnostics: { sourceId: "pi-desktop", filesScanned: 0, filesSkipped: 0, malformedLines: 0, usageMessages: 0 },
  };
  const dbFile = path.join(String(hostRoot || ""), "pi.sqlite");
  if (!existsSync(dbFile)) return result;
  const db = openHostDb(dbFile);
  if (!db) {
    result.diagnostics.filesSkipped += 1;
    return result;
  }
  try {
    const rows = db
      .prepare(
        `SELECT ended_at, input_tokens, output_tokens, usage_json, session_id, model_id, provider_id
         FROM turns
         WHERE status = 'completed' AND ended_at IS NOT NULL`,
      )
      .all();
    result.diagnostics.filesScanned += 1;
    for (const row of rows || []) {
      const tokens = tokensFromTurnRow(row);
      const timestamp = Number(row?.ended_at);
      const sessionId = String(row?.session_id || "").trim();
      if (!tokens || !sessionId || !Number.isFinite(timestamp)) continue;
      result.events.push({
        sourceId: "pi-desktop",
        sessionId: `pi-desktop:${sessionId}`,
        timestamp,
        modelId: String(row.model_id || "Unknown model"),
        providerId: String(row.provider_id || "Unknown provider"),
        tokens,
      });
      result.diagnostics.usageMessages += 1;
    }
  } catch {
    result.diagnostics.filesSkipped += 1;
  } finally {
    closeQuietly(db);
  }
  return result;
}

function tokensFromTurnRow(row) {
  let parsed = null;
  try {
    parsed = row?.usage_json ? JSON.parse(String(row.usage_json)) : null;
  } catch {
    parsed = null;
  }
  const object = parsed && typeof parsed === "object" ? parsed : {};
  const n = (value) => {
    const parsedNumber = Number(value);
    return Number.isFinite(parsedNumber) ? Math.max(0, parsedNumber) : 0;
  };
  const input = n(object.inputTokens ?? object.input_tokens ?? row?.input_tokens);
  const output = n(object.outputTokens ?? object.output_tokens ?? row?.output_tokens);
  const cacheRead = n(object.cacheReadTokens);
  const cacheWrite = n(object.cacheWriteTokens);
  const reasoning = n(object.reasoningTokens);
  const total = n(object.totalTokens) || input + output + cacheRead + cacheWrite + reasoning;
  if (!input && !output && !cacheRead && !cacheWrite && !reasoning && !total) return null;
  return { input, output, cacheRead, cacheWrite, reasoning, total };
}

module.exports = {
  hostRootFromDataPath,
  readCompletedTurnUsage,
  readCompletedTurnUsageFromDb,
  readCompletedTurnUsageViaApi,
  readHostAppearance,
  readProviderLabels,
  __test: {
    themeCssIsSafe,
    readSettingsViaScan,
    resolvePluginTheme,
    resetCache: () => {
      cache = null;
    },
  },
};
