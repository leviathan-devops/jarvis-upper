# CONTAINER TEST — BASELINE (the PRE-FIX hooks) · 2026-09-22T21:40:14Z

**THE RIG:** container `jarvis-upper-ct` · image `omp-ct:master` · plan hash `16d5791c` · the
repo deployed to `/workspace/repo` · `core.hooksPath=.githooks` · git 2.39.5 · bash present.
**THE HOOKS UNDER TEST:** the host's hooks at the copy moment (pre-hardening, the ocr-FAIL state).

## THE RESULTS — per scenario (the token in a REAL tool result, verbatim)

| # | the scenario | the observed output (verbatim) | verdict |
|---|---|---|---|
| S1 | the legit path | `PRE-COMMIT: PASS` | **CORRECT** |
| S2 | W-8 bare claim `fix: everything works great` | `PRE-COMMIT: PASS` then `REJECT(W-8): claim word (...)` — 0 commits landed | **CORRECT** |
| S3 | W-13 empty catch | `REJECT(W-13): SILENT-FALLBACK:/tmp/tmp.lkJZIKIaaT.ts:1:export function f(){ try{g()}catch{} }` | **CORRECT** |
| S4 | W-9 thin .md | `REJECT(W-9): thin.md has 3 lines (< 100)` + `has 0 file:line anchors (< 3)` | **CORRECT** |
| S5 | **W-6 NEGATIVE** — a LEGIT `s.includes("Timeout")` | **`REJECT(W-6): tests/a.test.ts contains the fake-wiring signature`** | **★ DEFECT (F5) — REPRODUCED in a clean container** |
| S6 | W-6 POSITIVE — a fake-wiring `.includes("SomeSymbol")` | `REJECT(W-6): tests/b.test.ts ...` | **CORRECT** |
| S7 | the `--no-verify` bypass | `REJECT(W-8): claim word (...)` — the commit did NOT land | **CORRECT** (the ABSOLUTE hook survives) |
| A1 | a spaced path `src/sp ace/a.ts` | `PRE-COMMIT: PASS`, RC=0 — no crash | **CORRECT** for pre-commit (the F7/F8 word-split is in **pre-push**) |
| A2 | **the exit-cap** | `.githooks/lib/scan-stub.sh:89: return "$hits"` · `.githooks/lib/scan-silent.sh:171: return "$hits"` | **★ DEFECT (F2) — BOTH UNCAPPED (256 hits wraps to 0)** |
| A3 | the stderr-as-hit | `.githooks/pre-commit:146` carries the comment "no 2>&1 — stderr never merges into the hit stream"; NO live `2>&1` found | **ALREADY FIXED (F6) — adjudicate as probe-error/already-addressed** |

## ★ WHAT THE CONTAINER TAUGHT (not visible from the host)
1. **The W-6 over-fire is REAL and environment-independent** — S5 rejects a legitimate
   `.includes("Timeout")` assertion in a CLEAN container. The host's green did not reveal it; the
   clean-room probe did.
2. **The exit-cap defect is in BOTH scanners** (`scan-stub.sh:89` AND `scan-silent.sh:171`) — the
   ocr finding named one; the container found both.
3. **The gates carry their own environment** — the hooks ran with no host state, no warm shell:
   S2/S3/S4/S6/S7 all fired. The kernel is not host-dependent.
4. **F6 (stderr-as-hit) is already addressed** in the deployed hooks — the desks must adjudicate it
   as already-fixed, not re-fix it.

## THE POST-FIX PLAN
After W1-W4 land + commit: re-deploy the FIXED hooks into the container, re-run the corpus, and
confirm S5 now PASSES (the over-fire closed) and A2 now returns a NON-ZERO cap. The results land in
`.trident/ct/ct-results.json`.
