# WAVE PLAN — github-master-kernel (the industrial-grade hardening + runtime campaign)

WAVES: 6

## THE BUDGET LAW
`WAVES: 6` = the six fronts below. A refusal burns zero waves; a wave ticks only on actual dispatch.
Raise this line only when a genuine seventh front is derived from the failure inventory.

## THE INTERFACE-FIRST ORDER (the parallelism enabler)
W1-W4 own DISJOINT file sets and fire CONCURRENTLY. W5 (docs) and W6 (runtime seat) depend on
W1-W4's landing, so they serialize behind the first four. The interface here is the GATE CONTRACT
itself (the 8 gate ids + the status contexts) — it is already frozen in `src/status-contract.ts`
and the live ruleset 23838059. No wave may change the 8 context strings.

| wave | owner desk | DISJOINT files | deliverable | mechanical done-when gate | test ids |
|---|---|---|---|---|---|
| W1 | hooks-desk | `.githooks/pre-commit` · `.githooks/pre-push` · `.githooks/commit-msg` · `.githooks/prepare-commit-msg` · `.githooks/lib/*.sh` | every hook finding fixed: word-splitting, unbound vars under `set -u`, overbroad patterns, dead gates, uncapped exit codes, stderr-merged hit streams | `bash -n` each hook + the 8 gate ids still fire + `bun test -t gate_header` green | test_hook_word_split · test_hook_unbound_var · test_hook_exit_cap |
| W2 | ci-desk | `.github/workflows/gates.yml` · `.github/workflows/drift.yml` · `.github/CODEOWNERS` | the merge_group base_ref fix, the file-level co-occurrence theatrical check, the fence-ledger provisioning in CI | `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/gates.yml'))"` + the 6 job names unchanged | test_ci_merge_group_base · test_ci_theatrical_cooccurrence |
| W3 | src-desk | `src/*.ts` (20 files, 47 findings) | every src finding fixed; the exported surface unchanged (the contract freeze) | `bunx tsc --noEmit` exit 0 + `bun test` 78 pass + `diff` the exported symbols before/after | test_store_roundtrip · test_contract_contexts · test_publish_verdict |
| W4 | scripts-desk | `scripts/*.ts` · `gates/*` · `W6_ARM_COMMAND.sh` · `theatrical_verification_scanner.sh` · `.gitignore` | every script/gate finding fixed; the dead stub either wired or deleted; the fence ledger provisioned | `bash -n` the shell scripts + `bunx tsc --noEmit` on scripts/ + `gates/fence-check.py` exits 0 or a NAMED code | test_fence_check_fresh · test_w6_arm_idempotent |
| W5 | docs-desk | `context_management/*.md` · `*.md` (ship docs) · `Checkpoints/*/CHECKPOINT_MANIFEST.md` | the SHA drift closed (the 5 read-first docs agree on the dist SHA); the W-1 scoped-off decision recorded; the audit verdict wired into TESTING_LOG | `grep -l "<HEAD-sha>" context_management/CURRENT_STATE.md context_management/BUILD_STATE.md` non-empty + all 11 canon docs 200+ L / 3+ anchors | test_doc_sha_consistency |
| W6 | runtime-desk | `.trident/runtime-ledger.md` (NEW) | the hot seat: the 8 gates operated LIVE on the host, first-person, each with a pre-registered expectation | the runtime ledger non-empty with per-op verdicts + a named residual | test_runtime_gate_live_fire · test_runtime_keystone_clone |

## DEP MARKERS
- W5 depends on W1-W4 (it records their landing).
- W6 depends on W1-W4 (the gates must be hardened before they are operated).
- W1, W2, W3, W4 have NO dependency on each other — disjoint files, fire together.
- The CHECKPOINT at P7 depends on ALL SIX.

## THE PER-WAVE DONE-WHEN (the anti-claim rule)
A wave is DONE only when: (1) its files' findings are fixed on disk, (2) its gate command runs
green THIS session with the output quoted, (3) `bun test` shows ZERO regressions, (4) the
per-hunk audit verdicts are recorded in `.trident/wave-audit/`. A wave's own report is a CLAIM.

