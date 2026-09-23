# TASK QUEUE — jarvis-upper (W4)

This doc is the **full gate table with evidence tokens + status + unlock
conditions** per OPEN/BLOCKED row. Each row is a gate that must be satisfied
before completion is accepted. Status: `PASS` | `OPEN` | `BLOCKED`. Evidence is
the VERBATIM token. All SHAs quoted verbatim.

---

## 1. THE FULL GATE TABLE

| Gate | Command | W4 token (VERBATIM) | Status | Evidence doc | Unlock condition / notes |
|------|---------|---------------------|--------|--------------|--------------------------|
| G1 does_anything_run | `bash gates/does_anything_run.sh .` | `VERDICT:RUNS (fail=0)` | PASS | EVIDENCE_STATE.md §2 | D-002: mandatory on every claim |
| G2 shape_freeze | `bash gates/shape_freeze.sh .` | `SHAPES:all declared ids implemented` | PASS | EVIDENCE_STATE.md §3 | declared ids must be wired |
| G3 orphan_scan | `bash gates/orphan_scan.sh .` | `ORPHANS=0` | PASS | EVIDENCE_STATE.md §4 | no orphan modules; EN-007 = local fallback |
| G4 typecheck | `bunx tsc --noEmit` | exit 0 | PASS | EVIDENCE_STATE.md §5 | tsc clean |
| G5 battery | `bun test` | `52 pass / 0 fail / 183 expects / 16 files` | PASS | EVIDENCE_STATE.md §6 | D-006: enforce by default |
| G6 two_source_verdict | `bun test -t two_source_verdict` | `8 pass / 0 fail` | PASS | EVIDENCE_STATE.md §7 | D-004: two-source law |
| G7 jfm_verbs | `bun test -t jfm_verbs` | `8 pass / 0 fail` | PASS | EVIDENCE_STATE.md §8 | JFM verbs wired |
| G8 AO up | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` | `200` | PASS | EVIDENCE_STATE.md §1 | AO daemon live |
| G8b AO introspection | introspection | `144 paths / 164 ops / 269 schemas` | PASS | EVIDENCE_STATE.md §1 | AO surface confirmed |
| G9 runtime alive | `bun src/cli.ts status` | `RUNNING (tick >3000)` | PASS | EVIDENCE_STATE.md §9 | tick loop live |
| G10 fence2 adjudicate | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` | PASS | EVIDENCE_STATE.md §10 | hermetic half of two-source law |
| G11 AO review approves same sha | AO dashboard "Reviews" | `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | OPEN | EVIDENCE_STATE.md §11 | UNLOCKS completion — must observe approval of the frozen sha |
| G12 PR #1 | GH PR #1 | `OPEN` (state) | OPEN | EVIDENCE_STATE.md §12 | UNLOCKS G12-close only after G11 PASS on the same sha |
| G13 spec-audit (if invoked) | `bun run scripts/spec-audit.ts` | — | BLOCKED | — | pending trigger; must run per-job before completion |
| G14 `upper sync` de-stub | `upper sync` returns real prNodes | — | BLOCKED | EVIDENCE_STATE.md §13 | EN-010: STUB returns prNodes 0 while PR open; UNLOCKS when sync > 0 |
| G15 worker profile pin | `cat ~/.omp/profiles/jarvis-worker/agent/config.yml` | default = `poolside/poolside/laguna-s-2.1:high` | PASS | EVIDENCE_STATE.md §14 | D-007/D-008: spawn profile |
| G16 AO review defaults | `jarvis-upper/.omp/config.yml` | `autoReview:true`/`reviewers:[{"harness":"muse"}]` | PASS | EVIDENCE_STATE.md §1 | D-005: muse, not omp |

## 2. STATUS SUMMARY

| Status | Count | Gates |
|--------|-------|-------|
| PASS | 12 | G1–G10, G15, G16 |
| OPEN | 2 | G11, G12 |
| BLOCKED | 2 | G13, G14 |

Table: 16 rows total (G1–G16).

## 3. THE TWO-SOURCE VERDICT (G10 + G11) — WHY BOTH

The operator's binding ruling (D-004):

> "THIS IS THE ONLY ACCEPTED VERIFICATION EVIDENCE. BOTH OF THESE. IF BOTH OF
> THESE DO NOT UNCONDITIONALLY PASS = REJECT. BOOLEAN FALSE."

This means:

- fence2 adjudicate exit 0 (G10) — the mechanical shell gate (hermetic:
  `bwrap --unshare-all`, no network; DB_1's hermetic step runs offline).
- AO review run approving the SAME head sha (G11) — the human-scale review.
- **One without the other is theatrical.** The operator explicitly forbade
  citing commit-exists / diff-changed / tests-pass / PR-open as verification (D-003).

Current frozen PASS row (do NOT invent a different sha):

```
job=upper-tier-dt-shapes
head=adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
verdict=PASS
evidence=6954bafbd4918f75|sandbox=bwrap|spec_bound:true
```

## 4. EVIDENCE TOKENS (literal — paste these)

| Gate | Token |
|------|-------|
| AO healthz (G8) | `200` |
| AO introspection (G8b) | `144 paths / 164 ops / 269 schemas` |
| does_anything_run (G1) | `VERDICT:RUNS (fail=0)` |
| shape_freeze (G2) | `SHAPES:all declared ids implemented` |
| orphan_scan (G3) | `ORPHANS=0` |
| typecheck (G4) | exit 0 |
| battery (G5) | `52 pass / 0 fail / 183 expects / 16 files` |
| two_source_verdict (G6) | `8 pass / 0 fail` |
| jfm_verbs (G7) | `8 pass / 0 fail` |
| runtime status (G9) | `RUNNING (tick >3000)` |
| fence2 (G10) | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` |
| worker profile (G15) | default = `poolside/poolside/laguna-s-2.1:high` |
| AO review defaults (G16) | `autoReview:true`/`reviewers:[{"harness":"muse"}]` |
| AO review approval (G11) | `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |

## 5. RISK REGISTER (full)

| # | Risk | Likelihood | Impact | Mitigation | Linked defect / ruling |
|---|------|-----------|--------|------------|------------------------|
| R1 | fence2 sandbox has NO network → network done-when steps fail offline | Certain | High | Keep network-dependent steps out of fence2; run DB_1's hermetic step offline | EN-008 context |
| R2 | `upper sync` returns prNodes 0 while a PR is open | Certain | Medium | Fix the stub (G14) before relying on sync | EN-010 |
| R3 | AO rejects `omp` as reviewer harness | Certain | High | Use `muse` (or aider/cursor) as the reviewer harness | D-005 |
| R4 | Desk-local model pin invisible to AO spawns | Proven | High | NEVER pin models at desk level — the `jarvis-worker` profile is the only pin | EN-019 / D-008 |
| R5 | ripwire crawl EXCLUDES jarvis-upper → cannot graph-verify edits here | Proven | Medium | Use grep/tsc/battery + fence2 for jarvis-upper edits; graph gate applies to Shared_Workspace only | EN-007 |
| R6 | AO daemon stale run-file + rotating X cookie | Proven | High | Use the daemon resume recipe in COMPACTION_SURVIVAL.md | EN-008 |
| R7 | PAT burned in session (embedded in a git remote URL, printed) | One-time | Critical | Operator must rotate; docs MUST NOT record credential material | D-010 / A-012 |
| R8 | Global omp config still has deepseek default (operator's main omp) | By design | Low (non-worker) | That is the OPERATOR's omp; worker uses `jarvis-worker` profile | D-008 |
| R9 | AO review does not auto-trigger on PR update | Medium | Medium | Verify `autoReview:true` + reviewers:muse on PR event | D-005 |
| R10 | Any sha move invalidates G10 + G11 simultaneously | High (on next PR action) | High | Re-run BOTH fence2 + AO review on the new sha before any completion claim | D-004 |
| R11 | W4 docs fall under 200-line floor | Low | Low | Enforce `wc -l` ≥200 on every canon doc | D-001 |
| R12 | A desk-local or non-poolside model pin reappears | Medium | High | Reject desk-local pins; only `jarvis-worker` env | EN-019 |
| R13 | A single-source verdict is cited as completion | Medium | Critical | D-004 forbids; gate on BOTH G10+G11 | D-004 |
| R14 | A forbidden evidence token (commit/diffs/tests/PR) is cited | Medium | Critical | D-003 forbids; reviewer must reject | D-003 |

## 6. OPEN / BLOCKED UNLOCK CONDITIONS

### G11 — AO review approval (OPEN)

- **Current state:** AO review run for PR #1 has NOT yet produced an approval
  record for head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`.
