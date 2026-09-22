# W4-desk report — scripts + gates + arm command (W4ScriptsDesk)

Branch `feat/github-master-kernel` @ `30bf9f8` + working tree (siblings editing
concurrently). Owned files ONLY (10): `scripts/interface-check.ts`,
`scripts/spec-audit.ts`, `scripts/spec-diff.ts`, `gates/fence-check.py`,
`gates/orphan_scan.sh`, `gates/shape_freeze.sh`, `gates/does_anything_run.sh`,
`W6_ARM_COMMAND.sh`, `theatrical_verification_scanner.sh`, `.gitignore`.
No other file touched. NO COMMITS (orchestrator commits).

RIPWIRE: called `callers` on `REQUIRED_CONTEXTS` before editing `src/**` — N/A,
no `src/**` file is in my set; the contract `src/status-contract.ts` is FROZEN
and untouched (verified below: `git status --short src/status-contract.ts`
prints nothing). `RIPWIRE_MISSING` never needed — grep+read sufficed.

## Status: DONE (27/27 adjudicated, all FIXED except 2 PROBE-ERROR)

## Per-finding verdicts (W4.md order)

F1 [HIGH] theatrical_verification_scanner.sh:1 — VERDICT: FIXED — the dead
stub (shebang + duplicate `set -e`, exits 0) is now a loud refusal: `set -euo
pipefail` + a record-of-decision header (scan lives INLINE in
`gates.yml:theatrical_verification`, asserted by `tests/gate_theatrical.test.ts`;
no code references this path) + `exit 1`. A later accidental wiring now fails
closed instead of vacuously passing. Proof: `bash theatrical_verification_scanner.sh`
prints `theatrical-verification-stub: NOT WIRED ...` and exits 1 (quoted below).
Deletion was rejected: `drift.yml`/W-9-adjacent sweeps enumerate root scripts,
and a named refusal preserves the audit trail (F13 in DPL1_SPEC names this path).

F2 [MEDIUM] W6_ARM_COMMAND.sh:53 — VERDICT: FIXED — idempotent PUT: the patch
step's `patched:` flag is captured to `$PATCH_OUT`; `gh api -X PUT` runs ONLY
when the flag is `True`. On no-op the script prints `already armed — skipping
PUT (no-op)` and copies `$CURRENT` to `$RESULT` so step 4 still verifies.
Proof: `patched: False` on the live 8-context `ruleset.json`, `patched: True`
on a 7-context fixture (quoted below).

F3 [MEDIUM] W6_ARM_COMMAND.sh:60 — VERDICT: FIXED — verification indexing uses
`.get()` guards: non-dict rules skipped, `parameters` non-dict → `ARM-ERROR`
exit 1, `required_status_checks` non-list → `ARM-ERROR` exit 1, entries read via
`c.get("context") if isinstance(c, dict) else None`. A malformed GET response
now produces `ARM-ERROR:...` instead of a KeyError traceback under `set -e`.
Proof: malformed `{"rules":[{"type":"required_status_checks"}]}` fixture exits 1
with no traceback (quoted below).

F4 [LOW] .gitignore:12 — VERDICT: FIXED — `gates/__pycache__/` → `**/__pycache__/`
+ `*.py[cod]`. Verified no `.pyc`/`__pycache__` is tracked (`git ls-files |
grep -iE "pycache|\.pyc"` prints nothing), so the widened ignore leaks nothing
already-committed.

F5 [HIGH] scripts/interface-check.ts:18 — VERDICT: FIXED — dynamic import +
spread + `JSON.parse` wrapped in try/catch → `INTERFACE-ERROR:unreadable:<msg>`
exit 2; `Array.isArray` + every-is-string validates `REQUIRED_CONTEXTS`.
Proof (isolated /tmp/icp copy, live files untouched): syntax-error contract →
`INTERFACE-ERROR:unreadable:Expected "]" but found end of file` exit 2;
missing export → `INTERFACE-ERROR:unreadable:REQUIRED_CONTEXTS missing or not
a string array ...` exit 2; invalid ruleset JSON → `INTERFACE-ERROR:unreadable:JSON
Parse error...` exit 2 (quoted below). NOTE: a project rule asked for a static
import; kept `await import()` with an in-code DYNAMIC-IMPORT EXCEPTION comment
(a static import cannot map loader failure to exit 2 — it throws uncaught at
load). Live run still `INTERFACE:MATCH (8 contexts)` exit 0.

