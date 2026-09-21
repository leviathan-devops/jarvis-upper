# POST-COMPACTION PROMPT — jarvis-upper (W4)

This file is the **single entry point** for an agent taking over the jarvis-upper
project. Read it first, then follow the reading order below. Everything it claims
is backed by the canon docs in this same folder (CURRENT_STATE, BUILD_STATE, etc.).

---

## 1. MISSION (single sentence)

Ship the AO factory + upper-tier control plane as a **host-live, fence-gated**
system where AO (`http://localhost:3001`) spawns Poolside-Direct workers on
`jarvis-upper` and `jfm-e2e`, commits through JFM, and earns completion ONLY
from a **two-source verdict** (fence2 adjudication exit 0 AND an AO review run
approving the same head sha). No prose claims without both gates green.

## 2. WHAT "DONE" MEANS (literal)

For any job `J` on head sha `H`:

| # | Condition | Where | Evidence token |
|---|-----------|-------|----------------|
| 1 | fence2 adjudicate exits 0 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py adjudicate <job> --expect-spec-sha <H>` | `VERDICT:PASS` in `.../b6/verdicts.jsonl` |
| 2 | AO review run approves the SAME `H` | AO dashboard "Reviews" tab on repo `jarvis-upper` | `approved_sha == H` in the run record |
| 3 | Battery still green | `bun test` in jarvis-upper root | `52 pass / 0 fail / 183 expects / 16 files` |
| 4 | Typecheck clean | `bunx tsc --noEmit` | exit 0 |
| 5 | Runtime alive | `UPPER_TICK_MS=3000 bun src/main.ts` + `bun src/cli.ts status` | `RUNNING (tick >3000)` |

**Both** (1) and (2) must be true — the two-source law. One alone is theatrical.

## 3. PROJECT LAYOUT (anchor map)

| Path | Role | Lines / size |
|------|------|--------------|
| `jarvis-upper/` | Project root — its OWN git repo, branch `main`, remote `https://github.com/leviathan-devops/jarvis-upper.git` (private) | — |
| `src/main.ts` | Runtime entry point | — |
| `src/runtime.ts` | Tick loop / supervisor | — |
| `src/status.ts` | Status publisher | — |
| `src/verdict.ts` | `verify({jobDir, headSha, sessionId})` — the two-source gate | — |
| `ao-client/` | AO transport adapter (10-verb seam) | — |
| `gates/` | 3 refusal gates | — |
| `scripts/spec-audit.ts` | Spec-audit gate | — |
| `tests/` | 16 test files | — |
| `runtime/` | `status.json` + `ticks.log` + `wire_capture.json` | parsedFrames=168, bytes=65638 |
| `jfm/` (`/home/leviathan/JARVIS_WORKSPACE/jfm/`) | JFM (AO desk manager) — its OWN git repo, branch `main`, symlinked `~/.local/bin/jfm` | — |
| `Shared_Workspace/JARVIS-CORE/b6/` | fence2 ledger + verdicts.jsonl + fence2.py | — |
| `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | JAM desk core (IMPORTED, never forked) — imported into JFM | — |
| `reports/JFM_Blueprint_v1.md` | Blueprint of record (395L) | 395L |

## 4. READING ORDER (strict)

1. **THIS FILE** — mission + resume commands.
2. **BUILD_STATE.md** — the SHA chain, module inventory, immutable list.
3. **EVIDENCE_STATE.md** — copy-paste the exact tokens that are TRUE right now.
4. **TASK_QUEUE.md** — which gates are PASS / OPEN / BLOCKED.
5. **CURRENT_STATE.md** — per-module status (what runs, what does not).
6. **DECISION_CHAIN.md** — the operator's binding rulings (read before changing anything).
7. **COMPACTION_SURVIVAL.md** — resume recipe + binding laws.
8. **RUNNING_BUILD_LOG.md** — W1..W4 receipts (append-only).
9. **RUNNING_DEBUG_LOG.md** — EN-001..EN-010 (append-only).
10. **NEXT_STEPS.md** — queued work + risk register.
11. **CHANGELOG.md** — append-only history of this build era.

## 5. VERIFIED STATE (as of W4)

| System | Status | Proof |
|--------|--------|-------|
| AO daemon | 200 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` → `200` |
| AO introspection | 144 paths / 164 ops / 269 schemas | `/api/v1/events` SSE live |
| Battery | 52 pass / 0 fail | `bun test` |
| Typecheck | exit 0 | `bunx tsc --noEmit` |
| Gate: does_anything_run | PASS | `VERDICT:RUNS (fail=0)` |
| Gate: shape_freeze | PASS | `SHAPES:all declared ids implemented` |
| Gate: orphan_scan | PASS | `ORPHANS=0` |
| fence2 (job upper-tier-dt-shapes) | PASS | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` |
| Runtime | RUNNING | `bun src/cli.ts status` → `RUNNING (tick >3000)` |
| two_source_verdict | 8 pass / 0 fail | `bun test -t two_source_verdict` |
| jfm_verbs | 8 pass / 0 fail | `bun test -t jfm_verbs` |
| PR #1 | OPEN | `ao/jarvis-upper-2/root` (760ad1b, 732083e, adbdacf) |
| jfm-e2e-1 | DONE | PR `https://github.com/leviathan-devops/jfm-e2e/pull/1` commit `cce7bdb`, `E2E-PROOF.txt` = `DT1-OK` |
| Worker profile | PINNED | `jarvis-worker` → Poolside-Direct `poolside/poolside/laguna-s-2.1:high` |
| AO review defaults | SET | `autoReview: true`, `reviewers: [{"harness":"muse"}]` |
| AO review approval of head sha | OPEN | G11 — not yet observed |

