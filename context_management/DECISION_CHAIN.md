# DECISION CHAIN — jarvis-upper (W4)

The operator's **full verbatim ruling set (all 10)** + the **rejected
alternatives** with the reason each was killed AND its consequence. If a task
conflicts with a ruling here, STOP and escalate. SHAs/paths quoted verbatim.

---

## 1. THE FULL VERBATIM RULING SET (all 10)

### D-001 — report discipline
> "I NEVER WANT TO SEE ANOTHER BULLSHIT SLOP REPORT AGAIN."

Binding: all reports must be dense, evidence-grounded, no filler (density floor
≥200 lines for canon docs). Catches theater, padding, and prose claims.

### D-002 — verification priority
> "Never once asked does anything run? — THIS IS THE ONLY THING THAT MATTERS."

Binding: `bash gates/does_anything_run.sh:1-49` → `VERDICT:RUNS (fail=0)` is
mandatory on every claim of completion.

### D-003 — forbidden evidence
> "this is all theatrical bullshit. explicitly forbid this as a verification
> gate. this is NOT tangible verification evidence."
> (about commit-exists / diff-changed / tests-pass / PR-open)

Binding: citing commit-exists, diff-changed, tests-pass, or PR-open as
verification is EXPLICITLY FORBIDDEN.

### D-004 — two-source law
> "THIS IS THE ONLY ACCEPTED VERIFICATION EVIDENCE. BOTH OF THESE. IF BOTH OF
> THESE DO NOT UNCONDITIONALLY PASS = REJECT. BOOLEAN FALSE."
> (about fence2 + AO review)

Binding: VERIFIED iff fence2 adjudicate exit 0 AND AO review approves the SAME
head sha. One alone = Boolean FALSE = REJECT.

### D-005 — AO review config
> "review harness should be muse code, auto review should be true. fix this as
> default settings."

Binding: AO review defaults: `autoReview: true`, `reviewers: [{"harness":"muse"}]`.
AO REJECTS `omp` harness (`INVALID_PROJECT_CONFIG`).

### D-006 — battery discipline
> "test needs to enforce by default."

Binding: `bun test` must pass on every commit
(`52 pass / 0 fail / 183 expects / 16 files`). Gates enforce this.

### D-007 — worker profile pin
> "worker profile needs the direct poolside api wired as the default model +
> the task agent's pinned default"

Binding: `jarvis-worker` profile: `default`/`task` =
`poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT, not OpenRouter).
File: `~/.omp/profiles/jarvis-worker/agent/config.yml`.

### D-008 — worker vs main
> "the default model for the jarvis workers needs to be set to muse spark 1.3
> contributor on opencode go. NOT conflicting with my main omp having deepseek
> pinned."

Binding: `sonic`/`reviewer`/`plan`/`slow` =
`opencode-zen-free/muse-spark-1.3-contributor-free:xhigh`; `smol`/`scout` =
`openrouter/nvidia/nemotron-3.5-lightning:free`. The GLOBAL
`~/.omp/agent/config.yml` keeps `default: verboo/deepseek-v4.1-flash:max`
(operator's main omp, deliberately NOT a worker).

### D-009 — AO expectation
> "AO should have built in gates for this already."

Binding: AO was expected to enforce gates natively; in practice the gates live
in `gates/` + JFM. The expectation stands: do not ship without gates green.

### D-010 — credential discipline
> (operator stance, paraphrased from the PAT incindent) "Never record
> credential material; rotate burned PATs."

Binding: docs MUST NOT record credential material; operator must rotate the
burned PAT (EN-020).

> Note: D-006 and D-010(verbatim) overlap with the "test enforces by default"
> theme. Both are binding. A task that weakens tests or records credentials =
> REJECT.

## 2. THE DECISION FLOW (how a ruling was reached)

```
Operator observes claim of completion
        ↓
D-003 fires: commit/diffs/tests/PR as proof → REJECT (theatrical)
        ↓
D-004 fires: two-source required → D-002 does_anything_run + fence2 + AO review
        ↓
D-005 fires: review harness must be muse (AO rejects omp)
        ↓
D-006 fires: battery enforces by default (bun test)
        ↓
D-007 fires: worker pin = poolside direct
        ↓
D-008 fires: worker muse-spark on zen-free; main omp = deepseek
        ↓