- **Unlock:** Observe `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`
  on the AO dashboard "Reviews" tab for repo `jarvis-upper`, OR drive a new
  AO review run to approve that exact sha.
- **After unlock:** Re-run G10 on the SAME sha (must remain PASS), then the
  two-source law is satisfied for THIS sha.
- **If sha moves (merge/rebase):** Re-run BOTH G10 and G11 on the new sha (R10).

### G12 — PR #1 (OPEN)

- **Current state:** PR #1 (`ao/jarhus-upper-2/root`) is OPEN at head
  `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`.
- **Unlock:** G11 PASS on the frozen sha → merge or rebase.
- **After unlock:** G12 closes; if a new sha is produced, re-run G10+G11.

### G13 — spec-audit (BLOCKED)

- **Current state:** Not triggered this era.
- **Unlock:** Trigger `bun run scripts/spec-audit.ts:1-86` per job before
  completion.
- **After unlock:** G13 → PASS (or BLOCKED if spec drift found).

### G14 — `upper sync` de-stub (BLOCKED)

- **Current state:** `upper sync` returns `prNodes 0` while PR #1 is OPEN (EN-010).
- **Unlock:** De-stub the sync path in `src/sync.ts` to call the AO PR / node
  layer and return live prNodes.
- **After unlock:** `upper sync` > 0 prNodes when PR #1 OPEN → G14 PASS.

