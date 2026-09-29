# DPL1 SPEC — THE GITHUB MASTER KERNEL: INDUSTRIAL-GRADE HARDENING + RUNTIME CAMPAIGN

**TARGET (verbatim):** *"12 HOURS AUTONOMOUS FORWARD MOVEMENT ON THIS FULL FUCKING KERNEL BUILD
AND LEGIT RUNTIME TESTING - INDUSTRIAL GRADE"* — plus *"PROPER FUCKING PROMPT TO PIN THAT WILL
POLICE YOU, FORCE CODE AUDIT AND ZERO TRUST AUDIT — FUCKING PROPERLY TEST EVERY SINGLE FUCKING
THING, MANAGE YOURSELF PROPERLY."*

**PREDECESSOR DOCS:** `packages/github-master-kernel/BLUEPRINT.md` · `WAVE_PLAN.md` ·
`GITHUB_ENFORCEMENT_MAP.md` · `GUARDRAILS.md` · `.trident/ZERO_TRUST_AUDIT.md` ·
`.trident/OCR_FINDINGS_DIGEST.md`
**BASE TREE:** `jarvis-upper` @ `feat/github-master-kernel` `e9ff02b` · 274 .ts / 20,397 L

---

## §0 THE PROBLEM (first principles)

The kernel ENFORCES verification on other people's work. **It has never been verified by its own
standard.** The ocr ship gate — the very gate this repo's doctrine says blocks every ship claim —
returned **FAIL: 36 high / 77 medium / 15 low across 40 files**. The enforcement layer is
un-enforced. Two consequences follow mechanically:

1. **A broken gate is worse than no gate.** `scan-phantom.sh` exists on disk and is never sourced
   (`W-3` never fires). `theatrical_verification_scanner.sh` exits 0 with no scan logic. A gate
   that silently passes is a FALSE GREEN — the exact class this kernel exists to kill.
2. **A gate that blocks legit work is equally broken.** `.includes("<Ident>")` in `tests/*.ts`
   rejects legitimate string-containment assertions; `2>&1` turns an internal error into a
   spurious W-13/W-14 reject. Over-fire destroys trust in the gate and gets it bypassed.

## §1 THE FAILURE INVENTORY (evidence, never hypotheticals)

**Source:** `.trident/ocr-findings-<sha>.json` (128 comments, `session_id` recorded) +
`.trident/OCR_FINDINGS_DIGEST.md`. **Every entry below is a verbatim ocr finding, not a guess.**

| # | file | the defect (verbatim) | class |
|---|---|---|---|
| F1 | `.githooks/lib/scan-phantom.sh` | "this file is never sourced/executed by `.githooks/pre-push` … so **W-3 never fires**. `ORPHANS` incremented inside `… \| while` runs in a subshell and is discarded; function always `exit 0`." | DEAD GATE |
| F2 | `.githooks/lib/scan-stub.sh` | "docstring promises cap at 255 but `return "$hits"` is uncapped; bash exit codes wrap modulo 256, so e.g. **256 hits reports clean (0)**." | WRAP-TO-CLEAN |
| F3 | `.githooks/lib/pattern-header.sh` | "`local f="$1"` under `set -u` fails with unbound-variable **before** the `${1:?}` guard runs, making the guard dead." | DEAD GUARD |
| F4 | `.githooks/lib/scan-silent.sh` | "Rule 3 is file-wide correlation … every `?? 0\|""\|[]\|{}` literal in the file is flagged, even in unrelated functions. This will **false-positive on legitimate defaults**." | OVER-FIRE |
| F5 | `.githooks/pre-commit` | "Overbroad W-6: any `.includes("<Identifier>")` in tests/*.ts rejects, including **legitimate string-containment assertions**." | OVER-FIRE |
| F6 | `.githooks/pre-commit` | "`2>&1` turns internal errors (missing lib, `command not found`) into `SILENT_OUT` lines … causing **spurious W-13/W-14 rejects**." | ERROR-AS-HIT |
| F7 | `.githooks/pre-push` | "`head -1` picks arbitrary remote-tracking branch …; `break` keeps only first pushed SHA (**multi-ref pushes unchecked**); `for f in $CHANGED_SRC` splits on spaces." | WORD-SPLIT |
| F8 | `.githooks/pre-push` | "Word-splitting on paths: filenames with spaces break the orphan loop." | WORD-SPLIT |
| F9 | `.githooks/prepare-commit-msg` | "Permissive evidence fallback: `[A-Za-z0-9_/.-]+:[0-9]+` accepts `a:1`, `12:30` (time) as file:line evidence … Bare `done/complete/shipped` claims **bypass the keystone gate**." | UNDER-FIRE |
| F10 | `.github/workflows/gates.yml` | "`github.base_ref` is empty on merge_group, so BASE is empty and `origin/..HEAD` fails with `set -e`." | MERGE-GROUP BUG |
| F11 | `.github/workflows/gates.yml` | "Same-line `grep mock \| grep expect(` misses the normal theatrical pattern … **false negatives**." | UNDER-FIRE |
| F12 | `gates/fence-check.py` | "`.trident/verdicts.jsonl` is not committed and no CI step sets FENCE_LEDGER … spec_gate **always exits 2 ledger-missing in a fresh checkout and blocks all PRs**." | ALWAYS-FAIL |
| F13 | `theatrical_verification_scanner.sh` | "Empty stub exits 0: file contains only shebang + duplicated `set -e` with **no scan logic**." | DEAD STUB |
| F14 | `W6_ARM_COMMAND.sh` | "Unconditional PUT even on idempotent no-op … adds a needless live-ruleset write on every re-run." | IDEMPOTENCE |
| F15 | `W6_ARM_COMMAND.sh` | "`r["parameters"]["required_status_checks"]` will raise KeyError if a rule lacks those keys." | UNGUARDED INDEX |
| F16 | `W6_ARM_COMMAND.sh` | "if `mktemp -d` fails, `WORK` is unbound and the `EXIT` trap itself errors." | TRAP-MASK |
| F17 | `.gitignore` | "Narrow ignore: `gates/__pycache__/` only covers one directory." | NARROW IGNORE |
| F18-F47 | `src/*.ts` (20 files, 47 findings) | `verdict.ts` 8 · `kick.ts` 5 · `desks.ts` 4 · `guardrail.ts` 4 · `cli-verbs.ts` 4 · `attribute.ts` 3 · `adapter-verbs.ts` 3 · `cli.ts` 3 · `sync.ts` 3 · `plan.ts` 3 · `publish.ts` 3 · `dossier.ts` 2 · `execute.ts` 2 · `main.ts` 2 · `status.ts` 2 · `graph.ts` 1 · `reducers.ts` 1 · `store.ts` 1 — the full text in the digest | mixed |

