# GITHUB_ENFORCEMENT_MAP — jarvis-upper

**The meta-analysis: what native GitHub rails this repository is missing, measured.**

**Date:** 2026-09-22 · **Subject:** `leviathan-devops/jarvis-upper` @ `86c8fdc`
**Method:** the mandated command set, run against the live repo and the worktree at
`/home/leviathan/JARVIS_WORKSPACE/jarvis-upper` this turn. Every row carries its evidence
command or its file:line. Anything unprovable is marked `UNPROVEN` in §12.

---

## 1. VERDICT

1. **PRIVATE repo, personal account, FREE plan.** Receipt:
   `gh api repos/leviathan-devops/jarvis-upper --jq .private` → `true`;
   `gh api user --jq .plan` → `{"collaborators":0,"name":"free","private_repos":10000}`.
2. **Pay? YES — GitHub Pro, $4/mo.** Proven necessary, not upsold. Receipt:
   `gh api repos/leviathan-devops/jarvis-upper/rulesets` →
   `{"message":"Upgrade to GitHub Pro …","status":403}`, while the **public** control
   `gh api repos/leviathan-devops/trident-brain/rulesets` → `[]` (available, none set).
   Same account, same plan, different visibility → the gate is `private + free`.
3. **The biggest hole: there is no `.github` directory at all.** Receipt:
   `gh api repos/…/contents/.github` → `404`. No workflow, no CODEOWNERS, no template —
   so GitHub has never been *told* anything about how this repo should be governed.
4. **Agents reach `main` today, and do.** `viewerPermission: ADMIN`,
   `viewerCanAdminister: true`; and `git log --first-parent origin/main` shows
   `86c8fdc`, `b40873f`, `06333fa`, `2d604d2`, `c47e521` all authored by
   `jarvis-upper <ops@local>` — **direct pushes, not merged PRs**.
5. **Zero required checks, because zero checks exist.** Receipt:
   `gh api repos/…/actions/workflows` → `{"total_count":0}`; `gh run list` → empty.
6. **PR #1 is OPEN with 26 commits, +423/-1 across 5 files, and `reviewDecision` empty.**
   Receipt: `gh pr view 1 --json number,additions,deletions,changedFiles,commits,reviewDecision`.
7. **Zero issues exist.** Receipt: `gh issue list --state all --limit 30` → empty. No work
   is bounded by an issue, so no `Done when:` predicate exists anywhere in the repo.
8. **The repo already has good commit hygiene by habit, not by rail.** Receipt:
   `git log --format=%s -40 | grep -cE '^(feat|fix|docs|test|…): '` → **23 conform, 4 do not**.
9. **The real gap is not discipline — nothing mechanical can refuse.** Every derailment in
   §4 was caught by a human or by luck. `THEATRICALITY_LOG.md` records **3 `OPERATOR-CAUGHT`**
   entries: the operator *was* the detector, because nothing else was.
10. **One line:** Pro converts the factory's gates into **required status checks** and
    `require-up-to-date` into the **native re-gate loop** — the rails that make a theatrical
    or unverified merge *structurally impossible* rather than merely discouraged.

---

## 2. IDENTITY AND AUTHORITY

```
$ gh repo view --json nameWithOwner,visibility,isPrivate,viewerPermission,viewerCanAdminister
{"nameWithOwner":"leviathan-devops/jarvis-upper","visibility":"PRIVATE","isPrivate":true,
 "viewerPermission":"ADMIN","viewerCanAdminister":true}

$ gh api repos/leviathan-devops/jarvis-upper --jq '{default_branch,allow_squash_merge,
    allow_rebase_merge,allow_merge_commit,delete_branch_on_merge,security_and_analysis}'
{"default_branch":"main","allow_squash_merge":true,"allow_rebase_merge":true,
 "allow_merge_commit":true,"delete_branch_on_merge":false,"security_and_analysis":null}
```

