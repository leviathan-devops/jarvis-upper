# RUNNING DEBUG LOG — jarvis-upper

High-frequency debug log. One entry per defect. This era records EN-001..EN-010
(active this build era) plus EN-019 and EN-020 (recorded context). Dates are
`YYYY-MM-DD`. file:line anchors are measured from the W4 working tree.
Format per entry: ID, date, symptom, root cause, fix, evidence, file:line, status.

---

## EN-001 — client health() called a nonexistent operation

- **Date:** 2026-09-2x (W1)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-001)
- **Symptom:** The AO client's `health()` probe (`ao-client/client.ts:1-75`,
  the transport path it used) failed; AO returned an error because the client
  invoked an AO operation id that does not exist in the AO schema set
  (144 paths / 164 ops / 269 schemas). The client and daemon were out of sync.
- **Root cause:** `ao-client/client.ts` (or the rail it used,
  `ao-client/rail.ts:1-113`) called an AO operation id that the W1 AO
  introspection did not surface. The operation was removed/renamed between the
  AO vanilla install (W0) and the W1 client scaffold.
- **Fix:** Resolved by the `jarvis-upper-2` factory worker job (W3). The worker
  corrected the operation id the client calls so it matches a real AO op. The
  gate `bash gates/does_anything_run.sh .` (49L) went GREEN in W2 (post-fix).
- **Evidence:** Gate G1 `VERDICT:RUNS (fail=0)` green in W2; AO healthz `200`.
  PR #1 (`ao/jarhus-upper-2/root`) carries the fix.
- **file:line:** `ao-client/client.ts:1-75`, `ao-client/rail.ts:1-113`,
  `gates/does_anything_run.sh:1-49`.
- **Status:** FIXED (closed by `jarvis-upper-2` job, W3).

---

## EN-003 — no entry/loop (runtime had no tick)

- **Date:** 2026-09-2x (W1)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-003)
- **Symptom:** On W1 bootstrap `src/main.ts:1-19` + `src/runtime.ts:1-150`
  were stubs; there was no entry point that looped, and no tick.
- **Root cause:** The runtime was stubbed in W1 to establish the AO daemon +
  gates first; the tick loop had not been implemented yet.
- **Fix:** W2 implemented `src/runtime.ts:1-150` with `UPPER_TICK_MS=3000`.
  `src/status.ts:1-48` publishes `runtime/status.json:1-13`;
  `runtime/ticks.log:1-5005` appends each 3000ms.
- **Evidence:** `bun src/cli.ts status` → `RUNNING (tick >3000)`. Gate G1 PASS.
- **file:line:** `src/main.ts:1-19`, `src/runtime.ts:1-150`, `src/status.ts:1-48`,
  `runtime/status.json:1-13`, `runtime/ticks.log:1-5005`.
- **Status:** FIXED (W2).

---

## EN-006 — a healthy idle stream flagged as an error

- **Date:** 2026-09-2x (W1)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-006)
- **Symptom:** The AO SSE stream (`/api/v1/events?after=<cursor>`) goes idle
  between events; the stream monitor flagged a quiet stream as an error.
- **Root cause:** The monitor in `jfm/src/watch-ao.ts:1-84` (INST-1/2/4)
  interpreted "no events for N seconds" as a failure rather than normal idle
  behavior for a push-based event stream.
- **Fix:** Relaxed the idle-threshold logic so an idle stream is not flagged as
  an error; only a non-200 / connection-reset is an error.
- **Evidence:** `jfm watch` / AO SSE stays green when idle. Gate G1 PASS.
- **file:line:** `jfm/src/watch-ao.ts:1-84`.
- **Status:** FIXED (W2).

---

## EN-007 — ripwire crawl root EXCLUDES jarvis-upper

- **Date:** 2026-09-2x (W2/W3)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-007)
- **Symptom:** The ripwire graph gate (`ripwire` tool) cannot verify edits
  inside `jarvis-upper/` because ripwire's crawl root EXCLUDES the
  jarvis-upper directory (the graph engine is scoped to `Shared_Workspace`).
- **Root cause:** Intentional scoping — the GI graph gate (corbell + ripwire)
  is bound to the `Shared_Workspace` crawl root and does not descend into
  `jarvis-upper`.
- **Fix / mitigation:** No code fix needed — this is the intended scope. Edits
  in `jarvis-upper` verify via grep + tsc + battery + fence2 (not via the graph
  gate). The graph gate still applies to `Shared_Workspace/JARVIS-CORE/b6`
  and the JAM desk core.
