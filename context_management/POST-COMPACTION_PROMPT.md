# POST-COMPACTION PROMPT — jarvis-upper (W4)

This file is the **single entry point** for an agent taking over the jarvis-upper
project. Read it first, then follow the reading order below. Everything it claims
is backed by the canon docs in this same folder (CURRENT_STATE, BUILD_STATE, etc.).

---

## 1. MISSION (single sentence)

Ship the AO factory + upper-tier control plane as a **host-live, fence-gated**
system where AO (`http://localhost:3001`) spawns Poolside-Direct workers on
`jarvis-upper` and `jfm-e2e`, commits through JFM, and earns completion ONLY
from a **two-source verdict** (fence2 adjudication exit 0 AND an AO review run
approving the same head sha). No prose claims without both gates green.

## 2. WHAT "DONE" MEANS (literal)

For any job `J` on head sha `H`:

| # | Condition | Where | Evidence token |
|---|-----------|-------|----------------|
| 1 | fence2 adjudicate exits 0 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py adjudicate <job> --expect-spec-sha <H>` | `VERDICT:PASS` in `.../b6/verdicts.jsonl` |
| 2 | AO review run approves the SAME `H` | AO dashboard "Reviews" tab on repo `jarvis-upper` | `approved_sha == H` in the run record |
| 3 | Battery still green | `bun test` in jarvis-upper root | `52 pass / 0 fail / 183 expects / 16 files` |
| 4 | Typecheck clean | `bunx tsc --noEmit` | exit 0 |
| 5 | Runtime alive | `UPPER_TICK_MS=3000 bun src/main.ts` + `bun src/cli.ts status` | `RUNNING (tick >3000)` |

**Both** (1) and (2) must be true — the two-source law (D-004). One alone is
theatrical and equals Boolean FALSE.

## 3. PROJECT LAYOUT (anchor map)

| Path | Role | Lines (measured at W4) |
|------|------|------------------------|
| `jarvis-upper/` | Project root — its OWN git repo, branch `main`, remote `https://github.com/leviathan-devops/jarvis-upper.git` (private) | — |
| `src/main.ts` | Runtime entry point | 19 |
| `src/runtime.ts` | Tick loop / supervisor | 150 |
| `src/status.ts` | Status publisher | 48 |
| `src/verdict.ts` | `verify({jobDir, headSha, sessionId})` — the two-source gate | 184 |
| `src/sync.ts` | Sync path (STUB — EN-010) | — |
| `ao-client/client.ts` | AO transport client | 75 |
| `ao-client/rail.ts` | AO API rail | 113 |
| `ao-client/gen.ts` | AO codegen driver | 39 |
| `ao-client/gen/routes.ts` | AO route surface (144 paths) | 173 |
| `gates/does_anything_run.sh` | Gate 1 (D-002) | 49 |
| `gates/shape_freeze.sh` | Gate 2 | 50 |
| `gates/orphan_scan.sh` | Gate 3 | 35 |
| `scripts/spec-audit.ts` | Spec-audit gate | 86 |
| `tests/` | 16 test files | 16 files |
| `runtime/status.json` | status | 13 |
| `runtime/ticks.log` | tick log | 5005 |
| `runtime/wire_capture.json` | frozen frame | 7 (parsedFrames=168, bytes=65638) |
| `jfm/ (/home/leviathan/JARVIS_WORKSPACE/jfm/)` | JFM repo — its OWN git repo, branch main, symlinked `~/.local/bin/jfm` | — |
| `jfm/src/cli.ts` | JFM CLI (10 verbs) | 155 |
| `jfm/src/ao-transport.ts` | 10-verb seam | 133 |
| `jfm/src/pin.ts` | pins AO jobs to head sha | 55 |
| `jfm/src/desk.ts` | JAM tracker + 5 AO columns | 78 |
| `jfm/src/watch-ao.ts` | INST-1/2/4 SSE watcher | 84 |
| `jfm/src/gate.ts` | gates dispatch results | 7 |
| `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | JAM desk core (IMPORTED into JFM, never forked) | 1080 |
| `Shared_Workspace/JARVIS-CORE/b6/fence2.py` | fence2 (IMPORTED, never forked) | 966 |
| `Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl` | fence2 append-only ledger | — |
| `reports/JFM_Blueprint_v1.md` | Blueprint of record | 395 |
| `~/.omp/profiles/jarvis-worker/agent/config.yml` | Pinned worker profile | — |
| `~/.omp/agent/config.yml` | Operator's main omp (deepseek, NOT a worker) | — |

## 4. READING ORDER (strict)

1. **THIS FILE** — mission + resume commands.
2. **BUILD_STATE.md** — the SHA chain, module inventory, line counts, immutable list.
3. **EVIDENCE_STATE.md** — copy-paste the exact tokens that are TRUE right now.
4. **TASK_QUEUE.md** — which gates are PASS / OPEN / BLOCKED + risk register.
5. **CURRENT_STATE.md** — per-module status (what runs, what does not).
6. **DECISION_CHAIN.md** — the operator's binding rulings (read before changing anything).
7. **COMPACTION_SURVIVAL.md** — resume recipe + binding laws.
8. **RUNNING_BUILD_LOG.md** — W0..W4 receipts (append-only).
9. **RUNNING_DEBUG_LOG.md** — EN-001..EN-010 (append-only).
10. **NEXT_STEPS.md** — queued work + dependency-ordered work queue.
11. **CHANGELOG.md** — append-only history of this build era.

## 5. VERIFIED STATE (as of W4)

| System | Status | Proof |
|--------|--------|-------|
| AO daemon | 200 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` → `200` |
| AO introspection | 144 paths / 164 ops / 269 schemas | introspection |
| Battery | 52 pass / 0 fail | `bun test` |
| Typecheck | exit 0 | `bunx tsc --noEmit` |
| Gate G1 does_anything_run | PASS | `VERDICT:RUNS (fail=0)` |
| Gate G2 shape_freeze | PASS | `SHAPES:all declared ids implemented` |
| Gate G3 orphan_scan | PASS | `ORPHANS=0` |
| fence2 (job upper-tier-dt-shapes) | PASS | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` |
| Runtime | RUNNING | `bun src/cli.ts status` → `RUNNING (tick >3000)` |
| two_source_verdict | 8 pass / 0 fail | `bun test -t two_source_verdict` |
| jfm_verbs | 8 pass / 0 fail | `bun test -t jfm_verbs` |
| PR #1 | OPEN | `ao/jarhus-upper-2/root` (760ad1b, 732083e, adbdacf) |
| jfm-e2e-1 | DONE | `https://github.com/leviathan-devops/jfm-e2e/pull/1` (cce7bdb, E2E-PROOF.txt=DT1-OK) |
| Worker profile | PINNED | `jarvis-worker` → poolside/poolside/laguna-s-2.1:high |
| AO review defaults | SET | `autoReview: true`, `reviewers: [{"harness":"muse"}]` |
| AO review approval of head sha | OPEN | G11 — not yet observed |
| `upper sync` | STUB | EN-010 (returns prNodes 0 while PR open) |

