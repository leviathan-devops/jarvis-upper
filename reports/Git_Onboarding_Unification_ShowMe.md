# GIT-ONBOARDING UNIFICATION — THE FIX PLAN (ShowMe v1)

**Series:** kernel-operations (the jarvis-upper enforcement kernel)
**Trigger:** two live builds, both failing to reach the DoD — `jev-fact-kernel` (attach path, 245
commits) and `PLUTUS_VISION` (skill path, 12 commits). Measured 2026-10-02.
**The objective (verbatim):** *"either this happens naturally on every single build or it's a
simple one click attach command … that immediately puts the project onto the rails for this
kernel and everything works correctly. No bugs, no derailments, no broken anything."*

---

## §0 — THE MEASURED BUG INVENTORY (every one from live evidence)

**THE ROOT CAUSE (found while implementing — it invalidated the first multi-project run):**
`src/runtime.ts:470` passed `root` (the KERNEL's own root) to the target guard instead of
`project.root`, so every project was checked against the kernel tree's origin.
`src/main.ts:50` ran that check at CONSTRUCTION and stored `rt:null` on failure, so a refused
project never ticked. `src/projects.ts:178` refused an ambiguous registry read, which broke every
CLI test once a second project existed. The health fields are `src/status.ts:14` +
`src/status.ts:49`.

| # | the bug | the live evidence | the class |
|---|---|---|---|
| B0 | **the guard read the WRONG TREE** (`root` vs `project.root`) | `TARGET-MISMATCH: …/jarvis-upper.git != …/jev-fact-kernel` — the kernel's URL named for a build tree | wrong-scope read |
| B1 | **a project with no remote is DARK for the daemon's whole life** | `jev-fact-kernel` `ok=false` every boot; per-project `ticks.log` = **1 row in 2 h** | no-retry / no-record |
| B2 | **the target check runs at CONSTRUCTION, not per tick** | `src/main.ts:50` → `rt:null` → `rt.tick()` never runs | unhealable state |
| B3 | **`core.hooksPath` → a missing dir is SILENTLY inert** | `PLUTUS_VISION`: `hooksPath=.githooks`, the dir ABSENT, `.git/hooks` active = **0**; every commit ungated | silent fallback |
| B4 | **the enroll is skippable — nothing forces it** | `PLUTUS_VISION` has SPEC.md + remote, **no `gates/`**, **no `.github/workflows/`**, not in the registry | unenforced procedure |
| B5 | **the ruleset 403 arrives at ARM time, after the whole enroll** | `plutus-vision` PRIVATE + account **free** → `Upgrade to GitHub Pro or make this repository public` | late detection |
| B6 | **`enroll` writes `projects.json` FRESH — the legacy project vanishes** | registry had to be hand-fixed to keep `jarvis-upper` | footgun |
| B7 | **one misconfigured project flips the whole fleet's `daemonOk=false`** | `src/status.ts:49` — the fleet + daemon healths were one field | conflated health |
| B8 | **the arming engine (TTSR) is disabled host-wide** | `ttsr.enabled=false`; 10 rules on disk inert | dead enforcement |

**The pattern under all eight:** each step of the pipeline is a *separate manual act* with no
gate that forces the next. The kernel is correct at every point and the **sequence** is unowned.

---

## §1 — THE FIX (one thesis, three mechanisms)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  THE THESIS: the pipeline becomes ONE idempotent verb, and the daemon        │
│  RETRIES instead of dying on a misconfiguration. Nothing is a manual step.   │
└──────────────────────────────────────────────────────────────────────────────┘

  TODAY (7 manual acts, each skippable)
  repo → gitignore → remote → SPEC.md → enroll → hooksPath → arm → boot → PR
    │         │         │        │        │          │        │      │
    └─ each one a place the builds diverged ─────────┴────────┴──────┘

  AFTER (1 verb + 1 push)
  repo → gitignore → SPEC.md →  upper attach <path>  → push → merge
                                    │
                     ┌──────────────┴───────────────┐
                     │ 8 gated steps, in order,     │
                     │ atomic: any refusal leaves   │
                     │ NO partial state             │
                     └──────────────────────────────┘
```

### MECHANISM A — `upper attach` (the one-click verb)

```
┌────────────────────────────────────────────────────────────┐
│ upper attach <path> [--id X] [--owner O --repo R]          │
│                     [--create] [--public] [--arm] [--dry]  │
├────────────────────────────────────────────────────────────┤
│ 1 PREFLIGHT   the path exists · is a git work tree         │
│ 2 DERIVE      id from the dir · owner/repo from `origin`   │
│               (or the flags)                               │
│ 3 REPO GATE   gh api repos/O/R                             │
│                 absent  → refuse + the gh repo create line │
│                           (--create runs it)               │
│                 PRIVATE + free plan → REFUSE NOW w/ remedy │
│                           (--public flips it)              │
│ 4 REMOTE GATE origin MUST name O/R                         │
│                 absent → refuse + the git remote add line  │
│                 (kills B1/B2 at the SOURCE)                │
│ 5 WIRING      copy gates/ .githooks/ workflows/ packages/  │
│               (backup-on-differ, idempotent)               │
│ 6 HOOKS GATE  set core.hooksPath=.githooks **AND ASSERT    │
│               the dir exists + is executable**             │
│                 missing → LOUD REFUSE (kills B3)           │
│ 7 REGISTRY    merge by id · ALWAYS include the env-legacy  │
│               project · atomic tmp+rename · re-parse       │
│               assert (kills B6)                            │
│ 8 VERIFY      print: the fleet · the restart · the next 3  │
└────────────────────────────────────────────────────────────┘
```

**Design rules that make it one-click rather than seven:**
- **Every refusal is a named token + the exact remedy command**, never a paragraph.
- **Atomicity:** steps 1-7 validate BEFORE step 5 mutates; a refusal at 3/4 leaves the tree
  untouched and the registry unwritten. No half-enrolled state exists.
- **Idempotent:** running it twice converges (the registry merges, the wiring backs up, the
  hooks assert).
- **`--dry` prints the plan** (what would be created/copied/changed) and changes nothing.

### MECHANISM B — the daemon retries (the "naturally works" half)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ THE TARGET CHECK MOVES FROM CONSTRUCTION → THE TICK                        │
├────────────────────────────────────────────────────────────────────────────┤
│ NOW   main.ts:51 enroll() → ok:false → rt:null → rt.tick() NEVER RUNS      │
│       → no retry · no per-tick record · dark until a daemon restart        │
│                                                                            │
│ AFTER createRuntime always constructs; the tick checks the target FIRST:   │
│       target ok  → the normal tick                                          │
│       target bad → a LOUD refused tick: writeStatus + appendTick,          │
│                    errors:["TARGET-NO-ORIGIN:<origin>≠<owner/repo>"],      │
│                    ok:false, the tick ADVANCES                              │
│       ⇒ add the remote → the NEXT TICK (15 s) arms it, no restart          │
│       ⇒ 2 h of refusal = ~480 recorded rows, not 1                         │
└────────────────────────────────────────────────────────────────────────────┘
```

**Plus the health split (kills B7):**
```
RuntimeStatus gains:  projectsHealthy: boolean   (every project's ok)
keeps:                daemonOk: boolean          (the DAEMON's own probe + rails)
⇒ one misconfigured project no longer reads as a dead daemon.
```

### MECHANISM C — the skill becomes one command (and the arming moves to a live carrier)

```
THE SKILL (project-on-git) REWRITTEN — 6 steps, ONE verb:
  1 repo hygiene            (init · .gitignore · secret scan)
  2 remote                  (gh repo create --public, or an existing origin)
  3 SPEC.md                 (fence v2)
  4 upper attach <path>      ← steps 4-6 of the old skill, now atomic
  5 push + upper arm <id>    (arm refuses early on the plan wall, per step 3)
  6 the PR → the 8 contexts → merge

THE ARMING (B8): the skill's rule gains a second carrier that is LIVE today —
  · the TTSR rule `git-onboarding-skill` (on disk, inert until ttsr.enabled=true)
  · PLUS a hook in the ABIDE/lexicon-gate EXTENSION (the carrier measured FIRING this
    session) so the invariant holds with TTSR off.
```

---

## §2 — THE FILES TOUCHED (the component tree)

```
jarvis-upper/src/
├── cli-verbs.ts        + verbAttach   (the new verb, ~120 lines)
├── cli.ts              + "attach" in EXTRA_ALLOWANCE + VERBS
├── enroll.ts           · registry merge (B6) · hooks assertion helper (B3)
├── runtime.ts          · the target check moves into tick() (B2) · refused-tick write (B1)
├── main.ts             · enroll() stops pre-checking the target (B2)
│                       · stop() unchanged · the boot line reports per-project reachability
├── status.ts           + projectsHealthy in the aggregate (B7)
├── projects.ts         · loadRegistry: keep the legacy project when merging (B6)
└── target-guard.ts     unchanged (it is CORRECT — it only moves call sites)
```

## §3 — THE VERIFICATION (how each bug is proven dead, mechanically)

| # | the probe | the pass token |
|---|---|---|
| B1 | `upper attach` a tree with no remote → then add the remote, wait 1 tick | the per-project `ticks.log` grows AND the row flips `ok:true` — **no restart** |
| B2 | the same, observed | `runtime/<id>/ticks.log` has ≥2 rows across the fix |
| B3 | `upper attach` a tree, then `ls "$W/.githooks"` | the dir EXISTS and `git config core.hooksPath` == `.githooks`; a deliberately-missing dir → the verb REFUSES |
| B4 | `upper attach --dry` on a bare tree | prints the 8 steps, changes nothing (`git status --porcelain` empty) |
| B5 | `upper attach` a PRIVATE repo on the free plan | refuses at step 3 with `ATTACH-PRIVATE-FREE-REPO` + the `--public` remedy — **before any copy** |
| B6 | `upper attach` into a fresh kernel with a legacy env project | `projects.json` holds BOTH ids |
| B7 | one project bad, one good | aggregate `daemonOk:true` AND `projectsHealthy:false` |
| B8 | the ABIDE carrier | the git-onboarding invariant fires with `ttsr.enabled=false` |

## §4 — THE OPEN DECISIONS (each with a recommended default)

| # | the fork | default |
|---|---|---|
| D1 | does `attach` auto-create the GitHub repo? | `--create` opt-in; refuse by default (creating a repo is a side effect outside the worktree) |
| D2 | does `attach` auto-flip a private repo public? | `--public` opt-in; refuse with the remedy (visibility is the operator's call) |
| D3 | does `attach` restart the daemon? | print the restart command; `--restart` opt-in (attaching should not bounce a live fleet) |
| D4 | does `attach` call `arm`? | `--arm` opt-in; arm stays separate because the ORDER LAW needs the workflows to have run once |
| D5 | does the target check move into the tick or stay at construction? | **into the tick** — it is the whole "naturally works" half |

## §5 — THE HONEST REMAINDER

**W1 IS IMPLEMENTED AND PROVEN LIVE (2026-10-02):** B0/B1/B2/B7 are fixed and green —
the fleet reads `counts {armed:2, disarmed:0, dark:0}` · `daemonOk:true` · `projectsHealthy:true`
· `failed:0`; the previously-refused project healed WITHOUT a restart when its remote landed;
its tick log went 1 row → 15. `bun test` 221 pass / 0 fail (incl. 4 new scope pins in
`tests/target-scope.test.ts`). Source anchors: `src/runtime.ts:470` (the guard now reads
`project.root`) · `src/main.ts:50` (the check left construction) · `src/projects.ts:178` (the
cwd-ownership resolution) · `src/status.ts:14` + `src/status.ts:49` (the two health fields).

**STILL OPEN:**
- **W2 — `upper attach`** (mechanism A: the one-click verb; B3/B4/B5/B6 remain unaddressed — the
  hooks assertion, the plan preflight, the registry merge) and the skill rewrite + the ABIDE
  carrier (B8).
- The two live builds are NOT retro-fixed: `PLUTUS_VISION` still needs its push + public/Pro and
  an attach run; `jev-fact-kernel` needs its GitHub repo created (its remote now RESOLVES, but
  the repo does not exist yet, so the fence has nothing to publish against).
- `rail-failed:TRUNCATED-65536` is a SEPARATE defect (the SSE buffer cap) — logged, not in scope.
