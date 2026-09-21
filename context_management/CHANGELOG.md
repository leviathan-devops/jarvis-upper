# CHANGELOG — jarvis-upper (this build era)

Append-only history of the jarvis-upper build era. Dates are `YYYY-MM-DD`.
SHAs are quoted verbatim from the verified state. Format per entry: date, SHA,
what changed, evidence.

---

## W0 — Foundation (AO vanilla install + permissions)

| Date | SHA | Milestone | Evidence |
|------|-----|-----------|----------|
| 2026-09-2x | (AO .deb install) | AO (Agent Orchestrator v0.13.0) installed from the official .deb on this host; dashboard loads. | `ao --version` / dashboard `200` at the AO root |
| 2026-09-2x | (ao config) | AO permissions bypass set at 3 levels (ao yolo config + /permissions endpoint + respawn rule) so AO sessions do not prompt on tool calls after a fresh install. | `ao config` shows bypass-permissions true |
| 2026-09-2x | `760ad1b` | `jarvis-upper` repo created (its OWN git repo, branch `main`, remote `https://github.com/leviathan-devops/jarvis-upper.git` private). Upper tier structure (`src/`, `ao-client/`, `gates/`, `scripts/`, `tests/`) scaffolded. | `git -C jarvis-upper log --oneline` shows `760ad1b` |
| 2026-09-2x | `760ad1b` | AO daemon healthz 200 confirmed at `http://localhost:3001/healthz`; introspection: `144 paths / 164 ops / 269 schemas`; SSE at `/api/v1/events?after=<cursor>`; merge is explicit-only; NO webhook/notifier/plugin surface. | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` → `200` |

## W1 — Upper-tier runtime wall + two-source law

| Date | SHA | Milestone | Evidence |
|------|-----|-----------|----------|
| 2026-09-2x | `760ad1b` | `src/main.ts` + `src/runtime.ts` + `src/status.ts` stubbed (→ EN-003: no entry/loop). | — |
| 2026-09-2x | `760ad1b` | `src/verdict.ts` created with `verify({jobDir, headSha, sessionId})` skeleton (two-source law not yet wired end to end). | `src/verdict.ts:1-5` |
| 2026-09-2x | `760ad1b` | Three gates created: `gates/does_anything_run.sh` (49L), `gates/shape_freeze.sh` (50L), `gates/orphan_scan.sh` (35L). Initial run: RED (→ EN-001, EN-006). | `bash gates/does_anything_run.sh .` initially RED |
| 2026-09-2x | `760ad1b` | AO review defaults set on `jarvis-upper`: `autoReview: true`, `reviewers: [{"harness":"muse"}]` (operator ruling: "review harness should be muse code, auto review should be true"). | `.omp/config.yml` |
| 2026-09-2x | `760ad1b` | Worker profile `~/.omp/profiles/jarvis-worker/agent/config.yml` pinned: `default`/`task` = `poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT). | `cat ~/.omp/profiles/jarvis-worker/agent/config.yml` |
| 2026-09-2x | `760ad1b` | JFM repo created at `/home/leviathan/JARVIS_WORKSPACE/jfm/` (branch `main`), symlinked `~/.local/bin/jfm`. JAM desk core IMPORTED from `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` (never forked). | `jfm --version` |
| 2026-09-2x | `760ad1b` | blueprint of record `reports/JFM_Blueprint_v1.md` (395L) committed as the design anchor. | `wc -l reports/JFM_Blueprint_v1.md` → 395 |

## W2 — Runtime green + gates + two-source law wired

| Date | SHA | Milestone | Evidence |
|------|-----|-----------|----------|
| 2026-09-2x | `732083e` | `src/runtime.ts` tick loop implemented (150L); `UPPER_TICK_MS=3000` wired. Runtime status → RUNNING. | `bun src/cli.ts status` → `RUNNING (tick >3000)` |
| 2026-09-2x | `732083e` | `src/status.ts` (48L) publishes `runtime/status.json`; `runtime/ticks.log` (5005L) appends each 3000ms. | `runtime/status.json` current |
| 2026-09-2x | `732083e` | `runtime/wire_capture.json` frozen frame: `parsedFrames=168, bytes=65638`. | `runtime/wire_capture.json` |
| 2026-09-2x | `732083e` | Gate G1: `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` (PASS). | token reproduced |
| 2026-09-2x | `732083e` | Gate G2: `bash gates/shape_freeze.sh .` → `SHAPES:all declared ids implemented` (PASS). | token reproduced |
| 2026-09-2x | `732083e` | Gate G3: `bash gates/orphan_scan.sh .` → `ORPHANS=0` (PASS). | token reproduced |
| 2026-09-2x | `732083e` | Gate G4: `bunx tsc --noEmit` → exit 0 (PASS). | exit 0 |
| 2026-09-2x | `732083e` | Gate G5: `bun test` → `52 pass / 0 fail / 183 expects / 16 files` (PASS). | token reproduced |
| 2026-09-2x | `732083e` | Gate G6: `bun test -t two_source_verdict` → `8 pass / 0 fail` (PASS). | token reproduced |
| 2026-09-2x | `732083e` | Gate G7: `bun test -t jfm_verbs` → `8 pass / 0 fail` (PASS). | token reproduced |
| 2026-09-2x | `732083e` | Two-source verdict law FINALIZED in `src/verdict.ts`: `verify()` returns VERIFIED iff (1) fence2 adjudicate exit 0 AND (2) AO review approves the same head sha. | `src/verdict.ts:1-5` |
| 2026-09-2x | `732083e` | EN-001 fixed (via later `jarvis-upper-2` job — see W3). | G1 green |