## 6. THE FROZEN HEAD SHA

```
adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

This is: PR #1 head; the sha fence2 adjudicated PASS for job `upper-tier-dt-shapes`;
the sha the AO review must approve (G11); the sha `verify({headSha})` in
`src/verdict.ts:1-184` keys off for VERIFIED. Any PR merge/rebase MOVES this sha —
requires re-running BOTH G10 and G11 on the new sha (D-004).

## 7. RESUME COMMANDS (paste-ready)

```bash
cd /home/leviathan/JARVIS_WORKSPACE/jarvis-upper

# 1. AO daemon (daemon resume recipe — X cookie rotates)
DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) \
  /usr/bin/agent-orchestrator

# If the daemon refuses (stale run file):
mv ~/.ao/running.json /tmp/running.json.stale
# then re-run the above.

# 2. Verify AO is up
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/healthz

# 3. Verify the runtime (upper-tier tick loop)
UPPER_TICK_MS=3000 bun src/main.ts      # in another pane
bun src/cli.ts status                  # expect RUNNING (tick >3000)

# 4. Run the three gates
bash gates/does_anything_run.sh .      # VERDICT:RUNS (fail=0)
bash gates/shape_freeze.sh .           # SHAPES:all declared ids implemented
bash gates/orphan_scan.sh .            # ORPHANS=0

# 5. Run the battery + typecheck
bunx tsc --noEmit                      # exit 0
bun test                               # 52 pass / 0 fail / 183 expects / 16 files

# 6. Two-source verdict law sanity
bun test -t two_source_verdict         # 8 pass / 0 fail

# 7. JFM sanity
jfm health                             # healthy
jfm status
bun test -t jfm_verbs                  # 8 pass / 0 fail

# 8. Two-source verdict on the frozen sha (manual)
/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py \
  adjudicate upper-tier-dt-shapes \
  --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
