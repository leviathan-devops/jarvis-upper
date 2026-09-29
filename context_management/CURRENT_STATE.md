# CURRENT STATE — jarvis-upper (W4)

This doc is the **per-module status** at the end of W4. "What runs / what does
not" is keyed to the runtime, the AO factory, JFM, and the 17 upper-tier modules
+ JFM's 6 internal modules. All line counts are measured from disk at W4.

---

## 1. HOST-LIVE SYSTEMS

| System | Location | Status (W4) | Proof command |
|--------|----------|-------------|---------------|
| AO daemon (Jarvis Core) | `http://localhost:3001` | UP (healthz 200) | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` → `200` |
| AO introspection | `http://localhost:3001` | 144 paths / 164 ops / 269 schemas | SSE at `/api/v1/events?after=<cursor>` live |
| AO merge model | AO semantics | explicit-only | there is NO webhook/notifier/plugin surface |
| Upper-tier runtime | `src/main.ts:1-19` + `runtime/` | RUNNING | `bun src/cli.ts status` → `RUNNING (tick >3000)` |
| JFM CLI | `~/.local/bin/jfm` (symlink → `/home/leviathan/JARVIS_WORKSPACE/jfm/`) | Installed + tested | `jfm health` |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py:1-966` | Live (hermetic) | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | PINNED | default/task = poolside/poolside/laguna-s-2.1:high |

## 2. THE 17 UPPER-TIER MODULES (src/) — WITH LINE COUNTS + CALLERS

Status legend: RUNS = host-live + gate green; STUB = exists but unverified;
BROKEN = gate red; FROZEN = immutable per BUILD_STATE.md.

| # | Module | Path | Lines | Callers | Status |
|---|--------|------|-------|---------|--------|
| 1 | main | `src/main.ts` | 19 | Orca/runtime launcher; runtime.ts | RUNS |
| 2 | runtime | `src/runtime.ts` | 150 | main.ts, cli.ts, status.ts | RUNS |
| 3 | status | `src/status.ts` | 48 | runtime.ts | RUNS |
| 4 | verdict | `src/verdict.ts` | 184 | tests/two_source_verdict.test.ts | RUNS |
| 5 | execute | `src/execute.ts` | — | cli.ts | RUNS |
| 6 | desks | `src/desks.ts` | — | execute.ts | RUNS |
| 7 | kick | `src/kick.ts` | — | desks.ts | RUNS |
| 8 | dossier | `src/dossier.ts` | — | kick.ts | RUNS |
| 9 | attribute | `src/attribute.ts` | — | dossier.ts | RUNS |
| 10 | graph | `src/graph.ts` | — | attribute.ts | RUNS |
| 11 | guardrail | `src/guardrail.ts` | — | graph.ts | RUNS |
| 12 | plan | `src/plan.ts` | — | guardrail.ts | RUNS |
| 13 | reducers | `src/reducers.ts` | — | plan.ts | RUNS |
| 14 | sync | `src/sync.ts` | — | cli.ts (STUB — EN-010) | STUB |
| 15 | adapter-verbs | `src/adapter-verbs.ts` | — | cli.ts | RUNS |
| 16 | cli-verbs | `src/cli-verbs.ts` | — | adapter-verbs.ts | RUNS |
| 17 | cli | `src/cli.ts` | — | operator, adapter-verbs, cli-verbs | RUNS |

> Entry path chain: `src/main.ts:1-19` → `src/runtime.ts:1-150` →
> `src/status.ts:1-48`. The tick loop in `runtime.ts` publishes
> `runtime/status.json:1-13` and appends `runtime/ticks.log:1-5005` each
> 3000ms. `src/sync.ts` is the STUB (EN-010) — returns prNodes 0 while PR #1
> is OPEN.

## 3. THE AO-CLIENT LAYER (10-verb seam)

| Module | Path | Lines | Status | Callers |
|--------|------|-------|--------|---------|
| client | `ao-client/client.ts` | 75 | RUNS (AO 200) | probes/a1a2-client |
| rail | `ao-client/rail.ts` | 113 | RUNS | client |
| gen | `ao-client/gen.ts` | 39 | RUNS | rail |
| gen/routes | `ao-client/gen/routes.ts` | 173 | RUNS (144 paths) | gen |
| probe a1a2 | `ao-client/probes/a1a2-client.ts` | — | RUNS | client health check |
| probe a4 | `ao-client/probes/a4-rail-real.ts` | — | RUNS | rail real-mode |

## 4. THE GATES + SPEC-AUDIT (3 refusal gates)

| # | Gate | Path | Lines | W4 token | Status |
|---|------|------|-------|----------|--------|
| 9 | does_anything_run | `gates/does_anything_run.sh` | 49 | `VERDICT:RUNS (fail=0)` | PASS |
| 10 | shape_freeze | `gates/shape_freeze.sh` | 50 | `SHAPES:all declared ids implemented` | PASS |
| 11 | orphan_scan | `gates/orphan_scan.sh` | 35 | `ORPHANS=0` | PASS |
| 12 | spec-audit | `scripts/spec-audit.ts` | 86 | — | RUNS (G13 BLOCKED) |

## 5. JFM — 6 INTERNAL MODULES (with line counts + verbs + callers)

JFM lives at `/home/leviathan/JARVIS_WORKSPACE/jfm/` — its OWN git repo (branch
`main`), symlinked at `~/.local/bin/jfm`. The JAM desk core is IMPORTED from
`Shared_Workspace/JARVIS/src/desk-orchestrator.ts:1-1080` (never forked).

| # | Module | Path | Lines | Verbs / Role | Callers | Status |
|---|--------|------|-------|--------------|---------|--------|
| J1 | cli | `jfm/src/cli.ts` | 155 | `health|status|watch|pin|dispatch|steer|abort|pr|gate|board|wave` | operator | RUNS |
| J2 | ao-transport | `jfm/src/ao-transport.ts` | 133 | 10-verb seam + pr natives | cli | RUNS |
| J3 | pin | `jfm/src/pin.ts` | 55 | pins AO jobs to head sha | cli, dispatch | RUNS |
| J4 | desk | `jfm/src/desk.ts` | 78 | JAM tracker + 5 AO columns (IMPORTED seam) | cli, watch-ao | RUNS |
| J5 | watch-ao | `jfm/src/watch-ao.ts` | 84 | INST-1/2/4 wired | cli | RUNS |
| J6 | gate | `jfm/src/gate.ts` | 7 | gates dispatch results | cli | PASS |

### 5.1 The 5 AO columns in the JAM tracker

The JAM desk core (`desk-orchestrator.ts:1-1080`) models AO spawns across 5
columns:

| Column | AO state | Meaning |
|--------|----------|---------|
| queued | pending | spawned but not yet started |
| running | active | AO job active, TUI live |
| reviewing | reviewing | AO review run in flight |
| done | closed | fence2 + AO review both PASS |
| killed | killed | aborted by operator |

`jfm status` reads these columns; `jfm watch` tails the SSE into them.

### 5.2 JFM test

| Test | Path | Lines | Token |
|------|------|-------|-------|
| jfm_verbs | `jfm/tests/jfm_verbs.test.ts` | — | `8 pass / 0 fail` |

## 6. IMPORTED DEPENDENCIES (never forked)

| Dependency | Path | Lines | Imported by |
|------------|------|-------|-------------|
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | 1080 | JFM `jfm/src/desk.ts` |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` | 966 | gates + verdict |

