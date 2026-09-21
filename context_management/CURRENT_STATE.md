# CURRENT STATE — jarvis-upper (W4)

This doc is the **per-module status** at the end of W4. "What runs / what does
not" is keyed to the runtime, the AO factory, JFM, and the 17 upper-tier modules
+ JFM's 6 internal modules. All line counts are measured from disk.

---

## 1. HOST-LIVE SYSTEMS

| System | Location | Status (W4) | Proof command |
|--------|----------|-------------|---------------|
| AO daemon (Jarvis Core) | `http://localhost:3001` | UP (healthz 200) | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` → `200` |
| AO introspection | `http://localhost:3001` | 144 paths / 164 ops / 269 schemas | SSE at `/api/v1/events?after=<cursor>` live |
| AO merge model | AO semantics | explicit-only | there is NO webhook/notifier/plugin surface |
| Upper-tier runtime | `src/main.ts` + `runtime/` | RUNNING | `bun src/cli.ts status` → `RUNNING (tick >3000)` |
| JFM CLI | `~/.local/bin/jfm` (symlink → `/home/leviathan/JARVIS_WORKSPACE/jfm/`) | Installed + tested | `jfm health` |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` (966L) | Live (hermetic) | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | PINNED | default/task = poolside/poolside/laguna-s-2.1:high |

## 2. THE 17 UPPER-TIER MODULES (src/) — WITH LINE COUNTS + CALLERS

Status legend: RUNS = host-live + gate green; STUB = exists but unverified;
BROKEN = gate red; FROZEN = immutable per BUILD_STATE.md.

| # | Module | Path | Lines | Callers | Status |
|---|--------|------|-------|---------|--------|
| 1 | main | `src/main.ts` | 19 | Orca/runtime launcher | RUNS |
| 2 | runtime | `src/runtime.ts` | 150 | `main.ts`, `cli.ts` | RUNS |
| 3 | status | `src/status.ts` | 48 | `runtime.ts` | RUNS |
| 4 | verdict | `src/verdict.ts` | 184 | `tests/two_source_verdict.test.ts` | RUNS |
| 5 | cli | `src/cli.ts` | — | operator | RUNS (status/init) |
| 6 | execute | `src/execute.ts` | — | `cli.ts` | RUNS |
| 7 | desks | `src/desks.ts` | — | `execute.ts` | RUNS |
| 8 | kick | `src/kick.ts` | — | `desks.ts` | RUNS |
| 9 | dossier | `src/dossier.ts` | — | `kick.ts` | RUNS |
| 10 | attribute | `src/attribute.ts` | — | `dossier.ts` | RUNS |
| 11 | graph | `src/graph.ts` | — | `attribute.ts` | RUNS |
| 12 | guardrail | `src/guardrail.ts` | — | `graph.ts` | RUNS |
| 13 | plan | `src/plan.ts` | — | `guardrail.ts` | RUNS |
| 14 | reducers | `src/reducers.ts` | — | `plan.ts` | RUNS |
| 15 | sync | `src/sync.ts` | — | `cli.ts` (STUB — EN-010) | STUB |
| 16 | adapter-verbs | `src/adapter-verbs.ts` | — | `cli.ts` | RUNS |
| 17 | cli-verbs | `src/cli-verbs.ts` | — | `adapter-verbs.ts` | RUNS |

> The "main 3" runtime entry path: `src/main.ts:1-19` → `src/runtime.ts:1-150`
> → `src/status.ts:1-48`. The tick loop in `runtime.ts` publishes
> `runtime/status.json` (13L) and appends `runtime/ticks.log` (5005L) each
> 3000ms.

## 3. THE AO-CLIENT LAYER

| Module | Path | Lines | Status |
|--------|------|-------|--------|
| client | `ao-client/client.ts` | 75 | RUNS (AO 200) |
| rail | `ao-client/rail.ts` | 113 | RUNS |
| gen | `ao-client/gen.ts` | 39 | RUNS |
| gen/routes | `ao-client/gen/routes.ts` | 173 | RUNS (144 paths surface) |
| probe a1a2-client | `ao-client/probes/a1a2-client.ts` | — | RUNS (client health check) |
| probe a4-rail-real | `ao-client/probes/a4-rail-real.ts` | — | RUNS (rail real-mode) |

## 4. THE GATES (3 refusal gates)

| # | Gate | Path | Lines | W4 token (VERBATIM) | Status |
|---|------|------|-------|---------------------|--------|
| 9 | does_anything_run | `gates/does_anything_run.sh` | 49 | `VERDICT:RUNS (fail=0)` | PASS |
| 10 | shape_freeze | `gates/shape_freeze.sh` | 50 | `SHAPES:all declared ids implemented` | PASS |
| 11 | orphan_scan | `gates/orphan_scan.sh` | 35 | `ORPHANS=0` | PASS |
| 12 | spec-audit | `scripts/spec-audit.ts` | 86 | — | RUNS (G13 BLOCKED) |

## 5. JFM — 6 INTERNAL MODULES (with line counts + verbs)

JFM lives at `/home/leviathan/JARVIS_WORKSPACE/jfm/` — its OWN git repo (branch
`main`), symlinked at `~/.local/bin/jfm`. The JAM desk core is IMPORTED from
`Shared_Workspace/JARVIS/src/desk-orchestrator.ts` (1080L, never forked).

| # | Module | Path | Lines | Verbs / Role | Status |
|---|--------|------|-------|--------------|--------|
| J1 | cli | `jfm/src/cli.ts` | 155 | `health|status|watch|pin|dispatch|steer|abort|pr|gate|board|wave` | RUNS |
| J2 | ao-transport | `jfm/src/ao-transport.ts` | 133 | 10-verb seam + pr natives | RUNS |
| J3 | pin | `jfm/src/pin.ts` | 55 | pins AO jobs to head sha | RUNS |
| J4 | desk | `jfm/src/desk.ts` | 78 | JAM tracker + 5 AO columns (IMPORTED seam) | RUNS |
| J5 | watch-ao | `jfm/src/watch-ao.ts` | 84 | INST-1/2/4 wired | RUNS |
| J6 | gate | `jfm/src/gate.ts` | 7 | gates dispatch results | RUNS (8 pass via jfm_verbs) |

### 5.1 The 5 AO columns in the JAM tracker

The JAM desk core (`desk-orchestrator.ts:1-1080`) models AO spawns across 5
columns:

| Column | AO state | Meaning |
|--------|----------|---------|
| queued | pending | spawned but not yet started |
| running | active | AO job active, TUI live |
| reviewing | reviewing | AO review run in flight |
| done | closed | fence2 + AO review both PASS |
| killed | killed | aborted by operator |

`jfm status` reads these columns; `jfm watch` tails the SSE into them.

## 6. THE IMPORTED DEPENDENCIES (never forked)

| Dependency | Path | Lines | Imported by |
|------------|------|-------|-------------|
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | 1080 | JFM `jfm/src/desk.ts` |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` | 966 | gates + verdict |

