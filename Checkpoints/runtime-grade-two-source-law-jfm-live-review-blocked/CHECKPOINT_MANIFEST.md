# CHECKPOINT MANIFEST — runtime-grade-two-source-law-jfm-live-review-blocked
- **Checkpoint:** Checkpoints/runtime-grade-two-source-law-jfm-live-review-blocked (hyphens only, no spaces)
- **Date:** 2026-09-21 · **Era:** the RUNTIME-GRADE build (the two-source verdict law + JFM)
- **jarvis-upper HEAD:** 3a7dce2 · **jfm HEAD:** 417c536
- **Remotes:** https://github.com/leviathan-devops/jarvis-upper.git (private) · jfm has no remote yet

## THE STATE (measured)
| measure | value |
|---|---|
| jarvis-upper battery | 52 pass / 0 fail / 183 expects / 16 files |
| jarvis-upper tsc | exit 0 |
| the five questions | VERDICT:RUNS (fail=0) |
| shape freeze | SHAPES:all declared ids implemented |
| orphan scan | ORPHANS=0 |
| jfm battery | 8 pass / 0 fail / 30 expects |
| jfm CLI | live at ~/.local/bin/jfm (11 verbs) |
| fence2 (job upper-tier-dt-shapes) | PASS · fe5589aebc5ccb36\|sandbox=bwrap\|spec_bound:true |
| verify() on the clean head | UNVERIFIED — fence GREEN, review BLOCKED |
| AO daemon | healthz 200 · 30+ sessions |

## CONTENTS
- **src/** — the full jarvis-upper tree (many .ts: 17 modules + ao-client{+gen} + tests + gates + scripts + desks + probes)
- **jfm/** — the JFM tree (src + tests + configs) — the AO desk manager CLI
- **artifacts/** — runtime/status.json + ticks.log + wire_capture.json + the fence2 ledger (verdicts.jsonl)
- **canon/** — the 11 canon docs (context_management/)
- **SPEC.md** — the authority build spec · **JFM_BLUEPRINT.md** — the JFM design of record
- the 5 ship docs (BUILD_REPORT, DEBUG_LOG, FAILURE_LOG, SPEC_VIOLATION_LOG, TESTING_LOG) + GUARDRAILS + RESUME + OPERATIONAL_VERIFICATION + RUNTIME_GRADE_TRANSCRIPT + SHIP_DOCS_MANIFEST

## SEAL MODE
**MODE B — NO LOCK** (mutable working snapshot; the tree is under active development).

## HONEST GAPS
1. **SOURCE 2 BLOCKED (EN-011):** AO's reviewer pty-host carries `PWD=.../Shared_Workspace` (the omp cwd) instead of the worker worktree it is handed → every reviewer harness exits instantly, the run stays `running` forever with 0 children/0 sockets. Unlock: fix AO upstream, or install [CC]/Codex (the only documented reviewer harnesses), or run a review-capable harness that tolerates the cwd.
2. **prNodes = 0:** `upper sync` is a STUB (EN-010) — wired, never fed from AO.
3. **JFM wave = NO-DESKS:** no production desk has been dispatched THROUGH jfm yet (jobs so far went via direct AO spawns); the dispatch path is test-exercised.
4. **Canon docs below floor:** 8 of 11 under the 200-line law (a follow-up agent is expanding them).
5. **No container:** host-live rig for this class; no container image.

## THE WAVES (DONE-WHEN ledger)
| wave | done-when | status | evidence |
|---|---|---|---|
| W0 | preflight: existing bones triaged, plan locked | **DONE** | 4 bones mapped in F0 (36 files) |
| W1 | the two-source VERDICT gate: a change passes ONLY with a fence PASS *and* an approving review bound to the SAME commit; one alone = UNVERIFIED | **DONE** | 9 pass/0 fail; verify() live |
| W2 | the JFM CLI: JAM desks dispatched through the real Orca CLI verbs; no fake queue | **DONE** | 8 pass/0 fail; jfm live (11 verbs); desk core IMPORTED |
| W3 | a real job → real PR → real gate verdict → real review verdict | **PARTIAL** | fence PASS on the clean head; DT-1 PASSES (real PR #1, 63.3s); review BLOCKED (EN-011) |
| W4 | checkpoint + canon docs + transcript + ship docs | **PARTIAL** | checkpoint saved; 11 canon docs written (8 under floor); transcript 141L; ship docs current |

## REFUSE VERIFICATION (this session's evidence)
- `detectFake*` measured: NOT PRESENT (declared cleanly, refused at run time).
- sha16 ledger entries never compared to a 40-char head without the prefix fix (EN-012).
- the fence call now takes the SPEC invariant; the head binding rides the worktree (EN-013).
- `--merge` requires `--confirm` (MERGE-REQUIRES-CONFIRM, exit 2).
- `reviews: []` yields REVIEW-NOT-APPROVED, exit non-zero.

## THE BINDING LAWS
- **GRAPH-FIRST**: query before every structural edit (ripwire/graph-query).
- **NO SILENT FALLBACK**: a missing substrate returns a LOUD named refusal.
- **ANTI-THEATRICAL**: state blocked as blocked; a run row is not a run.
- **TWO-SOURCE**: one verdict source alone = UNVERIFIED (this checkpoint's era).
- **MODE-B**: writable snapshot; no lock.

## RESUME HINT
Resume at W3's SOURCE 2 (EN-011): either fix AO's reviewer-host cwd upstream, install a
documented reviewer harness ([CC]/Codex), or route reviews through a harness that tolerates
the cwd. Everything else re-runs from this checkpoint: `bun test` (jarvis-upper 52/0, jfm 8/0),
`bash gates/does_anything_run.sh .` (RUNS), `bun src/cli.ts health` (ok:true).
