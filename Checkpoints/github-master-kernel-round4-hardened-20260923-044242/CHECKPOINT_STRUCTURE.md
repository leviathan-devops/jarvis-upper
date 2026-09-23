# CHECKPOINT STRUCTURE — Checkpoints/github-master-kernel-round4-hardened-20260923-044242

**MODE:** full-tree (src + tests + hooks + gates + scripts + canon + docs). NOT manifest-only.
**NAME:** hyphens only (`github-master-kernel-round4-hardened-<ts>`).
**HEAD:** `75d1dba` (full: `75d1dba3b97937a9a574e4b5028c1e27adf70751`).

## §1 THE DIRECTORY MAP

```
Checkpoints/github-master-kernel-round4-hardened-20260923-044242/
  src/                    20 .ts — the kernel (runtime, guardrail, verdict, publish, store, …)
  tests/                  29 .test.ts — the battery (85 pass / 0 fail) + the 4 new pins
  .githooks/              5 — pre-commit, pre-push, commit-msg, prepare-commit-msg + lib scanners
  .github/                the CI workflows + CODEOWNERS
  gates/                  the 8-gate chain (fence-check.py, shape_freeze.sh, …)
  scripts/                spec-diff.ts, spec-audit.ts, interface-check.ts
  context_management/     11 canon docs (all carry HEAD 75d1dba)
  packages/               the build package (DPL1_SPEC + WAVE_PLAN + BLUEPRINT) + the vendored mission spec
  BUILD_REPORT.md         the what-was-built record
  DEBUG_LOG.md            EN-129..EN-138 (this campaign's findings)
  FAILURE_LOG.md          the derailment ledger
  SPEC_VIOLATION_LOG.md   the spec-section mapping
  TESTING_LOG.md          the test plan + results + the AUDIT GATE line
  THEATRICALITY_LOG.md    the append-only theatricality journal
  OCR_ADJUDICATION.md     the per-finding adjudication (fixed vs refuted, with measurements)
  CHECKPOINT_MANIFEST.md  this checkpoint's state + HONEST GAPS
  CHECKPOINT_STRUCTURE.md this file
  DEPLOYED_SHA.txt        75d1dba3b97937a9a574e4b5028c1e27adf70751
```

## §2 THE SEAL INVARIANTS

1. `src/` + `tests/` are the FULL trees (not samples) — 20 + 29 files, verified by count.
2. The docs are COPIES of the repo's at seal time (byte-identical; `diff -q` proves it).
3. `DEPLOYED_SHA.txt` records the exact HEAD the tree was taken from.
4. The canon docs agree on HEAD `75d1dba` (the read-first contract).
5. `Checkpoints/**` is NEVER edited after the seal (a sealed snapshot must not drift — EN-110).

## §3 THE VERIFICATION COMMANDS (run from the repo root)

```
  bunx tsc --noEmit                    # exit 0
  bun test                             # 85 pass / 0 fail
  bash .trident/p5_corpus2.sh          # 13 pass / 0 fail
  bash .githooks/lib/scan-silent.sh    # 0 hits
  git rev-parse HEAD                   # 75d1dba3b97937a9a574e4b5028c1e27adf70751
```