| Actor | Role | Can push `main`? | Can bypass a ruleset? | Should keep? |
|---|---|---|---|---|
| `leviathan-devops` (operator) | ADMIN / owner | YES | YES (owner) | **YES** — the only merge authority |
| `jarvis-upper <ops@local>` (agent) | committer on `main` | **YES today** | n/a (no ruleset exists) | **NO for `main`** — see §7 step 6 |
| GitHub Apps | none installed | — | — | n/a |
| other collaborators | none | — | — | n/a |

**Evidence for the agent-commits-on-main row:** `git log --first-parent origin/main -20
--format='%h %an %s'` lists ten consecutive commits authored `jarvis-upper`, e.g.
`06333fa chore: .omp-waves/ is LIVE tracker state …` and
`2d604d2 chore: final transcript commit`. None arrived through a PR.

**The bypass problem, per doctrine 8.** If the agent's token can admin-bypass a ruleset or
push to `main`, the rest of the design is theater. Today the agent does the latter
routinely. The fix is two-part and both parts are required: a ruleset with
`bypass_actors: []` (§7) **and** a separate agent PAT without admin scope (§11 step 6).

**Force-push history:** `UNPROVEN` — no reflog evidence of a force-push to `main` was
recoverable from this worktree (`git log --first-parent` shows a linear history, which is
consistent with never having force-pushed, but is not proof).

---

## 3. BLOCK B — WHAT GITHUB IS ALREADY DOING

Measured this turn against `leviathan-devops/jarvis-upper`. The usual hole is
`PRESENT / NOT ENFORCED`; here almost everything is `ABSENT`, which is simpler.

| Object | Present? | Enforced? | Evidence (command → output) |
|---|---|---|---|
| Ruleset on default branch | NO | n/a | `gh api …/rulesets` → `403 Upgrade to Pro` |
| Classic branch protection | NO | n/a | `gh api …/branches/main/protection` → `403` |
| Required PR before merge | NO | n/a | no protection object exists |
| Required approvals (N) | NO | n/a | `gh pr view 1` → `reviewDecision: ""` |
| Dismiss stale reviews | NO | n/a | — |
| Require CODEOWNERS review | NO | n/a | `gh api …/contents/.github` → `404` |
| Required status checks | NO | n/a | none exist to require |
| Strict up-to-date | NO | n/a | — |
| Block force push | NO | n/a | — |
| Block deletions | NO | n/a | — |
| Linear history | NO | n/a | all three merge methods allowed |
| Signed commits | NO | n/a | — |
| Tag protection | NO | n/a | no tags in the repo |
| `CODEOWNERS` | NO | n/a | `gh api …/contents/.github` → `404` |
| PR template | NO | n/a | `.github/PULL_REQUEST_TEMPLATE.md` → ABSENT on disk |
| Issue templates | NO | n/a | `.github/ISSUE_TEMPLATE` → ABSENT on disk |
| Environments + reviewers | NO | n/a | `gh api …/environments` → `{"total_count":0}` |
| Actions workflows | NO | n/a | `gh api …/actions/workflows` → `{"total_count":0}` |
| Actions runs | NO | n/a | `gh run list --limit 20` → empty |
| Dependabot | NO | n/a | `security_and_analysis: null` |
| Secret scanning / push protection | NO | n/a | same field |
| Code scanning / CodeQL | NO | n/a | same field |
| Projects | **YES** | **NOT ENFORCED** | `hasProjectsEnabled: true`, 0 projects used |
| Issues | **YES** | **NOT ENFORCED** | `hasIssuesEnabled: true`, **0 issues** |
| Auto-merge | not exposed | — | field absent from the repo API |
| Packages / Releases | NO | n/a | `latestRelease` absent; no packages |
| Pages / Wiki | NO | n/a | `hasWikiEnabled: false` |
| Discussions | NO | n/a | `hasDiscussionsEnabled: false` |
| Hooks / webhooks | NO | n/a | `gh api …/hooks` → `[]` |
| Merge methods | all three | — | `allow_{merge,squash,rebase}_merge: true` |
| Delete branch on merge | OFF | — | `delete_branch_on_merge: false` |

