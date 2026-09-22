# RUNNING BUILD LOG — jarvis-upper

Append-only receipts. One entry per build wave. This era covers W0..W4.
Dates are `YYYY-MM-DD`. SHAs are quoted verbatim. file:line anchors are measured
from the working tree at W4.

---

## W0 — Foundation (AO vanilla install + permissions bypass)

- **Date:** 2026-09-2x
- **Agent:** Main
- **Goal:** Install AO (Agent Orchestrator v0.13.0) from the official .deb on
  this host, bypass the permission prompts, and confirm the dashboard loads.
- **What landed:**
  - AO installed from official .deb; `ao --version` reports 0.13.0.
  - Permissions bypass set at 3 levels: `ao yolo config` + the `/permissions`
    endpoint bypass + the respawn rule — so AO sessions do not prompt on tool
    calls after a fresh install.
  - Dashboard loads: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001`
    → `200`.
  - Introspected the daemon surface: `144 paths / 164 ops / 269 schemas`.
  - Confirmed AO merge model is explicit-only; SSE at `/api/v1/events?after=<cursor>`.
    AO has NO webhook/notifier/plugin surface.
- **Commit / SHA:** (AO install — host-level, no jarvis-upper commit)
- **Receipt:** `ao --version` → 0.13.0; healthz `200`; introspection
  `144 paths / 164 ops / 269 schemas`.
- **Defects opened:** (none — W0 is AO bootstrap, pre-upper-tier)
- **file:line:** (host-level — no project files changed)

## W1 — Upper-tier bootstrap (repo + gates + profile + JFM)

- **Date:** 2026-09-2x
- **Agent:** Main
- **Goal:** Stand up `jarvis-upper` as its OWN git repo, create the 3 refusal
  gates, set the worker profile, and stand up JFM as a separate repo.
- **What landed:**
  - `git init` in `/home/leviathan/JARVIS_WORKSPACE/jarvis-upper` → branch
    `main`, remote `https://github.com/leviathan-devops/jarvis-upper.git`
    (private).
  - Commit `760ad1b`: `src/main.ts:1-19` (stub), `src/runtime.ts:1-150`
    (stub → EN-003), `src/status.ts:1-48` (stub), `src/verdict.ts:1-184`
    (skeleton).
  - `gates/does_anything_run.sh:1-49`, `gates/shape_freeze.sh:1-50`,
    `gates/orphan_scan.sh:1-35` created. Initial run: RED (→ EN-001, EN-006).
  - `scripts/spec-audit.ts:1-86` created.
  - `ao-client/client.ts:1-75`, `ao-client/rail.ts:1-113`,
    `ao-client/gen.ts:1-39`, `ao-client/gen/routes.ts:1-173` scaffolded
    (144 paths surface).
  - `tests/` created; 16 test files present at W4 (see BUILD_STATE.md §3.8).
  - AO review defaults set on `jarvis-upper`: `autoReview: true`,
    `reviewers: [{"harness":"muse"}]` (`.omp/config.yml`).
  - Worker profile `~/.omp/profiles/jarvis-worker/agent/config.yml` pinned:
    default/task = `poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT).
  - JFM repo created at `/home/leviathan/JARVIS_WORKSPACE/jfm/` (branch `main`),
    symlinked `~/.local/bin/jfm`. JAM desk core IMPORTED from
    `Shared_Workspace/JARVIS/src/desk-orchestrator.ts:1-1080` (never forked).
    JFM modules: `jfm/src/cli.ts:1-155`, `jfm/src/ao-transport.ts:1-133`,
    `jfm/src/pin.ts:1-55`, `jfm/src/desk.ts:1-78`, `jfm/src/watch-ao.ts:1-84`,
    `jfm/src/gate.ts:1-7`.
  - Blueprint of record `reports/JFM_Blueprint_v1.md:1-395` committed.
- **Commit / SHA:** `760ad1b`
- **Receipt:** W1 establishes the factory shell + the three gates + the worker
  profile pin + JFM. Completion NOT claimed — does-anything-run gate still RED.
- **Defects opened:** EN-001, EN-003, EN-006, EN-007, EN-008, EN-009, EN-010.
- **file:line:** `src/main.ts:1-19`, `gates/does_anything_run.sh:1-49`.

## W2 — Runtime green + two-source law wired

- **Date:** 2026-09-2x
- **Agent:** Main
- **Goal:** Implement the runtime tick loop, drive all 3 gates + battery + tsc
  green, and finalize the two-source verdict law in `verify()`.
- **What landed:**
  - `src/runtime.ts:1-150` tick loop implemented; `UPPER_TICK_MS=3000` wired.
  - `src/status.ts:1-48` publishes `runtime/status.json:1-13`;
    `runtime/ticks.log:1-5005` appends each 3000ms.
  - `runtime/wire_capture.json:1-7` frozen frame: `parsedFrames=168,
    bytes=65638`.
  - `src/verdict.ts:1-184` finalized: `verify({jobDir, headSha, sessionId})`
    returns VERIFIED iff (1) fence2 adjudicate exit 0 AND (2) AO review approves
    the same head sha.
  - Gate G1 → `VERDICT:RUNS (fail=0)`; G2 → `SHAPES:all declared ids
    implemented`; G3 → `ORPHANS=0`.
  - `bunx tsc --noEmit` → exit 0; `bun test` → `52 pass / 0 fail / 183 expects
    / 16 files`; `bun test -t two_source_verdict` → `8 pass / 0 fail`;
    `bun test -t jfm_verbs` → `8 pass / 0 fail`.
- **Commit / SHA:** `732083e`
- **Receipt:** all gates PASS; runtime RUNNING (tick >3000).
- **Defects closed:** EN-001 (via W3 job), EN-003, EN-006.
- **file:line:** `src/runtime.ts:1-150`, `src/verdict.ts:1-184`.

## W3 — Factory jobs (AO spawn → PR)

- **Date:** 2026-09-2x
- **Agent:** Main + AO factory workers
- **Goal:** Prove the AO factory can spawn a Poolside-Direct worker, fix a real
  bug, commit, push, open a PR, and fence2 + AO-review the result.
- **What landed:**
  - Job `jarvis-upper-2` (worker/omp/tui, profile `jarvis-worker`,
    OMP_PROFILE=jarvis-worker) fixed the DT-shapes drift bug (EN-001).
  - PR #1 opened: `https://github.com/leviathan-devops/jarvis-upper/pull/1`,
    branch `ao/jarhus-upper-2/root`, commits `760ad1b`, `732083e`, `adbdacf`,
    head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`.
  - fence2 adjudicate for job `upper-tier-dt-shapes` on head
    `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`: verdict PASS,
    evidence `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` (G10 PASS).
  - Fence sandbox confirmed `bwrap --unshare-all` (no network); DB_1's hermetic
    step runs offline BY DESIGN.
  - AO review: autoReview:true + reviewers:muse on jarvis-upper +
    jarvis_orchestrator. AO REJECTS `omp` harness
    (`INVALID_PROJECT_CONFIG`). Reviewer-capable installed: muse/aider/cursor.
  - Job `jfm-e2e-1` (worker) produced first end-to-end spawn→commit→push→PR:
    `https://github.com/leviathan-devops/jfm-e2e/pull/1`, commit `cce7bdb`,
    `E2E-PROOF.txt` = `DT1-OK`.
  - EN-007 noted: ripwire crawl root EXCLUDES jarvis-upper → graph gate cannot
    verify edits here.
  - EN-008 noted: daemon stale run-file + rotating X cookie.
  - EN-009 noted: checkpoint test copies re-ran.
  - EN-010 noted: `upper sync` is a STUB (returns prNodes 0 while PR open).
  - EN-019 noted: desk-local model pin invisible to AO spawns → removed.
  - EN-020 noted: PAT burned (embedded in git remote URL, printed) → operator
    rotation required.