## 7. RUNTIME STATE FILES

| File | Path | Lines / size | Content |
|------|------|--------------|---------|
| status.json | `runtime/status.json` | 13 | RUNNING / tick |
| ticks.log | `runtime/ticks.log` | 5005 | tick append |
| wire_capture.json | `runtime/wire_capture.json` | 7 | `parsedFrames=168, bytes=65638` |

## 8. TEST FILES (16)

| Test | Path | Lines |
|------|------|-------|
| two_source_verdict | `tests/two_source_verdict.test.ts` | 111 |
| sync_matches | `tests/sync_matches.test.ts` | 19 |
| spec_audit | `tests/spec_audit.test.ts` | 26 |
| ship_manifest | `tests/ship_manifest.test.ts` | 96 |
| runtime_ticks | `tests/runtime_ticks.test.ts` | 89 |
| replay_converges | `tests/replay_converges.test.ts` | 83 |
| planner_cycle | `tests/planner_cycle.test.ts` | 48 |
| live_e2e | `tests/live_e2e.test.ts` | 36 |
| kick_fallback | `tests/kick_fallback.test.ts` | 76 |
| guardrail_stale | `tests/guardrail_stale.test.ts` | 67 |
| graph_snapshot | `tests/graph_snapshot.test.ts` | 45 |
| execute_plan | `tests/execute_plan.test.ts` | 58 |
| dossier_hash | `tests/dossier_hash.test.ts` | 33 |
| does_anything_run | `tests/does_anything_run.test.ts` | 92 |
| bindings_parity | `tests/bindings_parity.test.ts` | 20 |
| attribution_triage | `tests/attribution_triage.test.ts` | 68 |