## 7. RUNTIME STATE FILES

| File | Path | Lines / size | Content | Status |
|------|------|--------------|---------|--------|
| status.json | `runtime/status.json` | 13 | RUNNING / tick | RUNS |
| ticks.log | `runtime/ticks.log` | 5005 | tick append | RUNS |
| wire_capture.json | `runtime/wire_capture.json` | 7 | `parsedFrames=168, bytes=65638` | RUNS |

## 8. AO FACTORY — REAL JOBS (this era)

| Job | Type | Worker profile | Result | PR |
|-----|------|----------------|--------|----|
| `jarvis-upper-2` | worker/omp/tui | jarvis-worker (Poolside-Direct) | Fixed DT-shapes drift bug (EN-001) | `https://github.com/leviathan-devops/jarvis-upper/pull/1` (OPEN, 760ad1b/732083e/adbdacf) |
| `jfm-e2e-1` | worker | jarvis-worker | End-to-end spawn→commit→push→PR | `https://github.com/leviathan-devops/jfm-e2e/pull/1` (cce7bdb, E2E-PROOF.txt=DT1-OK) |

## 9. WHAT DOES NOT RUN (as of W4)

| Item | Reason | Gate |
|------|--------|------|
| fence2 in live mode against live AO | Not applicable — fence2 is hermetic (`bwrap --unshare-all`); network-dependent done-when steps fail there BY DESIGN. DB_1's hermetic step runs offline. | G1 still PASS |
| AO `omp` as reviewer | REJECTED by AO: `INVALID_PROJECT_CONFIG: unknown harness "omp"`. Reviewer-capable = muse/aider/cursor/codex. Only muse/aider/cursor installed here. | D-005 |
| `~/.omp/agent/config.yml` using deepseek as worker | That is the OPERATOR's main omp (deliberately NOT a worker). Worker uses `jarvis-worker` profile. | D-008 |
| `upper sync` | STUB — returns prNodes 0 while a PR is open (EN-010). | G14 BLOCKED |
| AO review approval of head sha | Not yet observed — G11 OPEN. | G11 OPEN |

## 10. DEFECTS ON RECORD (summary, W4)

Full detail in `RUNNING_DEBUG_LOG.md`. Quick list (active this era EN-001..EN-010):

- EN-001 the client's health() called a nonexistent operation → fixed by `jarvis-upper-2`.
- EN-003 no entry/loop → fixed W2.
- EN-006 a healthy idle stream flagged as an error → relaxed.
- EN-007 ripwire's crawl root EXCLUDES jarvis-upper → graph gate cannot verify edits here.
- EN-008 the daemon's stale run-file + the rotating X cookie → daemon resume recipe.
- EN-009 checkpoint test copies re-ran → pinned.
- EN-010 `upper sync` is a STUB (returns prNodes 0 while a PR is open).

EN-019 (desk-local pin invisible) and EN-020 (PAT burned) are also recorded in
DEBUG_LOG.

## 11. WIRE CAPTURE (frozen frame)

`runtime/wire_capture.json` (7L): `parsedFrames=168, bytes=65638`. This is the
frozen frame of the AO↔upper-tier transport at W4 end. Any change to the
transport seam must not regress this count without a documented reason.

## 12. STATUS SNAPSHOT (literal)

```
$ bun src/cli.ts status
RUNNING (tick >3000)
```

## 13. GROUND TRUTH QUICK CHECK

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