VERIFIED only if fence2 exit 0 AND AO review approves same sha
```

## 3. REJECTED ALTERNATIVES — WITH REASON + CONSEQUENCE

| # | What was rejected | Reason killed | Consequence if it had shipped | Law |
|---|-------------------|---------------|-------------------------------|-----|
| A-001 | Citing commit-exists as verification | D-003: "theatrical bullshit. explicitly forbid this as a verification gate. this is NOT tangible verification evidence." | False completion claims; a commit can exist with zero running code | D-003 |
| A-002 | Citing diff-changed as verification | D-003: same forbiddance | Lines changed ≠ code runs; theater | D-003 |
| A-003 | Citing tests-pass as verification | D-003: "this is NOT tangible verification evidence." | Green fixtures on a non-running system | D-003 |
| A-004 | Citing PR-open as verification | D-003: forbidden | A PR can be open against a broken build | D-003 |
| A-005 | Single-source verdict (fence2 only) | D-004: "BOTH OF THESE ... = REJECT. BOOLEAN FALSE." | Unreviewed mechanical pass = theater | D-004 |
| A-006 | Single-source verdict (review only) | D-004: "BOTH OF THESE ... = REJECT. BOOLEAN FALSE." | Non-hermetic human review = theater | D-004 |
| A-007 | AO `omp` as a reviewer harness | AO returns `INVALID_PROJECT_CONFIG: unknown harness "omp"`; reviewer-capable = muse/aider/cursor/codex | Broken AO config; no review runs | D-005 |
| A-008 | Desk-local model pin | EN-019 proved invisible to AO spawns; AO spawn carries `OMP_PROFILE=jarvis-worker`, does not read desk config | Workers run the wrong model silently | D-008 |
| A-009 | Forking the JAM desk core into JFM | Would fork `Shared_Workspace/JARVIS/src/desk-orchestrator.ts:1-1080` | Drift; two trackers out of sync | L7 |
| A-010 | Auto-merge path | D-004 forbids non-two-source completion | Merge without both gates = theater | D-004 |
| A-011 | A second tracker (besides JAM tracker) | Operator: "one tracker law" — rejected a second tracker | Conflicting state; operators can't trust either tracker | (operator) |
| A-012 | Recording the burned PAT material in a doc | Forbidden credential material; D-010 | Credential leak | D-010 |
| A-013 | A non-hermetic fence2 | fence2 runs under `bwrap --unshare-all` (no network) BY DESIGN — reverting breaks the two-source law's hermetic half | Non-reproducible verdicts; network flakes | D-004 |
| A-014 | Global omp deepseek used as worker default | D-008: workers must NOT use the operator's main omp; that is for interactive coding, not factory workers | Workers burn operator quota / wrong tier | D-008 |

## 4. BINDING LAWS DERIVED FROM RULINGS

- **L1 two-source verdict** (D-004): VERIFIED iff fence2 adjudicate exit 0 AND AO
  review approves the same head sha `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`.
- **L2 does-anything-run** (D-002): `bash gates/does_anything_run.sh .` →
  `VERDICT:RUNS (fail=0)` on every claim.
- **L3 no forbidden evidence** (D-003): commit-exists / diff-changed /
  tests-pass / PR-open are NOT verification.
- **L4 review harness = muse** (D-005): AO reviewers = `[{"harness":"muse"}]`,
  autoReview = true. AO rejects `omp`.
- **L5 battery by default** (D-006): `bun test` must stay green
  (`52 pass / 0 fail / 183 expects / 16 files`); `two_source_verdict` → 8 pass;
  `jfm_verbs` → 8 pass.
- **L6 worker profile pin** (D-007, D-008): `jarvis-worker` is the only spawn
  profile; default/task = `poolside/poolside/laguna-s-2.1:high`.
- **L7 import-don't-fork** (operator): JAM desk core
  (`desk-orchestrator.ts:1-1080`) + fence2 (`fence2.py:1-966`) are IMPORTED,
  never forked.
- **L8 one-pin law** (D-008): AO spawns carry `OMP_PROFILE=jarvis-worker`
  (env on jarvis-upper, jarvis_orchestrator, scratch, jfm-e2e).
- **L9 PAT law** (D-010): Never record credentials; rotate burned PATs (EN-020).
- **L10 fence sandbox law** (design): fence2 runs under `bwrap --unshare-all`
  (no network); DB_1 hermetic step runs offline.
- **L11 one-tracker law** (operator): One JAM tracker (`jfm/src/desk.ts:1-78`);
  rejected A-011.

## 5. THE FROZEN DECISION ARTIFACTS

| Artifact | Path | Lines (measured) | Used by ruling |
|----------|------|-------------------|----------------|
| `src/verdict.ts` | `jarvis-upper/src/verdict.ts` | 184 | D-004 (two-source law impl) |
| `gates/does_anything_run.sh` | `jarvis-upper/gates/does_anything_run.sh` | 49 | D-002 |
| `gates/shape_freeze.sh` | `jarvis-upper/gates/shape_freeze.sh` | 50 | D-002 (shape) |
| `gates/orphan_scan.sh` | `jarvis-upper/gates/orphan_scan.sh` | 35 | D-002 (orphan) |
| `src/runtime.ts` | `jarvis-upper/src/runtime.ts` | 150 | D-002 (does anything run) |
| `src/status.ts` | `jarvis-upper/src/status.ts` | 48 | D-002 |
| `src/main.ts` | `jarvis-upper/src/main.ts` | 19 | entry |
| `ao-client/client.ts` | `jarvis-upper/ao-client/client.ts` | 75 | AO transport |
| `ao-client/rail.ts` | `jarvis-upper/ao-client/rail.ts` | 113 | AO API rail |
| `ao-client/gen/routes.ts` | `jarvis-upper/ao-client/gen/routes.ts` | 173 | AO route surface |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | — | D-007, D-008 |
| Global omp config | `~/.omp/agent/config.yml` | — | D-008 |
| AO review config | `jarvis-upper/.omp/config.yml` | — | D-005 |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` | 966 | D-004 (hermetic half) |
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | 1080 | L7 (import law) |
| Blueprint | `reports/JFM_Blueprint_v1.md` | 395 | reference |
| verdicts.jsonl | `Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl` | append-only | D-004 |
| two_source_verdict test | `tests/two_source_verdict.test.ts` | 111 | D-004 / D-006 |

