# BUILD STATE — jarvis-upper (W4)

This doc is the **SHA chain, module inventory, and immutable list**.
Everything an agent needs to know before touching code or committing. All SHAs
are quoted verbatim from the verified state. Line counts are measured from disk
at W4.

---

## 1. REPO IDENTITY

| Field | Value |
|-------|-------|
| Project root | `/home/leviathan/JARVIS_WORKSPACE/jarvis-upper` |
| Git | its OWN repo, branch `main` |
| Remote | `https://github.com/leviathan-devops/jarvis-upper.git` (private) |
| JFM repo | `/home/leviathan/JARVIS_WORKSPACE/jfm/` — its OWN repo, branch `main` |
| JFM symlink | `~/.local/bin/jfm` |
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` (IMPORTED, never forked) |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` |
| fence2 ledger | `Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl` |
| Blueprint of record | `reports/JFM_Blueprint_v1.md` (395L) |
| AO daemon | `http://localhost:3001` (healthz 200) |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` |
| Global omp config | `~/.omp/agent/config.yml` |

## 2. SHA CHAIN (this era)

All SHAs below are quoted from the verified state. Quote verbatim.

| Artifact | SHA | Branch / Context | Date |
|----------|-----|------------------|------|
| `jarvis-upper` main tip (W4) | — (see local `git rev-parse HEAD` at resume) | `main` | 2026-09-21 |
| W0 AO install | (AO .deb) | host-level | 2026-09-2x |
| W1 bootstrap commit | `760ad1b` | `main` | 2026-09-2x |
| W2 runtime commit | `732083e` | `main` | 2026-09-2x |
| W3 factory commit | `adbdacf` | PR #1 head | 2026-09-2x |
| PR #1 head (frozen) | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | `ao/jarvis-upper-2/root` | 2026-09-2x |
| jfm-e2e PR #1 commit | `cce7bdb` | jfm-e2e repo | 2026-09-2x |
| fence2 current PASS row | head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | job `upper-tier-dt-shapes` | 2026-09-2x |

> The **two-source verdict law** keys off `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`
> as the head sha. `verify({jobDir, headSha, sessionId})` returns VERIFIED iff
> fence2 adjudicate exits 0 AND an AO review run approves THIS sha.

## 3. MODULE INVENTORY

### 3.1 Upper-tier control plane — `jarvis-upper/src/` (17 + cli/exec path)

Measured line counts at W4:

| # | Module | Path | Lines | Status |
|---|--------|------|-------|--------|
| 1 | main | `src/main.ts` | 19 | RUNS |
| 2 | runtime | `src/runtime.ts` | 150 | RUNS |
| 3 | status | `src/status.ts` | 48 | RUNS |
| 4 | verdict | `src/verdict.ts` | 184 | RUNS |
| 5 | cli | `src/cli.ts` | — | RUNS |
| 6 | execute | `src/execute.ts` | — | RUNS |
| 7 | desks | `src/desks.ts` | — | RUNS |
| 8 | kick | `src/kick.ts` | — | RUNS |
| 9 | dossier | `src/dossier.ts` | — | RUNS |
| 10 | attribute | `src/attribute.ts` | — | RUNS |
| 11 | graph | `src/graph.ts` | — | RUNS |
| 12 | guardrail | `src/guardrail.ts` | — | RUNS |
| 13 | plan | `src/plan.ts` | — | RUNS |
| 14 | reducers | `src/reducers.ts` | — | RUNS |
| 15 | sync | `src/sync.ts` | — | STUB (EN-010) |
| 16 | adapter-verbs | `src/adapter-verbs.ts` | — | RUNS |
| 17 | cli-verbs | `src/cli-verbs.ts` | — | RUNS |

### 3.2 The AO-client layer

| Module | Path | Lines | Status |
|--------|------|-------|--------|
| client | `ao-client/client.ts` | 75 | RUNS (AO 200) |
| rail | `ao-client/rail.ts` | 113 | RUNS |
| gen | `ao-client/gen.ts` | 39 | RUNS |
| gen/routes | `ao-client/gen/routes.ts` | 173 | RUNS (144 paths surface) |
| probe a1a2-client | `ao-client/probes/a1a2-client.ts` | — | RUNS |
| probe a4-rail-real | `ao-client/probes/a4-rail-real.ts` | — | RUNS |

### 3.3 The gates + spec-audit

| # | Gate | Path | Lines | W4 token |
|---|------|------|-------|----------|
| 9 | does_anything_run | `gates/does_anything_run.sh` | 49 | `VERDICT:RUNS (fail=0)` |
| 10 | shape_freeze | `gates/shape_freeze.sh` | 50 | `SHAPES:all declared ids implemented` |
| 11 | orphan_scan | `gates/orphan_scan.sh` | 35 | `ORPHANS=0` |
| 12 | spec-audit | `scripts/spec-audit.ts` | 86 | — (G13 BLOCKED) |

### 3.4 JFM — `/home/leviathan/JARVIS_WORKSPACE/jfm/src/` (6 modules)

| # | Module | Path | Lines | Verbs / Role |
|---|--------|------|-------|--------------|
| J1 | cli | `jfm/src/cli.ts` | 155 | `health|status|watch|pin|dispatch|steer|abort|pr|gate|board|wave` |
| J2 | ao-transport | `jfm/src/ao-transport.ts` | 133 | 10-verb seam + pr natives |
| J3 | pin | `jfm/src/pin.ts` | 55 | pins AO jobs to head sha |
| J4 | desk | `jfm/src/desk.ts` | 78 | JAM tracker + 5 AO columns (IMPORTED seam) |
| J5 | watch-ao | `jfm/src/watch-ao.ts` | 84 | INST-1/2/4 wired |
| J6 | gate | `jfm/src/gate.ts` | 7 | gates dispatch results |

### 3.5 The 5 AO columns in the JAM tracker

The JAM desk core (`desk-orchestrator.ts:1-1080`) models AO spawns across 5
columns: queued → running → reviewing → done → killed. `jfm status` reads these;
`jfm watch` tails the SSE into them.

### 3.6 Imported (never forked)

| Dependency | Path | Lines | Imported by |
|------------|------|-------|-------------|
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | 1080 | JFM `jfm/src/desk.ts` |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` | 966 | gates + verdict |