- **Evidence:** `bash gates/orphan_scan.sh .` (35L) → `ORPHANS=0` (runs locally,
  not via graph). `bun test` green. fence2 PASS.
- **file:line:** `gates/orphan_scan.sh:1-35` (local fallback); ripwire config is
  project-scoped (not a jarvis-upper file).
- **Status:** DOCUMENTED (not a bug to fix; scoping rule). See COMPACTION_SURVIVAL
  §4.1 + DECISION_CHAIN.md L7.

---

## EN-008 — daemon stale run-file + rotating X cookie

- **Date:** 2026-09-2x (W2/W3)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-008)
- **Symptom:** The AO daemon (`agent-orchestrator`) refuses to resume when the
  display/auth state is stale.
- **Root cause:** Two coupled issues: (a) `~/.ao/running.json` can go stale
  after a crash/reboot; (b) the X-wayland auth cookie at
  `/run/user/1000/.mutter-Xwaylandauth.*` rotates between daemons, so a
  hard-coded `XAUTHORITY` is wrong on resume.
- **Fix:** The daemon resume recipe resolves the LIVE cookie every time:
  ```bash
  DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) \
    /usr/bin/agent-orchestrator
  ```
  And if the daemon refuses, park the stale run file:
  ```bash
  mv ~/.ao/running.json /tmp/running.json.stale
  ```
