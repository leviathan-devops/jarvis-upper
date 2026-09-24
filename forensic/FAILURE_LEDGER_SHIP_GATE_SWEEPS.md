# FAILURE LEDGER — jarvis-upper / the ship-gate sweeps + the runtime seat

**Audit date:** 2026-09-24T19:18:15Z · **Head:** `df35e07ef8520f4b286f70096d78aa8274867285` (`df35e07`) · **Method:** the red-team-slop-audit
(the skill `red-team-slop-audit`).

## §0 — METHOD, INSTRUMENTS, AND MY OWN INSTRUMENT FAILURES

**The three lenses:**
1. **Alpha (the fabrication lens)** — dispatched: "every number is a lie until a command
   reproduces it; every test asserts nothing until you read its assertion."
2. **Bravo (the slop lens)** — dispatched: dead code, no-ops, swallowed errors, magic numbers,
   duplicated logic, comment-code contradiction.
3. **The author's own pass (the third lens)** — the skill's seven hunt lists run as literal
   commands, plus the four QA sweeps (W7-W10) already driven this session.

**MY OWN INSTRUMENT FAILURES (mandatory, per §6):**

- **IF-1 — the mis-aimed revert-proof.** For the W8 tri-state liveness I broke the ADAPTER and
  the test still passed, which I first read as "the test doesn't bite." The test INJECTS deps,
  so it pins `kick.ts`, not the adapter. Re-aimed at `kick.ts`: **0 pass / 1 fail** without the
  fix. Recorded as TH-9.
- **IF-2 — the stale corpus probes.** The P5 corpus reported 3 REDs which I nearly logged as
  gate defects. Two-sided adjudication showed all 3 were **PROBE-ERRORS** (a bare `l` receiver;
  a `.trident/` path that is a deliberate exemption; a 255-cap expectation where the caller's
  cap is 125). Corrected; the corpus is now **25/0**. Recorded as TH-10.
- **IF-3 — the docs' head stamp.** The independent verifier's single FAIL was this class: the
  docs named no current head SHA. The verifier was RIGHT; the fix was a stamp line.

**A note on the dispatched auditors:** at this ledger's first write they had not yet yielded.
Their returns are folded in at §8 when they land; the findings below are the author's pass,
which is the lens the skill says must run regardless.

## §1 — THE CHARGE

The build claimed: every open red-team defect (R1-R15) is fixed with a regression test; the
battery is 168 pass / 0 fail; a runtime-seat defect was found by operating the live daemon and
fixed; the ship gate returns PASS. The operator's order (F-19, verbatim): *"lol knew it. slop.
log all failure data and fix everything."*

## §2 — THE AUTHORITY DOCUMENTS AND THEIR LIVENESS