### 3.7 Runtime state files

| File | Path | Lines / size | Content |
|------|------|--------------|---------|
| status.json | `runtime/status.json` | 13 | RUNNING / tick |
| ticks.log | `runtime/ticks.log` | 5005 | tick append |
| wire_capture.json | `runtime/wire_capture.json` | 7 | `parsedFrames=168, bytes=65638` |

### 3.8 Test files (16)

| Test | Path | Lines |
|------|------|-------|
| two_source_verdict | `tests/two_source_verdict.test.ts` | 111 |
| sync_matches | `tests/sync_matches.test.ts` | 19 |
| spec_audit | `tests/spec_audit.test.ts` | 26 |
| ship_manifest | `tests/ship_manifest.test.ts` | 96 |
| runtime_ticks | `tests/runtime_ticks.test.ts` | 89 |
| replay_converges | `tests/replay_converges.test.ts` | 83 |
| planner_cycle | `tests/planner_cycle.test.ts` | 48 |
| live_e2e | `tests/live_e2e.test.ts` | 36 |
| kick_fallback | `tests/kick_fallback.test.ts` | 76 |
| guardrail_stale | `tests/guardrail_stale.test.ts` | 67 |
| graph_snapshot | `tests/graph_snapshot.test.ts` | 45 |
| execute_plan | `tests/execute_plan.test.ts` | 58 |
| dossier_hash | `tests/dossier_hash.test.ts` | 33 |
| does_anything_run | `tests/does_anything_run.test.ts` | 92 |
| bindings_parity | `tests/bindings_parity.test.ts` | 20 |
| attribution_triage | `tests/attribution_triage.test.ts` | 68 |

## 4. THE FROZEN / IMMUTABLE LIST

These SHAs and files MUST NOT be rebased or rewritten without an explicit
operator ruling (D-008 / L9). They are the anchors for the two-source verdict.

| Anchor | SHA / Path | Why frozen |
|--------|------------|------------|
| PR #1 head | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | Two-source verdict keys off this sha |
| fence2.py | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` (966L) | Verdict engine — imported, not forked |
| verdicts.jsonl | `Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl` | Append-only ledger |
| desk-orchestrator.ts | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` (1080L) | JAM desk core — imported into JFM |
| JFM repo | `/home/leviathan/JARVIS_WORKSPACE/jfm/` (branch main) | Separate repo, pinned verbs |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | Poolside-Direct default |
| Global omp config | `~/.omp/agent/config.yml` | Operator's deepseek main omp — NOT a worker |
| Blueprint | `reports/JFM_Blueprint_v1.md` (395L) | reference for all of the above |
| Runtime entry | `src/main.ts:1-19` / `src/runtime.ts:1-150` / `src/status.ts:1-48` | frozen while RUNNING |
| Verdict law | `src/verdict.ts:1-184` | two-source law impl |

