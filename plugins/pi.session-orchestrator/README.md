# Session Orchestrator

Session Orchestrator is the official PI-Desktop plugin for coordinating real
durable worker sessions from the current Agent.

## Agent Tool

The plugin registers one high-risk tool, `SessionTask`, with these actions:

- `spawn(task, title?, model?)` creates a new durable session and immediately
  starts its Agent.
- `send(sessionId, message)` continues the same durable worker session by its
  original PI-Desktop Session ID, so the child keeps its context.
- `supervise(sessionIds, message)` sends the next Parent feedback round to
  several existing workers in parallel without creating new sessions.
- `status(sessionIds?)` reads bounded live status.
- `wait(sessionIds, timeoutMs?)` polls lightweight status at low frequency with
  a 25-second default / 45-second maximum timeout and returns `timedOut` rather
  than waiting indefinitely.
- `result(sessionId)` returns only the worker's final report when available.
- `accept(sessionId|sessionIds, note?)` records explicit Parent acceptance only
  after the selected workers have completed with final reports.
- `cancel(sessionId)` aborts the active Agent and retains the session.
- `list()` lists workers created by the current Parent Session.

The returned `sessionId` is the real durable Session ID from `session/create`.
There is no second Work ID. The 0.2.x `workerId` / `workerIds` inputs remain
accepted as compatibility aliases, but new callers should always pass
`sessionId` / `sessionIds`.

The intended supervised flow is:

1. Call `spawn` several times without awaiting each result; retain each
   returned `sessionId`.
2. Call `wait` and `result`, then review the reports in the Parent against the
   acceptance criteria.
3. If a report needs more investigation, call `send` with the same `sessionId`
   for one worker or `supervise` with the same `sessionIds` for a shared
   feedback round. Both continue the same durable sessions and advance their
   persisted round number; they do not create replacement sessions.
4. Repeat `wait` → `result` → Parent review for as many rounds as needed,
   within the bounded sixteen-round limit.
5. Call `accept` only after the Parent has verified the final reports. An
   accepted worker becomes pending again automatically when it receives new
   feedback.

The plugin does not copy a worker transcript into the Parent context; only
bounded final reports and acceptance metadata are returned.

## Safety and boundaries

- Every worker is created with reviewed `desktop.control` operations:
  `session/get`, `session/create`, `agent/prompt`,
  `agent/getStatus`, and `agent/abort`.
- The create request carries `inheritPermissionFromSessionId`. The host binds
  that id to the current Agent tool session and returns the inherited
  permission mode before the worker is prompted. If an older host ignores that
  field for a Parent with an explicit permission mode, the plugin fails closed
  and records the unprompted worker as failed.
- Workers inherit the Parent project, provider/model, and thinking level. An
  explicitly requested model must be present in the host's public
  `models.list` result.
- Parent/worker relationships are stored in the plugin's private settings as
  bounded `workers` records. They include the current supervision round and
  explicit Parent acceptance marker. They are restored after plugin or app
  restart; the durable worker transcript remains in PI-Desktop's normal
  session store.
- A Parent can control only Session IDs recorded under that Parent. A worker
  cannot create or control another worker. The limits are four active workers
  per Parent, sixteen active workers across the plugin, and sixteen workers per
  wait call.
- `cancel` uses `agent/abort` and never deletes a durable session.
- No localhost MCP HTTP calls, MCP bearer tokens, network access, transcript
  copying, session forks, session deletion, message bus, or second session
  database are used.
- The tool is high-risk and remains subject to PI-Desktop's normal tool policy.
  The plugin does not set `confirm` or bypass native permission confirmation.

## Capability matrix

| Surface | Data read or written | Boundary and user confirmation |
| --- | --- | --- |
| `desktop.control` | Parent/session metadata, worker creation, Agent status, prompts and aborts | Only reviewed catalog operations are reachable; the install grant and the host's normal Agent policy remain in force. The plugin never invokes dangerous `session/delete` or `session/configure`. |
| `models.list` | Public provider/model identifiers only | No credentials or transcript content are returned. An explicit `model` must match this list. |
| `ui.panel` | Plugin-owned worker summaries | The panel uses `pluginBridge`, escapes untrusted labels/tasks, and only exposes Stop/Open actions for persisted Session IDs. |
| Plugin settings | `parentSessionId`, real `sessionId`, task, status, timestamps and bounded final report | Stored in the plugin-private settings namespace; worker transcript content is never copied into it. 0.2.x `workerSessionId` records are migrated on load. |

The high-risk desktop surface is intentionally narrow: `spawn`, `send`,
`supervise`, `status`, `wait`, `result`, `accept`, `cancel` and `list` are the
only operations exposed by `SessionTask`. `accept` only writes plugin-private
metadata; it does not alter the worker session or claim that the work is
correct without an explicit Parent decision.

## Agents panel

The isolated Agents panel restores the persisted worker list, refreshes only
lightweight live status every five seconds, and offers Open Session and Stop
actions. It never fetches full reports during the background refresh. Open Session uses the optional
reviewed `session/open` host operation; on an older host the panel reports a
clear unsupported error and leaves the worker available in the normal session
list.

## Host compatibility

Version 0.3.0 targets PI-Desktop hosts that expose the reviewed
`desktop.control` catalog and the additive
`inheritPermissionFromSessionId` / `session/open` host capabilities. The
plugin still uses only the stable SDK gateway, so no MCP token or private
Electron channel is required.

The corresponding PI-Desktop host change is additive: it adds the reviewed
`session/open` navigation operation, carries a `source: "plugin"` marker so
background worker prompts do not steal the Parent view, and lets
`session/create` resolve the parent's persisted permission mode atomically.
It does not add a Session database schema, change the existing Task/Subagent
runtime, or introduce a second session system.
