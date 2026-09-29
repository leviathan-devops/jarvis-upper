# PLANNING SUITE — THE FULL CLEANUP ITERATION (v2 of the master kernel)

## 0 THE CLASSIFICATION

**ARCHITECTURAL** — this is not a bounded change; it is the next forward iteration of
the entire kernel build: cleaning the git rails, wiring the common-sense firewall,
driving the first green merge, and mapping everything that currently exists into one
coherent dispatchable plan.

**THE INTENT (restated):** Wire every anti-derail gate to its exact git hook, clean
the git mess, drive the first green merge through the full chain, and produce the
build package for the next agent to execute — with the runtime as the only test.

**READ RECEIPTS:**
- brainstorming: READ — the law I carry is the HARD GATE (no implementation before
  the intent is approved; this plan IS the approval request)
- blueprinting: READ — the law I carry is the DIFFERENTIAL (the does-NOT column is
  the spec; MOVE 5: name the instrument, never ask the agent to be better)
- focus: READ — the law I carry is the ratio (measure >> write; the artifact carries
  evidence, never status)
- fable-plan: READ — the law I carry is the orchestrated evidence loop (one batch,
  one follow-up, the decision gate)
- trident-problem-solving: READ — the law I carry is the 3-cycle hard bound (past 3
  failed fix-verify cycles, hand back the diagnosis)

---

## 1 THE DIFFERENTIAL (what exists → does / does NOT)

