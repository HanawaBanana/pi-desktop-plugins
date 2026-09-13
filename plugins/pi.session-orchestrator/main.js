"use strict";

const { createWorkerStore } = require("./state.js");
const {
  configureWorkerRuntime,
  resetWorkerRuntime,
  taskError,
} = require("./runtime.js");
const {
  executeSessionTask,
  panelCancel,
  panelList,
  panelOpen,
} = require("./actions.js");

const COMMAND_ID = "pi.session-orchestrator.open";
const TOOL_NAME = "SessionTask";

const TOOL_DEFINITION = {
  name: TOOL_NAME,
  description:
    "Create and coordinate bounded real PI-Desktop worker sessions. Each worker is addressed by its original durable sessionId. Start independent work with spawn in parallel, then status/wait/result. Evaluate reports in the Parent; use supervise for one feedback round across several existing sessions or send for one session, repeating wait/result as needed. Call accept only after the Parent verifies the final reports against its acceptance criteria. Follow-up rounds continue the same durable sessions and never create replacements; cancel aborts without deleting. Workers are parent-scoped, capped, one level deep, and return only final reports. wait is bounded and returns timedOut so it never waits indefinitely.",
  risk: "high",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      action: {
        type: "string",
        enum: [
          "spawn",
          "send",
          "supervise",
          "status",
          "wait",
          "result",
          "accept",
          "cancel",
          "list",
        ],
      },
      task: {
        type: "string",
        maxLength: 65_536,
        description: "Task for spawn.",
      },
      title: {
        type: "string",
        maxLength: 80,
        description: "Short worker session title for spawn.",
      },
      model: {
        type: "string",
        maxLength: 512,
        description: "Optional configured provider/model key.",
      },
      sessionId: {
        type: "string",
        maxLength: 256,
        description: "Original durable Session ID of a Worker created by this Parent.",
      },
      sessionIds: {
        type: "array",
        maxItems: 16,
        items: { type: "string", maxLength: 256 },
        description: "Original durable Session IDs for status, wait, supervise or accept.",
      },
      workerId: {
        type: "string",
        maxLength: 256,
        description: "Deprecated compatibility alias for sessionId.",
      },
      workerIds: {
        type: "array",
        maxItems: 16,
        items: { type: "string", maxLength: 256 },
        description: "Deprecated compatibility alias for sessionIds.",
      },
      message: {
        type: "string",
        maxLength: 65_536,
        description: "Follow-up or supervision feedback for send/supervise.",
      },
      note: {
        type: "string",
        maxLength: 4_096,
        description: "Optional Parent acceptance note for accept.",
      },
      timeoutMs: {
        type: "integer",
        minimum: 1,
        maximum: 45000,
        description: "Optional wait timeout in milliseconds; default 25000, maximum 45000.",
      },
    },
    required: ["action"],
  },
  execute: executeSessionTask,
};
const COMMAND_DEFINITION = {
  id: COMMAND_ID,
  title: "Session Orchestrator: Open Agents",
  keywords: ["agent", "worker", "session", "orchestrator", "agents"],
  category: "Agent",
  run: async () => {
    await pi.ui.openPanel();
  },
};

let workerStore;
let loaded = false;

async function onLoad() {
  const store = await createWorkerStore();
  workerStore = store;
  configureWorkerRuntime(store);

  try {
    await pi.commands.register(COMMAND_DEFINITION);
    await pi.agent.registerTool(TOOL_DEFINITION);
    loaded = true;
  } catch (error) {
    await pi.commands.unregister(COMMAND_ID).catch(() => undefined);
    await store.flush().catch(() => undefined);
    resetWorkerRuntime();
    workerStore = undefined;
    throw error;
  }
}

async function onUnload() {
  loaded = false;
  const store = workerStore;
  workerStore = undefined;
  try {
    await pi.agent.unregisterTool(TOOL_NAME).catch(() => undefined);
    await pi.commands.unregister(COMMAND_ID).catch(() => undefined);
    if (store) await store.flush();
  } finally {
    resetWorkerRuntime();
  }
}

async function onPanelInvoke(channel, payload) {
  if (!loaded || !workerStore) {
    throw taskError("NOT_FOUND", "Session Orchestrator is not loaded");
  }

  switch (channel) {
    case "workers.list":
      return panelList();
    case "workers.cancel":
      return panelCancel(payload);
    case "workers.open":
      return panelOpen(payload);
    default:
      throw taskError("UNSUPPORTED", `unsupported panel channel: ${channel}`);
  }
}

module.exports = {
  onLoad,
  onUnload,
  onPanelInvoke,
  __test: {
    COMMAND_DEFINITION,
    TOOL_DEFINITION,
  },
};
