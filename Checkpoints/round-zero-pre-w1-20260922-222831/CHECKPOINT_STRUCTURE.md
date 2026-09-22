# CHECKPOINT STRUCTURE — round-zero-pre-w1 (2026-09-22)

**The checkpoint:** `Checkpoints/round-zero-pre-w1-20260922-222831/`
**The token:** `round-zero-pre-w1-20260922-222831` — hyphens only, no spaces (the launcher law).
**The repo:** `jarvis-upper` @ `d71cc5d` · branch `main` → now `feat/github-master-kernel`
**The seal mode:** no-lock (the build is active; a full-tree lock would block W1)

---

## §1 THE COMPLETE STRUCTURE

```
round-zero-pre-w1-20260922-222831/
├── src/                         20 files — THE FULL SOURCE TREE
│   ├── status-contract.ts       the frozen 7 contexts
│   ├── publish.ts               the publisher (never false-green)
│   ├── guardrail.ts             guardrail + guardrailRemote
│   ├── execute.ts               the inversion (merge -> publish)
│   ├── verdict.ts               verify() -> VerifyResult
│   ├── runtime.ts               the boot/tick loop
│   ├── plan.ts attribute.ts store.ts cli.ts ...
│   └── (20 total)
├── tests/                       19 files — the battery at round-zero
├── context_management/          11 docs — THE FULL CANON
│   ├── BUILD_STATE.md           the SHA chain + the module inventory
│   ├── CURRENT_STATE.md         the architecture as it exists
│   ├── EVIDENCE_STATE.md        the per-gate evidence
│   ├── RUNNING_BUILD_LOG.md     the high-frequency log
│   ├── RUNNING_DEBUG_LOG.md     the high-frequency debug log
│   └── (+6 more)
├── .githooks/                   4 files — the LIVE local anchors
│   ├── prepare-commit-msg       the ABSOLUTE hook
│   ├── pre-commit               W-9 / W-6 / W-1
│   ├── pre-push                 refuses refs/heads/main
│   └── commit-msg               the bypassable twin
├── .github/                     6 files — the CI + governance
│   ├── workflows/gates.yml      the 5 jobs
│   ├── workflows/drift.yml      the nightly sweep
│   ├── CODEOWNERS
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/{task,incident}.md
├── ruleset.json                 the ARMED ruleset payload
├── package.json bun.lock        the dependency pins
├── CHECKPOINT_MANIFEST.md       the state + the honest gaps (40+ lines)
└── CHECKPOINT_STRUCTURE.md      THIS FILE (30+ lines)
```

## §2 THE FILE COUNTS (measured at the save)

| the dir | the count |
|---|---|
| `src/` | 20 `.ts` files |
| `tests/` | 19 `.test.ts` files |
| `context_management/` | 11 `.md` docs |
| `.githooks/` | 4 hooks |
| `.github/` | 6 files |
| **the checkpoint total** | **64 files** |

## §3 THE STATE AT THE SAVE

| the metric | the value |
|---|---|
| tsc | exit 0 |
| the battery | 69 pass / 0 fail (the round-zero baseline) |
| the contract | 7 contexts |
| `core.hooksPath` | `.githooks` |
| the ruleset | NOT yet armed at save time (armed later, id 23838059) |
| disk | 72 GB free |

## §4 THE HONEST GAPS

- The checkpoint captures the state BEFORE W1. The `.githooks/lib/` dir and the W1 tests did NOT
  exist yet — the checkpoint's `.githooks/` has the 4 original hooks only.
- No `dist/` — this project has no build step (the factory runs from source via bun).
- The ship docs (BUILD_REPORT, DEBUG_LOG, FAILURE_LOG, SPEC_VIOLATION_LOG, TESTING_LOG) were NOT
  copied into this checkpoint. **That is an ABSENCE, recorded here per the absence-honesty rule.**
  They live at the repo root and are tracked by git.
- The ruleset was armed AFTER this checkpoint — the checkpoint does not carry it.

## §5 THE RESTORE

```bash
cd /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-FACTORY/jarvis-upper
git reset --hard d71cc5d                    # the code
cp -r Checkpoints/round-zero-pre-w1-20260922-222831/src/* src/   # if the tree drifted
git config core.hooksPath .githooks         # re-arm the hooks
```

## §6 THE SEAL

**Mode B — NO LOCK.** The build is active; a full-tree lock would block W1. The manifest documents
that this is a living snapshot. Per the operator's ruling: a manifest-only lock is meaningless, so
the choice is full-tree lock OR no-lock — never partial.