| The artifact | What it DOES | What it does NOT do (the gap this plan closes) |
|---|---|---|
| The ruleset (23838059, active) | Blocks a merge without 8 green checks + approval | Does NOT verify the 2 factory/* contexts can ever go green (they never have) |
| The 4 local hooks (W-1..W-14) | Fire on every commit + push; block orphans, phantoms, stubs, silent fallbacks | Do NOT enforce the doc ratio (G-RATIO) or block dead-system checkpoints (G-SEAL) — both are DRAFTED but uncommitted |
| The 6 CI jobs | Run on every PR update; 5 green, 1 red | Does NOT include the ocr review as a bounded job (G-SCAN); the diff-budget is red (11217 > 10000, no `oversized` label) |
| The kernel service (active) | Ticks every 15s; syncs 9 PRs; drains the rail; errors=0 | Does NOT publish green factory/* on a real PR (the fence has never been driven green on a PR head) |
| The publisher (wired, ARMED) | POSTs factory/* on eligible PRs (proven with HTTP 201) | Has never posted `success` — every post has been `failure` (the fence exits 1 without a bound worktree) |
| The fence (fence2.py) | Adjudicates worktrees; proven GREEN on a fixture (exit 0, PASS, spec_bound:true) | Has never been driven green on a REAL PR's head worktree |
| The AO daemon (running) | 40 sessions, :3001 → 200, the kernel reads it | Does not enforce that a session's worktree is bound to a claimed head (the bind is the fence's job) |
| The goal pin (RUNTIME_OPERATIONAL) | Names the fence-green recipe, the 9 laws, the DONE = merge 200 | Is a PIN — it does not enforce; the gates do |
| The common-sense firewall (BLUEPRINT.md) | Names the 5 gates, the exact wiring, the build order | G-RATIO + G-SEAL are drafted in `.githooks/pre-commit` (uncommitted); G-RT is drafted in `gates/rt-preflight.sh` (untracked); G-SCAN + G-GREEN are pin laws (not hooks) |
| The 10 checkpoints | Sealed snapshots of the kernel's source at each milestone | All 10 are snapshots of a system that never drove a green (the G-SEAL class) |
| The 11 canon docs + 15 ship docs | The doc record of 4 sessions | The doc mass (35 commits) outpaced the code mass (45; see FAILURE_LOG.md:207) — the G-RATIO class |

---

## 2 THE REDUCED CORE (ONE mechanism)

**THE GREEN MERGE IS THE ONLY TERMINAL.** Every gate, every hook, every law exists to
force the system to post `factory/fence2 = success` on a real PR head and let the
merge through. Everything else is a prerequisite or a guard.

**The three derived laws:**
1. A gate whose DONE is a count is not a gate (G-GREEN).
2. A session that has not touched the runtime has not started (G-RT).
3. A commit whose mass is docs, or whose subject is a snapshot of a dead system, is
   not progress (G-RATIO + G-SEAL).

---

## 3 THE DESIGN (the canon's 5 mandatory sections)

### §5 THE ENFORCEMENT LAWS (each: the forbidden behavior → the mechanical consequence)

| Law | Forbidden behavior | Mechanical consequence |
|---|---|---|
| G-GREEN | A goal whose DONE is a quality count ("0 critical") | The pin is rejected on sight; the DONE must name a command whose exit code is the verdict |
| G-RT | A session starting with a dead runtime | `gates/rt-preflight.sh` exits 1; the session cannot proceed |
| G-RATIO | Doc commits outpacing code commits | `.githooks/pre-commit` exits 1 (REJECT(G-RATIO)) |
| G-SEAL | A Checkpoints/ commit before a fence PASS row | `.githooks/pre-commit` exits 1 (REJECT(G-SEAL)) |
| G-SCAN | A fix→scan→fix loop (> 1 scan round without a runtime event between) | The anti-derail table fires; the session returns to the runtime |
| L1 (runtime-only) | A source-level test reported as a system-level fact | The claim is VOID; only runtime artifacts count |

### §6 THE FALSIFICATION INSTRUMENTS

Every claim has a machine:
- "the runtime is up" → `curl :3001/healthz` (exit 0/1)
- "the kernel ticks" → `tail -1 runtime/ticks.log` (the row is the evidence)
- "the fence is green" → `fence2.py adjudicate` exit 0 + the ledger row
- "the publisher posts" → the GitHub API read-back (contexts: 2)
- "the merge is open" → `PUT /pulls/{n}/merge` → 200
- "the doc ratio holds" → `git log --format=%s | grep -c '^docs'` vs `'^fix'`

### §12 THE OPEN DECISIONS

| Decision | Default | Rationale |
|---|---|---|
| Does G-SCAN become a CI job or stay a pin law? | **CI job** (a 7th job that runs ocr scan once) | A CI job is mechanical; a pin law is a convention. The scanner is mandatory — making it a job enforces the bound. |
| Does the diff-budget use the `oversized` label or a higher budget? | **The label** (the designed escape hatch) | 11217 lines of real hardening work is legitimate; raising the budget weakens the gate for everyone. |
| Are the 10 checkpoints deleted or kept? | **Kept** (they are historical records) | G-SEAL prevents FUTURE dead-snapshot seals; the existing ones are the record of the failure. |

### §13 THE RESIDUAL (what remains unexercised)

1. The fence has never been green on a REAL PR head (only on the /tmp fixture).
2. The review source (verify's source 2) has never returned an approval.
3. pr_edge is empty — the dependency ordering has never run on a real edge.
4. No container test has exercised the full chain.
5. The ocr review has not run as a bounded CI job.

---

## 4 THE EVIDENCE (measured this session, cited)
<!-- anchors: src/main.ts:17 · src/runtime.ts:276 · .githooks/pre-commit:190
     gates/fence-check.py:29 · packages/common-sense-firewall/BLUEPRINT.md:1 -->

| Claim | Evidence |
|---|---|
| The ruleset is active | the rulesets API: 23838059 enforcement=active |
| The hooks fire on every commit | `git config core.hooksPath` = `.githooks`; every commit this session passed PRE-COMMIT |
| The CI runs on PR updates | the last run on `0ad92d2` head_sha, 5 success + 1 failure |
| The diff-budget is red | 11217 lines counted (measured) vs the 10000 budget |
| The kernel is live | `tick=3665 daemonOk=true prNodes=9 errors=0` (runtime/ticks.log:3665) |
| The AO daemon is up | :3001 → HTTP 200, 40 sessions |
| The publisher posts | HTTP 201 on TWO shas (be46bd66, 32a1db77), API-read-back |
| The fence goes green | `step-0 PASS fence_exit=0 spec_bound:true` (the ledger's last PASS row) |
| The merge is blocked | `PUT /pulls/2/merge` → 405, "2 of 8 required status checks have not succeeded" |
| G-RATIO + G-SEAL are drafted | `.githooks/pre-commit:190-213` (uncommitted) |
| G-RT is drafted | `gates/rt-preflight.sh` (untracked) |

---

## 5 THE APPROACHES (2 considered)

**A — Wire the gates, then drive the green (RECOMMENDED).** Commit the drafted
G-RATIO + G-SEAL + G-RT, fix the diff-budget with the label, then drive one real
change through the full chain (the worktree → the fence → the publisher → the merge).
Trade-off: the gates start enforcing immediately (before the green); the green is the
last step.

**B — Drive the green first, then wire the gates.** The green is the mission; the
gates can land after. Trade-off: a session without the gates can re-derail (the exact
failure class this plan exists to close). REJECTED: wiring the gates is 20 minutes;
driving the green is the mission; both fit.

**CHOSEN: A** — the gates enforce from the first commit of this iteration.

---

## 6 SUCCESS CRITERIA (command-verifiable)

| # | Criterion | The command | The pass |
|---|---|---|---|
| 1 | G-RATIO + G-SEAL are live in pre-commit | `grep -c 'G-RATIO' .githooks/pre-commit` | >= 1 |
| 2 | G-RT is tracked + executable | `bash gates/rt-preflight.sh` | exit 0 |
| 3 | The CI is 6/6 | the runs API | all 6 success |
| 4 | The fence is green on a REAL head | `fence2.py adjudicate <worktree>` | exit 0 |
| 5 | factory/fence2 = success on GitHub | the statuses API read-back | state: success |
| 6 | PR #2 merges | `PUT /pulls/2/merge` | 200 |
| 7 | The branch is clean | `git status --porcelain` | empty |

---

## 7 THE EXECUTION PLAN (the checklist + the gates)

```
┌────────────────────────────────────────────────────────────────────────┐
│  WAVE 1 — THE GIT RAILS (each is a commit; the hooks fire on each)    │
├────────────────────────────────────────────────────────────────────────┤
│  1.1 Commit G-RATIO + G-SEAL into .githooks/pre-commit               │
│      (already drafted at :190-213; `git add + commit`)               │
│      GATE: the pre-commit hook itself runs G-RATIO on the commit     │
│  1.2 Commit gates/rt-preflight.sh (G-RT)                             │
│      (already drafted; `git add + commit`)                           │
│      GATE: `bash gates/rt-preflight.sh` exits 0                      │
│  1.3 Add the `oversized` label to PR #2                              │
│      GATE: the diff-budget CI job goes green                          │
│  1.4 Verify: the CI is 6/6 on the next push                          │
├────────────────────────────────────────────────────────────────────────┤
│  WAVE 2 — THE GREEN WORKTREE (the fence's needs)                     │
├────────────────────────────────────────────────────────────────────────┤
│  2.1 Create a git worktree on a real branch                          │
│  2.2 Make a real change (a file, a fix)                              │
│  2.3 Write SPEC.md (v2) + init + invariant-sha + adjudicate          │
│      GATE: `fence2.py adjudicate` → PASS (exit 0)                     │
├────────────────────────────────────────────────────────────────────────┤
│  WAVE 3 — THE GREEN POST (the publisher)                             │
├────────────────────────────────────────────────────────────────────────┤
│  3.1 Insert the PR row + the 4 green gates at the worktree HEAD      │
│  3.2 Wait for the live tick to publish                               │
│      GATE: the GitHub API read-back shows factory/* = success         │
├────────────────────────────────────────────────────────────────────────┤
│  WAVE 4 — THE MERGE (the terminal)                                   │
├────────────────────────────────────────────────────────────────────────┤
│  4.1 The 8 required checks are green                                 │
│  4.2 PUT /pulls/2/merge → 200                                        │
│      GATE: the merge SHA in the ledger                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8 THE ANTI-PATTERNS (this design's failure classes)

| The failure class | The detection | The kill |
|---|---|---|
| The quality-bar DONE | the DONE clause contains a count, not a command | G-GREEN (the pin is rejected) |
| The dead-runtime session | the pre-flight exits 1 | G-RT (the session cannot start) |
| The doc-mass spiral | the doc count > the code count | G-RATIO (the commit is rejected) |
| The dead-snapshot seal | a Checkpoints/ commit with no PASS row | G-SEAL (the commit is rejected) |
| The scan treadmill | > 1 scan round without a runtime event | G-SCAN (return to the runtime) |
| The source-level pass reported as system-level | a claim with no runtime artifact | L1 (the claim is VOID) |
| The green-adjacent claim ("the publisher is ARMED") | armed is not green | L5 (only a success POST is green) |

---

## 9 OPEN DECISIONS (with defaults)

Already in §12 above. The operator may flip any default before Wave 1 fires.

---

## 10 THE RESIDUAL (NAMED)

Already in §13 above. Each item is a known gap, not a claim of completeness.

---

## 11 THE HANDOFF

**The next artifact:** `packages/full-iteration-v2/BUILD_PACKAGE.md` (the DPL1 spec +
the wave plan + the goal pin, produced by build-package)
**The owner skill:** build-package (the dense package pipeline)
**The consumer:** the next agent session (or this one, continuing)

---

## THE EXISTING-SYSTEM MAP (what currently exists, all of it)

```
jarvis-upper/
├── src/                          20 .ts, 2133 L — the kernel
│   ├── main.ts                   the entry (publishOpts WIRED)
│   ├── runtime.ts                boot/tick/stop + the rail drain
│   ├── guardrail.ts              eligibility + the mirror
│   ├── verdict.ts                the two-source law
│   ├── publish.ts                the status POSTer
│   ├── store.ts                  the railway + the FK migration
│   ├── sync.ts                   the AO → pr_node intake
│   ├── plan.ts                   the topo planner
│   ├── execute.ts                the ordered-merge path
│   ├── desks.ts                  the wave A-D fixture engine
│   ├── dossier.ts                the sha16 dossier law
│   ├── kick.ts                   live|spawn|direct rails
│   ├── attribute.ts              bug → commit → session
│   ├── reducers.ts               idempotent event reducers
│   ├── status.ts                 status.json + ticks.log
│   ├── cli.ts + cli-verbs.ts     the operator surface
│   ├── adapter-verbs.ts          the AO read surface
│   ├── graph.ts                  the PR DAG render
│   └── status-contract.ts        the FROZEN 8-context interface
├── tests/                        34 .test.ts, 2492 L
├── .githooks/                    4 hooks + 4 lib scanners
│   ├── pre-commit                W-1,6,9,13,14 + G-RATIO,G-SEAL (drafted)
│   ├── pre-push                  W-2, W-3
│   ├── commit-msg                W-8
│   ├── prepare-commit-msg        W-8
│   └── lib/                      pattern-header, scan-phantom,
│                                 scan-silent, scan-stub
├── .github/workflows/            gates.yml (6 jobs) + drift.yml
├── gates/                        fence-check.py + shape_freeze.sh
│                                 + rt-preflight.sh (G-RT, drafted)
│                                 + does_anything_run.sh + orphan_scan.sh
├── scripts/                      spec-diff.ts, spec-audit.ts,
│                                 interface-check.ts
├── ao-client/                    the typed AO bindings (144 routes)
├── packages/
│   ├── github-master-kernel/     the build package (DPL1, WAVE_PLAN,
│   │                             BLUEPRINT, GOAL_PIN, GATE_WIRING_PLAN)
│   ├── common-sense-firewall/    the firewall BLUEPRINT
│   ├── jarvis-upper-tier/        the vendored mission spec
│   └── full-iteration-v2/        THIS planning artifact
├── context_management/           11 canon docs
├── *.md                          15 ship docs (BUILD_REPORT, DEBUG_LOG,
│                                 FAILURE_LOG, TESTING_LOG, etc.)
├── Checkpoints/                  10 sealed snapshots (on disk, gitignored)
├── runtime/                      the LIVE artifacts (status.json,
│                                 ticks.log, wire_capture.json)
├── store.sqlite                  the kernel's railway (9 pr_node rows)
└── ruleset.json                  the ruleset definition (id 23838059)

THE SERVICES (all live):
  jarvis-upper.service     active, publisher ARMED
  ao-daemon                running on :3001 (40 sessions)
  jarvis-upper-watchdog    active (checks every 2 min)

THE GITHUB STATE:
  ruleset 23838059          active (8 checks + approval + non-ff)
  PR #2                     open, blocked, 129 commits
  the branch                pushed, CI 5/6 (diff-budget red)
  the factory contexts      posted (failure — the fence exits 1
                            without a bound worktree)
```
