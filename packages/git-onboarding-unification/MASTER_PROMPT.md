# MASTER_PROMPT — GIT-ONBOARDING UNIFICATION (`upper attach`)

The depth document. The pin points here; a fresh session reads THIS before acting.

## THE MISSION (verbatim)

*"either this happens naturally on every single build or it's a simple one click attach command
that immediately puts the project onto the rails for this kernel and everything works correctly.
No bugs, no derailments, no broken anything, like everything works properly. And I don't want to
see any mess."* — the operator, 2026-10-02.

## THE READING ORDER (a fresh session reads these, in order, before touching code)

1. `packages/git-onboarding-unification/DPL1_SPEC.md` — the BINDING authority (the FRs).
2. `packages/git-onboarding-unification/WAVE_PLAN.md` — the wave order + the disjoint sets.
3. `packages/git-onboarding-unification/BLUEPRINT.md` — the design + the interfaces.
4. `reports/Git_Onboarding_Unification_ShowMe.md` — THE EVIDENCE (B0-B8, every one measured).
5. `forensic/FAILURE_LEDGER_MULTIPROJECT.md` — the earlier audit (the 3C/5H/4M/3L + 11 SLOPs).
6. `~/.omp/agent/managed-skills/project-on-git/SKILL.md` — the skill this build rewrites.

## THE CONTEXT A FRESH SESSION CANNOT GUESS

**The host.** OMP on Linux (`LeviathanLocal`). The kernel lives at
`/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-FACTORY/jarvis-upper` and runs as the
systemd user unit `jarvis-upper.service` (`bun src/main.ts`, `UPPER_TICK_MS=15000`, the token
from `~/.config/jarvis-upper.env`).

**The kernel's shape (AFTER W1, which is DONE and committed as `a0fba3f`).**
- `src/main.ts` — the orchestrator. `makeCycle` drives N projects with settle-all; the boot line
  reads each project's publisher state FROM THE STATUS the first tick wrote (`publisherState`,
  `src/main.ts:67`). The target check LEFT the enrollment (`src/main.ts:50`).
- `src/runtime.ts` — the per-project tick. The TARGET GUARD runs PER TICK and reads
  `project.root` — never the kernel's root (the one-word root cause of the first run's failure,
  `src/runtime.ts:470`).
- `src/guardrail.ts` — `guardrail` (the full 4-gate set, the merge order, `src/guardrail.ts:63`)
  vs `publishEligible` (the EXTERNAL gates only, the publisher, `src/guardrail.ts:52`) — the LATCH.
- `src/projects.ts` — the registry; `resolveStorePath` resolves by CWD/ROOT OWNERSHIP first
  (`src/projects.ts:178`); `legacyProject` is EXPORTED for the attach merge (`src/projects.ts:69`).
- `src/status.ts` — `RuntimeStatus` (+`reachable`, `src/status.ts:14`) and the aggregate
  (+`projectsHealthy`, `src/status.ts:49`).
- `src/merge-record.ts` — the merge observer's ledger writer (the advisory lock).
- `src/enroll.ts` — `copyKernelSurface` (the ONE copier attach REUSES, `src/enroll.ts:104`).
- `src/attach.ts` — THE NEW ENGINE: `attachPlan` (`src/attach.ts:153`) + `attachApply`
  (`src/attach.ts:225`) + the 5-guard seam (`src/attach.ts:103`).
- `src/attach-guards.ts` — THE NEW GUARDS: `realDeps` (`src/attach-guards.ts:79`).

**The enforcement surfaces (measured 2026-10-02).**
- **TTSR is DISABLED host-wide** (`ttsr.enabled=false`). The ten rules in `~/.omp/agent/rules/`
  (incl. the new `git-onboarding-skill.md`) are INERT. Do not rely on them.
- **The LIVE carrier is EXTENSIONS** — `graph-intelligence` (`GRAPH_GATE_DRIFT_HIGH` fires and
  BLOCKS edits until a ripwire call) and the lexicon-gate (`[ABIDE]` R1/R2/R3 fire on edits).
- The doctrine lives in `~/.omp/agent/APPEND_SYSTEM.md` + `RULES.md` (rule 12 names this skill).

**The two live builds (the acceptance test).**
- `jev-fact-kernel` — a WORKTREE of `JevManager` at
  `/home/leviathan/JARVIS_WORKSPACE/worktrees/jev-fact-kernel`, 248+ commits, `origin` now set,
  hooks armed. Its GitHub repo does NOT exist yet.
- `PLUTUS_VISION` — `/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/PLUTUS_VISION`, 44+ commits,
  `origin` set (PRIVATE), **`.githooks` ABSENT while `hooksPath=.githooks`** — the B3 class, live.

## THE LAWS (carried from the ten source skills)

**From goal-prompt.** ONE `/goal`, N fronts. The baseline is re-measured on first reply; inherited
numbers are STALE. ripwire is first-class: map before every edit; re-map after structural edits.

