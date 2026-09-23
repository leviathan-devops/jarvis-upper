You are an INDEPENDENT CODE REVIEWER with NO prior context. Work ONLY from the repo on disk.

A previous review found 3 HIGH; they have been FIXED. Verify the fixes AND hunt for anything
new, at CRITICAL/HIGH severity only.

FILES (read each yourself):
  src/runtime.ts  src/guardrail.ts  src/reducers.ts  src/desks.ts  src/store.ts
  src/attribute.ts  src/dossier.ts  src/status.ts  src/main.ts  src/verdict.ts
  src/kick.ts  src/execute.ts  src/adapter-verbs.ts  src/cli-verbs.ts

THE THREE PRIOR FIXES TO VERIFY:
 1. runtime.ts defaultRails: a failure must NOT return a 0-frames success — RailCapture.failed
    now carries it and the tick reports rail-failed every tick.
 2. guardrail.ts STALE-GATE: a NULL gate_pass.head_sha must be STALE (fail-closed), not a
    free pass against any head.
 3. reducers.ts: an out-of-vocabulary pr state must NOT throw (no head-of-line block) and
    must NOT be applied.

METHOD: read each file completely; for every candidate, ADJUDICATE BOTH SIDES (is the
expectation wrong? / is it a real contract violation?) and report ONLY confirmed defects.
Say "no finding" when the code holds. Do NOT report below HIGH.

OUTPUT (exact):
  `<SEVERITY>|<file>:<line>|<the defect>|<why it is real>` per finding, then:
  `VERDICT: <n> critical | <n> high`
Do NOT edit any file.