## 6. HOW A NEW TASK MUST CHECK OUT

Before starting any task, the agent MUST:

1. Read this doc (§1–§4) — the rulings and rejected alternatives.
2. Read EVIDENCE_STATE.md — reproduce the tokens.
3. Read TASK_QUEUE.md — see what is PASS / OPEN / BLOCKED.
4. Read COMPACTION_SURVIVAL.md — the resume recipe.
5. Confirm it is not re-attempting A-001..A-014.

If a task would re-attempt a rejected alternative, the agent MUST STOP and
escalate to the operator. The rulings are non-negotiable.

## 7. THE PAT INCIDENT (recorded, no material)

A PAT was burned this session (W3) because it was embedded in a git remote URL
and printed. The operator MUST rotate it (D-010). This doc (and all canon docs)
MUST NOT record the credential material. The doc set has already grep-verified
empty for credential material (`grep -RI "ghp_" context_management/` → empty).

## 8. THE FROZEN SHA TABLE (quote verbatim)

| Name | SHA | Context |
|------|-----|---------|
| PR #1 commit 1 | `760ad1b` | `ao/jarhus-upper-2/root` (W1) |
| PR #1 commit 2 | `732083e` | `ao/jarhus-upper-2/root` (W2) |
| PR #1 commit 3 | `adbdacf` | `ao/jarhus-upper-2/root` (W3) |
| PR #1 head (current, W4) | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | the two-source verdict key |
| jfm-e2e PR #1 commit | `cce7bdb` | merged proof |

End of DECISION_CHAIN.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
- **VERDICT: VERIFIED** — fence PASS `spec_bound:true` + review `approved`, SAME sha
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green · jfm 8/0
- **jfm wave w0:** the desk `upper-tier-job` closed, `unverdicted: []`

## [2026-09-22T21:20:02Z] — RULING: W-1 stays SCOPED; the CLAIM gets fixed (not the code)
- THE QUESTION: the zero-trust audit flagged W-1 as "scoped off but sold as PROVEN" (A1).
- THE EVIDENCE: `.githooks/pre-commit:70-88` carries a DELIBERATE, documented scope: the predicate
  was derived from the GI kernel (`src/ -> extensions/<plugin>/index.js`); a repo with no
  `extensions/` dir has no dist step, so the gate can never pass and would refuse every src/
  commit forever — "a gate that gets bypassed, worse than no gate". It fires only when
  `[ -d extensions ]`.
- THE RULING: KEEP the gate as scoped. The code is CORRECT — it is a valid deploy-freshness gate in
  a repo that has a dist step, and a no-op otherwise. The DEFECT is the CLAIM: the P5 sweep's table
  listed it among "8 gates, both halves", but it cannot be exercised here.
- THE FIX (a DOC fix, W5): every doc must say **7 gates proven + 1 correctly scoped-off
  (untestable here)** — never "8 gates both halves".
- COST IF WRONG: a reader believes W-1 was runtime-proven; it was not. Low severity, real.

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

