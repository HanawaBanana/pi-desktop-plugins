"use strict";

const {
  ACTIVE_STATUSES,
  MAX_ACCEPTANCE_NOTE_CHARS,
  MAX_WORKERS_PER_PARENT,
  POLL_INTERVAL_MS,
  TERMINAL_STATUSES,
  assertOrchestratorSession,
  desktop,
  desktopOperations,
  getSession,
  getWorkerStore,
  sessionIdsFromArgs,
  nextSupervisionRound,
  now,
  parentIdFromContext,
  permissionInheritanceError,
  publicWorker,
  recordForParent,
  recordsForParent,
  refreshRecord,
  refreshRecords,
  releaseSpawn,
  reserveSpawn,
  resolveModel,
  resolveThinkingLevel,
  sendToWorker,
  sessionFromResponse,
  shorten,
  sleepWithSignal,
  taskError,
  text,
  optionalText,
  withWorkerLock,
  targetSessionId,
  waitTimeout,
} = require("./runtime.js");

const MAX_TASK_CHARS = 65_536;
const MAX_TITLE_CHARS = 80;
const MAX_MESSAGE_CHARS = 65_536;

function errorMessage(error) {
  return shorten(error?.message ?? String(error), 2_000);
}

function workerPrompt(task) {
  return [
    "You are a PI-Desktop worker session managed by a parent Agent.",
    "Complete the task below using this session only.",
    "Do not create or control other sessions, and do not invoke SessionTask.",
    "If a later follow-up needs more research, continue from this session's existing context; do not create a replacement session.",
    "Return a concise final report with findings, changed files, and verification when relevant.",
    "",
    "Task:",
    task,
  ].join("\n");
}

async function spawnWorker(args, ctx) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const task = text(args.task, "task", MAX_TASK_CHARS);
  const title = optionalText(args.title, "title", MAX_TITLE_CHARS) || shorten(task, MAX_TITLE_CHARS);

  reserveSpawn(parentSessionId);
  let record = null;
  try {
    const parentSession = await getSession(parentSessionId, 1, 4_096);
    const model = await resolveModel(args.model, parentSession, ctx);
    const thinkingLevel = resolveThinkingLevel(parentSession, ctx);
    const input = {
      title,
      mode: "agent",
      inheritPermissionFromSessionId: parentSessionId,
      ...(typeof parentSession.projectPath === "string" && parentSession.projectPath.trim()
        ? { projectPath: parentSession.projectPath.trim() }
        : {}),
      ...(model.providerId ? { providerId: model.providerId } : {}),
      ...(model.modelId ? { modelId: model.modelId } : {}),
      ...(thinkingLevel ? { thinkingLevel } : {}),
    };

    const created = sessionFromResponse(
      await desktop("session/create", [input]),
      "session/create",
    );
    record = {
      parentSessionId,
      sessionId: created.id,
      task,
      title,
      status: "created",
      createdAt: now(),
      ...(model.modelKey ? { modelKey: model.modelKey } : {}),
    };
    await getWorkerStore().upsert(record);

    try {
      const result = await withWorkerLock(record.sessionId, async () => {
        const latest = getWorkerStore().get(record.sessionId) ?? record;
        if (TERMINAL_STATUSES.has(latest.status)) {
          throw taskError("ABORTED", "worker was stopped before its first prompt");
        }
        const inheritanceError = permissionInheritanceError(parentSession, created);
        if (inheritanceError) {
          await getWorkerStore().update(record.sessionId, {
            status: "failed",
            error: errorMessage(inheritanceError),
          });
          throw inheritanceError;
        }
        return sendToWorker(
          latest,
          workerPrompt(task),
          parentSessionId,
        );
      });
      return {
        action: "spawn",
        sessionId: created.id,
        title,
        status: "running",
        ...result,
      };
    } catch (error) {
      await getWorkerStore().update(record.sessionId, {
        status: "failed",
        error: errorMessage(error),
      });
      throw error;
    }
  } finally {
    releaseSpawn(parentSessionId);
  }
}

