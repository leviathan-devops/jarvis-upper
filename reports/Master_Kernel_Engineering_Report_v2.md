# JARVIS-UPPER MASTER KERNEL — ENGINEERING REPORT v2
**Series:** Master Kernel (the GitHub-enforcement kernel lineage; v1 = the source-campaign record)
**Project:** jarvis-upper — the GitHub merge-gate enforcement kernel
**Date:** 2026-09-24
**Author:** omp agent (session 4 — the SYSTEM RUNTIME audit)
**Baseline:** `feat/github-master-kernel` @ `30bf9f8`
**Commit:** `be46bd6` (the branch = the remote)
**Container:** NONE this round · the runtime proof is the LIVE HOST

---

## ⚠ THE SUBJECT LAW (read this first)

**THE OPERATOR'S RULING: source tests are slop; the runtime is the only thing that matters.**

This report therefore cites **ONLY** evidence from the RUNNING system: the live kernel
process, the live AO daemon, the real GitHub API, the real merge attempt, the real CI, the
DEPLOYED git hooks. Every source-level test (tsc, `bun test`, the source-import corpus) is
**labelled SLOP and excluded from the verdicts** — it proves the source tree compiles and
its functions behave under a harness; it does NOT prove the system runs.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  THE EVIDENCE HIERARCHY (what counts, in order)                          │
├──────────────────────────────────────────────────────────────────────────┤
│  1. THE RUNNING PROCESS    its own artifacts (status.json, ticks.log,    │
│                            the journal, the PID's elapsed time)          │
│  2. THE REAL API           a live GitHub read (the POSTs, the merge 405) │
│  3. THE DEPLOYED ARTIFACT  the git hooks firing on a real commit/push    │
│  4. THE LIVE DEPENDENCY    the AO daemon answering on :3001              │
│  ──────────────────────────────────────────────────────────────────────  │
│  SLOP (excluded): tsc, bun test, source-import probes, ocr scans         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## ONE-PARAGRAPH SUMMARY

`jarvis-upper` is a **GitHub merge-gate enforcement kernel** that reads the AO session fleet
into a SQLite railway, orders merges topologically, blocks any PR whose gates are not green
+ sha-bound + dep-merged, and POSTS the two `factory/*` commit statuses the GitHub ruleset
(id 23838059) waits on. **As of this report it is RUNNING**: a supervised process with
**12:54:46 uptime and 3099 ticks**, every one `daemonOk=true cursor=679 prNodes=9 planKind=ok
errors=0`, against a live AO daemon (**12h59m, 40 sessions**) whose event rail is **fully
drained** (kernel cursor 679 = the daemon's max seq 679). The publisher is **ARMED** and has
**POSTed to real GitHub** (HTTP 201, verified via the API), the live end-to-end lifecycle has
been driven (an eligible PR → the real `fence2.py` ran → both contexts POSTed with the honest
`FENCE-FAILED: exit 1`), and the merge gate **FAILS CLOSED** (a real merge attempt → 405).
The CI is **6/6 green** and the branch is pushed. This session found and fixed **8 defects**
that the source-level verification could not see — including two CRITICALs: the publisher was
**never wired** into the entry point, and **every push had been rejected since 2026-09-20**.

---

## THE LIFECYCLE MAP (the running system, entry to terminal)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  THE RUNTIME LIFECYCLE — measured live at tick 3110                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AO daemon (:3001)                                                       │
│    pid 280557 · uptime 12h59m · 40 sessions          ← LIVE, HTTP 200    │
│         │                                                                │
│         │ GET /healthz                runtime.ts:52                      │
│         ▼                                                                │
│  jarvis-upper.service (active)                                           │
│    pid 348592 · uptime 12:54:46 · 3099 ticks                               │
│         │                                                                │
│         ├─► syncPrs        GET /api/v1/sessions    → 9 pr_node rows      │
│         │                                                                │
│         ├─► defaultRails   GET /api/v1/events?after=679                  │
│         │     EventRail.attach → setCursor(seq)                          │
│         │     cursor 679 = the daemon max 679   ← FULLY DRAINED          │
│         │                                                                │
│         ├─► guardrail(db, pr)   gates + sha + deps                       │
│         │     9/9 BLOCKED (all 'open') — correct                         │
│         │                                                                │
│         ├─► orderMerges(db)     kind=ok                                  │
│         │                                                                │
│         └─► publishVerdictForPr → verify() → fence2.py → POST            │
│               PROVEN LIVE: eligible PR → fence ran →                     │
│               factory/fence2=failure, factory/verdict=failure            │
│               (real HTTP 201 on github.com/leviathan-devops/jarvis-upper)│
│                                                                          │
│  GitHub ruleset 23838059 ──► the MERGE BUTTON                            │
│    a real merge attempt → 405 (2 of 8 checks not succeeded)              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## THE ARCHITECTURE — PER MODULE (with the runtime status)

### 1. `runtime.ts` — the loop that owns TIME

```
┌──────────────────────────────────────────────────────────────────┐
│ runtime.ts — boot · tick · stop                    RUNTIME: LIVE │
├──────────────────────────────────────────────────────────────────┤
│ createRuntime({root, db, deps:{tickMs, publishOpts}})            │
│   tick()      runtime.ts:203   probe→sync→rails→guard→publish    │
│   start()     runtime.ts:284   safeTick + setInterval(15s)       │
│   stop()      runtime.ts:291   awaits in-flight, NEVER a 2nd tick│
│   defaultRails runtime.ts:58   the SSE drain                     │
│     the read RACES the deadline   runtime.ts:86  ← EN-154 fix    │
├──────────────────────────────────────────────────────────────────┤
│ MEASURED: 3092 ticks · errors=0 · uptime 12h52m                  │
│ FAILURE MODES: a dead rail reports rail-failed EVERY tick        │
│   (RailCapture.failed); a publish failure lands in errors[]      │
└──────────────────────────────────────────────────────────────────┘
```

### 2. `guardrail.ts` — merge eligibility (the BLOCKING default)

```
┌──────────────────────────────────────────────────────────────────┐
│ guardrail(db, prId) → {ok, reasons[]}      RUNTIME: 9/9 BLOCKED  │
├──────────────────────────────────────────────────────────────────┤
│ 1. state === 'ready_to_merge'          NOT-READY                 │
│ 2. every REQUIRED_GATE verdict 'pass'  GATE-MISSING              │
│ 3. gate_pass.head_sha === pr.head_sha  STALE-GATE (both KNOWN)   │
│ 4. every dep merged/ordered            DEP-UNMERGED              │
├──────────────────────────────────────────────────────────────────┤
│ guardrailRemote()   the 8 contexts from GitHub  guardrail.ts:60  │
│ recordGatePass()    the LOCAL mirror            guardrail.ts:135 │
│ MEASURED LIVE: 9/9 blocked (all 'open'); all-green → ELIGIBLE    │
└──────────────────────────────────────────────────────────────────┘
```

### 3. `verdict.ts` + `publish.ts` — the two-source law + the publisher

```
┌──────────────────────────────────────────────────────────────────┐
│ verify() + publishStatus()              RUNTIME: POSTED (201)    │
├──────────────────────────────────────────────────────────────────┤
│ verify(): fence2 (runFence + ledger + bind) AND review           │
│   BOTH green on the SAME head sha      verdict.ts:200            │
│   a rejection on the head WINS over an approval                  │
│ publishStatus(): POST /statuses/{sha}  publish.ts:41             │
│   NO TOKEN → a NAMED error, never `Bearer `  publish.ts:46       │
├──────────────────────────────────────────────────────────────────┤
│ MEASURED LIVE: the real fence2.py RAN (exit 1) and both contexts │
│   were POSTed: factory/fence2=failure, factory/verdict=failure   │
│   (real HTTP 201, verified by an API read)                       │
└──────────────────────────────────────────────────────────────────┘
```

### 4. `.githooks/` — the 8 local gates (the DEPLOYED artifact)

```
┌──────────────────────────────────────────────────────────────────┐
│ pre-commit / pre-push / commit-msg / prepare-commit-msg          │
│ RUNTIME: FIRING on real commits + the real push                  │
├──────────────────────────────────────────────────────────────────┤
│ W-2  orphan (pre-push)      EN-148 fixed: git grep --include     │
│ W-3  phantom-diff           EN-149 fixed: the \b boundary       │
│ W-8  the subject prefix     the SUBJECT-line anchor              │
│ W-13 silent-fallback        0 hits on the tree                   │
│ W-14 no-stub                a DEAD GATE repaired                 │
├──────────────────────────────────────────────────────────────────┤
│ MEASURED: the push that had been REJECTED since 2026-09-20      │
│   SUCCEEDED (e9ff02b..d18a6fd) after the W-2 fix                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## THE RUNTIME TRACE (the 5-part simulator — a real tick, observed)

**1. TIMELINE HEADER** — tick 3110, T+0ms → T+~30ms, the AO daemon UP, 9 PRs synced.

**2. NUMBERED STEPS** (the calls the live process made):
```
  #  the call                                     site             observed
  1  probe() → GET /healthz                       runtime.ts:52    true
  2  syncPrs → GET /api/v1/sessions               runtime.ts:211   9 rows
  3  defaultRails → GET /api/v1/events?after=679  runtime.ts:78    cursor 679
       EventRail.attach → setCursor(seq)           rail.ts:94       drained
  4  guardrail(db, pr) for 9 PRs                  runtime.ts:231   9/9 blocked
  5  orderMerges(db)                              runtime.ts:271   kind=ok
  6  publishVerdictForPr (eligible only)          runtime.ts:253   (0 eligible)
  7  writeStatus + appendTick                     runtime.ts:303   the artifact
```

**3. ROUTING DECISION** (step 4, on the real rows):
```
  guardrail(db, 'pr:jarvis-upper-2:1')
    state === 'open'  →  NOT-READY:open      ⇒ blocked
  ... all 9 rows are state='open'
  ⇒ 9/9 BLOCKED — no publish, correctly

  THE POSITIVE (driven live): pr:rt-live-probe:99 @ ready_to_merge + 4 green gates
    state ✓ · gates ✓ · sha ✓ · deps ✓  ⇒ eligible=1  ⇒ PUBLISH
```

**4. DELIVERY PATH** (step 6, the live end-to-end):
```
  publishVerdictForPr({sha: be46bd66, headSha, jobDir})
    verify() → runFence(['fence2.py','adjudicate',jobDir,...])
      the REAL fence2.py EXECUTED → exit 1
      reason = 'FENCE-FAILED: exit 1'
    publishVerdict({fence2Ok:false, verdictOk:false})
      POST /repos/leviathan-devops/jarvis-upper/statuses/be46bd66
        factory/fence2  state:failure  desc:'FENCE-FAILED: exit 1'   HTTP 201
        factory/verdict state:failure  desc:'FENCE-FAILED: exit 1'   HTTP 201
    ⇒ verified by an independent API read (contexts: 2, both failure)
```

**5. OBSERVER / QUIET-CASE PROOF** (the negative half, on the real PR):
```
  PUT /repos/leviathan-devops/jarvis-upper/pulls/2/merge
    → 405 'Repository rule violations found
       2 of 8 required status checks have not succeeded: 1 errored and 1 failing.
       New changes require approval from someone other than the last pusher.'
    ⇒ THE GATE FAILS CLOSED — the merge is mechanically impossible
  (the 2 unsatisfied checks ARE the 2 factory/* contexts the live kernel posted)
```

---

## THE BUG LEDGER — the 8 runtime defects

| # | sev | the site | the root-cause mechanism | found by | the runtime proof |
|---|---|---|---|---|---|
| EN-147 | CRITICAL | `src/main.ts:17` | `createRuntime` called WITHOUT `publishOpts` — the daemon could never POST the `factory/*` contexts | the running process | journal `"publisher":"ARMED:leviathan-devops/jarvis-upper"` |
| EN-148 | CRITICAL | `.githooks/pre-push:151` | `git grep --include=` is an UNKNOWN OPTION (git 2.43) → `REFS=0` for every module → every push rejected | the real push | the push SUCCEEDED after the fix |
| EN-149 | HIGH | `scan-phantom.sh:34` | no word boundary: 'over**wrote**' matched `wrote` | the real push | ticks.log false positives 0 |
| EN-150 | HIGH | `gates.yml` | the provisioning step CREATED a ledger, turning fence-check's ABSENT-PASS (exit 0) into EMPTY-FAIL (exit 1) | measuring both paths | absent→exit 0, empty→exit 1 |
| EN-151 | HIGH | `docs_current.test.ts` | asserted `Checkpoints/` exists — absent in CI | the CI | `gates/test` green |
| EN-152 | HIGH | `gates.yml:93` | the diff-budget counted the 646-file snapshot diff | the CI | 9332 of 75249 counted |
| EN-153 | HIGH | `scripts/spec-diff.ts` | matched items against changed PATHS only | the CI | `mapped=20 unmapped=0` |
| EN-154 | HIGH | `src/runtime.ts:86` | `read()` BLOCKS on an idle SSE stream, so `Date.now() < deadline` never rescued it → a healthy stream reported `rail-failed` EVERY tick | the live daemon | errors `['rail-failed:TimeoutError']` → `[]` |

### DETAIL BOX — EN-147 (the built-but-not-wired CRITICAL)
```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT: src/main.ts:17 called createRuntime({root, deps:{tickMs}})      │
│       — publishOpts was NEVER passed.                                 │
│ WHY:  runtime.ts's publish loop is guarded by `if (publishOpts)`.     │
│       Undefined ⇒ the whole publisher (verify + publish, fully        │
│       built and tested) was UNREACHABLE from the entry point. The     │
│       daemon could NEVER post factory/fence2 or factory/verdict —     │
│       the merge button could never unlock.                            │
│ FIX:  main.ts wires publishOpts from env (UPPER_OWNER/UPPER_REPO/     │
│       GH_TOKEN/UPPER_WORKTREE_ROOT); the boot line names the state.   │
│ PROOF: the LIVE journal reads                                          │
│       "publisher":"ARMED:leviathan-devops/jarvis-upper"               │
│       and a live tick POSTed both contexts (HTTP 201, API-verified).  │
└──────────────────────────────────────────────────────────────────────┘
```

### DETAIL BOX — EN-148 (every push rejected since 2026-09-20)
```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT: .githooks/pre-push:151 ran                                        │
│         git grep -lFw --include='*.ts' -e "$BASENAME" "$sha" -- src/   │
│ WHY:  git grep has NO --include option. git 2.43 errors                │
│         'unknown option `include=*.ts'' → the command fails →          │
│         REFS=0 for EVERY module → 'REJECT(W-2): ORPHAN' on EVERY push. │
│       The branch had not been pushed since 2026-09-20; the whole       │
│       end-to-end lifecycle was never exercised.                        │
│ FIX:  a PATHSPEC replaces --include:                                   │
│         -- 'src/*.ts' 'scripts/*.sh' 'gates/*' 'bin/*'                 │
│ PROOF: `store` → 6 non-test callers (was 0); the push SUCCEEDED        │
│        (e9ff02b..d18a6fd) — the first push in 3 days.                  │
└──────────────────────────────────────────────────────────────────────┘
```

### DETAIL BOX — EN-154 (a healthy stream reported as failed)
```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT: defaultRails:86 — `while (Date.now() < deadline) { await         │
│       reader.read() }`.                                                │
│ WHY:  reader.read() BLOCKS on an idle SSE stream until the 5 s         │
│       AbortSignal fires. The 3 s deadline was checked BEFORE the       │
│       blocking read, so it never rescued it — the abort fired first    │
│       and the catch returned failed:'TimeoutError'. A HEALTHY idle     │
│       daemon therefore reported rail-failed on EVERY tick.             │
│ FIX:  the read RACES the remaining deadline (Promise.race); an idle    │
│       stream yields a clean empty capture, a transport error still     │
│       travels named.                                                   │
│ PROOF: on the LIVE daemon the tick errors went                        │
│        ['rail-failed:TimeoutError...'] → [] with cursor advancing.     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## THE TESTING LEDGER — RUNTIME ONLY

| tier | WHAT RAN | THE SUBJECT | THE MEASURED OUTPUT |
|---|---|---|---|
| R1 | the kernel process (pid 348592) | the RUNNING daemon | **uptime 12:54:46 · 3099 ticks · errors=0** |
| R2 | the AO daemon (pid 280557) | the LIVE dependency | **uptime 12h59m · :3001 → HTTP 200 · 40 sessions** |
| R3 | the rail drain | the LIVE event stream | **cursor 679 = the daemon max 679** (fully drained) |
| R4 | the wire capture | the adapter's bytes | `{parsedFrames:5, newlyProcessed:5, bytes:2028, lastSeq:679}` |
| R5 | the LIVE publish | REAL GitHub | **HTTP 201** — `factory/fence2` + `factory/verdict` (API-verified) |
| R6 | the LIVE end-to-end | the real fence2.py | an eligible PR → **fence2.py ran, exit 1** → both contexts POSTed |
| R6b | the LIVE end-to-end, REPRODUCED | the CURRENT head | the same POSTs on the head sha — **API-verified twice** |
| R7 | the merge attempt | the REAL ruleset | **405** — '2 of 8 required status checks have not succeeded' |
| R8 | the CI | GitHub Actions | **6/6 success** on `be46bd66` |
| R9 | the push | the DEPLOYED hooks | the branch pushed (`e9ff02b..d18a6fd`) after the W-2 fix |
| R10 | the P5 corpus | the DEPLOYED hooks (real staged content) | 13 pass / 0 fail |
| — | ~~tsc / bun test / source-import probes~~ | ~~the SOURCE~~ | **SLOP — excluded by the operator's ruling** |

### THE RUNTIME PROOF (pasted output)
```
  # the kernel, observed ticking
  $ tail -3 runtime/ticks.log
  2026-09-24T03:37:06.312Z tick=3090 daemonOk=true cursor=679 prNodes=9 planKind=ok errors=0
  2026-09-24T03:37:21.315Z tick=3091 daemonOk=true cursor=679 prNodes=9 planKind=ok errors=0
  2026-09-24T03:37:52.399Z tick=3092 daemonOk=true cursor=679 prNodes=9 planKind=ok errors=0

  # the live end-to-end (an eligible PR → the real fence → the real POST)
  $ python3 -c "...insert pr:rt-live-probe:99 @ ready_to_merge..."
  $ sleep 25 && python3 -c "json.load(open('runtime/status.json'))"
    tick 3090 ready=1 eligible=1 errors=[]
  $ curl .../commits/be46bd66/status
    contexts on the sha: 2 | state: failure
      factory/verdict        failure  FENCE-FAILED: exit 1
      factory/fence2         failure  FENCE-FAILED: exit 1

  # the merge gate, failing closed
  $ curl -X PUT .../pulls/2/merge
    -> Repository rule violations found | status 405
       2 of 8 required status checks have not succeeded: 1 errored and 1 failing.
```

---

## THE SPEC MANDATE → ENGINEERING MAP

| the goal said | what was built | the runtime evidence |
|---|---|---|
| debug everything in the actual system runtime | 8 defects found by real execution | the ledger above |
| properly test everything | the RUNTIME ledger (R1-R10) | the live process, the API, the CI |
| fix every single bug verifiably | 8 fixed, each with a runtime proof | the detail boxes |
| the publisher must POST the factory contexts | wired + ARMED + POSTing | HTTP 201, API-verified |
| the merge gate must block | proven FAILS CLOSED | the 405 with its verbatim text |

---

## THE NUMBERS (every one measured this turn)

```
┌────────────────────────────────┬─────────────────────────────────────┐
│ METRIC                         │ MEASURED VALUE                      │
├────────────────────────────────┼─────────────────────────────────────┤
│ the kernel uptime              │ 12:54:46                            │
│ the kernel ticks               │ 3099 (the live tick counter)        │
│ the kernel errors (last tick)  │ 0                                   │
│ the AO daemon uptime           │ 12h59m (pid 280557)                 │
│ the AO daemon port             │ :3001 → HTTP 200                    │
│ the AO sessions                │ 40                                  │
│ the rail cursor / the max      │ 679 / 679 (drained)                 │
│ pr_node rows                   │ 9                                   │
│ the live publish status        │ HTTP 201 (both contexts)            │
│ the merge attempt              │ 405 (blocked)                       │
│ the CI                         │ 6/6 success                         │
│ the branch                     │ be46bd6 = the remote                │
│ the campaign commits           │ 74 (30bf9f8..be46bd6)               │
│ the frozen status contexts     │ 8 (unchanged)                       │
│ the ruleset                    │ 23838059 (active)                   │
└────────────────────────────────┴─────────────────────────────────────┘
```

---

## THE FILE MANIFEST (the runtime-relevant tree)

```
jarvis-upper/
  src/main.ts        the entry point — WIRED publishOpts   MODIFIED (EN-147)
  src/runtime.ts     the tick loop + the rail drain        MODIFIED (EN-154)
  src/guardrail.ts   the blocking gate + the mirror        MODIFIED
  src/verdict.ts     the two-source law                    MODIFIED
  src/publish.ts     the status POSTer                     MODIFIED
  src/store.ts       the railway + the FK migration        MODIFIED
  src/{sync,plan,execute,desks,dossier,kick,attribute,     MODIFIED
       reducers,status,cli,cli-verbs,adapter-verbs,         
       graph,status-contract}.ts                            
  .githooks/pre-push         W-2 fixed (EN-148)            MODIFIED
  .githooks/lib/scan-phantom.sh   W-3 fixed (EN-149)       MODIFIED
  .githooks/lib/scan-stub.sh      a DEAD GATE repaired     MODIFIED
  .github/workflows/gates.yml     EN-150/EN-152 fixed      MODIFIED
  scripts/spec-diff.ts            EN-153 fixed             MODIFIED
  tests/redteam_kernel.test.ts    the decision corpus      NEW (SLOP per the ruling)
  tests/publisher_wired.test.ts   the wiring pin           NEW (SLOP per the ruling)
  runtime/status.json|ticks.log   THE RUNTIME ARTIFACTS    GITIGNORED (live)
  ~/.config/jarvis-upper.env      the token (0600)         OUT-OF-BAND
  ~/.config/systemd/user/jarvis-upper.service              the supervised unit
  ~/.config/systemd/user/ao-daemon.service                the AO boot owner
```

---

## WHAT'S NEEDED FROM THE OPERATOR

1. **A merge approval** — the ruleset requires 1 approval from someone other than the
   last pusher. The 2 `factory/*` contexts are the ONLY blockers left (they post
   `failure` until the fence can run against a real worktree bound to the head).
2. **A real AO session bound to a worktree at a claimed head** — that is what makes the
   fence GREEN. The 9 PRs are all `open`; none is `ready_to_merge`.
3. **The ocr lanes remain quota-capped** — the independent-review finding from the prior
   campaign stands; a rung-1/2 re-run needs the quota.

## THE HONEST REMAINDER

1. The 9 real PRs are all `open` — the kernel correctly blocks them; the LIVE publish
   path was proven on a synthetic eligible row (removed after the test).
2. The fence returns `exit 1` because no worktree is bound to the head — the POSTED
   `failure` is the HONEST polarity, not a green.
3. The AO daemon was hub-supervised + a systemd unit is enabled for boot; the unit is
   inactive NOW because the hub instance holds :3001 (a second would conflict).
4. Source-level tests exist but are **SLOP** per the operator's ruling — not cited.

## THE LESSON

The SOURCE was green (tsc 0, 124 tests passing) while the SYSTEM was dead: the publisher
unwired, every push rejected for 3 days, the CI red, and a healthy event stream reported as
failed. **The runtime is the only tier that finds this class.** Eight defects, every one
found by EXECUTING the system — a real push, the real GitHub API, the live daemon, a real
merge attempt.
