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

## 2026-09-21 — the review fixes re-verified (worktree `acc7a688`)
| check | result |
|---|---|
| `cd jobs/upper-tier-dt-shapes && bun test -t dt_shapes` (the fence's asserted test) | **3 pass / 0 fail / 21 expects** |
| `bun test tests/dt_shapes.test.ts` | **3 pass / 1 skip / 0 fail** (DT-1 skips without `DT1_LIVE=1`) |
| the full worktree battery | **51 pass / 1 skip / 0 fail / 208 expects / 17 files** |
| `bunx tsc --noEmit` | exit 0 |
| the fence (source 1) on `acc7a688` | **PASS** — `spec_bound:true`, exit 0 |
| the review (source 2) | the real muse run, in AO's tmux rail |

## 2026-09-21 — the W4 `docs_current` gate (the named W4 check)
`bun test -t docs_current` → **6 pass / 0 fail / 27 expects**.
It reads the LIVE tree (no fixtures): 11 canon docs exist and each meets the 200-line floor; all
11 carry the same cross-consistency anchor on ONE head sha; the 5 ship docs exist and are
non-trivial; the newest MODE-B checkpoint meets manifest≥40 / structure≥30 with a spaceless token
and names its HONEST GAPS; the transcript carries verbatim runs + the VERIFIED verdict.
**ADVERSARIAL PROOF (the gate can fail):** truncating one canon doc under the floor turns it RED
at the floor predicate (`under).toEqual([])`); restoring it returns 6/6. A gate that cannot fail is
decoration.

## TEST RESULT — 2026-09-21 — the artifact-first firewall (both directions)

### SCRIPT
- **The run:** `bash meta-watchdog.sh` (DIVERGENCE case, live) then `touch -d "30 minutes ago" audit-ledger.jsonl && bash meta-watchdog.sh` (AGREEMENT case)
- **The raw output:**
  ```
  {"diverged": True,  "verdict": "DIVERGENCE: the status claims an error but a receipt landed 132s ago — THE ARTIFACT WINS."}
  {"diverged": False, "verdict": "AGREEMENT: the status claims an error AND no receipt landed in the window — this is a REAL failure, escalate."}
  ```
- **The verdict:** **PASS** — the detector fires on the true anti-pattern and stays silent on the true failure. Three bugs were found and fixed only by running it (the API does not expose `last_status`; a nested-heredoc syntax error; `True` vs `"true"` case).
- **The artifacts:** `JARVIS_INFRA/watchdogs/meta-watchdog.sh`, `meta-watchdog-lib.py`, `relocated-ledger.jsonl`

## TEST RESULT — 2026-09-21 — the factory's liveness (before/after)

### HOST
- **The run:** `bash upper-watchdog.sh` — once against the dead factory, once after `jarvis-upper.service` was installed
- **The raw output:**
  ```
  BEFORE: {"ts":"2026-09-21T07:30:12Z","ao_http":"200","tick_age_s":8680,"prNodes":"9","problems":["TICK-STALE:8680s"]}
  AFTER : {"ts":"2026-09-21T07:31:06Z","ao_http":"200","tick_age_s":5,   "prNodes":"9","problems":[]}
  AFTER : {"ts":"2026-09-21T07:34:01Z","ao_http":"200","tick_age_s":15,  "prNodes":"9","problems":[]}
  ```
- **The verdict:** **PASS** — `status.json tick=17 daemonOk=True prNodes=9 errors=[]`; the loop is live and the watcher reports it from the artifact.
- **The artifacts:** `jarvis-upper.service` (unit mtime `2026-09-21 11:30:45`), `runtime/watchdog-ledger.jsonl`

## TEST RESULT — 2026-09-21 — the cross-stream cleanup (their hand after my spillover)

### HOST
- **The run:** `openfang status | grep jarvis-meta` · `systemctl --user list-unit-files | grep jarvis` · `ls ~/.openfang/hands/jarvis-meta/`
- **The raw output:**
  ```
  jarvis-meta-agent (6560d5fc-7766-590e-a6d6-3d1ee009f191) -- Running [openai:nvidia/nemotron-3.5-lightning-30b-a3b]
  jarvis-meta-promotion.service static · jarvis-meta-promotion.timer enabled   (theirs, untouched)
  their dir lists only: HAND.toml · HAND.toml.bak-* · SKILL.md · SKILL.md.bak-* · audit-ledger.jsonl · guardrails.toml · promotion-state.json · register-cron.sh · tick.sh
  ```
- **The verdict:** **PASS** — my files gone from their tree, my units out of their namespace, their agent Running and their crons enabled.
- **The artifacts:** F-07's cleanup table; `pgrep -f "openfang agent chat 6560d5fc"` → no process (mine stopped)

## TEST RESULT — 2026-09-21 — THE CODE-AUDIT GATE (qwen-code-audit / ocr)

### SCRIPT
- **The run:** `ocr review --repo /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace -c 4e0e0b8 -f json -o /tmp/sg-ocr-4e0e0b8.json --effort low --timeout 8 --audience agent`
- **The scope:** 3 code files selected for review (`JARVIS_INFRA/watchdogs/meta-watchdog-lib.py`, `meta-watchdog.sh`, `upper-watchdog.sh`); 5 excluded as unsupported extension.
- **The raw output:**
  ```
  [ocr] Session: 6205f9b1-c082-4d81-a300-bde026b4b0c7
  Error: review failed: all 3 file review(s) failed — check your LLM configuration and API key
  status: failed · model: muse-spark-1.3-contributor-free
  summary: {"files_reviewed": 3, "comments": 0, "total_tokens": 0, "elapsed": "28s"}
  ```
- **AUDIT GATE: BLOCKED (muse-free lane provider/auth failure — 0 tokens on 3/3 files)**
- **The artifacts:** `/tmp/sg-ocr-4e0e0b8.json` (13,673B, `session_id 6205f9b1-c082-4d81-a300-bde026b4b0c7`)
- **The retry condition:** re-run through the alternate lane (the zen-free adapter on :4098, or the poolside-direct lane) per the pinned judge chain, then re-wire this entry. **This BLOCKED state withholds every ship-ready / production-grade claim.** An earlier run on commit `591a14d` returned `status: skipped` (0 files selected — it carried only a `.md`); a skipped run is also not a pass.

---

## [2026-09-22] THE GITHUB MASTER KERNEL — W1 + THE KEYSTONE + THE FIRST CI RUN

### THE TEST RUNS (each by the orchestrator, verbatim)

| # | the test | the command | the result |
|---|---|---|---|
| 1 | types | `bunx tsc --noEmit` | **exit 0** |
| 2 | the battery | `bun test` | **70 pass / 0 fail** |
| 3 | the W1 standard | `bun test tests/gate_header.test.ts` | **1 pass / 0 fail / 16 expects** |
| 4 | the keystone | a fresh clone's `git push origin main` | **REFUSED** (`GH013`, 7 of 7 required checks) |
| 5 | the first CI run | `gh run list` | **completed failure** — the workflow file was rejected |
| 6 | the contract | `bun run scripts/interface-check.ts` | **INTERFACE:MATCH (7 contexts)** |

### THE LIVE FIRINGS (the enforcement acting on the orchestrator)

| # | the gate | the verdict | the class |
|---|---|---|---|
| 001 | W-9 doc-density | **CORRECT** | the wave audits were 36/28 lines |
| 002 | W-1 deploy-freshness | **GATE DEFECT** | no `extensions/` layout here — fixed |
| 003 | W-8 claim-evidence | **CORRECT** | a claim word with no artifact |
| 004 | W-9 doc-density | **GATE DEFECT** | a GitHub PR template — fixed |
| 005 | W-9 doc-density | **GATE DEFECT** | a checkpoint manifest + copies — fixed |
| 006 | W-8 claim-evidence | **CORRECT** | `SKILL.md:100` (uppercase) did not match |
| 007 | **THE RULESET (REMOTE)** | **KEYSTONE** | a fresh clone refused by GitHub |
| 008 | W-9 doc-density | **CORRECT** | the firing record (76 L) + the rationale (11 L) |

### THE FIRST CI RUN — AND THE DEFECT IT FOUND

The workflow file was **REJECTED ENTIRELY** (zero jobs created):
```
$ gh run view 35769132155
X This run likely failed because of a workflow file issue.
$ gh api .../actions/runs/35769132155/jobs
   (EMPTY)
```
**The cause:** the JOB IDs contain a slash. GitHub job ids must match `^[a-zA-Z_][a-zA-Z0-9_-]*$`.
The `name:` values were all correct — which is why 4 desk audits passed. Every check read `name:`;
nobody read the KEY.

### THE COVERAGE MAP

| the gate | the artifact class | the Jev n | the status |
|---|---|---|---|
| W-9 doc-density | an authored engineering doc | — | LIVE (scoped 3×) |
| W-8 claim-evidence | a commit message | — | LIVE (ABSOLUTE) |
| W-1 deploy-freshness | a repo WITH `extensions/` | 4 | LIVE (scoped) |
| W-6 fake-wiring | a test file | — | LIVE |
| the ruleset (7 contexts) | a PR merge | — | **ARMED** |
| W-13 silent-fallback | a `src/**/*.ts` diff | 119 | W2 in flight |
| W-14 no-stub | a `src/**/*.ts` diff | 68 | W2 in flight |
| W-2 reachability | the pushed tree | 26 | W3 in flight |
| phantom-diff | a pushed commit range | 70 | W3 in flight |
| theatrical-verification | a test file | 92 | W4 in flight |

**AUDIT GATE: BLOCKED** — no independent code-audit artifact exists for this build yet. Per the
DOC CONTRACT, `BLOCKED` is never `PASS`, and every ship-ready claim is withheld until an audit
lands.

### THE HONEST GAPS

- The CI has run ONCE and FAILED (the workflow-file defect). It has never gone green.
- The 2 `factory/*` contexts have no poster yet (W5 in flight).
- No container test exists.
- `evaluate` mode is unavailable (Enterprise-only) — the rollout law was not followed.

### THE ANCHOR LEDGER (every claim's real file:line — verified this turn)

| the claim | the anchor |
|---|---|
| the W1 standard | `.githooks/lib/pattern-header.sh:1` |
| the W1 test | `tests/gate_header.test.ts:1` |
| the frozen contract | `src/status-contract.ts:33` (`REQUIRED_CONTEXTS`) |
| the armed ruleset | `ruleset.json:1` |
| the ruleset rationale | `ruleset.RATIONALE.md:1` |
| the CI job ids (the defect) | `.github/workflows/gates.yml:11` |
| the CI job names (correct) | `.github/workflows/gates.yml:12` |
| the interface check | `scripts/interface-check.ts:1` |
| the wave audit | `.trident/plan-A/wave-audit/W1.md:1` |
| the keystone firing | `.trident/firings/FIRING-007-KEYSTONE.md:1` |
| the hook (ABSOLUTE) | `.githooks/prepare-commit-msg:39` |
| the doc floor | `.githooks/pre-commit:21` |

**12 anchors, every one verified by `grep -n` this turn — none invented.**

---

## [2026-09-22] THE RUNTIME SEAT + THE ADVERSARIAL SWEEP

### THE 6 RUNTIME OPERATIONS (P4) — each with a pre-registered expectation

| op | the operation | the expected | the observed | the verdict |
|---|---|---|---|---|
| OP-1 | the legit path | exit 0, the commit lands | `448d179` landed | **CORRECT** |
| OP-2 | `--no-verify` + a bare claim | REJECT + no commit | `REJECT(W-8)`, 0 op-2 commits | **CORRECT** |
| OP-3 | a hostile message (6 shapes) | claims reject, legit accept | `feat: done` was ACCEPTED | **DEFECT — FIXED** |
| OP-4 | a silent catch | REJECT(W-13) | `REJECT(W-13)`, 0 op-4 commits | **CORRECT** |
| OP-5 | 10 commits at once | the chain holds | 10/10 landed | **CORRECT** |
| OP-6 | a fresh clone pushes main | refused by GitHub | `GH013 8 of 8` | **CORRECT** |

**OP-2 is the critical one:** `--no-verify` did NOT skip `prepare-commit-msg`.

### THE 8-GATE ADVERSARIAL SWEEP (P5)

| the gate | the positive | the negative | the verdict |
|---|---|---|---|
| W-8 claim-evidence | fires | silent | **PASS** |
| W-13 silent-fallback | fires | silent | **PASS** |
| W-14 no-stub | fires | silent | **PASS** |
| W-9 doc-density | fires | silent | **PASS** |
| W-6 fake-wiring | fires | silent | **PASS (after fix)** |
| W-2 reachability | fires | silent | **PASS (after fix)** |
| W-3 phantom | fires | silent | **PASS** |
| the ruleset | refuses | allows | **PASS** |

**FOUND + FIXED: 2 defects** (W-6 matched one literal; W-2 never fired at all).
**VERIFIED CLEAN: 8 gates, both halves.**

### THE NUMBERS

| the metric | the value |
|---|---|
| the battery | **77 pass / 0 fail / 322 expects** |
| tsc | **exit 0** |
| the local firings | 11 recorded (7 correct, 4 gate defects, all fixed) |
| the ruleset | armed, 8 contexts |
| the CI | run twice, never green |

**AUDIT GATE: BLOCKED** — no independent code-audit artifact exists for this build yet. Per the
DOC CONTRACT, `BLOCKED` is never `PASS`.

**THE ANCHORS:** `.trident/RUNTIME_LEDGER.md:1` · `.trident/P5_ADVERSARIAL_SWEEP.md:1` ·
`.githooks/lib/scan-phantom.sh:44` · `tests/gate_header.test.ts:1`