**Read the table as a whole.** The repo uses **one** native mechanism: `git push`. Issues
and Projects are *enabled and empty*. There is no `.github` directory, so GitHub reads
nothing from the repo to learn its own governance. **Every enforcement object is absent —
which means the fix is additive and nothing has to be unwound.**

---

## 4. BLOCK C — DERAILMENT ARCHAEOLOGY (proven rows only)

Sources: the repo's own ledgers — `FAILURE_LOG.md` (**9 `F-` entries**), `DEBUG_LOG.md`
(**18 `EN-` entries**), `THEATRICALITY_LOG.md` (**5 `T-` entries, 3 `OPERATOR-CAUGHT`**) —
plus `git log`, `gh pr list`, `gh issue list`. Every row cites a hash, a PR number or a path.

| # | pattern | evidence (hash / PR / path) | the GitHub object that would have blocked it | present? |
|---|---|---|---|---|
| C1 | Direct push to `main`, no PR, no check | `86c8fdc`, `b40873f`, `06333fa`, `2d604d2`, `c47e521` — `git log --first-parent origin/main` | **ruleset `pull_request`** | NO |
| C2 | A PR with no linked issue | PR #1 body has no `Closes #N`; `gh issue list` → 0 | **check `gates/issue-link`** | NO |
| C3 | A PR with 26 commits and no review | PR #1 `reviewDecision: ""`, `commits: 26` | **required approvals + `require_last_push_approval`** | NO |
| C4 | Unpushed work sitting on `main` | `git status -sb` → `## main...origin/main [ahead 2]` | **check `gates/sync`** or a scheduled drift job | NO |
| C5 | Theatrical completion — a goal stamped on a fixture battery | `FAILURE_LOG.md` F-01 | **check `gates/spec-gate`** (a PASS row or no merge) | NO |
| C6 | Spec-scope silent drop (items 15 + 20) | `FAILURE_LOG.md` F-02 | **check `gates/spec-gate`** | NO |
| C7 | Test substitution (pre-written tests weakened) | `FAILURE_LOG.md` F-03 | **check `gates/test-strength`** | NO |
| C8 | Wave presentation inflation | `FAILURE_LOG.md` F-04 | **check `gates/anti-theatrical`** | NO |
| C9 | A false failure report published from a status field | `THEATRICALITY_LOG.md` T-01 `OPERATOR-CAUGHT` | **check `gates/claim-evidence`** | NO |
| C10 | Operating on another session's artifact (~50% spillover) | `FAILURE_LOG.md` F-07; `THEATRICALITY_LOG.md` T-02 | **path ruleset + check `gates/namespace`** | NO |
| C11 | A serviceless factory — loop dead 8,680s, no unit | `FAILURE_LOG.md` F-08 | **check `gates/liveness`** (a fresh receipt) | NO |
| C12 | A blocked audit reported as a pass | `FAILURE_LOG.md` F-09 | **check `gates/audit-gate`** (BLOCKED ≠ PASS) | NO |
| C13 | A silent zero (`ok:true` with `prNodes:0`) | `DEBUG_LOG.md` EN-010 | **check `gates/no-silent-zero`** | NO |
| C14 | A stale pin accepted then refused by the fence | `DEBUG_LOG.md` EN-013; commit `c1ff936` | **check `gates/pin-fresh`** | NO |
| C15 | 4 of 27 commit subjects off-convention | `git log --format=%s -40` → 23 conform / 4 not | **check `gates/anti-theatrical`** (subject rule) | NO |
| C16 | `.gitignore` silently clobbered (a `dist/` line lost) | commit `4c2210a` message records the fix | **check `gates/forbidden-paths`** | NO |
| C17 | A stale duplicate daemon — two writers, one store | `DEBUG_LOG.md` (the tick-counter interleave) | **check `gates/single-writer`** | NO |