# expect VERDICT:PASS + 6954bafbd4918f75|sandbox=bwrap|spec_bound:true
```

## 8. THE THREE NON-NEGOTIABLE LAWS

1. **Two-source verdict law** — `verify({jobDir, headSha, sessionId})` in
   `src/verdict.ts:1-184` returns VERIFIED iff fence2 adjudicate exits 0 AND an
   AO review run approves the same head sha. `bun test -t two_source_verdict`
   → `8 pass / 0 fail`.
2. **Does-anything-run law** — `bash gates/does_anything_run.sh .` MUST return
   `VERDICT:RUNS (fail=0)` (`gates/does_anything_run.sh:1-49`). Citing
   commit-exists / diff-changed / tests-pass / PR-open as verification is
   **explicitly forbidden** (D-003).
3. **Worker-profile pin law** — every AO spawn carries `OMP_PROFILE=jarvis-worker`.
   The `jarvis-worker` profile has `default`/`task` = Poolside-Direct
   `poolside/poolside/laguna-s-2.1:high`; `sonic`/`reviewer`/`plan`/`slow` =
   `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh`;
   `smol`/`scout` = `openrouter/nvidia/nemotron-3.5-lightning:free`.
   The GLOBAL `~/.omp/agent/config.yml` keeps `default: verboo/deepseek-v4.1-flash:max`
   (the operator's main omp — deliberately NOT a worker).

## 9. WHAT TOUCH WHEN

| Task | Touchable files | NOT touchable |
|------|-----------------|---------------|
| Runtime bug | `src/runtime.ts:1-150`, `src/status.ts:1-48`, `src/main.ts:1-19`, `runtime/*` | `gates/` (only if law changes), JFM (separate repo) |
| Verdict gate | `src/verdict.ts:1-184` | `.../b6/fence2.py` (imported, never forked) |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | `~/.omp/agent/config.yml` |
| AO settings | project `.omp/config.yml` on jarvis-upper (autoReview, reviewers) | AO daemon config (`http://localhost:3001`) |
| Canon docs | `context_management/` ONLY | everything else |
| JFM | `/home/leviathan/JARVIS_WORKSPACE/jfm/` | JAM desk core (imported from `desk-orchestrator.ts:1-1080`) |

## 10. CONTACTS / PEERS

This session's agent id is **CanonDocs**. Other live peers are visible via
`hub op:"list"`. Primary peer: `Main` (the main orchestrator). If you need to
wake a parked peer, address it by its roster id — do NOT invent names.
Discovery rule: `hub op:"list"` shows live (running+idle) peers + counts; pass
`status:"parked"` to inspect parked history; message a known parked id to
revive it; `history://<id>` and `agent://<id>` stay readable.

## 11. FAILURE PROTOCOL

If a gate is RED:
1. Do NOT lower the bar. Do NOT cite forbidden evidence.
2. Read DECISION_CHAIN.md — the operator has already ruled on the shape of
   acceptable verification.
3. Fix the source. Re-run the SAME gate. Produce the token.
4. Record the token in EVIDENCE_STATE.md (append-only).
5. Only then proceed.

## 12. QUICK REFERENCE CARDS

### 12.1 Gate tokens (copy-paste into a report)

```
AO: 200
AO introspection: 144 paths / 164 ops / 269 schemas
G1: VERDICT:RUNS (fail=0)
G2: SHAPES:all declared ids implemented
G3: ORPHANS=0
G4: exit 0
G5: 52 pass / 0 fail / 183 expects / 16 files
G6: 8 pass / 0 fail
G7: 8 pass / 0 fail
G9: RUNNING (tick >3000)
G10: 6954bafbd4918f75|sandbox=bwrap|spec_bound:true
```

### 12.2 The forbidden evidence set (cite NEVER — D-003)

| Forbidden | Ruling |
|-----------|--------|
| commit-exists | D-003 |
| diff-changed | D-003 |
| tests-pass | D-003 |
| PR-open | D-003 |

### 12.3 Worker profile (verbatim)

```yaml
default: poolside/poolside/laguna-s-2.1:high
task: poolside/poolside/laguna-s-2.1:high
sonic: openrouter/.../muse-spark-1.3-contributor-free:xhigh
reviewer: openrouter/.../muse-spark-1.3-contributor-free:xhigh
plan: openrouter/.../muse-spark-1.3-contributor-free:xhigh
slow: openrouter/.../muse-spark-1.3-contributor-free:xhigh
smol: openrouter/nvidia/nemotron-3.5-lightning:free
scout: openrouter/nvidia/nemotron-3.5-lightning:free
```

### 12.4 The frozen SHA

```
adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

### 12.5 The two defects left OPEN

| Defect | Status | Action |
|--------|--------|--------|
| EN-010 `upper sync` STUB | OPEN | Next wave N2.1 |
| EN-020 PAT burned | OPEN (rotate) | Operator rotation |

End of post-compaction prompt.

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