**THE AUDIT'S OWN THREE FINDINGS (from `.trident/ZERO_TRUST_AUDIT.md`, independently confirmed):**
- **A1 — the W-1 SCOPED-OFF sold as PROVEN.** `[ -d extensions ]` is FALSE; W-1 cannot fire in this
  repo. The honest count is **7 gates proven + 1 untestable**.
- **A2 — the SHA DRIFT.** The 5 read-first canon docs carry `732083e/760ad1b/adbdacf/70c9906/...`
  — **none carries HEAD `e9ff02b`**. A fresh agent resumes from the wrong point.
- **A3 — THE DEFECT-COUNT EMBELLISHMENT.** "17 defects" (my claim) vs 16 (the doc) vs 11 (the EN
  entries) vs 4 (the firings) — four numbers. The honest count is the EN entries.

## §2 THE FIX PLAN (contracts · interfaces · data flows · error rules)

**§2.1 THE FROZEN CONTRACT (never changed by any wave).** The 8 status contexts in
`src/status-contract.ts` are the interface. They appear in THREE places (the module, the CI job
names, the live ruleset 23838059). **A wave that changes any context string BREAKS the enforcement.**
Verified this session: `LEN=8`; the ruleset reports `enforcement: active`, `bypass_actors: []`.

**§2.2 THE HOOK ERROR RULE (the fix shape for F1-F9).** Every hook lib function returns a NAMED
refusal, never a bare exit code. The contract:
```
scan_*(input) → prints HITS to stdout (one per line) → returns min(hits, 255)
the caller reads stdout, counts, and decides; the return code is a SIGNAL, never the count
stderr NEVER merges into the hit stream (2>&1 is BANNED on the scan path)
every loop over paths uses `while IFS= read -r` over NUL-delimited input
every `${1:?}` guard runs BEFORE any `local x="$1"`
```
**§2.3 THE GATE-CONTRACT ERROR RULES.** A gate FAILS LOUD with a named code, or PASSES CLEAN.
No third state. `fence-check.py` in a fresh checkout must exit 0 (nothing to check) or a NAMED
code — never an unhandled exit 2.

**§2.4 THE DATA FLOW (unchanged, the keystone).** commit → prepare-commit-msg (W-8) → pre-commit
(W-6/W-9/W-13/W-14) → pre-push (W-2/W-3) → ruleset → 8 contexts → CI 6 jobs → the publisher
(`src/runtime.ts:233`) POSTs the verdict. The hardening changes the GATES' internals, never the flow.

