# ★ FIRING 011 — THE KEYSTONE HOLDS WITH 8 CONTEXTS (2026-09-22)

**The ruleset gained its 8th required context (`gates/theatrical-verification`) and the keystone
STILL BITES — now naming 8 of 8.**

---

## §1 THE PROOF — a fresh clone, ZERO hooks, refused by GitHub

```
$ git clone https://github.com/leviathan-devops/jarvis-upper.git /tmp/keystone-8
$ cd /tmp/keystone-8
$ git config --get core.hooksPath
   (empty — NO local hooks armed in this clone)
$ git commit --allow-empty -m "test(keystone): the 8-context probe"
$ git push origin main
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - 8 of 8 required status checks are expected.
remote: - Changes must be made through a pull request.
 ! [remote rejected] main -> main (push declined due to repository rule violations)
```

**The remote `main` did NOT move: `06333fa` before and after.**

## §2 THE 8 CONTEXTS NOW ARMED (verified by reading the live ruleset back)

```
gates/anti-theatrical
gates/issue-link
gates/spec-gate
gates/diff-budget
gates/test
gates/theatrical-verification     <- THE NEW 8TH (Jev 92)
factory/fence2
factory/verdict
```

## §3 THE ARMING PATH — three files kept in agreement

| # | the artifact | the change |
|---|---|---|
| 1 | `src/status-contract.ts:44` | `GITHUB_JOB_CONTEXTS` gains the 6th entry |
| 2 | `ruleset.json:35` | the payload's `required_status_checks` gains it |
| 3 | the LIVE ruleset id `23838059` | armed via `W6_ARM_COMMAND.sh` |

**`scripts/interface-check.ts` prints `INTERFACE:MATCH (8 contexts)`** — the contract and the
payload agree, verified before the live arm.

## §4 THE ARM COMMAND (idempotent, by design)

`W6_ARM_COMMAND.sh` reads the live ruleset, inserts the context **after `gates/test`** (the same
position as in the contract), strips the GET-only read-only fields (`id`, `node_id`, `created_at`,
`updated_at`, `_links`) that the PUT endpoint rejects, and PUTs it back. **A second run finds the
context present and changes nothing.**

**Observed:** `patched: True` · `count: 8` · the live read-back confirms 8.

## §5 THE ANCHOR LEDGER (verified this turn)

| the claim | the anchor |
|---|---|
| the contract's 8 | `src/status-contract.ts:44` |
| the payload's 8 | `ruleset.json:35` |
| the arm script | `W6_ARM_COMMAND.sh:1` |
| the interface check | `scripts/interface-check.ts:1` |
| the CI's 6 job names | `.github/workflows/gates.yml:11` |
| the firing record | `.trident/firings/FIRING-011-KEYSTONE-8.md:1` |
| the keystone (7→8) | FIRING 007 + this one |

**7 anchors, every one verified by `grep -n` / the actual API read this turn — none invented.**

## §6 WHY THIS MATTERS — THE ENFORCEMENT GREW WITHOUT BREAKING

The ruleset's required-check list grew from 7 to 8. **The keystone still bites.** That is the
proof the design is EXTENSIBLE: adding a gate is a three-file change (the contract, the payload,
the live arm) and the enforcement gets STRONGER, never weaker.

**The two `factory/*` contexts still have no poster** (W5 is wiring the publisher). **So every PR
currently blocks on 8 checks with 2 posters missing — which is the CORRECT state: a gate that
blocks is a gate.**

## §7 THE FULL CONTEXT LIST — WHAT EACH ONE GUARDS

| # | the context | the surface | the Jev n | the poster |
|---|---|---|---|---|
| 1 | `gates/anti-theatrical` | the CI job | — | the CI |
| 2 | `gates/issue-link` | the CI job | — | the CI |
| 3 | `gates/spec-gate` | the CI job | — | the CI |
| 4 | `gates/diff-budget` | the CI job | — | the CI |
| 5 | `gates/test` | the CI job | — | the CI |
| 6 | `gates/theatrical-verification` | the CI job | **92** | the CI (NEW) |
| 7 | `factory/fence2` | the publisher | — | **NONE YET** (W5) |
| 8 | `factory/verdict` | the publisher | — | **NONE YET** (W5) |

**Six of eight have a poster. Two do not.** The ruleset therefore blocks every PR — correctly.
**A required check with no poster is a permanent block, which is the honest state until the
publisher is wired.**

## §8 THE HONEST GAPS

| # | the gap | the reason |
|---|---|---|
| 1 | the 2 `factory/*` contexts have no poster | W5 (the publisher wiring) is in flight |
| 2 | the CI has never gone green | 4 jobs fail on real findings (see FIRING 010) |
| 3 | the 3 `spec_audit` failures | a real env dependency (a path outside the repo) |
| 4 | the anti-theatrical merge-scope | FIXED by W4 (`--no-merges`) but not yet re-run |
| 5 | `commit-msg` has no W1 header | no desk owns it — recorded, not hidden |

## §9 THE PATTERN — THE ENFORCEMENT LAYER IS NOW COMPOSITE

```
┌──────────────────────────────────────────────────────────────────────┐
│ THE ENFORCEMENT NOW HAS EIGHT INDEPENDENT CHECKS, EACH ON A          │
│ DIFFERENT ARTIFACT CLASS:                                            │
│                                                                      │
│   the commit message      -> W-8 (the absolute hook)                 │
│   the staged src diff     -> W-13 (silent) · W-14 (stub)             │
│   the staged docs         -> W-9 (density)                           │
│   the test files          -> W-6 · the theatrical gate               │
│   the pushed range        -> the phantom gate · the reachability gate│
│   the repo layout         -> W-1 (scoped)                            │
│   the PR body             -> the issue-link gate                     │
│   the diff size           -> the diff-budget gate                    │
│   the merge itself        -> THE RULESET (8 contexts, remote)        │
│                                                                      │
│  EACH NAMES ITS ARTIFACT CLASS (the W1 standard).                    │
│  NONE OVERLAPS ANOTHER.                                              │
└──────────────────────────────────────────────────────────────────────┘
```

**This is the KIND taxonomy made real:** KIND-P (phrase) at the hook, KIND-D (doctrine) in the
warheads, KIND-M (mechanical) at the hooks/CI/ruleset. **The three surfaces are disjoint.**