- **Commit / SHA:** `adbdacf` (PR #1 head); `cce7bdb` (jfm-e2e)
- **Receipt:** fence2 PASS on frozen sha; PR #1 OPEN; factory proven end-to-end.
- **Defects noted:** EN-007, EN-008, EN-009, EN-010, EN-019, EN-020.
- **file:line:** `src/verdict.ts:1-184`, `ao-client/session.ts` (OMP_PROFILE).

## W4 — Canon docs (this wave, docs-only)

- **Date:** 2026-09-21
- **Agent:** CanonDocs
- **Goal:** Write the 11 canon context docs into `context_management/` for a
  fresh agent. No source change this wave; all gates re-verified PASS.
- **What landed:**
  - 11 canon docs written (this folder): POST-COMPACTION_PROMPT, CURRENT_STATE,
    NEXT_STEPS, TASK_QUEUE, BUILD_STATE, CHANGELOG, COMPACTION_SURVIVAL,
    EVIDENCE_STATE, DECISION_CHAIN, RUNNING_BUILD_LOG, RUNNING_DEBUG_LOG.
  - Re-verification: `bun test` → `52 pass / 0 fail / 183 expects / 16 files`;
    `bunx tsc --noEmit` → exit 0; `bun test -t two_source_verdict` →
    `8 pass / 0 fail`; `bun test -t jfm_verbs` → `8 pass / 0 fail`.
  - Gates re-verified: `VERDICT:RUNS (fail=0)` / `SHAPES:all declared ids
    implemented` / `ORPHANS=0`.
  - Runtime re-verified: `bun src/cli.ts status` → `RUNNING (tick >3000)`.
  - AO daemon still `200`; fence2 PASS row unchanged
    (`6954bafbd4918f75|sandbox=bwrap|spec_bound:true`).
  - PR #1 still OPEN (head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`).
  - `upper sync` still STUB (EN-010).
- **Commit / SHA:** (none — docs-only wave)
- **Receipt:** W4 codifies the W0–W3 verified state. The two-source verdict
  loop is NOT closed until G11 (AO review approval of
  `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`) is observed. Per D-004, that is
  BOOLEAN FALSE until both gates pass on the same sha.
- **file:line:** (all `context_management/*.md`)

## 11. WAVE INDEX

| Wave | Focus | Key commit | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G9 | G10 | G11 | G12 |
|------|-------|------------|----|----|----|----|----|----|----|-----|-----|-----|-----|
| W0 | AO install + perms | — | — | — | — | — | — | — | — | — | — | — | — |
| W1 | upper-tier bootstrap | `760ad1b` | RED | RED | RED | RED | RED | RED | RED | RED | — | — | — |
| W2 | runtime + law | `732083e` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | — | — | — |
| W3 | factory jobs | `adbdacf` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | OPEN | OPEN |
| W4 | canon docs | (none) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | OPEN | OPEN |

## 12. WAVE → DEFECT MAP

| Wave | Defects opened | Defects closed | Defects noted |
|------|----------------|----------------|---------------|
| W0 | — | — | — |
| W1 | EN-001, EN-003, EN-006, EN-007, EN-008, EN-009, EN-010 | — | — |
| W2 | — | EN-003, EN-006 | — |
| W3 | — | EN-001 | EN-007, EN-008, EN-009, EN-010, EN-019, EN-020 |
| W4 | — | — | — |

## 13. WAVE → EVIDENCE MAP

| Wave | G1 | G5 | G9 | G10 | G11 |
|------|----|----|----|-----|-----|
| W0 | — | — | — | — | — |
| W1 | RED | RED | RED | — | — |
| W2 | `VERDICT:RUNS (fail=0)` | `52 pass / 0 fail / 183 expects / 16 files` | `RUNNING (tick >3000)` | — | — |
| W3 | PASS | PASS | PASS | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` | OPEN |
| W4 | PASS (re-verify) | PASS (re-verify) | PASS (re-verify) | PASS (unchanged) | OPEN |

End of RUNNING_BUILD_LOG.
## 14. PER-WAVE COMMIT INVENTORY

  `cce7bdb` (jfm-e2e PR #1).

## 15. PER-WAVE TOKEN CHECKLIST

  SSE live; no plugin surface.
  JFM installed; blueprint 395L.
  expects / 16 files`; G9 `RUNNING (tick >3000)`; wire_capture `parsedFrames=168,
  bytes=65638`; two-source law in `src/verdict.ts:1-184`.
  jfm-e2e `cce7bdb` / `DT1-OK`; AO review muse (omp rejected); EN-007/008/009/010/019/020 noted.
  fence2 unchanged; 11 canon docs written; G11 OPEN; G14 BLOCKED.

## 16. RESUME POINT (W5 entry)

```bash
DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) \
  /usr/bin/agent-orchestrator
# if refuses: mv ~/.ao/running.json /tmp/running.json.stale ; retry
```
Then re-verify all gates (§15) before doing anything else.

End of RUNNING_BUILD_LOG.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
- **VERDICT: VERIFIED** — fence PASS `spec_bound:true` + review `approved`, SAME sha
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green · jfm 8/0
- **jfm wave w0:** the desk `upper-tier-job` closed, `unverdicted: []`

---

## [2026-09-22 22:28] ★ THE GITHUB MASTER KERNEL BUILD — W1 FIRED

**The pin:** `JARVIS-FACTORY/packages/github-master-kernel/08-GOAL-PIN.txt` (163 L, validator PASS,
7/7 slots). The build package: `00-MISSION` · `01-DISCOVERY` · the DPL1 spec · `06-WAVES` (`WAVES: 6`).

### THE FIRST REPLY — the baseline re-measured (NO DRIFT)

| the metric | the pin said | measured | the diff |
|---|---|---|---|
| tsc | exit 0 | exit 0 | MATCH |
| the battery | 69 pass / 0 fail | 69 pass / 0 fail / 250 expects | MATCH |
| the contract | 7 contexts | 7 contexts | MATCH |
| the hooks | 4 files, 755 | 4 files | MATCH |
| core.hooksPath | `.githooks` | `.githooks` | MATCH |
| the CI | 5 jobs never run | `gates.yml` + `drift.yml` present | MATCH (unrun) |
| disk | 72 GB free | 72 GB free | MATCH |

**Zero drift.** W1 fired the same turn.

### THE ROUND-ZERO CHECKPOINT

`Checkpoints/round-zero-pre-w1-20260922-222831/` — 64 files, 464K.
Contents: `src/` (20 files) · `.githooks/` (4) · `.github/` (6) · `context_management/` (11) ·
`tests/` (19) · `ruleset.json` · `package.json` · `CHECKPOINT_MANIFEST.md`.
**Seal mode: no-lock** (the build is active; a full-tree lock would block W1).
Restore: `git reset --hard d71cc5d` + `git config core.hooksPath .githooks`.

### W1 — THE INTERFACES WAVE (fired)

**The deliverable:** the GATE-HEADER STANDARD — `.githooks/lib/pattern-header.sh`.
**The law it installs:** *a gate is a (predicate x artifact-class) pair.* Every gate header MUST
name (a) its Jev count and (b) the ARTIFACT CLASS it applies to.

**Why this wave exists:** two defects this session were the SAME class —
- W-1 fired on every `src/` commit (derived from a repo WITH `extensions/`; this repo has none)
- W-9 demanded a 100-line GitHub PR template (derived for engineering docs)

Both produced a gate that fires on everything — and a gate that fires on everything gets bypassed.

### THE JEV INDEX (built this session)

`failurepatterns.sqlite` — 298 files, 6,117,246 bytes hashed, 157 ms, KEYLESS.
The measured pattern frequencies: `silent` 119 · `theatrical` 92 · `phantom` 70 · `stub` 68 ·
`unwired` 26 · `scope-shrink` 11 · `SHAPE-WITHOUT-REACHABILITY` 9 · `derail` 7 · `UNBUILT DELIVERY` 4.

### THE GATES TO COME (each named with its Jev count + artifact class)

| the wave | the gates | the Jev n |
|---|---|---|
| W2 | silent-fallback + no-stub | 119 + 68 |
| W3 | claim-evidence (ABSOLUTE) + phantom + reachability | 70 + 26 |
| W4 | the 5-job CI + theatrical-verification | 92 |
| W5 | the publisher wired + the false-green guard | — |
| W6 | the ruleset + governance | — |

**The W-1/W-9 fix is the standard, not a patch:** `.githooks/pre-commit:47` carries
`[ -d extensions ]`; `.githooks/pre-commit:24` carries the `.github/*` exemption. W1 makes the
pattern a header every gate must carry.

---

## [2026-09-22 22:44] ★ THE REMOTE LAYER IS LIVE — THE RULESET + THE FIRST CI RUN

### THE KEYSTONE — FIRING 007

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - 7 of 7 required status checks are expected.
remote: - Changes must be made through a pull request.
 ! [remote rejected] main -> main (push declined due to repository rule violations)
```
**A fresh clone with ZERO local hooks was refused by GitHub.** The remote main did not move.
The ruleset is ARMED at id `23838059`, `enforcement: active`, `bypass_actors: []`.

### THE THREE BLOCKERS THAT FELL

| # | the error | the truth |
|---|---|---|
| 1 | `403 Upgrade to GitHub Pro` | the gate is `private + free` — the PUBLIC control returned `[]` |
| 2 | `422 Invalid property /rules/1` | `_comment` is an unknown top-level field |
| 3 | `422 evaluate is not supported on this plan` | **`evaluate` is Enterprise-only** — armed `active` |

### THE FIRST CI RUN — AND THE DEFECT IT FOUND

Pushing the branch (`feat/github-master-kernel`, 14 commits ahead of main) fired the workflow for
the first time in the repo's history. It failed with **zero jobs created** — a workflow-file
issue. The cause: the job IDs contain a slash. See **EN-101**.

### THE STATE

| the metric | the value |
|---|---|
| the ruleset | ARMED, id 23838059, 7 contexts, bypass_actors [] |
| the CI | ENABLED, fired once, the workflow file has a defect (steered to W4) |
| the branch | `feat/github-master-kernel` on the remote (14 commits ahead of main) |
| the battery | 70 pass / 0 fail |
| the hooks | 4 + `lib/pattern-header.sh` (the W1 standard) |
| W1 | DONE — the gate-header standard landed |
| W2/W3/W4 | IN FLIGHT |

## [2026-09-22T21:19:50Z] — P3 DISPATCH: the four hardening waves (the ocr-FAIL campaign)
- WHAT: dispatched W1-W4 as four PARALLEL subagents on DISJOINT file sets. W1 `.githooks/**` (33
  findings) · W2 `.github/**` (7) · W3 `src/*.ts` (61 deduped) · W4 `scripts/**`+`gates/**`+
  `W6_ARM_COMMAND.sh`+the stub+`.gitignore` (27). Total 128 findings.
- WHY: the ocr ship gate — the gate this repo's doctrine says blocks every ship claim — returned
  FAIL (36 high / 77 medium / 15 low, session_id fc337185). The kernel enforces verification and had
  never been verified by its own standard.
- HOW: each desk got its findings file (`.trident/findings/W<n>.md`), the fix contracts
  (MASTER_PROMPT §17-18), the adjudicate-both-sides law, the contract freeze, and the
  no-Checkpoints-edit law. Verification: `bash -n` + `bunx tsc --noEmit` + `bun test` 78/0.
- EVIDENCE: baseline re-measured THIS turn — 78 pass / 0 fail / 335 expects · tsc exit 0 · ocr
  FAIL 36 high (`.trident/ocr-findings-e9ff02b.json`).
- NEXT: audit the four returns per-hunk; re-run the combined battery + tsc; re-run the ocr gate at
  the wave boundary (the DONE condition is ocr PASS 0 critical/0 high).
