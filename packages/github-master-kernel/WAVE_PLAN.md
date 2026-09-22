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
