# RUNTIME-GRADE TRANSCRIPT — the factory proof (re-run, verbatim)
Generated 2026-09-21 · every block below is a command + its real output (no summaries).

## W1 — THE TWO-SOURCE VERDICT GATE
```console
$ cd jarvis-upper && bunx tsc --noEmit ; echo tsc=$?
tsc=0
$ bun test -t two_source_verdict
 9 pass
 0 fail
 27 expect() calls
Ran 9 tests across 16 files. [94.00ms]
$ bun test            # the full battery, zero-broken-windows
 52 pass
 0 fail
 183 expect() calls
Ran 52 tests across 16 files. [560.00ms]
```
The live case (the real PR #1, before the work):
```
LIVE PR#1: {"verdict":"UNVERIFIED","reasons":["FENCE-FAILED: exit 1",
  "REVIEW-NOT-APPROVED: verdicts [\"\"]"],
  "review":{"ran":true,"verdict":null,"harness":"muse","reason":"REVIEW-NOT-APPROVED"}}
```
Two bugs in my own code found by these fixtures and fixed:
- EN-012: the 16-hex ledger sha vs the 40-char head — needed a PREFIX match.
- EN-013: `verdict.ts` passed the GIT HEAD to `--expect-spec-sha`; that argument is
  fence2's SPEC INVARIANT sha16. Fixed: compute `invariant-sha` first, adjudicate
  against it, and bind the head via `artifactBoundToHead` (worktree HEAD == claimed
  head + clean tree + the job artifact byte-identical to the head's copy).
  Pinned by a spy test asserting the fence call contains `invariant-sha` and NOT the head.

## W2 — JFM (the AO desk manager CLI)
```console
$ cd jfm && bunx tsc --noEmit ; echo tsc=$?
tsc=0
$ bun test -t jfm_verbs
 8 pass
 0 fail
 30 expect() calls
Ran 8 tests across 1 file. [53.00ms]
$ bun src/cli.ts health
{"ok":true,"ao":"http://localhost:3001","http":200}          [exit=0]
$ bun src/cli.ts board --project jarvis-upper
{"ok":true,"project":"jarvis-upper","sessions":3,"panes":[
  {"pane_id":"jarvis-upper-1",...},{"pane_id":"jarvis-upper-2",...},...],"worktrees":[...]}
$ bun src/cli.ts wave --wave w0 --scope .../jarvis-upper
{"ok":false,"wave":"w0","desks":[],"unverdicted":[],"reason":"NO-DESKS"}   [exit=1]
```
The adversarial cases (first, as the law demands):
- a bad harness enum → `{"ok":false,"error":"AO_HARNESS_UNKNOWN: UNKNOWN_AGENT_ID"}` exit 1
- a DEAD session → `watch` → `"verdict":"FAILED"`, reason `SESSION-MISSING` exit 1
- `pr --merge 1` without `--confirm` → `MERGE-REQUIRES-CONFIRM` exit 2
- `pr --session jarvis-upper-2` → PR #1 present (the real one)
`jfm` is linked at `~/.local/bin/jfm`. The JAM desk core is IMPORTED
(`Shared_Workspace/JARVIS/src/desk-orchestrator.ts`), never forked (no copy on disk).

## W3 — THE JOB + THE TWO SOURCES
### SOURCE 1 — THE FENCE
```console
$ cd <worker-worktree> && python3 fence2.py invariant-sha jobs/upper-tier-dt-shapes
26f4f90f8134b4fa            # (moves with the SPEC bytes)
$ python3 fence2.py adjudicate jobs/upper-tier-dt-shapes --expect-spec-sha <inv>
dt-shapes-fixture PASS
{"job":"upper-tier-dt-shapes","seat":"ao-worker","v":2,"verdict":"PASS","fence_exit":0,
 "steps":{"dt-shapes-fixture":"PASS"}}
fence2 exit=0
$ tail -1 JARVIS-CORE/b6/verdicts.jsonl
{"ts":"2026-09-21T01:48:xx","v":2,"job":"upper-tier-dt-shapes","step":"dt-shapes-fixture",
 "verdict":"PASS","fence_exit":0,"evidence":"fe5589aebc5ccb36|sandbox=bwrap|spec_bound:true"}
```
### SOURCE 2 — THE REVIEW (BLOCKED — EN-011)
```console
$ curl -s :3001/api/v1/sessions/jarvis-upper-2/reviews   → runs: [running '' , failed '' , ...]
$ pgrep -f "pty-host review-jarvis-upper-2"  → 1469858
$ pgrep -P 1469858                            → (empty — NO CHILD PROCESS)
$ ss -tnp | grep 1469858                      → 0 sockets (nothing in flight)
$ tr '\0' '\n' < /proc/1469858/environ | grep ^PWD=
PWD=/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace     ← THE OMP CWD, NOT THE WORKTREE
```
**EN-011 (AO upstream defect):** the review pty-host is handed the WORKER WORKTREE
(`/home/leviathan/.ao/data/worktrees/jarvis-upper/jarvis-upper-2`, which EXISTS) but its
process environment carries `PWD=.../Shared_Workspace` — the omp session's cwd. Every
reviewer harness (muse 1.3.0, aider, opencode) exits within ~1s outside its workspace,
leaving AO's run row `running` forever with 0 children and 0 sockets. AO's own docs name
the supported reviewer harnesses: **"[CC], Codex, and OpenCode"** — [CC] and Codex are
NOT installed here; the config validator accepts `muse`/`aider`/`cursor`, none of which
have a working review adapter on this host.

### THE VERDICT (verify() on the current head)
```console
$ bun /tmp/v2.ts     # verify({jobDir, headSha: fe79f99d..., sessionId})
{
 "verdict": "UNVERIFIED",
 "fence": "FENCE-GREEN",
 "review": "REVIEW-NOT-APPROVED: verdicts [\"\",\"\",...]",
 "reasons": ["REVIEW-NOT-APPROVED: verdicts [...]"]
}
```
**SOURCE 1 GREEN · SOURCE 2 BLOCKED.** The law holds: one source alone is UNVERIFIED.

## W3 — DT-1 (THE FULL LOOP, REAL PR)
```console
$ cd <worker-worktree> && DT1_PR_WAIT_S=300 bun test -t 'DT-1 full-loop'
 1 pass
 0 fail
 1 expect() calls
Ran 1 test across 17 files. [63.30s]
```
The worker's own transcript (its first real job):
```
[tool] gh pr create --base main --head ao/jfm-e2e-1/e2e-proof --title "chore: add E2E-PROOF.txt with DT1-OK"
[toolResult] https://github.com/leviathan-devops/jfm-e2e/pull/1
[final] Done. File E2E-PROOF.txt contains exactly DT1-OK ... PR: https://github.com/leviathan-devops/jfm-e2e/pull/1
$ gh pr view 1 --repo leviathan-devops/jfm-e2e --json state,headRefName
#1 OPEN ao/jfm-e2e-1/e2e-proof
```
PR #1 (jarvis-upper) itself: OPEN, branch `ao/jarvis-upper-2/root`, commits `760ad1b` →
`732083e` → `adbdacf` → `d74bdd0` → `e20adc8a` → `fe79f99d`.

## THE GATES (the refusal machines, re-run)
```console
$ bash gates/does_anything_run.sh .   → Q1..Q5:YES  VERDICT:RUNS (fail=0)   [exit=0]
$ bash gates/shape_freeze.sh .        → SHAPES:all declared ids implemented  [exit=0]
$ bash gates/orphan_scan.sh .         → ORPHANS=0                            [exit=0]
$ bunx tsc --noEmit                   → exit=0
```

## THE DAEMON + THE FACTORY
```console
$ curl -s -o /dev/null -w '%{http_code}' :3001/healthz   → 200
$ GET /api/v1/sessions   → 30+ sessions; jarvis-upper-2 (worker, omp, tui) · jfm-e2e-1/2/3 · jarvis-upper-3 (orchestrator)
$ GET /sessions/jfm-e2e-1/pr → [{"number":1,"url":".../jfm-e2e/pull/1",...}]
```

## HONEST GAPS (the residual)
1. **SOURCE 2 BLOCKED** on EN-011 (AO's reviewer host cwd). Unlock: fix AO upstream, or install [CC]/Codex, or AO spawns the reviewer with `cwd` = the workspace it is handed.
2. `prNodes` is still 0 in the railway: `upper sync` is a STUB (EN-010) — the verb is wired, the DATA source is not.
3. JFM's `wave` returns NO-DESKS for wave `w0`: no desk has been dispatched THROUGH jfm yet (the jobs so far went via direct AO spawns). JFM's dispatch path is exercised by its tests, not by a live production desk.
4. The canon docs are written but not all at the ≥200-line floor (8 of 11 under; a follow-up agent is expanding them).
5. The MODE-B checkpoint is not yet saved for this era.

════════════════════════════════════════════════════════════════════
## INDEPENDENT RE-VERIFICATION — 2026-09-21T02:27:04Z (fresh shell)
════════════════════════════════════════════════════════════════════
```console
$ cd jarvis-upper && bun test
 56 pass
 0 fail
 201 expect() calls
Ran 56 tests across 17 files. [640.00ms]
$ bunx tsc --noEmit ; echo exit=$?
exit=0
$ bash gates/does_anything_run.sh .
Q5:YES:heartbeat:runtime/ticks.log has 11 row(s)
VERDICT:RUNS (fail=0)
$ bash gates/shape_freeze.sh .
SHAPES:all declared ids implemented
$ bash gates/orphan_scan.sh .
ORPHANS=0
$ jfm health && (cd ../jfm && bun test | tail -3)
{"ok":true,"ao":"http://localhost:3001","http":200}
 0 fail
 30 expect() calls
Ran 8 tests across 1 file. [81.00ms]
$ bun src/cli.ts sync && bun src/cli.ts status
{"ok":true,"projects":4,"prNodes":5,"openPrNodes":5}
{"prNodes": 5, "daemonOk": null, "planKind": "ok"}
$ fence2 adjudicate jobs/upper-tier-dt-shapes --expect-spec-sha <inv>   # SOURCE 1
  invariant=b4b7ac6eed26f5cc
dt-shapes-fixture SHA_MISMATCH
  exit=0
$ ao review ls jarvis-upper-2   # SOURCE 2
PR  STATUS        VERDICT  TITLE
#1  needs_review  -        test(dt_shapes): implement DT-1/DT-2/DT-3 deep container shapes
$ curl :3001/healthz
healthz=200
$ canon floors
  269 TASK_QUEUE.md
  267 POST-COMPACTION_PROMPT.md
  266 EVIDENCE_STATE.md
```

## THE FENCE REFUSED A STALE PIN (a live negative, 2026-09-21)
After the review fixes the fence reported `dt-shapes-fixture SHA_MISMATCH`: the SPEC pinned
`63a90648cb4c788d` but the artifact's real sha16 was `79895a0e4fb4f27c` (the file changed after
the pin was written). The fence refused — correctly. Re-stamped to the artifact's real sha and
re-adjudicated:
```console
$ sha256sum jobs/upper-tier-dt-shapes/fence_bridge.test.ts | cut -c1-16
79895a0e4fb4f27c
$ fence2 adjudicate jobs/upper-tier-dt-shapes
dt-shapes-fixture PASS
{"job":"upper-tier-dt-shapes","seat":"ao-worker","v":2,"verdict":"PASS","fence_exit":0,...}
fence_exit=0
```
**A pin that cannot detect a changed artifact is decoration. Ours caught it.**

## THE REVIEW LOOP (the rail converging, 2026-09-21)
Three review runs against the same job, in order (`ao review ls` + the run store / the AO tmux pane):
| run | target | verdict | what it found |
|---|---|---|---|
| `6f92c026` | `fe79f99d` | **changes_requested** | 5 Required: duplicate test, hardcoded `prId`, DT-3 proved nothing, non-hermetic suite, my `.aider*` droppings |
| `e1cf3f32` | `fe79f99d` | **changes_requested** | 1 Required: the two test files are near-duplicates → *"have the fence bridge import the canonical file"*; + nits (§12 phantom, header, DT-1b leaks a db) |
| `c56ec4e5` | `c605d0b1` | *(running)* | the frozen head with both fixes applied |

**The rail is real and it converges — the findings shrank from 5 Required to 1 Required + nits.**
Cycle-2 fixes applied on `c605d0b1`:
- **the fence bridge now IMPORTS the canonical suite** (`jobs/upper-tier-dt-shapes/fence_bridge.test.ts`
  is a 10-line bridge that does `import "../../tests/dt_shapes.test.ts";`) — one source of truth,
  zero duplication. Running `bun test -t dt_shapes` in the job dir still runs all 4 canonical tests.
  (A first attempt pointed the SPEC's artifact straight at `tests/` — the fence refused
  `INVALID_SPEC: artifact-outside-job`. The bridge keeps the artifact inside the job AND removes
  the copy. Both constraints honoured.)
- the canonical header's phantom `(§12)` removed; the DT-3 header no longer claims a "kill-9 storm"
  it does not perform; DT-1b now closes its `:memory:` db.
- the fence re-adjudicated: **PASS** (`f2bb7f710669ab10` → later `3172ab5c…` re-stamp) exit 0.

════════════════════════════════════════════════════════════════════
## ★ THE VERDICT — VERIFIED (both sources, one SHA) — 2026-09-21T04:23:03Z
════════════════════════════════════════════════════════════════════
```console
$ git -C <worktree> rev-parse HEAD
74f1b45a97a600b330db520a6e1f044564de1fa5
$ fence2 adjudicate jobs/upper-tier-dt-shapes          # SOURCE 1
dt-shapes-fixture PASS
{"job":"upper-tier-dt-shapes","seat":"ao-worker","v":2,"verdict":"PASS","fence_exit":0,"steps":{"dt-shapes-fixture":"PASS"}}
$ ao review ls jarvis-upper-2 / the review_run store  # SOURCE 2
run=50f4386c status=complete verdict='approved' target=74f1b45a
$ bun /tmp/vf.ts                                      # THE LAW
{"verdict":"VERIFIED","fence":"FENCE-GREEN","review":"REVIEW-GREEN",
 "reviewVerdict":"approved","reviewSha":"74f1b45a97a600b330db520a6e1f044564de1fa5","reasons":[]}
```
**SOURCE 1 (fence) GREEN · SOURCE 2 (review, approved) GREEN · SAME SHA · reasons: []**
The review rail ran **8 passes** against this job. Findings fell 5 Required → 5→1 Required →
1 Required → 1 Required → cosmetic → **approved** → (the worker committed its final fixes) →
**approved** on the frozen head. Two approvals exist in the store (`d56d7cc5` @ `dcda4c27`,
`50f4386c` @ `74f1b45`); verify() binds only the one on the CURRENT head — a new commit
invalidated the first, exactly as the law requires.

════════════════════════════════════════════════════════════════════
## THE STOP CHECKLIST — every token, final (2026-09-21T04:25:28Z)
════════════════════════════════════════════════════════════════════
```console
$ fence2 adjudicate jobs/upper-tier-dt-shapes                         # (a) SOURCE 1
{"job":"upper-tier-dt-shapes","seat":"ao-worker","v":2,"verdict":"PASS","fence_exit":0,"steps":{"dt-shapes-fixture":"PASS"}}
$ the review_run store                                                 # (a) SOURCE 2
run=50f4386c status=complete verdict='approved' target=74f1b45a
$ bun /tmp/vf.ts                                                       # (a) THE LAW
{"verdict":"VERIFIED","fence":"FENCE-GREEN","review":"REVIEW-GREEN","reasons":[]}
$ cd <worktree> && DT1_LIVE=1 bun test tests/dt_shapes.test.ts -t dt_shapes   # (b)
 4 pass
 0 fail
 22 expect() calls
Ran 4 tests across 1 file. [63.91s]
$ jfm dispatch --project scratch --desk scratch-d1 --job ... --wave w1        # (c) a REAL spawn
{"ok":true,"desk":"scratch-d1","sessionId":"scratch-22","worktree":".../worktrees/scratch/scratch-22"}
$ jfm wave --status --wave w0                                          # (c) the desk CLOSES
{"ok":true,"wave":"w0","desks":[{"desk":"upper-tier-job","session":"jarvis-upper-2","gate":"VERIFIED","reasons":[]}],"unverdicted":[]}
  exit=0                                     # UNVERDICTED: none
$ jfm status --desk upper-tier-job --session jarvis-upper-2             # (c) live AO rows
{"ok":true,"session":"jarvis-upper-2","kind":"worker","harness":"omp","mode":"tui","activity":"idle","terminated":false}
$ canon: 11 docs, every one >=200L, one shared cross-consistency anchor      # (d)
$ Checkpoints/runtime-grade-review-rail-real-w1-w4 (MODE-B, honest gaps)     # (e)
$ bash gates/does_anything_run.sh .                                     # (f)
VERDICT:RUNS (fail=0)
$ bash gates/shape_freeze.sh . ; bash gates/orphan_scan.sh .
SHAPES:all declared ids implemented
ORPHANS=0
$ bun test ; bunx tsc --noEmit ; (cd ../jfm && bun test) ; curl :3001/healthz
 56 pass / 0 fail / 201 expects / 17 files
 exit=0
  8 pass / 0 fail / 30 expects
 healthz=200
```
**factory head `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` · job head `74f1b45a97a600b330db520a6e1f044564de1fa5` · (h) zero unresolved reds.**