**From hydra-mode.** Interfaces land in W1; W2/W3/W4 run CONCURRENTLY against them. Every wave
passes preflight before dispatch. A wave ships ONLY with per-hunk verdicts + 100% spec coverage.
The board is the command surface; an agent's return is never a completion.

**From subagent-driven-development.** Fresh subagent per task; a ledger at
`.superpowers/sdd/<plan>/progress.md`; rulings, not stalls; the review loop per task.

**From runtime-grade.** THE SESSION IS THE RIG. Every datum is MECHANICAL (a live firing) or
PROSE-ONLY (a string in output/docs/thinking) — never conflate them. The deployed thing is not
the source. ZERO BUGS FOUND IS A RED FLAG.

**From deep-container-testing.** The plan-first protocol; the POSITIVE + NEGATIVE pairing (each
attack fires its SPECIFIC token; each legit op passes with ZERO misfire); the screenshot is the
truth; the two-sided adjudication on every failure.

**From script-test.** Real modules in a real sandbox; assertions on OBSERVATION CHANNELS (disk
bytes, rows, exit shapes) — never on spied calls. Adversarial shapes are mandatory.

**From red-team-pressure-test.** Adjudicate every probe failure BOTH ways before any verdict.
Expand the corpus until a FULL pass returns ZERO confirmed defects. Name the unswept frontier.

**From canon-doc-update.** The 2 logs (`RUNNING_BUILD_LOG` + `RUNNING_DEBUG_LOG`) update at the
MOMENT of work. The U-gates: 200+ lines, ≥3 file:line refs, the 5 read-first docs agree on the dist.

**From ship-docs-update.** The 5 ship docs; the AUDIT GATE line is mandatory; an audit-less
milestone is INCOMPLETE; a BLOCKED audit is never PASS.

**From saving-checkpoints.** src + dist+SHA + the canon + the ship docs + the manifest with HONEST
GAPS + ONE seal mode (never manifest-only). Hyphens only in the name.

## THE BUILD IN ONE PAGE

```
W1  src/attach.ts        the pure plan + the apply + the 8-step table   (the INTERFACE)
W2  src/cli-verbs.ts     verbAttach                                     (consumes W1)
    src/cli.ts           + "attach"
W3  src/attach-guards.ts assertHooksPath · mergeRegistry · planGate     (consumes W1)
    src/enroll.ts        REUSE the copier
    src/projects.ts      the registry helpers
W4  the skill + the extension carrier                                    (disjoint)
W5  THE RUNTIME SEAT — both builds attach; the daemon arms them; the ledger gains rows
```

## THE DEFINITION OF DONE

`bunx tsc --noEmit` exit 0 · `bun test` 221+ pass / 0 fail · the four new test selectors PASS ·
`bun src/cli.ts attach --dry` on a bare repo prints the plan and changes nothing · a private+free
repo refuses EARLY with the remedy · a missing `.githooks` refuses LOUD (B3 dead) · the registry
merge keeps the legacy project (B6 dead) · **BOTH live builds attach and the ledger gains a fence
row for each** (`grep '"seat":"<id>"' …/verdicts.jsonl`) · the audit gate `PASS (0 critical/high)`
· a sealed checkpoint.

## THE ANTI-DERAIL (this tree's nouns)

- **Chasing the fleet's green as the goal** — the fleet being green is the SUBSTRATE; the
  deliverable is the verb. A green fleet with no `attach` is scope-theater.
- **Fixing symptoms in the daemon** — every fix routes through the SPEC's FRs; a fix with no FR is
  scope creep.
- **The `rail-failed:TRUNCATED-65536` distraction** — it is a SEPARATE defect (the SSE buffer cap);
  log it, do not scope-creep into it.
- **Editing the live trees' code** — `PLUTUS_VISION` and `jev-fact-kernel` are the ACCEPTANCE TEST,
  not the build. Touch them only via `attach` and the operator's two clicks.
- **Trusting a green battery as capability** — the runtime seat decides.
- **Blind edits** — the graph gate WILL block (it did, twice, this session). Run ripwire first.

## THE ANTI-STOP

- "The battery is green" — not done; the verb must operate on the LIVE builds.
- "The two builds are the operator's job" — the repo creation + the visibility flip ARE; the
  attach is NOT.
- "Zero bugs found" — a red flag; the seat must push (N at once, kill mid-op, hostile input).
- "The daemon restarts clean" — that is the floor, not the proof.
- A partial wave's green with W5 open — progress, not completion.

## THE RESUME POINTERS

- the spec: `packages/git-onboarding-unification/DPL1_SPEC.md`
- the plan: `packages/git-onboarding-unification/WAVE_PLAN.md` (WAVES: 5)
- the evidence: `reports/Git_Onboarding_Unification_ShowMe.md`
- the live fleet: `runtime/status.json` + `runtime/<id>/ticks.log`
- the ledger: `/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl`
- the canon: `context_management/` · the checkpoint: `JARVIS-CHECKPOINTS/<token>/`
