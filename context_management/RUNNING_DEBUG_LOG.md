# RUNNING DEBUG LOG — jarvis-upper

Append-only debug log. One entry per defect. This era records EN-001..EN-010
(per the brief). Format per entry: ID, date, symptom, root cause, fix /
mitigation, evidence, status.

---

## EN-001 — client health() called a nonexistent operation

- **Date:** 2026-09-2x (W1)
- **Symptom:** The AO client's `health()` probe failed; AO returned an error
  because the client invoked an operation that does not exist on the AO daemon.
- **Root cause:** `ao-client/health.ts` (or the transport path it used) called
  an AO operation id that is not present in the AO schema set (144 paths /
  164 ops / 269 schemas). The client and daemon were out of sync.
- **Fix:** Resolved by the `jarvis-upper-2` factory worker job. The worker
  corrected the operation id the client calls so it matches a real AO op.
- **Evidence:** Gate G1 `VERDICT:RUNS (fail=0)` went GREEN in W2. AO healthz
  `200`. PR #1 (`ao/jarvis-upper-2/root`) carries the fix.
- **Status:** FIXED (closed by `jarvis-upper-2` job).

---

## EN-003 — no entry/loop (runtime had no tick)

- **Date:** 2026-09-2x (W1)
- **Symptom:** On W1 bootstrap the upper-tier runtime had no entry point that
  looped; `src/main.ts` + `src/runtime.ts` were stubs. There was no tick.
- **Root cause:** The runtime was stubbed in W1 to establish the AO daemon +
  gates first; the tick loop had not been implemented yet.
- **Fix:** W2 implemented `src/runtime.ts` with `UPPER_TICK_MS=3000` and
  `src/status.ts` publishing `runtime/status.json`. `runtime/ticks.log` now
  appends each 3000ms.
- **Evidence:** `bun src/cli.ts status` → `RUNNING (tick >3000)`. Gate G1
  PASS.
- **Status:** FIXED (W2).

---

## EN-006 — healthy idle stream flagged as an error

- **Date:** 2026-09-2x (W1)
- **Symptom:** The AO SSE stream (`/api/v1/events?after=<cursor>`) goes idle
  between events; the monitor flagged a quiet stream as an error.
- **Root cause:** The stream monitor interpreted "no events for N seconds" as
  a failure rather than normal idle behavior for a push-based event stream.
- **Fix:** Relaxed the idle-threshold logic so an idle stream is not flagged
  as an error; only a non-200 / connection-reset is an error.
- **Evidence:** `jfm watch` / AO SSE stays green when idle. Gate G1 PASS.
- **Status:** FIXED (W2).

---

## EN-007 — ripwire crawl root EXCLUDES jarvis-upper

- **Date:** 2026-09-2x (W2/W3)
- **Symptom:** The ripwire graph gate cannot verify edits inside
  `jarvis-upper/` because ripwire's crawl root EXCLUDES the jarvis-upper
  directory (the graph engine is scoped to `Shared_Workspace`).
- **Root cause:** Intentional scoping — the GI graph gate (corbell + ripwire)
  is bound to the `Shared_Workspace` crawl root and does not descend into
  `jarvis-upper`.
- **Fix / mitigation:** No code fix — this is the intended scope. Edits in
  `jarvis-upper` verify via grep + tsc + battery + fence2 (not via the graph
  gate). The graph gate still applies to `Shared_Workspace/JARVIS-CORE/b6`
  and the JAM desk core.
- **Evidence:** `bash gates/orphan_scan.sh .` → `ORPHANS=0` (runs locally,
  not via graph). `bun test` green. fence2 PASS.
- **Status:** DOCUMENTED (not a bug to fix; scoping rule). Recorded here so
  agents do not waste time trying to graph-verify jarvis-upper edits.

---

## EN-008 — daemon stale run-file + rotating X cookie

- **Date:** 2026-09-2x (W2/W3)
- **Symptom:** The AO daemon (`agent-orchestrator`) refuses to resume when the
  display/auth state is stale.
- **Root cause:** Two coupled issues: (a) `~/.ao/running.json` can go stale
  after a crash/reboot; (b) the X-wayland auth cookie rotates between
  daemons, so a hard-coded `XAUTHORITY` is wrong on resume.
- **Fix:** The daemon resume recipe resolves the LIVE cookie each time and
  parks the stale run file:
  ```bash
  DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) \
    /usr/bin/agent-orchestrator
  # if refuses:
  mv ~/.ao/running.json /tmp/running.json.stale
  ```