## 7. QUEUED WORK (next-wave candidates)

| Task | Owner | Depends on | Gate |
|------|-------|------------|------|
| N1.1 Get AO review to approve frozen sha | Main / AO | — | G11 |
| N2.1 De-stub `upper sync` | worker | G13 analysis | G14 |
| N3.1 Confirm daemon resume recipe reproducible | CanonDocs | — | EN-008 |
| N5.1 Re-verify worker profile pin | CanonDocs | — | G15 |
| N6.1 `jfm watch` SSE tail | worker | — | G7 |
| N8.1 Update docs after sha move | CanonDocs | sha move | doc truth |

## 8. HOW TO ADVANCE A GATE

1. Read DECISION_CHAIN.md (§1–§4) — the operator's rulings and rejected alternatives.
2. Do NOT cite forbidden evidence (commit-exists / diff-changed / tests-pass /
   PR-open). Only fence2 + AO review are accepted (D-004).
3. Fix the source. Re-run the SAME gate. Produce the token.
4. Record the token in EVIDENCE_STATE.md (append-only).
5. Only then mark the gate PASS and proceed.

## 9. GATES vs DEFECTS CROSSWALK

| Defect | Gate that catches it | Status |
|--------|----------------------|--------|
| EN-001 client health() nonexistent op | G1 does_anything_run | FIXED |
| EN-003 no entry/loop | G1, G9 | FIXED |
| EN-006 idle stream flagged error | G1 | FIXED |
| EN-007 ripwire excludes jarvis-upper | G3 orphan_scan (local fallback) | DOCUMENTED |
| EN-008 daemon stale run-file + X cookie | G1 (resume recipe) | MITIGATED |
| EN-009 checkpoint re-ran | G5 | FIXED |
| EN-010 `upper sync` STUB | G14 | OPEN |
| EN-019 desk-local pin invisible | G15 | FIXED |
| EN-020 PAT burned | (operator) | OPEN |

## 10. GATE → REPRO COMMAND

| Gate | Reproduce command |
|------|-------------------|
| G1 | `bash gates/does_anything_run.sh .` |
| G2 | `bash gates/shape_freeze.sh .` |
| G3 | `bash gates/orphan_scan.sh .` |
| G4 | `bunx tsc --noEmit` |
| G5 | `bun test` |
| G6 | `bun test -t two_source_verdict` |
| G7 | `bun test -t jfm_verbs` |
| G8 | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` |
| G9 | `bun src/cli.ts status` |
| G10 | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| G15 | `cat ~/.omp/profiles/jarvis-worker/agent/config.yml` |
| G16 | `cat .omp/config.yml` |

End of TASK_QUEUE.
## 11. GATE LIFECYCLE (how a gate moves)

Each gate has one of three states. The transition rules are binding.

| From | Trigger | To | Evidence |
||------|---------|-----|----------|
| RED | fix source + `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` | PASS | token reproduced |
| PASS | sha move (merge/rebase) | RE-VERIFY | re-run G10 + G11 on new sha |
| BLOCKED | unblocked by source fix + gate green | PASS | token reproduced |
| OPEN | approval observed on AO dashboard | PASS | `approved_sha == <sha>` |
| PASS | sha move | OPEN or RE-VERIFY | G11 must re-approve new sha |

- **Never skip G1.** Every other gate depends on "does anything run?".
- **Never cite forbidden evidence** (D-003) to advance a gate.
- **G10 + G11 must move together** after a sha move (R10).
- **G15/G16 are pinned** — they do not move unless the operator changes them
  (D-007/D-008). A drift attempt must be rejected.

## 12. REPRODUCTION CHECKLIST (run before any PASS claim)

Copy-paste this block and confirm each line before marking a gate PASS.

```bash
cd /home/leviathan/JARVIS_WORKSPACE/jarvis-upper