**§2.5 THE W-1 DECISION (A1).** Two legal outcomes, one must be chosen and RECORDED:
(a) DELETE W-1 from the hook (it can never fire here — a dead gate is a liability), or
(b) GENERALIZE the predicate from `[ -d extensions ]` to the repo's actual dist path.
The choice is recorded in DECISION_CHAIN.md with the reason. Silently keeping it = the A1 fraud.

## §3 THE WAVE ORDER (owners + mechanical done-when)
See `WAVE_PLAN.md` — W1 hooks · W2 ci · W3 src · W4 scripts · W5 docs · W6 runtime seat.
W1-W4 are DISJOINT and fire CONCURRENTLY; W5/W6 serialize behind them.

## §4 THE TESTING TIERS (the four-tier proof contract)
- **L0** `bunx tsc --noEmit` → exit 0. **L1** `bun test` → 78 pass / 0 fail (PURE functions).
- **L2 SCRIPT TEST** — the real hooks executed with real staged content, observation-channel
  assertions (the exit code + the printed gate id), BOTH halves: an attack that MUST fire its
  SPECIFIC gate token, and a legit op that MUST pass with ZERO misfire.
- **L3/L4 THE RIG** — the 8 gates operated LIVE on the host (W6), each with a pre-registered
  expectation; the keystone re-proven (a fresh clone's push to main REFUSED).

## §5 ANTI-PATTERNS (each one paid for already)
1. **A GENERIC gate preempting a SPECIFIC one = UNOBSERVED, never PASS.**
2. **Probing SOURCE when the DEPLOYED artifact is what runs.** The hooks ARE the deployed artifact;
   there is no separate bundle here — probe the real hook via a real commit/push.
3. **A probe whose own expectation was wrong, reported as a defect** — adjudicate BOTH sides first.
4. **Fixing to satisfy a broken test** — the test is adjudicated before the code is touched.
5. **A dead gate left in place** (F1, F13) — a gate that never fires is a FALSE GREEN.
6. **A count that does not survive a re-count** (A3).
7. **Editing `Checkpoints/**`** — sealed snapshots MUST NOT drift (EN-110's lesson).

## §6 SUCCESS CRITERIA (command-verifiable)
1. `bunx tsc --noEmit` → exit 0.
2. `bun test` → 78 pass / 0 fail (or more, never fewer).
3. **The ocr gate re-run → `GATE: PASS (0 critical, 0 high)`** — the 36 high findings closed.
4. Every hook passes `bash -n`; every shell script's exit code is capped ≤255.
5. The 8 gate ids still fire (a positive probe per gate) AND legit work passes (a negative probe).
6. The keystone re-proven: a fresh clone's push to main REFUSED with `GH013`.
7. The canon docs' read-first five agree on HEAD's sha.
8. `.trident/runtime-ledger.md` non-empty with per-op verdicts + a named residual.
9. A sealed checkpoint with src + dist + docs + manifest, hyphens-only name.

## §7 RESUME GUIDE
Read, in order: `packages/github-master-kernel/DPL1_SPEC.md` (this) → `WAVE_PLAN.md` →
`.trident/OCR_FINDINGS_DIGEST.md` → `.trident/ZERO_TRUST_AUDIT.md` → `context_management/`.
The tracker: `.trident/wave-audit/`. The runtime ledger: `.trident/runtime-ledger.md`.

## §8 OPEN QUESTIONS (with the ruling)
- **Q1: is W-1 deleted or generalized?** → RULING: GENERALIZE to the repo's real dist path if one
  exists; else DELETE and record. (A dead gate is a liability; a generalized one is testable.)
- **Q2: is the ocr gate run against the branch range or a scan?** → RULING: BOTH. The range review
  for the diff; `ocr scan` on the fixed files to prove the fix (no diff required).
- **Q3: does the checkpoint get re-sealed?** → RULING: YES, at P7, with a FRESH token and Mode B
  (no-lock) — the build continues.

## APPENDIX — ZERO-TRUST AUDIT OF THIS SPEC
- Every F-number cites a real ocr comment (the JSON on disk, session_id recorded). ✓
- The baseline numbers were re-measured THIS turn (78 pass, tsc 0, 8 contexts). ✓
- The A1/A2/A3 findings come from the independent subagent audit ('/home/leviathan/.omp/agent/sessions/-JARVIS_WORKSPACE-Shared_Workspace/2026-09-16T19-37-32-435Z_01a0abb9-7213-7213-9914-66098ea8f80f/IndependentAuditor.md'). ✓
- NOT CLAIMED: the container rig (not stood up) · the publisher's LIVE POST (no token) ·
  the upper-factory migration (not started).
