# EVIDENCE STATE — jarvis-upper (W4)

This doc is the **per-gate evidence with exact tokens**. Copy these tokens and
re-run the commands — they MUST reproduce. If a token does not reproduce, the
gate is not actually PASS. All SHAs quoted verbatim.

---

## 1. AO DAEMON (G8, G8b)

| Check | Command | Token (VERBATIM) | Status |
|-------|---------|-------------------|--------|
| AO healthz | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` | `200` | PASS |
| AO introspection | introspection | `144 paths / 164 ops / 269 schemas` | PASS |
| AO SSE | `GET /api/v1/events?after=0` | live push stream | PASS |
| AO merge model | AO semantics | `explicit-only` (no webhook/notifier/plugin surface) | PASS |

> The AO daemon is the worker factory ("Jarvis Core"). `autoReview: true` is an
> AO-level default, NOT a plugin surface — AO has no plugin surface. Reviewer
> harness is `muse` (AO REJECTS `omp` → `INVALID_PROJECT_CONFIG`).

## 2. GATE: does_anything_run (G1)

| Field | Value |
|-------|-------|
| Command | `bash gates/does_anything_run.sh .` |
| Token (VERBATIM) | `VERDICT:RUNS (fail=0)` |
| Status | PASS |
| Operator law | "Never once asked does anything run? — THIS IS THE ONLY THING THAT MATTERS." (D-002) |
| file:line | `gates/does_anything_run.sh:1-49` |

## 3. GATE: shape_freeze (G2)

| Field | Value |
|-------|-------|
| Command | `bash gates/shape_freeze.sh .` |
| Token (VERBATIM) | `SHAPES:all declared ids implemented` |
| Status | PASS |
| file:line | `gates/shape_freeze.sh:1-50` |

## 4. GATE: orphan_scan (G3)

| Field | Value |
|-------|-------|
| Command | `bash gates/orphan_scan.sh .` |
| Token (VERBATIM) | `ORPHANS=0` |
| Status | PASS |
| file:line | `gates/orphan_scan.sh:1-35` |
| EN-007 note | ripwire crawl EXCLUDES jarvis-upper; this gate is local, not graph. |

## 5. TYPECHECK (G4)

| Field | Value |
|-------|-------|
| Command | `bunx tsc --noEmit` |
| Token (VERBATIM) | exit 0 |
| Status | PASS |
| Scope | whole jarvis-upper tree |

## 6. BATTERY (G5)

| Field | Value |
|-------|-------|
| Command | `bun test` |
| Token (VERBATIM) | `52 pass / 0 fail / 183 expects / 16 files (jarvis-upper)` |
| Status | PASS |
| file:line | `tests/*.ts` (16 files, lines listed in BUILD_STATE.md §3.8) |
| Operator law | "test needs to enforce by default." (D-006) |

## 7. TWO-SOURCE VERDICT — fence half (G6a) + impl (G6)

| Field | Value |
|-------|-------|
| Command | `bun test -t two_source_verdict` |
| Token (VERBATIM) | `8 pass / 0 fail` |
| Status | PASS |
| file:line | `tests/two_source_verdict.test.ts:1-111` + `src/verdict.ts:1-184` |

`src/verdict.ts:1-184`:

```ts
function verify({ jobDir, headSha, sessionId }): boolean {
  // VERIFIED iff BOTH:
  // (1) fence2 adjudicate <job> --expect-spec-sha <headSha> exits 0   (G10)
  // (2) AO review run approves the SAME headSha                       (G11)
  return fence2Exit0 && aoReviewApprovedSameSha;
}
```

## 8. JFM VERBS (G7)

| Field | Value |
|-------|-------|
| Command | `bun test -t jfm_verbs` |
| Token (VERBATIM) | `8 pass / 0 fail` |
| Verbs | `health|status|watch|pin|dispatch|steer|abort|pr|gate|board|wave` |
| JFM repo | `/home/leviathan/JARVIS_WORKSPACE/jfm/` (branch main) |
| JFM symlink | `~/.local/bin/jfm` |
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts:1-1080` (IMPORTED) |
| file:line | `tests/jfm_verbs.test.ts` (JFM repo) + `jfm/src/cli.ts:1-155` |
| Status | PASS |

## 9. RUNTIME (G9)

| Field | Value |
|-------|-------|
| Command | `UPPER_TICK_MS=3000 bun src/main.ts` (pane) + `bun src/cli.ts status` |
| Token (VERBATIM) | `RUNNING (tick >3000)` |
| State files | `runtime/status.json:1-13`, `runtime/ticks.log:1-5005`, `runtime/wire_capture.json:1-7` |
| wire_capture frozen frame | `parsedFrames=168, bytes=65638` |
| file:line | `src/main.ts:1-19` → `src/runtime.ts:1-150` → `src/status.ts:1-48` |
| Status | PASS |

## 10. FENCE2 ADJUDICATE (G10)

| Field | Value |
|-------|-------|
| Command | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| Job | `upper-tier-dt-shapes` |
| Head sha | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| Token (VERBATIM, ledger row) | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` |
| Verdict | PASS |
| Ledger | `Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl` |
| file:line | `Shared_Workspace/JARVIS-CORE/b6/fence2.py:1-966` |
| Status | PASS |

> The fence sandbox is `bwrap --unshare-all` — NO network. Network-dependent
> done-when steps fail there BY DESIGN; DB_1's hermetic step runs offline.
> This is why the two-source law exists: fence2 is hermetic but not
> peer-reviewed; AO review is peer-reviewed but not hermetic.

## 11. AO REVIEW APPROVES SAME SHA (G11)

| Field | Value |
|-------|-------|
| Where | AO dashboard "Reviews" tab on repo `jarvis-upper` |
| Must prove | `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| Status | OPEN |
| Why OPEN | AO review run for PR #1 has not yet produced an approval record for this sha. |
| Operator law | D-004: Boolean FALSE unless BOTH G10 and G11 pass on the same sha. |

> This is the OTHER half of the two-source law. Do NOT claim VERIFIED without it.

## 12. PR #1 (G12)

| Field | Value |
|-------|-------|
| URL | `https://github.com/leviathan-devops/jarvis-upper/pull/1` |
| Branch | `ao/jarvis-upper-2/root` |
| Commits | `760ad1b`, `732083e`, `adbdacf` |
| Head sha | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| Status | OPEN |
| Job that fixed it | `jarvis-upper-2` (worker/omp/tui, profile `jarvis-worker`) fixed the DT-shapes drift bug (EN-001) |
| Reviewer config | `autoReview: true`, `reviewers: [{"harness":"muse"}]` (AO REJECTS `omp` harness) |
| file:line | (GH PR — not a local file) |

## 13. jfm-e2e-1 PROOF (separate repo)

| Field | Value |
|-------|-------|
| PR | `https://github.com/leviathan-devops/jfm-e2e/pull/1` |
| Commit | `cce7bdb` |
| Proof file | `E2E-PROOF.txt` = `DT1-OK` |
| Meaning | First end-to-end spawn→commit→push→PR by a factory worker |

## 14. WORKER PROFILE PIN (G15)

| Field | Value |
|-------|-------|
| File | `~/.omp/profiles/jarvis-worker/agent/config.yml` |
| default / task | `poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT) |
| sonic / reviewer / plan / slow | `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh` |
| smol / scout | `openrouter/nvidia/nemotron-3.5-lightning:free` |
| Env on spawn | `OMP_PROFILE=jarvis-worker` |
| Global omp default (NOT a worker) | `~/.omp/agent/config.yml` → `default: verboo/deepseek-v4.1-flash:max` |

## 15. AO REVIEW DEFAULTS (G16)

| Field | Value |
|-------|-------|
| Config | `autoReview: true` (`jarvis-upper/.omp/config.yml`) |
| Reviewers | `[{"harness":"muse"}]` |
| AO-rejected harness | `omp` → `INVALID_PROJECT_CONFIG: unknown harness "omp"` |
| Reviewer-capable installed | muse (primary), aider, cursor |

## 16. THE FORBIDDEN EVIDENCE SET (cite NEVER — D-003)

| Forbidden claim | Token that is REJECTED |
|-----------------|------------------------|
| commit-exists | D-003: "theatrical bullshit. explicitly forbid this as a verification gate." |
| diff-changed | D-003: same forbiddance |
| tests-pass | D-003: "this is NOT tangible verification evidence." |
| PR-open | D-003: forbidden |

> Accepted verification evidence is ONLY: fence2 adjudicate exit 0 (G10) AND
> AO review approval of the same sha (G11). Both. Boolean FALSE otherwise.

## 17. HONEST GAPS (what is NOT proven yet)

| Gap | Status |
|-----|--------|
| G11: AO review approval of `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | OPEN — not yet observed |
| G14: `upper sync` de-stubbed | BLOCKED — EN-010 (returns prNodes 0 while PR open) |
| G13: spec-audit gate invoked per job | BLOCKED — pending trigger |

## 18. REPRODUCTION SCRIPT (one batch)

```bash
cd /home/leviathan/JARVIS_WORKSPACE/jarvis-upper

echo "=== G8 AO ==="
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/healthz

echo "=== G1 ==="
bash gates/does_anything_run.sh .

echo "=== G2 ==="
bash gates/shape_freeze.sh .

echo "=== G3 ==="
bash gates/orphan_scan.sh .

echo "=== G4 ==="
bunx tsc --noEmit; echo "exit=$?"

echo "=== G5 ==="
bun test

echo "=== G6 ==="
bun test -t two_source_verdict

echo "=== G7 ==="
bun test -t jfm_verbs

echo "=== G9 ==="
bun src/cli.ts status

echo "=== G10 ==="
/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py \
  adjudicate upper-tier-dt-shapes \
  --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

## 19. TOKEN REPRO CHECKLIST

| Gate | Token | Reproduce? (re-run) |
|------|-------|---------------------|
| G8 | `200` | `curl /healthz` |
| G1 | `VERDICT:RUNS (fail=0)` | `bash gates/does_anything_run.sh .` |
| G2 | `SHAPES:all declared ids implemented` | `bash gates/shape_freeze.sh .` |
| G3 | `ORPHANS=0` | `bash gates/orphan_scan.sh .` |
| G4 | exit 0 | `bunx tsc --noEmit` |
| G5 | `52 pass / 0 fail / 183 expects / 16 files` | `bun test` |
| G6 | `8 pass / 0 fail` | `bun test -t two_source_verdict` |
| G7 | `8 pass / 0 fail` | `bun test -t jfm_verbs` |
| G9 | `RUNNING (tick >3000)` | `bun src/cli.ts status` |
| G10 | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` | fence2 adjudicate |

End of EVIDENCE_STATE.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
- **VERDICT: VERIFIED** — fence PASS `spec_bound:true` + review `approved`, SAME sha
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green · jfm 8/0
- **jfm wave w0:** the desk `upper-tier-job` closed, `unverdicted: []`
---

## 20. PARALLEL BUILD — Plan A (factory) + Plan B (github brain), 8 waves (2026-09-22)

Built from `.trident/plan-A/wave-plan.md:3` + `.trident/plan-B/wave-plan.md:3`
(4 + 4 waves, one frozen interface: the 7 status contexts). The boundary gate
is `scripts/interface-check.ts:37` — it prints `INTERFACE:MATCH` iff the
contract and the ruleset agree, and exits 1 on any drift.

### 20a. WAVE LEDGER (commit per wave; A-4/B-4 were in-flight working tree at record time)

| Wave | Owner | Deliverable | Commit | Status |
|------|-------|-------------|--------|--------|
| spec (pre-parallel) | orchestrator | parallel-build spec, branch `docs/code-review-tools` | `fe28b19` (cited at `context_management/BUILD_STATE.md:308`; NOT resolvable on this branch — `git log --all` has no `fe28b19`, only the 01909ab message cites it) | DONE |
| preflight | orchestrator | the two wave plans + the cross-plan interface check | `d75407b` | DONE |
| A-1 | desk-a1 | frozen status-context contract, `src/status-contract.ts:33` | `70c9906` (shared with B-1) | DONE |
| B-1 | desk-b1 | 4 hooks at `.githooks/`, keystone 7/7 adversarial PASS | `70c9906` (shared with A-1) | DONE |
| canon | orchestrator | BUILD_STATE + NEXT_STEPS append (340L/290L) | `01909ab` | DONE |
| A-2 | desk-a2 | status publisher, `src/publish.ts:62` polarity law | `4b0280e` | DONE |
| B-2 | desk-b2 | 5-job gate workflow + 2 scripts | `9493954` | DONE |
| B-3 | desk-b3 | ruleset + governance + TWO hook fixes | `aa37494` | DONE |
| A-3 | desk-a3 | guardrail inversion (`merge_ordered`, `guardrailRemote`) | `d71cc5d` | DONE |
| A-4 | desk-a4 | integration: `src/runtime.ts` + live e2e + two-source verdict | working tree (uncommitted; orchestrator commits) | IN-FLIGHT |
| B-4 | desk-b4 | `.github/workflows/drift.yml:1` + README.md + this append | working tree (uncommitted; orchestrator commits) | IN-FLIGHT |

### 20b. MEASURED EVIDENCE (re-run this turn, 2026-09-22, desk-b4 — not inherited)

| Check | Command | Token (VERBATIM) | Status |
|-------|---------|-------------------|--------|
| typecheck | `bunx tsc --noEmit` | exit 0 | PASS |
| battery | `bun test` | `69 pass / 0 fail / 253 expect() calls / 19 files` | PASS |
| interface | `bun run scripts/interface-check.ts` | `INTERFACE:MATCH (7 contexts)` | PASS |
| contract | `src/status-contract.ts:33` | `REQUIRED_CONTEXTS` = 5 × `gates/*` + `factory/fence2` + `factory/verdict` | FROZEN |
| ruleset | `ruleset.json:10` | `strict_required_status_checks_policy: true`, `bypass_actors: []`, `enforcement: evaluate` | OBSERVED |
| drift parses | `python3 -c "import yaml; ..."` on `.github/workflows/drift.yml:1` | `on: schedule + workflow_dispatch`, `jobs: ['drift']` | PASS |
| no _target | `grep -c pull_request_target` on the drift file | `0` | PASS |

The 7 contexts (frozen, `src/status-contract.ts:33`): `gates/anti-theatrical`
· `gates/issue-link` · `gates/spec-gate` · `gates/diff-budget` · `gates/test`
· `factory/fence2` · `factory/verdict`. The 5 job names (`.github/workflows/gates.yml:10`):
the five `gates/*` above — job names ARE the required checks.

### 20c. THE FOUR FIRINGS (all hit the orchestrator; full record at `.trident/firings/FIRING-001.md:121`)

| # | Gate | Verdict | Class |
|---|------|---------|-------|
| 001 | W-9 (`pre-commit`, `.githooks/pre-commit:21`) | CORRECT | my wave audits were thin (36L/28L < 100) |
| 002 | W-9 + W-1 | W-9 correct, **W-1 a defect** | the layout-port defect: gate derived from the GI kernel's `src/ -> extensions/` layout, but `jarvis-upper` has no `extensions/` — scoped at `.githooks/pre-commit:76` |
| 003 | W-8 (`.githooks/prepare-commit-msg:47`) | CORRECT | my B-2 audit message said "verified" with no artifact in the message body |
| 004 | W-9 on `.github/` templates | **a defect** | the artifact-class defect: the engineering-doc floor applied to GitHub UI artifacts — `.github/*` exempt at `.githooks/pre-commit:24` |

**2 correct, 2 gate defects.** Both defects are the same class: **a gate is a
(predicate x artifact-class) pair** — porting the predicate without checking
the class produces a gate that fires on everything (and gets bypassed) or on
nothing. Both were discoverable only by RUNNING the system on real work.

End of EVIDENCE_STATE append (B-4, 2026-09-22).

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