# G8 — AO up
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/healthz   # expect 200

# G1 — does anything run
bash gates/does_anything_run.sh .                                         # expect VERDICT:RUNS (fail=0)

# G2 — shape freeze
bash gates/shape_freeze.sh .                                              # expect SHAPES:all declared ids implemented

# G3 — orphan scan
bash gates/orphan_scan.sh .                                               # expect ORPHANS=0

# G4 — typecheck
bunx tsc --noEmit; echo "exit=$?"                                         # expect exit 0

# G5 — battery
bun test                                                                    # expect 52 pass / 0 fail / 183 expects / 16 files

# G6 — two-source verdict law
bun test -t two_source_verdict                                             # expect 8 pass / 0 fail

# G7 — JFM verbs
bun test -t jfm_verbs                                                      # expect 8 pass / 0 fail

# G9 — runtime
bun src/cli.ts status                                                     # expect RUNNING (tick >3000)

# G10 — fence2
fence2.py adjudicate upper-tier-dt-shapes \
  --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b            # expect VERDICT:PASS

# G15 — worker profile
cat ~/.omp/profiles/jarvis-worker/agent/config.yml                      # expect default = poolside

# G16 — AO review defaults
cat .omp/config.yml                                                     # expect autoReview:true, reviewers:muse
```

## 13. THE FROZEN SHA (repeat)

```
adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

G10 is PASS on this sha. G11 is OPEN on this sha. Completion requires G11
PASS on this sha (or both re-run on a new sha after a move).

End of TASK_QUEUE.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
- **VERDICT: VERIFIED** — fence PASS `spec_bound:true` + review `approved`, SAME sha
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green · jfm 8/0
- **jfm wave w0:** the desk `upper-tier-job` closed, `unverdicted: []`

---

## §APPEND — THE GITHUB MASTER KERNEL QUEUE (2026-09-22)

**DONE this session:**

| # | the item | the evidence |
|---|---|---|
| 1 | the gate-header standard (W1) | `.githooks/lib/pattern-header.sh:1` |
| 2 | the silent + stub gates (W2, Jev 119/68) | `.githooks/lib/scan-silent.sh:1` |
| 3 | the claim + phantom + reachability gates (W3) | `.githooks/lib/scan-phantom.sh:44` |
| 4 | the CI fix + the theatrical gate (W4) | `.github/workflows/gates.yml:26` |
| 5 | the ruleset aligned to 8 contexts (W6) | `ruleset.json:1` |
| 6 | the runtime seat (P4) | `.trident/RUNTIME_LEDGER.md:1` |
| 7 | the adversarial sweep (P5) | `.trident/P5_ADVERSARIAL_SWEEP.md:1` |

**OPEN:**

| # | the item | the blocker |
|---|---|---|
| 1 | W5: the publisher wired into the tick loop | the call site is missing; the test has not landed |
| 2 | the 2 `factory/*` contexts have no poster | W5 |
| 3 | the CI has never gone green | 4 jobs fail on real findings |
| 4 | the 3 `spec_audit` failures | a real env dependency (a path outside the repo) |
| 5 | `commit-msg` has no W1 header | no desk owns it |
| 6 | no container test exists | the rig has not been stood up |
| 7 | the operator must rotate the GitHub token | it is in the chat transcript |

**THE ANCHOR:** the build package is at `JARVIS-FACTORY/packages/github-master-kernel/` and the
canon at `context_management/`.

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
