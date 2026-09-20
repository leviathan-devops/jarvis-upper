# 01-DISCOVERY — Jarvis Upper Tier (measured 2026-09-19)

Everything below was read/executed this session. Grades: [D] byte-verified,
[L] live-measured, [I] inferred from observations, [P] proposed.

## 1. THE AO INTEGRATION SURFACE (mission item 1 — SOLVED by discovery)

**The "SDK" is: the OpenAPI-spec'd local daemon REST API + SSE event
stream + the `ao` CLI as thin client. There is NO separate SDK package,
NO plugin config surface for external tools, NO webhook/notifier system.**

### 1.1 The machine-readable contract layer [D]
Source: `docs/documentation-map.md` @ repo main + fetched artifacts.

| Artifact | Role | Drift gate |
|---|---|---|
| `backend/internal/httpd/apispec/openapi.yaml` | THE daemon HTTP API contract: routes, request/response shapes, errors | `TestBuild_MatchesEmbedded` + `TestRouteSpecParity` (go test) |
| `frontend/src/api/schema.ts` | typed client generated FROM openapi via `npm run api:ts` | `api-drift` CI job fails on git diff |
| `AGENTS.md` (repo root) | agent operating contract: repo layout, commands, hard rules, PR hygiene | tests enforce named rules |
| `backend/internal/skillassets/using-ao/` | `ao` CLI skill catalog embedded in daemon, installed into agent workspaces | frontmatter YAML tests |
| `ao <cmd> --help` | authoritative flag list (Cobra) | CLI table tests |

Contract law (their words): "if an artifact in the contract layer
disagrees with prose, the contract layer wins". We consume the contract
layer, not the prose.

### 1.2 The API surface — 144 routes [D: /tmp/ao-openapi.yaml, 12,809L]