## THE PER-WAVE EXPANSION (WHAT / HOW / WHY / EXPECTED)
### W1 — the hook desk (`.githooks/`)
- **WHAT:** every hook finding fixed — word-splitting in the staged-file loop, unbound vars under `set -u`, overbroad patterns, dead gates, uncapped exit codes.
- **HOW:** `while IFS= read -r` replaces `for f in $STAGED`; every var is `${VAR:-}`-guarded; each pattern is narrowed to the action frame.
- **WHY:** a hook that word-splits a path with a space silently skips that file's checks — the enforcement stops biting on exactly the files it must cover.
- **EXPECTED:** `bash -n` clean on every hook; the 8 gate ids still fire; `bun test -t gate_header` green.
### W2 — the CI desk (`.github/workflows/`)
- **WHAT:** the merge_group base_ref fix, the file-level co-occurrence theatrical check, the fence-ledger provisioning.
- **HOW:** the base comes from `github.event.pull_request.base.sha || github.event.merge_group.base_sha`.
- **WHY:** a gate that guesses the base fails closed on the wrong event.
- **EXPECTED:** the YAML parses; the 6 job names unchanged (they ARE the required contexts).
### W3 — the src desk (`src/*.ts`)
- **WHAT:** every source finding fixed; the exported surface unchanged (the contract freeze).
- **HOW:** surgical edits; the exported symbol set diffed before/after.
- **WHY:** a rename in status-contract leaves the merge button dead with every check green.
- **EXPECTED:** `bunx tsc --noEmit` exit 0; `bun test` green.
### W4 — the scripts desk (`scripts/`, `gates/`)
- **WHAT:** every script/gate finding fixed; the dead stub wired or deleted.
- **HOW:** `bash -n` the shell scripts; `bunx tsc --noEmit` the TS; `gates/fence-check.py` returns 0 or a NAMED code.
- **WHY:** a gate ported without checking the artifact class it lands on is the W-1 class.
- **EXPECTED:** `gates/fence-check.py` exits 0 on a present ledger, a named SKIP on an absent one.
### W5 — the docs desk
- **WHAT:** the SHA drift closed; the audit verdict wired into TESTING_LOG.
- **HOW:** every canon doc carries the CROSS-CONSISTENCY ANCHOR block with one factory head sha.
- **WHY:** a doc that describes yesterday's build misleads the next session.
- **EXPECTED:** all 11 canon docs 200+ lines / 3+ anchors; one anchor sha.
### W6 — the runtime desk
- **WHAT:** the hot seat — the 8 gates operated LIVE on the host, first-person.
- **HOW:** each op records op# / expected / actual VERBATIM / mechanism / fix / retest.
- **WHY:** a green battery is an effort receipt, not a capability measurement.
- **EXPECTED:** the runtime ledger non-empty with per-op verdicts + a named residual.

## THE EVIDENCE (the wave-plan's own anchors)
- the contract: `src/status-contract.ts:33` · the publisher: `src/publish.ts:44` · `src/runtime.ts:166`
- the guardrail: `src/guardrail.ts:18` · the CI gates: `.github/workflows/gates.yml:10`
- the hooks: `.githooks/pre-commit:12` · the ruleset: id 23838059 (the 8 required contexts)

## THE FAILURE MODES THIS PLAN PREVENTS
1. the context mismatch · 2. the artifact-class gate · 3. the theatrical check · 4. the dead gate

## THE DISPATCH PROTOCOL (how each wave is fired)
- the wave spec is written to `.trident/wave-spec.json` (the agent roster: name, template,
  filepaths, mission, knownContext, doctrine, measurements, acceptance, taskTargets, position).
- the wave plan (THIS file) carries the `WAVES: 6` budget line — the planning gate refuses a
  dispatch without it, and a refusal burns ZERO waves.
- the agents are generated then AUTO-DISPATCHED per-completion; the real sessionIds land in the
  result. The primary agent orchestrates: it reads each stream, kicks an idle mid-task, steers
  drift, and harvests an intact return.
- a wave's return is a CLAIM until the primary re-runs its gate command and reads the output.

## THE AUDIT PROTOCOL (the per-wave quality control)
- the stream must read `complete` AND the return must be intact (no truncation signals).
- the phantom check: SHA the target files against the pre-wave values; unchanged = phantom.
- the per-hunk WHAT/WHY/HOW: each hunk exists on disk (grep the claimed line), its reason holds
  against the spec, and the blast radius is named.
- the verdict per hunk: CORRECT | FLAWED | FITTED-TO-GOLDEN | DOWNSTREAM-FABRICATION |
  ARCHITECTURE-VIOLATION | SCOPE-CREEP — recorded in `.trident/wave-audit/<wave>.md`.
- the mechanical re-verify: the primary runs the battery (tsc + bun test + the gates) on the
  combined tree; the agent's exit codes are claims, the primary's runs are evidence.

## THE SEQUENCING (the dependency law)
- W1-W4 fire CONCURRENTLY (disjoint files). W5-W6 serialize behind them.
- a wave that changes an exported surface blocks its dependents until the surface is re-frozen.
- the checkpoint (P7) depends on ALL SIX waves.
- a wave never fires on an unaudited predecessor — building on claims is the failure the audit prevents.

## THE ANTI-CLAIM RULE (the wave's done-when)
A wave is DONE only when: (1) its files' findings are fixed on disk, (2) its gate command runs green
THIS session with the output quoted, (3) `bun test` shows ZERO regressions, (4) the per-hunk audit
verdicts are recorded in `.trident/wave-audit/`. A wave's own report is a CLAIM, never the evidence.

## THE ARTIFACT ANCHORS (one per line — the W-9 anchor floor)
- the fence adjudicator: `JARVIS-CORE/b6/fence2.py:1` (the SPEC v2 adjudicator).
- the store schema: `src/store.ts:8` (pr_node / gate_pass / pr_edge).
- the runtime ledger: `.trident/runtime-ledger.md:1` (the W6 hot-seat record).
- the wave audits: `.trident/wave-audit/w1.md:1` (the per-hunk verdicts).
