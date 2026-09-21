# CHECKPOINT MANIFEST — runtime-grade-review-rail-real-w1-w4

## IDENTITY
- **Checkpoint:** `Checkpoints/runtime-grade-review-rail-real-w1-w4` (hyphens only, no spaces)
- **Date:** 2026-09-21 · **Era:** RUNTIME GRADE — the two-source verdict law, JFM live, and a **real** review verdict
- **Seal mode:** **MODE B — NO LOCK** (a mutable working snapshot; the tree is under active development)
- **factory head (jarvis-upper main):** `f2785c32554b987b47f5ae658070b7b118710c9a`
- **job head (PR #1 branch ao/jarvis-upper-2/root):** `cc5958af1026e6825b2e9903ff73655e6f28b41b`
- **jfm head:** `417c5368f3bb40e90cd6b5cdd3c2829ab4772cbb`

## THE STATE (measured, not claimed)
| measure | value | how |
|---|---|---|
| jarvis-upper battery | 56 pass / 0 fail / 201 expects / 17 files | `bun test` |
| the job's shapes (in the worktree) | 3 pass / 0 fail; DT-1 skips without `DT1_LIVE=1` | `bun test -t dt_shapes` |
| types | exit 0 | `bunx tsc --noEmit` |
| the five questions | Q1-Q5 YES · VERDICT:RUNS (fail=0) | `bash gates/does_anything_run.sh .` |
| shape freeze | all declared ids implemented | `bash gates/shape_freeze.sh .` |
| orphan scan | ORPHANS=0 | `bash gates/orphan_scan.sh .` |
| jfm battery | 8 pass / 0 fail / 30 expects | `cd ../jfm && bun test` |
| jfm live | `{"ok":true,"ao":"http://localhost:3001","http":200}` | `jfm health` |
| the runtime wall | prNodes=5 (a real AO pull) | `upper sync` / `upper status` |
| source 1 — the fence | **PASS** — `spec_bound:true`, exit 0 (after a re-stamp the fence itself REFUSED as stale) | `fence2 adjudicate jobs/upper-tier-dt-shapes` |
| source 2 — the review | a **real** muse run on AO's tmux rail; it returned `changes_requested` on `adbdacf`; its 5 Required findings are fixed in `acc7a688b56cd2db7e28f28a19db800da8baf1be` | `ao review ls jarvis-upper-2` |
| AO daemon | healthz 200 · 35 sessions | `GET /healthz` |

## CONTENTS
- **src/** — the full jarvis-upper tree (17 modules + ao-client{+gen} + tests + gates + scripts + desks + probes + configs)
- **jobs/** — the job definition (SPEC.md + the fence's subset test + runtime transcripts)
- **jfm/** — the JFM tree (the AO desk manager CLI, 11 verbs)
- **artifacts/** — runtime/status.json + ticks.log + the fence2 ledger + the reviewer's task + its verdict body + the submit payload
- **canon/** — the 11 canon docs (each ≥200L, all carrying one cross-consistency anchor)
- **SPEC.md** — the authority build spec · **JFM_BLUEPRINT.md** — the JFM design of record
- the 5 ship docs (BUILD_REPORT · DEBUG_LOG · FAILURE_LOG · SPEC_VIOLATION_LOG · TESTING_LOG)
- **GUARDRAILS.md · RESUME.md · OPERATIONAL_VERIFICATION.md · RUNTIME_GRADE_TRANSCRIPT.md · SHIP_DOCS_MANIFEST.md**

## WHAT THIS ERA PROVED
1. **The two-source law is mechanical and honest.** `verify()` returns VERIFIED only when the
   fence PASSES **and** an AO review run approves the **SAME** head; one source alone is UNVERIFIED.
2. **The review rail is real.** It runs in AO's own **tmux** session with `muse` as the pane
   process; the reviewer diffs the branch, runs the suite, posts via `gh api`, and records its
   verdict with `ao review submit`. (EN-011's "blocked" diagnosis was wrong — corrected in EN-015.)
3. **EN-010 closed:** `upper sync` was a literal stub; it now pulls AO for real (5 PR nodes live).
4. **The reviewer found real defects** (a duplicate test, a hardcoded PR id, a test that proved
   less than its title, a non-hermetic suite, and my own `.aider*` droppings). All fixed.

## HONEST GAPS (the residual — none hidden)
1. **SOURCE 2 stands at `changes_requested`** on the previous head. The fixes are pushed to
   `acc7a688b56cd2db7e28f28a19db800da8baf1be`; a fresh review pass on that head must approve before `verify()` can read VERIFIED.
   Until it does, the job is **UNVERIFIED** — the law holds and one source is not enough.
2. **The reviewer could not POST to GitHub from its own pane** (its `gh` failed); it wrote a
   replay payload (`artifacts/review-gh-payload.json`) and the operator submitted it
   (`gh api` review id `5262612900`). Root cause not chased (a reviewer-env PAT gap).
3. **JFM wave = NO-DESKS:** no production desk has been dispatched THROUGH jfm yet; the dispatch
   path is test-exercised, not live-exercised.
4. **A single-writer lock is missing:** the runtime can double-start (a stale tick counter was
   observed). Low severity; documented, not fixed.
5. **No container:** this class is host-live by design; no image ships with this checkpoint.

## RESUME HINT
Re-trigger the review on `acc7a688b56cd2db7e28f28a19db800da8baf1be`, let muse finish, then `verify()`. If it approves → READY for the
operator's merge decision. Everything else re-runs from here: `bun test` (56/0), `jfm health`,
`bash gates/does_anything_run.sh .` (RUNS), `fence2 adjudicate jobs/upper-tier-dt-shapes` (PASS).
