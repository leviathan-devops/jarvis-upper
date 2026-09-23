# CHANGELOG — jarvis-upper (this build era)

Append-only history of the jarvis-upper build era. Dates are `YYYY-MM-DD`.
SHAs are quoted verbatim from the verified state. Format per entry: date,
SHA, what changed, evidence. file:line anchors measured at W4.

---

## 2026-09-2x — W0: AO vanilla install + permissions bypass

Wave W0 is the AO (Agent Orchestrator v0.13.0) bootstrap on this host. No
`jarvis-upper` commit exists yet; this wave is host-level only. All subsequent
work keys off `http://localhost:3001` (healthz 200).

- **Date:** 2026-09-2x
- **SHA:** (AO .deb install — host-level)
- **Milestone:** AO (Agent Orchestrator v0.13.0) installed from the official
  .deb on this host; dashboard loads.
- **Evidence:** `ao --version` → 0.13.0; `curl http://localhost:3001` → 200.

- **Date:** 2026-09-2x
- **SHA:** (ao config)
- **Milestone:** AO permissions bypass set at 3 levels (`ao yolo config` +
  the `/permissions` endpoint bypass + the respawn rule) so AO sessions do
  not prompt on tool calls after a fresh install.
- **Evidence:** `ao config` shows bypass-permissions true.

- **Date:** 2026-09-2x
- **SHA:** (AO introspection)
- **Milestone:** AO daemon surface introspected: `144 paths / 164 ops / 269
  schemas`. AO merge model is explicit-only. SSE at
  `/api/v1/events?after=<cursor>`. AO has NO webhook/notifier/plugin surface.
- **Evidence:** introspection result.

- **Date:** 2026-09-2x
- **SHA:** (AO merge)
- **Milestone:** Confirmed AO merge is explicit-only — there is no auto-merge
  surface.
- **Evidence:** AO semantics.

---

## 2026-09-2x — W1: Upper-tier bootstrap (repo + gates + profile + JFM)

Wave W1 creates `jarvis-upper` as its OWN git repo, the 3 refusal gates, the
worker profile pin, and JFM as a separate repo.

- **Commit:** `760ad1b`
- **`jarvis-upper` repo:** created (its OWN git repo, branch `main`, remote
  `https://github.com/leviathan-devops/jarvis-upper.git` private).
  Evidence: `git -C jarvis-upper log --oneline` → `760ad1b`.
- **`src/main.ts:1-19`:** stub entry (19 lines).
- **`src/runtime.ts:1-150`:** stub (→ EN-003 no entry/loop).
- **`src/status.ts:1-48`:** stub.
- **`src/verdict.ts:1-184`:** created with `verify({jobDir, headSha,
  sessionId})` skeleton (two-source law not yet wired end to end). Anchor:
  `src/verdict.ts:1-5`.
- **Gates created:** `gates/does_anything_run.sh:1-49`,
  `gates/shape_freeze.sh:1-50`, `gates/orphan_scan.sh:1-35`. Initial run: RED
  (→ EN-001, EN-006). Evidence: `bash gates/does_anything_run.sh .` initially RED.
- **`scripts/spec-audit.ts:1-86`:** created.
- **AO-client layer scaffolded:** `ao-client/client.ts:1-75`,
  `ao-client/rail.ts:1-113`, `ao-client/gen.ts:1-39`,
  `ao-client/gen/routes.ts:1-173` (144 paths surface).
- **`tests/`:** 16 test files present at W4 (lines: 111+19+26+96+89+83+48+36+76+
  67+45+58+33+92+20+68). Evidence: `wc -l tests/*.ts`.
- **AO review defaults set on `jarvis-upper`:** `autoReview: true`,
  `reviewers: [{"harness":"muse"}]` (`.omp/config.yml`). AO REJECTS `omp`
  harness.