## 6. THE FROZEN HEAD SHA

```
adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

This is:
- PR #1 head (`ao/jarvis-upper-2/root`, commits `760ad1b`, `732083e`, `adbdacf`).
- The sha fence2 adjudicated PASS for job `upper-tier-dt-shapes`.
- The sha the AO review must approve (G11).
- The sha `verify({headSha})` in `src/verdict.ts` keys off for VERIFIED.

Any PR merge or rebase MOVES this sha — and requires re-running BOTH fence2
(G10) AND the AO review (G11) on the NEW sha before completion.

## 7. RESUME COMMANDS (paste-ready)

```bash
cd /home/leviathan/JARVIS_WORKSPACE/jarvis-upper

# 1. AO daemon (daemon resume recipe — X cookie rotates)
DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) \
  /usr/bin/agent-orchestrator

# If the daemon refuses (stale run file):
mv ~/.ao/running.json /tmp/running.json.stale
# then re-run the above.

# 2. Verify AO is up
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/healthz

# 3. Verify the runtime (upper-tier tick loop)
UPPER_TICK_MS=3000 bun src/main.ts      # in another pane
bun src/cli.ts status                  # expect RUNNING (tick >3000)

# 4. Run the three gates
bash gates/does_anything_run.sh .      # VERDICT:RUNS (fail=0)
bash gates/shape_freeze.sh .           # SHAPES:all declared ids implemented
bash gates/orphan_scan.sh .            # ORPHANS=0

# 5. Run the battery + typecheck
bunx tsc --noEmit                      # exit 0
bun test                               # 52 pass / 0 fail / 183 expects / 16 files

# 6. Two-source verdict law sanity
bun test -t two_source_verdict         # 8 pass / 0 fail

# 7. JFM sanity
jfm health                             # healthy
jfm status                             # desk + columns
bun test -t jfm_verbs                  # 8 pass / 0 fail

# 8. Two-source verdict on the frozen sha (manual)
bash /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py \
  adjudicate upper-tier-dt-shapes \
  --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
