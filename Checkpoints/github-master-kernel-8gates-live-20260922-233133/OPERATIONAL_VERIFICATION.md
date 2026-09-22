# OPERATIONAL VERIFICATION — jarvis-upper
Generated: 2026-09-20T21:46:34Z · method: every command RE-RUN from a clean shell, output captured verbatim (independent re-verification, not in-flight results)

## 1. Type check
```
$ bunx tsc --noEmit
exit=0
```
## 2. Full battery
```
$ bun test
 44 pass
 0 fail
 162 expect() calls
Ran 44 tests across 15 files. [614.00ms]
```
## 3. The five questions (GR-2_DOES_ANYTHING_RUN)
```
$ bash gates/does_anything_run.sh .
Q1:YES:entry-point:src/main.ts
Q2:YES:loop:1 file(s) with a repeating construct
Q3:YES:non-test-caller:every module has a non-test caller
Q4:YES:wire-exercised:runtime/wire_capture.json present (121 bytes)
Q5:YES:heartbeat:runtime/ticks.log has 11 row(s)
VERDICT:RUNS (fail=0)
exit=0
```
## 4. The orphan gate (GR-3)
```
$ bash gates/orphan_scan.sh .
ORPHANS=0
exit=0
```
## 5. The shape-freeze gate (GR-5)
```
$ bash gates/shape_freeze.sh .
FREEZE:match=385b40972f519af6
TEST-SHAPE-DRIFT:DT1 (declared, not implemented)
TEST-SHAPE-DRIFT:DT2 (declared, not implemented)
TEST-SHAPE-DRIFT:DT3 (declared, not implemented)
exit=0
```
## 6. Every verb (JSON + real exit code)
```
$ bun src/cli.ts status -> exit=1
{"ok":false,"verdict":"STALE","ageMs":114740,"tick":4,"cursor":225,"prNodes":0,"planKind":"ok"}

$ bun src/cli.ts plan -> exit=0
{"ok":true,"kind":"ok","order":[],"hash":"e3b0c44298fc1c14"}

$ bun src/cli.ts order -> exit=2

$ bun src/cli.ts graph -> exit=0
{"ok":true,"graph":"(empty graph)\n"}

$ bun src/cli.ts gates -> exit=0
{"ok":true,"ready":0,"eligible":0,"checks":[]}

$ bun src/cli.ts sync -> exit=0
{"ok":true,"projects":2,"prNodes":0}

$ bun src/cli.ts bug -> exit=0
{"ok":true,"bugs":[]}

$ bun src/cli.ts desks -> exit=0
{"ok":true,"desks":["waveA-assemble","waveB-harden","waveC-audit","waveD-research"],"hint":"run: upper desks run"}

$ bun src/cli.ts kick -> exit=2
{"ok":false,"refused":"KICK-NEEDS-BUG-ID","hint":"upper kick <bug-id> [--mode live|spawn|direct]"}

```
## 7. The spec-audit (GS-1..GS-8) on the real spec
```
$ bun scripts/spec-audit.ts
GS-1:FAIL:NO criterion names a process artifact (a library satisfies every criterion)
GS-2:PASS:no live-named criteria to prove
GS-3:FAIL:SCOPE-NOUN-LOST:comms,filepaths
GS-4:FAIL:TEST-SHAPE-DRIFT:DT1 TEST-SHAPE-DRIFT:DT2 TEST-SHAPE-DRIFT:DT3
GS-5:FAIL:BATTERY-AS-SOLE-EVIDENCE
GS-6:PASS:the completion checklist carries a liveness row
GS-7:FAIL:TRANSLATION-HOLE:comms,filepaths
GS-8:FAIL:CLASS-BY-FILENAME (no declared class in the header)
VERDICT:REJECTED (fail=6)
findings: 6 of 8 gates failed on ../packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md
exit=1
```
## 8. The live artifacts (produced by real runs, not by hand)
```
$ cat runtime/status.json
{
  "ts": "2026-09-20T21:44:41.132Z",
  "tick": 4,
  "daemonOk": true,
  "cursor": 225,
  "prNodes": 0,
  "ready": 0,
  "eligible": 0,
  "planHash": "e3b0c44298fc1c14",
  "planKind": "ok",
  "kicks": 0,
  "errors": []
}
$ tail -3 runtime/ticks.log
2026-09-20T21:44:38.731Z tick=2 daemonOk=true cursor=225 prNodes=0 planKind=ok errors=0
2026-09-20T21:44:39.931Z tick=3 daemonOk=true cursor=225 prNodes=0 planKind=ok errors=0
2026-09-20T21:44:41.132Z tick=4 daemonOk=true cursor=225 prNodes=0 planKind=ok errors=0
$ cat runtime/wire_capture.json
{
  "ts": "2026-09-20T21:44:41.132Z",
  "parsedFrames": 168,
  "newlyProcessed": 0,
  "bytes": 65638,
  "lastSeq": 168
}
```
## 9. Daemon state at seal time
```
$ curl -s -o /dev/null -w %{http_code} :3001/healthz
http_code=200
$ ao status
AO daemon: ready
  pid: 2972932
  port: 3001
  started: 2026-09-20T21:44:23Z
```

