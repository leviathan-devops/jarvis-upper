# DPL1 SPEC — GIT-ONBOARDING UNIFICATION (`upper attach`)

**Mission (verbatim):** *"either this happens naturally on every single build or it's a simple one
click attach command … that immediately puts the project onto the rails for this kernel and
everything works correctly. No bugs, no derailments, no broken anything."*

**Baseline:** `jarvis-upper` @ `feat/github-master-kernel` `a0fba3f` · tsc exit 0 · `bun test`
221 pass / 0 fail / 773 expect / 55 files · the live fleet green (2/2 armed, `projectsHealthy:true`).
**The live evidence this spec answers:** `reports/Git_Onboarding_Unification_ShowMe.md` (B0-B8).

## §0 THE PROBLEM (first principles)

The kernel is CORRECT at every point and the SEQUENCE is unowned. Two live builds each skipped a
different one of seven manual acts: `jev-fact-kernel` enrolled but had no remote (the guard read
the kernel's own URL — the wrong-tree bug, fixed in W1); `PLUTUS_VISION` had the remote but no
wiring, no enrollment, and `core.hooksPath` pointing at a directory that does not exist (hooks
silently inert, every commit ungated). The fix is not a better document — it is ONE verb.

## §1 THE FAILURE INVENTORY (measured, never hypothetical)

| # | evidence | class |
|---|---|---|
| B0 | `TARGET-MISMATCH: …/jarvis-upper.git != …/jev-fact-kernel` — the guard read the KERNEL's tree | wrong-scope read (FIXED in W1: `src/runtime.ts:470`) |
| B1 | `jev-fact-kernel` `ticks.log` = 1 row in 2 h | no-record (FIXED in W1) |
| B2 | the target check at construction → `rt:null` → no retry | unhealable (FIXED in W1: `src/main.ts:50`) |
| B3 | `PLUTUS_VISION` `hooksPath=.githooks`, dir ABSENT, active hooks = 0 | silent fallback (OPEN) |
| B4 | `PLUTUS_VISION` has SPEC.md + a remote, no `gates/`, no workflows, not enrolled | unenforced procedure (OPEN) |
| B5 | `plutus-vision` private + a free plan → 403 at ARM time | late detection (OPEN) |
| B6 | `enroll` writes `projects.json` fresh; the legacy project vanishes | footgun (OPEN) |
| B7 | one bad project flipped the fleet's `daemonOk` | conflated health (FIXED in W1: `src/status.ts:49`) |
| B8 | `ttsr.enabled=false`; 10 rules inert | dead enforcement (OPEN) |

## §2 THE CONTRACT (interfaces · data flows · error rules)

**§2.1 THE FROZEN SURFACE.** The 8 status contexts (`src/status-contract.ts`) and the ledger's
row shape are FROZEN. `attach` must not change either.

**§2.2 THE ERROR RULE.** Every refusal is `{ok:false, refused:"<TOKEN>", remedy:"<the exact one
command>"}` on stdout with exit 2. A remedy-less refusal is a defect.

**§2.3 THE ATOMICITY RULE.** `attachPlan` is PURE. `attachApply` mutates ONLY after every gate
passes. A refusal at any step leaves: the tree byte-identical, the registry unwritten, the
daemon untouched.

**§2.4 THE IDEMPOTENCE RULE.** A second `attach` on an attached tree reports
`action:"noop"` per step and exits 0.

**§2.5 THE DATA FLOW.** `path → AttachOpts → attachPlan (pure, 8 step verdicts) → attachApply
(mutations) → the registry + the wiring + the hooks → the daemon (the next tick)`.

## §3 THE FUNCTIONAL REQUIREMENTS

**FR-1 — the pure plan.** `attachPlan(opts): AttachPlan` returns 8 step verdicts
`{id, ok, reason?, remedy?, mutates}` with `mutates:false` for every step. VERIFY:
`bun test -t test_attach_plan_is_pure` — the tree's `git status --porcelain` before == after.

**FR-2 — the repo gate.** `planGate` reads `gh api repos/O/R`; absent → `ATTACH-NO-REPO` + the
`gh repo create` line; PRIVATE + the account plan `free` → `ATTACH-PRIVATE-FREE-REPO` + `--public`.
VERIFY: `bun test -t test_attach_refuses_private_free_early` with an injected fetch.
PASS token: the refusal fires BEFORE any file copy (`copied:[]`).

**FR-3 — the remote gate.** The tree's `origin` must parse to `O/R` (reuse `parseRemote`). Else
`ATTACH-REMOTE-MISMATCH` + the `git remote add` line. VERIFY:
`bun test -t test_attach_remote_gate`.

**FR-4 — the wiring.** Copy `gates/` + `.githooks/` + `.github/workflows/` + `packages/<id>` from
the kernel (REUSE `enroll.ts`'s copyTree/copyOne — no second copier). A missing REQUIRED artifact
in the KERNEL → `ATTACH-KERNEL-INCOMPLETE`. VERIFY: `bun test -t test_attach_copies_the_full_wiring`.

**FR-5 — the hooks gate (B3).** `assertHooksPath(root)`: set `core.hooksPath=.githooks`, then
ASSERT the dir exists AND `.githooks/pre-commit` is executable. Failure → `ATTACH-HOOKS-INERT`
with the remedy. VERIFY: `bun test -t test_attach_asserts_the_hooks_path`; the negative fixture
(a tree with the config but no dir) MUST refuse.

**FR-6 — the registry merge (B6).** `mergeRegistry` adds/updates the entry by id AND keeps every
existing project; when the file is NEW it seeds the env-legacy project. Atomic tmp+rename; the
result is re-parsed and asserted. VERIFY: `bun test -t test_attach_registry_keeps_the_legacy_project`.

**FR-7 — idempotence.** A second run → `action:"noop"` on every satisfied step, exit 0. VERIFY:
`bun test -t test_attach_is_idempotent`.

**FR-8 — the dry mode.** `--dry` prints the plan; `git status --porcelain` stays empty and the
registry's mtime is unchanged. VERIFY: `bun test -t test_attach_dry_changes_nothing`.

**FR-9 — the CLI contract.** `bun src/cli.ts attach <path> --json` → ONE JSON object, exit 0/1/2,
never a stack. VERIFY: the live invocation in the RUNTIME SEAT.

**FR-10 — the skill rewrite.** `project-on-git`'s steps 4-6 collapse into `upper attach`; the
skill names the verb and its verification block. VERIFY: the skill's own validator + a live
dry-run walk.

**FR-11 — the ABIDE carrier (B8).** The git-onboarding invariant fires with `ttsr.enabled=false`
through the extension carrier. VERIFY: a live firing on a crafted phrase.

**FR-12 — the live acceptance.** BOTH builds attach and reach the runtime: `jev-fact-kernel`
(its GitHub repo created), `PLUTUS_VISION` (public + pushed). VERIFY: `bun src/cli.ts projects`
shows both `ok:true` AND a fence row appears in the ledger for each.

## §4 THE TESTING TIERS

- **L0** `bunx tsc --noEmit` → exit 0.
- **L1** the battery (PURE functions; `bun test -t <selector>` per FR).
- **L2 SCRIPT TEST** — the real modules in a REAL sandbox: `attach` against a temp git repo with
  an injected `gh` fetch; assert on the DISK (the copied tree, the registry bytes, the hooks
  config) — never on mocks.
- **L3/L4 THE RIG** — the live host: the two builds through `attach`, the daemon's next tick,
  the ledger rows. The runtime seat (below).

## §5 ANTI-PATTERNS (each already paid for)

1. A GENERIC refusal preempting a SPECIFIC one = UNOBSERVED, never PASS.
2. Probing a SOURCE import when the CLI is what runs — drive `bun src/cli.ts attach`.
3. A probe whose expectation was wrong, reported as a defect — adjudicate BOTH sides first.
4. Fixing to satisfy a broken test — the test is adjudicated BEFORE the code is touched.
5. A silent fallback (a missing dir → "probably fine") — the B3 class.
6. A refusal without its remedy command.
7. Editing `Checkpoints/**` — sealed snapshots must not drift.

## §6 SUCCESS CRITERIA (command-verifiable)

1. `bunx tsc --noEmit` → exit 0.
2. `bun test` → 221+ pass / 0 fail (never fewer).
3. `bun src/cli.ts attach <a-bare-temp-repo> --dry` → the 8-step plan, exit 0, nothing changed.
4. `bun src/cli.ts attach <the-same> --json` → ONE JSON object; a second run reports `noop`.
5. A PRIVATE repo on the free plan → `ATTACH-PRIVATE-FREE-REPO` with the `--public` remedy.
6. A tree with `hooksPath` set and `.githooks` absent → `ATTACH-HOOKS-INERT` with the remedy.
7. The registry after an attach on a fresh kernel holds BOTH the legacy project and the new one.
8. BOTH live builds attach; `bun src/cli.ts projects` shows both `ok:true`; **the ledger gains a
   fence row for each** (`grep '"seat":"<id>"' verdicts.jsonl`).
9. The audit gate (`qwen-code-audit`) → `GATE: PASS (0 critical/high)` over the W2 diff.
10. A sealed checkpoint with src + docs + manifest.

## §7 RESUME GUIDE

Read in order: this spec → `WAVE_PLAN.md` → `BLUEPRINT.md` → `MASTER_PROMPT.md` →
`reports/Git_Onboarding_Unification_ShowMe.md` (the B0-B8 evidence) →
`forensic/FAILURE_LEDGER_MULTIPROJECT.md` (the earlier audit). The runtime ledger:
`runtime/<id>/ticks.log`. The board: the todo list.

## §8 OPEN QUESTIONS (with the ruling)

- **Q1: does `attach` also `arm`?** → RULING: `--arm` opt-in. Arm needs the workflows to have
  run once (the ORDER LAW), which cannot be true at attach time.
- **Q2: does `attach` restart the daemon?** → RULING: no; print the command. `--restart` opt-in.
- **Q3: what if the target is a WORKTREE of another repo?** → RULING: `attach` accepts it; the
  remote gate reads the WORKTREE's origin (the W1 fix's lesson: the project's tree, never the
  kernel's).

## APPENDIX — ZERO-TRUST AUDIT OF THIS SPEC

- Every B-number cites a live measurement from `reports/Git_Onboarding_Unification_ShowMe.md`. ✓
- The baseline numbers were re-measured this turn (221 pass, tsc 0, the fleet green). ✓
- NOT CLAIMED: the two live builds' DoD (their PRs have not merged through the gates yet).