F6 [LOW] scripts/interface-check.ts:22 — VERDICT: FIXED — `any` projection
replaced with `unknown` narrowing mirroring `tests/interface_match.test.ts`
(non-object rules skipped, non-string contexts never pushed). Malformed rules
are SKIPPED, never projected as `undefined` entries.

F7 [HIGH] scripts/spec-audit.ts:7 — VERDICT: PROBE-ERROR (already fixed in tree)
— the `existsSync` guard + `SPEC-AUDIT-ERROR:spec-missing` + exit 2 already
exist at L12-17; the read at L18 is guarded. No change needed; re-proved:
`bun ./spec-audit.ts /nonexistent/spec.md` → `SPEC-AUDIT-ERROR:spec-missing:...`
exit 2 (quoted below). (The finding describes the pre-fix checkpoint shape.)

F8 [MEDIUM] scripts/spec-audit.ts:55 — VERDICT: FIXED — CWD-relative defaults
and GS-4 `existsSync("tests")/readdirSync("tests")` now resolve against
`import.meta.dir` (`ROOT = dirname(import.meta.dir)`; default spec
`join(ROOT, "../packages/...")`; `join(ROOT, "tests")`). Proof: repo-root run
and `scripts/`-cwd run print the identical absolute spec path and identical
`VERDICT:REJECTED (fail=7)` (quoted below).

F9 [MEDIUM] scripts/spec-audit.ts:10 — VERDICT: FIXED (kept read, pinned list)
— `mission` read was dead code AND the hardcoded NOUNS were unmoored. Options
were (a) derive nouns from mission (b) remove read. Chose (b-shape): REMOVED
the `missionPath`/`mission` read entirely (argv is now `[spec-path]` only) and
pinned NOUNS as a reviewed contract with a comment naming its source
(`00-MISSION.md`, re-review on mission change). A runtime derivation would add
an untested NLP seam to a gate; the pin + comment is the honest fix. Nouns
grounded: `graph:8 comms:2 filepaths:2 guardrail:2` in 00-MISSION.md.

F10 [MEDIUM] scripts/spec-diff.ts:23 — VERDICT: FIXED — scope start accepts
`##`/`###` (`/^#{2,3}\s+§6\b/`), items accept numbered AND bullets
(`-/`*`/•`, numbered after bullet text with `n = items.length+1`), section end
is level-aware (a `##` scope runs through `###` subsections; a `###` scope ends
at the next `###`). Continuation-line merge preserved. Live spec needs none of
the new branches (its §6 is 20 numbered items under `##`) — branches are
defensive, proven by code reading, not by live trigger.

F11 [MEDIUM] scripts/spec-diff.ts:67 — VERDICT: FIXED — substring mapping
(`fl.includes(k)` / `lower.includes(t)` + asymmetric SHORT_OK) replaced with
TOKEN-BOUNDARY equality through ONE tokenizer both sides (camelCase split +
lowercase + non-alnum split; `syncProject` → `sync project` meets `sync.ts` on
`sync`). Generic singletons (`test/tests/gate/gates`) are STOP words — item 19
`container test rig` no longer maps to any `*.test.ts` merely for "test".
Short tokens map on the same equality; SHORT_OK table deleted. Effect on live
gate: 19 mapped/1 unmapped → 18 mapped/2 unmapped (items 10 `fix_direct branch
protocol` and 19 `container test rig` now UNMAPPED — CORRECT: the diff has no
file token `fix`, `direct`, `branch`, `protocol`, `container`, or `rig`;
verified by probe2.mjs printing zero FIX-DIRECT/CONTAINER hits across 262
files). Fail-closed direction (fewer false MAPPED) is the safe side.

