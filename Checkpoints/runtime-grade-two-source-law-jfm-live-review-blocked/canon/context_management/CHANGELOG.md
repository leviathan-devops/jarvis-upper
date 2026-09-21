# CHANGELOG — jarvis-upper (this build era)

Append-only history of the jarvis-upper build era. Dates are `YYYY-MM-DD`.
SHAs are quoted verbatim from the verified state. This era begins at the
W1 bootstrap of the upper-tier control plane.

---

## W1 — Bootstrap (AO factory + upper tier)

| Date | Commit / SHA | What changed |
|------|--------------|--------------|
| 2026-09-2x | `760ad1b` | Initial W1 commit: AO daemon healthz 200 confirmed at `http://localhost:3001/healthz`. |
| 2026-09-2x | `760ad1b` | `src/main.ts` + `src/runtime.ts` + `src/status.ts` stubbed; runtime status = STUB (EN-003: no entry/loop). |
| 2026-09-2x | `760ad1b` | `src/verdict.ts` created with `verify({jobDir, headSha, sessionId})` skeleton (two-source law not yet wired end to end). |
| 2026-09-2x | `760ad1b` | Gates created: `gates/does_anything_run.sh`, `gates/shape_freeze.sh`, `gates/orphan_scan.sh`. Initial run: RED (EN-001, EN-006). |
| 2026-09-2x | `760ad1b` | AO review defaults set on `jarvis-upper`: `autoReview: true`, `reviewers: [{"harness":"muse"}]` (operator ruling: "review harness should be muse code, auto review should be true"). |
| 2026-09-2x | `760ad1b` | Worker profile `~/.omp/profiles/jarvis-worker/agent/config.yml` pinned: `default`/`task` = `poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT). |
| 2026-09-2x | `760ad1b` | JFM repo created at `/home/leviathan/JARVIS_WORKSPACE/jfm/` (branch `main`), symlinked `~/.local/bin/jfm`. JAM desk core IMPORTED from `Shared_Workspace/JARVIS/src/desk-orchestrator.ts`. |

## W2 — Runtime + gates green

| Date | Commit / SHA | What changed |
|------|--------------|--------------|
| 2026-09-2x | `732083e` | `src/runtime.ts` tick loop implemented; `UPPER_TICK_MS=3000` wired. Runtime status → RUNNING. |
| 2026-09-2x | `732083e` | `src/status.ts` publishes `runtime/status.json`; `runtime/ticks.log` appends each 3000ms. |
| 2026-09-2x | `732083e` | `gates/does_anything_run.sh` → `VERDICT:RUNS (fail=0)` (G1 PASS). |
| 2026-09-2x | `732083e` | `gates/shape_freeze.sh` → `SHAPES:all declared ids implemented` (G2 PASS). |
| 2026-09-2x | `732083e` | `gates/orphan_scan.sh` → `ORPHANS=0` (G3 PASS). |
| 2026-09-2x | `732083e` | `bunx tsc --noEmit` → exit 0 (G4 PASS). |
| 2026-09-2x | `732083e` | `bun test` → `52 pass / 0 fail / 183 expects / 16 files` (G5 PASS). |
| 2026-09-2x | `732083e` | `bun test -t two_source_verdict` → `8 pass / 0 fail` (G6 PASS). |
| 2026-09-2x | `732083e` | `bun test -t jfm_verbs` → `8 pass / 0 fail` (G7 PASS). |
| 2026-09-2x | `732083e` | `runtime/wire_capture.json` frozen frame: `parsedFrames=168, bytes=65638`. |
| 2026-09-2x | `732083e` | EN-001 fixed: client health() no longer calls a nonexistent operation (fixed by `jarvis-upper-2` worker job). |

## W3 — Factory jobs (AO spawn → PR)

| Date | Commit / SHA | What changed |
|------|--------------|--------------|
| 2026-09-2x | `adbdacf` (PR #1 head) | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` — head of `ao/jarvis-upper-2/root`. |
| 2026-09-2x | `adbdacf` | Job `jarvis-upper-2` (worker/omp/tui, profile `jarvis-worker`) fixed the DT-shapes drift bug. PR #1 opened: `https://github.com/leviathan-devops/jarvis-upper/pull/1` (status OPEN). |
| 2026-09-2x | `adbdacf` | fence2 current PASS row for job `upper-tier-dt-shapes` on head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`: verdict PASS, evidence `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` (G10 PASS). |
| 2026-09-2x | `cce7bdb` | Job `jfm-e2e-1` (worker) produced first end-to-end spawn→commit→push→PR: `https://github.com/leviathan-devops/jfm-e2e/pull/1`, `E2E-PROOF.txt` = `DT1-OK`. |
| 2026-09-2x | `adbdacf` | AO review auto-trigger wired: `autoReview: true` on jarvis-upper + jarvis_orchestrator; reviewer harness = `muse` (AO REJECTS `omp` as a harness with `INVALID_PROJECT_CONFIG`). |
| 2026-09-2x | `adbdacf` | Two-source verdict law FINALIZED: `verify()` returns VERIFIED iff (1) fence2 adjudicate exit 0 AND (2) AO review approves the same head sha. |
| 2026-09-2x | `adbdacf` | EN-007 noted: ripwire crawl root EXCLUDES jarvis-upper → graph gate cannot verify edits here; gate uses grep/tsc/battery + fence2 instead. |
| 2026-09-2x | `adbdacf` | EN-008 noted: daemon stale run-file + rotating X cookie → daemon resume recipe written. |
| 2026-09-2x | `adbdacf` | EN-009 noted: checkpoint test copies re-ran → pinned. |
| 2026-09-2x | `adbdacf` | EN-010 noted: `upper sync` is a STUB (returns prNodes 0 while a PR is open). |

