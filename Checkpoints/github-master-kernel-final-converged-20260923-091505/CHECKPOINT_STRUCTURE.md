# CHECKPOINT STRUCTURE — Checkpoints/github-master-kernel-final-converged-20260923-091505

**MODE:** full-tree. **NAME:** hyphens only. **HEAD:** `bfe939f` (`bfe939f05a1740756de6ebec3f52d65e534c84c5`).

## §1 THE MAP
```
Checkpoints/github-master-kernel-final-converged-20260923-091505/
  src/            20 .ts — the kernel
  tests/          32 .test.ts — 98 pass / 0 fail + the 8-case muse pin set
  .githooks/      the 4 hooks + the lib scanners
  .github/        the CI workflows + CODEOWNERS
  gates/          the 8-gate chain
  scripts/        spec-diff.ts, spec-audit.ts, interface-check.ts
  context_management/  11 canon docs (the read-first 5 agree on the HEAD sha)
  packages/       the build package + the vendored mission spec
  OCR_ADJUDICATION.md · FINAL_VERDICT_SESSION3.md · RUNTIME_LEDGER.md
  <the 6 ship docs>
  CHECKPOINT_MANIFEST.md · CHECKPOINT_STRUCTURE.md · DEPLOYED_SHA.txt
```

## §2 THE SEAL INVARIANTS
1. src/ + tests/ are the FULL trees (verified by count).
2. The docs are byte-identical COPIES at seal time.
3. DEPLOYED_SHA.txt records the exact HEAD.
4. Checkpoints/** is NEVER edited after the seal (EN-110).

## §3 VERIFY
```
  bunx tsc --noEmit   # exit 0
  bun test            # 98 pass / 0 fail
  git rev-parse HEAD  # bfe939f05a1740756de6ebec3f52d65e534c84c5
```