F12 [HIGH] gates/fence-check.py:24 — VERDICT: FIXED — fresh checkout (ledger
absent) now exits 0 with a NAMED code `FENCE:<sha>:NO-LEDGER-SKIP` instead of
exit 2 `FENCE-ERROR:ledger-missing` (nothing to check — the ledger is
provisioned by fence runs, not by git). Ledger-present-no-row still exits 1
`NO-PASS-ROW`; bad args exit 2; UNREADABLE ledger (permissions) exits 2
`FENCE-ERROR:ledger-unreadable:...` (new `try/except OSError` — an unreadable
ledger is unmeasured, never a skip). CI `|| exit 1` semantics preserved for
the has-ledger case. NO `gates.yml` change (not my file; W2 owns it).

F13 [MEDIUM] W6_ARM_COMMAND.sh:12 — VERDICT: FIXED — defensive init: `WORK=""`
bound before mktemp + guarded trap `[ -n "${WORK:-}" ] && rm -rf "$WORK"` —
a `mktemp -d` failure exits with mktemp's own error instead of the trap
erroring on an unbound variable under `set -u` and masking it.

F14 [HIGH] W6_ARM_COMMAND.sh:43 — VERDICT: FIXED — denylist strip (5 keys)
replaced with the ALLOWLIST PUT shape from `ruleset.json`
(`name/target/enforcement/conditions/rules/bypass_actors`): `rs = {k: rs[k]
for k in PUT_KEYS if k in rs}`. Any future GET-only field (`source`,
`source_type`, ...) is dropped by construction. Patch-step isinstance guards
added (non-dict rule skipped, non-dict params rebuilt, non-list checks rebuilt).

F15 [HIGH] gates/fence-check.py:42 — VERDICT: FIXED — kept ONLY the documented
direction `needle.startswith(first)`; deleted `or first.startswith(needle)`.
Proof: truncated `abcdef12` against a ledger holding `abcdef1234567890|...`
→ `NO-PASS-ROW` exit 1 (was PASS); full 40-hex sha → `PASS` exit 0 (quoted below).

F16 [MEDIUM] gates/shape_freeze.sh:17 — VERDICT: FIXED — DECLARED side now uses
the same pattern as IMPLEMENTED: `-t` ids `[a-z0-9_-]+` (was `[a-z_]`, dropped
digits/hyphens like `my-test-01`) and `DT[_-]?[0-9]+` (was `DT[123]`, dropped
`DT-1`/`DT_1`/`DT4+`). Normalizer generalized to `s/^DT-?([0-9]+)$/DT\1/`.
Live effect: none on this spec (its DTs are bare `DT1 DT2 DT3`) — proven by
`FREEZE:match=385b40972f519af6` before AND after (quoted below).

F17 [MEDIUM] gates/orphan_scan.sh:20 — VERDICT: FIXED — bare-stem grep →
`grep -rlnwF` (fixed-string + whole-word): stem `plan` no longer matches
`planned`/`explain`. Proof: fixture file containing `explain planned` counts 1
under bare `-- "plan"` and 0 under `-wF` (quoted below). Live `ORPHANS=0`
unchanged (all 20 scanned modules keep ≥1 whole-word caller).

F18 [MEDIUM] gates/does_anything_run.sh:38 — VERDICT: FIXED — Q4 `-f` → `-s`:
a 0-byte `wire_capture.json` (touched/truncated) now reports NO like Q5.
Live Q4 still YES (121 bytes).

F19 [MEDIUM] W6_ARM_COMMAND.sh:66 — VERDICT: FIXED — step 4 now FAILS CLOSED:
absent NEW_CONTEXT after PUT → `ARM-FAILED:<ctx> absent after PUT` on stderr,
exit 1. Proof: 7-context fixture exits 1, patched 8-context exits 0 with
`ARMED:gates/theatrical-verification present` (quoted below).

F20 [MEDIUM] scripts/interface-check.ts:26 — VERDICT: FIXED — cardinality gate:
duplicate contexts in `got` → `INTERFACE-DUPLICATE:<ctx>` exit 1 before the
set-equality check. Proof: ruleset with `gates/test` appended twice →
`INTERFACE-DUPLICATE:gates/test` exit 1; live ruleset restored byte-identical
(`git status --short ruleset.json` empty) and `INTERFACE:MATCH` re-verified.