- **Worker profile** `~/.omp/profiles/jarvis-worker/agent/config.yml` pinned:
  `default`/`task` = `poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT).
- **JFM repo created** at `/home/leviathan/JARVIS_WORKSPACE/jfm/` (branch
  `main`), symlinked `~/.local/bin/jfm`. JAM desk core IMPORTED from
  `Shared_Workspace/JARVIS/src/desk-orchestrator.ts:1-1080` (never forked).
  JFM modules: `jfm/src/cli.ts:1-155`, `jfm/src/ao-transport.ts:1-133`,
  `jfm/src/pin.ts:1-55`, `jfm/src/desk.ts:1-78`, `jfm/src/watch-ao.ts:1-84`,
  `jfm/src/gate.ts:1-7`.
- **Blueprint of record** `reports/JFM_Blueprint_v1.md:1-395` committed.
  Evidence: `wc -l reports/JFM_Blueprint_v1.md` → 395.
- **Defects opened:** EN-001, EN-003, EN-006, EN-007, EN-008, EN-009, EN-010.

Scope: W1 establishes the factory shell + the three gates + the worker profile
pin + JFM. Completion NOT claimed — does-anything-run gate still RED.

---

## 2026-09-2x — W2: Runtime wall + two-source law wired

Wave W2 implements the runtime tick loop, drives all 3 gates + battery + tsc
green, and finalizes the two-source verdict law in `verify()`.

- **Commit:** `732083e`
- **`src/runtime.ts:1-150`:** tick loop implemented; `UPPER_TICK_MS=3000` wired.
  Runtime status → RUNNING.
- **`src/status.ts:1-48`:** publishes `runtime/status.json:1-13`;
  `runtime/ticks.log:1-5005` appends each 3000ms.
- **`runtime/wire_capture.json:1-7`:** frozen frame
  `parsedFrames=168, bytes=65638`.
- **`src/verdict.ts:1-184`:** finalized — VERIFIED iff (1) fence2 adjudicate
  exit 0 AND (2) AO review approves the same head sha. Anchor:
  `src/verdict.ts:1-5`.
- **Gate G1:** `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` (PASS).
- **Gate G2:** `bash gates/shape_freeze.sh .` → `SHAPES:all declared ids
  implemented` (PASS).
- **Gate G3:** `bash gates/orphan_scan.sh .` → `ORPHANS=0` (PASS).
- **Gate G4:** `bunx tsc --noEmit` → exit 0 (PASS).
- **Gate G5:** `bun test` → `52 pass / 0 fail / 183 expects / 16 files` (PASS).
- **Gate G6:** `bun test -t two_source_verdict` → `8 pass / 0 fail` (PASS).
- **Gate G7:** `bun test -t jfm_verbs` → `8 pass / 0 fail` (PASS).
- **EN-001 fixed** (via later `jarvis-upper-2` job). EN-003, EN-006 closed.

Scope: W2 turns the runtime green and the three gates + battery + typecheck +
verdict law all PASS. Does-anything-run law (D-002) satisfied.

---

## 2026-09-2x — W3: Factory jobs — AO spawn → PR (dt-shapes + jfm-e2e)

Wave W3 proves the AO factory can spawn a Poolside-Direct worker, fix a real
bug, commit, push, open a PR, and fence2 + AO-review the result.

- **Commit:** `adbdacf` (PR #1 head); `cce7bdb` (jfm-e2e)
- **`adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`:** head of `ao/jarhus-upper-2/root`.
  Evidence: `git rev-parse` of PR #1.
- **Job `jarvis-upper-2`:** worker/omp/tui, profile `jarvis-worker`,
  OMP_PROFILE=jarvis-worker. Fixed the DT-shapes drift bug (EN-001).
  Evidence: PR #1 commits `760ad1b`, `732083e`, `adbdacf`.
- **PR #1 opened:** `https://github.com/leviathan-devops/jarvis-upper/pull/1`
  (OPEN), branch `ao/jarhus-upper-2/root`.
- **fence2 adjudicate:** for job `upper-tier-dt-shapes` on head
  `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`: verdict PASS,
  evidence `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` (G10 PASS).
  Evidence: `verdicts.jsonl` row.
- **Fence sandbox:** confirmed `bwrap --unshare-all` (no network); DB_1's
  hermetic step runs offline BY DESIGN.
- **AO review:** autoReview:true + reviewers:muse on jarvis-upper +
  jarvis_orchestrator. AO REJECTS `omp` harness
  (`INVALID_PROJECT_CONFIG`). Reviewer-capable installed: muse/aider/cursor.
