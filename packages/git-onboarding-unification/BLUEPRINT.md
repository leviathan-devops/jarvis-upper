# BLUEPRINT — GIT-ONBOARDING UNIFICATION (`upper attach`)

**Series:** kernel-operations · **Date:** 2026-10-02 · **Baseline:** `feat/github-master-kernel` @ `a0fba3f`

## §1 THE PURPOSE

One idempotent verb puts ANY project onto the enforcement kernel's rails — repo hygiene, the
wiring, the ruleset, the registry, the hooks — with every refusal named and NO partial state.
The multi-project runtime (proven live 2026-10-02) is the substrate; this build removes the
SEVEN MANUAL ACTS that let two live builds each skip a different one.

## §2 THE MASTER PATTERN

```
  TODAY (7 acts, each skippable — the two live builds each skipped a different one)
  repo → gitignore → remote → SPEC.md → enroll → hooksPath → arm → boot → PR

  AFTER (1 verb + 1 push)
  repo → gitignore → SPEC.md →  ┌──────────────────────┐  → push → arm → PR
                                 │   upper attach <P>   │
                                 │   8 gated steps,     │
                                 │   atomic, idempotent │
                                 └──────────────────────┘
```

## §3 THE CORE MECHANISM — the 8 gated steps

```
┌──────────────────────────────────────────────────────────────┐
│ upper attach <path> [--id X] [--owner O --repo R]            │
│              [--create] [--public] [--arm] [--dry] [--json]  │
├──────────────────────────────────────────────────────────────┤
│ 1 PREFLIGHT   the path exists · is a git work tree           │
│ 2 DERIVE      id from the dir · owner/repo from `origin`     │
│ 3 REPO GATE   repos/O/R: absent → refuse + the create line   │
│                          (--create runs it)                  │
│               PRIVATE + free plan → REFUSE + the --public    │
│                          remedy      (kills the late 403)    │
│ 4 REMOTE GATE origin MUST name O/R → refuse + the add line   │
│ 5 WIRING      copy gates/ .githooks/ workflows/ packages/    │
│               (backup-on-differ, idempotent)                 │
│ 6 HOOKS GATE  set core.hooksPath=.githooks AND ASSERT the    │
│               dir exists + is executable → LOUD REFUSE       │
│ 7 REGISTRY    merge by id · ALWAYS keep the env-legacy       │
│               project · atomic tmp+rename · re-parse assert  │
│ 8 VERIFY      print: the fleet · the restart · the next 3    │
└──────────────────────────────────────────────────────────────┘
```

**The design rules that make it one-click:**
- every refusal = a NAMED token + the exact remedy command;
- steps 1-7 VALIDATE before step 5 mutates (a refusal leaves zero partial state);
- idempotent — running it twice converges;
- `--dry` prints the plan and changes nothing.

## §4 THE INTERFACES (the contracts the implementation must honor)

| export | shape | contract | the anchor |
|---|---|---|---|
| `attachPlan(opts, deps)` | `(AttachOpts, AttachDeps) => Promise<AttachPlan>` | PURE — computes the 8 step verdicts, mutates nothing (the `--dry` engine AND the test surface) | `src/attach.ts:153` |
| `attachApply(plan, opts, deps)` | `(...) => Promise<AttachResult>` | the ONLY mutating path; a step's failure → a named refuse + STOP; honors the plan's `mutates` (idempotence) | `src/attach.ts:225` |
| `ATTACH_STEP_ORDER` | `AttachStep["id"][]` | the 8-step ORDER — the contract (local checks before remote) | `src/attach.ts:145` |
| `AttachDeps` | the 5-guard seam | the effectful guards are INJECTED, so the module is standalone | `src/attach.ts:103` |
| `realDeps(kernel, host)` | `(...) => AttachDeps` | the REAL guards, closed over the kernel root — the only place the effects live | `src/attach-guards.ts:79` |
| `mergeRegistry(reg, spec, kernel, env)` | `(...) => Registry` | the merge-by-id + the legacy preservation (pure; the atomic write wraps it) | `src/attach-guards.ts:41` |
| `copyKernelSurface({kernel, target, id, dry})` | `(...) => {copied, skipped, backedUp}` | ONE copier (extracted from `enroll`) — REUSED by the verb, no second implementation | `src/enroll.ts:104` |
| `verbAttach(root, path, ...flags)` | `(...) => Promise<VerbResult>` | the CLI surface: the flag parser, the credential resolution, ONE JSON object | `src/cli-verbs.ts:351` |

## §5 THE FILE SHAPE (what the new code looks like)

```
jarvis-upper/src/
├── attach.ts          NEW — attachPlan + attachApply + the step table (the 8 steps)
├── attach-guards.ts   NEW — assertHooksPath · mergeRegistry · planGate (the 3 guard helpers)
├── cli-verbs.ts       + verbAttach (thin: parse → attachPlan → attachApply → the JSON out)
├── cli.ts             + "attach" (allowance 6 + the VERBS map)
├── enroll.ts          · copyTree/copyOne REUSED by attach (no duplicate copier)
└── projects.ts        · the exported Registry helpers attach needs
```

## §6 FAILURE MODES (per component — each a named refusal)

| component | the failure | the refusal |
|---|---|---|
| preflight | not a git tree | `ATTACH-NOT-A-REPO:<path>` |
| planGate | the repo is absent | `ATTACH-NO-REPO:<O>/<R>` + the `gh repo create` line |
| planGate | private + free | `ATTACH-PRIVATE-FREE-REPO` + the `--public` remedy |
| planGate | the token cannot read the repo | `ATTACH-TOKEN-CANNOT-READ:<status>` |
| the remote gate | origin absent/mismatched | `ATTACH-REMOTE-MISMATCH:<origin>!=<O>/<R>` + the add line |
| the wiring | a required artifact absent from the kernel | `ATTACH-KERNEL-INCOMPLETE:<dir>` |
| the hooks gate | `hooksPath` → a missing dir | `ATTACH-HOOKS-INERT:<root>` (the B3 class) |
| the registry | unparseable / the merge would drop a project | `ATTACH-REGISTRY-CORRUPT` / the assert |
| idempotency | a second run | converges; reports `action: "noop"` per step |

## §7 THE OVERLAYS

- **The skill rewrite** (`project-on-git`): steps 4-6 of the old skill collapse into
  `upper attach`; the skill keeps only hygiene → remote → SPEC.md → **attach** → push+arm → PR.
- **The arming carrier (B8)**: the TTSR rule stays; a hook in the ABIDE/lexicon-gate EXTENSION
  (the carrier measured firing live) carries the invariant with `ttsr.enabled=false`.

## §8 OPEN DECISIONS (each with a default)

| # | fork | default |
|---|---|---|
| D1 | auto-create the GitHub repo? | no — `--create` (a side effect outside the worktree) |
| D2 | auto-flip private→public? | no — `--public` (visibility is the operator's) |
| D3 | restart the daemon? | no — print it; `--restart` opt-in |
| D4 | call `arm`? | no — `--arm` (the ORDER LAW needs the workflows to have run once) |
