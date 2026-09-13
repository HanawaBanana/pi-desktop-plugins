"use strict";

const MAX_PERSISTED_WORKERS = 256;
const MAX_TEXT_CHARS = 65_536;
const MAX_TITLE_CHARS = 160;
const MAX_ACCEPTANCE_NOTE_CHARS = 4_096;
const MAX_SUPERVISION_ROUNDS = 16;
const VALID_STATUSES = new Set([
  "created",
  "running",
  "waiting_permission",
  "completed",
  "failed",
  "cancelled",
]);
const ACTIVE_STATUSES = new Set(["created", "running", "waiting_permission"]);
const VALID_ACCEPTANCE_STATUSES = new Set(["pending", "accepted"]);

function boundedText(value, limit = MAX_TEXT_CHARS) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, limit);
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function normalizedSessionId(value) {
  const sessionId = boundedText(value.sessionId, 256);
  const legacySessionId = boundedText(value.workerSessionId, 256);
  if (sessionId && legacySessionId && sessionId !== legacySessionId) return "";
  return sessionId || legacySessionId;
}

function normalizeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const parentSessionId = boundedText(value.parentSessionId, 256);
  const sessionId = normalizedSessionId(value);
  const task = boundedText(value.task);
  const title = boundedText(value.title, MAX_TITLE_CHARS);
  const createdAt = validTimestamp(value.createdAt) ? value.createdAt : "";
  const status = VALID_STATUSES.has(value.status) ? value.status : "created";
  const round = Number.isInteger(value.round) && value.round >= 1 && value.round <= MAX_SUPERVISION_ROUNDS
    ? value.round
    : 1;
  const acceptanceStatus = VALID_ACCEPTANCE_STATUSES.has(value.acceptanceStatus)
    ? value.acceptanceStatus
    : "pending";

  if (!parentSessionId || !sessionId || !task || !title || !createdAt) return null;

  const normalized = {
    parentSessionId,
    sessionId,
    task,
    title,
    status,
    createdAt,
    round,
    acceptanceStatus,
  };

  if (validTimestamp(value.updatedAt)) normalized.updatedAt = value.updatedAt;
  if (typeof value.modelKey === "string" && value.modelKey.trim()) {
    normalized.modelKey = boundedText(value.modelKey, 512);
  }
  if (validTimestamp(value.promptedAt)) normalized.promptedAt = value.promptedAt;
  if (typeof value.turnId === "string" && value.turnId.trim()) {
    normalized.turnId = boundedText(value.turnId, 256);
  }
  if (typeof value.report === "string" && value.report.trim()) {
    normalized.report = boundedText(value.report, 12_000);
  }
  if (validTimestamp(value.acceptedAt) && acceptanceStatus === "accepted") {
    normalized.acceptedAt = value.acceptedAt;
  }
  if (
    typeof value.acceptanceNote === "string" &&
    value.acceptanceNote.trim() &&
    acceptanceStatus === "accepted"
  ) {
    normalized.acceptanceNote = boundedText(value.acceptanceNote, MAX_ACCEPTANCE_NOTE_CHARS);
  }
  if (
    Number.isInteger(value.acceptanceRound) &&
    value.acceptanceRound >= 1 &&
    value.acceptanceRound <= round &&
    acceptanceStatus === "accepted"
  ) {
    normalized.acceptanceRound = value.acceptanceRound;
  }
  if (typeof value.error === "string" && value.error.trim()) {
    normalized.error = boundedText(value.error, 2_000);
  }

  return normalized;
}

function cloneRecord(record) {
  return { ...record };
}

function retainRecords(values) {
  if (values.length <= MAX_PERSISTED_WORKERS) return values;

  const active = values.filter((record) => ACTIVE_STATUSES.has(record.status));
  const terminal = values.filter((record) => !ACTIVE_STATUSES.has(record.status));
  const terminalLimit = Math.max(0, MAX_PERSISTED_WORKERS - active.length);
  return [...terminal.slice(-terminalLimit), ...active];
}

/**
 * Relationship metadata is plugin-owned settings. Worker transcripts are not
 * mirrored here; they stay in the host's durable session store.
 */
async function createWorkerStore() {
  const settings = (await pi.plugin.getSettings()) || {};

  const records = new Map();
  const loaded = Array.isArray(settings.workers) ? settings.workers : [];
  let needsMigration = settings.version !== 2;
  for (const raw of loaded) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const record = normalizeRecord(raw);
    if (!record) continue;
    if (raw.sessionId !== record.sessionId || raw.workerSessionId !== undefined) {
      needsMigration = true;
    }
    records.set(record.sessionId, record);
  }

  let writeQueue = Promise.resolve();

  function snapshot() {
    return retainRecords([...records.values()]).map(cloneRecord);
  }

  function persist() {
    const payload = {
      version: 2,
      workers: snapshot(),
      workersUpdatedAt: Date.now(),
    };
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(() => pi.plugin.setSettings(payload));
    return writeQueue;
  }

  function prune() {
    while (records.size > MAX_PERSISTED_WORKERS) {
      const removable = [...records.values()].find(
        (record) => !ACTIVE_STATUSES.has(record.status),
      );
      const fallback = records.keys().next().value;
      const sessionId = removable?.sessionId ?? fallback;
      if (sessionId === undefined) break;
      records.delete(sessionId);
    }
  }

  function get(sessionId) {
    const record = records.get(String(sessionId || ""));
    return record ? cloneRecord(record) : null;
  }

  function all() {
    return snapshot();
  }

  function upsert(next) {
    const record = normalizeRecord(next);
    if (!record) throw new Error("invalid worker relationship");
    records.set(record.sessionId, record);
    prune();
    return persist();
  }

  function update(sessionId, patch) {
    const current = records.get(String(sessionId || ""));
    if (!current) return Promise.resolve();
    return upsert({
      ...current,
      ...patch,
      parentSessionId: current.parentSessionId,
      sessionId: current.sessionId,
      updatedAt: new Date().toISOString(),
    });
  }

  if (needsMigration) await persist();

  return {
    get,
    all,
    update,
    upsert,
    flush: () => writeQueue,
  };
}

module.exports = {
  ACTIVE_STATUSES,
  MAX_PERSISTED_WORKERS,
  MAX_ACCEPTANCE_NOTE_CHARS,
  MAX_TEXT_CHARS,
  MAX_SUPERVISION_ROUNDS,
  VALID_STATUSES,
  VALID_ACCEPTANCE_STATUSES,
  createWorkerStore,
  normalizeRecord,
};