F21 [MEDIUM] scripts/spec-audit.ts:21 — VERDICT: FIXED — fail-open `|| spec`
→ `|| ""`: a spec with no COMPLETION CHECKLIST section now reports
`GS-6:FAIL:CHECKLIST-MISSING-LIVENESS` instead of re-testing the whole spec
(which could never fail). Live effect visible: GS-6 PASS → FAIL on the DPL1
spec (it has no COMPLETION CHECKLIST section — `grep -c` = 0), verdict
fail=6 → fail=7. Fail-closed direction; the spec genuinely lacks the section.

F22 [MEDIUM] scripts/spec-audit.ts:53 — VERDICT: FIXED — declared pattern
`[a-z_]+` → `[a-z0-9_-]+` (keeps `my-test-01` whole); `DT[123]` →
`DT[_-]?[0-9]+` with `-` normalization (catches `DT-1`/`DT_1`/`DT4+`), mirroring
the shape_freeze.sh fix. Live effect: none on this spec (no `-t` ids; bare
DT1..DT3 match both patterns) — defensive parity.

F23 [MEDIUM] scripts/spec-diff.ts:22 — VERDICT: FIXED — `readFileSync` + the
`Bun.spawnSync` diff wrapped in try/catch → `SPEC-DIFF:no spec readable
(<first line>)` / `SPEC-DIFF:no diff available (<first line>)` exit 2. No more
unhandled ENOENT/EISDIR/race-deletion/git-missing crash.

F24 [MEDIUM] W6_ARM_COMMAND.sh:52 — VERDICT: FIXED — same fix as F2 (the finding
is the idempotency half of F2's no-op-PUT; F2's finding text adds the fail-closed
half covered in F19). PUT skipped unless `patched: True`; unreadable patch flag
defaults to the no-op path and step 4 still adjudicates.

F25 [HIGH] gates/does_anything_run.sh:32 — VERDICT: FIXED — the Q3 fallback no
longer reuses a test-importer count as an orphan count (which inverted the
verdict: N importers reported as N orphans, and 0 importers reported YES).
Empty `ORPHANS` now means UNMEASURED → `ORPHANS=-1`, `V3=NO`,
`E3="orphan_scan.sh produced no count (cannot measure)"`. Proven by reading:
the old line is deleted; the live path still resolves via orphan_scan.sh
(`Q3:YES:non-test-caller:every module has a non-test caller`).

F26 [MEDIUM] gates/orphan_scan.sh:11 — VERDICT: FIXED — removed the undocumented
`status.ts` exemption (`ENTRIES="main.ts runtime.ts cli.ts"`); header already
documents exactly `(main.ts / runtime.ts / cli.ts)` so code now matches the
header AND `does_anything_run.sh` Q1 AND `.githooks/pre-push`'s
`case ... main|runtime|cli|status` is a SIBLING file (W1 owns it — flagged to
W1HooksDesk separately, not touched). Grounding: `src/status.ts` has 15
whole-word callers (cli-verbs, guardrail, runtime, main, store, publish,
status-contract, cli, graph, verdict, desks, client, routes, interface-check),
so removing the exemption changes live `ORPHANS=0` NOT AT ALL — verified by
the post-fix run. The exemption was dead weight, not load-bearing.

F27 [MEDIUM] gates/shape_freeze.sh:28 — VERDICT: FIXED — `ls ... | xargs -r`
(GNU-only `-r`, breaks on spaces/newlines, macOS fails) → shell globs +
`basename` loops (`for f in tests/*.test.ts; do [ -e "$f" ] || continue;
basename "$f" .test.ts; done | sort -u`, same for `jobs/*/*.test.ts`). Live
output identical (28 implemented, `FREEZE:match`, exit 0).

## Adjudication notes (both sides read before every fix)

- F7 is PROBE-ERROR: the finding's `existing_code` (unconditional
  `readFileSync`, no guard) matches the CHECKPOINT shape, not the live tree —
  live `scripts/spec-audit.ts:12-17` already had the guard. Recorded, not re-fixed.
