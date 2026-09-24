# BLUEPRINT — THE GITHUB MASTER KERNEL (jarvis-upper)

## §1 THE PURPOSE
An ENFORCEMENT LAYER that makes agent-produced work mechanically unmergeable unless it is verified.
Three layers, one contract:
- LAYER 1 — the LOCAL HOOKS (`.githooks/`): block bad commits/pushes before they leave the machine.
- LAYER 2 — the CI WORKFLOWS (`.github/workflows/gates.yml`): the 6 server-side gate jobs.
- LAYER 3 — the REPOSITORY RULESET (id 23838059, `production-factory-gates`): the server-side
  enforcement that REFUSES a direct push to main and requires all 8 status contexts.

## §2 THE CONTRACT (the frozen interface — never changed by any wave)
`src/status-contract.ts` exports the 8 required status contexts (verified: LEN=8):
```
gates/anti-theatrical · gates/issue-link · gates/spec-gate · gates/diff-budget
gates/test · gates/theatrical-verification · factory/fence2 · factory/verdict
```
These SAME 8 strings appear in: the ruleset's `required_status_checks`, the CI job names, and the
contract module. Any drift between the three = the enforcement silently stops biting.

## §3 THE 8 LOCAL GATES (the W-nn lexicon)
| gate | name | the defect class it catches |
|---|---|---|
| W-1 | deploy-freshness | the dist is older than the src (a stale build shipped) — **SCOPED OFF: `[ -d extensions ]` is FALSE here; the gate cannot fire in this repo** |
| W-2 | orphan | a module with 0 non-test callers |
| W-3 | phantom | a claimed file change that is not on disk |
| W-6 | fake-wiring | `.includes("<Symbol>")` used as a wiring assertion instead of a real import |
| W-8 | claim-without-artifact | a commit message claiming success with no file:line / sha evidence |
| W-9 | thin-doc | a .md under the line floor with too few anchors |
| W-13 | silent-fallback | `catch {}` / `?? 0` that swallows a failure |
| W-14 | stub | an empty function body shipped as done |

## §4 THE DATA FLOW (the keystone)
```
agent commit  → prepare-commit-msg (W-8: claim→evidence)  → pre-commit (W-6,W-9,W-13,W-14)
              → [push] → pre-push (W-2,W-3)  → [remote] → ruleset 23838059
              → requires 8 contexts → CI gates.yml (6 jobs) → statuses
              → the publisher (src/runtime.ts:233) POSTs the verdict to the PR
```
The KEYSTONE (PROVEN, FIRING 011): a fresh clone's direct push to main is REFUSED with
`GH013` + `8 of 8 required status checks are expected`.

## §5 THE MODULE MAP (src/, 20 files carrying findings)
`status-contract.ts` (the frozen contract) · `runtime.ts` (the publisher call site) · `verdict.ts`
(8 findings) · `kick.ts` (5) · `desks.ts` (4) · `guardrail.ts` (4) · `cli-verbs.ts` (4) ·
`attribute.ts` (3) · `adapter-verbs.ts` (3) · `cli.ts` (3) · `sync.ts` (3) · `plan.ts` (3) ·
`publish.ts` (3) · `dossier.ts` (2) · `execute.ts` (2) · `main.ts` (2) · `status.ts` (2) ·
`graph.ts` (1) · `reducers.ts` (1) · `store.ts` (1)

## §6 THE FAILURE MODES (what the hardening campaign targets)
1. **WORD-SPLITTING** (`for f in $CHANGED`) — a path with a space breaks the loop. The fix:
   `while IFS= read -r` over NUL-delimited input.
2. **UNBOUND-VAR UNDER `set -u`** (`local f="$1"` before the `${1:?}` guard) — the guard is dead
   code and the script dies on the variable instead of the named refusal.
