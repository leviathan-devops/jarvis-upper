# BUILD STATE — jarvis-upper (W4)

This doc is the **SHA chain, module inventory, and immutable list**.
Everything an agent needs to know before touching code or committing. All SHAs
are quoted verbatim from the verified state — do NOT invent.

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

| Artifact | SHA | Branch / Context |
|----------|-----|------------------|
| `jarvis-upper` main tip (W4) | — (see local `git rev-parse HEAD` at resume) | `main` |
| PR #1 — commit 1 | `760ad1b` | `ao/jarvis-upper-2/root` (W1) |
| PR #1 — commit 2 | `732083e` | `ao/jarvis-upper-2/root` (W2) |
| PR #1 — commit 3 | `adbdacf` | `ao/jarvis-upper-2/root` (W3) |
| PR #1 head (current) | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | `adbdacf` |
| jfm-e2e PR #1 commit | `cce7bdb` | merged proof |
| fence2 current PASS row | head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | job `upper-tier-dt-shapes` |

> The **two-source verdict law** keys off `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`
> as the head sha. `verify({jobDir, headSha, sessionId})` returns VERIFIED iff
> fence2 adjudicate exits 0 AND an AO review run approves THIS sha.

## 3. MODULE INVENTORY

### 3.1 Upper-tier control plane — `jarvis-upper/src/` (17 modules)

| # | Module | Path | Status |
|---|--------|------|--------|
| 1 | main | `src/main.ts` | RUNS |
| 2 | runtime | `src/runtime.ts` | RUNS |
| 3 | status | `src/status.ts` | RUNS |
| 4 | verdict | `src/verdict.ts` | RUNS (two_source_verdict: 8 pass) |
| 5 | ao-transport | `ao-client/transport.ts` | RUNS (10-verb seam, AO 200) |
| 6 | ao-session | `ao-client/session.ts` | RUNS (spawn carries OMP_PROFILE=jarvis-worker) |
| 7 | ao-pr | `ao-client/pr.ts` | RUNS (PR #1 OPEN, jfm-e2e merged) |
| 8 | ao-review | `ao-client/review.ts` | RUNS (autoReview:true, reviewers:muse) |
| 9 | gate: does_anything_run | `gates/does_anything_run.sh` | PASS (`VERDICT:RUNS (fail=0)`) |
| 10 | gate: shape_freeze | `gates/shape_freeze.sh` | PASS (`SHAPES:all declared ids implemented`) |
| 11 | gate: orphan_scan | `gates/orphan_scan.sh` | PASS (`ORPHANS=0`) |
| 12 | spec-audit | `scripts/spec-audit.ts` | RUNS |
| 13 | wire_capture | `runtime/wire_capture.json` | parsedFrames=168, bytes=65638 |
| 14 | status.json | `runtime/status.json` | RUNNING |
| 15 | ticks.log | `runtime/ticks.log` | appending @3000ms |
| 16 | tests | `tests/` (16 files) | 52 pass / 0 fail / 183 expects |
| 17 | package | `package.json` | exit 0 |

### 3.2 JFM — `/home/leviathan/JARVIS_WORKSPACE/jfm/src/` (6 modules)

| # | Module | Path | Verbs / Role |
|---|--------|------|--------------|
| J1 | cli | `jfm/src/cli.ts` | `health|status|watch|pin|dispatch|steer|abort|pr|gate|board|wave` |
| J2 | ao-transport | `jfm/src/ao-transport.ts` | 10-verb seam + pr natives |
| J3 | pin | `jfm/src/pin.ts` | pins AO jobs to head sha |
| J4 | desk | `jfm/src/desk.ts` | JAM tracker + 5 AO columns (IMPORTED seam) |
| J5 | watch-ao | `jfm/src/watch-ao.ts` | INST-1/2/4 wired |
| J6 | gate | `jfm/src/gate.ts` | `bun test -t jfm_verbs` → 8 pass / 0 fail |

### 3.3 The 5 AO columns in the JAM tracker

The JAM desk core (`desk-orchestrator.ts`) models AO spawns across 5 columns:

| Column | AO state | Meaning |
|--------|----------|---------|
| queued | pending | spawned but not yet started |
| running | active | AO job active, TUI live |
| reviewing | reviewing | AO review run in flight |
| done | closed | fence2 + AO review both PASS |
| killed | killed | aborted by operator |

### 3.4 Imported (never forked)

| Dependency | Path | Notes |
|------------|------|-------|
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | IMPORTED into JFM, never forked |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` | IMPORTED into gates, never forked |

## 4. THE FROZEN / IMMUTABLE LIST

These SHAs and files MUST NOT be rebased or rewritten without an explicit
operator ruling (D-008 / A-011). They are the anchors for the two-source verdict.

| Anchor | SHA / Path | Why frozen |
|--------|------------|------------|
| PR #1 head | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | Two-source verdict keys off this sha |
| fence2.py | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` | Verdict engine — imported, not forked |
| verdicts.jsonl | `Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl` | Append-only ledger |
| desk-orchestrator.ts | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | JAM desk core — imported into JFM |
| JFM repo | `/home/leviathan/JARVIS_WORKSPACE/jfm/` (branch main) | Separate repo, pinned verbs |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | Poolside-Direct default |
| Global omp config | `~/.omp/agent/config.yml` | Operator's deepseek main omp — NOT a worker |
| Blueprint | `reports/JFM_Blueprint_v1.md` (395L) | reference for all of the above |

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

`jarvis-upper/src/verdict.ts`:

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