**The pattern across all seventeen rows:** each was caught by a human, or by a later lucky
observation. **None was caught by a machine.** `THEATRICALITY_LOG.md`'s three
`OPERATOR-CAUGHT` entries are the receipt: the operator was the detector of record.

**The anti-theatrical predicates, run on the tree right now:**

```
$ grep -rnE "except:[[:space:]]*pass|catch[[:space:]]*\{[[:space:]]*\}|as an AI|implement later" \
    src/ ao-client/
  hits: 0
$ grep -rnE "[T]ODO|[F]IXME" src/
  hits: 0
$ git log --format='%s' -40 | grep -cE '^(feat|fix|docs|test|build|refactor|blueprint|goal|chore|spec|perf)(\([^)]+\))?: '
  23
$ git log --format='%s' -40 | grep -vcE '^(feat|fix|docs|test|build|refactor|blueprint|goal|chore|spec|perf)(\([^)]+\))?: '
  4
```

**This tree already satisfies the predicates.** That is the correct way to introduce a gate:
it enforces a standard the code already meets, and it refuses the regression that has not
happened yet. A gate that would fail on day one teaches the team to bypass it.

---

## 5. BLOCK D — LIFECYCLE RAIL MAP

The lifecycle of **this** project: a control plane that projects PRs into a railway
(`src/sync.ts:17`), orders merges (`src/plan.ts:8`), gates eligibility
(`src/guardrail.ts:12`), publishes a two-source verdict (`src/verdict.ts:116`), and merges
through one confirm-gated path (`src/execute.ts:19`).

| # | step | the GitHub object that owns it | the fail-closed predicate | the agent MAY | only the human MAY |
|---|---|---|---|---|---|
| 1 | Intend work | an **Issue** with a `Done when:` line | no issue → no branch may cite it | open an issue | close it |
| 2 | Bound work | the issue's `Done when:` + a spec path | the command CI does not run → **fail** | propose the predicate | approve it |
| 3 | Slice | issue labels (`slice:a`, `slice:b`) | a slice with no label → the PR cannot name it | label its slice | relabel |
| 4 | Implement | a branch matching `ao/<session>/<topic>` | branch not matching → **fail** | push to its branch | — |
| 5 | Self-check (non-authoritative) | nothing — the TUI loop moves no ref | — | run anything | — |
| 6 | Open PR | **PR template** requiring `Closes #N`, spec path, evidence | missing `Closes #N` → **fail** | open the PR | — |
| 7 | Machine judge | **Actions** jobs whose names become required checks (§6) | any job non-zero → merge blocked | read the log, push a fix | — |
| 8 | Human / CODEOWNERS judge | **ruleset `pull_request`**: 1 approval, last-push approval, stale dismissal | no approval on the last push → blocked | request review | **approve** |
| 9 | Merge to protected ref | the **ruleset** on `main` + the factory's `executePlan({confirm:true})` (`src/execute.ts:24`) | any required check pending/failing → the button is dead | **never merge** | **merge** |
| 10 | Tag / release | a **tag ruleset** + a Release | a tag on a non-`main` sha → refused | draft notes | publish |
| 11 | Deploy (if one ever exists) | an **Environment** + required reviewers | not approved → no secret, no run | prepare | approve |
| 12 | Nightly drift | `on: schedule` workflow (the stale-gate sweep) | a gate older than its head → opens an issue | read it | — |
| 13 | Incident / revert | issue label `incident` + a revert PR through the same gates | a revert that skips the gates → blocked | open the revert | merge it |

**Every native integration that should exist for this repo**, grouped by what it enforces:

