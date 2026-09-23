# CHECKPOINT STRUCTURE — Checkpoints/github-master-kernel-final-audit-pass-20260923-080544

**MODE:** full-tree (src + tests + hooks + gates + scripts + canon + docs). NOT manifest-only.
**NAME:** hyphens only. **HEAD:** `d077bdf` (`d077bdf276d2a76aa98be2af69ebf13daeb856f5`).

## §1 THE MAP

```
Checkpoints/github-master-kernel-final-audit-pass-20260923-080544/
  src/            20 .ts — the kernel
  tests/          30 .test.ts — 94 pass / 0 fail + the 6 campaign pins
  .githooks/      the 4 hooks + 4 lib scanners
  .github/        the CI workflows + CODEOWNERS
  gates/          the 8-gate chain
  scripts/        spec-diff.ts, spec-audit.ts, interface-check.ts
  context_management/  11 canon docs (the read-first 5 agree on the HEAD sha)
  packages/       the build package + the vendored mission spec
  <the 6 ship docs> + OCR_ADJUDICATION.md + FINAL_VERDICT_SESSION3.md
  CHECKPOINT_MANIFEST.md · CHECKPOINT_STRUCTURE.md · DEPLOYED_SHA.txt
```

## §2 THE SEAL INVARIANTS

1. `src/` + `tests/` are the FULL trees (verified by count).
2. The docs are byte-identical COPIES at seal time.
3. `DEPLOYED_SHA.txt` records the exact HEAD.
4. The read-first 5 canon docs agree on the HEAD sha.
5. `Checkpoints/**` is NEVER edited after the seal (EN-110).

## §3 THE VERIFICATION COMMANDS

```
  bunx tsc --noEmit                    # exit 0
  bun test                             # 94 pass / 0 fail
  bash .trident/p5_corpus2.sh          # 13 pass / 0 fail
  bash .githooks/lib/scan-silent.sh    # 0 hits
  git rev-parse HEAD                   # d077bdf276d2a76aa98be2af69ebf13daeb856f5
```