Route families (grep-counted):
- **sessions** (~60): spawn (`POST /api/v1/sessions`), send, steer,
  steer-or-send, interrupt, kill, restore, resume-agent, exit-agent,
  rollback, pin, merge-policy, pr/claim, reviews/* (trigger, submit,
  cancel, kill, rerequest, restore, switch, comments/resolve),
  conversation/* (turns edit/retry/rollback/steer/queue, approvals
  resolve, inputs resolve, compact, skills, models, settings),
  **workspace/*** (files, tree, file, file/blob, file/revision, diffs,
  search, **events**), agent-switches (+handoff/recover),
  interface-transition, attachments, activity, preview/*
- **events**: `GET /api/v1/events` — SSE, `streamEvents`, with `after`
  cursor replay + Last-Event-ID [D] → durable, resumable event rail
- **projects**: CRUD, config, permissions, initialize, clone/prepare,
  import-projects, imports/{validate,prepare-git}
- **prs**: merge, resolve-comments (explicit-only, confirmed)
- **orchestrators**: list/get + **`/api/v1/orchestrators/delegate`**
  (unexplored — read during spec)
- **notifications**: list, mark, read-all, **stream**
- **agents**: readiness, install-jobs, per-agent auth/models/probe
- **browser**, **shell-terminals**, **mobile**, **usage**, **settings**,
  **identity**, **endpoints**, **dev/import-projects**

### 1.3 What does NOT exist (measured, do not hunt again) [D]
- NO webhook/notifier config: "AO does not currently configure Slack,
  Discord, webhook notifiers, per-reaction retry budgets, or automatic
  merge from project config" (lifecycle-automation doc)
- NO `reactions:` YAML schema (retired implementation)
- NO hosted API: "AO's primary daemon listener is loopback-only. Do not
  treat this website as an API endpoint" (agents.md)
- NO daemon plugin system for external tool attach (plugins docs =
  compiled-in adapters only)
- NO cross-PR dependency tracking (pr table has no depends_on — prior
  manual §4)

### 1.4 The integration verdict [I→spec]
The upper tier wires AO via a **typed adapter over the REST API + SSE**,
cursor-persisted. agents.md's own rule: "The CLI is a thin client of the
local daemon; do not bypass it by reading AO's SQLite state directly" —
so the adapter REST-first, SQLite only as offline forensics. This answers
mission Q1: **yes, REST+SSE is the SDK**; no orca-terminal attach needed.

## 2. AO GIT MANAGEMENT (mission item — measured earlier + confirmed)

From AO_OPERATORS_MANUAL (JARVIS_WORKSPACE/reports/) + live ao.db:
- Worktree/branch per session: `ao/<id>/root` under ~/.ao/data/worktrees
- PR claim: 1 active session per PR (`claim-pr`, --no-takeover)
- SCM observer polls GitHub (ETag + semantic_diff), derives
  ci_failed/changes_requested/ready_to_merge; routes fingerprinted
  recovery messages to owning session → that IS the auto-fix loop
- Merge: always explicit `ao pr merge` (+ API route)
- `workspace/diffs`, `workspace/file/revision`, `workspace/events` routes
  expose the git substrate programmatically [D]
- Commit→session→worker attribution primitives: sessions.branch +
  session_worktrees (repo_name, branch, base_sha, head) + pr table
  (session_id, head_sha, source/target branch) [D: schema map]

## 3. LOCAL MACHINERY INVENTORY (the upper tier's parts bin)

### 3.1 Thanatos (the auditor) [D: git log]
- `Shared_Workspace/Thanatos/` — src (identity/warhead.port.ts + …),
  specs, scripts, tests, BUILD_REPORT/DEBUG_LOG
- HEAD: `2860a00` "boundary round 1 recorded: checks run, fixes routed
  per lock, bun resolver bug filed" — **fixes routed per lock** already
  exists in Thanatos's design (the bug-kick concept has a precedent)
- Full source inventory NOT yet read (Step 4 blueprint will read it)

### 3.2 Jarvis_Git_Manager (the lifecycle-controls precursor) [D: dir]
- GATE_RULES_SPEC.md, SCOPE-jgm-{actions,daemon,fix}.md,
  MASTER_PROMPT{_DAEMON}.md — git status/health/plan-clean JSON, daemon
  tick, commit-cone, spawn-worker/bind layout (per skill catalog)
- The git-lifecycle-controls builds ON this lineage, not from scratch

### 3.3 JARVIS kernel (dispatch core, stays) [D: ls]
- src/: desk-orchestrator, completion-gate, fleet, git-plane, health,
  hard-steer, attach, discord-transport, go-key-pool, …
- git-plane.ts already exists (kernel git surface)

### 3.4 foreman (supervisor, stays) [D]
- workers/{omp,codex,codex_app_server,simulation}.py — the patch intact
- Repurposed: supervises phase-2 macro agents (per mission)

### 3.5 Omp_Context_Manager (librarian candidate) [D]
- context_management/ + src + specs — canon-doc machinery (the
  "librarian/context synthesis" pipeline has a substrate)

### 3.6 fence2 + verdicts.jsonl [D] — phase-2 completion gate, intact

### 3.7 AO state right now [L]
- v0.13.0 fresh, daemon :3001 healthz ok, 2 projects
  (jarvis_orchestrator omp/omp bypass×3, scratch), bypass-permissions
  + omp tools.approvalMode=yolo, cursor 3.21.13 installed, `jarvis`
  launcher live, import validated 12/12 (Shared_Workspace)

## 4. VARIANT TABLE (lineage for the lifecycle controls)

| Variant | What it has | Verdict |
|---|---|---|
| JGM (Jarvis_Git_Manager) | git status/health JSON, daemon tick, gate rules, commit-cone, worker-bind | **winner for git-plane lineage** — extend |
| kernel git-plane.ts | in-kernel git surface | merge point |
| AO session_worktrees/pr tables | authoritative session↔branch↔PR↔sha mapping | source of truth, read via API |
| Orca orchestration protocol (run/task/dispatch/mail) | DAG + fencing + typed mail [D: orca-docs reference] | **shape donor** for upper graph/comms semantics; not a runtime dependency |
| foreman events.jsonl | supervision timeline | phase-2 side only |
| tracker.sqlite (desks) | dispatch rows | phase-2 desks; factory rows now live in AO |

Fork point: none of these implement depends_on/merge-sequencing or
bug→commit attribution. That is the NEW build.

## 5. WHAT I DID NOT READ (honest)

- Thanatos src/ internals (deferred to blueprint Step 4)
- /api/v1/orchestrators/delegate route body (spec step will extract)
- openapi.yaml schemas beyond route names (adapter authoring reads them)
- Omp_Context_Manager src/ (librarian pipeline design reads it)
- JGM SCOPE/GATE_RULES bodies (control-layer spec reads them)
- The 5 deep-research skill internals (pipeline spec references, not
  forks)

## 6. DISCOVERY→SPEC HANDOFF (the four systems, now grounded)

1. **AO adapter** = REST+SSE typed client, cursor-persisted, REST-first
   (agents.md law). Surface: 144 routes; rail = /api/v1/events (after
   cursor); actions = sessions/send/steer/reviews/prs/orchestrators.
2. **Hardening factory** = foreman'd OMP macro agents consuming minted
   PRs (via adapter) → ship-package assembly → hardening waves →
   Thanatos deep review → bug flags.
3. **Git-lifecycle controls** = graph store (pr_node/depends_on/state + edges) +
   merge sequencer (orders explicit `ao pr merge` calls) + filepath
   addressability (AO workspace routes) + guardrails (gates before
   merge-order eligibility).
4. **Git-bug-graph** = bug record → blame/bisect → origin commit →
   session (via AO tables) → worker; kick rails: live-session send
   (steer-or-send route) OR fix-worker spawn citing the commit; both
   decision-selectable; confidence-graded edges + triage queue for
   ambiguity.
