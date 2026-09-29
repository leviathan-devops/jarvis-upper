# ruleset.json — THE RATIONALE

**Why this file exists:** GitHub's ruleset API REJECTS unknown top-level fields. The `_comment`
that originally carried this rationale made `POST /repos/{owner}/{repo}/rulesets` return
`422 Invalid property /rules/1: data matches no possible input` — an error that points at the
RULES array while the actual offender is the top-level field. The desk that authored B-3
predicted this exact failure in its own report: *"if gh api ... rejects unknown fields, strip
`_comment` before POSTing — the 4 rule objects are unaffected."* **The rationale lives here; the
payload stays pure.**

---

## §1 THE ARMED STATE (measured 2026-09-22)

| the field | the value |
|---|---|
| `id` | `23838059` |
| `name` | `production-factory-gates` |
| `target` | `branch` |
| `enforcement` | **`active`** |
| `conditions.ref_name.include` | `["refs/heads/main"]` |
| `bypass_actors` | **`[]`** |
| the required contexts | **7** |

## §2 THE FOUR RULES, AND WHAT EACH ENFORCES

| the rule | what it enforces | the repo's own anchor for that law |
|---|---|---|
| `required_status_checks` | a merge requires every one of the 7 contexts green on the head | `src/guardrail.ts:10` (`REQUIRED_GATES`) |
| `pull_request` | 1 approval + last-push approval + stale dismissal + thread resolution | `src/verdict.ts:174` (`targetSha === headSha`) |
| `non_fast_forward` | the branch's history is real — no force-push | the rebase that orphaned `74f1b45a` |
| `deletion` | `main` cannot vanish | — |

## §3 `strict_required_status_checks_policy: true` — THE ONE BOOLEAN THAT REPLACES A MODULE

When `main` moves, the required checks on an open PR are invalidated and re-run against the new
base. **That is precisely `regate.ts`** — a module the factory's master blueprint lists and never
built — expressed as one boolean GitHub enforces for free. And the factory already computes a
mirror of it: `src/guardrail.ts:23` emits `STALE-GATE:<g>`. Today that reason is a substitute for
a mechanism that does not exist; after this it is a **mirror** of one that does.

## §4 `bypass_actors: []` — THE OWNER OBEYS TOO

An admin can still merge **AFTER** the checks pass — bypass only skips the **WAITING**. The
default must stay `[]`, or the ruleset is decoration. **Proven:** the push in FIRING 007 used the
ADMIN token and was still refused.

## §5 THE 7 CONTEXTS — AND WHY THEY ARE FROZEN

```
gates/anti-theatrical · gates/issue-link · gates/spec-gate ·
gates/diff-budget · gates/test · factory/fence2 · factory/verdict
```

The first five are the CI job names in `.github/workflows/gates.yml`. The last two are the
publisher's status POSTs. **All 7 are declared once in `src/status-contract.ts`** and asserted
against this file by `scripts/interface-check.ts` — which prints `INTERFACE:MATCH (7 contexts)`
or exits 1.

**The mismatch this file exists to prevent:** `src/guardrail.ts:10` named 4 INTERNAL gates
(`ci_green`, `audit`, `hardened`, `fence2`) while this ruleset requires 7 EXTERNAL contexts.
**Zero spelling overlap.** A publisher POSTing `fence2` while the ruleset waits for
`factory/fence2` leaves the merge button dead forever with every check green.

## §6 THE ROLLOUT LAW — AND THE PLAN CONSTRAINT

The design's intended rollout was `evaluate -> observe -> active`. **`evaluate` is
Enterprise-only** — measured: `422 Enforcement evaluate option is not supported on this plan.`
On the free plan the choice is binary: `disabled` or `active`. **Armed `active` directly.**

## §7 THE FREE-PLAN FINDING

`403 Upgrade to GitHub Pro` on a PRIVATE repo; `[]` on a PUBLIC one, same account, same plan.
**The gate is `private + free`.** Making the repo public enables the entire ruleset surface at
zero cost. That is why `jarvis-upper` is public.

## §8 THE VERIFICATION COMMANDS (each run this session)

```bash
# the ruleset is armed
gh api repos/leviathan-devops/jarvis-upper/rulesets --jq '.[] | {id,name,enforcement}'
# -> {"enforcement":"active","id":23838059,"name":"production-factory-gates"}

# the 7 contexts are the required checks
gh api repos/leviathan-devops/jarvis-upper/rulesets/23838059 \
  --jq '.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks[].context'

# the contract and the ruleset agree
bun run scripts/interface-check.ts
# -> INTERFACE:MATCH (7 contexts)

# the keystone: a fresh clone's push to main is refused
git clone <the repo> /tmp/probe && cd /tmp/probe && git push origin main
# -> remote: error: GH013: Repository rule violations found for refs/heads/main.
```

## §9 THE HONEST GAPS

| # | the gap | the reason |
|---|---|---|
| 1 | `evaluate` mode is unavailable | Enterprise-only; the rollout law is impossible on free |
| 2 | the CI has never RUN | no workflow run exists; the 7 contexts have never posted a real status |
| 3 | the two `factory/*` contexts have no poster | `src/publish.ts` exists but has never made a real POST |
| 4 | the ruleset has no tag protection | only `refs/heads/main` is covered |
| 5 | `require_code_owner_review: false` | the schema marks it required; CODEOWNERS is landed but not enforced |
| 6 | no environment-based deploy gate | out of scope for this kernel |

**A ruleset with 7 required checks and 0 posters means every PR blocks.** That is the CORRECT
state until the publisher is wired (W5) and the CI runs — a gate that blocks is a gate; a gate
that passes because nothing reports is theatre.
