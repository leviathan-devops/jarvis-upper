# jarvis-upper — the serviceless factory + its GitHub enforcement brain

`jarvis-upper` is a job factory: it takes tiered work (desks, verdicts, PRs),
adjudicates each unit through a fence, and orders merges only when every gate
holds. Two plans built it in parallel from a frozen interface:

- **Plan A (the factory):** `src/` — the status contract, the publisher, the
  guardrail, the executor, the verdict verifier.
- **Plan B (the GitHub brain):** `.github/`, `ruleset.json`, `.githooks/` — the
  surface that makes the factory's decisions unbypassable on GitHub.

The boundary between the plans is one executable file:

- `scripts/interface-check.ts:37` prints `INTERFACE:MATCH` when the 7 contexts
  in the contract equal the 7 contexts in the ruleset, and exits 1 otherwise.

## The 7 status contexts (frozen)

The single source of truth is `src/status-contract.ts:33`
(`REQUIRED_CONTEXTS`): five GitHub job names plus two factory statuses.

| # | Context | Producer |
|---|---------|----------|
| 1 | `gates/anti-theatrical` | CI job in `.github/workflows/gates.yml:10` |
| 2 | `gates/issue-link` | CI job in `.github/workflows/gates.yml:29` |
| 3 | `gates/spec-gate` | CI job in `.github/workflows/gates.yml:39` |
| 4 | `gates/diff-budget` | CI job in `.github/workflows/gates.yml:51` |
| 5 | `gates/test` | CI job in `.github/workflows/gates.yml:65` |
| 6 | `factory/fence2` | `src/publish.ts:62` via `publishVerdict` |
| 7 | `factory/verdict` | `src/publish.ts:62` via `publishVerdict` |

Do not rename entries without updating the ruleset in lockstep — a publisher
POSTing `fence2` while the ruleset waits for `factory/fence2` leaves the merge
button dead forever with every check green. That mismatch is why the contract
file exists (see its header at `src/status-contract.ts:1`).

## The two-plan architecture

### Plan A — the factory (`src/`)

- `src/status-contract.ts:20` — `STATUS_CONTEXTS`: `fence2` and `verdict`
  mapped to their `factory/` spellings.
- `src/status-contract.ts:25` — `GITHUB_JOB_CONTEXTS`: the five CI job names.
- `src/status-contract.ts:33` — `REQUIRED_CONTEXTS`: all seven, frozen.
- `src/status-contract.ts:41` — `GATE_TO_CONTEXT`: the factory's internal gate
  names (`ci_green`, `audit`, `hardened`, `fence2`) mapped to external contexts.
- `src/publish.ts:62` — a throwing fetch yields `state: "error"`, never a
  false `success`. The polarity law is proven by an adversarial probe, and the
  description is truncated to 140 chars in-function. See the header note at
  `src/publish.ts:8`.
- `src/guardrail.ts:50` — `guardrailRemote(opts)` reads `REQUIRED_CONTEXTS`
  from the contract at `src/guardrail.ts:69`. The legacy `guardrail(db, prId)`
  DB path is unchanged. The inversion: the factory ORDERS, GitHub decides MAY.
- `src/execute.ts:45` — on publish success the PR lands in `merge_ordered`,
  never `merged` (see the file header at `src/execute.ts:6`). The merge adapter
  is `{ publish(prId): Promise<{ok:boolean}> }`: `adapter.merge` count is 0,
  `adapter.publish` count is 1.
- `src/verdict.ts:1` — `verify(opts)` returns a verdict with `.verdict` and
  reasons including `FENCE-FAILED` / `REVIEW-STALE-SHA` (184 lines).

### Plan B — the GitHub brain (`.github/`, `ruleset.json`, `.githooks/`)

- `.github/workflows/gates.yml:10` — the 5-job gate workflow. Job names ARE
  the required checks. Only the plain `pull_request` trigger is used; the
  `_target` variant must never appear (it hands secrets to fork PRs).
- `ruleset.json:10` — `strict_required_status_checks_policy: true` is the
  free re-gate loop: when main moves, required checks are invalidated and
  re-run against the new base. `bypass_actors` is `[]` — the owner obeys too.
  `enforcement` is `evaluate` until the 7 contexts are observed green, then
  `active` (see the rollout note at `ruleset.json:35`).
- `.github/workflows/drift.yml:1` — the nightly drift sweep (ONE job named
  `drift`): the stale-gate sweep, the doc-floor sweep, the wiring sweep.
- `.githooks/prepare-commit-msg:39` — CHECK 1, the semantic prefix; line 47 is
  the W-8 claim-word check (a claim word needs a test count, a sha, or a
  `file:line` anchor).
- `.githooks/pre-commit:21` — the W-9 doc-density floor (`>= 100` lines);
  line 25 is the anchor floor (`>= 3` anchors); line 24 exempts `.github/*`
  templates (their length is set by GitHub's UI — see FIRING-004); line 76
  scopes W-1 to repos that actually have an `extensions/` directory.

## The gate surface (three layers)

1. **Hooks (local, fast, bypassable with `--no-verify`):** `prepare-commit-msg`
   is the anchor — W-8. `pre-commit` is dependency-free by design: W-9
   doc-density, W-6 source-string, W-1 deploy-freshness.
2. **CI (remote, unbypassable):** `gates.yml` — five jobs whose names become
   the required status contexts. `gates/test` runs `bun test`, `bunx tsc
   --noEmit`, and the liveness receipt.
3. **Ruleset (the lock):** `ruleset.json` — the 7 contexts required on `main`,
   one approving review with stale-review dismissal, no fast-forward, no
   deletion, zero bypass actors.

## How to run the battery

```bash
bunx tsc --noEmit          # expect exit 0 (whole tree)
bun test                   # expect 69 pass / 0 fail
bun run scripts/interface-check.ts   # expect INTERFACE:MATCH (7 contexts)
bash gates/does_anything_run.sh .    # expect VERDICT:RUNS (fail=0)
```

The drift sweeps run nightly via `.github/workflows/drift.yml:1`, or by hand
from the Actions tab (`workflow_dispatch`). The wiring sweep is the same
`interface-check.ts` command above; the job fails if it does not print
`INTERFACE:MATCH`.

## Where the canon docs live

- `context_management/EVIDENCE_STATE.md:1` — per-gate evidence with exact
  tokens. Copy the tokens and re-run the commands; they MUST reproduce.
- `context_management/BUILD_STATE.md` — the parallel-build state (340 lines).
- `context_management/NEXT_STEPS.md` — what remains (290 lines).
- `.trident/plan-A/wave-plan.md:3` and `.trident/plan-B/wave-plan.md:3` — the
  8-wave plans (4 + 4) with done-when predicates.
- `.trident/firings/FIRING-001.md:121` — all four live firings: 2 correct,
  2 gate defects (the layout-port defect and the artifact-class defect).
- `.trident/plan-A/wave-audit/` and `.trident/plan-B/wave-audit/` — per-wave
  mechanical re-verifies.

## The open operator action (Pro upgrade)

`ruleset.json:35` documents the rollout: `enforcement` is `evaluate` (observe
mode — nothing blocks yet). After the 7 contexts are observed green, flip to
`active` — but that requires the GitHub Pro upgrade, because free repos cannot
enforce required status checks. Until then: nothing arms, nothing POSTs to the
live API, no token exists. The factory orders; GitHub will decide MAY once the
upgrade lands.