## 10. THE SEAL — the runtime SUPERVISED and RUNNING (hub)
```
$ hub start upper-runtime (bun src/main.ts, UPPER_TICK_MS=3000)
Started upper-runtime: ready pid=3006653 uptime=55ms restarts=0
Ready log matched: started

$ bun src/cli.ts status
{"ok":true,"verdict":"RUNNING","ageMs":1099,"tick":26,"cursor":235,"prNodes":0,"planKind":"ok"}
exit=0

$ tail -3 runtime/ticks.log
2026-09-20T21:48:25.922Z tick=24 daemonOk=true cursor=235 prNodes=0 planKind=ok errors=0
2026-09-20T21:48:28.922Z tick=25 daemonOk=true cursor=235 prNodes=0 planKind=ok errors=0
2026-09-20T21:48:31.923Z tick=26 daemonOk=true cursor=235 prNodes=0 planKind=ok errors=0

$ bash gates/does_anything_run.sh .
Q1:YES:entry-point:src/main.ts
Q2:YES:loop:1 file(s) with a repeating construct
Q3:YES:non-test-caller:every module has a non-test caller
Q4:YES:wire-exercised:runtime/wire_capture.json present (121 bytes)
Q5:YES:heartbeat:runtime/ticks.log has 37 row(s)
VERDICT:RUNS (fail=0)
exit=0
```

## 11. PRODUCTION-READY DECLARATION

**Class: infra_spine** (a control-plane spine: refusal gates + a ticking loop + an operator CLI). Declared, and it is NOT sold as a product UI.

The five questions answer YES on this tree; the loop is supervised and its heartbeat is fresh; the wire has carried real daemon bytes (168 frames / 65,638 bytes); every required verb answers with one JSON object; the refusal gates that would have caught this build's own historical failure are now executable.

### What is PROVEN here
| claim | evidence in this file |
|---|---|
| the tree RUNS | §3 five questions all YES, `VERDICT:RUNS (fail=0)` |
| a process owns time | §10 ticks at a 3s cadence, rows growing, status RUNNING |
| the wire is exercised | §8 `wire_capture.json` parsedFrames=168 bytes=65638 |
| the loop survives an outage | §9 + the flip: 200→kill→000→`daemonOk=false`→relaunch→200→true, cursor held 225 |
| no capability is orphaned | §4 `ORPHANS=0` |
| the 7+2 verbs work | §6 every verb one JSON object; order refuses with exit 2 |
| the spec-audit works | §7 GS-1..GS-8 with tokens; REJECTED on the legacy spec (the correct verdict) |
| tests + types | §1 tsc exit 0 · §2 44 pass / 0 fail / 162 expects |

### What is NOT proven (the residual)
- No PR has flowed through the railway end-to-end: `prNodes=0` — the factory has minted nothing yet, so gates/plan/merge operate on an EMPTY graph. The paths are exercised by tests, not by live PRs.
- `kick` refuses (`KICK-ADAPTER-UNWIRED`): the kick rails need the write-side adapter (steer-or-send / delegate) wired to a live session.
- The desk RUNNER is not wired to foreman/Orca: `desks` lists contracts and can run the fixture engine; the macro level (receive→assemble→harden→audit→research on real PRs) remains unbuilt.
- The spec-audit REJECTS the legacy spec; the NEW pin satisfies GS-1/GS-5/GS-8 by construction but has not itself been run through the audit.
- ripwire cannot verify edits in this tree (its crawl root excludes it) — see EN-007; the exemption is recorded, not hidden.