3. **OVERBROAD PATTERNS** (`.includes("<Identifier>")` in tests/*.ts) — legitimate string
   containment assertions get rejected. The fix: narrow to source-text grep shapes.
4. **DEAD GATES** (`scan-phantom.sh` never sourced) — the gate exists on disk and never fires.
5. **UNCAPPED EXIT CODES** (`return "$hits"`) — 256 hits wraps to 0 = reports clean.
6. **STDERR-MERGED HIT STREAMS** (`2>&1`) — an internal error becomes a spurious reject.
7. **THE merge_group BASE BUG** — `github.base_ref` is empty on merge_group, so `origin/..HEAD` fails.
8. **THE SHA DRIFT** — the canon docs carry the W4-era shas, not HEAD.
9. **THE DEAD STUB** (`theatrical_verification_scanner.sh` — shebang + duplicate `set -e`, exits 0).

## §7 THE REPLICATION RECIPE (how to stand this up elsewhere)
1. `.githooks/` + `git config core.hooksPath .githooks`.
2. `src/status-contract.ts` — the 8 contexts.
3. `.github/workflows/gates.yml` — 6 jobs, each publishing one context.
4. The ruleset: `gh api repos/<owner>/<repo>/rulesets` with `required_status_checks` = the 8.
5. The keystone test: a fresh clone's push to main MUST be refused.

## §9 THE CONTRACT FREEZE (the interface that never moves)
The 8 status contexts are the frozen interface. They appear in THREE places that must never drift:
1. `src/status-contract.ts:33` — `REQUIRED_CONTEXTS` (the source of truth).
2. `.github/workflows/gates.yml` — the 6 CI job names (the `name:` field of each job).
3. the ruleset 23838059 — `required_status_checks[].context` (the server-side enforcement).
The keystone check is `scripts/interface-check.ts` — it prints `INTERFACE:MATCH` when all three
agree and exits 1 otherwise. A drift here is the exact failure this build exists to close.

## §10 THE TWO-SOURCE VERDICT LAW (why an approval alone is not enough)
A job is VERIFIED iff BOTH sources are green ON THE SAME HEAD SHA:
- SOURCE 1 (the fence): `fence2.py adjudicate <job> --expect-spec-sha <inv>` exits 0.
- SOURCE 2 (the review): an AO review run APPROVES that SAME head sha.
ONE source alone is UNVERIFIED. A stale sha on either is UNVERIFIED. The forbidden evidence set
(commit-exists, diff-changed, drift-gate-green, worker-tests-pass, PR-open, transcript-shows-spawn)
is never a source. The kernel's `verify()` (`src/verdict.ts:133`) enforces this.

## §11 THE HONEST GAPS (what this blueprint does not claim)
1. The factory/verdict context needs an AO review that APPROVES the head — a strict reviewer may
   legitimately withhold approval; the kernel correctly refuses to certify.
2. The merge needs a NON-PUSHER approval (ruleset 23838059); a single-identity host cannot supply it.
3. The fence ledger is a HOST artifact (gitignored); the CI's absent-ledger is a named SKIP, and
   the fail-closed check lives on the host (`.githooks/pre-commit:211`, G-SEAL).

## §12 THE THREE LAYERS IN DETAIL (each with its refusal)
LAYER 1 — the local hooks (`.githooks/`):
- `pre-commit:12` (W-9 doc floor): a staged `.md` under 100 lines or under 3 anchors → REJECT(W-9).
- `pre-commit:190` (G-RATIO): doc commits outpacing code commits → REJECT(G-RATIO).
- `pre-commit:211` (G-SEAL): no fence PASS row in the ledger → REJECT(G-SEAL).
- `pre-push:151` (W-2): an orphan/phantom diff on the pushed range → REJECT(W-2).
LAYER 2 — the CI workflows (`.github/workflows/gates.yml`):
- 6 jobs, each `name:` EQUAL to a required context; every job fails closed with exit 1.
- the base ref is the event payload's (`pull_request.base.sha` | `merge_group.base_sha`).
LAYER 3 — the ruleset (id 23838059, `production-factory-gates`):
- `required_status_checks`: the 8 contexts, `strict_required_status_checks_policy: true`.
- `pull_request`: 1 approval, dismiss-stale, thread-resolution required.
- `bypass_actors: []`, `current_user_can_bypass: never`, plus `non_fast_forward` + `deletion`.

## §13 THE MEASURED STATE (the blueprint's baseline)
- HEAD at the build package's landing: `4942188` (the kernel + the 6 gates + the ruleset wiring).
- the battery: 124 tests / 0 fail; `bunx tsc --noEmit` exit 0.
- the fence: proven GREEN (exit 0, PASS, spec_bound:true) on a real git worktree at the PR head.
- the live kernel: `factory/fence2=success` POSTed to the real head (the API read-back).
- the review loop: r1 (5 findings) → r2 (4) → r3 (3) → r4 (1) — the adversarial reviewer converges.
- the residual: the ruleset's non-pusher approval (a single-identity host cannot supply it).
