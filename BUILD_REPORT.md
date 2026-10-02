# BUILD_REPORT — jarvis-upper (append-only; created 2026-09-20)

## 2026-09-20 — jarvis-upper v0.1: the control-layer LIBRARY (not a system)

**The built:** 11 TypeScript modules (993 lines: store, cli, sync, reducers,
plan, guardrail, graph, attribute, kick, dossier, desks, execute, ao-client
{gen, client, rail}), 11 test files (613 lines, 32 tests), 4 desk contracts,
a pinned OpenAPI copy (144 paths/164 ops/269 schemas, sha 9ccd0e5d08702b9f),
and a SQLite store with 6 tables.

**The why:** operator mission (packages/jarvis-upper-tier/00-MISSION.md):
wire AO into the upper Jarvis levels without a terminal attach; build the
lifecycle controls as graph + comms + filepaths + guardrails; map bugs to
origin commits and kick them down to the factory.

**The how:** pure callables with injected dependencies (deterministic, no LLM
imports, REST-first), verified by fixture tests; the fence2 adjudicator run as
a real subprocess for the assembly gate; all external effects stubbed at the
boundary (MergeAdapter, KickDeps, EventRail chunk sources).

**The evidence:** `bun test` → 32 pass / 0 fail / 106 expects (EXIT=0);
`bunx tsc --noEmit` → EXIT=0; fence2 ledger PASS row
`8358f448f74a9171|sandbox=bwrap|spec_bound:true`; openapi sha
9ccd0e5d08702b9f against pin.json (144/164/269).

**The verification:** the battery + tsc + ledger pasted in TESTING_LOG (this
session); the adversarial probes A1-A4 pasted in TESTING_LOG (this session).

**The honest notes (the part v1 and v2 of the engineering report got wrong):**
- This is a LIBRARY, not a running system. No entry point (`src/main.ts`,
  `src/runtime.ts` absent), no loop (0 `setInterval`/`while(true)`), 2 of 9
  spec CLI verbs, `client.ts` orphaned (0 callers) and BROKEN on first call
  (EN-001), the rail never fed live bytes (EN-002), the pre-written DT1-DT3
  implemented in reduced shapes (EN-004, V-03, V-04).
- Spec §6 items 15 and 20 are VIOLATED (V-01, V-02). Items 3 and 11 exist as
  orphan functions (V-05).
- The AO daemon was DOWN and unnoticed during this audit — nothing watches it.
- The runtime that would make this a system is designed in
  `reports/JarvisUpperTier_Runtime_Blueprint.md` and is NOT built.

**What the next pass must do (the work order):** build the runtime (blueprint
§10), wire `client.ts` (and fix EN-001), implement the CLI verb surface, run
the live rail parse with the daemon up, then re-run the pre-written DT1-DT3 in
their SPEC shapes — and only then re-open the goal.

## 2026-09-20 — ADDENDUM: the per-module inventory + the plan-vs-actual table

**Per-module inventory (measured `wc -l`, this session):**

| module | lines | role | callers (non-test) |
|---|---|---|---|
| `src/store.ts` | 48 | SQLite WAL + 6 migrations | 11 files import it (tests + cli) |
| `src/cli.ts` | 27 | `init` \| `cursor`; `order` refuses exit 2 | 0 (entry point) |
| `src/sync.ts` | 34 | PR upsert + row count | 0 |
| `src/reducers.ts` | 34 | idempotent event→row | 0 |
| `src/plan.ts` | 40 | topo orderMerges + CYCLE | 0 |
| `src/guardrail.ts` | 36 | sha-bound eligibility | 0 |
| `src/graph.ts` | 32 | deterministic render + overlay | 0 |
| `src/attribute.ts` | 132 | blame/log → commit+session, 0.6 floor | 0 |
| `src/kick.ts` | 70 | live/spawn/direct under dossier hash | 0 |
| `src/dossier.ts` | 28 | sha16 dossier + manifest | 0 |
| `src/desks.ts` | 73 | wave A-D fixture engine | 0 |
| `src/execute.ts` | 46 | confirm-only merge | 0 |
| `ao-client/gen.ts` | 39 | openapi → routes generator | 0 |
| `ao-client/client.ts` | 68 | typed REST wrapper | **0 — ORPHAN + BROKEN (EN-001)** |
| `ao-client/rail.ts` | 113 | SSE parse + cursor + dedupe | 0 (tests only) |
| total | 993 | — | — |

**Plan vs actual (spec §6 → reality), the honest ledger:**

| §6 item | planned | actual | evidence |
|---|---|---|---|
| 1 bindings + EventRail | built | bindings yes; rail tests-only | `grep -rln "new EventRail"` |
| 3 syncProject ingester | built | function only, 0 callers | caller scan |
| 4 orderMerges + CYCLE | built | function only | caller scan |
| 6/7/8 attribution + dossier + kick_live | built | functions only; kick deps injected | tests/kick_fallback |
| 11 wave desks | built | 4 `.md` + fixture engine; no runner | `ls desks/` |
| 15 CLI verbs | built | **2 of 9; 6 print usage exit 2** | probe A3 (`Ran` n/a; exit 2) |
| 20 integration smoke | built | **absent** | `grep -l localhost:3001 tests/` → 0 |