async function sendWorker(args, ctx, { preflight = true } = {}) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const id = targetSessionId(args);
  const message = text(args.message, "message", MAX_MESSAGE_CHARS);

  return withWorkerLock(id, async () => {
    const record = recordForParent(parentSessionId, id);
    const stored = getWorkerStore().get(id) ?? record;
    const current = preflight ? await refreshRecord(stored, false) : stored;
    if (ACTIVE_STATUSES.has(current.status)) {
      throw taskError("AGENT_BUSY", "worker is still active");
    }

    reserveSpawn(parentSessionId);
    try {
      const round = nextSupervisionRound(current);
      return {
        action: "send",
        ...(await sendToWorker(current, message, parentSessionId, round)),
      };
    } finally {
      releaseSpawn(parentSessionId);
    }
  });
}

async function superviseWorkers(args, ctx) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const ids = sessionIdsFromArgs(args, true);
  if (ids.length > MAX_WORKERS_PER_PARENT) {
    throw taskError(
      "LIMIT_EXCEEDED",
      `at most ${MAX_WORKERS_PER_PARENT} workers may receive one supervision round`,
    );
  }
  const message = text(args.message, "message", MAX_MESSAGE_CHARS);
  const records = recordsForParent(parentSessionId, ids);
  const refreshed = await refreshRecords(records, false);
  const busy = refreshed.filter((record) => ACTIVE_STATUSES.has(record.status));
  if (busy.length > 0) {
    throw taskError(
      "AGENT_BUSY",
      `workers are still active: ${busy.map((record) => record.sessionId).join(", ")}`,
    );
  }

  const workers = await Promise.all(
    ids.map((id) => sendWorker({ sessionId: id, message }, ctx, { preflight: false })),
  );
  return {
    action: "supervise",
    workers: workers.map(({ action, ...worker }) => worker),
  };
}

function acceptanceSessionIds(args) {
  if (args.sessionIds !== undefined || args.workerIds !== undefined) {
    return sessionIdsFromArgs(args, true);
  }
  if (args.sessionId !== undefined || args.workerId !== undefined) return [targetSessionId(args)];
  throw taskError("INVALID_ARGUMENT", "accept requires sessionId or sessionIds");
}

async function acceptWorkers(args, ctx) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const ids = acceptanceSessionIds(args);
  const note = optionalText(
    args.note,
    "note",
    MAX_ACCEPTANCE_NOTE_CHARS,
  );
  const records = recordsForParent(parentSessionId, ids);
  const refreshed = await refreshRecords(records, true);
  const notReady = refreshed.filter(
    (record) => record.status !== "completed" || !record.report,
  );
  if (notReady.length > 0) {
    throw taskError(
      "WORKER_NOT_READY",
      `workers must have a completed final report before acceptance: ${notReady
        .map((record) => `${record.sessionId} (${record.status})`)
        .join(", ")}`,
    );
  }

  const acceptedAt = now();
  await Promise.all(
    refreshed.map((record) =>
      getWorkerStore().update(record.sessionId, {
        acceptanceStatus: "accepted",
        acceptedAt,
        acceptanceRound: record.round,
        ...(note ? { acceptanceNote: note } : {}),
      }),
    ),
  );
  const accepted = ids
    .map((id) => getWorkerStore().get(id))
    .filter(Boolean);
  return {
    action: "accept",
    accepted: true,
    workers: accepted.map((record) => publicWorker(record, true)),
  };
}

async function statusWorkers(args, ctx) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const ids = sessionIdsFromArgs(args);
  const records = recordsForParent(parentSessionId, ids);
  const refreshed = await refreshRecords(records, false);
  return {
    action: "status",
    workers: refreshed.map((record) => publicWorker(record, false)),
  };
}

async function waitWorkers(args, ctx) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const ids = sessionIdsFromArgs(args, true);
  const timeoutMs = waitTimeout(args.timeoutMs);
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (ctx?.signal?.aborted) {
      throw taskError("ABORTED", "wait was cancelled");
    }

    const records = recordsForParent(parentSessionId, ids);
    const refreshed = await refreshRecords(records, false);
    if (refreshed.every((record) => TERMINAL_STATUSES.has(record.status))) {
      const withReports = await refreshRecords(refreshed, true);
      return {
        action: "wait",
        timedOut: false,
        workers: withReports.map((record) => publicWorker(record, true)),
      };
    }

    if (Date.now() >= deadline) {
      return {
        action: "wait",
        timedOut: true,
        workers: refreshed.map((record) => publicWorker(record, false)),
      };
    }

    await sleepWithSignal(
      Math.min(POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())),
      ctx?.signal,
    );
  }
}