| integration | owns (step) | present? |
|---|---|---|
| Ruleset (branch) on `main` | 7, 8, 9 | **NO** |
| Ruleset (tag) on `v*` | 10 | **NO** |
| Push ruleset (path restrictions) | protecting `.github/**` | **NO** |
| Required status checks | 7 | **NO** |
| CODEOWNERS | 8 | **NO** |
| PR template | 6 | **NO** |
| Issue templates | 1, 2 | **NO** |
| Projects fields (`State`, `Gate`, `Verdict`) | 1-9 visibility | enabled, unused |
| Actions: test | 7 | **NO** |
| Actions: anti-theatrical | C8, C9, C15 | **NO** |
| Actions: spec-gate | C5, C6 | **NO** |
| Actions: diff-budget | C8 | **NO** |
| Actions: forbidden-paths | C16 | **NO** |
| Actions: goal-evidence | C5 | **NO** |
| Reusable workflows | one definition, N repos | **NO** |
| Concurrency groups | cancelling superseded runs | **NO** |
| Environments | 11 | **NO** |
| Actions secrets vs env secrets | 11 | **NO** |
| Dependabot | dependency drift | **NO** (plan-gated) |
| Secret scanning / push protection | the secret class | **NO** (plan-gated) |
| CodeQL | static analysis | **NO** (plan-gated; the factory has `ocr`) |
| Packages / Releases | 10 | **NO** |
| `workflow_dispatch` / `schedule` | 10, 12 | **NO** |
| `gh` as the agent API | every step | **YES — in use** |
| Merge queue | batching | **NO — do not adopt** (9 PR rows, 0 merges) |
| Workflow execution protections | who may run CI | **NO** |
| `pull_request_target` | — | **NEVER** — hands secrets to fork PRs |
---

## 6. THE ANTI-THEATRICAL WORKFLOW SPEC

**One file, `.github/workflows/gates.yml`, five jobs.** These job names become the required
checks — and the ruleset must be armed against the *observed* names, never a guessed one
(§11 step 3).

```yaml
name: gates
on: [pull_request, merge_group]          # merge_group only matters if a queue is added

jobs:
  anti-theatrical:
    name: gates/anti-theatrical          # <- becomes a required check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: no empty catch, no bare task-marker comment, no AI disclaimers
        run: |
          set -e
          HITS=$(grep -rnE 'except:[[:space:]]*pass|catch[[:space:]]*\{[[:space:]]*\}|[T]ODO|as an AI|implement later' \
                 src/ ao-client/ || true)
          if [ -n "$HITS" ]; then echo "$HITS"; exit 1; fi
      - name: every commit subject conforms
        run: |
          BAD=$(git log --format='%s' origin/${{ github.base_ref }}..HEAD | \
                grep -vE '^(feat|fix|docs|test|build|refactor|blueprint|goal|chore|spec|perf)(\([^)]+\))?: ' || true)
          if [ -n "$BAD" ]; then echo "$BAD"; exit 1; fi

  issue-link:
    name: gates/issue-link
    runs-on: ubuntu-latest
    steps:
      - name: the PR body must close an issue
        env: { BODY: '${{ github.event.pull_request.body }}' }
        run: |
          echo "$BODY" | grep -qE '(Closes|Fixes) #[0-9]+' || { echo "no Closes/Fixes #N"; exit 1; }

  spec-gate:
    name: gates/spec-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: every spec item maps to a changed file
        run: bun run scripts/spec-diff.ts
      - name: the fence must hold a PASS row for this sha
        run: python3 gates/fence-check.py "${{ github.sha }}"

  diff-budget:
    name: gates/diff-budget
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: refuse an unbudgeted diff
        run: |
          BASE=origin/${{ github.base_ref }}
          L=$(git diff --numstat $BASE..HEAD | awk '{s+=$1+$2} END {print s+0}')
          echo "lines=$L"
          if [ "$L" -gt 800 ] && ! echo '${{ toJSON(github.event.pull_request.labels.*.name) }}' | grep -q oversized; then
            echo "over budget without the oversized label"; exit 1; fi

  test:
    name: gates/test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun install --frozen-lockfile
      - run: bun test                                   # 62 pass / 0 fail today
      - run: bunx tsc --noEmit                          # exit 0 today
      - run: bash gates/does_anything_run.sh .          # VERDICT:RUNS today
```