**The wave receipts as recorded (RUNNING_BUILD_LOG, packages/jarvis-upper-tier):**
W0 `bindings_parity 2 pass/0 fail` · W1 `replay_converges 4/0` · W2
`planner_cycle 3/0, guardrail 5/0, graph 3/0` · W3 `attribute 3/0, kick 3/0,
dossier 1/0` · W4 `ship_manifest 4/0` + fence2 `exit=0` · W5 battery
`32/0/106` + `tsc exit=0`. **All function-level; none runtime-level.**

## 2026-09-20 — THE RUNTIME WALL: the library became a system

**The built:** the refusal gates (`gates/does_anything_run.sh`, `orphan_scan.sh`, `shape_freeze.sh` + the self-consistency test) · the runtime (`src/runtime.ts` boot·tick·stop, `src/main.ts` entry, `src/status.ts`) · the wire capture · the adapter's real callers + the EN-001 fix · the verb surface (`src/cli-verbs.ts`, `src/adapter-verbs.ts`, 9 verbs) · the spec-audit (`scripts/spec-audit.ts`, GS-1..GS-8) · the operational transcript.

**The why:** the goal — "finish ALL remaining work … STOP only when the five-question gate answers YES five times ON THIS TREE and `upper status` prints RUNNING".

**The how:** adversarial-first (the gate was exercised on a library-only tree BEFORE any success path); the loop's side effects injectable for deterministic tests and real for live runs; every claim bound to a tool result; the audit machine built as the mirror of the code-audit the operator marked mandatory.

**The evidence:** `bunx tsc --noEmit` exit 0 · `bun test` 44 pass / 0 fail / 162 expects / 15 files · the five questions `Q1..Q5:YES` → `VERDICT:RUNS (fail=0)` · `ORPHANS=0` · `wire_capture.json` parsedFrames=168 · `upper status` = RUNNING (tick 7, ageMs 2071) · the spec-audit `REJECTED (fail=6)` on the legacy spec · the live outage flip with the cursor held at 225.

**The verification:** `OPERATIONAL_VERIFICATION.md` — every command re-run from a clean shell with its verbatim output (§1-§11), including the supervised-runtime seal (§10) and the declaration with its residual (§11).

**Honest anchors:** .githooks/pre-push:151 (the W-2 fix) · packages/github-master-kernel/GOAL_PIN_RUNTIME_OPERATIONAL.md:1 · FAILURE_LOG.md:266
**The honest notes:** the railway carries no live PR yet (`prNodes=0`); `kick` is unwired; the desk runner is not connected to the macro level; the legacy spec is REJECTED by its own audit (the new pin is audit-shaped but unaudited); ripwire's crawl root excludes this tree (EN-007) so structural edits here are exempt-by-record, not verified-by-graph.