async function resultWorker(args, ctx) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const id = targetSessionId(args);

  return withWorkerLock(id, async () => {
    const record = recordForParent(parentSessionId, id);
    const refreshed = await refreshRecord(record, true);
    return {
      action: "result",
      ready: refreshed.status === "completed",
      worker: publicWorker(refreshed, true),
    };
  });
}

async function cancelWorker(args, ctx) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const id = targetSessionId(args);

  return withWorkerLock(id, async () => {
    const record = recordForParent(parentSessionId, id);
    const current = await refreshRecord(record, false);
    if (TERMINAL_STATUSES.has(current.status)) {
      return {
        action: "cancel",
        worker: publicWorker(current, false),
        sessionRetained: true,
      };
    }

    if (ACTIVE_STATUSES.has(current.status)) {
      await desktop("agent/abort", [{ sessionId: current.sessionId }]);
    }

    const cancelled = {
      ...current,
      status: "cancelled",
      error: undefined,
    };
    await getWorkerStore().upsert(cancelled);
    return {
      action: "cancel",
      worker: publicWorker(cancelled, false),
      sessionRetained: true,
    };
  });
}

async function listWorkers(args, ctx) {
  const parentSessionId = parentIdFromContext(ctx);
  assertOrchestratorSession(parentSessionId);
  const records = recordsForParent(parentSessionId);
  const refreshed = await refreshRecords(records, false);
  return {
    action: "list",
    workers: refreshed.map((record) => publicWorker(record, false)),
  };
}

async function executeSessionTask(args, ctx) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw taskError("INVALID_ARGUMENT", "SessionTask arguments must be an object");
  }
  const action = text(args.action, "action", 32);
  switch (action) {
    case "spawn":
      return spawnWorker(args, ctx);
    case "send":
      return sendWorker(args, ctx);
    case "supervise":
      return superviseWorkers(args, ctx);
    case "status":
      return statusWorkers(args, ctx);
    case "wait":
      return waitWorkers(args, ctx);
    case "result":
      return resultWorker(args, ctx);
    case "accept":
      return acceptWorkers(args, ctx);
    case "cancel":
      return cancelWorker(args, ctx);
    case "list":
      return listWorkers(args, ctx);
    default:
      throw taskError("INVALID_ARGUMENT", `unsupported SessionTask action: ${action}`);
  }
}

function panelRecord(id) {
  const record = getWorkerStore().get(targetSessionId(id));
  if (!record) throw taskError("NOT_FOUND", "worker not found");
  return record;
}

async function panelList() {
  const records = await refreshRecords(getWorkerStore().all(), false);
  return {
    workers: records
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map((record) => publicWorker(record, false)),
  };
}

async function panelCancel(payload) {
  const id = targetSessionId(payload);
  return withWorkerLock(id, async () => {
    const record = panelRecord(id);
    const current = await refreshRecord(record, false);
    if (TERMINAL_STATUSES.has(current.status)) {
      return {
        ok: true,
        worker: publicWorker(current, false),
        sessionRetained: true,
      };
    }
    if (ACTIVE_STATUSES.has(current.status)) {
      await desktop("agent/abort", [{ sessionId: current.sessionId }]);
    }
    const cancelled = {
      ...current,
      status: "cancelled",
      error: undefined,
    };
    await getWorkerStore().upsert(cancelled);
    return {
      ok: true,
      worker: publicWorker(cancelled, false),
      sessionRetained: true,
    };
  });
}

async function panelOpen(payload) {
  const record = panelRecord(payload);
  const operations = await desktopOperations();
  if (!operations.some((operation) => operation.id === "session/open")) {
    throw taskError(
      "UNSUPPORTED",
      "this PI-Desktop host cannot open a session from a plugin panel; update the host or use the session list",
    );
  }
  await desktop("session/open", [record.sessionId]);
  return { ok: true, sessionId: record.sessionId };
}

module.exports = {
  executeSessionTask,
  panelCancel,
  panelList,
  panelOpen,
  __test: {
    executeSessionTask,
    permissionInheritanceError,
    workerPrompt,
  },
};
