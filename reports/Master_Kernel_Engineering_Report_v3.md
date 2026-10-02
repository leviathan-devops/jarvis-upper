# JARVIS-UPPER MASTER KERNEL — ENGINEERING REPORT v3
**Series:** Master Kernel (the GitHub-enforcement kernel lineage; v2 = the SYSTEM RUNTIME audit @ be46bd6, v1 = the source-campaign record)
**Project:** jarvis-upper — the GitHub merge-gate enforcement kernel
**Date:** 2026-10-02
**Author:** omp agent (the git-onboarding unification session)
**Baseline:** `feat/github-master-kernel` @ `a0fba3ff39380501321363a3ef79dda2dc6348f3`
**Commit:** `a37cacb4cafc3645854aeac8d942472e04fe9fe9` (pushed: `d8e6f85..a37cacb`)
**Container:** `pbk` (omp-ct:master, plan hash 7892b58b | 4b1b1e00) · **Runtime:** `jarvis-upper.service` (active)

---

## ⚠ THE SUBJECT LAW (v2's ruling, carried forward)

**THE OPERATOR'S RULING: source tests are slop; the runtime is the only thing that matters.**

This report cites the RUNNING system FIRST: the live kernel daemon, the live builds, the real
GitHub API, the FENCE LEDGER rows, the container probe, and the second-operator acceptance run.
The source battery (tsc + `bun test`) is labelled the L0/L1 tier and NEVER carries a verdict.

---

## ONE-PARAGRAPH SUMMARY

