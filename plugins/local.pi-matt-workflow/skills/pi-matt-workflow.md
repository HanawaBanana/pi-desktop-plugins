---
name: pi-matt-workflow
description: PI-native entry gate for the bundled Matt Pocock Skills. Use only for an explicitly named software project when the user asks to set up, plan, implement, test, debug, review, or continue a Matt-governed project.
---

# PI Matt Workflow

This skill is the PI compatibility layer for the bundled upstream Matt Pocock Skills. It contains no Basic Memory, media generation, image style library, Context7, Archify implementation, or third-party project administration capability. Load those independent Skills only when their own task trigger applies.

## Classify Before Project Access

Do not enter the Matt workflow for a general question, explanation, comparison, supplied-file summary, or bounded external research. A workspace path, a technical term, `AGENTS.md`, `workflow-state.md`, or "continue" alone is not enough.

Enter this workflow only when the user explicitly requests work on a named project: setup, planning, implementation, modification, debugging, testing, running, review, or a governed continuation. Use the user-named project as the sole boundary. Do not scan a home directory, other projects, conversation history, or global configuration to infer context.

## PI Project Gate

1. Read the project's `AGENTS.md` if present. Locate the current Matt configuration, task root, and project state through project files, not chat history.
2. If the project uses the external Matt governance contract, treat `workflow-state.md` as its only mutable phase, approval, execution-authority, host, model, and unique-writer record. `execution-handoff.md` is an approved task contract, never a second live status source.
3. Remain read-only for code, tests, dependencies, build configuration, and services until the project state explicitly establishes approved scope, `execution_authorized: true`, compatible host, and one unambiguous code writer.
4. Use the applicable upstream Skill from this plugin only after the appropriate gate: `setup-matt-pocock-skills`, `grill-with-docs`, `to-spec`, `to-tickets`, `implement`, `tdd`, `code-review`, and the other original Skills remain separate, composable entries.
5. Put Matt documents where the project tracker or existing configuration specifies. Do not create a parallel `.vibe`, `.trellis`, or root-level status tree.
6. Material changes to requirements, specification, design, tasks, acceptance conditions, host, writer, or baseline invalidate affected approval and return to the earliest relevant gate.

## PI Compatibility Overrides

The copied upstream Skills are source-faithful where PI supports their behavior. Product-specific slash commands, Claude/Codex metadata, unavailable tracker CLIs, and unavailable MCPs must not be claimed as available. Use PI's native Skills, Plan mode, Goal mode, Task subagents, browser tools, and file tools only when actually exposed in the current session.

The upstream `implement` Skill recommends committing after review. In this PI workflow, Git initialization, branch creation, committing, pushing, installing dependencies, starting services, deployment, and destructive commands remain separate user or approved-project authorizations. Never let an upstream local default bypass the project gate.

For complex approved work, PI Goal mode and a Goal/DAG overlay may express dependencies, runnable frontier, evidence, verification, and stop criteria inside the existing task root. They do not create a second state source or confer write authority.

## Upstream Source

- Source: `https://github.com/mattpocock/skills`
- Pinned audit commit: `959a8e9f1edc3adbe2f7e3054bb6fbefa6696260`
- License: MIT, preserved in `THIRD_PARTY_LICENSE_MATT.txt`.

Use the upstream Skills as composable practices. Do not invoke the whole bundle for an ordinary question.
