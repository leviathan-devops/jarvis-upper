# PLAN A — THE FACTORY (the control plane) — WAVE PLAN

WAVES: 4

Base tree: jarvis-upper @ main · src/ = 1388 L across 19 modules
Interface contract: `src/status-contract.ts` (A-1 authors; Plan B reads ONLY)

## A-1 · INTERFACES  (owner: desk-a1 · dep: none)
files:   src/status-contract.ts (new) · src/guardrail.ts · src/store.ts
deliver: the frozen 7-context contract + the two rewire sites
done-when:
  - `bunx tsc --noEmit` exit 0
  - `node -e "import('./src/status-contract.ts').then(m=>console.log(m.REQUIRED_CONTEXTS.length))"` -> 7
  - `bun test tests/guardrail_stale.test.ts` pass
  - the `STALE-GATE:` token still present in src/guardrail.ts

## A-2 · PUBLISHER  (owner: desk-a2 · dep: A-1)
files:   src/publish.ts (new) · tests/publish_shape.test.ts (new)
deliver: publishStatus() with the frozen POST shape; rail-down -> state:'error' NEVER 'success'
done-when:
  - `bun test tests/publish_shape.test.ts` pass
  - a dry-run prints the exact POST body

## A-3 · GUARDRAIL  (owner: desk-a3 · dep: A-1)
files:   src/guardrail.ts · src/execute.ts · tests/execute_plan.test.ts · tests/guardrail_stale.test.ts
deliver: GitHub-sourced statuses (GET /commits/{sha}/statuses) + executePlan loses the merge call,
         gains the publish call (the adapter contract changes: merge() -> publish())
done-when:
  - `bun test tests/guardrail_stale.test.ts tests/execute_plan.test.ts` pass
  - `grep -c "adapter.merge" src/execute.ts` -> 0

## A-4 · INTEGRATION  (owner: desk-a4 · dep: A-2, A-3)
files:   src/verdict.ts · src/runtime.ts · tests/two_source_verdict.test.ts
deliver: verify() output -> the two statuses; the live E2E
done-when:
  - `bun test tests/live_e2e.test.ts tests/two_source_verdict.test.ts` pass
  - a scratch sha yields two statuses in `GET /statuses`