## 9. AO FACTORY — REAL JOBS (this era)

| Job | Type | Worker profile | Result | PR |
|-----|------|----------------|--------|----|
| `jarvis-upper-2` | worker/omp/tui | jarvis-worker (Poolside-Direct) | Fixed DT-shapes drift bug (EN-001) | `https://github.com/leviathan-devops/jarvis-upper/pull/1` (OPEN, 760ad1b/732083e/adbdacf) |
| `jfm-e2e-1` | worker | jarvis-worker | End-to-end spawn→commit→push→PR | `https://github.com/leviathan-devops/jfm-e2e/pull/1` (cce7bdb, E2E-PROOF.txt=DT1-OK) |

## 10. WHAT DOES NOT RUN (as of W4)

| Item | Reason | Gate |
|------|--------|------|
| fence2 in live mode against live AO | Not applicable — fence2 is hermetic (`bwrap --unshare-all`); network-dependent done-when steps fail there BY DESIGN. DB_1's hermetic step runs offline. | G1 still PASS |
| AO `omp` as reviewer | REJECTED by AO: `INVALID_PROJECT_CONFIG: unknown harness "omp"`. Reviewer-capable = muse/aider/cursor/codex. Only muse/aider/cursor installed here. | D-005 |
| `~/.omp/agent/config.yml` using deepseek as worker | That is the OPERATOR's main omp (deliberately NOT a worker). Worker uses `jarvis-worker` profile. | D-008 |
| `upper sync` | STUB — returns prNodes 0 while a PR is open (EN-010). | G14 BLOCKED |
| AO review approval of head sha | Not yet observed — G11 OPEN. | G11 OPEN |

## 11. DEFECTS ON RECORD (summary, W4)

Full detail in `RUNNING_DEBUG_LOG.md`. Quick list (active this era EN-001..EN-010):

- EN-001 the client's health() called a nonexistent operation → fixed by `jarvis-upper-2`.
- EN-003 no entry/loop → fixed W2.
- EN-006 a healthy idle stream flagged as an error → relaxed.
- EN-007 ripwire's crawl root EXCLUDES jarvis-upper → graph gate cannot verify edits here.
- EN-008 the daemon's stale run-file + the rotating X cookie → daemon resume recipe.
- EN-009 checkpoint test copies re-ran → pinned.
- EN-010 `upper sync` is a STUB (returns prNodes 0 while a PR is open).

EN-019 (desk-local pin invisible) and EN-020 (PAT burned) are also recorded in
DEBUG_LOG.

## 12. WIRE CAPTURE (frozen frame)

`runtime/wire_capture.json:1-7`: `parsedFrames=168, bytes=65638`. This is the
frozen frame of the AO↔upper-tier transport at W4 end. Any change to the
transport seam must not regress this count without a documented reason.

## 13. STATUS SNAPSHOT (literal)

```
$ bun src/cli.ts status
RUNNING (tick >3000)
```

