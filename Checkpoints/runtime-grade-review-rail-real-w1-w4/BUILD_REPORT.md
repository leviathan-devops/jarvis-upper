# BUILD_REPORT — jarvis-upper (append-only; created 2026-09-20)

## 2026-09-20 — jarvis-upper v0.1: the control-layer LIBRARY (not a system)

**The built:** 11 TypeScript modules (993 lines: store, cli, sync, reducers,
plan, guardrail, graph, attribute, kick, dossier, desks, execute, ao-client
{gen, client, rail}), 11 test files (613 lines, 32 tests), 4 desk contracts,
a pinned OpenAPI copy (144 paths/164 ops/269 schemas, sha 9ccd0e5d08702b9f),
and a SQLite store with 6 tables.

**The why:** operator mission (packages/jarvis-upper-tier/00-MISSION.md):
wire AO into the upper Jarvis levels without a terminal attach; build the
lifecycle controls as graph + comms + filepaths + guardrails; map bugs to
origin commits and kick them down to the factory.

**The how:** pure callables with injected dependencies (deterministic, no LLM
imports, REST-first), verified by fixture tests; the fence2 adjudicator run as
a real subprocess for the assembly gate; all external effects stubbed at the
boundary (MergeAdapter, KickDeps, EventRail chunk sources).

**The evidence:** `bun test` → 32 pass / 0 fail / 106 expects (EXIT=0);
`bunx tsc --noEmit` → EXIT=0; fence2 ledger PASS row
`8358f448f74a9171|sandbox=bwrap|spec_bound:true`; openapi sha
9ccd0e5d08702b9f against pin.json (144/164/269).

**The verification:** the battery + tsc + ledger pasted in TESTING_LOG (this
session); the adversarial probes A1-A4 pasted in TESTING_LOG (this session).

**The honest notes (the part v1 and v2 of the engineering report got wrong):**
- This is a LIBRARY, not a running system. No entry point (`src/main.ts`,
  `src/runtime.ts` absent), no loop (0 `setInterval`/`while(true)`), 2 of 9
  spec CLI verbs, `client.ts` orphaned (0 callers) and BROKEN on first call
  (EN-001), the rail never fed live bytes (EN-002), the pre-written DT1-DT3
  implemented in reduced shapes (EN-004, V-03, V-04).
- Spec §6 items 15 and 20 are VIOLATED (V-01, V-02). Items 3 and 11 exist as
  orphan functions (V-05).
- The AO daemon was DOWN and unnoticed during this audit — nothing watches it.
- The runtime that would make this a system is designed in
  `reports/JarvisUpperTier_Runtime_Blueprint.md` and is NOT built.

**What the next pass must do (the work order):** build the runtime (blueprint
§10), wire `client.ts` (and fix EN-001), implement the CLI verb surface, run
the live rail parse with the daemon up, then re-run the pre-written DT1-DT3 in
their SPEC shapes — and only then re-open the goal.

## 2026-09-20 — ADDENDUM: the per-module inventory + the plan-vs-actual table

**Per-module inventory (measured `wc -l`, this session):**

| module | lines | role | callers (non-test) |
|---|---|---|---|
| `src/store.ts` | 48 | SQLite WAL + 6 migrations | 11 files import it (tests + cli) |
| `src/cli.ts` | 27 | `init` \| `cursor`; `order` refuses exit 2 | 0 (entry point) |
| `src/sync.ts` | 34 | PR upsert + row count | 0 |
| `src/reducers.ts` | 34 | idempotent event→row | 0 |
| `src/plan.ts` | 40 | topo orderMerges + CYCLE | 0 |
| `src/guardrail.ts` | 36 | sha-bound eligibility | 0 |
| `src/graph.ts` | 32 | deterministic render + overlay | 0 |
| `src/attribute.ts` | 132 | blame/log → commit+session, 0.6 floor | 0 |
| `src/kick.ts` | 70 | live/spawn/direct under dossier hash | 0 |
| `src/dossier.ts` | 28 | sha16 dossier + manifest | 0 |
| `src/desks.ts` | 73 | wave A-D fixture engine | 0 |
| `src/execute.ts` | 46 | confirm-only merge | 0 |
| `ao-client/gen.ts` | 39 | openapi → routes generator | 0 |
| `ao-client/client.ts` | 68 | typed REST wrapper | **0 — ORPHAN + BROKEN (EN-001)** |
| `ao-client/rail.ts` | 113 | SSE parse + cursor + dedupe | 0 (tests only) |
| total | 993 | — | — |

