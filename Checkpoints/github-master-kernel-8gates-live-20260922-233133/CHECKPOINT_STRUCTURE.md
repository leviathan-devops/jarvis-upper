# CHECKPOINT STRUCTURE — github-master-kernel-8gates-live

**The checkpoint:** `Checkpoints/github-master-kernel-8gates-live-20260922-233133/`
**The token:** hyphens only, no spaces (the launcher law).
**The repo:** `jarvis-upper` @ `3bc3b39` · branch `feat/github-master-kernel`
**The seal mode:** no-lock (Mode B — the build continues)

---

## §1 THE COMPLETE STRUCTURE

```
github-master-kernel-8gates-live-20260922-233133/
├── src/                         20 .ts — THE FULL SOURCE TREE
│   ├── status-contract.ts       the frozen 8 contexts
│   ├── publish.ts               the publisher (never false-green)
│   ├── guardrail.ts             guardrail + guardrailRemote
│   ├── execute.ts               the inversion (merge -> publish)
│   ├── verdict.ts               verify() -> VerifyResult
│   ├── runtime.ts               the boot/tick loop
│   └── (20 total)
├── tests/                       24 .test.ts — the battery
├── .githooks/                   THE LOCAL ENFORCEMENT LAYER
│   ├── prepare-commit-msg       the ABSOLUTE hook (W-8)
│   ├── pre-commit               W-9 · W-6 · W-1 · W-13 · W-14
│   ├── pre-push                 W-2 reachability + the main refusal
│   ├── commit-msg               the bypassable twin
│   └── lib/
│       ├── pattern-header.sh    THE W1 STANDARD
│       ├── scan-silent.sh       W-13 (Jev 119)
│       ├── scan-stub.sh         W-14 (Jev 68)
│       └── scan-phantom.sh      W-3 (Jev 70)
├── .github/                     THE REMOTE ENFORCEMENT LAYER
│   ├── workflows/gates.yml      6 jobs (the required contexts)
│   ├── workflows/drift.yml      the nightly sweep
│   ├── CODEOWNERS
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/{task,incident}.md
├── ruleset.json                 THE ARMED PAYLOAD (id 23838059, 8 contexts)
├── ruleset.RATIONALE.md         the stripped _comment
├── W6_ARM_COMMAND.sh            the idempotent arm script
├── scripts/                     3 files (interface-check, spec-diff, spec-audit)
├── gates/                       5 files (does_anything_run, orphan_scan, shape_freeze, fence-check)
├── context_management/          11 canon docs
├── BUILD_REPORT.md DEBUG_LOG.md FAILURE_LOG.md
├── SPEC_VIOLATION_LOG.md TESTING_LOG.md THEATRICALITY_LOG.md
├── .trident/
│   ├── RUNTIME_LEDGER.md        the 6 numbered operations
│   ├── P5_ADVERSARIAL_SWEEP.md  the 8-gate sweep
│   ├── firings/                 4 firing records (001, 007, 010, 011)
│   └── wave-audit/              9 per-wave audits
├── package.json bun.lock tsconfig.json
├── CHECKPOINT_MANIFEST.md       the state + the honest gaps
└── CHECKPOINT_STRUCTURE.md      THIS FILE
```

## §2 THE FILE COUNTS (measured at the save)

| the dir | the count |
|---|---|
| `src/` | 20 |
| `tests/` | 24 |
| `.githooks/` | 8 |
| `.github/` | 6 |
| `context_management/` | 11 |
| the ship docs | 6 |
| `.trident/firings/` | 4 |
| `.trident/wave-audit/` | 9 |
| `scripts/` | 3 |
| `gates/` | 5 |
| **the total** | **98 files · 820 KB** |

## §3 THE STATE

| the metric | the value |
|---|---|
| tsc | exit 0 |
| the battery | 77 pass / 0 fail / 322 expects |
| the contract | 8 contexts |
| the hooks | 8 files (4 hooks + 4 lib) |
| `core.hooksPath` | `.githooks` |
| the ruleset | ARMED, 8 contexts |
| the CI | 6 jobs, never green |
| the firings | 11 recorded (7 correct, 4 gate defects, all fixed) |

## §4 THE HONEST GAPS

- The 2 `factory/*` contexts have no poster (W5 in flight).
- The CI has never gone green (4 real failures).
- No container test exists.
- The AUDIT GATE is BLOCKED.
- The operator must rotate the token.

## §5 THE RESTORE

```bash
cd /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-FACTORY/jarvis-upper
git reset --hard 3bc3b39
cp -r Checkpoints/github-master-kernel-8gates-live-20260922-233133/src/* src/
git config core.hooksPath .githooks
```

## §6 THE SEAL

**Mode B — NO LOCK.** The build continues; the manifest documents that this is a living snapshot.
