# CURRENT STATE — jarvis-upper (W4)

This doc is the **per-module status** at the end of W4. "What runs / what does
not" is keyed to the runtime, the AO factory, JFM, and the 17 upper-tier modules
+ JFM's 6 internal modules.

---

## 1. HOST-LIVE SYSTEMS

| System | Location | Status (W4) | Proof command |
|--------|----------|-------------|---------------|
| AO daemon (Jarvis Core) | `http://localhost:3001` | UP (healthz 200) | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` → `200` |
| AO introspection | `http://localhost:3001` | 144 paths / 164 ops / 269 schemas | SSE at `/api/v1/events?after=<cursor>` live |
| AO merge model | AO semantics | explicit-only | there is NO webhook/notifier/plugin surface |
| Upper-tier runtime | `src/main.ts` + `runtime/` | RUNNING | `bun src/cli.ts status` → `RUNNING (tick >3000)` |
| JFM CLI | `~/.local/bin/jfm` (symlink → `/home/leviathan/JARVIS_WORKSPACE/jfm/`) | Installed + tested | `jfm health` |
| fence2 | `.../Shared_Workspace/JARVIS-CORE/b6/fence2.py` | Live (hermetic) | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | PINNED | default/task = poolside/poolside/laguna-s-2.1:high |

## 2. THE 17 UPPER-TIER MODULES (src/)

Status legend: RUNS = host-live + gate green; STUB = exists but unverified;
BROKEN = gate red; FROZEN = immutable per BUILD_STATE.md.

| # | Module | Path | Status | Evidence |
|---|--------|------|--------|----------|
| 1 | main | `src/main.ts` | RUNS | runtime RUNNING, tick >3000 |
| 2 | runtime | `src/runtime.ts` | RUNS | `runtime/ticks.log` appending @3000ms |
| 3 | status | `src/status.ts` | RUNS | `runtime/status.json` current |
| 4 | verdict | `src/verdict.ts` | RUNS | `bun test -t two_source_verdict` → 8 pass |
| 5 | ao-transport | `ao-client/transport.ts` | RUNS | 10-verb seam, AO 200 |
| 6 | ao-session | `ao-client/session.ts` | RUNS | AO spawn carries OMP_PROFILE=jarvis-worker |
| 7 | ao-pr | `ao-client/pr.ts` | RUNS | PR #1 OPEN, jfm-e2e PR merged proof |
| 8 | ao-review | `ao-client/review.ts` | RUNS | autoReview:true, reviewers:muse |
| 9 | gate: does_anything_run | `gates/does_anything_run.sh` | PASS | `VERDICT:RUNS (fail=0)` |
| 10 | gate: shape_freeze | `gates/shape_freeze.sh` | PASS | `SHAPES:all declared ids implemented` |
| 11 | gate: orphan_scan | `gates/orphan_scan.sh` | PASS | `ORPHANS=0` |
| 12 | spec-audit | `scripts/spec-audit.ts` | RUNS | (see GATE 4 in TASK_QUEUE) |
| 13 | wire_capture | `runtime/wire_capture.json` | RUNS | `parsedFrames=168, bytes=65638` |
| 14 | status.json | `runtime/status.json` | RUNS | RUNNING |
| 15 | ticks.log | `runtime/ticks.log` | RUNS | appending each 3000ms |
| 16 | tests | `tests/` (16 files) | RUNS | `52 pass / 0 fail / 183 expects` |
| 17 | package | `package.json` | RUNS | `bun test`, `bunx tsc --noEmit` exit 0 |

## 3. JFM — 6 INTERNAL MODULES

JFM lives at `/home/leviathan/JARVIS_WORKSPACE/jfm/` — its OWN git repo (branch
`main`), symlinked at `~/.local/bin/jfm`. The JAM desk core is IMPORTED from
`Shared_Workspace/JARVIS/src/desk-orchestrator.ts` (never forked).

| # | Module | Path | Verbs / Role | Status |
|---|--------|------|--------------|--------|
| J1 | cli | `jfm/src/cli.ts` | `health|status|watch|pin|dispatch|steer|abort|pr|gate|board|wave` | RUNS |
| J2 | ao-transport | `jfm/src/ao-transport.ts` | 10-verb seam + pr natives | RUNS |
| J3 | pin | `jfm/src/pin.ts` | pins AO jobs to head sha | RUNS |
| J4 | desk | `jfm/src/desk.ts` | JAM tracker + 5 AO columns (IMPORTED seam) | RUNS |
| J5 | watch-ao | `jfm/src/watch-ao.ts` | INST-1/2/4 wired | RUNS |
| J6 | gate | `jfm/src/gate.ts` | `bun test -t jfm_verbs` → 8 pass / 0 fail | PASS |

