# CHECKPOINT MANIFEST — github-master-kernel-8gates-live

**The token:** `github-master-kernel-8gates-live-20260922-233133` (hyphens only, no spaces)
**The date:** 2026-09-22
**The repo:** `jarvis-upper` @ `3bc3b39` · branch `feat/github-master-kernel`
**The seal mode:** **NO-LOCK** (Mode B — a living snapshot; the build continues)

---

## §1 THE STATE — WHAT IS VALIDATED

| the artifact | the state | the evidence |
|---|---|---|
| the battery | **77 pass / 0 fail / 322 expects** | `bun test` |
| tsc | **exit 0** | `bunx tsc --noEmit` |
| the contract | **8 contexts** | `bun -e import('./src/status-contract.ts')` |
| the ruleset (REMOTE) | **ARMED, id 23838059, 8 contexts, bypass_actors []** | `gh api .../rulesets` |
| the keystone | **PROVEN** — a fresh clone's push to main REFUSED (`GH013 8 of 8`) | FIRING 011 |
| the local hooks | **8 files** (4 hooks + lib/) + `core.hooksPath=.githooks` | `ls .githooks/` |
| the CI | **6 jobs**, run twice, never green | `gh run list` |
| the adversarial sweep | **8 gates, both halves, 2 defects fixed** | `.trident/P5_ADVERSARIAL_SWEEP.md` |
| the runtime seat | **6 numbered operations, all expectations recorded** | `.trident/RUNTIME_LEDGER.md` |

## §2 THE COMPLETE CONTENTS

| the dir | the count |
|---|---|
| `src/` | 20 `.ts` files |
| `tests/` | 24 `.test.ts` files |
| `.githooks/` | 8 files (4 hooks + 4 lib scanners) |
| `.github/` | 6 files (2 workflows + CODEOWNERS + template + 2 issue templates) |
| `context_management/` | 11 canon docs |
| the ship docs | 6 (BUILD_REPORT, DEBUG_LOG, FAILURE_LOG, SPEC_VIOLATION_LOG, TESTING_LOG, THEATRICALITY_LOG) |
| `.trident/firings/` | 4 firing records |
| `.trident/wave-audit/` | the per-wave audits |
| `scripts/` · `gates/` | 3 · 5 files |
| **the total** | **98 files · 820 KB** |

## §3 THE HONEST GAPS

- **The 2 `factory/*` contexts have NO poster.** W5 (the publisher wiring) is in flight — the
  ruleset blocks every PR on 8 checks with 2 posters missing.
- **The CI has NEVER gone green.** It ran twice: once rejected (the job-id defect), once alive with
  4 failures on real findings.
- **The 3 `spec_audit` failures** read a path OUTSIDE the repo — a real environment dependency.
- **`commit-msg` has no W1 header** — no desk owns it.
- **No container test exists.** The rig has not been stood up.
- **The AUDIT GATE is BLOCKED** — no independent code-audit artifact exists. `BLOCKED` is never
  `PASS`.
- **The operator must ROTATE the GitHub token** — it was pasted into the chat transcript.

## §4 THE RESTORE

```bash
cd /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-FACTORY/jarvis-upper
git reset --hard 3bc3b39                        # the code
cp -r Checkpoints/github-master-kernel-8gates-live-20260922-233133/src/* src/                         # if the tree drifted
cp -r Checkpoints/github-master-kernel-8gates-live-20260922-233133/.githooks . && git config core.hooksPath .githooks   # re-arm the hooks
```

## §5 THE SEAL

**Mode B — NO LOCK.** The build continues. Per the operator's ruling, a manifest-only lock is
meaningless; the choice is full-tree lock OR no-lock — never partial.