- **Evidence:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz`
  → `200` after the recipe.
- **file:line:** (daemon config — host-level, not a project file;
  COMPACTION_SURVIVAL.md §1 has the recipe).
- **Status:** MITIGATED (recipe in COMPACTION_SURVIVAL.md §1). The cookie
  rotation is inherent to the Wayland host; the recipe is the fix.

---

## EN-009 — checkpoint test copies re-ran

- **Date:** 2026-09-2x (W2/W3)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-009)
- **Symptom:** Checkpoint tests re-ran during a wave, producing duplicate work
  / flaky state in the shared checkpoint directory.
- **Root cause:** The checkpoint test harness did not guard against re-entry
  when the same checkpoint job id appeared across waves.
- **Fix:** Pinned the checkpoint test so each job id runs once per wave; the
  harness now dedups by job id + head sha.
- **Evidence:** `bun test` → `52 pass / 0 fail / 183 expects / 16 files`
  (stable across W2/W3/W4).
- **file:line:** (checkpoint harness — `Checkpoints/` in the repo, not a
  `tests/` file; see `runtime-wall-five-questions-green-status-running/`).
- **Status:** FIXED (pinned).

---

## EN-010 — `upper sync` is a STUB

- **Date:** 2026-09-2x (W2/W3)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-010)
- **Symptom:** `upper sync` returns `prNodes 0` while a PR is actually open
  (PR #1 is OPEN at head `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`).
- **Root cause:** The sync path in `src/sync.ts` is a STUB — it does not yet
  call the AO PR / node layer; it returns a constant 0.
- **Fix:** PENDING (next wave, NEXT_STEPS.md W5b.1). The stub must call the
  real AO PR surface and return live prNodes.
- **Evidence:** `upper sync` → `prNodes 0`; PR #1 OPEN.
- **file:line:** `src/sync.ts` (lines not measured — STUB).
- **Status:** OPEN (STUB). Tracked as G14 BLOCKED; queued in NEXT_STEPS.md W5b.

---

## EN-011 — gate G13 spec-audit not auto-triggered per job

- **Date:** 2026-09-2x (W3)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-011)
- **Symptom:** `scripts/spec-audit.ts:1-86` exists but is not invoked
  automatically per AO job, so a job can claim completion without a spec audit.
- **Root cause:** The spec-audit gate is manual (`bun run scripts/spec-audit.ts`),
  not wired into the AO spawn→fence2→review pipeline.
- **Fix:** PENDING. Wire `scripts/spec-audit.ts:1-86` into the dispatch path so
  every AO job runs it before G11 (AO review) is considered.
- **Evidence:** `bun run scripts/spec-audit.ts` is not in the W3 factory-job
  receipts.
- **file:line:** `scripts/spec-audit.ts:1-86`.
- **Status:** OPEN (G13 BLOCKED). Queued in NEXT_STEPS.md W5b / TASK_QUEUE G13.

---

## EN-019 — desk-local model pin invisible to AO spawns

- **Date:** 2026-09-2x (W3)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-019, context)
- **Symptom:** A model pin set at the desk level was NOT picked up by AO
  spawns; spawns used the global default instead.
- **Root cause:** AO spawns carry `OMP_PROFILE=jarvis-worker` (the project
  env on jarvis-upper, jarvis_orchestrator, scratch, jfm-e2e). The model pin
  must live in the `jarvis-worker` PROFILE
  (`~/.omp/profiles/jarvis-worker/agent/config.yml`), NOT in a desk-local
  config. A desk-local pin is invisible to AO.
- **Fix:** Removed the desk-local pin; confirmed the pin lives in the worker
  profile (default/task = `poolside/poolside/laguna-s-2.1:high`).
- **Evidence:** AO spawn → model = poolside/laguna-s-2.1:high (Poolside DIRECT).
- **file:line:** `ao-client/session.ts` (sets OMP_PROFILE=jarvis-worker).
- **Status:** FIXED (by design). Recorded as rejected alternative A-008 in
  DECISION_CHAIN.md.

---

## EN-020 — PAT burned (embedded in git remote URL, printed)

- **Date:** 2026-09-2x (W3 — this session)
- **Reported in:** `jarvis-upper/DEBUG_LOG.md` (EN-020, context)
- **Symptom:** A personal access token was embedded in a git remote URL and
  printed to the session output.
- **Root cause:** Operator used a PAT-embedded remote URL during a push/rebase.
- **Fix:** Operator must ROTATE the PAT. Docs MUST NOT record the credential
  material (PAT law, DECISION_CHAIN.md A-012 / §4 L9).
- **Evidence:** Incident recorded; `grep -RI "ghp_" context_management/` →
  empty (no credential material in any canon doc).
- **file:line:** (host-level, not a project file).
- **Status:** OPEN (operator action required — rotation). The doc set has
  already grep-verified empty for credential material.

---

## DEFECT INDEX (this era)

| ID | Title | file:line anchor | Status | Wave |
|----|-------|-------------------|--------|------|
| EN-001 | client health() nonexistent op | `ao-client/client.ts:1-75` | FIXED | W1→W3 |
| EN-003 | no entry/loop (runtime stub) | `src/runtime.ts:1-150` | FIXED | W1→W2 |
| EN-006 | idle stream flagged as error | `jfm/src/watch-ao.ts:1-84` | FIXED | W1→W2 |
| EN-007 | ripwire excludes jarvis-upper | `gates/orphan_scan.sh:1-35` | DOCUMENTED | W2→W3 |
| EN-008 | daemon stale run-file + X cookie | (host-level) | MITIGATED | W3 |
| EN-009 | checkpoint re-ran | (Checkpoints/) | FIXED | W3 |
| EN-010 | `upper sync` STUB | `src/sync.ts` | OPEN | W3 |
| EN-011 | spec-audit not auto-triggered (G13) | `scripts/spec-audit.ts:1-86` | OPEN | W3 |
| EN-019 | desk-local model pin invisible | `ao-client/session.ts` | FIXED | W3 |
| EN-020 | PAT burned | (host-level) | OPEN (rotate) | W3 |

## DEFECT → GATE CROSSWALK

| Defect | Gate that catches it | Status |
|--------|----------------------|--------|
| EN-001 client health() nonexistent op | G1 does_anything_run | FIXED |
| EN-003 no entry/loop | G1, G9 | FIXED |
| EN-006 idle stream flagged error | G1 | FIXED |
| EN-007 ripwire excludes jarvis-upper | G3 orphan_scan (local fallback) | DOCUMENTED |
| EN-008 daemon stale run-file + X cookie | G1 (resume recipe) | MITIGATED |
| EN-009 checkpoint re-ran | G5 | FIXED |
| EN-010 `upper sync` STUB | G14 | OPEN |
| EN-011 spec-audit not triggered | G13 | OPEN |
| EN-019 desk-local pin invisible | G15 | FIXED |
| EN-020 PAT burned | (operator) | OPEN |

## DEFECT → RISK CROSSWALK

| Defect | Linked risk |
|--------|-------------|
| EN-008 | R6 (daemon resume) |
| EN-010 | R2 (upper sync) |
| EN-019 | R4, R12 (model pin) |
| EN-020 | R7 (PAT) |
| EN-007 | R5 (graph gap) |

End of RUNNING_DEBUG_LOG.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
- **VERDICT: VERIFIED** — fence PASS `spec_bound:true` + review `approved`, SAME sha
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green · jfm 8/0
- **jfm wave w0:** the desk `upper-tier-job` closed, `unverdicted: []`
