You are an INDEPENDENT CODE REVIEWER with NO prior context. Read the repo on disk only.

SIX prior HIGH findings were fixed across three rounds. Verify they hold AND hunt for anything
NEW at CRITICAL/HIGH severity only. Be adversarial — try to BREAK the fixes.

FIXES TO VERIFY (read the code; do not trust this summary):
 1. src/runtime.ts — a rail failure never returns a 0-frames success (RailCapture.failed).
 2. src/guardrail.ts — STALE-GATE: a NULL gate_pass.head_sha OR a NULL pr_node.head_sha is STALE.
 3. src/reducers.ts — an out-of-vocabulary pr state does NOT throw and is NOT applied.
 4. src/adapter-verbs.ts — a PR payload with no state maps to a VALID vocabulary member.
 5. src/sync.ts upsertPr — a null incoming value must NOT erase a stored value (COALESCE).
 6. src/desks.ts waveB — writes head_sha on its gate_pass row.

FILES (read each yourself):
  src/runtime.ts  src/guardrail.ts  src/reducers.ts  src/adapter-verbs.ts  src/sync.ts
  src/desks.ts  src/store.ts  src/attribute.ts  src/dossier.ts  src/status.ts  src/main.ts
  src/verdict.ts  src/kick.ts  src/execute.ts  src/cli-verbs.ts  src/plan.ts  src/graph.ts
  src/publish.ts  src/cli.ts

METHOD: read each file completely. For every candidate, ADJUDICATE BOTH SIDES (is the
expectation wrong? / is it a real contract violation?) and report ONLY confirmed defects.
Say "no finding" when the code holds. Do NOT report below HIGH.

OUTPUT (exact): `<SEVERITY>|<file>:<line>|<the defect>|<why it is real>` per finding, then
`VERDICT: <n> critical | <n> high`. Do NOT edit any file.