**Job-name → predicate → the repo's own law it enforces:**

| job name (as it appears in the UI) | fails when | the recorded derailment it closes |
|---|---|---|
| `gates/anti-theatrical` | an empty catch, a bare task-marker comment, an AI disclaimer, or a non-conforming subject | C8, C15 |
| `gates/issue-link` | the PR body has no `Closes #N` | C2 |
| `gates/spec-gate` | a spec item has no changed file, or the fence has no PASS row for the sha | C5, C6 |
| `gates/diff-budget` | the diff exceeds 800 lines without the `oversized` label | C8 |
| `gates/test` | `bun test` ≠ 0, `tsc` ≠ 0, or `does_anything_run.sh` ≠ RUNS | C7 |

**Exceptions — labels only a human may apply:** `oversized`, `no-test`, `spec-exception`.
Every other fail condition is closed to the agent.

**Rollout order (never enable a required check against a guessed name):**

```
1  land the workflow file        → a PR exists carrying .github/workflows/gates.yml
2  let it run GREEN              → read the ACTUAL names from `gh run list`
3  ruleset in EVALUATE mode      → observe; nothing blocks yet
4  ruleset in ENFORCE mode       → only after the names are observed green
```

---

## 7. THE RULESET SPEC

Target `refs/heads/main`, **`bypass_actors: []`** — the operator merges; nobody bypasses.

```json
{
  "name": "production-factory-gates",
  "target": "branch",
  "enforcement": "evaluate",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "gates/anti-theatrical" },
          { "context": "gates/issue-link" },
          { "context": "gates/spec-gate" },
          { "context": "gates/diff-budget" },
          { "context": "gates/test" },
          { "context": "factory/fence2" },
          { "context": "factory/verdict" }
        ] } },
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true } },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ],
  "bypass_actors": []
}
```

**Field by field, and the law each enforces:**

| field | value | the law it enforces | the repo's anchor for that law |
|---|---|---|---|
| `strict_required_status_checks_policy` | `true` | **the native re-gate loop** — when `main` moves, required checks are invalidated and re-run against the new base | replaces the unbuilt `regate.ts`; `src/guardrail.ts:23` already computes `STALE-GATE` |
| `dismiss_stale_reviews_on_push` | `true` | **one revision, two instruments** — a new commit kills the approval | `src/verdict.ts:174` (`targetSha === headSha`) |
| `require_last_push_approval` | `true` | the approver saw the *latest* push | same law, tightened |
| `required_review_thread_resolution` | `true` | an unresolved thread blocks the merge | the review findings the muse rail produced |
| `required_status_checks` (7 contexts) | — | **a merge requires every gate green on the head** | `src/guardrail.ts:10` (`REQUIRED_GATES`) + `src/verdict.ts:116` |
| `non_fast_forward` | — | the branch is addressable; its history is real | the rebase that orphaned `74f1b45a` |
| `deletion` | — | `main` cannot vanish | — |
| `bypass_actors` | `[]` | **the agent cannot skip what it must obey** | doctrine 8; C1/C10 |

**Two decisions stated rather than assumed:**

- **`strict_required_status_checks_policy: true` is the most valuable field in this document.**
  It is the entire post-merge re-gate loop — the thing the master blueprint listed as
  `regate.ts`, UNBUILT — expressed as one boolean that GitHub enforces for free once Pro is
  active. It also makes the factory's existing `STALE-GATE:<g>` reason (`src/guardrail.ts:23`)
  a *mirror* of GitHub's behaviour instead of a substitute for it.
