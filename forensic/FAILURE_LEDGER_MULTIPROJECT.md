> ## ⚠ THE VERDICT IS **NOT DONE** — READ THIS FIRST
>
> **3 CRITICAL, 5 HIGH, 4 MEDIUM, 3 LOW confirmed. The mission's own definition of done is NOT
> MET.**
>
> 1. **The live authority (`packages/github-master-kernel/GOAL_PIN_RUNTIME_OPERATIONAL.md`)
>    requires *a real PR MERGED through the kernel's own gates*.** The PR is
>    `{"state":"OPEN","mergedAt":null}` — **NOT MERGED**. 6 of its 8 clauses are met; clause 7
>    is not.
> 2. **There is a LIVE FALSE RED on a real pull request right now**, published by this daemon:
>    `factory/fence2=error` + `factory/verdict=failure` at `2026-09-28T13:23:25Z`, while
>    `verify()` on the same jobDir returns **VERIFIED**. The self-latch (§3-A) means **the
>    daemon cannot correct it**.
> 3. **The multi-project layer has NEVER RUN IN PRODUCTION** (`legacy:true`, no `projects.json`).
>    "One store per project" is **false live**; the CLI reads and writes the **wrong store** in
>    fleet mode; `arm` and `enroll` have **never been executed** against a real target.
> 4. **My own published claims are RETRACTED**: the concurrency claim (a misattributed test) and
>    "8 contexts green, mergeable MERGEABLE" (a snapshot quoted as a state).
>
> This document is an **AUDIT**, not a completion report. §7 is the honest survive list — what
> genuinely works. **Nothing in §7 licenses a "done" claim.**

# FAILURE LEDGER — jarvis-upper, the multi-project layer + the live false-failure

**Audit date:** 2026-09-29 · **Head:** `d02ef7c` · **Method:** the red-team-slop-audit skill
**The charge (operator, verbatim):** *"i need you to immediately tell me the FULL status of the
github system kernel and how i can immediately use it to enforce a project's build package on
every commit/PR and force fucking alignment and anti theatricality"* → then *"this needs to be
production gready for async multi project use immediately"*.

---

## §0 — METHOD, INSTRUMENTS, AND MY OWN INSTRUMENT FAILURES

**The three lenses:**
1. **Alpha (the fabrication lens)** — dispatched: *"every number is a lie until a command
   reproduces it; every test asserts nothing until you read its assertion."* RETURNED.
2. **Bravo (the slop lens)** — dispatched: dead code, no-ops, swallowed errors, comment-code
   contradiction. (still yielding at this stamp)
3. **The author's own pass (the third lens)** — STEP 0's authority inventory, the 7 hunt lists,
   and the live-system probes.

### ★ MY OWN INSTRUMENT FAILURES (mandatory, and the most important section)