## 5. GATES (W4 state)

| Gate | Command | W4 token (VERBATIM) |
|------|---------|---------------------|
| G1 does_anything_run | `bash gates/does_anything_run.sh .` | `VERDICT:RUNS (fail=0)` |
| G2 shape_freeze | `bash gates/shape_freeze.sh .` | `SHAPES:all declared ids implemented` |
| G3 orphan_scan | `bash gates/orphan_scan.sh .` | `ORPHANS=0` |
| G4 typecheck | `bunx tsc --noEmit` | exit 0 |
| G5 battery | `bun test` | `52 pass / 0 fail / 183 expects / 16 files` |
| G6 two_source_verdict | `bun test -t two_source_verdict` | `8 pass / 0 fail` |
| G7 jfm_verbs | `bun test -t jfm_verbs` | `8 pass / 0 fail` |
| G8 AO up | `curl ... /healthz` | `200` |
| G9 runtime alive | `bun src/cli.ts status` | `RUNNING (tick >3000)` |
| G10 fence2 adjudicate | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` |

## 6. VERDICT LAW WIRING

`jarvis-upper/src/verdict.ts` (184L):

```ts
function verify({ jobDir, headSha, sessionId }): boolean {
  // VERIFIED iff BOTH:
  // 1. fence2 adjudicate <job> --expect-spec-sha <headSha> exits 0  (G10)
  // 2. an AO review run APPROVES the SAME headSha                  (G11)
  return fence2Exit0 && aoReviewApprovedSameSha;
}
```

Current frozen PASS row (do NOT invent a different sha):

```
job=upper-tier-dt-shapes
head=adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
verdict=PASS
evidence=6954bafbd4918f75|sandbox=bwrap|spec_bound:true
```

## 7. WORKER PROFILE PIN (verbatim)

`~/.omp/profiles/jarvis-worker/agent/config.yml`:

| Role | Model |
|------|-------|
| default / task | `poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT) |
| sonic / reviewer / plan / slow | `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh` |
| smol / scout | `openrouter/nvidia/nemotron-3.5-lightning:free` |

Env on every AO spawn: `OMP_PROFILE=jarvis-worker`.

Global `~/.omp/agent/config.yml` (operator's main omp, NOT a worker):
`default: verboo/deepseek-v4.1-flash:max`.

## 8. BUILD COMMANDS (paste-ready)

```bash
cd /home/leviathan/JARVIS_WORKSPACE/jarvis-upper

# Gates (in order)
bash gates/does_anything_run.sh .      # VERDICT:RUNS (fail=0)
bash gates/shape_freeze.sh .           # SHAPES:all declared ids implemented
bash gates/orphan_scan.sh .            # ORPHANS=0

# Type + battery
bunx tsc --noEmit                      # exit 0
bun test                               # 52 pass / 0 fail / 183 expects / 16 files

# Targeted verdict law
bun test -t two_source_verdict         # 8 pass / 0 fail

# Runtime (separate pane)
UPPER_TICK_MS=3000 bun src/main.ts
bun src/cli.ts status                  # RUNNING (tick >3000)

# JFM
jfm health
jfm status
bun test -t jfm_verbs                  # 8 pass / 0 fail

# Two-source on frozen sha
fence2.py adjudicate upper-tier-dt-shapes \
  --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

## 9. DEPLOY / RESUME STATE

| Artifact | Command | Expected |
|----------|---------|----------|
| AO daemon | `DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* \| head -1) /usr/bin/agent-orchestrator` | healthz 200 |
| Runtime | `UPPER_TICK_MS=3000 bun src/main.ts` | tick >3000 |
| Stale run file | `mv ~/.ao/running.json /tmp/running.json.stale` (if daemon refuses) | daemon boots |

End of BUILD_STATE.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `98cd7aaf111781891e2e52ca822889bcfb503471` (jarvis-upper main) · **job head (PR #1):** `acc7a688b56cd2db7e28f28a19db800da8baf1be`
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green
- **source 1 (fence):** PASS `spec_bound:true` · **source 2 (review):** the real muse run on AO's rail (per-run verdict in the AO store)
- **review fixes applied:** byte-identical dup deleted · DT-1 prId derived + gate asserted · DT-3 proved loss+restart · DT-1 live opt-in · .aider* removed