- **Evidence:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz`
  → `200` after the recipe.
- **Status:** MITIGATED (recipe in COMPACTION_SURVIVAL.md). The cookie
  rotation is inherent to the Wayland host; the recipe is the fix.

---

## EN-009 — checkpoint test copies re-ran

- **Date:** 2026-09-2x (W2/W3)
- **Symptom:** Checkpoint tests re-ran during a wave, producing duplicate
  work / flaky state in the shared checkpoint directory.
- **Root cause:** The checkpoint test harness did not guard against re-entry
  when the same checkpoint job id appeared across waves.
- **Fix:** Pinned the checkpoint test so each job id runs once per wave; the
  harness now dedups by job id + head sha.
- **Evidence:** `bun test` → `52 pass / 0 fail / 183 expects / 16 files`
  (stable across W2/W3/W4).
- **Status:** FIXED (pinned).

---

## EN-010 — `upper sync` is a STUB

- **Date:** 2026-09-2x (W2/W3)
- **Symptom:** `upper sync` returns `prNodes 0` while a PR is actually open
  (PR #1 is OPEN).
- **Root cause:** The sync path in `src/main.ts` is a STUB — it does not yet
  call the AO PR / node layer; it returns a constant 0.
- **Fix:** PENDING (next wave). The stub must call the real AO PR surface and
  return live prNodes. Tracked as G14 in TASK_QUEUE.md (BLOCKED).
- **Evidence:** `upper sync` → `prNodes 0`; PR #1 OPEN.
- **Status:** OPEN (STUB). Not fixed this era; queued in NEXT_STEPS.md N2.

---

## EN-011 — EN-002 (pre-W4) — resolved before this era

- **Note:** EN-002 is referenced as pre-W4-resolved in the DEBUG_LOG summary in
  CURRENT_STATE.md. No detail retained; this era opens at EN-001..EN-010.

---

## EN-012 — EN-004 / EN-005 (pre-W4) — resolved before this era

- **Note:** Same as EN-011 — pre-W4, detail not retained in this era's active
  defect set.

---

## EN-019 — desk-local model pin invisible to AO spawns

- **Date:** 2026-09-2x (W3)
- **Symptom:** A model pin set at the desk level was NOT picked up by AO
  worker spawns; spawns used the global default instead.
- **Root cause:** AO spawns carry `OMP_PROFILE=jarvis-worker` (the project
  env). The model pin must live in the `jarvis-worker` PROFILE
  (`~/.omp/profiles/jarvis-worker/agent/config.yml`), NOT in a desk-local
  config. A desk-local pin is invisible to AO.
- **Fix:** Removed the desk-local pin; confirmed the pin lives in the worker
  profile. default/task = `poolside/poolside/laguna-s-2.1:high`.
- **Evidence:** AO spawn → model = poolside/laguna-s-2.1:high (Poolside DIRECT).
- **Status:** FIXED (by design). Recorded as a rejected alternative A-007 in
  DECISION_CHAIN.md.

---

## EN-020 — PAT burned (embedded in git remote URL, printed)

- **Date:** 2026-09-2x (W3 — this session)
- **Symptom:** A personal access token was embedded in a git remote URL and
  printed to the session output.
- **Root cause:** Operator used a PAT-embedded remote URL during a push/rebase.
- **Fix:** Operator must ROTATE the PAT. Docs MUST NOT record the credential
  material (PAT law, DECISION_CHAIN.md A-011 / §4).
- **Evidence:** Incident recorded; no credential material in any canon doc
  (grep for PAT material → empty).
- **Status:** OPEN (operator action required — rotation). The doc set has
  already excluded all credential material.

---

## DEFECT INDEX (this era)

| ID | Title | Status | Wave opened | Wave fixed |
|----|-------|--------|-------------|------------|
| EN-001 | client health() nonexistent op | FIXED | W1 | W3 (jarvis-upper-2) |
| EN-003 | no entry/loop (runtime stub) | FIXED | W1 | W2 |
| EN-006 | idle stream flagged as error | FIXED | W1 | W2 |
| EN-007 | ripwire excludes jarvis-upper | DOCUMENTED | W2 | W2 |
| EN-008 | daemon stale run-file + X cookie | MITIGATED | W2 | W2 (recipe) |
| EN-009 | checkpoint re-ran | FIXED | W2 | W2 |
| EN-010 | `upper sync` STUB | OPEN | W2 | — |
| EN-019 | desk-local model pin invisible | FIXED | W3 | W3 |
| EN-020 | PAT burned | OPEN (rotate) | W3 | — (operator) |

End of RUNNING_DEBUG_LOG.