## W3 — Factory jobs: AO spawn → PR (dt-shapes + jfm-e2e)

| Date | SHA | Milestone | Evidence |
|------|-----|-----------|----------|
| 2026-09-2x | `adbdacf` (PR #1 head) | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` — head of `ao/jarvis-upper-2/root`. | `git rev-parse HEAD` of PR #1 |
| 2026-09-2x | `adbdacf` | Job `jarvis-upper-2` (worker/omp/tui, profile `jarvis-worker`) fixed the DT-shapes drift bug (EN-001). | PR #1 commits `760ad1b`,`732083e`,`adbdacf` |
| 2026-09-2x | `adbdacf` | PR #1 opened: `https://github.com/leviathan-devops/jarvis-upper/pull/1` (status OPEN). | GH UI |
| 2026-09-2x | `adbdacf` | fence2 adjudicate for job `upper-tier-dt-shapes` on head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`: verdict PASS, evidence `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` (G10 PASS). | `verdicts.jsonl` row |
| 2026-09-2x | `adbdacf` | Fence sandbox confirmed `bwrap --unshare-all` (NO network); DB_1's hermetic step runs offline BY DESIGN. | fence2.py invocation |
| 2026-09-2x | `adbdacf` | AO review: autoReview:true + reviewers:muse on jarvis-upper + jarvis_orchestrator. AO REJECTS `omp` harness (`INVALID_PROJECT_CONFIG`). Reviewer-capable installed: muse/aider/cursor. | `.omp/config.yml` |
| 2026-09-2x | `cce7bdb` | Job `jfm-e2e-1` (worker) produced first end-to-end spawn→commit→push→PR: `https://github.com/leviathan-devops/jfm-e2e/pull/1`, commit `cce7bdb`, `E2E-PROOF.txt` = `DT1-OK`. | `E2E-PROOF.txt` |
| 2026-09-2x | `adbdacf` | EN-007 noted: ripwire crawl root EXCLUDES jarvis-upper → graph gate cannot verify edits here. | ripwire scan |
| 2026-09-2x | `adbdacf` | EN-008 noted: daemon stale run-file + rotating X cookie. | daemon boot log |
| 2026-09-2x | `adbdacf` | EN-009 noted: checkpoint test copies re-ran. | test log |
| 2026-09-2x | `adbdacf` | EN-010 noted: `upper sync` is a STUB (returns prNodes 0 while PR open). | `upper sync` output |

## W4 — Canon docs (this wave, docs-only)

| Date | SHA | Milestone | Evidence |
|------|-----|-----------|----------|
| 2026-09-21 | (none) | Re-verification: `bun test` → `52 pass / 0 fail / 183 expects / 16 files`; `bunx tsc --noEmit` → exit 0; `bun test -t two_source_verdict` → `8 pass / 0 fail`; `bun test -t jfm_verbs` → `8 pass / 0 fail`. | tokens reproduce |
| 2026-09-21 | (none) | Gates re-verified: `VERDICT:RUNS (fail=0)` / `SHAPES:all declared ids implemented` / `ORPHANS=0`. | tokens reproduce |
| 2026-09-21 | (none) | Runtime re-verified: `bun src/cli.ts status` → `RUNNING (tick >3000)`. | token reproduces |
| 2026-09-21 | (none) | AO daemon still `200`; fence2 PASS row unchanged (`6954bafbd4918f75|sandbox=bwrap|spec_bound:true`). | tokens reproduce |
| 2026-09-21 | (none) | PR #1 still OPEN (head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`). | GH UI |
| 2026-09-21 | (none) | 11 canon docs written into `context_management/`. | this folder |
| 2026-09-21 | (none) | `upper sync` still STUB (EN-010); AO review (G11) still OPEN. | G11 OPEN, G14 BLOCKED |

## OPERATOR RULINGS APPLIED (this era)

| Ruling ID | Verbatim | Applied at |
|-----------|----------|------------|
| D-001 | "I NEVER WANT TO SEE ANOTHER BULLSHIT SLOP REPORT AGAIN." | all reports |
| D-002 | "Never once asked does anything run? — THIS IS THE ONLY THING THAT MATTERS." | G1 |
| D-003 | "this is all theatrical bullshit. explicitly forbid this as a verification gate..." | forbidden evidence set |
| D-004 | "THIS IS THE ONLY ACCEPTED VERIFICATION EVIDENCE. BOTH OF THESE..." | two-source law |
| D-005 | "review harness should be muse code, auto review should be true." | AO review defaults |
| D-006 | "test needs to enforce by default." | battery gates |
| D-007 | "worker profile needs the direct poolside api wired as the default model + the task agent's pinned default" | jarvis-worker default/task |
| D-008 | "the default model for the jarvis workers needs to be set to muse spark 1.3 contributor on opencode go. NOT conflicting with my main omp having deepseek pinned." | jarvis-worker sonic..slow + global deepseek |

End of CHANGELOG.
