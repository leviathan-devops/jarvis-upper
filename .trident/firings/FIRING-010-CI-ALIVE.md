# ★ FIRING 010 — THE CI IS ALIVE AND JUDGING (2026-09-22)

**The first CI run created ZERO jobs. This run created SIX, all correctly named, and three of them
FAILED on REAL findings.** This is the enforcement working.

---

## §1 THE PROOF — the job-id defect is FIXED

```
run 35771345534 · event: pull_request · branch: feat/github-master-kernel

gates/diff-budget             | failure
gates/spec-gate               | failure
gates/issue-link              | success
gates/test                    | failure
gates/theatrical-verification | success    <- the NEW gate (W4, Jev 92)
gates/anti-theatrical         | failure
```

**Before (run 35769132155):** `X This run likely failed because of a workflow file issue` — **zero
jobs created.** The job KEYS contained slashes.

**After:** six jobs, their `name:` fields matching the armed ruleset's contexts character-for-
character. **The runtime proved the fix that four desk audits could not.**

## §2 ★ THE FINDING — the SAME ARTIFACT-CLASS DEFECT, FOURTH INSTANCE

**`gates/anti-theatrical` FAILED. The log names why:**
```
BAD=$(git log --format='%s' origin/main..HEAD | grep -vE '^(feat|fix|docs|test|...)(\([^)]+\))?: ' || true)
...
Merge f2e83d413b05a59a9b3d5af29e83bc95d73f266b into 06333fa595b54cdaead2938b44aac70128f3c551
##[error]Process completed with exit code 1.
```

**The offending subject is a MERGE COMMIT GITHUB ITSELF GENERATED** when it tested the PR merge.
Its format is `Merge <sha> into <sha>` — no semantic prefix, because **a machine wrote it.**

| the instance | the predicate | what was wrong |
|---|---|---|
| W-1 | `find src -newer dist` | the repo's LAYOUT |
| W-9 (004) | `wc -l` on a `.md` | the artifact CLASS (a GitHub template) |
| W-9 (005) | `wc -l` on a `.md` | the artifact CLASS (a checkpoint manifest) |
| the job id | the `name:` list | the KEY |
| **W-anti-theatrical** | the semantic-prefix regex | **the AUTHOR (a machine, not a human)** |

**THE LAW, EXTENDED AGAIN:** a gate is a **(predicate x artifact-class x author)** triple. A
predicate correct for human-authored text lands wrongly on machine-generated text. The fix is
`git log --no-merges` — the git-native exclusion.

## §3 THE SECOND REAL FINDING — an environment dependency

**`gates/test` FAILED: `69 pass / 3 fail`.** The three failures:
```
(fail) spec_audit: emits all eight GS verdicts with tokens
(fail) spec_audit: names the historical seam on the real spec
```
**THE ROOT CAUSE:** those tests read `../packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md`
— a path **OUTSIDE the repo.** It exists on the host but **NOT in a CI checkout.** The test passes
locally and fails in CI. **A REAL environment dependency, found only by running in the real
environment.**

## §4 THE TWO CORRECT FAILURES

| the gate | why it failed | correct? |
|---|---|---|
| `gates/spec-gate` | `spec-diff.ts` exits 1 — 6 of 20 spec items unmapped | **CORRECT** |
| `gates/diff-budget` | the branch diff exceeds 800 lines (15 commits) | **CORRECT** |

## §5 THE TWO CORRECT PASSES

| the gate | why it passed | correct? |
|---|---|---|
| `gates/issue-link` | the PR body carries `Closes #1` | **CORRECT** |
| `gates/theatrical-verification` | no tautological assertions found in `tests/**` | **CORRECT** |

## §6 THE ANCHOR LEDGER (verified this turn)

| the claim | the anchor |
|---|---|
| the CI workflow | `.github/workflows/gates.yml:10` (`anti_theatrical:`) |
| the job names | `.github/workflows/gates.yml:11` (`name: gates/anti-theatrical`) |
| the subject check | `.github/workflows/gates.yml:22` (the `git log` grep) |
| the armed ruleset | `ruleset.json:1` (id 23838059) |
| the PR | `pull_request` #2 on `leviathan-devops/jarvis-upper` |
| the run | `35771345534` |
| the local hook (the same class) | `.githooks/prepare-commit-msg:27` (the merge/squash exemption) |

**7 anchors, every one verified by `grep -n` / the actual API read this turn — none invented.**

## §7 ★ THE LESSON — THE RUNTIME SEAT, PROVEN IN THE FIELD

**Four desk audits passed this workflow file.** Every audit ran `yaml.safe_load` and checked the
`name:` list. **All six names were correct.** The KEY was wrong — and only GitHub's own parser
cares about the key.

**Then the FIRST real run found a SECOND defect in the same file** (the merge-subject scope) that
no audit had looked for.

**THE PATTERN:** every defect this build has found was found by RUNNING, not by reading. The
battery was green. The audits were green. The `INTERFACE:MATCH` was green. **The artifact was still
wrong.**

**This is the runtime-grade law, proven: a green battery is an effort receipt, not a measurement.**

## §8 THE HONEST REMAINDER

- The CI has run TWICE: once rejected (the job-id defect), once alive with 4 failures. **It has
  never gone green.**
- The 2 `factory/*` contexts still have no poster (W5 is wiring it).
- The 3 `spec_audit` failures are a real environment dependency — they need either the spec file
  vendored into the repo, or the tests skipped when it is absent.
- The `anti-theatrical` merge-subject scope is steered to W4 but NOT yet fixed.
