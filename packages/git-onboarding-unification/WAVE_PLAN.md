# WAVE PLAN — GIT-ONBOARDING UNIFICATION

**WAVES: 5**

Interfaces land in W1. W2/W3/W4 are DISJOINT and run CONCURRENTLY. W5 is the integration +
runtime seat (depends on W2+W3). The board is initialized BEFORE the first dispatch.

## W1 — THE INTERFACE (must land first; everything else consumes it)

| field | value |
|---|---|
| owner | desk-interface |
| disjoint files | `src/attach.ts` (NEW — the pure plan + the apply + the step table) |
| deliverable | `AttachOpts` · `AttachPlan` · `AttachStep` · `AttachResult` types; `attachPlan` PURE; `attachApply` the only mutator |
| gate | `bunx tsc --noEmit` exit 0 AND `bun test -t test_attach_plan_is_pure` PASS |
| derives from | DPL1 §2.3 + §3 FR-1 |

## W2 — THE VERB (consumes W1)

| field | value |
|---|---|
| owner | desk-verb |
| disjoint files | `src/cli-verbs.ts` · `src/cli.ts` |
| deliverable | `verbAttach` (parse → attachPlan → attachApply → the JSON out) + the `attach` registration (allowance + the VERBS map) |
| gate | `bun src/cli.ts attach --help`-equivalent exit 2 with usage; `bun test -t test_attach_is_idempotent` PASS; `bun test -t test_attach_dry_changes_nothing` PASS |
| derives from | DPL1 §3 FR-1/FR-9 |

## W3 — THE GUARDS (consumes W1) — the three measured defect classes

| field | value |
|---|---|
| owner | desk-guards |
| disjoint files | `src/attach-guards.ts` (NEW) · `src/enroll.ts` (REUSE only) · `src/projects.ts` (the registry helpers) |
| deliverable | `assertHooksPath` (B3) · `mergeRegistry` (B6) · `planGate` (B5) |
| gate | `bun test -t test_attach_asserts_the_hooks_path` PASS (incl. the missing-dir negative) · `bun test -t test_attach_registry_keeps_the_legacy_project` PASS · `bun test -t test_attach_refuses_private_free_early` PASS |
| derives from | DPL1 §3 FR-2/FR-5/FR-6 |

## W4 — THE CARRIERS (disjoint from W2/W3 — the skill + the extension)

| field | value |
|---|---|
| owner | desk-carriers |
| disjoint files | `~/.omp/agent/managed-skills/project-on-git/SKILL.md` · `~/.omp/agent/extensions/<the-agent-carrier>/index.ts` |
| deliverable | the skill rewritten around `upper attach` (FR-10) + the ABIDE carrier hook (FR-11, the B8 fix) |
| gate | the skill's own validator PASS + a live firing of the invariant with `ttsr.enabled=false` |
| derives from | DPL1 §3 FR-10/FR-11 |

## W5 — THE INTEGRATION + THE RUNTIME SEAT (after W2+W3)

| field | value |
|---|---|
| owner | the orchestrator (the hot seat — runtime-grade) |
| disjoint files | none (it OPERATES; fixes route back to the owning wave) |
| deliverable | BOTH live builds attach; the daemon's next tick arms them; the ledger gains a fence row for each |
| gate | `bun src/cli.ts projects` → both `ok:true` AND `grep '"seat":"<id>"' verdicts.jsonl` returns rows for BOTH (FR-12) |
| derives from | DPL1 §3 FR-12 + the RUNTIME SEAT section of the pin |

## THE BOUNDARY CHECKS (at every dependency point)

- T0 (after W1): `bunx tsc --noEmit` on the combined tree + the interface's consumers compile.
- T1 (after W2+W3+W4): the battery green on the COMBINED tree; the four new test files present.
- T2 (after W5): the ledger rows + the fleet green + the audit gate PASS.

## DEPENDENCIES

```
W1 (interface)
 ├── W2 (the verb)      ─┐
 ├── W3 (the guards)    ─┼── W5 (integration + the runtime seat)
 └── W4 (the carriers)  ─┘
```

W2/W3/W4 have DISJOINT file sets — dispatched as ONE batch. W5 fires only after the T1 boundary
check is green.

## THE PER-WAVE DONE-WHEN (the mechanical gates, spelled out)

**W1 — the interface.** `src/attach.ts` exists; `bunx tsc --noEmit` exits 0 with the file
imported by nothing; `bun test -t test_attach_plan_is_pure` PASSes (the tree is byte-identical
after a plan). The anchor: `src/attach.ts:153`.

**W2 — the verb.** `bun src/cli.ts attach <path> --dry` prints the 8 steps and exits 0 on a
satisfiable target, 2 on a refusal; a second `attach` reports `action:"noop"`. The anchors:
`src/cli-verbs.ts:351` (the verb), `src/cli.ts` (the allowance + the VERBS map).

**W3 — the guards.** `realDeps(kernel)` answers all five predicates; the three defect classes
refuse by NAME with a remedy: `ATTACH-HOOKS-INERT` (B3, `src/attach-guards.ts`), 
`ATTACH-PRIVATE-FREE-REPO` (B5), and the merge preserves the legacy project (B6,
`src/attach-guards.ts:41`).

**W4 — the carriers.** `project-on-git`'s steps 4-6 collapse into `upper attach`; the skill's own
validator PASSes; the ABIDE carrier fires the invariant with `ttsr.enabled=false`.

**W5 — the integration.** `bun src/cli.ts attach <each live build>` → the registry holds both; the
daemon's next tick arms them; the ledger gains a fence row per build. The anchor: the ledger
`verdicts.jsonl` + `runtime/<id>/ticks.log`.

## THE RISK REGISTER (each with its kill)

| the risk | the kill |
|---|---|
| the attach mutates before a gate passes | `attachPlan` is PURE; `attachApply` runs only after `plan.refused === undefined` |
| a refusal without a remedy | every `push()` refusal carries `remedy`; the tests assert `remedy` is non-empty |
| the registry loses the legacy project (B6) | `mergeRegistry` seeds/re-seeds it; the test asserts BOTH ids |
| the hooks end up inert (B3) | the three-part predicate + the loud `ATTACH-HOOKS-INERT` |
| the two live builds are damaged | the acceptance is READ-MOSTLY: attach copies the wiring + sets the config; the builds' SOURCE is never edited (the pin's HARD STOP) |
| the tests touch the LIVE registry | every test drives a TEMP kernel root (the test-isolation audit) |

## THE CROSS-WAVE INTERFACE (why W2/W3/W4 can run concurrently)

- W1 owns `src/attach.ts`; W2 owns `cli-verbs.ts` + `cli.ts`; W3 owns `attach-guards.ts` +
  `enroll.ts` + `projects.ts`; W4 owns the skill + the extension. **No file is shared.**
- The CONTRACT between them is `AttachDeps` (`src/attach.ts:103`) + the refusal vocabulary
  (`ATTACH-*`). W2 imports the type; W3 implements it; neither edits the other's file.
- A cross-wave change to the refusal vocabulary requires a W1 edit first (the interface owner) —
  the boundary check after W1 IS that gate.
