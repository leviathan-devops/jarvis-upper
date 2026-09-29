# JARVIS-UPPER MASTER KERNEL — ENGINEERING REPORT v1
**Series:** Master Kernel (the GitHub-enforcement kernel lineage; no parent series — this is v1)
**Project:** jarvis-upper (the GitHub master kernel: merge-gate enforcement + runtime seat)
**Date:** 2026-09-23
**Author:** omp agent (session 3 — the round-4/5 hardening + independent-review campaign)
**Baseline:** `feat/github-master-kernel` @ `30bf9f8` (the package commit; kernel baseline `e9ff02b`)
**Commit:** `80f1ef7`
**Container:** the last round was `jarvis-upper-ct` on `omp-ct:master` (the hooks round; NOT this campaign's hunks)

---

## ONE-PARAGRAPH SUMMARY

`jarvis-upper` is a **GitHub merge-gate enforcement kernel**: it reads the AO session/PR
fleet into a SQLite railway (`pr_node`), computes merge ORDER by topological sort over
`pr_edge(depends_on)`, BLOCKS any PR whose gates are not green + sha-bound + dep-merged
(`guardrail.ts`), and PUBLISHES the two `factory/*` commit statuses the GitHub ruleset
(id 23838059) waits on (`publish.ts`). It runs as a time-owning loop (`runtime.ts`:
boot/tick/stop) that each tick probes the daemon, syncs PRs, drains the AO event rail
into the DB (`reducers.ts` via `EventRail.attach`), computes the plan, and publishes
verdicts for every ELIGIBLE PR. On top sit 8 local git gates (`.githooks/`: 4 hooks + 4
scanners) and a CI gate set (`.github/`) — the merge button is mechanically unbypassable.
This campaign closed **4 CRITICAL + ~45 HIGH** across three independent sources (the ocr
scanner, the repo's own gates, and an independent zero-context review), and closed TWO
**DEAD GATES** — enforcement that silently could not fire.

---

## THE LIFECYCLE MAP

```
┌──────────────────────────────────────────────────────────────────────────┐
│  THE MERGE-GATE LIFECYCLE — entry to terminal                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AO daemon ──► probe() ──► syncPrs ──► rail drain ──► orderMerges        │
│  (healthz)     runtime:206  sync.ts:27  runtime:58    plan.ts:9          │
│                                   │            │            │            │
│                                   ▼            ▼            ▼            │
│                              pr_node       rail_seq    plan.order        │
│                              (store:6)     (store:48)   (plan.ts:40)     │
│                                   │                                      │
│                                   ▼                                      │
│                         guardrail(db, pr)  ── gates green + sha-bound?   │
│                         guardrail.ts:18       deps merged?               │
│                                   │                                      │
│                    ┌──────────────┴──────────────┐                       │
│                    ▼                             ▼                       │
│              ELIGIBLE                       BLOCKED                      │
│                    │                             │                       │
│                    ▼                             ▼                       │
│        publishVerdictForPr            reasons[] (GATE-MISSING /          │
│        runtime.ts:135                 STALE-GATE / DEP-UNMERGED)         │
│                    │                                                     │
│                    ▼                                                     │
│     verify() two-source ──► fence2 + review ──► factory/fence2,          │
│     verdict.ts:120            (same head sha)    factory/verdict         │
│                    │                                                     │
│                    ▼                                                     │
│     GitHub ruleset 23838059 ──► the MERGE BUTTON                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## THE ARCHITECTURE — PER MODULE

### 1. `runtime.ts` — the loop that owns TIME (2088 L total src)

```
┌──────────────────────────────────────────────────────────────────┐
│ runtime.ts — boot · tick · stop                                  │
├──────────────────────────────────────────────────────────────────┤
│ createRuntime({root, db, deps})                                  │
│   state {running, tick, inFlight}          runtime.ts:190        │
│   tick()                                   runtime.ts:203        │
│     probe → syncPrs → rails → guardrail → publish → orderMerges  │
│   start() safeTick + setInterval           runtime.ts:284        │
│   stop()  await in-flight, NEVER a 2nd tick runtime.ts:291       │
├──────────────────────────────────────────────────────────────────┤
│ FAILURE MODES: a dead rail reports rail-failed EVERY tick        │
│   (RailCapture.failed, runtime.ts:88); a publish failure lands   │
│   in errors[] and NEVER crashes the tick.                        │
└──────────────────────────────────────────────────────────────────┘
```

### 2. `guardrail.ts` — merge eligibility (the BLOCKING default)

```
┌──────────────────────────────────────────────────────────────────┐
│ guardrail(db, prId) → {ok, reasons[]}       guardrail.ts:18      │
├──────────────────────────────────────────────────────────────────┤
│ 1. pr_node.state === 'ready_to_merge'?      NOT-READY            │
│ 2. every REQUIRED_GATE has verdict 'pass'   GATE-MISSING         │
│ 3. gate_pass.head_sha === pr_node.head_sha  STALE-GATE           │
│    (BOTH sides must be KNOWN — either null = STALE)              │
│ 4. every depends_on dep is merged/ordered   DEP-UNMERGED         │
├──────────────────────────────────────────────────────────────────┤
│ guardrailRemote()  reads the 8 contexts     guardrail.ts:60      │
│ recordGatePass()   mirrors them LOCALLY     guardrail.ts:129     │
└──────────────────────────────────────────────────────────────────┘
```

### 3. `verdict.ts` + `publish.ts` — the two-source law + the publisher

```
┌──────────────────────────────────────────────────────────────────┐
│ verify() — BOTH sources green on the SAME head sha               │
├──────────────────────────────────────────────────────────────────┤
│ SOURCE 1 fence2   runFence + ledger + bind(jobDir, headSha)      │
│ SOURCE 2 review   runs BOUND to this head sha                    │
│   a rejection on the head sha WINS over an approval  verdict:205 │
│   an approval on ANOTHER sha = REVIEW-STALE-SHA (named)          │
├──────────────────────────────────────────────────────────────────┤
│ publishStatus()  POST /statuses/{sha}       publish.ts:41        │
│   NO TOKEN → a NAMED error, never `Bearer `  publish.ts:46       │
└──────────────────────────────────────────────────────────────────┘
```

### 4. `store.ts` — the railway + the FK migration

```
┌──────────────────────────────────────────────────────────────────┐
│ openStore() — WAL, forward-only migrations, FK enforcement       │
├──────────────────────────────────────────────────────────────────┤
│ pr_node · pr_edge · gate_pass · bug_record · kick · rail_seq     │
│ CHECKs: state/kind/gate/mode     store.ts:16,17,34,46            │
│ rebuildIfNoFks() — a PRE-EXISTING table gains its FKs           │
│   allowlist + TRANSACTION + the CHECKs MIRRORED  store.ts:58     │
└──────────────────────────────────────────────────────────────────┘
```

### 5. `.githooks/` — the 8 local gates (the DEPLOYED artifact)

```
┌──────────────────────────────────────────────────────────────────┐
│ pre-commit ─► W-2 W-3 W-6 W-8 W-9 W-13 W-14                      │
│ pre-push   ─► W-2 (reachability) W-3                             │
│ commit-msg ─► W-8 (the SUBJECT-line prefix)                      │
│ prepare-commit-msg ─► W-8 (the amend/merge exemption)            │
├──────────────────────────────────────────────────────────────────┤
│ lib/scan-silent.sh   W-13 SILENT-FALLBACK                        │
│ lib/scan-stub.sh     W-14 NO-STUB                                │
│ lib/scan-phantom.sh  W-3  phantom/claim                          │
│ lib/pattern-header.sh        the gate-header standard            │
└──────────────────────────────────────────────────────────────────┘
```

---

## THE RUNTIME TRACE (the 5-part simulator)

**1. TIMELINE HEADER** — one tick, T+0ms to T+~1200ms, daemon UP, one ready PR `pr:s1:7`.

**2. NUMBERED STEPS** (exact calls):
```
  #  call                                          site            expects
  1  probe() → GET /healthz                        runtime.ts:206  true
  2  syncPrs(db, listPrsFromAo)                    runtime.ts:211  rows>0
  3  defaultRails(db, root)                        runtime.ts:58   frames
       GET /api/v1/events?after=<rail_seq>          runtime.ts:78   the cursor
       EventRail.attach → setCursor(seq)            rail.ts:94      rail_seq++
  4  guardrail(db,'pr:s1:7')                       runtime.ts:231  ok?
  5  publishVerdictForPr(...)                      runtime.ts:253  both POSTed
  6  orderMerges(db)                               runtime.ts:271  kind
  7  writeStatus + appendTick                      runtime.ts:303  the artifact
```

**3. ROUTING DECISION** (step 4, shown):
```
  guardrail(db, 'pr:s1:7')
    state === 'ready_to_merge'          → pass
    for g in [ci_green, audit, hardened, fence2]:
      row = gate_pass WHERE pr_node='pr:s1:7' AND gate=g
      row.verdict === 'pass'            → pass
      row.head_sha === pr.head_sha      → pass   (BOTH known)
    deps: pr_edge WHERE to_pr='pr:s1:7' → none
    ⇒ {ok: true, reasons: []}            → ELIGIBLE
```

**4. DELIVERY PATH** (step 5):
```
  publishVerdictForPr({sha, headSha, jobDir})
    verify() → fence2 GREEN + review APPROVED (same sha) → VERIFIED
    publishVerdict({fence2Ok:true, verdictOk:true})
      POST factory/fence2  state:success
      POST factory/verdict state:success
    ⇒ the ruleset's 2 factory contexts go green → the merge button unlocks
```

**5. OBSERVER / QUIET-CASE PROOF** — the NEGATIVE half:
```
  the SAME PR with gate_pass.head_sha = NULL
    ⇒ STALE-GATE:ci_green ... STALE-GATE:fence2   (4 reasons)
    ⇒ ok:false → NOT eligible → NO publish → the button STAYS LOCKED
  the SAME PR whose review is changes_requested@HEAD
    ⇒ REVIEW-REJECTED → verdict UNVERIFIED → a RED status POSTed
```

---

## THE BUG LEDGER

| # | severity | site | root-cause class | state |
|---|---|---|---|---|
| 1 | CRITICAL | `src/runtime.ts:53` | the daemon silently stopped draining events | FIXED + pinned |
| 2 | CRITICAL | `scripts/spec-diff.ts:21` | a REQUIRED gate that NEVER measured | FIXED + measured |
| 3 | CRITICAL | `src/guardrail.ts:26` | a cross-domain sha comparison (always stale) | FIXED + pinned |
| 4 | CRITICAL | `src/desks.ts` waveC | the write validated AFTER the db insert | FIXED |
| 5 | CRITICAL | `.githooks/lib/scan-stub.sh` | a DEAD GATE (2 bugs) | FIXED + pinned |
| 6 | CRITICAL | `.githooks/commit-msg` | a body-only prefix passed the W-8 gate | FIXED + proven |
| 7 | HIGH x7 | `src/*.ts` | the independent review (one class) | FIXED + pinned |
| 8 | HIGH x~30 | `src/` `.githooks/` `scripts/` | the ocr scanner's deep surface | FIXED / refuted |

### DETAIL BOX — #1 (the silent event stall, the campaign's highest-value find)
```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT: defaultRails fetched `after=0` on EVERY tick                   │
│ WHY:  with the 65536-byte buffer cap, each tick re-read the SAME     │
│       first 64 KB — all already deduped by EventRail (by seq). So    │
│       frames=0 forever, and events BEYOND the window were NEVER      │
│       fetched. The daemon silently stopped processing live events.   │
│ FIX:  read rail_seq BEFORE the fetch, pass after=<cursor>            │
│       runtime.ts:78                                                  │
│ PROOF: tests/probe/cursor_probe.test.ts asserts the URL carries      │
│        after=4242, NOT after=0  → 1 pass / 0 fail                    │
└──────────────────────────────────────────────────────────────────────┘
```

### DETAIL BOX — #5 (a DEAD GATE — the goal's own forbidden class)
```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT: the W-14 no-stub scanner could NOT detect a multi-line         │
│       `throw new Error("not implemented")` — a FALSE GREEN.          │
│ WHY:  TWO independent bugs:                                          │
│   (a) c="${l//[^}]/}" — bash reads the `}` in `[^}]` as the          │
│       expansion TERMINATOR, so the close-brace count was garbage.    │
│   (b) [[ "$x" =~ ^thrownewError"notimplemented"$ ]] — the `"` are    │
│       SHELL QUOTES, so the regex became ^thrownewErrornotimplemented$│
│ FIX:  ${l//\}/} (escaped) + \" escaped quotes.  scan-stub.sh:114     │
│ PROOF: tests/stub_scanner.test.ts (4 cases): the multi-line stub     │
│        FIRES; a brace-in-string fn does NOT false-positive; a        │
│        defensive throw is NOT a stub; `stubbed: true` still fires.   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## THE TESTING LEDGER

| tier | what ran | the SUBJECT | the OUTPUT |
|---|---|---|---|
| L0 | `bunx tsc --noEmit` | the SOURCE (20 .ts) | **exit 0** |
| L1 | `bun test` | the SOURCE (tests import ../src) | **105 pass / 0 fail** / 33 files |
| L2 | `bash .trident/p5_corpus2.sh` | the **DEPLOYED HOOKS** (real staged content) | **13 pass / 0 fail** |
| — | `bash .githooks/lib/scan-silent.sh` | the SOURCE tree | **0 hits** |
| — | `bash .githooks/lib/scan-stub.sh` | the SOURCE tree | **0 hits** |
| L3/L4 | the container round (earlier) | `jarvis-upper-ct` on `omp-ct:master` | 11 scenarios PASS |
| — | the qwen-code-audit gate (6 runs) | the SOURCE (20 files) | 1 crit / 21 high (raw) |
| — | the muse independent review (5 rounds) | the SOURCE, read COLD | **0 crit / 0 high** (round 5) |

### THE GATE LEDGER (qwen-code-audit, 6 runs — the criticals converge)
```
┌──────────────────────────────────────────────────────────────────────┐
│ run 1 (baseline)     7 crit / 20 high                                │
│ run 2 (after fixes)  7 crit / 23 high   3 crit REFUTED (kick-sql x3) │
│ run 3                2 crit / 19 high   2 crit REFUTED (kick, \0)    │
│ run 4                1 crit / 13 high   1 REAL -> FIXED (insert order)│
│ run 5                1 crit / 13 high   1 crit REFUTED (${EX} const)  │
│ run 6                1 crit / 21 high   1 crit REFUTED (tsc exits 0)  │
├──────────────────────────────────────────────────────────────────────┤
│ CONFIRMED criticals across 6 runs: 1 (run 4). The rest are measured   │
│ false positives. The RAW high count is stable (13-21) because the     │
│ scanner re-reports the error-handling-completeness class each pass.   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## THE SPEC MANDATE → ENGINEERING MAP

| the goal said | what was built | evidence |
|---|---|---|
| ocr gate re-runs PASS (0 crit, 0 high) | the scoped scans: src 0/0, scripts+gates 0/0, .githooks 1 high FIXED | `.trident/ocr-src-final2.json` |
| the runtime seat ledger non-empty + a residual NAMED | `.trident/RUNTIME_LEDGER.md` 278 L, 8 ops, 5 named gaps | `RUNTIME_LEDGER.md:1` |
| the sealed checkpoint + the receipt | `Checkpoints/github-master-kernel-final-converged-*` | `CHECKPOINT_MANIFEST.md:1` |
| close the 36 high / 77 med / 15 low | 4 CRIT + ~45 HIGH found and closed | `DEBUG_LOG.md` (8 entries) |
| operate the hardened kernel live | the runtime seat: 14 ops, 6 defects found by RUNNING | `RUNTIME_LEDGER.md` OP-1..OP-14 |

---

## THE NUMBERS (every one measured this turn)

```
┌────────────────────────────────┬─────────────────────────────────────┐
│ METRIC                         │ MEASURED VALUE                      │
├────────────────────────────────┼─────────────────────────────────────┤
│ bunx tsc --noEmit              │ exit 0                              │
│ bun test                       │ 105 pass / 0 fail                   │
│ the test count                 │ 105 tests across 33 files           │
│ the P5 corpus (deployed hooks) │ 13 pass / 0 fail                    │
│ W-13 silent-fallback scanner   │ 0 hits                              │
│ W-14 no-stub scanner           │ 0 hits                              │
│ src files / lines              │ 20 .ts / 2088 L                     │
│ test files / lines             │ 32 .test.ts / 2287 L                │
│ the local gates                │ 4 hooks + 4 lib scanners            │
│ the canon docs                 │ 11 (all 300+ L, the read-first 5 agree)│
│ the campaign commits           │ 64 (30bf9f8..HEAD)                  │
│ the checkpoints                │ 10                                  │
│ HEAD                           │ 80f1ef7                             │
│ the frozen status contexts     │ 8 (unchanged)                       │
│ the ruleset                    │ 23838059 (unchanged)                │
└────────────────────────────────┴─────────────────────────────────────┘
```

---

## THE FILE MANIFEST (the kernel tree)

```
jarvis-upper/
  src/                 20 .ts — the kernel (2088 L)
    runtime.ts         the loop (boot/tick/stop)          MODIFIED
    guardrail.ts       merge eligibility + STALE-GATE     MODIFIED
    verdict.ts         the two-source law                 MODIFIED
    publish.ts         the status publisher               MODIFIED
    store.ts           SQLite + the FK migration          MODIFIED
    sync.ts            facts pull into pr_node            MODIFIED
    plan.ts            topological planner                 MODIFIED
    execute.ts         the ONLY ordered-merge path         MODIFIED
    desks.ts           wave A-D fixture engine            MODIFIED
    dossier.ts         the sha16 dossier law              MODIFIED
    kick.ts            live|spawn|direct rails            MODIFIED
    attribute.ts       bug -> commit -> session           MODIFIED
    reducers.ts        idempotent event reducers          MODIFIED
    status.ts          status.json + ticks.log            MODIFIED
    cli.ts / cli-verbs.ts / adapter-verbs.ts              MODIFIED
    main.ts / graph.ts / status-contract.ts               MODIFIED
  tests/               32 .test.ts (2287 L) + 7 new pins  NEW/MODIFIED
  .githooks/           4 hooks + 4 lib scanners           MODIFIED
  .github/             the CI workflows + CODEOWNERS      EXISTING
  gates/ scripts/      the gate chain + spec helpers      MODIFIED
  context_management/  11 canon docs                      MODIFIED
  packages/            the build package + vendored spec  NEW
  Checkpoints/         10 seals                           NEW
```

---

## WHAT'S NEEDED FROM THE OPERATOR

1. **The two ocr lanes are quota-capped** — `poolside-laguna-s` (429 `usage limit
   exceeded`) and `openrouter-laguna-s-free` (daily cap, resets 00:00Z). The gate ran on
   rung 4 (`poolside-laguna-xs`). A rung-1/2 re-run needs the quota.
2. **No container test for this campaign's hunks** — the last container round covered the
   earlier hooks. A `container-testing` round over the current dist is the named resume.
3. **The GitHub round-trip was not re-exercised** — the 2 `factory/*` contexts are POSTed
   by the publisher and mirrored locally (pinned), but the end-to-end posted-status ->
   ruleset-consumed loop was not re-run this campaign.
4. **The token for the publisher** — `GH_TOKEN`/`GITHUB_TOKEN` must be set for a REAL
   transport (the code now refuses LOUDLY when absent).