- F26's exemption removal was verified load-free BEFORE applying (15 callers).
  Had `status.ts` been callerless, the verdict would have been DOCUMENT (keep +
  header-note) rather than REMOVE.
- F11's strictness was measured against the live diff (probe2.mjs): no file in
  the 262-file diff carries `fix`/`direct`/`container`/`rig` tokens, so items 10
  and 19 are UNMAPPED under any token-boundary rule — the finding's demand
  (kill substring hits) and the gate's purpose (every item maps) are in real
  tension here, resolved toward fail-closed (fewer false MAPPED).
- F12's SKIP-vs-fail choice: the task order says "exit 0 (nothing to check) or
  a NAMED code" — `NO-LEDGER-SKIP` exit 0 satisfies both readings and keeps the
  `spec_gate` step green on fresh checkouts while the has-ledger refusal
  (exit 1) is untouched.

## Files changed (10, exactly the owned set)

- `scripts/interface-check.ts` — exit-2 try/catch + Array validation, unknown
  narrowing, duplicate-context cardinality gate.
- `scripts/spec-audit.ts` — import.meta.dir anchoring, fail-closed checklist,
  widened GS-4 patterns, mission-read removed + NOUNS pinned with provenance.
- `scripts/spec-diff.ts` — H2/H3 + bullet scope parsing, TOCTOU/diff try/catch,
  token-boundary mapping (STOP += test/tests/gate/gates; SHORT_OK deleted;
  camelCase tokenizer shared both sides).
- `gates/fence-check.py` — ledger-missing → NO-LEDGER-SKIP exit 0, OSError →
  exit 2, one-direction prefix only.
- `gates/orphan_scan.sh` — `-wF` whole-word stem match, `status.ts` exemption
  removed (header now exact).
- `gates/shape_freeze.sh` — symmetric `DT[_-]?[0-9]+` + `[a-z0-9_-]+` both
  sides, portable glob loops (no `ls|xargs -r`).
- `gates/does_anything_run.sh` — Q3 fail-closed fallback, Q4 `-s` non-empty.
- `W6_ARM_COMMAND.sh` — guarded EXIT trap, allowlist PUT body, idempotent
  no-op PUT skip, `.get()` verification + `ARM-FAILED` fail-closed.
- `theatrical_verification_scanner.sh` — dead stub → loud `exit 1` refusal with
  record-of-decision header.
- `.gitignore` — `**/__pycache__/` + `*.py[cod]`.

## Verification (quoted, from the repo root)

