# THE OCR ADJUDICATION RECORD — round-4/5 (2026-09-23)

A scanner's severity is a **CLAIM**. Every critical/high is adjudicated BOTH ways
before any fix: (A) is the scanner's expectation wrong? (B) is the observed code a
real contract violation? Only CONFIRMED side-B defects are findings. Every refuted
row carries the MEASUREMENT that refutes it — a refutation without its measurement is
itself a claim, and claims are what this record exists to kill.

## §1 THE CONFIRMED DEFECTS (fixed + pinned)

| sev | site | the defect | the fix | the pin |
|---|---|---|---|---|
| CRIT | `src/runtime.ts:53` | `defaultRails` fetched `after=0` every tick; with the 64 KB cap it re-read the same window forever and events beyond it were NEVER fetched — the daemon silently stalled | read the `rail_seq` cursor before the fetch, pass `after=<cursor>` | `tests/probe/cursor_probe.test.ts` (asserts `after=4242`, not `after=0`) |
| CRIT | `scripts/spec-diff.ts:21` | the spec resolved ONE LEVEL ABOVE the repo — a CI-unreachable host path, so the REQUIRED `gates/spec-gate` ALWAYS exited 2 (UNMEASURED) | vendor the mission spec in-repo; resolve relative to ROOT | measured: spec-diff exit 1 (MAPPED=18/UNMAPPED=2), shape_freeze exit 0, spec-audit GS-1..8 |
| CRIT | `src/guardrail.ts:26` | STALE-GATE compared `gate_pass.sha16` (a SPEC invariant hash) against `pr_node.head_sha` (a git sha) — cross-domain, always unequal, so every passing gate read as stale in production | a real `gate_pass.head_sha` column; compare THAT | `tests/guardrail_stale.test.ts` now writes head_sha |
| HIGH | `src/execute.ts` | a THROW lost the partial `PlanExecution` (only return-value failures were handled) | wrap each step; a throw halts with the partial state | battery |
| HIGH | `src/adapter-verbs.ts` | `.sessions` on a null client body crashed (`?? []` guards the property, not the object) | reuse the null-safe `listSessions` | battery |
| HIGH | `src/guardrail.ts` | `fetch` + `res.json()` throws were uncaught, breaking the return-a-`RemoteEligibility` contract | try/catch both, return an honest not-ok | battery |
| HIGH | `src/cli-verbs.ts` | a nested ternary | sequential if/else | battery |
| HIGH | `src/attribute.ts` | `code ?? 0` reported a signal-kill as SUCCESS (a regression from an earlier fix) | null -> 1 | battery |
| HIGH | `src/attribute.ts` | the promise could hang forever (no error handling on `p.exited`) | always-resolve + code coercion | battery |
| HIGH | `src/desks.ts` | `startsWith` is not containment — the untrusted `defect.file`/`defect.test` could escape the fixture root | a `contained()` resolved-path check | battery |
| HIGH | `src/desks.ts` | `target` interpolated into a path unvalidated | `assertSegment("TARGET", …)` | `tests/desks_traversal.test.ts` |
| HIGH | `src/dossier.ts` | the `md + "\n" + json` sha was AMBIGUOUS (a delimiter swap collides) | length-prefix each component | battery |
| HIGH | `src/dossier.ts` | `JSON.stringify(undefined)` returns non-string `undefined`; the write sequence had no error handling | `?? "null"` + contextual errors | battery |
| HIGH | `src/reducers.ts` | a `head_sha`-less event overwrote the stored `head_sha` with NULL | `COALESCE(excluded.head_sha, pr_node.head_sha)` | battery |
| HIGH | `src/runtime.ts` | `stop()` launched a SECOND concurrent tick when one was in flight | wait for the in-flight tick to settle | battery |
| HIGH | `src/status.ts` | the rotation read the ENTIRE `ticks.log` every tick (O(n^2)) | `statSync` size gate | battery |
| HIGH | `src/store.ts` | `PRAGMA foreign_keys=ON` with NO foreign keys (a policy with no teeth) | 3 FK clauses; waveB mints its parent row | battery |
| HIGH | `src/main.ts` + `runtime.ts` | `Number("")===0` / `Number("abc")===NaN` -> a 0/NaN tick interval (a runaway storm) | `parseTickMs` validation | battery |
| HIGH | `src/main.ts` + `store.ts` | `new URL().pathname` is not a filesystem path | `fileURLToPath` | battery |

