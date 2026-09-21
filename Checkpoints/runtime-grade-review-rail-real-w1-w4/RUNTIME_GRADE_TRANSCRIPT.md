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