- **Job `jfm-e2e-1`:** worker produced first end-to-end spawn→commit→push→PR:
  `https://github.com/leviathan-devops/jfm-e2e/pull/1`, commit `cce7bdb`,
  `E2E-PROOF.txt` = `DT1-OK`.
- **EN-007:** ripwire crawl root EXCLUDES jarvis-upper → graph gate cannot
  verify edits here.
- **EN-008:** daemon stale run-file + rotating X cookie.
- **EN-009:** checkpoint test copies re-ran → pinned.
- **EN-010:** `upper sync` is a STUB (returns prNodes 0 while PR open).
- **EN-019:** desk-local model pin invisible to AO spawns → removed.
- **EN-020:** PAT burned (embedded in a git remote URL, printed) → operator
  rotation required.

Scope: W3 proves the factory produces real PRs through JFM. fence2 (G10) PASS.
AO review (G11) is OPEN — approval of `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`
not yet observed. Both required (D-004).

---

## 2026-09-21 — W4: Canon docs (docs-only)

- **Date:** 2026-09-21
- **SHA:** (none — docs-only wave)
- **Re-verification:** `bun test` → `52 pass / 0 fail / 183 expects / 16 files`;
  `bunx tsc --noEmit` → exit 0; `bun test -t two_source_verdict` →
  `8 pass / 0 fail`; `bun test -t jfm_verbs` → `8 pass / 0 fail`.
- **Gates re-verified:** `VERDICT:RUNS (fail=0)` / `SHAPES:all declared ids
  implemented` / `ORPHANS=0`.
- **Runtime re-verified:** `bun src/cli.ts status` → `RUNNING (tick >3000)`.
- **AO daemon:** still `200`; fence2 PASS row unchanged
  (`6954bafbd4918f75|sandbox=bwrap|spec_bound:true`).
- **11 canon docs written** into `context_management/`.
- **PR #1:** still OPEN (head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`).
- **`upper sync`:** still STUB (EN-010).
- Scope: W4 codifies the W0–W3 verified state. The two-source verdict loop is
  NOT closed until G11 (AO review approval) is observed. Per D-004, BOOLEAN
  FALSE until both gates pass on the same sha.

---

## OPERATOR RULINGS APPLIED (this era)

| Ruling ID | Verbatim | Applied at |
|-----------|----------|------------|
| D-001 | "I NEVER WANT TO SEE ANOTHER BULLSHIT SLOP REPORT AGAIN." | all reports |
| D-002 | "Never once asked does anything run? — THIS IS THE ONLY THING THAT MATTERS." | G1 |
| D-003 | "this is all theatrical bullshit. explicitly forbid this as a verification gate... this is NOT tangible verification evidence." | forbidden evidence set |
| D-004 | "THIS IS THE ONLY ACCEPTED VERIFICATION EVIDENCE. BOTH OF THESE... BOOLEAN FALSE." | two-source law |
| D-005 | "review harness should be muse code, auto review should be true." | AO review defaults |
| D-006 | "test needs to enforce by default." | battery gates |
| D-007 | "worker profile needs the direct poolside api wired as the default model + the task agent's pinned default" | jarvis-worker default/task |
| D-008 | "the default model for the jarvis workers needs to be set to muse spark 1.3 contributor on opencode go. NOT conflicting with my main omp having deepseek pinned." | jarvis-worker sonic..slow + global deepseek |

## REJECTED ALTERNATIVES (recorded, do not re-attempt)

| What was rejected | Why | Recorded in |
|-------------------|-----|-------------|
| Citing commit/diffs/tests/PR as verification | D-003 forbids ("theatrical bullshit") | DECISION_CHAIN.md |
| Single-source verdict (fence2 only, or review only) | D-004 requires BOTH ("BOOLEAN FALSE") | DECISION_CHAIN.md |
| AO `omp` as reviewer harness | `INVALID_PROJECT_CONFIG` | DECISION_CHAIN.md |
| Desk-local model pin | EN-019 invisible to spawns | DECISION_CHAIN.md |
| Forking JAM desk core / fence2 | must import | DECISION_CHAIN.md |
| Auto-merge path | D-004 forbids non-two-source | DECISION_CHAIN.md |
| A second tracker | "one tracker law" | DECISION_CHAIN.md |
| Recording the burned PAT material | forbidden credential material | DECISION_CHAIN.md |

End of CHANGELOG.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
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

