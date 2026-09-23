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