# expect VERDICT:PASS + 6954bafbd4918f75|sandbox=bwrap|spec_bound:true
```

## 8. THE THREE NON-NEGOTIABLE LAWS

1. **Two-source verdict law** — `verify({jobDir, headSha, sessionId})` returns
   VERIFIED iff fence2 adjudicate exits 0 AND an AO review run approves the same
   head sha. `bun test -t two_source_verdict` → 8 pass / 0 fail.
2. **Does-anything-run law** — `bash gates/does_anything_run.sh .` MUST return
   `VERDICT:RUNS (fail=0)`. Citing commit-exists / diff-changed / tests-pass /
   PR-open as verification is **explicitly forbidden** (operator ruling D-003).
3. **Worker-profile pin law** — every AO spawn carries `OMP_PROFILE=jarvis-worker`.
   The `jarvis-worker` profile has `default`/`task` = Poolside-Direct
   `poolside/poolside/laguna-s-2.1:high`; `sonic`/`reviewer`/`plan`/`slow` =
   `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh`;
   `smol`/`scout` = `openrouter/nvidia/nemotron-3.5-lightning:free`.
   The GLOBAL `~/.omp/agent/config.yml` keeps `default: verboo/deepseek-v4.1-flash:max`
   (the operator's main omp — deliberately NOT a worker).

## 9. WHAT TOUCH WHEN

| Task | Touchable files | NOT touchable |
|------|-----------------|---------------|
| Runtime bug | `src/runtime.ts`, `src/status.ts`, `src/main.ts`, `runtime/*` | `gates/` (only if law changes), JFM (separate repo) |
| Verdict gate | `src/verdict.ts` | `.../b6/fence2.py` (imported, never forked) |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | `~/.omp/agent/config.yml` |
| AO settings | project `.omp/config.yml` on jarvis-upper (autoReview, reviewers) | AO daemon config (`http://localhost:3001`) |
| Canon docs | `context_management/` ONLY | everything else |
| JFM | `/home/leviathan/JARVIS_WORKSPACE/jfm/` | JAM desk core (imported) |

## 10. CONTACTS / PEERS

This session's agent id is **CanonDocs**. Other live peers are visible via
`hub op:"list"`. Primary peer: `Main` (the main orchestrator). If you need to
wake a parked peer, address it by its roster id — do NOT invent names.
Discovery rule: `hub op:"list"` shows live (running+idle) peers + counts; pass
`status:"parked"` to inspect parked history; message a known parked id to
revive it; `history://<id>` and `agent://<id>` stay readable.

## 11. FAILURE PROTOCOL

If a gate is RED:
1. Do NOT lower the bar. Do NOT cite forbidden evidence.
2. Read DECISION_CHAIN.md — the operator has already ruled on the shape of
   acceptable verification.
3. Fix the source. Re-run the SAME gate. Produce the token.
4. Record the token in EVIDENCE_STATE.md (append-only).
5. Only then proceed.

## 12. QUICK REFERENCE CARDS

### 12.1 Gate tokens (copy-paste into a report)

```
AO: 200
G1: VERDICT:RUNS (fail=0)
G2: SHAPES:all declared ids implemented
G3: ORPHANS=0
G4: exit 0
G5: 52 pass / 0 fail / 183 expects / 16 files
G6: 8 pass / 0 fail
G7: 8 pass / 0 fail
G9: RUNNING (tick >3000)
G10: 6954bafbd4918f75|sandbox=bwrap|spec_bound:true
```

### 12.2 The forbidden evidence set (cite NEVER)

| Forbidden | Ruling |
|-----------|--------|
| commit-exists | D-003 |
| diff-changed | D-003 |
| tests-pass | D-003 |
| PR-open | D-003 |

### 12.3 Worker profile (verbatim)

```yaml
default: poolside/poolside/laguna-s-2.1:high
task: poolside/poolside/laguna-s-2.1:high
sonic: openrouter/.../muse-spark-1.3-contributor-free:xhigh
reviewer: openrouter/.../muse-spark-1.3-contributor-free:xhigh
plan: openrouter/.../muse-spark-1.3-contributor-free:xhigh
slow: openrouter/.../muse-spark-1.3-contributor-free:xhigh
smol: openrouter/nvidia/nemotron-3.5-lightning:free
scout: openrouter/nvidia/nemotron-3.5-lightning:free
```

End of post-compaction prompt.