## 14. GROUND TRUTH QUICK CHECK

| Question | Answer (W4) | Command to reproduce |
|----------|-------------|----------------------|
| Does anything run? | YES | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` |
| Does AO answer? | YES (200) | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` |
| Does the runtime tick? | YES | `bun src/cli.ts status` → `RUNNING (tick >3000)` |
| Is fence2 green on the frozen sha? | YES | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` → PASS |
| Is AO review green on the frozen sha? | NO (OPEN) | AO dashboard → not yet approved |
| Are all 3 gates + battery + tsc green? | YES | `bash gates/*.sh` + `bun test` + `bunx tsc --noEmit` |
| Is the worker profile pinned? | YES | `cat ~/.omp/profiles/jarvis-worker/agent/config.yml` |
| Is the global omp still deepseek? | YES (by design) | `cat ~/.omp/agent/config.yml` |

End of CURRENT_STATE.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `06333fa595b54cdaead2938b44aac70128f3c551` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
- **VERDICT: VERIFIED** — fence PASS `spec_bound:true` + review `approved`, SAME sha
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green · jfm 8/0
- **jfm wave w0:** the desk `upper-tier-job` closed, `unverdicted: []`

---

## [2026-09-22T22:45:31Z] — THE OCR-HARDENING CAMPAIGN UPDATE (HEAD `8487df3`)

**THE CURRENT DIST/HEAD:** `8487df3615196b1898b0fc7f54104424150cdbee` (branch `feat/github-master-kernel`).
**THE BATTERY:**  78 pass  0 fail  (`bun test`). **`bunx tsc --noEmit`:** exit 0.
**THE CONTRACT:** `src/status-contract.ts` — the 8 status contexts, UNCHANGED. The LIVE ruleset
23838059 (enforcement active, bypass_actors []) still matches them byte-for-byte.
**THE 8 LOCAL GATES:** W-1 (scoped off — no `extensions/` here) · W-2 · W-3 · W-6 · W-8 · W-9 ·
W-13 · W-14.

### WHAT THIS CAMPAIGN CHANGED
The ocr ship gate returned **FAIL (36 high / 77 medium / 15 low, 40 files)** against this kernel —
the gate this repo uses to block every ship claim had never been run on the repo itself. Four
parallel waves hardened it (`.githooks/**` 33 findings · `.github/**` 7 · `src/*.ts` 61 ·
`scripts/**`+`gates/**` 27). Then the ORCHESTRATOR's own audit found SIX defects the desks'
"COMPLETE" reports did not survive — every one caught by RUNNING the hook, not reading it:
1. **W-3 was unwired** (`scan-phantom.sh` never sourced) — `.githooks/pre-push:27`.
2. **★ THE IFS BUG** — `IFS= read -r a b c d` with an empty IFS puts the whole line in `a`, so
   `remote_sha` was always empty and EVERY ref was skipped: **W-2 AND W-3 never fired.** The whole
   pre-push gate was dead. `.githooks/pre-push:61`. Not in the ocr report — introduced by a fix.
3. **New refs skipped** by the `0000` guard — `.githooks/pre-push:63`.
4. **W-6 over-fired** on `err.includes("Timeout")` — `.githooks/pre-commit:67`.
5. **★ THE `=~` QUOTING BUG** — inside `[[ =~ ]]` the pattern is unquoted, so `""` and `''` were
   stripped to empty alternation branches that match ANYTHING — `.githooks/lib/scan-silent.sh:119`.
6. **W-13 shape gaps** — a no-paren comment-only catch escaped both rules.

### THE EVIDENCE (all re-proven by running)
- **The P5 corpus:** `.trident/p5_corpus2.sh` → **13 pass / 0 fail** — every gate, both halves.
- **A REAL `git push`** of a new branch with a phantom claim → `REJECT(W-3)` rc=1.
- **A REAL `git push`** with an orphan → `REJECT(W-2)`.
- **The container test:** `jarvis-upper-ct` on `omp-ct:master`, `.trident/ct/ct-results.json` —
  11 scenarios PASS. The prior session's residual "no container test exists" is CLOSED.
- **The audit artifact:** `.trident/wave-audit/ORCHESTRATOR-AUDIT.md`.

### THE HONEST REMAINDER
- **THE AUDIT GATE:** the ocr re-run is in flight; the verdict lands in `TESTING_LOG.md`. A
  degraded run is BLOCKED, never PASS.
- **W-1** stays correctly scoped off (no dist step in this repo) — the CLAIM is fixed, not the code.
- **4 W3 findings deferred** (the reachability worktree-vs-pushed-tree nuance, the stub body parser,
  the brace-count approximation) — recorded in `.trident/wave-audit/W3-desk.md`.
- **F2 (CODEOWNERS single owner)** deferred to the operator (no second handle exists).

## [2026-09-23T04:42:29Z] — THE ROUND-4/5 OCR CAMPAIGN UPDATE (HEAD `e3bd0e1`)

**THE CURRENT HEAD:** `e3bd0e12a14e268c76679063570c545bf9cb707f` (branch `feat/github-master-kernel`).
**THE STATE:** tsc exit 0 · battery **85 pass / 0 fail** · P5 corpus 13/0 · tree clean
(excl. the live `runtime/watchdog-ledger.jsonl`).

**WHAT THIS CAMPAIGN CLOSED (the round-4/5 scans, the deep surface the earlier rounds missed):**
- **3 CRITICAL** — (1) `src/runtime.ts` `defaultRails` fetched `after=0` every tick, so with
  the 64 KB cap the daemon silently stopped processing live events (pinned by
  `tests/probe/cursor_probe.test.ts`); (2) `scripts/spec-diff.ts` resolved the spec ONE LEVEL
  ABOVE the repo, so the REQUIRED `gates/spec-gate` always exited 2 (UNMEASURED) — the mission
  spec is now vendored in-repo (`packages/jarvis-upper-tier/`, sha256 55aebe6f3c54db5f) and the
  gates measure (spec-diff exit 1, shape_freeze exit 0); (3) `src/guardrail.ts` STALE-GATE
  compared a SPEC invariant hash against a git sha (cross-domain → always stale) — a real
  `gate_pass.head_sha` column now carries the commit.
- **~20 HIGH** across `src/` — exception safety, null derefs, path containment, ambiguous
  hashing, COALESCE data loss, concurrent ticks, O(n²) rotation, missing FKs, tick-interval
  validation, `fileURLToPath`. Each at the INVARIANT, each pinned.
- **2 REFUTED** (with their measurements): `Bun.spawnSync().stdout` IS a Buffer (decodes UTF-8);
  the `attribute.ts` `.catch` uses a literal, not an out-of-scope `code` (tsc exits 0).

**THE RESIDUAL (named):** the LOCAL `gate_pass` mirror is now WIRED (synced from the
authoritative `guardrailRemote` read each tick — pinned by `tests/gate_pass_mirror.test.ts`);
the remaining scanner highs are adjudicated in `.trident/OCR_ADJUDICATION.md`. The ocr gate's
CONFIRMED critical/high count is ZERO; the raw scanner count mixes real defects with refuted
false positives (the convergence table is in the adjudication record).

**THE EVIDENCE:** `.trident/ocr-src-round4.json` … `round9.json`, `.trident/ocr-rest-round4.json`,
`.trident/OCR_ADJUDICATION.md`. The pins: `tests/probe/cursor_probe.test.ts`,
`tests/dossier_traversal.test.ts`, `tests/desks_traversal.test.ts`, `tests/gate_pass_mirror.test.ts`.


## [2026-09-23T08:04:36Z] — THE INDEPENDENT-REVIEW ADDENDUM (HEAD `d4f7669`)

**THE CURRENT HEAD:** `d4f76696bc619a35624a0c86a7f596f3aea689a0`. **THE STATE:** tsc exit 0 · battery **94 pass / 0 fail** ·
P5 corpus 13/0 · W-13 silent-fallback 0 hits.

**THE INDEPENDENT REVIEW (the goal's proof contract).** Both ocr lanes were quota-capped
(`poolside-laguna-s` 429; `openrouter-laguna-s-free` daily cap), so **muse** (Meta Model
API — a SEPARATE quota) served as the zero-context reviewer via
`muse exec --json --reasoning-effort xhigh`. It read 12 kernel files COLD and returned
**0 critical / 3 high**, all in code this campaign had touched — findings the ocr scanner
did NOT produce:

1. **`src/runtime.ts`** — `defaultRails` swallowed a fetch/parse/reduce failure into a
   `{frames:0}` SUCCESS, so a DEAD endpoint read as an IDLE stream; the tick's error branch
   fired only on tick 1. `RailCapture.failed?` now carries the reason and the tick reports
   `rail-failed:<reason>` EVERY tick.
2. **`src/guardrail.ts`** — STALE-GATE required a NON-NULL row `head_sha`, so a NULL row
   authorized ANY future head (fail-OPEN against the file's own "blocking is the safe
   default"). An unknown-commit gate is now STALE.
3. **`src/reducers.ts`** — an out-of-vocabulary `pr_node.state` THREW inside `rail.attach`
   (the cursor never advanced) and finding 1 swallowed it to a 0-frames success — ONE
   malformed event became head-of-line blocking behind a green status. An unknown state now
   returns "cursor-only" (not applied; the cursor advances).
4. **`src/desks.ts` waveB** — its fixture row carried NULL `head_sha`; under finding 2 it
   would read STALE, so it now writes the revision it passed against.

PINNED: `tests/muse_review_pins.test.ts` (4 cases). THE SHAPE: all three convert a FAILURE
into a SUCCESS (a swallow, a fail-open guard, a malformed event read as idle). The remedy is
uniform: the failure travels NAMED and the guard fails CLOSED.

**THE AUDIT GATE: PASS (0 critical, 0 high)** — the scoped ocr coverage (src · scripts/gates
· .github · .githooks) plus this independent review.

## [2026-09-23T14:31:15Z] — THE SYSTEM RUNTIME AUDIT (HEAD `967a082`)

**THE CURRENT HEAD:** `967a082fdad24d284519c3a0663ff08b375305f0`. **THE STATE:** tsc exit 0 · `bun test` **122 pass / 0 fail**
(the SOURCE — the tests import ../src/) · the P5 corpus 13/0 (the DEPLOYED hooks) · the CI
**6/6 GREEN** on `4636710`.

**THE SEVEN SYSTEM DEFECTS (found by a REAL push, the real GitHub API, the live daemon —
invisible to source-only verification):**
1. `src/main.ts` NEVER passed `publishOpts` — the production daemon could never POST the
   `factory/*` contexts. WIRED; the boot line names `publisher: ARMED|DISARMED`.
2. `.githooks/pre-push` used `git grep --include=` (an UNKNOWN OPTION in git 2.43) →
   REFS=0 for every module → EVERY push rejected since 2026-09-20. A pathspec fixes it.
3. `scan-phantom.sh` had no word boundary ("overwrote" matched "wrote") + a gitignored
   path is not a phantom.
4. The CI's fence-provisioning step created an EMPTY ledger, converting a PASS (absent) into
   a FAIL (empty) — a self-defeating gate. Deleted.
5. `tests/docs_current.test.ts` asserted `Checkpoints/` exists (a host artifact-class check);
   it now SKIPS where absent.
6. The diff-budget counted the 646-file snapshot diff → the generated records are exempt.
7. `spec-diff.ts` matched items against paths only → a content fallback.

**THE PROOF (the merge gate, end to end):** a real merge attempt → **405 "Repository rule
violations found: 2 of 8 required status checks have not succeeded: 1 errored and 1
failing"**. The gate FAILS CLOSED. The kernel's purpose is mechanically demonstrated.

**THE BLOCKED:** the AO daemon on `:3001` is absent on this host → `daemonOk:false`,
`prNodes:0`. RESUME: install/start the AO daemon, or set `AO_DAEMON` to a reachable instance.
