// GATE-HEADER STANDARD (W1 interfaces wave) — status-contract.ts.
// WHAT IT IS: the FROZEN status-context contract — the 8 external contexts the
//   ruleset waits on (gates/anti-theatrical · gates/issue-link · gates/spec-gate ·
//   gates/diff-budget · gates/test · gates/theatrical-verification · factory/fence2 · factory/verdict), the
//   internal->external GATE_TO_CONTEXT mapping, and the POST statuses shape.
// JEV RATIONALE: derived, not invented — it closes the measured mismatch below
//   (guardrail's 4 internal gate names vs the ruleset's 7 external contexts,
//   ZERO spelling overlap). DPL1 §5 names the class: a predicate (the publisher
//   POSTing a state) without its artifact class (the exact context strings the
//   ruleset waits on) leaves the merge button dead with every check green.
// ARTIFACT CLASS: a TypeScript module consumed by the hooks, the publisher,
//   and the ruleset — scripts/interface-check.ts asserts it matches ruleset.json.
// FROZEN: do not rename entries without updating the ruleset in lockstep.
// status-contract.ts — FROZEN STATUS-CONTEXT CONTRACT (source of truth).
//
// WHY THIS FILE EXISTS — the mismatch:
//   src/guardrail.ts required 4 INTERNAL gate names:
//     ["ci_green", "audit", "hardened", "fence2"]
//   while the ruleset requires 8 EXTERNAL status contexts:
//     gates/anti-theatrical · gates/issue-link · gates/spec-gate ·
//     gates/diff-budget · gates/test · gates/theatrical-verification · factory/fence2 · factory/verdict
//   ZERO spelling overlap. A publisher POSTing `fence2` while the ruleset
//   waits for `factory/fence2` leaves the merge button dead forever with
//   every check green. This file freezes the internal->external mapping so
//   guardrail, store, and (later) the publisher can never drift apart.
//
// FROZEN: the 8 strings in REQUIRED_CONTEXTS and the POST shape
//   POST /repos/{owner}/{repo}/statuses/{sha}
//   { "context": "factory/fence2", "state": "success"|"failure"|"error",
//     "description": "<=140 chars" }
// Do not rename entries without updating the ruleset in lockstep.

export const STATUS_CONTEXTS = {
  fence2: "factory/fence2",
  verdict: "factory/verdict",
} as const;

export const GITHUB_JOB_CONTEXTS = [
  "gates/anti-theatrical",
  "gates/issue-link",
  "gates/spec-gate",
  "gates/diff-budget",
  "gates/test",
  "gates/theatrical-verification",
] as const;

export const REQUIRED_CONTEXTS = [
  ...GITHUB_JOB_CONTEXTS,
  STATUS_CONTEXTS.fence2,
  STATUS_CONTEXTS.verdict,
] as const;

// The factory's INTERNAL gate names -> the EXTERNAL status contexts.
// ci_green = the six GitHub jobs; hardened folds into factory/verdict.
export const GATE_TO_CONTEXT = {
  ci_green: GITHUB_JOB_CONTEXTS,
  audit: [STATUS_CONTEXTS.verdict],
  hardened: [STATUS_CONTEXTS.verdict],
  fence2: [STATUS_CONTEXTS.fence2],
} as const;

export type StatusContext = (typeof STATUS_CONTEXTS)[keyof typeof STATUS_CONTEXTS];
export type PublishState = "success" | "failure" | "error";

export interface PublishPayload {
  context: string; // one of REQUIRED_CONTEXTS
  state: PublishState;
  description: string; // <= 140 chars
}