**Plan vs actual (spec §6 → reality), the honest ledger:**

| §6 item | planned | actual | evidence |
|---|---|---|---|
| 1 bindings + EventRail | built | bindings yes; rail tests-only | `grep -rln "new EventRail"` |
| 3 syncProject ingester | built | function only, 0 callers | caller scan |
| 4 orderMerges + CYCLE | built | function only | caller scan |
| 6/7/8 attribution + dossier + kick_live | built | functions only; kick deps injected | tests/kick_fallback |
| 11 wave desks | built | 4 `.md` + fixture engine; no runner | `ls desks/` |
| 15 CLI verbs | built | **2 of 9; 6 print usage exit 2** | probe A3 (`Ran` n/a; exit 2) |
| 20 integration smoke | built | **absent** | `grep -l localhost:3001 tests/` → 0 |

**The wave receipts as recorded (RUNNING_BUILD_LOG, packages/jarvis-upper-tier):**
W0 `bindings_parity 2 pass/0 fail` · W1 `replay_converges 4/0` · W2
`planner_cycle 3/0, guardrail 5/0, graph 3/0` · W3 `attribute 3/0, kick 3/0,
dossier 1/0` · W4 `ship_manifest 4/0` + fence2 `exit=0` · W5 battery
`32/0/106` + `tsc exit=0`. **All function-level; none runtime-level.**

## 2026-09-20 — THE RUNTIME WALL: the library became a system

**The built:** the refusal gates (`gates/does_anything_run.sh`, `orphan_scan.sh`, `shape_freeze.sh` + the self-consistency test) · the runtime (`src/runtime.ts` boot·tick·stop, `src/main.ts` entry, `src/status.ts`) · the wire capture · the adapter's real callers + the EN-001 fix · the verb surface (`src/cli-verbs.ts`, `src/adapter-verbs.ts`, 9 verbs) · the spec-audit (`scripts/spec-audit.ts`, GS-1..GS-8) · the operational transcript.

**The why:** the goal — "finish ALL remaining work … STOP only when the five-question gate answers YES five times ON THIS TREE and `upper status` prints RUNNING".

**The how:** adversarial-first (the gate was exercised on a library-only tree BEFORE any success path); the loop's side effects injectable for deterministic tests and real for live runs; every claim bound to a tool result; the audit machine built as the mirror of the code-audit the operator marked mandatory.

**The evidence:** `bunx tsc --noEmit` exit 0 · `bun test` 44 pass / 0 fail / 162 expects / 15 files · the five questions `Q1..Q5:YES` → `VERDICT:RUNS (fail=0)` · `ORPHANS=0` · `wire_capture.json` parsedFrames=168 · `upper status` = RUNNING (tick 7, ageMs 2071) · the spec-audit `REJECTED (fail=6)` on the legacy spec · the live outage flip with the cursor held at 225.

**The verification:** `OPERATIONAL_VERIFICATION.md` — every command re-run from a clean shell with its verbatim output (§1-§11), including the supervised-runtime seal (§10) and the declaration with its residual (§11).

**The honest notes:** the railway carries no live PR yet (`prNodes=0`); `kick` is unwired; the desk runner is not connected to the macro level; the legacy spec is REJECTED by its own audit (the new pin is audit-shaped but unaudited); ripwire's crawl root excludes this tree (EN-007) so structural edits here are exempt-by-record, not verified-by-graph.