## W4 — Canon docs (this wave)

| Date | Commit / SHA | What changed |
|------|--------------|--------------|
| 2026-09-21 | — | W4: canon context docs written into `context_management/`. No source change this wave; all gates remain PASS. PR #1 remains OPEN pending AO review of `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` (G11 OPEN). `upper sync` still STUB (G14 BLOCKED, EN-010). |

## OPERATOR RULINGS (binding, applied this era)

| Ruling (verbatim) | Applied to |
|-------------------|-----------|
| "I NEVER WANT TO SEE ANOTHER BULLSHIT SLOP REPORT AGAIN." | all reports ↓ |
| "Never once asked does anything run? — THIS IS THE ONLY THING THAT MATTERS." | G1 does_anything_run is mandatory |
| "this is all theatrical bullshit. explicitly forbid this as a verification gate. this is NOT tangible verification evidence." (commit-exists / diff-changed / tests-pass / PR-open) | forbids G12/PR-open as proof alone |
| "THIS IS THE ONLY ACCEPTED VERIFICATION EVIDENCE. BOTH OF THESE. IF BOTH OF THESE DO NOT UNCONDITIONALLY PASS = REJECT. BOOLEAN FALSE." | G10 + G11 — two-source verdict law |
| "review harness should be muse code, auto review should be true. fix this as default settings." | AO review defaults: autoReview:true, reviewers:muse |
| "test needs to enforce by default." | G5/G6/G7 must pass on every commit |
| "worker profile needs the direct poolside api wired as the default model + the task agent's pinned default" | jarvis-worker profile: default/task = poolside/poolside/laguna-s-2.1:high |
| "the default model for the jarvis workers needs to be set to muse spark 1.3 contributor on opencode go. NOT conflicting with my main omp having deepseek pinned." | sonic/review/plan/slow = opencode-zen-free/muse-spark-1.3-contributor-free:xhigh |

## REJECTED ALTERNATIVES (recorded, do not re-attempt)

| What was rejected | Why | Recorded in |
|-------------------|-----|-------------|
| Citing commit-exists / diff-changed / tests-pass / PR-open as verification | Forbidden theatrical evidence | DECISION_CHAIN.md |
| Single-source verdict (fence2 only, or review only) | Must be BOTH | DECISION_CHAIN.md |
| AO `omp` as a reviewer harness | AO returns `INVALID_PROJECT_CONFIG: unknown harness "omp"`; reviewer-capable = muse/aider/cursor/codex | DECISION_CHAIN.md |
| Desk-local model pin | EN-019 proved it invisible to AO spawns | DECISION_CHAIN.md |
| Forking the JAM desk core into JFM | must IMPORT from desk-orchestrator.ts | DECISION_CHAIN.md |
| Auto-merge path | operator forbade non-two-source completion | DECISION_CHAIN.md |
| Second tracker | operator forbade (one tracker law) | DECISION_CHAIN.md |
| Recording the burned PAT material in a doc | forbidden (credential material) | DECISION_CHAIN.md |

End of CHANGELOG.