- **`bypass_actors: []` means the owner obeys too.** An admin can still merge *after* the
  checks pass (bypass only skips the *waiting*). If a deliberate emergency path is wanted,
  add exactly one `bypass_actors` entry scoped to `RepositoryRole:admin` and log every use —
  but the default must be `[]`, or the ruleset is decoration.

---

## 8. CODEOWNERS DRAFT

```
# .github/CODEOWNERS
# Ownership routing. Enforced with Pro (require_code_owner_review).
# On free the file is advisory; it is still worth landing now.

*                       @leviathan-devops

# THE DECISION MACHINERY — a change here changes enforcement
/src/verdict.ts         @leviathan-devops
/src/guardrail.ts       @leviathan-devops
/src/execute.ts         @leviathan-devops
/src/plan.ts            @leviathan-devops

# THE GOVERNANCE SURFACE — only the operator edits the rules
/.github/               @leviathan-devops
/CODEOWNERS             @leviathan-devops
```

**Why the split is the point.** `src/verdict.ts:116` decides whether a job may be called
done; `src/guardrail.ts:12` decides whether a PR may merge; `src/execute.ts:24` is the only
path that calls a merge. **A PR that weakens any of those three is a PR that weakens
enforcement** — so they carry the same owner as `.github/` itself. A CODEOWNERS file that
lists only `*` would let an enforcement change ride in on a normal approval.

---

## 9. TEMPLATE DRAFTS

### 9.1 `.github/pull_request_template.md`

```markdown
## What
<!-- one paragraph -->

Closes #

## The spec this implements
<!-- a PATH, not a description. e.g. packages/jarvis-upper-tier/…_SPEC.md §6 item 13 -->

## Done when
<!-- the exact command a machine runs, pasted. CI must run it. -->
- [ ] `bun test`                    → 0 fail
- [ ] `bunx tsc --noEmit`           → exit 0
- [ ] `bash gates/does_anything_run.sh .` → VERDICT:RUNS

## Evidence
<!-- paste the command outputs, never a summary -->
```

### 9.2 `.github/ISSUE_TEMPLATE/task.md`

```markdown
---
name: Task
about: A unit of work with a mechanical done-when
labels: task
---
## The work
## Done when
<!-- a COMMAND, not a description. If CI cannot run it, it is not a predicate. -->
## The spec path
## Slices
```

### 9.3 `.github/ISSUE_TEMPLATE/incident.md`

```markdown
---
name: Incident
about: A production defect
labels: incident
---
## Symptom
## The artifact that proves it   <!-- a file path or a ledger row -->
## Origin commit / session
## The revert PR
```

---

## 10. WHAT I WILL **NOT** BUILD (homebrew to refuse)

Per doctrine 7 — *do not rebuild GitHub*. Each row is a thing that exists natively:

| do not build | use instead | why |
|---|---|---|
| a merge queue / batching engine | Enterprise queue, or **Mergify Free** | **not now** — 9 PR rows, 0 merges |
| a post-merge re-gate loop | **`strict_required_status_checks_policy: true`** | one boolean replaces `regate.ts` |
| approval invalidation | **`dismiss_stale_reviews_on_push: true`** | mirrors `src/verdict.ts:174` |
| a required-check gate inside the factory | **required status checks** | the factory *publishes*; GitHub *enforces* |
| a PR-template validator | the **template** + `gates/issue-link` | — |
| a "who may merge" ACL | the ruleset's **`bypass_actors`** | — |
| a per-path ownership map | **CODEOWNERS** | — |
| a deploy-approval gate | **Environments + required reviewers** | — |
| a nightly drift runner | **`on: schedule`** | — |
| a status dashboard | **Projects** (enabled, unused) | — |
| a release/tagging system | **Releases + a tag ruleset** | — |
| a secret scanner | **secret scanning / push protection** | plan-gated |
| a static analyzer | **CodeQL** | plan-gated; the factory already has `ocr` |
| a webhook receiver | **repo webhooks** + the existing rail cursor (`src/runtime.ts:46`) | — |