```
$ for f in gates/orphan_scan.sh gates/shape_freeze.sh gates/does_anything_run.sh W6_ARM_COMMAND.sh theatrical_verification_scanner.sh; do bash -n "$f" && echo "OK:$f" || echo "FAIL:$f"; done
OK:gates/orphan_scan.sh
OK:gates/shape_freeze.sh
OK:gates/does_anything_run.sh
OK:W6_ARM_COMMAND.sh
OK:theatrical_verification_scanner.sh
$ python3 -c "import ast; ast.parse(open('gates/fence-check.py').read()); print('fence-check parses')"
fence-check parses
$ python3 gates/fence-check.py deadbeef1234567890
FENCE:deadbeef1234567890:NO-LEDGER-SKIP (nothing to check — no ledger at .trident/verdicts.jsonl)
fresh exit:0
$ python3 gates/fence-check.py
FENCE-ERROR:usage:expected one git sha argument
no-arg exit:2
$ FENCE_LEDGER=/tmp/fenceprobe/.trident/verdicts.jsonl python3 gates/fence-check.py 0000000000000000000000000000000000000000
FENCE:0000000000000000000000000000000000000000:NO-PASS-ROW
no-row exit:1
$ FENCE_LEDGER=/tmp/fenceprobe/.trident/verdicts.jsonl python3 gates/fence-check.py abcdef12
FENCE:abcdef12:NO-PASS-ROW
truncated exit:1
$ FENCE_LEDGER=/tmp/fenceprobe/.trident/verdicts.jsonl python3 gates/fence-check.py abcdef1234567890abcdef1234567890abcdef12
FENCE:abcdef1234567890abcdef1234567890abcdef12:PASS
full exit:0
$ bun run scripts/interface-check.ts
contract (8): gates/anti-theatrical gates/issue-link gates/spec-gate gates/diff-budget gates/test gates/theatrical-verification factory/fence2 factory/verdict
ruleset  (8): gates/anti-theatrical gates/issue-link gates/spec-gate gates/diff-budget gates/test gates/theatrical-verification factory/fence2 factory/verdict
INTERFACE:MATCH (8 contexts)
EXIT:0
$ bun run scripts/spec-diff.ts (tail)
MAPPED:18:Checkpoints/github-master-kernel-8gates-live-20260922-233133/SHIP_DOCS_MANIFEST.md
UNMAPPED:19
MAPPED:20:Checkpoints/github-master-kernel-8gates-live-20260922-233133/.githooks/commit-msg
SPEC-DIFF:mapped=18 unmapped=2 files=262
spec-diff exit:1
$ bun scripts/spec-audit.ts (tail)
GS-1:FAIL:NO criterion names a process artifact (a library satisfies every criterion)
GS-2:PASS:no live-named criteria to prove
GS-3:FAIL:SCOPE-NOUN-LOST:comms,filepaths
GS-4:FAIL:TEST-SHAPE-DRIFT:DT1 TEST-SHAPE-DRIFT:DT2 TEST-SHAPE-DRIFT:DT3
GS-5:FAIL:BATTERY-AS-SOLE-EVIDENCE
GS-6:FAIL:CHECKLIST-MISSING-LIVENESS
GS-7:FAIL:TRANSLATION-HOLE:comms,filepaths
GS-8:FAIL:CLASS-BY-FILENAME (no declared class in the header)
VERDICT:REJECTED (fail=7)
spec-audit exit:1
$ bash gates/orphan_scan.sh .
ORPHANS=0
EXIT:0
$ bash gates/does_anything_run.sh .
Q1:YES:entry-point:src/main.ts
Q2:YES:loop:1 file(s) with a repeating construct
Q3:YES:non-test-caller:every module has a non-test caller
Q4:YES:wire-exercised:runtime/wire_capture.json present (121 bytes)
Q5:YES:heartbeat:runtime/ticks.log has 9249 row(s)
VERDICT:RUNS (fail=0)
EXIT:0
$ bash gates/shape_freeze.sh .
declared (3): DT1 DT2 DT3
implemented (28): attribution_triage bindings_parity docs_current does_anything_run dossier_hash DT1 DT2 DT3 execute_plan gate_header gate_phantom_reach gate_silent_stub gate_theatrical graph_snapshot guardrail_stale interface_match kick_fallback live_e2e planner_cycle publish_false_green publish_shape replay_converges runtime_ticks ship_manifest spec_audit sync_matches sync_prs_from_ao two_source_verdict
FREEZE:match=385b40972f519af6
SHAPES:all declared ids implemented
EXIT:0
$ bash theatrical_verification_scanner.sh
theatrical-verification-stub: NOT WIRED — the scan lives inline in .github/workflows/gates.yml (job theatrical_verification); this file refuses so an accidental wiring fails closed
stub exit:1
$ bun test tests/does_anything_run.test.ts tests/interface_match.test.ts tests/spec_audit.test.ts tests/gate_theatrical.test.ts
8 pass
0 fail
53 expect() calls
Ran 8 tests across 4 files.
```

W6 idempotence + fail-closed (patch/verify steps extracted verbatim from the
shipped script and run against fixtures — `gh` needs a live token so the PUT
line itself is not fired here):

```
--- W6: patch no-op path (already armed canonical shape) ---
patched: False
--- W6: patch armed path (7-context fixture) ---
patched: True
--- W6: verify step accepts patched2 ---
['gates/anti-theatrical', ..., 'gates/theatrical-verification', 'factory/fence2', 'factory/verdict']
count: 8
verify exit:0
--- W6: verify step FAILS CLOSED on 7-context fixture ---
count: 7
verify-missing exit:1
--- W6: verify step FAILS CLOSED on malformed rule ---
ARM-ERROR:required_status_checks rule has no parameters mapping
verify-malformed exit:1
```