| the document | its status | the compliance measurement |
|---|---|---|
| `.trident/remediation-pkg/DPL1_REMEDIATION.md` | **LIVE** (this session's binding authority; R1-R15 + SC1-SC6) | every R1-R15 carries a fix + a pin (Part III of BUILD_REPORT) |
| `.trident/remediation-pkg/WAVE_PLAN_REMEDIATION.md` | LIVE (`WAVES: 5`) | the 5 waves ran; W6-W10 were added by the ship-gate loop |
| `.trident/remediation-pkg/BLUEPRINT_REMEDIATION.md` | LIVE | — |
| `.trident/green-merge-pkg/` | SUPERSEDED by the remediation package | graded against the remediation package only |

**No superseded-authority grading occurred** (Step 0.1): the compliance claims above are made
against the LIVE remediation package.

## §3 — THE FINDINGS

### F-1 · CONFIRMED (HIGH) — the stale-verdict read reached the merge path
- **Location:** `src/guardrail.ts:25` (+ the schema at `src/store.ts:27`).
- **WHAT:** `gate_pass`'s PK is a surrogate `id`, so `(pr_node, gate)` could hold MANY rows.
  `recordGatePass` upserts on `id = JSON.stringify([prId, g])`, but LEGACY rows carry
  `id = NULL` — and NULLs are DISTINCT in a SQLite TEXT PK, so a legacy row NEVER conflicts and
  survives forever. The guardrail's read had **NO ORDER BY**.
- **COMMAND + OUTPUT (verbatim):**
  ```console
  $ bun -e "SELECT pr_node,gate,GROUP_CONCAT(verdict) vs,COUNT(*) n FROM gate_pass GROUP BY pr_node,gate HAVING n>1"
  pr:jarvis-upper-4:2 ci_green pass,fail 2
  $ the row .get() returns: {"id":null,"verdict":"pass"}
  $ all ci_green rows by rowid: [{"rowid":1,"id":null,"verdict":"pass"},
                                {"rowid":5,"id":"[\"pr:jarvis-upper-4:2\",\"ci_green\"]","verdict":"fail"}]
  ```
- **WHY:** the STALE legacy `pass` masked the NEWER `fail`; the verdict depended on unspecified
  row order.
- **WHY ALLOWED:** no probe ever inserted a duplicate (pr_node, gate) pair, so no test could see
  it. The class is **shape-without-reachability** (#1) crossed with **duplicated authority** (#7).
- **THE FIX:** `ORDER BY at DESC, rowid DESC LIMIT 1`; a `POST_REBUILD` dedupe + `UNIQUE INDEX`.
- **THE BLAST RADIUS (measured):** `ripwire verb=callers target=guardrail` → `count="4"`:
  `verbGates` · **`executePlan`** · `tick` · `isEligible`. **It reached the MERGE path.**
- **THE VERDICT:** CORRECT — fixed, pinned (`test_guardrail_reads_latest_verdict`), the live
  retest green (`dupes []`, the index present, `gate_pass` 8→4 rows).

### F-2 · CONFIRMED (MEDIUM) — the dedupe migration dropped its own index
- **Location:** `src/store.ts` (`openStore`).
- **WHAT:** the dedupe was FIRST placed in `MIGRATIONS`, where the `CREATE INDEX` ran BEFORE
  `rebuildIfNoFks` — and a table rebuild DROPS its indexes.
- **COMMAND + OUTPUT:** the W9 test `test_gate_pass_dedupe_migration` FAILED with
  `Received: "{\"c\":1}\nnull\n"` — the index was `null` (absent) on a fresh store.
- **WHY ALLOWED:** it survived on the LIVE store only because that one had already been rebuilt
  (it had FKs), so the live check could not see it. **The instrument-before-the-provider law.**
- **THE FIX:** a `POST_REBUILD` phase that runs AFTER the rebuilds.
- **THE VERDICT:** CORRECT — pinned; the test now asserts the index exists.

### F-3 · CONFIRMED (LOW) — `PR_STATES` had three authorities
- **Location:** `src/adapter-verbs.ts:16` + `src/reducers.ts:11` + the SQL CHECK
  (`src/store.ts:16`).
- **COMMAND + OUTPUT:** the two TS lists were byte-identical today (a drift RISK, not a live
  defect).
- **THE FIX:** one export in `store.ts`, imported by both.
- **THE VERDICT:** CORRECT (the slop class **duplicated authority** #7).

### F-4 · CONFIRMED (LOW) — `RUNTIME_GRADE_TRANSCRIPT`/docs head drift
- **WHAT:** the independent verifier found the docs named no current head SHA.
- **THE FIX:** the head stamp.
- **THE VERDICT:** CORRECT.

### THE ADJUDICATED (NOT findings) — the probe-errors
| the probe | the observed | Side A | Side B | verdict |
|---|---|---|---|---|
| W-6 POSITIVE | no REJECT | a bare `l` receiver | — | PROBE-ERROR |
| W-9 POSITIVE | no REJECT | staged under `.trident/` (exempt) | — | PROBE-ERROR |
| EXIT-CAP (scan-silent) | no 255 | the caller's cap is 125 | — | PROBE-ERROR |

## §4 — THE VERBATIM PROBES
All reproductions are in `TESTING_LOG.md` (the P5 corpus result) and
`.trident/runtime-ledger.md` (the runtime seat), so the next auditor need not re-derive them.

## §5 — THE SLOP TAXONOMY (grep-able)
`ORDER BY`-less multi-row reads · surrogate-PK row multiplicity · migration-vs-rebuild index
order · duplicated constants · stale probes · mis-aimed revert-proofs · head-stamp drift.

## §6 — THE REBUILD REQUIREMENTS
| # | the requirement | traces to | the mechanical check |
|---|---|---|---|
| 1 | a read that can match many rows MUST order deterministically | F-1 | `grep -rn "gate_pass WHERE" src/ \| grep -v "ORDER BY"` → empty |
| 2 | a UNIQUE index MUST exist on (pr_node, gate) | F-1 | `SELECT name FROM sqlite_master WHERE name='gate_pass_pr_gate'` |
| 3 | a schema step MUST run after the FK rebuilds | F-2 | the index exists on a FRESH store |
| 4 | every constant has ONE definition site | F-3 | `grep -rc "^export const PR_STATES" src/` → 1 |

## §7 — THE HONEST SURVIVE LIST (what genuinely WORKS, with evidence)
- **The typecheck + battery:** `bunx tsc --noEmit` exit 0 · `bun test` **168 pass / 0 fail**
  (587 expect, 45 files).
- **The real-machinery tests:** ≥3 tests exercise the REAL `fence2.py` + git + ledger with NO
  injection (`test_real_fence_verified`, `test_real_fence_refuses`, `test_real_ledger_binding`)
  — the R15 mock-majority is BROKEN.
- **The enforcement hooks:** the P5 corpus **25/0**; the corrected probes prove `REJECT(W-9)` and
  `REJECT(W-6)` fire on real violations.
- **The live daemon:** `active`, tick advancing; the store's gate_pass deduped 8→4.
- **The target guard:** FAIL-CLOSED (an unreadable remote, a lookalike host, and an extra path
  segment all refuse).

## §8 — THE INDEPENDENT AUDITORS' RETURNS
*(folded in when the two dispatched auditors yield; see the note at §0)*

## §9 — COVERAGE, WASTE, AND THE GAPS I DID NOT EXAMINE
- **Covered:** src/ (23 .ts), tests/ (44 files), gates/ (7), .githooks/ (5), the store schema,
  the live daemon, the P5 corpus.
- **NOT examined:** `ao-client/gen/` (generated routes), `packages/` (a vendored external
  package — byte-identical copies), the CI workflow YAML, the Discord/AO transport internals.
- **The unswept frontier (named):** the end-to-end green path on a LIVE eligible PR has not been
  demonstrated (it needs an operator `promote`); the `kick` rail has never run live.

## §10 — THE ROOT-CAUSE SYNTHESIS
Every confirmed defect traces to ONE of two roots: **(a) a read or a write whose SUBJECT
multiplicity was never modeled** (F-1, F-2), or **(b) an authority duplicated until it drifted**
(F-3). Both are the class the corpus and the graph gate exist to catch — and both were caught by
OPERATING the system, not by reading it.

## §11 — THE SEVERITY LEDGER + THE ANSWER
| severity | count | ids |
|---|---|---|
| critical | 0 | — |
| high | 1 | F-1 |
| medium | 1 | F-2 |
| low | 2 | F-3, F-4 |
| probe-errors (not findings) | 3 | W-6, W-9, EXIT-CAP |

**THE ANSWER: every confirmed finding is FIXED and PINNED. 0 open critical/high.**