### 3.1 The 5 AO columns in the JAM tracker

The JAM desk core (`desk-orchestrator.ts`) models AO spawns across 5 columns:

| Column | Meaning | AO state |
|--------|---------|----------|
| queued | spawned but not yet started | pending |
| running | AO job active, TUI live | active |
| reviewing | AO review run in flight | reviewing |
| done | fence2 + AO review both PASS | closed |
| killed | aborted by operator | killed |

`jfm status` reads these columns; `jfm watch` tails the SSE into them.

## 4. AO FACTORY — REAL JOBS (this era)

| Job | Type | Worker profile | Result | PR |
|-----|------|----------------|--------|----|
| `jarvis-upper-2` | worker/omp/tui | jarvis-worker (Poolside-Direct) | Fixed DT-shapes drift bug (EN-001) | `https://github.com/leviathan-devops/jarvis-upper/pull/1` (OPEN, 760ad1b/732083e/adbdacf) |
| `jfm-e2e-1` | worker | jarvis-worker | End-to-end spawn→commit→push→PR | `https://github.com/leviathan-devops/jfm-e2e/pull/1` (cce7bdb, E2E-PROOF.txt=DT1-OK) |

## 5. WHAT DOES NOT RUN (as of W4)

| Item | Reason | Gate |
|------|--------|------|
| fence2 in live mode against live AO | Not applicable — fence2 is hermetic (`bwrap --unshare-all`); network-dependent done-when steps fail there BY DESIGN. DB_1's hermetic step runs offline. | G1 still PASS |
| AO `omp` as reviewer | REJECTED by AO: `INVALID_PROJECT_CONFIG: unknown harness "omp"`. Reviewer-capable = muse/aider/cursor/codex. Only muse/aider/cursor installed here. | AO config (D-005) |
| `~/.omp/agent/config.yml` using deepseek as worker | That is the OPERATOR's main omp (deliberately NOT a worker). Worker uses `jarvis-worker` profile. | D-008 |
| `upper sync` | STUB — returns prNodes 0 while a PR is open (EN-010). | G14 BLOCKED |
| AO review approval of head sha | Not yet observed — G11 OPEN. | G11 OPEN |

## 6. DEFECTS ON RECORD (summary, W4)

Full detail in `RUNNING_DEBUG_LOG.md`. Quick list (active this era EN-001..EN-010):

- EN-001 the client's health() called a nonexistent operation → fixed by `jarvis-upper-2`.
- EN-003 no entry/loop → fixed W2.
- EN-006 a healthy idle stream flagged as an error → relaxed.
- EN-007 ripwire's crawl root EXCLUDES jarvis-upper → graph gate cannot verify edits here.
- EN-008 the daemon's stale run-file + the rotating X cookie → daemon resume recipe.
- EN-009 checkpoint test copies re-ran → pinned.
- EN-010 `upper sync` is a STUB (returns prNodes 0 while a PR is open).

EN-002, EN-004, EN-005, EN-011..EN-018 are either pre-W4 resolved or not in this
era's active defect range; EN-019 (desk-local pin invisible) and EN-020 (PAT
burned) are recorded in DEBUG_LOG.

## 7. WIRE CAPTURE (frozen frame)

`runtime/wire_capture.json`: `parsedFrames=168, bytes=65638`. This is the frozen
frame of the AO↔upper-tier transport at W4 end. Any change to the transport seam
must not regress this count without a documented reason.

## 8. STATUS SNAPSHOT (literal)

```
$ bun src/cli.ts status
RUNNING (tick >3000)
```

## 9. GROUND TRUTH QUICK CHECK

| Question | Answer (W4) | Command to reproduce |
|----------|-------------|----------------------|
| Does anything run? | YES | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` |
| Does AO answer? | YES (200) | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` |
| Does the runtime tick? | YES | `bun src/cli.ts status` → `RUNNING (tick >3000)` |
| Is fence2 green on the frozen sha? | YES | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` → PASS |
| Is AO review green on the frozen sha? | NO (OPEN) | AO dashboard → not yet approved |
| Are all 3 gates + battery + tsc green? | YES | `bash gates/*.sh` + `bun test` + `bunx tsc --noEmit` |
| Is the worker profile pinned? | YES | `cat ~/.omp/profiles/jarvis-worker/agent/config.yml` |
| Is the global omp still deepseek? | YES (by design) | `cat ~/.omp/agent/config.yml` |

End of CURRENT_STATE.
