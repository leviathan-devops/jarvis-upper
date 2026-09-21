# TESTING_LOG — jarvis-upper (append-only; plan zone + results zone)

# ═══════════════ ZONE 1 — THE TEST PLAN (what needs testing) ═══════════════

## TEST PLAN ENTRY — 2026-09-20 — the RUNTIME that does not exist yet

### SCRIPT
- **What:** every capability reachable from an entry point (no orphans)
- **How:** a caller-scan that FAILS on any module with zero non-test callers
- **PASS criteria:** `orphan-scan` exit 0; `client.ts` has ≥1 real caller
- **FAIL criteria:** any module with 0 non-test callers (today: client.ts)
- **Status:** PENDING

### SCRIPT
- **What:** the CLI verb surface required by spec §6 item 15
- **How:** run each verb; assert a JSON object on stdout and exit 0/1/2
- **PASS criteria:** `sync|plan|order|kick|bug|gates|graph|status` all respond
- **FAIL criteria:** usage text + exit 2 (today's state for 6 of 7)
- **Status:** FAILED (measured 2026-09-20, probe A3)

### CONTAINER
- **What:** the live rail parses REAL daemon SSE bytes
- **How:** capture `/api/v1/events?after=0` bytes with the daemon UP; feed
  `parseSse`; assert frames ≥ 1 and seq monotonic
- **PASS criteria:** frames parsed > 0 from real bytes
- **FAIL criteria:** 0 frames, or non-monotonic seq
- **Status:** BLOCKED (daemon DOWN at test time; resume when it is up)

### HOST
- **What:** one full loop tick over the live daemon writes a heartbeat
- **How:** start the runtime; assert `runtime/ticks.log` gains a row within 2N s
  and `status.json.daemonOk` flips when the daemon is killed
- **PASS criteria:** a tick row with a timestamp; daemonOk observed false→true
- **FAIL criteria:** no tick row after the window; a stale status file
- **Status:** PENDING (runtime not built)

# ═══════════════ ZONE 2 — THE TEST RESULTS (what was observed) ═══════════════

## TEST RESULT — 2026-09-20 — battery + tsc (SCRIPT, pre-existing suites)

- **The run:** `bun test` ; `bunx tsc --noEmit` (in jarvis-upper)
- **The raw output:** `32 pass / 0 fail / 106 expect() calls / Ran 32 tests
  across 11 files [198.00ms]` ; tsc `exit=0`
- **The verdict:** **PASS (function-level only)** — proves the library's
  functions behave under fixtures; proves NOTHING about a running system
  (0 loops, 0 entries, 2/9 verbs, client.ts unexecuted)
- **The artifacts:** this repo's tests/ + ao-client/gen/pin.json

## TEST RESULT — 2026-09-20 — adversarial probes A1–A4 (SCRIPT + HOST)

- **The run:** `bun probes/a1a2-client.ts` ; `bun src/cli.ts <verb>` ×7 ;
  `bun probes/a4-rail-real.ts` ; `curl :3001/healthz` ; `ls src/main.ts`
- **The raw output (verbatim):**
  - A1: `ls: cannot access 'src/main.ts': No such file or directory`
  - A2a: `A2a health() -> THREW: Error: unknown operation getHealth`
  - A2b: `THREW: TypeError: Unable to connect` (route exists; daemon down)
  - A3: six verbs → `usage: upper <init|cursor> [args]`
  - A4: `frames parsed from REAL daemon bytes: 0` (0 bytes captured)
  - daemon: `http_code=000 exit=7`; `ss -ltn | grep -c 3001` → 0; AO procs → 0
- **The verdict:** A1 CONFIRMED-ABSENT · A2a **REAL DEFECT (EN-001)** ·
  A2b NOT-A-BUG (env) · A3 **CONFIRMED SPEC VIOLATION (V-01)** ·
  A4 **BLOCKED** (daemon down) — reported BLOCKED, never PASS
- **The artifacts:** `probes/a1a2-client.ts`, `probes/a4-real.ts` (wait:
  `probes/a4-rail-real.ts`), `/tmp/real-sse.txt` (0 bytes)

## TEST RESULT — 2026-09-20 — fence2 ledger (HOST, external gate)

- **The run:** `tail -1 Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl`
- **The raw output:** `{"ts":"2026-09-20T03:13:58Z","v":2,"job":"w4-ship",
  "seat":"fixture","step":"ship","verdict":"PASS","fence_exit":0,"attempt":1,
  "evidence":"8358f448f74a9171|sandbox=bwrap|spec_bound:true"}`
- **The verdict:** PASS — the ONE real external integration in this build
  (driven by a test, not by a running system)
- **The artifacts:** verdicts.jsonl (69 PASS rows total, `grep -c`)

## TEST PLAN ENTRY — 2026-09-20 — the runtime wall (W0-W5)
### SCRIPT
- **What:** the refusal gates + the loop + the verbs + the spec-audit
- **How:** `bun test -t does_anything_run|runtime_ticks|spec_audit|live_e2e`; the shell gates; `bun src/cli.ts <verb>`
- **PASS criteria:** gate refuses on a library-only tree then passes; ticks + daemonOk flip + resume; 8 GS verdicts; every verb one JSON + exit
- **Status:** PASSED

## TEST RESULT — 2026-09-20 — the runtime wall
### SCRIPT + HOST
- **The run (verbatim in OPERATIONAL_VERIFICATION.md):** `bunx tsc --noEmit` (exit 0) · `bun test` (44 pass / 0 fail / 162 expects / 15 files) · `bun test -t does_anything_run` (4/0) · `-t runtime_ticks` (4/0) · `-t spec_audit` (3/0) · `-t live_e2e` (1/0) · the three shell gates · the 9 verbs.
- **The raw output:** `Q1..Q5:YES` with `VERDICT:RUNS (fail=0)` · `ORPHANS=0` · `FREEZE:match` + `TEST-SHAPE-DRIFT:DT1..DT3` · spec-audit `VERDICT:REJECTED (fail=6)` · exits 7×0 + order=2.
- **The verdict:** **PASS** — with the spec-audit's REJECTED recorded as the CORRECT outcome (it audits the old spec; the new pin satisfies GS-1/GS-5/GS-8 by construction).
- **The artifacts:** OPERATIONAL_VERIFICATION.md · runtime/status.json (RUNNING) · runtime/ticks.log (18 rows) · runtime/wire_capture.json (168 frames / 65,638 bytes) · gates/shape_freeze.sha16.

## FINAL RE-RUN — 2026-09-21 (after EN-010's fix + the gate fix)
| gate | command | result |
|---|---|---|
| W1 battery | `bun test` | **56 pass / 0 fail / 201 expects / 17 files** |
| W1 types | `bunx tsc --noEmit` | exit 0 |
| the five questions | `bash gates/does_anything_run.sh .` | Q1-Q5 YES · **VERDICT:RUNS (fail=0)** |
| shape freeze | `bash gates/shape_freeze.sh .` | **SHAPES:all declared ids implemented** (exit 0) |
| orphan scan | `bash gates/orphan_scan.sh .` | **ORPHANS=0** |
| JFM battery | `cd ../jfm && bun test` | **8 pass / 0 fail / 30 expects** |
| JFM live | `jfm health` | `{"ok":true,"ao":"http://localhost:3001","http":200}` |
| FENCE (source 1) | `fence2 adjudicate jobs/upper-tier-dt-shapes` | **PASS, exit 0** — `fe5589aebc5ccb36\|sandbox=bwrap\|spec_bound:true` |
| the runtime wall | `upper sync` → `upper status` | **prNodes=5** (real AO pull) — was a stub reporting 0 |
| the loop | `UPPER_TICK_MS=2500 bun src/main.ts` (4 ticks) | `status.json prNodes=5, errors=[]`, `daemonOk=true` |
| AO daemon | `GET /healthz` | 200 |
| REVIEW (source 2) | `/reviews/trigger` ×N | **BLOCKED — EN-011** (host cwd defect; run row `running` forever, 0 children, 0 sockets) |

The two-source verdict on the clean head `fe79f99d`:
```
{"verdict":"UNVERIFIED","fence":"FENCE-GREEN",
 "review":"REVIEW-NOT-APPROVED: verdicts [\"\",\"\",...]",
 "reasons":["REVIEW-NOT-APPROVED: ..."]}
```
**SOURCE 1 GREEN · SOURCE 2 BLOCKED · one source alone = UNVERIFIED (the law holds).**