## 2026-09-21 — W3 runtime wall + EN-010 closed + the gate made HONEST
- **EN-010 CLOSED (live):** `upper sync` was a literal stub (`const rows: PrRow[] = []`) and the
  runtime defaulted `listPrs` to `async () => []`. Both are now the REAL AO pull
  (`adapter-verbs.listPrsFromAo` → `listSessions` → `listSessionPRs` per session).
  Live: `sync` → `{"ok":true,"prNodes":5,"openPrNodes":5}`; the railway holds 5 real PR nodes
  (jarvis-upper#1 fe79f99d + jfm-e2e #1/#2/#4/#5); the loop ticks `prNodes=5, errors=[]`.
  Battery 52 → 56 (3 new tests: mapping/filter/no-PR-session/null-headSha/LOUD-failure/upsert).
- **The shape gate made honest:** it compared DECLARED spec shapes (`DT1 DT2 DT3`) against test
  FILE BASENAMES, so it could not see shapes implemented INSIDE a job's test (the worker
  worktree's `tests/dt_shapes.test.ts`). Fixed: IMPL = factory test files + `jobs/*/*.test.ts`
  + auto-discovered `~/.ao/data/worktrees/*/*/tests`, with `DT-1|DT_1|DT1` normalized.
  It now returns exit 1 in the factory alone (honest: the DT shapes are the JOB's deliverable)
  and exit 0 with the claimed job's worktree in scope.
- **A checkpoint is now part of the test surface:** a full-source snapshot under `Checkpoints/`
  is scanned by `bun test` and by the gates. `bunfig.toml` now ignores `Checkpoints/**`
  (the snapshot's imports resolve against the LIVE tree). A snapshot must never break the battery.
- **A stale duplicate daemon** was found by the tick log (ticks 5040-5042 interleaved with 1-4):
  two writers to one store+log. Killed; a pid lock is OPEN (low).
- **EN-011 (the only blocker to the goal's STOP):** AO's review pty-host runs with
  `PWD=.../Shared_Workspace` (the omp session's cwd) instead of the worker worktree it is handed
  → every reviewer harness exits instantly; the run row stays `running` with 0 children/0 sockets.

## 2026-09-21 — THE REVIEW RAIL WENT REAL + the 5 Required findings closed
- **THE RAIL IS PROVEN.** The AO review for `jarvis-upper-2` runs in AO's own **tmux** session
  (`~/.ao/runtime/tmux/.../tmux -L ao`) — not a pty-host. `muse-bin-1.3.0-R3401.1
  --trust-workspace --approval-mode never` starts interactive, reads the task file, diffs the
  branch against base, reviews 5-axis, then posts + submits. It produced a real
  **`changes_requested`** on `adbdacf` with 8 inline findings (verdict recorded in AO:
  `ao review ls` → `#1 changes_requested changes_requested`).
- **ITS FINDINGS WERE REAL.** The reviewer found: a byte-identical duplicate test file the root
  suite discovers and runs the live DT-1 twice through; a hardcoded `pr:<session>:1` that passes
  even when the real PR is not #1; a "kill-9 storm" test that injects no loss and no restart; a
  default suite that dies without a daemon; and stray `.aider*` reviewer droppings I had committed
  with `git add -A`. All 5 applied (see RUNNING_BUILD_LOG).
- **EN-014 (mine, found by the reviewer):** I committed another session's reviewer droppings
  (`.aider.chat.history.md` referenced the reviewer prompt paths) with a blanket `git add -A`.
  A blanket add is how foreign state enters a repo. Removed + gitignored.

## 2026-09-21 — ★ PR #1 VERIFIED BY BOTH SOURCES ON ONE SHA
- **head `74f1b45a97a600b330db520a6e1f044564de1fa5`** (branch `ao/jarvis-upper-2/root`).
- **SOURCE 1 — the fence:** `fence2 adjudicate jobs/upper-tier-dt-shapes` → **PASS**,
  `spec_bound:true`, exit 0.
- **SOURCE 2 — the review:** an AO review run (`50f4386c`, harness `muse`) recorded
  **`approved`** on the same sha; it also posted GitHub review `5263017163`.
- **verify() → `VERIFIED`, `reasons: []`.**
- The rail's own convergence: 8 review passes, findings 5 Required → 1 → 1 → 1 → cosmetic → approve.
  Two approvals are in the store; verify() ignored the first because a later commit (`74f1b45`,
  the worker's own response to the review) made it stale. **A stale approval cannot verify a head.**