## §2 THE REFUTED FINDINGS (the measurement, not the opinion)

| the claim | the measurement that refutes it |
|---|---|
| `src/desks.ts` — bugId reaches a path unvalidated | every writer goes through `dossierDir`, which throws `INVALID-BUGID` for anything outside `[A-Za-z0-9_-]+` or containing `..`. Pinned: `tests/dossier_traversal.test.ts` (3 cases). |
| `src/verdict.ts` — `Bun.spawnSync().stdout.toString()` gives comma-joined bytes (claimed CRITICAL) | MEASURED: `stdout` is a **Buffer** (`Buffer.isBuffer() === true`) whose `toString()` decodes UTF-8 — `bun -e` prints `"/home/leviathan"`, not `"104,101,…"`. Independent witness: `tests/spec_audit.test.ts` asserts decoded stdout and PASSES. |
| `src/attribute.ts` — the `.catch` references the out-of-scope `code` (claimed CRITICAL) | MEASURED: the `.catch` uses the LITERAL `code: 1`; the inner catch (inside the `.then(code => …)` callback) uses `code`, which IS in scope there. A genuine out-of-scope reference would FAIL `tsc` — `tsc` exits **0**. |
| `src/status-contract.ts` — MISSING a `pending` state | the contract is FROZEN (the goal: changing it is a stop-and-report). The kernel posts FINAL verdicts (`success`/`failure`/`error`); GitHub's status API defaults an expected-but-unposted context to `pending` natively, so an explicit state is not required. A design boundary, not a defect. |

## §3 THE CONVERGENCE (why the raw count is not the metric)

The CONFIRMED defect count per full `src` scan (20 files, the poolside lane):

```
  round-4   1 crit + 5 high      all real
  rescan-1  0 crit + 11 high     all real (the deep surface the earlier rounds missed)
  rescan-2  1 crit + 3 high      1 crit real + 2 real; 1 refuted
  rescan-3  1 crit + 2 high      0 real crit (stdout refuted) + 2 real
  rescan-4  1 crit + 3 high      0 real crit (.catch refuted) + 1 real (target); 2 refuted
```

The CONFIRMED count is converging (6 -> 11 -> 3 -> 2 -> 1) while the RAW count
varies (6 -> 11 -> 4 -> 3 -> 4) — because the raw count mixes real defects with
**refuted false positives**, and the false positives dominate once the real ones are
closed. The number that governs ship is the CONFIRMED count, adjudicated row by row
with a measurement. A raw severity is a claim; the adjudication is the finding.

## §4 THE GOVERNING LAW (the artifact-class law, again)

A gate's PREDICATE is correct for one artifact-CLASS. `spec-diff.ts`'s path predicate
was authored for the HOST layout (where the mission package sits as a sibling) and
ported to CI without checking the class — the exact defect family W-1 (the `find`
predicate on a repo with no `dist/`) and W-9 (the `wc -l` predicate on a GitHub
template) already paid for. Every finding in this record is one of two shapes:
(a) a predicate landing on the wrong artifact class, or (b) a value trusted across a
domain boundary (a spec hash compared to a git sha; a null body cast to an object; a
signal-kill's null exit code read as 0). Both are closed at the INVARIANT, and both
are pinned so a future regression goes RED.

## §5 THE EVIDENCE INDEX

- `.trident/ocr-src-round4.json` — the first full src scan (1 crit + 5 high)
- `.trident/ocr-src-round4-rescan.json` — rescan-1 (0 crit + 11 high)
- `.trident/ocr-src-round5.json` — rescan-2 (the head_sha critical)
- `.trident/ocr-src-round6.json` — rescan-3 (the stdout refutation)
- `.trident/ocr-src-round7.json` — rescan-4 (the .catch refutation)
- `.trident/ocr-rest-round4.json` — the scripts/gates/.github scan (the spec-path critical)
- `.trident/ocr-hooks-round3.json` + `-round3b.json` — the hooks scans
- `tests/probe/cursor_probe.test.ts` · `tests/dossier_traversal.test.ts` ·
  `tests/desks_traversal.test.ts` — the regression pins

A claim without its artifact is VOID. Every row above names its artifact; the pins
are executable; the refutations carry their measurement. That is the whole record.