interface-check exit-2 branches (isolated /tmp/icp copy; live files untouched):

```
--- probe A: contract with syntax error ---
INTERFACE-ERROR:unreadable:Expected "]" but found end of file
exit:2
--- probe B: contract missing the export ---
INTERFACE-ERROR:unreadable:REQUIRED_CONTEXTS missing or not a string array in /tmp/icp/src/status-contract.ts
exit:2
--- probe C: ruleset.json invalid JSON ---
INTERFACE-ERROR:unreadable:JSON Parse error: Expected '}'
exit:2
--- duplicate-context branch (live ruleset + appended gates/test, then restored) ---
INTERFACE-DUPLICATE:gates/test
dupe exit:1
```

orphan `-wF` edge (fixture `explain planned`):

```
bare -- "plan" count: 1 (false caller)
-wF count: 0 (correct)
```

spec-audit branches:

```
SPEC-AUDIT-ERROR:spec-missing:/nonexistent/spec.md
missing-spec exit:2
repo-root run and scripts/-cwd run: identical VERDICT:REJECTED (fail=7)
```

## Battery / tsc — NOT mine, owned elsewhere (evidence quoted)

- Full `bun test`: 76 pass / 2 fail. The 2 failures (`guardrail_stale`,
  `ship_manifest` DOSSIER-EXISTS:w4-seed-1) reproduce with ALL 10 of my files
  stashed (siblings-only tree: same 8 pass / 2 fail on those two files), and
  the clean-tree baseline is 78 pass / 0 fail — they come from concurrent
  `src/` edits. W3SrcDesk has ACKed both as theirs and is fixing before the
  final battery. My four covering suites are 8 pass / 0 fail (quoted above).
- `bunx tsc --noEmit`: red on sibling `src/` edits only — first
  `src/attribute.ts(102,67) Cannot find name 'sh'` (W3 fixed on flag), now
  `src/verdict.ts(181,183,185) Property 'verdict' does not exist ...`
  (flagged to W3SrcDesk). Zero errors in my files: all three scripts pass
  `bun build --target=bun` exit 0, and tsc was exit 0 after the attribute fix
  with my files in place. Frozen contract untouched:
  `git status --short src/status-contract.ts` prints nothing (a sibling
  `git diff` shows STAGED content there — not mine; I never staged anything).

## Residual / concerns for the orchestrator

1. Sibling `src/` churn is the critical path: 2 battery failures + tsc red are
   both theirs (ACKed). Do not accept a combined battery until W3 lands green.
2. `spec-diff` items 10/19 UNMAPPED is the CORRECT fail-closed outcome (no file
   in the 262-file diff carries those tokens), but it means the live `spec_gate`
   step exits 1 on this branch — expected: the branch genuinely does not touch
   `fix_direct` or the container rig. Not a defect I introduced.
3. `spec-audit` GS-6 now FAILS on the live DPL1 spec (no COMPLETION CHECKLIST
   section) — fail-closed per F21. If the orchestrator wants the audit green,
   the SPEC needs the section, not the gate loosened.
4. `.githooks/pre-push` still carries the sibling flaws ocr named (bare-stem
   grep, `main|runtime|cli|status` exemption, `^tests` filter) — W1 owns that
   file; I fixed only the canonical `gates/orphan_scan.sh`. Suggest W1 mirrors
   `-wF` and drops `status` there too.
5. Fence SKIP semantics: `NO-LEDGER-SKIP` exit 0 means a fresh checkout passes
   `spec_gate`'s fence line without a ledger. If the orchestrator wants the
   fence to BLOCK until provisioned instead, flip that `return 0` to `return 2`
   and teach `gates.yml` to treat exit 2 as skip — one line each, but that is a
   CI-contract call above my desk.
6. tsc project rule `ts-set-map` and `ts-no-dynamic-import` reminders fired on
   my edits; both complied with (Record-based dedupe; named interface +
   exception comment). No linter run beyond `bash -n`/tsc/build per the desk
   contract.