**IF-1 — I GRADED AGAINST THE WRONG AUTHORITY FOR THE WHOLE SESSION.** I worked to
`.trident/remediation-pkg/DPL1_REMEDIATION.md` (63 lines) and never opened
`packages/github-master-kernel/` — the package that **matches this branch's name**
(`feat/github-master-kernel`), dated 2026-09-23/24, 9 documents. **This is the superseded-
authority-grading class (#21) and the sleepwalker class (#17) at once.** §2 carries the
measurement. Any compliance figure I published before this audit is **RETRACTED**.

**IF-2 — MY CONCURRENCY TEST DOES NOT TOUCH THE ORCHESTRATOR.** I claimed "the multi-project
layer is concurrent" and attributed it to `test_multi_project_ticks_run_concurrently`. Alpha
measured: the test **fans out itself** (`await Promise.allSettled(rts.map(rt => rt.tick()))`)
and never imports `main.ts`. It proves the RUNTIME holds no cross-instance lock; it does
**nothing** for the orchestrator at `src/main.ts:77`. **The claim was misattributed.**

**IF-3 — I CLAIMED "8 contexts green, mergeable MERGEABLE" AND IT IS NOW FALSE.** That was true
at `2026-09-25T11:49:12Z`. The newest statuses on the same head are
`factory/fence2=error` + `factory/verdict=failure` at `2026-09-28T13:23:25Z`. I quoted a
snapshot as a state. **RETRACTED.**

**IF-4 — I NEARLY MISSED THE LATCH.** My first read of `eligible: 0` was "a gate is failing,
fine". It took the full chain (§3-A) to see that the failing gate is **the daemon's own
output**, and that the loop is **unbreakable**.

**IF-5 — A FALSE POSITIVE I DISCARDED:** I initially flagged `tests/multi_project.test.ts:21`
(`${root}/.wt/${id}`) as a wrong-tree scan (H6). It is a `mkdtemp` root — a legitimate temp.
**DISCARDED, recorded.**

---

## §2 — THE AUTHORITY DOCUMENTS AND THEIR LIVENESS

**STEP 0.1's finding: SIX authority packages exist, and they are MUTUALLY BLIND.**

| the document | lines | date | status | governs |
|---|---|---|---|---|
| `packages/github-master-kernel/DPL1_SPEC.md` | 143 | 2026-09-23 | no status field | **the branch's own package** |
| `packages/github-master-kernel/GOAL_PIN_RUNTIME_OPERATIONAL.md` | 203 | 2026-09-24 | no status field | **the mission** |
| `packages/github-master-kernel/BLUEPRINT.md` | 113 | 2026-09-24 | no status field | the design |
| `packages/github-master-kernel/WAVE_PLAN.md` | 110 | 2026-09-24 | no status field | the waves |
| `packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md` | 413 | 2026-09-23 | `**Status:** DRAFT` | **the spec-diff gate's authority** |
| `.trident/green-merge-pkg/DPL1_GREEN_MERGE.md` | 65 | 2026-09-24 | — | the green-merge package |
| **`.trident/remediation-pkg/DPL1_REMEDIATION.md`** | **63** | 2026-09-24 | — | **what I worked to** |
| `packages/common-sense-firewall/BLUEPRINT.md` | 213 | 2026-09-24 | status present | a different subsystem |

### THE SLEEPWALKER CHECK (the mutual-blindness measurement)

```
$ grep -c -iE 'github-master-kernel|GOAL_PIN_RUNTIME' .trident/remediation-pkg/*.md
  BLUEPRINT_REMEDIATION.md:0   DPL1_REMEDIATION.md:0   WAVE_PLAN_REMEDIATION.md:0
$ grep -c -iE 'jarvis_upper_tier_DPL1_SPEC' .trident/remediation-pkg/*.md
  BLUEPRINT_REMEDIATION.md:0   DPL1_REMEDIATION.md:0   WAVE_PLAN_REMEDIATION.md:0
$ grep -c -iE 'remediation-pkg|DPL1_REMEDIATION' packages/github-master-kernel/*.md
  BLUEPRINT.md:0  DPL1_SPEC.md:0  GATE_WIRING_PLAN.md:0  GOAL_PIN_RUNTIME_OPERATIONAL.md:0  WAVE_PLAN.md:0
```

**ZERO MUTUAL REFERENCES, in both directions, across eight documents.** The two packages were
authored without either reading the other. Neither is *superseded* in the formal sense — they
are **disjoint**, and the live authority for this branch is the one named after it.

**THE LIVE AUTHORITY'S DoD (verbatim, `GOAL_PIN_RUNTIME_OPERATIONAL.md`):**
> *"DONE only when a real PR is MERGED through the kernel's own gates, with the merge commit's
> SHA recorded in the ledger. **UNIT TESTS ARE SLOP — they are never evidence. The runtime IS
> the test.**"*

### THE COMPLIANCE MEASUREMENT — the 8 clauses, each against the artifact

| # | the clause | the verdict | the evidence |
|---|---|---|---|
| 1 | a real worktree, HEAD == a 40-char sha | **MET** | `~/.ao/data/worktrees/jarvis-upper/jarvis-upper-4` → `c3c3ed0d562edd0443a2fe2ba4e5473bb3e4bf50` |
| 2 | a SPEC.md in the fence v2 format | **MET** | `job: fence` · `seat: jarvis-upper-4` · `mission: green-merge` · `steps:` |
| 3 | a PASS row with `spec_bound:true` for that sha | **MET** | `grep -c 'spec_bound:true' verdicts.jsonl` → **17540** |
| 4 | `verify()` → VERIFIED (both sources, same sha) | **MET** | `verdict: VERIFIED · fence ran:true exitCode:0 ledgerVerdict:PASS · review approved targetSha===headSha · reasons []` |
| 5 | the two statuses POSTed to the REAL API (201) | **MET, THEN BROKEN** | `success @2026-09-25T11:49:12Z` → **`factory/fence2=error` + `factory/verdict=failure` @2026-09-28T13:23:25Z** |
| 6 | all 8 required contexts success on the head | **FAILED** | the 6 `gates/*` are `success`; the 2 `factory/*` are **red** |
| 7 | `PUT /pulls/{n}/merge` → 200 — **THE PR MERGES** | **NOT MET** | `{"state":"OPEN","mergedAt":null,"mergeStateStatus":"BLOCKED","reviewDecision":"REVIEW_REQUIRED"}` |
| 8 | the merge commit's SHA recorded in the ledger | **MET for other PRs** | 2 rows: `{"job":"merge","verdict":"MERGED","pr":3,...}` and `{"pr":4,"head":"c3c3ed0d..."}` |

**VERDICT ON THE AUTHORITY: 6 of 8 clauses met; clause 7 (THE defining clause) NOT MET.**
The mission is **NOT DONE**, and the blocker is not the operator's approval alone — it is §3-A.

---

## §3 — THE FINDINGS

### ★ A · CRITICAL — THE SELF-LATCHING FALSE-FAILURE (mine, live, on a REAL PR)

**LOCATION** `src/verdict.ts:57` (`defaultRunFence`) + `src/runtime.ts:321` (`cannotRun`) +
`src/runtime.ts:523` (`publishable`) + the systemd unit's `KillMode`.

**WHAT** A daemon restart publishes a **transient infrastructure kill** as a **permanent red
status on a live pull request** — and the resulting loop *cannot be broken by the daemon*.

**COMMAND + OUTPUT (the full chain, every step measured):**
```
$ systemctl --user show jarvis-upper -p KillMode -p KillSignal
KillMode=control-group
KillSignal=15

$ sed -n '56,62p' src/verdict.ts
async function defaultRunFence(argv: string[]) {
  const p = Bun.spawn(["python3", ...argv], { stdout: "pipe", stderr: "pipe" });

$ gh api .../commits/c3c3ed0d.../statuses --jq '.[0:2]'
2026-09-28T13:23:24Z factory/fence2=error  [FENCE-NOT-RUN: Error: FENCE-INVARIANT-FAILED: exit 143]
2026-09-28T13:23:25Z factory/verdict=failure [verdict: not approved]

$ bun /tmp/latch.ts     # verify() on the SAME jobDir the daemon uses
  guardrail: {"ok":false,"reasons":["GATE-MISSING:audit","GATE-MISSING:hardened","GATE-MISSING:fence2"]}
  verify:    VERIFIED | fence: FENCE-GREEN
  >>> THE CONTRADICTION: verify=VERIFIED but guardrail.ok=false
  >>> the publisher requires guardrail.ok -> it can NEVER re-publish the recovery

$ SELECT pr_node,gate,verdict,at FROM gate_pass WHERE pr_node='pr:jarvis-upper-4:2'
  audit    fail 1790698467
  ci_green pass 1790698467
  fence2   fail 1790698467
  hardened fail 1790698467
```

**THE MECHANISM (six steps, each one a link in the chain):**
1. `KillMode=control-group` + `KillSignal=15` → **any** `systemctl restart jarvis-upper`
   SIGTERMs the whole cgroup, **including the in-flight `python3 fence2.py` child**.
2. The child dies with **exit 143** (128+15). The fence itself takes **~100 ms** (3 runs:
   133/102/111 ms) and `defaultRunFence` has **no timeout at all** — the 6000 ms belongs to the
   *reviews* fetch — so this was **always** an external kill, never a slow fence.
3. `verdict.ts` labels it `FENCE-NOT-RUN: FENCE-INVARIANT-FAILED: exit 143`.
4. `runtime.ts:321`'s `cannotRun` fires → the polarity law POSTs `state:"error"` +
   `state:"failure"` **to the real GitHub PR**.
5. The tick's **mirror** step reads `/commits/{sha}/statuses` — *its own POST* — and writes
   `gate_pass.fence2=fail`, `audit=fail`, `hardened=fail`.
6. `guardrail` reads the mirror → `ok:false` → `eligible=0`. The publisher is
   `readyRows.filter((r) => isEligible(r.id))` → **it will never run again for this PR.**

**WHY** The polarity law ("a verify that cannot run MUST POST error, never green") is **correct
and load-bearing**. The defect is that a **killed process was classified as a cannot-run**. A
process that received SIGTERM carries **no information about the pull request** — it is
infrastructure, not evidence.

**WHY ALLOWED** The law was written for a *legitimate* cannot-run (the fence refuses, the
artifact is absent, the ledger is unreadable). A kill-by-signal looks identical at the exit-code
level (`!= 0`), and every test injects `runFence`, so no test ever spawned a real child that
could be killed.

**THE FIX (applied this session):** a signal-death (`code >= 128`) is **retried once**; if it
dies again the fence throws `FENCE-TRANSIENT:<signal>`; `verdict.ts` propagates it as its own
class; `publishVerdictForPr` **SKIPS the publish entirely** for it (loud in `errors[]`, no POST).
```
src/verdict.ts  if (r.code >= 128) r = await runOnce();          // one retry
               if (r.code >= 128) throw new Error(`FENCE-TRANSIENT: killed by signal ...`);
src/runtime.ts  if (v.sources.fence.reason.startsWith("FENCE-TRANSIENT")) { ...skip... }
```
**VERIFIED:** `tsc exit 0` · `191 pass / 0 fail`.

### ★ B · CRITICAL — THE MUTUALLY-BLIND AUTHORITIES (class #17 + #21)

Measured in §2: **zero** mutual references in both directions. The consequence: I produced a
full session of work graded against a 63-line package while the branch's own 9-document package
(whose DoD requires a **real merge**) sat unread. **The compliance numbers I published are
retracted; the correct standard is §2's 8-clause table.**

### ★ C · CRITICAL — THE LIVE DoD IS NOT MET

Clause 7: `{"state":"OPEN","mergedAt":null}`. The authority says *"DONE only when a real PR is
MERGED."* **It is not done.**

### D · HIGH (Alpha, F4) — THE OPERATOR CLI READS AND WRITES THE WRONG STORE IN FLEET MODE

**LOCATION** `src/cli.ts:21,29` + 9 call sites in `src/cli-verbs.ts` (41,54,67,75,84,98,119,151,187)
**WHAT** every verb calls `openStore()` with **no argument** → `STORE_PATH` (the root store),
never `spec.store`. In a registry deployment `upper gates` reads an empty store, and
`upper kick` / `upper promote` **write a store the daemon never reads** — the operator's
readiness decision lands nowhere.
**EVIDENCE** `CLI_default_STORE_PATH=.../jarvis-upper/store.sqlite` vs
`registryProjectStore=.../runtime/some-project/store.sqlite`; the verbs take no project argument.
**WHY ALLOWED** in the LIVE legacy deployment the two coincide, so it is invisible today.
**FIX** every verb takes a `--project <id>` (or resolves the registry's single entry) and opens
`spec.store`.

### E · HIGH (Alpha, F5) — "ONE STORE PER PROJECT" IS FALSE LIVE AND UNENFORCED

**LOCATION** `store.sqlite` (live) + `src/projects.ts:85,126`
**WHAT** the live store holds **two projects' rows**, and the registry accepts two entries
pointing at the same store.
**EVIDENCE**
```
$ SELECT project, state, COUNT(*) FROM pr_node GROUP BY project, state
  jarvis-upper | merged         | 2
  jarvis-upper | open           | 3
  jarvis-upper | ready_to_merge | 1
  jfm-e2e      | open           | 8
```
`checkProject` validates `store` only as an absolute path; `loadRegistry` dedupes on `id` only.
**WHY ALLOWED** the legacy path *is* the shared root store by design (one project), and the
default `listPrs` pulls ALL AO projects into it — so the shared file predates the layer.
**FIX** refuse two registry entries with the same `store`; assert the isolation at load.

### F · HIGH (Alpha, F7) — THE DISARM IS NOT SURFACED IN THE STATUS ARTIFACT

**LOCATION** `src/main.ts:17` (its own stated law) + `:59` (`ok:true` for a disarmed project) +
`src/runtime.ts:396` (a once-only log)
**WHAT** `main.ts:17` says *"A DISABLED PROJECT IS NAMED EVERY CYCLE — never a silent skip."*
It is **not**: the disarm is logged once at construction, and `tickCycle` copies
`{...r.value, ok: e.ok}` — **dropping `reason`** — so the artifact reports
`"ok": true, "errors": []` for a project that is **disarmed and inert**.
**EVIDENCE** live `runtime/status.json`: `projects.jarvis-upper.ok:true, errors:[]` while
`upper projects` says `DISARMED:no GITHUB_TOKEN`. **A monitor cannot see the disarm.**
**FIX** carry `reason` into the aggregate row; a disarmed project is `ok:false` + a named reason.

### G · HIGH (Alpha, F9) — `upper arm` IS NON-IDEMPOTENT AND CONTRADICTS ITS OWN CONTRACT

**LOCATION** `src/cli-verbs.ts:222,227,235,236,238` + `src/cli.ts:15`
**WHAT** (a) it POSTs unconditionally — `grep -rn rulesets src/` returns **one** hit, the POST
URL; no GET, no reconciliation. (b) it hardcodes `rulesetFor({factoryContexts:true})` while
`enroll.ts:10-12` documents the ORDER LAW — arming a **disarmed** project installs a ruleset
requiring two contexts its daemon will **never post** ("the merge button dead with every check
green"). (c) the documented `[--no-factory]` flag is **unreachable** — `extraAllowance` is 0 for
`arm`, so `bun src/cli.ts arm jarvis-upper --no-factory` exits 2 with usage.
**WHY ALLOWED** it has **never been executed** against a live repo (no token in this
environment). **FIX** GET-then-reconcile; derive `factoryContexts` from `projectToken(spec)`;
give `arm` the extra allowance and implement the flag.

### H · HIGH (Alpha, F10) — `enroll` OVERWRITES FOREIGN FILES WITH NO BACKUP AND NO TEST

**LOCATION** `src/enroll.ts:53` (`copyFileSync`) + `:79`
**WHAT** `copyTree` overwrites every target file in `gates/`, `.githooks/`,
`packages/<id>/`, `.github/workflows/{gates,drift}.yml` — **no backup, no diff, no conflict
detection** — and reports it as `copied`, indistinguishable from a fresh write. A foreign
`.githooks/pre-commit` in the target is **silently destroyed**.
**EVIDENCE** `grep -rn '\.bak|backup|BACKUP' src/` → *No matches found*. Every enroll test
targets a fresh `scratchProject()`; **the overwrite path has never been exercised.**
**FIX** detect a pre-existing differing file → a named `SKIPPED-CONFLICT` (or `.bak` + a report);
add the test that plants a foreign hook.

### I · MEDIUM (Alpha, F1) — THE ANTI-"BUILT-BUT-NOT-WIRED" PIN IS A SOURCE-TEXT PIN

**LOCATION** `tests/publisher_wired.test.ts:11-23`
**WHAT** the one test guarding the built-but-not-wired class asserts only on `main.ts`'s **text**:
`toContain("project")` is satisfied by the import path `"./projects"` (main.ts:27) and by
comments. **It passes with `main()` deleted.**
**FIX** drive `main()` (an exported, test-callable async function) and assert the boot line's
`counts` object.

### J · MEDIUM (Alpha, F3) — THE CONCURRENCY CLAIM IS MISATTRIBUTED

**LOCATION** `tests/multi_project.test.ts:25-38` + `src/main.ts:77`
**WHAT** the test fans out itself; **no test drives `main()`/`tickCycle()`**.
`grep -rn 'src/main' tests/` → 2 hits, **neither executes it**. The orchestrator's concurrency
is real in source and **unproven by the test that claims it**.
**FIX** a test that boots the orchestrator against N registry entries with instrumented runtimes.

### K · MEDIUM (Alpha, F8) — `GATE-MISSING` CONFLATES ABSENT WITH FAILED

**LOCATION** `src/guardrail.ts:35`
**WHAT** one branch covers both "the row is absent" and "the row exists and FAILED", always
naming `GATE-MISSING`. Live rows `audit/hardened/fence2=fail` are reported as `GATE-MISSING`.
**FIX** `GATE-FAILED:<g>:<verdict>` vs `GATE-MISSING:<g>`.

### L-M · LOW (Alpha, F11/F12) — A TAUTOLOGICAL ASSERTION AND A WEAK ONE

`tests/live_e2e.test.ts:26-28` builds a string then asserts it contains a substring it put there,
then `return`s → the daemon-down branch **passes asserting nothing** (latent: the UP branch ran).
`tests/spec_audit.test.ts:39-43` asserts only `not.toContain("VERDICT:APPROVED")` — satisfied by
REJECTED.

---

## §4 — THE VERBATIM PROBES

All reproductions are inline in §3. The live-system probes:
```
$ systemctl --user is-active jarvis-upper          -> active
$ cat runtime/status.json | jq '{tick,eligible,projects,failed}'
  {"tick":153,"eligible":0,"projects":{"jarvis-upper":{...,"ok":true}},"failed":0}
$ bun src/cli.ts gates
  {"ok":true,"ready":1,"eligible":0,"checks":[{"pr":"pr:jarvis-upper-4:2","ok":false,
   "reasons":["GATE-MISSING:audit","GATE-MISSING:hardened","GATE-MISSING:fence2"]}]}
$ gh pr view 2 --json state,mergedAt,mergeStateStatus,mergeable,reviewDecision
  {"state":"OPEN","mergedAt":null,"mergeStateStatus":"BLOCKED","mergeable":"MERGEABLE",
   "reviewDecision":"REVIEW_REQUIRED"}
```

---

## §5 — THE SLOP TAXONOMY (grep-able)

| # | the class | where it bit here |
|---|---|---|
| 21 | **superseded/disjoint-authority grading** | IF-1, §2 — I graded against a 63-line package while the branch's own package sat unread |
| 17 | **unread-package plan / sleepwalker** | §2 — zero mutual references across 8 docs |
| 6 | **claim-vs-artifact** | IF-3, §3-A, §3-D, §3-E, §3-F — a snapshot quoted as a state; a store claim contradicted live |
| 2 | **transient-as-verdict** (a new class this audit names) | §3-A — a SIGTERM'd child published as a substantive red |
| 4 | **pass-by-absence, inverted** | §3-A — "cannot-run → error" applied to a process that never ran |
| 9 | **self-certifying comment** | §3-F — `main.ts:17` states a law the body does not implement |
| 3 | **silent fallback** | §3-E — the registry accepts a shared store |
| 1 | **source-text pin** | §3-I — the anti-wiring pin is a grep |
| 14 | **metric inversion** | §3-J — a test that cannot see the property it is cited for |
| 8 | **never-executed path** | §3-G/H — `upper arm` never ran; the enroll overwrite path never ran |
| 22 | **lost constraint in a doc chain** | §3-G — `enroll.ts`'s ORDER LAW is violated by its own sibling verb |

---

## §6 — THE REBUILD REQUIREMENTS

| # | requirement | traces to | the mechanical check |
|---|---|---|---|
| 1 | a signal-killed fence is a TRANSIENT, never a published verdict | §3-A | `grep -n 'FENCE-TRANSIENT' src/verdict.ts src/runtime.ts`; a test that kills a fake fence child |
| 2 | the factory's eligibility MUST NOT depend on contexts the factory itself posts | §3-A | a test: publish a failure, then assert the recovery still publishes |
| 3 | every authority doc carries a `**Status:**` line + a `**Supersedes/Governed-by:**` line | §2 | a test that every `packages/**/*.md` parses both fields |
| 4 | the branch's own package is the COMPLIANCE standard | §2 | the compliance table cites `GOAL_PIN_RUNTIME_OPERATIONAL.md`'s clauses |
| 5 | every CLI verb resolves the registry's store | §3-D | `grep -c 'openStore()' src/cli-verbs.ts` → 0 |
| 6 | the registry REFUSES two entries with the same `store` | §3-E | a loadRegistry test with a duplicate store path |
| 7 | a disarmed project is `ok:false` + a named reason in the AGGREGATE | §3-F | assert the live `runtime/status.json` row for a disarmed project |
| 8 | `upper arm` is idempotent (GET → reconcile) and derives factoryContexts from the token | §3-G | a test with a stubbed fetch asserting the GET precedes the POST |
| 9 | `enroll` never overwrites a differing file without a backup + a named conflict | §3-H | a test that plants a foreign `.githooks/pre-commit` |
| 10 | the anti-wiring pin drives `main()` | §3-I | the test imports and awaits `main()` |
| 11 | the orchestrator's concurrency has its own test | §3-J | a test that boots the orchestrator |
| 12 | `GATE-MISSING` is distinct from `GATE-FAILED` | §3-K | a guardrail test with a present-but-failed row |

---

## §7 — THE HONEST SURVIVE LIST (Alpha's, corroborated)

1. **THE BATTERY IS REAL.** `bun test` → `191 pass / 0 fail / 674 expect() calls / 51 files`.
2. **THE SUITE IS BEHAVIOURAL, NOT GREP-SHAPED.** ~**176 of 191** tests execute real code —
   real `bash` subprocesses against real temp git repos, real SQLite, real module imports, HTTP
   injected only at the `fetch` seam. **Only 3 tests are pure source-text pins (1.6%).**
3. **THE REGISTRY VALIDATION IS STRONG.** A bad id, a missing `store`, a `tokenEnv` that looks
   like key material, a duplicate id, a non-existent root — all named and skipped.
4. **`enroll` REGISTRY IDEMPOTENCY IS REAL**; **dry-run writes nothing** yet reports what would.
5. **THE GUARDRAIL'S FAIL-CLOSED LAWS ARE REAL AND TESTED** (NULL head → STALE, unknown PR →
   PR-MISSING, unmerged dep → DEP-UNMERGED, remote throw → `ok:false`).
6. **THE PUBLISH POLARITY LAW IS REAL** — a cannot-run or throwing verify never yields success.
7. **THE STORE MIGRATIONS ARE REAL** — the FK rebuild preserves the CHECKs, the dedupe keeps the
   latest `at` (not MAX(rowid)).
8. **THE INTERFACE CONTRACT IS CROSS-CHECKED** — the 8 contexts == `ruleset.json` == every
   `gates.yml` job name, by real YAML/JSON parse.
9. **THE LIVE DAEMON GENUINELY RUNS THE KERNEL** — systemd `active`, Main PID on `src/main.ts`,
   tick advancing, cursor 1232, `wire_capture.json` written.
10. **THE CLI IS HONEST ABOUT ITS OWN MODE** — `upper projects` self-reports `legacy:true` and
    `DISARMED:no GITHUB_TOKEN`. **It does not pretend to be a fleet.**
11. **THE `Checkpoints/**` TEST EXCLUSION WORKS** — 200+ stale test copies on disk, 51 files ran.

---

## §8 — THE INDEPENDENT AUDITORS' RETURNS

**Alpha (the fabrication lens) — RETURNED.**
**Its verdict, verbatim:** *"0 critical / 5 high / 4 medium / 3 low — battery honest, core laws
real, but the multi-project layer is surface-theatre: never deployed (`legacy:true`), concurrency
claim untested against the orchestrator, one-store-per-project contradicted live and unenforced,
CLI verbs read/write the wrong store in fleet mode, disarm not surfaced in the status artifact,
arm non-idempotent + contract-violating, enroll overwrites foreign hooks with no backup and no
test."*

**Its 4 declared instrument failures** (published, per §6): a refuted "the guardrail read is
broken" (the rows ARE found — `fails` are intentionally reported as `GATE-MISSING`); a refuted
"`Checkpoints/**` is not ignored"; a shell-firewall limit (no `&&`/`|`/`>`); a scope limit (no
GitHub API call, so the duplicate-ruleset server behaviour is code-proven but server-UNVERIFIED).

**CORROBORATION MATRIX** (mine vs Alpha's, independently derived):

| the defect | the author's pass | Alpha | verdict |
|---|---|---|---|
| the authority blindness (§2) | FOUND | not in scope | **CONFIRMED** |
| the self-latching false-failure (§3-A) | FOUND | not in scope | **CONFIRMED** |
| the live DoD not met (§3-C) | FOUND | confirmed (`mergedAt:null`) | **CONFIRMED** |
| the CLI wrong-store (§3-D) | not found | FOUND | **CONFIRMED** |
| one-store-per-project false (§3-E) | **I claimed it WORKS — REFUTED** | FOUND | **THE CLAIM IS DEAD** |
| the disarm not surfaced (§3-F) | not found | FOUND | **CONFIRMED** |
| `arm` non-idempotent (§3-G) | not found | FOUND | **CONFIRMED** |
| `enroll` overwrite (§3-H) | not found | FOUND | **CONFIRMED** |
| the concurrency
 misattribution (§3-J) | **I made this claim** | FOUND | **THE CLAIM IS DEAD** |

**Bravo (the slop lens)** was still yielding at this stamp. Its findings fold in when it lands.

---

## §9 — COVERAGE, WASTE, AND THE GAPS I DID NOT EXAMINE

**Covered:** the 6 authority packages (dates, statuses, mutual references) · the 8-clause DoD
against the live system · `src/verdict.ts`, `src/runtime.ts`, `src/main.ts`, `src/projects.ts`,
`src/enroll.ts`, `src/status.ts`, `src/guardrail.ts`, `src/cli-verbs.ts`, `src/cli.ts`,
`src/store.ts` · the live GitHub API (statuses, check-runs, the PR) · the live daemon
(status.json, the systemd unit, the journal) · the store (rows, types, the mirror) · the battery
· the test census · `gates/` · `.github/workflows/`.

**NOT examined (the unswept frontier, named):**
- `ao-client/` (the HTTP/SSE client + the generated `gen/` routes)
- `src/execute.ts`, `src/plan.ts`, `src/publish.ts`, `src/desks.ts`, `src/reducers.ts`,
  `src/attribute.ts`, `src/dossier.ts`
- the `packages/github-master-kernel/` and `packages/common-sense-firewall/` contents beyond
  their heads (their DoDs, their wave plans) — **the direct consequence of IF-1**
- `.github/workflows/drift.yml`
- the per-file scan of the changed surface on the repaired audit lane

**WASTE METRIC:** the session spent its largest budget on 13 fix waves against a **63-line**
package, and the single most valuable artifact (the 203-line GOAL_PIN) was never opened.
**The waste is the root cause's symptom, not a separate finding.**

---

## §10 — THE ROOT-CAUSE SYNTHESIS

Every confirmed defect traces to one of **two** roots:

**ROOT 1 — THE STANDARD WAS NEVER ESTABLISHED.** I began work without running STEP 0. The
consequence is not one defect but a *class*: every claim I made was measured against the wrong
yardstick, so "191 pass", "the multi-project layer is production-ready", and "8 contexts green"
are all **true statements about the wrong question**. The live authority asks one question —
*did a real PR merge?* — and the answer is no.

**ROOT 2 — THE SYSTEM'S OUTPUT IS AN INPUT TO ITSELF.** §3-A's latch is a **circular
dependency**: the publisher posts a status, the mirror reads that status, the eligibility gate
consumes the mirror, and the publisher is gated on eligibility. The factory's own transient
error therefore permanently disables the only path that could correct it. This is the
"inverted dependency" class (#19) and it is **structural**, not a coding slip: the fix is to
sever the loop (eligibility must not consume the factory's own verdict), and §6 req 2 carries it.

**THE META-LESSON:** the audit's most valuable finding was not a defect in the code — it was a
defect in **what I was measuring**. The first four steps of the skill's STEP 0 exist because
that failure is the cheapest to make and the most expensive to discover late.

---

## §11 — THE SEVERITY LEDGER + THE ANSWER

| severity | count | the ids |
|---|---|---|
| **critical** | **3** | A (the self-latching false-failure) · B (the mutually-blind authorities) · C (the live DoD not met) |
| **high** | **5** | D (the CLI wrong store) · E (one-store-per-project false LIVE) · F (the disarm not surfaced) · G (`arm` non-idempotent + contract) · H (`enroll` overwrites) |
| **medium** | **4** | I (the source-text pin) · J (the concurrency misattribution) · K (GATE-MISSING conflation) · IF-2 |
| **low** | **3** | L, M (the tautology + the weak assertion) · IF-5 |

**FIXED THIS SESSION:** A (the transient class: a killed fence retries once, then SKIPS the
publish — `tsc exit 0`, `191 pass / 0 fail`).

**THE ANSWER (stated plainly):**

1. **The kernel's enforcement layers are REAL** (§7: 191 behavioural tests, the ruleset armed
   with `bypass_actors: []`, the 6 CI gates + 2 daemon contexts cross-checked, the live daemon
   running).
2. **The multi-project layer is NOT PRODUCTION READY** — it has **never run in production**
   (`legacy:true`), "one store per project" is **false live**, the operator CLI **reads and
   writes the wrong store** in fleet mode, the disarm is **invisible** in the status artifact,
   and `arm`/`enroll` have **never been executed**.
3. **THE MISSION IS NOT DONE.** The live authority's definition is *a real PR merged through the
   kernel's own gates*, and the PR is `OPEN` with `mergedAt: null`.
4. **The false red on the live PR is MY artifact** — a daemon restart published a SIGTERM'd fence
   as a permanent failure, and the self-latch prevents the repair.

**THE IMMEDIATE NEXT ACTION (the highest-value, in order):** break the latch (so the daemon can
re-publish the *correct* verdict and the PR's statuses go green again), then fix §3-D (the CLI
store) since it is the operator's own interface, then §3-E/F (the fleet invariants).