`upper attach <path>` is ONE idempotent verb that puts ANY project onto the enforcement kernel's
rails — preflight, derive, remote-gate, repo-gate, wiring, hooks-gate, registry, verify — so a
build cannot skip a step, silently inert its hooks, or arm a ruleset it cannot satisfy. It
produces: a provisioned+public GitHub repo (FR-13, the operator's standing order), a byte-current
`.githooks` carrier whose four hooks are PROVEN executable, a merged multi-project registry that
preserves every prior entry, and a PUSHED branch — every refusal a NAMED token with the exact
one-line remedy, and every success re-probed against the API before it is claimed. Its acceptance
evidence: both live builds attached (`jev-fact-kernel` created public + 250 commits pushed;
`PLUTUS_VISION` wiring+hooks landed, push correctly held by its own branch protection), the fleet
`armed:3 · dark:0` from the daemon's own ticks, and THE LEDGER carrying a fence row PER BUILD
(`attach-jev-fact-kernel` PASS · `attach-PLUTUS_VISION` PASS) — the pin's DONE clause, measured.

---

## THE LIFECYCLE MAP

```
┌────────────────────────────────────────────────────────────────────────┐
│  upper attach <path>  →  verbAttach        src/cli-verbs.ts:351        │
│    FR-13: --visibility public|private · --no-provision · --json        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  attachPlan                                src/attach.ts:157           │
│  PURE · 8 gated steps · mutations=0 · the --dry engine                 │
│   1 preflight   2 derive   3 remote-gate   4 repo-gate                 │
│   5 wiring      6 hooks-gate   7 registry   8 verify                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    ▼                                ▼
┌───────────────────────────────────┐  ┌─────────────────────────────────┐
│  REFUSAL path                     │  │  FR-13 SELF-HEAL path           │
│  ATTACH-<TOKEN> + the remedy cmd  │  │  ATTACH-NO-REPO / PRIVATE-FREE  │
│  (never a bare failure)           │  │   → provisionRepo (create|flip) │
└───────────────────────────────────┘  │   → RE-PLAN → the gates pass    │
                                       └───────────────┬─────────────────┘
                                                       │
                                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│  attachApply                               src/attach.ts:274           │
│  the ONLY mutator · idempotent: a satisfied step is a NOOP             │
│   5 wiring (copy·backup·drift-update)   6 hooks (set + ASSERT)         │
│   7 registry (merge·atomic·preserve)    8 pushIfAhead (pushed|needsPr) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  TERMINAL: ok:true + report[] · OR a NAMED refusal + its remedy        │
│  the daemon arms the project → the fence ledger gains its row          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## THE ARCHITECTURE — MODULE BY MODULE

### M1 · `src/attach.ts` (347 lines) — THE PLAN/APPLY ENGINE

```
┌────────────────────────────────────────────────────────────────────────┐
│  attach.ts — the pure plan + the only mutator                          │
├────────────────────────────────────────────────────────────────────────┤
│  attachPlan(opts, deps)          :157  · calls ONLY read-only deps     │
│    ├─ preflight                   :166  · stat + readOrigin (guarded)  │
│    ├─ derive                      :205  · parseOrigin → AttachTarget   │
│    ├─ remote-gate                 :218  · checkRemote (LOCAL, free)    │
│    ├─ repo-gate                   :226  · checkRepo (REMOTE, token)    │
│    ├─ wiring                      :231  · inspectWiring (DRIFT-aware)  │
│    ├─ hooks-gate                  :246  · the SEQUEL law (below)       │
│    ├─ registry                    :258  · inspectRegistry              │
│    └─ verify                      :264  · the mutation summary         │
│  attachApply(plan, opts, deps)    :274  · wiring→hooks→registry order  │
│  STEP_IDS                          :133 · the order IS the contract    │
└────────────────────────────────────────────────────────────────────────┘
```

**Interfaces**: `AttachDeps` (the 9-method seam — 6 read-only for the plan, 3 mutators for the
apply), `AttachStep` (the `{n,id,ok,mutates,detail,refused?,remedy?}` row), `AttachPlan`,
`AttachResult`. **Data flow**: `opts` → `readOrigin` → `AttachTarget` → the 8 verdicts →
`AttachPlan` → `attachApply` → `AttachResult`. **Failure modes**: every probe is try/caught
(stat/readOrigin/repo-gate); an unguarded throw was the audit campaign's OPENING class (round
1-7) — the fix: shaped refusals at every boundary, discriminants (`OriginRead.failed`) CONSUMED
at both call sites. **The SEQUEL law (`:246`)**: `ATTACH-HOOKS-INERT` (hooksPath set, dir ABSENT)
blocks ONLY when the wiring is NOT needed — otherwise the wiring (step 5) lays the chain and the
plan proceeds ("the wiring (step 5) lays the chain; the hooks then activate").

### M2 · `src/attach-guards.ts` (420 lines) — THE REAL GUARD BUNDLE

```
┌────────────────────────────────────────────────────────────────────────┐
│  attach-guards.ts — readOrigin · checkRemote · checkRepo · wiring ·    │
│  hooks · registry  (the REAL deps the verb injects)                    │
├────────────────────────────────────────────────────────────────────────┤
│  realDeps(kernel, host)           :125  · the DI bundle                │
│  inspectWiring(o)                 :262  · MISSING **OR** BYTE-DIFFERS  │
│    → "present" is not "current": the drift law (measured op8b)         │
│  applyWiring(o)                   :302  · copyKernelSurface (backup)   │
│  inspectHooksImpl(o)              :159  · the 3-part predicate         │
│    hp==""→needed · hp!=".githooks"→FOREIGN · dir absent→INERT          │
│    4 hooks present? executable? (ALL four — the exec-bit law)          │
│  applyHooks(o)                    :343  · pre-check → set → ASSERT     │
└────────────────────────────────────────────────────────────────────────┘
```

**Data flow**: `AttachTarget` → the guards → `{ok, needed, refused?, remedy?, detail}` consumed by
the plan; the apply counterparts mutate + re-assert. **Failure modes**: `ATTACH-HOOKS-FOREIGN`
(a foreign hooksPath), `-INERT` (set-but-absent), `-INCOMPLETE` (missing hooks), `-NOT-EXEC`
(the exec-bit), `-READ-FAILED` (the discriminated read). The `readHooksPath` discriminant: a
transient read failure is DISTINCT from "unset" — the read-discriminant law.

### M3 · `src/repo-visibility.ts` (265 lines) — FR-13, THE KERNEL OWNS THE REPO

```
┌────────────────────────────────────────────────────────────────────────┐
│  repo-visibility.ts — probeRepo · provisionRepo · pushIfAhead          │
│  (the operator's standing order: public by default, no manual BS)      │
├────────────────────────────────────────────────────────────────────────┤
│  probeRepo(o,r,token,run)          :74  · gh repo view → {exists,      │
│    visibility, absent (STRUCTURED — never a substring), detail}        │
│  provisionRepo(t, want, token)    :113  · create | flip BOTH ways      │
│    ├─ the CREATE + git push (the origin is PRE-EXISTING by design)     │
│    ├─ the FLIP (--accept-visibility-change-consequences = no prompt)   │
│    └─ THE RE-PROBE: create/flip CONFIRMED against the API (both facts) │
│  pushIfAhead(root, grit)          :185  · pushed | noop | needsPr |    │
│    REPO-PUSH-FAILED (FIRING 012: a PR rule is the repo's OWN working)  │
│  readStateLabel(r)                  :91 · absent vs unreadable (ONE)   │
│  ghEnv(token)                       :52 · GH_PROMPT_DISABLED=1 + the   │
│    shadow tokens SCRUBBED (GITHUB_TOKEN/GH_ENTERPRISE_TOKEN deleted)   │
└────────────────────────────────────────────────────────────────────────┘
```

**The 2FA**: a non-issue by construction — a PAT (GH_TOKEN) is never subject to interactive 2FA,
and `GH_PROMPT_DISABLED=1` makes a hang impossible; a missing scope surfaces as a NAMED refusal.
**Failure modes**: `REPO-AUTH-MISSING` / `-PROBE-FAILED` (a read error is NEVER absence) /
`-ABSENT-NO-CREATE` / `-CREATE-FAILED` / `-PUSH-FAILED` / `-NO-ORIGIN` / `-VISIBILITY-FAILED` /
`-CREATE-UNCONFIRMED` / `-VISIBILITY-UNCONFIRMED` — every one with its exact remedy.

### M4 · `src/cli-verbs.ts` (545 lines) — THE VERB + THE VIS DIAL

```
┌────────────────────────────────────────────────────────────────────────┐
│  cli-verbs.ts — verbAttach (the pipeline) + verbVis (the dial)         │
├────────────────────────────────────────────────────────────────────────┤
│  verbAttach(root, arg, ...rest)   :351                                 │
│    the flag surface: --id --owner --repo --token-env --host --dry      │
│      --visibility --no-provision --json   (FR-9's token, accepted)     │
│    plan → PROVISIONABLE? → provisionRepo → RE-PLAN → apply → push      │
│  verbVis(root, arg, ...rest)      :441  · upper vis <id|path>          │
│    --public|--private · resolveTargetForVis → provisionRepo            │
└────────────────────────────────────────────────────────────────────────┘
```

**The FR-13 wiring (`:407`)**: `PROVISIONABLE = /^ATTACH-(NO-REPO|PRIVATE-FREE-REPO)/` — on those
two refusals, with auto-provision ON (the default), the verb provisions then RE-PLANS; the
refusal survives as the fallback when the kernel cannot act. **The push tail (`:429`)**: after a
successful apply, `pushIfAhead` — the manual push the operator banned, gone.

### M5 · `src/enroll.ts` (330 lines) — THE COPIER CHOKEPOINT

```
┌────────────────────────────────────────────────────────────────────────┐
│  enroll.ts — copyKernelSurface (validate-then-gate) + the backup law   │
├────────────────────────────────────────────────────────────────────────┤
│  copyKernelSurface(opts)          :104  · THE ORDER:                   │
│    1 INPUTS guard (typeof/absolute/id/overlap) BEFORE any join         │
│    2 SURFACE scan — ONE probe, STRUCTURED {missingRequired,            │
│      surfaceWrongType} — and it GATES (a wrong type REFUSES, no copy)  │
│    3 THE COPIES (copyTree/copyOne — backup a differing target +        │
│      lstat guards: no symlink traversal, no symlink overwrite)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## THE BUG LEDGER

| # | bug | root cause | fix | evidence |
|---|---|---|---|---|
| B1 | `gh` inherited the caller's cwd (`repo-visibility.ts:64`) | `ghRun` spawned without `cwd` | `cwd:"/"` — no git context can leak in | audit e5d6b056 HIGH → PASS |
| B2 | a create/edit claimed success unre-probed (`:144`) | no confirmation against the API | BOTH re-probe; UNCONFIRMED is NAMED | the two UNCONFIRMED tests |
| B3 | absence was a SUBSTRING (`detail.includes`) (`:107`) | string-coupled fact | `RepoState.absent` STRUCTURED | probe tests assert it |
| B4 | the phantom gate rejected the kernel's own code x2 | a narration + a QUOTATION read as claims | FIRING 010/011 | the 250-commit sweep: 0 |
| B5 | `wiring: already present` skipped a DRIFTED carrier | existence-only probe | byte comparison ("would update:") | op8c: copied=17 backedUp=2 |
| B6 | `ATTACH-HOOKS-INERT` dead-ended (`attach.ts:246`) | the plan ignored its apply order | the SEQUEL law (order-aware) | op9b: hooks laid + asserted |
| B7 | a PR-only rejection read as a failure (`:206`) | GitHub's own enforcement | `needsPr` = an EXPECTED state | the pre-receive-hook test |
| B8 | FR-9's `--json` invocation REFUSED (`cli-verbs.ts:355`) | the token never implemented | accepted as a no-op | the second operator + a test |
| B9 | the audit rounds 1-7: shaped refusals/discriminants | unguarded probes + unconsumed discriminants | validate-then-gate + consume | the convergence 6h→0h |

### THE DETAIL BOXES (the significant ones)

**B4 · THE PHANTOM GATE REJECTED THE KERNEL'S OWN CODE**

```
┌────────────────────────────────────────────────────────────────────────┐
│  THE MECHANISM (op8, the live push)                                    │
├────────────────────────────────────────────────────────────────────────┤
│  jev-fact-kernel's pre-push -> scan_phantom -> PHANTOM-DIFF 49b4e2e    │
│  CHECK 1 (subject + empty diff): the subject makes NO claim -> silent  │
│  CHECK 2 (body: "created <file>"): "The enroll wrote projects.json"    │
│         — a TOOL's runtime narration, not the commit's artifact        │
│  the file lives in the KERNEL (a different repo) -> cat-file misses    │
│  -> FIRING 010: TOOL-SUBJECT lines dropped before the scan             │
│  -> the sweep found a SECOND: a QUOTED example ("I created X")         │
│  -> FIRING 011: quoted spans stripped; backticks stripped, kept        │
│  RESULT: the full 250-commit history sweep -> ZERO firings             │
└────────────────────────────────────────────────────────────────────────┘
```

**B6 · THE DEAD-END REMEDY (the worst refusal class)**

```
┌────────────────────────────────────────────────────────────────────────┐
│  ATTACH-HOOKS-INERT   remedy: "upper attach <path>  # re-run to lay    │
│                                the wiring, then the hooks activate"    │
│  A RE-RUN RE-REFUSED: the plan refuses at step 6 BEFORE the wiring     │
│  (step 5) can run. THE FIX: the plan is ORDER-AWARE — where the        │
│  wiring is NEEDED the refusal becomes the sequel (ok + "the wiring     │
│  (step 5) lays the chain"). BOTH halves pinned in the test.            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## THE TESTING LEDGER

| tier | test | scope | how | result |
|---|---|---|---|---|
| L0 | `bunx tsc --noEmit` | the whole tree | the compiler | **exit 0** |
| L1 | `bun test` | 286 tests / 59 files | bun's runner | **286 pass / 0 fail / 984 expect** |
| L1 | the phantom suite | the gate's 6 controls | real temp repos | 4/4 (the sweep: 0 firings) |
| L2 | the runtime seat ops 1-9 | the REAL CLI + the live daemon | numbered, pre-registered | 7/7 expectations MET |
| L3 | attach jev-fact-kernel | the live build | `bun src/cli.ts attach` | **ok=true / pushed / public** |
| L3 | attach PLUTUS_VISION | the live build | `bun src/cli.ts attach` | **ok=true / needsPr (its rule)** |
| L3 | the fleet | the daemon's ticks | `bun src/cli.ts projects` | **3 enrolled / all ok=True** |
| L4 | THE CONTAINER PROBE | the battery, fresh image | omp-ct:master, plan-gated | 275/9 -> +hosts **285/1** (named) |
| L4 | THE SECOND OPERATOR | a zero-context subagent | ONLY the 2 docs | **attached unaided**, 1 find fixed |
| L4 | THE FENCE ROWS | the ledger | b6 fence.sh, bwrap | **PASS x2** (a row per build) |

### THE VERBATIM OUTPUTS (the verdicts' backing)

```
$ bun test                            (the host, current state)
 286 pass
 0 fail
 984 expect() calls
Ran 286 tests across 59 files. [7.08s]

$ bun src/cli.ts attach /home/.../worktrees/jev-fact-kernel
{"ok":true,"attached":"jev-fact-kernel",
 "push":{"pushed":true,"detail":"pushed -> origin/feat/jev-fact-kernel"}}

$ bun src/cli.ts attach /home/.../Shared_Workspace/PLUTUS_VISION
{"ok":true,"attached":"PLUTUS_VISION","action":"noop",
 "push":{"pushed":false,"needsPr":true,
   "detail":"the remote requires a PR for main — the branch
     protection is working as designed (the attach landed locally)"}}

$ bun src/cli.ts projects
enrolled=3 issues=[]
  jev-fact-kernel  ARMED tick=479 ok=True
  jarvis-upper     ARMED tick=479 ok=True
  PLUTUS_VISION    ARMED tick=479 ok=True

$ grep attach-jev-fact-kernel JARVIS-CORE/b6/verdicts.jsonl
{"ts":"2026-10-02T15:14:30Z","job":"attach-jev-fact-kernel",
 "seat":"jev-fact-kernel","verdict":"PASS","fence_exit":0,
 "evidence":"84e7b46306f9ba39|sandbox=bwrap"}
```

---

## THE RUNTIME TRACE (the 5-part simulator — one REAL invocation, end to end)

### PART 1 · TIMELINE (the context sources converging)

```
T-0    the pin's baseline: a0fba3f / 2 projects / the build's repo ABSENT
T-1    the operator's order (FR-13): "make all repos public by default ...
       the kernel auto convert them ... handles the 2fa ... no stupid bs"
T-2    the audit campaign: 7 rounds on attach + 3 on FR-13 -> GATE: PASS
T-3    THE INVOCATION (op8d): a live attach of the 1st build
```

### PART 2 · THE EXECUTION TRACE (numbered, exact args)

```
STEP 1  verbAttach(root, "/.../worktrees/jev-fact-kernel")
        src/cli-verbs.ts:351 -> the flag parse (--id... --json accepted)
STEP 2  attachPlan(opts, realDeps)            src/attach.ts:157
        1 preflight  ok  (a git work tree)
        2 derive     ok  (-> leviathan-devops/jev-fact-kernel)
        3 remote-gate ok (origin matches)
        4 repo-gate  ATTACH-NO-REPO -> PROVISIONABLE (cli-verbs.ts:407)
STEP 3  provisionRepo(...)                    src/repo-visibility.ts:113
        gh repo create leviathan-devops/jev-fact-kernel --public -> 0
        git -C <root> push -u origin HEAD    -> 0  (250 commits)
        the RE-PROBE: gh repo view -> {exists, public} -> CONFIRMED
STEP 4  RE-PLAN -> steps 4-8 pass -> attachApply   src/attach.ts:274
        5 wiring copied=17 backedUp=1  (the DRIFT law: the fixed gate lands)
        6 hooks  set + ASSERT (4 hooks executable)
        7 registry merged -> 3 projects
STEP 5  pushIfAhead -> "pushed ... -> origin/feat/jev-fact-kernel"
STEP 6  emit(0, {ok:true, attached, push:{pushed:true}, report[]})
```

### PART 3 · THE ROUTING DECISION (shown evaluating, not just the result)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Q1: repo exists?          -> NO  -> PROVISIONABLE (create)            │
│  Q2: private at plan=free? -> n/a (absent)                             │
│  Q3: autoProvision ON?     -> YES (the default; --no-provision flips)  │
│  -> provisionRepo, then RE-PLAN (never a claimed success)              │
│                                                                        │
│  THE OTHER PATH (PLUTUS_VISION): Q1 YES / Q2 no (already public)       │
│  -> the plan proceeds; the push hits its BRANCH PROTECTION             │
│  -> needsPr (the repo's own enforcement = an EXPECTED state)           │
└────────────────────────────────────────────────────────────────────────┘
```

### PART 4 · THE DELIVERY PATH

```
┌────────────────────────────────────────────────────────────────────────┐
│  the verb -> stdout: ONE JSON object -> the operator's terminal        │
│  THE DAEMON: systemctl --user restart jarvis-upper -> the tick loop    │
│    -> runtime/status.json: the project row ok=True (tick 479)          │
│  THE LEDGER: fence.sh <job> -> bwrap sandbox -> 9 done-when checks     │
│    -> verdicts.jsonl: {"job":"attach-jev-fact-kernel","verdict":"PASS"}│
└────────────────────────────────────────────────────────────────────────┘
```

### PART 5 · THE OBSERVER (what the enforcement saw — including the quiet case)

```
OBSERVER ACTIVITY (the kernel's own gates during the run):
  the graph gate: 3 drifts fired across the session -> each answered with
    the ripwire query it named (callers/attachPlan, attachApply, ...)
  the PBK container gate: 1 firing (a raw docker command) -> the
    sanctioned container-testing tool used instead — ZERO bypasses
  the phantom gate (pre-push): FIRED (correctly) on my own commits'
    fixtures until the fixtures asserted themselves (no vacuous passes)
  the ABIDE gate: 1 firing on a test-edit's claim-shaped strings -> the
    test run WAS the tool result it demanded
  QUIET: no secret ever crossed stdout/logs; no silent fallback fired.
```

---

## THE SPEC MANDATE -> ENGINEERING MAP

| the spec/operator said | what was built | evidence |
|---|---|---|
| FR-1 the pure plan | `attachPlan` + the purity test | `tests/attach_plan.test.ts` |
| FR-2 the repo gate | `checkRepo` + the planGate | the ATTACH-NO-REPO/PRIVATE rows |
| FR-3 the remote gate | `checkRemote` (parseRemote reuse) | `test_attach_remote_gate` |
| FR-4 the wiring | `copyKernelSurface` reuse (no 2nd copier) | copied=17 live |
| FR-5 the hooks gate (B3) | inspect+apply + THE SEQUEL law | op9b: asserted live |
| FR-6 the registry merge (B6) | merge-by-id + preserve + atomic | 3 projects retained |
| FR-7 idempotence | a satisfied step = noop | op8b-d: action=noop |
| FR-8 the dry mode | mutations=0 + the world untouched | the dry test |
| FR-9 the CLI contract | ONE JSON object + `--json` accepted | the second operator |
| FR-10 the skill rewrite | `project-on-git` on the verb | the skill's validator |
| FR-11 the ABIDE carrier | the ttsr-off invariant | the carrier on disk |
| FR-12 the live acceptance | BOTH builds + a fence row each | the ledger's 2 PASS |
| FR-13 the operator's order | `repo-visibility.ts` + the vis dial | both repos PUBLIC |
| "no stupid bs to manage" | the push tail + auto-provision | op8d: pushed=true |

---

## THE NUMBERS

```
┌──────────────────────────────────────────────────────────────────────────┐
│  METRIC                              │ MEASURED (the command)            │
│  tsc                                   │ exit 0 (bunx tsc --noEmit)      │
│  the battery                           │ 286 pass / 0 fail (bun test)    │
│  expect() calls                        │ 984                             │
│  test files                            │ 59                              │
│  src files / lines                     │ 29 files / 5,981 lines (wc -l)  │
│  test lines                            │ 5,487 (wc -l tests/*.test.ts)   │
│  commits (v2 baseline -> HEAD)         │ 131 (git log | wc -l)           │
│  the audit gate                        │ PASS x3 (three sessions)        │
│  the fleet                             │ armed:3 / dark:0 / all ok=True  │
│  the ledger's fence rows               │ 3 (2 PASS + 1 CHECK_FAILED)     │
│  the container probe                   │ 275/9 -> 285/1 (+10, named)     │
│  the second operator                   │ 1 unaided attach / 1 find fixed │
│  the checkpoint                        │ 58M @ a37cacb (full-tree seal)  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## THE FILE MANIFEST

```
┌──────────────────────────────────────────────────────────────────────────┐
│  jarvis-upper @ a37cacb — the git-onboarding surface                     │
│  ----------------------------------------------------------------------  │
│  src/attach.ts            347  NEW  the pure plan + apply                │
│  src/attach-guards.ts     420  NEW  the guards (drift + hooks law)       │
│  src/repo-visibility.ts   265  NEW  FR-13: provision / flip / push       │
│  src/cli-verbs.ts         545  MOD  verbAttach + verbVis + the heal      │
│  src/cli.ts                80  MOD  the vis registration                 │
│  src/enroll.ts            330  MOD  validate-then-gate + drift           │
│  .githooks/lib/scan-phantom.sh MOD  FIRING 010/011 (both trees)          │
│  tests/*.test.ts        5,487  MOD  58 files (attach suites inside)      │
│  artifacts/container-hermeticity-results.json  NEW  the L4 probe         │
│  reports/...Engineering_Report_v3.md           NEW  this report          │
│  context_management/    5,591 lines of canon (11 docs, current)          │
│  BUILD_REPORT/DEBUG_LOG/TESTING_LOG (+3)  4,413 lines (the ship)         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## THE WAVE AUDITS (the per-hunk verdicts the discipline demanded)

| wave | the audit file | verdict | the crux |
|---|---|---|---|
| W1 | `.trident/wave-audit/W1-desk.md` (200 L) | per-finding verdicts | the pure-plan interface + the step table |
| W2 | `.trident/wave-audit/W2.md` (121 L) | **CORRECT — 7/7** | all four halves proven by the orchestrator |
| W3 | `.trident/wave-audit/W3.md` (114 L) | **CORRECT** | both phantom defects fixed; 3 probes |
| W4 | `.trident/wave-audit/W4.md` (120 L) | **CORRECT** | the CI defect FIXED; 6 valid jobs |
| W5 | `.trident/wave-audit/W5.md` (108 L) | **CORRECT** | the call site wired; the test BITES |
| ALL | `.trident/wave-audit/ORCHESTRATOR-AUDIT.md` | **FLAWED → fixed** | the desk made `scan-phantom.sh` a library |

```
┌────────────────────────────────────────────────────────────────────────┐
│  THE ORCHESTRATOR'S OWN CATCH (ORCHESTRATOR-AUDIT.md)                  │
├────────────────────────────────────────────────────────────────────────┤
│  the desk's return: "proper sourced library"                           │
│  THE AUDIT: the sourcing change broke the DIRECT-CALL contract         │
│  (a caller running the file directly got a no-op) -> FLAWED            │
│  THE FIX: the sourced-callable shape + the main-guard (BASH_SOURCE)    │
│  PROOF: both call styles exercised; the sweep clean                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## TRIED AND REJECTED (the honest notes — each was measured, not guessed)

| the approach | why it was rejected | what replaced it |
|---|---|---|
| `rev-parse --abbrev-ref HEAD` for the branch | **EXITS 128** on a repo with no commits (measured) | `symbolic-ref --short HEAD` (works on an empty repo) |
| a zero-commit push treated as a failure | a legitimate empty repo failed the WHOLE attach | the no-commits NOOP ("the first commit will carry it") |
| the create path passing `--source/--remote` | gh FAILS on "remote origin already exists" (the remote is pre-existing by design) | a bare `gh repo create` + the ENFORCED origin invariant |
| the string gate `includes("(not a ")` | the same substring fragility the file had just removed | the STRUCTURED `surfaceWrongType[]` channel |
| nested ternaries in the re-probe messages | the project's own rule bans them (the gate caught MY fix) | ONE `readStateLabel` helper |
| `gh` spawned with the caller's cwd | a git context could leak into the API calls | `cwd:"/"` |
| a fake `bare` remote without `--bare` | the push was refused ("checked-out branch") — the FIXTURE was wrong | `git init --bare` (the fixture fixed, not the code) |
| a spec-local registry entry to green the snapshot | a FITTED green — the snapshot must mirror, not fake | the 4 registry-path tests documented as a contract |

---

## THE ORCHESTRATION NOTE (how the build was actually driven)

The pin's wave plan (`packages/git-onboarding-unification/WAVE_PLAN.md`, WAVES: 5) ran W1-W4 as
desks; the ORCHESTRATOR (this seat) then drove W5 — the runtime — and everything after the first
audit round was driven FIRST-PERSON on the live host: the seat ops 1-9, the three phantom-gate
false positives, the drift law, the dead-end remedy, the PR-state classification, the second
operator dispatch, and the two container rounds. The audit campaign on the attach surface ran
SEVEN rounds (6h -> 2h -> 2h -> 1h -> 2h -> 2h -> 0h); the FR-13 surface ran THREE. Every round
was a REAL defect; the count never reached zero by construction (an LLM reviewer's design) — the
STOP was a PASS verdict, not a count.

---

## THE REPRODUCTION RECIPE (a fresh session, from disk)

```
┌────────────────────────────────────────────────────────────────────────┐
│  THE WHOLE BUILD, IN FIVE COMMANDS                                     │
├────────────────────────────────────────────────────────────────────────┤
│  1  cd JARVIS-FACTORY/jarvis-upper                                     │
│  2  set -a; . ~/.config/jarvis-upper.env; set +a                       │
│  3  bunx tsc --noEmit            -> exit 0                             │
│  4  bun test                     -> 286 pass / 0 fail / 984 expect     │
│  5  bun src/cli.ts projects      -> enrolled=3 / all ok=True           │
│  -- and to put ANY project on the rails:                               │
│     bun src/cli.ts attach /abs/path/to/any/project                     │
│         (--dry to preview; the refusal names its remedy)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## THE HONEST GAPS (what was NOT verified, stated plainly)

| # | the gap | the mechanism | the resolution path |
|---|---|---|---|
| G1 | the checkpoint's in-place battery: 282/4 | the snapshot path is not a registered root (AMBIGUOUS-STORE by design) | restore to the registered path (286/0 there) |
| G2 | the container probe's 1 residual | `test_preflight_refuses_no_spec` needs the LIVE host runtime | structurally unmountable; a named acceptance test |
| G3 | the fence rows prove LOCAL state | the bwrap sandbox has NO network; the push proof is the local ref | the API probe inside the verb is the remote evidence |
| G4 | `vis` has no live flip yet | only the attach's provision path ran live | a throwaway-repo round trip (offered to the operator) |
| G5 | the round-zero checkpoint not re-verified | the P7 seal superseded it | `attach-verb-audit-cleared` is the current seal |

1. **THE CHECKPOINT'S IN-PLACE BATTERY**: 282 pass / 4 fail — the 4 are the REGISTRY-PATH
   CONTRACT (the snapshot path is not a registered project root; the resolver refuses
   AMBIGUOUS-STORE by design). Restoring the snapshot to its registered path resolves them
   (286/0 measured there). NOT a defect; a documented property.
2. **THE CONTAINER PROBE'S ONE RESIDUAL**: `test_preflight_refuses_no_spec` needs the HOST'S
   LIVE RUNTIME (the AO daemon :3001 + the systemd unit + the token file) — structurally
   unmountable. A named live-runtime acceptance test.
3. **THE FENCE ROWS ARE LOCAL-STATE PROOFS**: the done-when checks are local (the fence's bwrap
   sandbox has NO network) — the jev-fact-kernel push is proven by the LOCAL remote-tracking
   ref, not a network read-back. The GitHub-side evidence is the API probe inside the verb.
4. **THE `vis` VERB** has no live mutation yet (only the attach's provision path ran live) —
   its flip path is covered by the unit tests + the UNCONFIRMED pins, but a live
   private->public->private round trip on a real repo was NOT performed.
5. **THE ROUND-ZERO CHECKPOINT** was not re-verified this report; the P7 seal
   (`attach-verb-audit-cleared`) is the current one.

---

## WHAT'S NEEDED FROM THE OPERATOR

| # | the ask | why | the exact action |
|---|---|---|---|
| 1 | NOTHING to make the verb work | both builds attached; the fleet armed:3; a fence row each | `upper attach <any-path>` is the one command |
| 2 | OPTIONAL: a `vis` round trip | the flip path is tested but not live-proven | `bun src/cli.ts vis <id> --private` then `--public` on a throwaway |
| 3 | OPTIONAL: allow direct pushes to `plutus-vision` main | the `needsPr` flow is the sanctioned alternative | `gh repo edit ... ` OR keep `needsPr` (the remedy names the PR path) |

1. **NOTHING to make the verb work** — both builds are attached, the fleet is armed:3, and the
   ledger holds a fence row each. `upper attach <any-path>` is the one command.
2. OPTIONAL: a `vis` round-trip on a throwaway public repo if you want the flip proven live
   (the code path is tested; the live flip is the missing receipt).
3. OPTIONAL: flip `plutus-vision` push protection to allow direct pushes IF you want the
   attach's push to land on main directly — otherwise the `needsPr` flow (a branch push +
   `gh pr create`) is the sanctioned path the remedy names.