## 2026-09-21 — W3 runtime wall + EN-010 closed + the gate made HONEST
- **EN-010 CLOSED (live):** `upper sync` was a literal stub (`const rows: PrRow[] = []`) and the
  runtime defaulted `listPrs` to `async () => []`. Both are now the REAL AO pull
  (`adapter-verbs.listPrsFromAo` → `listSessions` → `listSessionPRs` per session).
  Live: `sync` → `{"ok":true,"prNodes":5,"openPrNodes":5}`; the railway holds 5 real PR nodes
  (jarvis-upper#1 fe79f99d + jfm-e2e #1/#2/#4/#5); the loop ticks `prNodes=5, errors=[]`.
  Battery 52 → 56 (3 new tests: mapping/filter/no-PR-session/null-headSha/LOUD-failure/upsert).
- **The shape gate made honest:** it compared DECLARED spec shapes (`DT1 DT2 DT3`) against test
  FILE BASENAMES, so it could not see shapes implemented INSIDE a job's test (the worker
  worktree's `tests/dt_shapes.test.ts`). Fixed: IMPL = factory test files + `jobs/*/*.test.ts`
  + auto-discovered `~/.ao/data/worktrees/*/*/tests`, with `DT-1|DT_1|DT1` normalized.
  It now returns exit 1 in the factory alone (honest: the DT shapes are the JOB's deliverable)
  and exit 0 with the claimed job's worktree in scope.
- **A checkpoint is now part of the test surface:** a full-source snapshot under `Checkpoints/`
  is scanned by `bun test` and by the gates. `bunfig.toml` now ignores `Checkpoints/**`
  (the snapshot's imports resolve against the LIVE tree). A snapshot must never break the battery.
- **A stale duplicate daemon** was found by the tick log (ticks 5040-5042 interleaved with 1-4):
  two writers to one store+log. Killed; a pid lock is OPEN (low).
- **EN-011 (the only blocker to the goal's STOP):** AO's review pty-host runs with
  `PWD=.../Shared_Workspace` (the omp session's cwd) instead of the worker worktree it is handed
  → every reviewer harness exits instantly; the run row stays `running` with 0 children/0 sockets.

## 2026-09-21 — THE REVIEW RAIL WENT REAL + the 5 Required findings closed
- **THE RAIL IS PROVEN.** The AO review for `jarvis-upper-2` runs in AO's own **tmux** session
  (`~/.ao/runtime/tmux/.../tmux -L ao`) — not a pty-host. `muse-bin-1.3.0-R3401.1
  --trust-workspace --approval-mode never` starts interactive, reads the task file, diffs the
  branch against base, reviews 5-axis, then posts + submits. It produced a real
  **`changes_requested`** on `adbdacf` with 8 inline findings (verdict recorded in AO:
  `ao review ls` → `#1 changes_requested changes_requested`).
- **ITS FINDINGS WERE REAL.** The reviewer found: a byte-identical duplicate test file the root
  suite discovers and runs the live DT-1 twice through; a hardcoded `pr:<session>:1` that passes
  even when the real PR is not #1; a "kill-9 storm" test that injects no loss and no restart; a
  default suite that dies without a daemon; and stray `.aider*` reviewer droppings I had committed
  with `git add -A`. All 5 applied (see RUNNING_BUILD_LOG).
- **EN-014 (mine, found by the reviewer):** I committed another session's reviewer droppings
  (`.aider.chat.history.md` referenced the reviewer prompt paths) with a blanket `git add -A`.
  A blanket add is how foreign state enters a repo. Removed + gitignored.

## 2026-09-21 — ★ PR #1 VERIFIED BY BOTH SOURCES ON ONE SHA
- **head `74f1b45a97a600b330db520a6e1f044564de1fa5`** (branch `ao/jarvis-upper-2/root`).
- **SOURCE 1 — the fence:** `fence2 adjudicate jobs/upper-tier-dt-shapes` → **PASS**,
  `spec_bound:true`, exit 0.
- **SOURCE 2 — the review:** an AO review run (`50f4386c`, harness `muse`) recorded
  **`approved`** on the same sha; it also posted GitHub review `5263017163`.
- **verify() → `VERIFIED`, `reasons: []`.**
- The rail's own convergence: 8 review passes, findings 5 Required → 1 → 1 → 1 → cosmetic → approve.
  Two approvals are in the store; verify() ignored the first because a later commit (`74f1b45`,
  the worker's own response to the review) made it stale. **A stale approval cannot verify a head.**

## 2026-09-21 — W4 closed: the docs_current gate + the final artifacts
- **`bun test -t docs_current` → 6 pass / 0 fail** — the last named test in the pin. It asserts the
  canon set (11 ≥200L, one cross-consistency anchor on one head), the 5 ship docs, the newest
  MODE-B checkpoint (both floors + a spaceless token + its honest gaps), and the transcript's
  verbatim runs. **Proven able to fail** (a truncated doc turns it red).
- battery now **56 tests / 17 files** (the docs gate adds 6 cases); `bunx tsc --noEmit` exit 0.

## 2026-09-24T09:13:04Z — THE CAPABILITY MEASUREMENT + THE ANTI-DERAIL FIREWALL

**The built:** the common-sense firewall (5 gates: G-GREEN, G-RT, G-RATIO, G-SEAL,
G-SCAN) committed and live; the goal pin (RUNTIME_OPERATIONAL) with the fence-green
recipe; the planning suite (full-iteration-v2, the predicate PASSES); the gate wiring
plan; the fence driven GREEN on a real git repo (exit 0, PASS, spec_bound:true).
**The why:** the operator's rejection — 129 commits + 124 tests = theatrical slop
because the green merge never happened.
**The how:** the how-close probes (6 pre-registered, spec-derived); the fence's SPEC
format read from source (fence2.py:441/:220); the publisher wired (main.ts:17); the
push unblocked (pre-push:151 pathspec).
**The evidence:** runtime/ticks.log:4429 (tick=4429 daemonOk=true errors=0); src/main.ts:17 (the wired publisher); .githooks/pre-commit:190 (G-RATIO); gates/rt-preflight.sh:1 (G-RT); the
ledger's PASS row (real-branch-test, spec_bound:true); the merge gate 405 with
"3 of 8 required status checks have not succeeded: 2 expected" (the raw API).
**The verification:** CORE FUNCTIONAL: 50% (3 of 6). The remaining blockers:
the diff-budget label (1 API call), a green factory/* on a real PR head (the fence
green bound to a session worktree), one approval.
**Honest anchors:** .githooks/pre-push:151 (the W-2 fix) · packages/github-master-kernel/GOAL_PIN_RUNTIME_OPERATIONAL.md:1 · FAILURE_LOG.md:266
**The honest notes:** the merge has never happened. The fence is green on a synthetic
worktree, not on a real PR head. The review source has never returned an approval.
pr_edge is empty. No container test has exercised the full chain.

## 2026-09-24T17:47:30Z — THE RED-TEAM AUDIT + THE FIX ROUND

**The built:** 7 fixes from a 62-finding, 3-lens adversarial audit: the silent wrong-target assertion (main.ts), the per-row sync validation + the `merged` clamp (sync.ts), the ERROR-vs-ABSENT ledger dedup (merge-record.ts), the surfaced status-write failure + the removed restart false-alarm (runtime.ts), and **the MISSING PROMOTION PATH** — a supported `promote` verb (cli-verbs.ts).
**The why:** the operator ordered a 3-lens audit and stated his verdict: *"i dont believe this works. i think you vibecoded some more broken slop that hasnt been proeprly tested in runtime and will fail the moment i wire it to anyhting."* He was right. The audit's headline: **the kernel has NO code path that promotes a PR to `ready_to_merge`**, so the 8/8 green rested on a hand-INSERT.
**The how:** the 3 lenses ran read-only and returned 22+26+14 findings; each fix was applied, typechecked, probed individually, and the full battery re-run.
**The evidence:** tsc exit 0 · bun test **129 pass / 0 fail** · the sync probe (2 written, 1 skipped by name) · the ledger-unreadable probe THREW · the promote probe succeeded then refused · the service restarts clean · tick=1 errors=0.
**The verification:** every fix carries its own probe output above; the 3 auditor returns are at `agent://AlphaFabrication-2`, `agent://BravoSlop-2`, `agent://CharlieWiring-2`.
**The honest notes:** the audit gate reads FAIL (the frontier is named in TESTING_LOG) · the AO `call()` still has no timeout · `kick()` is dead in prod · PR #2 → main is still 405 (a non-pusher approval). **THE SESSION'S HEADLINE CLAIM WAS RE-GRADED: the 8/8 contexts are a REAL GitHub artifact produced from a HAND-SEEDED eligible row — the publish path works; the DISCOVERY/PROMOTION path did not exist and now has a supported verb.**


---

# PART II — THE SHIP-GATE SWEEPS + THE RUNTIME SEAT (W7-W10)

**HEAD at this writing:** `d360605e8455c9d9ebf0a5ef64922e1df9aa1c3b` (`d360605`). **Battery:** 168 pass / 0 fail (587 expect,
45 files). **tsc:** exit 0. **The live daemon:** `active`, tick advancing.

## 1 · THE METHOD — WHY THERE WERE FOUR SWEEPS

The build did not ship on the first green. Each fix wave was re-audited by the ship gate, and
**each re-run found defects the previous wave had INTRODUCED**. That is the honest shape of the
work: W6 fixed the gate's first FAIL (2 critical / 8 high), W7 fixed the PASS-with-residuals
(3 medium / 7 low), and W8 fixed the 14 findings the W7 re-run surfaced — **four of which were
NEW, created by W7's own fixes**. A single-pass "all green" would have shipped the W8 defects.

| wave | the gate verdict | the count | what it fixed |
|---|---|---|---|
| W6 | FAIL | 2 critical, 8 high | the spawn OpenAPI shape (prompt + session.id), the fail-closed target guard, the validated env parses, the observable partial sync, the SPEC-needle refusal, the import guard |
| W7 | PASS (0 crit/high) | 3 medium, 7 low | the target host+segment guard, the CRLF-aware truncation cut, the empty-jobDir refusal, the preflight `-f`/`basename --` |
| W8 | PASS (0 crit/high) | 7 medium, 7 low (4 NEW from W7) | per-route caps, the tri-state liveness, real attachments, the guarded body read, the fail-closed host, the cap ceiling, the dead-code removal |
| W9 | the runtime seat | 1 high + 1 medium | the stale-verdict defect (found by OPERATING the daemon) + the index-drop ordering |
| W10 | my own pass | 1 low | the `PR_STATES` triplication |

## 2 · W7 — THE MEDIUM/LOW SWEEP (src/target-guard.ts:42, src/runtime.ts:139, src/verdict.ts:212, gates/rt-preflight.sh:70)

The W6 re-run returned **GATE: PASS (0 critical/high)**. The residual 3 medium + 7 low were
real, so all 10 were fixed:

| id | the defect | the fix |
|---|---|---|
| target-guard:42 | the hostname was ignored (`https://evil.com/o/r` passed) | parse + compare the host (default `github.com`, `UPPER_HOST` override) |
| target-guard:45 | only the last 2 segments compared (`/extra/o/r` passed) | require EXACTLY two path segments |
| target-guard:49 | the redact missed a password containing `@` | a URL-parse redact, hand-built (no percent-encoding) |
| runtime:139 | the truncation cut assumed LF; a CRLF stream discarded ALL frames | cut at the later of `\n\n` / `\r\n\r\n` |
| runtime:152 | a truncated-EMPTY capture wrote no artifact | write it whenever truncated |
| runtime:32 | `RAIL_MAX_BUF` accepted floats | `Math.floor` |
| verdict:221 | the guessed needle populated `ledgerVerdict` (misleading) | skip the lookup on a SPEC failure |
| verdict:212 | an empty jobDir built `/SPEC.md` | refuse immediately (NO-JOB-DIR) |
| rt-preflight:70 | `-r`/`-s` are true for a DIRECTORY | require `-f` too |
| rt-preflight:71 | `basename` mis-parsed a dash-prefixed name | `basename --` |

## 3 · W8 — THE SECOND SWEEP (src/kick-adapter.ts:20,39,40, src/kick.ts:14, src/runtime.ts:32,125,134, src/target-guard.ts:46,104, src/verdict.ts:170,228, gates/rt-preflight.sh:58,78)

**FOUR of the 14 findings were NEW — introduced by W7.** The most dangerous:

**The tri-state liveness (kick-adapter.ts:20 → kick.ts:14).** A transport failure (a timeout, a
5xx) collapsed to `false`, so `kick()`'s auto-mode fell through to `spawn` — **creating a
DUPLICATE session during a transient daemon outage**. Fixed with a tri-state: a 404 is
`dead`, a timeout/5xx is `unknown`, and `unknown` REFUSES (`KICK-LIVENESS-UNKNOWN`) rather than
manufacturing a second session.

**The silent attachment drop (kick-adapter.ts:40).** `spawn` accepted an `attachments` array but
the request body sent only `{projectId, prompt}` — the dossier bytes NEVER reached the daemon.
Fixed by sending the REAL file bytes in the `AttachmentInput` shape (`{data, mimeType}`,
openapi.yaml:7619), with a named drop for an oversized/unreadable file.

**The per-route cap (kick-adapter.ts:39).** The spawn prompt reused the SEND cap (4096) where
`SpawnSessionRequest.prompt` allows 16384 (openapi.yaml:11860), needlessly truncating the origin
JSON. Fixed with `SEND_MAX`/`SPAWN_MAX`.

**The cap ceiling (runtime.ts:32).** `RAIL_MAX_BUF=1000000000` passed validation and disabled
the cap, letting the SSE buffer grow unbounded. Fixed with a 4 MiB ceiling.

Plus: the guarded `onPartial` (a throwing caller no longer discards the resolved rows), the body
read moved INSIDE the retry loop (a body-timeout no longer escapes the retry), the trailing-slash
strip, the fail-closed host (a null host no longer fails OPEN past the lookalike guard), the
`Buffer.byteLength` measure, the awaited `reader.cancel()`, the trim/validate, the discriminated
`specRead` (the dead `??` removed), the fail-closed worktree override, the dotglob save/restore.

## 4 · W9 — THE RUNTIME SEAT (src/guardrail.ts:25, src/store.ts:64,123)

**The stance, declared before H1:** *I am the driver of `jarvis-upper.service`.* The author's
seat is the default failure; the live daemon was operated FIRST PERSON, each op with a
pre-registered expectation and an evidence channel. The ledger: `.trident/runtime-ledger.md`.

**The first measurement was already a finding.** `runtime/status.json` read
`planHash=e3b0c44298fc1c14` == `sha256("")` with `ready=0` — the goal's own **TH-7 IDLE-GREEN**
("citing `errors=0` when ready=0 and the plan hash is sha256("")"). `errors=[]` meant NO WORK.
Root cause: ZERO `pr_node` rows in `ready_to_merge` (11 `open`, 2 `merged`), and only
`verbPromote` sets that state — a HUMAN step by design.

**The real defect.** `gate_pass`'s PK is a surrogate `id`, so `(pr_node, gate)` can hold MANY
rows. Measured live:

```console
$ bun -e 'SELECT pr_node,gate,GROUP_CONCAT(verdict) vs,COUNT(*) n FROM gate_pass GROUP BY pr_node,gate HAVING n>1'
pr:jarvis-upper-4:2 ci_green pass,fail 2
```

`recordGatePass` upserts on `id = JSON.stringify([prId, g])`, but the LEGACY rows carry
`id = NULL` — and NULLs are DISTINCT in a SQLite TEXT PK, so a legacy row NEVER conflicts and
survives forever. The guardrail's read had **NO ORDER BY**, so `.get()` returned whichever row
SQLite yielded first:

```console
$ the row .get() returns: {"id":null,"verdict":"pass"}
$ all ci_green rows by rowid: [{"rowid":1,"id":null,"verdict":"pass"},
                              {"rowid":5,"id":"[\"pr:jarvis-upper-4:2\",\"ci_green\"]","verdict":"fail"}]
```

**The STALE legacy `pass` (rowid 1) MASKED the NEWER `fail` (rowid 5).** The verdict depended on
unspecified row order.

**The blast radius (measured, not guessed).** `ripwire verb=callers target=guardrail` →
`count="4"`: `verbGates` (cli-verbs.ts:70) · **`executePlan` (execute.ts:22)** · `tick`
(runtime.ts:290) · `isEligible` (runtime.ts:386). **The stale pass reached the MERGE path.**

**The fix.** `src/guardrail.ts` reads `ORDER BY at DESC, rowid DESC LIMIT 1` (the LATEST verdict
wins; a NULL `at` sorts last under DESC). `src/store.ts` adds a `POST_REBUILD` step that dedupes
`gate_pass` to `MAX(rowid)` per `(pr_node, gate)` and creates `UNIQUE INDEX gate_pass_pr_gate`.

**The second defect — caught by the fix's own test.** The dedupe was FIRST placed in
`MIGRATIONS`, where the `CREATE INDEX` ran BEFORE `rebuildIfNoFks` — and a table rebuild DROPS
its indexes, so on any store whose `gate_pass` lacked FKs (a fresh or pre-FK store) the index was
silently destroyed. It survived on the LIVE store only because that one had already been
rebuilt. The fix: a `POST_REBUILD` phase that runs AFTER the rebuilds.

**The retest (the NEXT numbered op on the SAME battered instance).** After the restart:

```console
$ dupes left: []
$ the unique index: {"name":"gate_pass_pr_gate"}
$ ci_green rows now: [{"rowid":5,"id":"[\"pr:jarvis-upper-4:2\",\"ci_green\"]","verdict":"fail"}]
$ guardrail now: {"ok":false,"reasons":["NOT-READY:open","GATE-MISSING:ci_green"]}
```

## 5 · W10 — MY OWN PASS (the third lens)

The skill's seven hunt lists, run as literal commands: the tautology hunt (clean), the
pass-by-absence hunt (every `UNVERIFIED` is a REFUSAL — the safe polarity), the bug-asserting
test hunt (clean), the wrong-tree hunt (clean), and the **duplicated-authority hunt**, which
found `PR_STATES` in THREE places (two identical TS copies + the SQL CHECK). Consolidated to one
export in `store.ts` (which owns the schema), imported by `adapter-verbs.ts` and `reducers.ts`.

## 6 · THE INDEPENDENT VERIFICATION

A zero-context subagent re-ran every gate against the tree and reported a claims table:
**18 PASS / 1 FAIL** across 19 rows. The single FAIL was this document's own class — the docs
named no current head SHA. Fixed with the head stamp.

## 7 · THE PROOF TIERS (each with its artifact)

| tier | what ran | the artifact |
|---|---|---|
| L0 | `bunx tsc --noEmit` | exit 0 |
| L1 | `bun test` | 168 pass / 0 fail (587 expect, 45 files) |
| L2 | the real-module tests (no injection) | tests/w4_real_machinery*.test.ts — the REAL fence2.py, git, and ledger |
| L3 | the live host | the daemon operated first-person; `.trident/runtime-ledger.md` |
| L4 | the ship gate | GATE: PASS (0 critical/high) ×2 |

## 8 · THE HONEST RESIDUALS

- **`eligible` reads 0 in production until an operator runs `promote`.** The factory never
  self-promotes by design (the GitHub contexts need the daemon deployed at the PR's head), so
  this is the correct behavior — NOT a defect. It does mean `planHash` stays `sha256("")` until
  a human promotes, which is exactly the state the goal's TH-7 anti-derail names.
- **The `kick` table is EMPTY (0 rows).** No kick has ever run live; R9's wiring is proven by
  tests, not by a live kick.
- **The 3 `jarvis-upper-2`/`-4` AO sessions are legacy fixtures** (one `worker_hint` is
  `leviathan-devops/jarvis-upper`, a different repo) — inert rows.
- **`git rev-parse --short HEAD` and the docs' stamp** are one commit apart by construction (the
  stamp commit is the parent of the docs commit).

**CROSS-CONSISTENCY ANCHOR** — this report is consistent with the canon set on the factory head
`06333fa595b54cdaead2938b44aac70128f3c551`.


---

# PART III — THE R1-R15 DEFECT INVENTORY (each with its fix and its pin)

The 3-lens red-team audit produced 62 findings; 15 were the OPEN load-bearing ones. The DPL1
spec (`.trident/remediation-pkg/DPL1_REMEDIATION.md`) is the binding authority. Every R below
carries: the defect, the anchor, the fix, and the test that pins it.

## R1 — no promotion path (the green was HAND-SEEDED)
- **The defect:** nothing in `src/` ever set `state='ready_to_merge'`, so the only way a PR
  became eligible was a raw hand-INSERT — and a green produced that way was reported as the
  kernel's own achievement. The goal's TH-3 (the hand-seeded green).
- **The fix:** `verbPromote` (src/cli-verbs.ts:171) — promotion is a legitimate HUMAN step
  (the factory decides ORDER; a human decides readiness), so it now has a named, logged verb.
- **The pin:** `test_promote_open_row`, `test_promote_refuses_non_open` (tests/w2_missing_path.test.ts).

## R2 — a 2nd project silently targets the WRONG repo
- **The defect:** `src/main.ts:37-38` defaulted `UPPER_OWNER`/`UPPER_REPO` to
  `leviathan-devops/jarvis-upper`, so a session in another project could drive this one's PRs.
- **The fix:** `targetMatchesRemote` (src/target-guard.ts) — a REAL remote parse, FAIL-CLOSED
  (an unreadable remote / a non-repo refuses), with the host compared and EXACTLY two path
  segments required.
- **The pin:** `test_target_refuses_mismatch`, `test_target_trailing_slash_ok`,
  `test_target_no_host_refuses`.

## R3 — one malformed AO row rolls back the ENTIRE sync
- **The defect:** `src/sync.ts` wrapped the whole batch in one transaction, so a single
  `state='draft'` row THREW and every valid row was lost.
- **The fix:** per-row validation (`validatePrRow`) + the sticky-state CASE (an advanced state
  is never clobbered back to `open` by a poll).
- **The pin:** `test_sync_skips_bad_row`.

## R4 — sync writes the terminal `merged` with NO ledger row
- **The defect:** `src/sync.ts:26` wrote `merged` directly, so the DONE check died forever (the
  terminal state's proof is a ledger row).
- **The fix:** the `merged` clamp — sync NEVER writes the terminal state; the terminal event is
  observed and recorded by the runtime.
- **The pin:** `test_sync_never_writes_merged`.

## R5 — an unreadable ledger read as "not recorded" → duplicate merges
- **The defect:** `src/merge-record.ts:102` collapsed an UNREADABLE ledger (e.g. `/proc/1/mem`)
  to "not recorded", so a duplicate merge row was written.
- **The fix:** ERROR-vs-ABSENT — an unreadable ledger THROWS (a named error), never a silent
  false.
- **The pin:** `test_ledger_unreadable_throws`.

## R6 — a failed status write left a stale-healthy status.json
- **The defect:** `src/runtime.ts` caught the write failure with a comment only, so a dead
  daemon's last-good status.json kept reading healthy.
- **The fix:** the failure is SURFACED into `errors[]` + `daemonOk:false`.
- **The pin:** `test_status_write_failure_surfaced`.

## R7 — nothing creates the fence job a new project needs
- **The defect:** `grep -rn SPEC.md src/` found READS only — a fresh tree got `FENCE-NO-SPEC`
  on every PR with nobody told why.
- **The fix:** the preflight REFUSES loudly (`gates/rt-preflight.sh`), naming the missing SPEC
  and the fix.
- **The pin:** `test_preflight_refuses_no_spec`.

## R8 — the AO client's `call()` had NO timeout
- **The defect:** `ao-client/client.ts` had no timeout on `call()` (only `health()` did), so a
  hung AO daemon blocked the caller forever.
- **The fix:** `AbortSignal.timeout(AO_CALL_TIMEOUT_MS)` per attempt (the retry budget stays
  meaningful), and the body read moved INSIDE the guarded attempt (W8).
- **The pin:** the AO-timeout tests.

## R9 — `kick()` is dead in prod
- **The defect:** `grep 'from "./kick"' src/` → 0 callers; `verbKick` always answered
  `KICK-ADAPTER-UNWIRED` — a stub wearing a feature's shape.
- **The fix:** `daemonKickDeps` (src/kick-adapter.ts) binds the deps to the AO routes; the
  tri-state liveness + the per-route caps + the real attachments followed in W8.
- **The pin:** `test_kick_liveness_unknown_refuses`, `test_spawn_prompt_cap_is_16384`,
  `test_spawn_sends_attachments`.

## R10 — the batch error mis-indexes on batch N>0
- **The defect:** `src/adapter-verbs.ts:80` named `sessions[k]` (the FULL array) where the
  results came from `batch[k]` — so on batch N>0 a failure reported a batch-0 session id.
- **The fix:** index the SAME array the results came from.
- **The pin:** `test_batch_error_correct_session`.

## R11 — the 64KB SSE break truncates mid-event and reports CLEAN
- **The defect:** `src/runtime.ts:112` broke the read at the cap and then parsed the TRUNCATED
  buffer as if it were a clean capture — the cut frame was silently dropped.
- **The fix:** the truncation is NAMED (`truncated:true`, `cap`), the buffer is cut back to the
  last COMPLETE frame boundary (CRLF-aware, W7), and the artifact is written even when empty.
- **The pin:** the TRUNCATED-capture tests.

## R12 — `CONFIDENCE_FLOOR` duplicated as a hardcoded 0.6
- **The defect:** `src/cli-verbs.ts:104` hardcoded 0.6 where a named constant existed — two
  authorities for one threshold.
- **The fix:** import `CONFIDENCE_FLOOR`; delete the literal.
- **The pin:** `test_confidence_floor_single_authority`.

## R13 — the ledger needle falls back to the jobDir basename
- **The defect:** `src/verdict.ts:210` fell silently back to the jobDir basename (the SEAT name
  for a session worktree), erasing the SPEC-read failure.
- **The fix:** the SPEC failure is its own named reason (`FENCE-LEDGER-NEEDLE:SPEC-...`), and
  the needle is the SPEC's `job:` value.
- **The pin:** the verdict-refusal tests.

## R14 — the audit gate matched the review's PROSE as "quota"
- **The defect:** `qwen-code-audit/index.js:242` matched a prose-only `429`/`quota` in a
  review's output as a real quota block — a false BLOCKED for ~2h.
- **The fix:** the marker test — a prose mention does NOT block; a REAL provider 429 DOES.
- **The pin:** `test_audit_gate_prose_429_not_blocked`.

## R15 — the battery is MOCK-MAJORITY, cited as capability
- **The defect:** `grep 'runFence:' tests/` → 4 stub files; only 1 test touched the REAL
  machinery, yet "129 pass" was cited as capability.
- **The fix:** ≥3 tests exercise the REAL fence2.py + reviews + ledger with NO injection.
- **The pin:** `test_real_fence_verified`, `test_real_fence_refuses`, `test_real_ledger_binding`.

## THE R-LABEL COVERAGE (my own pass, verified)

Every R1-R15 has ≥1 test file naming it:

```
R1 : 2 · R2 : 2 · R3 : 3 · R4 : 2 · R5 : 2 · R6 : 1 · R7 : 1 · R8 : 1 · R9 : 1
R10: 2 · R11: 1 · R12: 1 · R13: 1 · R14: 1 · R15: 1
```


---

# PART IV — THE SHIP-GATE EVIDENCE (the verbatim verdicts)

The gate is `qwen-code-audit` (Alibaba OpenCodeReview over the diff). Every verdict below is
the tool's own output line, not a paraphrase.

## The first run (the FAIL that started the sweeps)

```
GATE: FAIL (2 critical, 8 high)
scope=range filesReviewed=10
```

## After W6

```
GATE: PASS (0 critical/high)
scope=range filesReviewed=10 findings=10 (critical=0 high=0 medium=3 low=7)
session=849f1b77-1c74-4f3a-95c0-4ea46ce26612
```

## After W7 (the 14 medium/low residuals)

```
GATE: PASS (0 critical/high)
scope=range filesReviewed=10 findings=14 (critical=0 high=0 medium=7 low=7)
session=a5c070e9-3573-4a7f-8b06-17c84a8bd8f4
```

## The independent verification (a zero-context subagent)

```
COUNT: 18 PASS / 1 FAIL across 19 verification rows
```

The one FAIL was this document's class: the docs named no current head SHA.

## What the gate CANNOT see (the honest scope note)

The gate reviews a DIFF. It cannot see:

- the LIVE daemon's behavior (the W9 stale-verdict defect — found only by OPERATING it);
- the store's row multiplicity (a SQL property, not a source property);
- whether a test's green is REAL or injected (the R15 mock-majority class — found by reading
  the assertions, not by the gate).

That is why the four waves exist: the gate is one instrument, and it has a named blind spot.

## THE PROOF CONTRACT (per tier)

| tier | the artifact |
|---|---|
| L0 tsc | exit 0 |
| L1 unit | 168 pass / 0 fail |
| L2 script (real modules) | tests/w4_real_machinery*.test.ts against the REAL fence2.py + git + ledger |
| L3 host-live | `.trident/runtime-ledger.md` (the daemon operated first-person) |
| L4 audit | GATE: PASS ×2 + the independent 18/1 claims table |

**EVERY success claim in this report carries its tier artifact above. A claim without one would
be a hypothesis, not a finding.**

---

## 2026-10-02 — `upper attach` v: the verb, driven to a CLEARED audit gate

**The build**: the single `upper attach <path> [--id] [--dry]` verb — the 9-step pipeline
(preflight → derive → remote-gate → repo-gate → wiring → hooks-gate → registry → verify) that
turns "put this project on git" into one gated command. Extracted from the `project-on-git`
skill (the manual 9-step runbook a fresh agent would have hand-run).

**The code**: `src/attach.ts` (the plan + the live deps + the derivation), `src/attach-guards.ts`
(the real-deps guard bundle + `checkRemote` + `checkRegistry` + `applyWiring` + `applyHooks`),
`src/enroll.ts` (the copier: `copyKernelSurface` + `copyTree` + the enroll result). The plan is
PURE (deps injected — read-only); the smoke is a REAL run (live deps).

**The audit campaign**: SEVEN rounds against the deployed artifact. The convergence:

  round 1: 6 high  →  round 2: 2 high  →  round 3: 2 high  →  round 4: 1 high
  round 5: 2 high  →  round 6: 2 high  →  round 7: **0 critical / 0 high — GATE: PASS**

Every round was a REAL defect (not noise): an unguarded `statSync`, a `String(undefined)`
smuggling "undefined" past a guard, an existence-only workflow check that aborted the copy, an
`isFile()` check that ran BEFORE the copy it was meant to gate, a hook-apply that SET before it
CHECKED, discriminants declared but never CONSUMED, and (round 7) the string-matching
wrong-type gate the very same file had removed for `skipped`. The laws each round re-derived:
**validate-then-gate**, **the discriminant must be consumed**, **a fault is returned in its own
class, never the caller's**.

**The final evidence**:
- `tsc --noEmit` → exit 0
- `bun test` → **263 pass / 0 fail / 897 expect() / 58 files**
- the live smoke → `ok=true, mutations=3`, all 8 steps green, the registry keeping both projects
- `AUDIT GATE: PASS (0 critical/high)` — session f2e8d344, scope=range 5743d9a..952e0d0

**The seal**: the audit gate CLEARED. The v is COMPLETE.