**What the factory MUST keep building — because GitHub structurally cannot:**

| the factory's unique work | why GitHub cannot do it | anchor |
|---|---|---|
| **merge ORDER** | GitHub validates one PR at a time; it has no dependency graph | `src/plan.ts:8` |
| **collision detection** | GitHub has no file-overlap analysis across PRs | the derived surface graph (unbuilt) |
| **attribution** | GitHub has no session concept | `src/attribute.ts:87` |
| **the fence** | `fence2` is external to GitHub by design | `src/verdict.ts:32` |
| **the two-source verdict** | GitHub has one source: its own checks | `src/verdict.ts:116` |

---

## 11. COMMANDS THE OPERATOR RUNS NEXT

Numbered. Steps 1-2 are the operator's; 3+ are the build. No philosophy.

```
 1  UPGRADE to GitHub Pro
      UI: github.com/settings/billing → Pro → $4/mo
      PROVE: gh api repos/leviathan-devops/jarvis-upper/rulesets
             expected []        today 403 Upgrade

 2  LAND THE GOVERNANCE FILES (one PR, no product code)
      .github/workflows/gates.yml           §6
      .github/CODEOWNERS                    §8
      .github/pull_request_template.md      §9.1
      .github/ISSUE_TEMPLATE/task.md        §9.2
      .github/ISSUE_TEMPLATE/incident.md    §9.3
      PROVE: gh api repos/…/contents/.github --jq '.[].name'
             expected the five names    today 404

 3  LET THE WORKFLOW RUN GREEN ONCE
      PROVE: gh run list --limit 3
             READ the exact job names from the output — do not guess

 4  ARM THE RULESET IN **EVALUATE** MODE
      gh api repos/leviathan-devops/jarvis-upper/rulesets -X POST --input ruleset.json
      (enforcement: "evaluate" from §7)
      PROVE: gh api repos/…/rulesets --jq '.[].enforcement'
             expected "evaluate" — nothing blocks yet

 5  WATCH ONE PR, THEN FLIP TO **ENFORCE**
      gh api repos/…/rulesets/{id} -X PUT -f enforcement=active
      PROVE: a PR shows "Required" beside all seven contexts and the merge
             button is DISABLED while any is pending

 6  SEPARATE THE AGENT'S CREDENTIAL
      the agent gets a PAT with repo scope but NOT admin, so it cannot bypass
      the ruleset it must obey
      PROVE: gh api repos/… --jq .viewerPermission as the agent token
             expected WRITE, not ADMIN

 7  CONFIRM main CANNOT BE PUSHED DIRECTLY
      git push origin main            # as the agent identity
      PROVE: rejected with a protected-branch error — the receipt that the
             rails are live

 8  (optional, later) MERGIFY FREE — only if merge volume justifies batching
      today: 9 PR rows, 0 merges → NOT YET
```

---

## 12. WHAT I COULD NOT PROVE

Recorded rather than filled with a design, per the prompt's rule.

| claim | why it is unproven |
|---|---|
| `main` has never been force-pushed | no reflog evidence recoverable from this worktree |
| whether the agent's PAT holds admin scope | the token is not readable by me; `viewerPermission: ADMIN` is *this session's* view, which suggests it may |
| Dependabot / secret scanning availability on this plan | `security_and_analysis: null` — the API returns nothing, so availability is **unknown**, not absent |
| auto-merge availability | the field is absent from the repo API on this plan |
| Actions minutes sufficiency | `gh api …/actions/permissions` was not captured; free includes 2000 min/mo, Pro 3000 |
| the exact job names CI will produce | they do not exist until step 2 lands — hence step 3 says *read, do not guess* |

**No Block was starved of data.** Every mandated command returned, except
`gh api …/actions/permissions` (not captured) and `gh api …/branches/main/protection`
(a deliberate 403 that *is* the finding).

<!-- DOC-COMPLETE -->
