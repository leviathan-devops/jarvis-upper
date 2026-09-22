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

---

## EN-100 · THE GATE-HEADER STANDARD (W1) — the artifact-class defect class, closed by construction

**THE FINDING (this session, measured):** two of the four live firings were GATE DEFECTS, and both
were the SAME class — a predicate ported to an artifact class it was not derived for.

**THE EVIDENCE:**
```
REJECT(W-1): staged src/ change with no staged extensions/ change
  -> W-1 was derived from the GI kernel (src/ -> extensions/<plugin>/index.js).
     jarvis-upper has NO extensions/ dir (verified: ls -d extensions/ -> No such file).
     Every src/ commit was refused FOREVER.

REJECT(W-9): .github/ISSUE_TEMPLATE/task.md has 19 lines (< 100)
  -> W-9's floor is an ENGINEERING-DOC law. GitHub's .github/ artifacts are a
     different class; a 100-line PR template is unusable.
```

**THE MECHANISM:** a predicate carries an IMPLICIT artifact class — the class of the artifact its
author had in mind when deriving it. Nothing in the gate records that class. So when the gate lands
on a different class, it either fires on everything (and gets bypassed) or on nothing.

**THE FIX (structural, not a patch):** `.githooks/lib/pattern-header.sh` — every gate must carry:
```
# GATE <ID> — <THE_PATTERN_NAME>
# JEV COUNT: <n>   (the measured occurrences in the 298-file corpus)
# ARTIFACT CLASS: <the artifact class this predicate applies to>
# SURFACE: <the anchor>
# PREDICATE READS: <the artifact class> — NEVER prose
```
`header_ok <gate>` returns exit 1 on a gate missing any line. The W1 test asserts it.

**THE VERIFICATION (the W1 gate):** `bun test -t test_gate_header_standard` — the negative case
asserts `header_ok .githooks/pre-commit` exits 1 (pre-commit has no header YET — which is the point;
W2 adds it).

**THE LESSON:** *a gate is a (predicate x artifact-class) pair.* The predicate is the easy half;
naming the class is the half that gets skipped — and skipping it is what produces the gate that
fires on everything.

**THE ANCHORS:**
| the claim | the anchor |
|---|---|
| the W-1 defect site | `.githooks/pre-commit:47` (`[ -d extensions ]`) |
| the W-9 exemption | `.githooks/pre-commit:24` (`.github/*) continue`) |
| the standard (W1) | `.githooks/lib/pattern-header.sh:1` |
| the test | `tests/gate_header.test.ts:1` |
| the contract | `src/status-contract.ts:33` (`REQUIRED_CONTEXTS`) |
| the wave plan | `packages/github-master-kernel/06-WAVES.md:3` (`WAVES: 6`) |
| the spec | `packages/github-master-kernel/github_master_kernel_DPL1_SPEC.md:1` |
| the Jev evidence | `JARVIS-FACTORY/reports/JEV_Failure_Pattern_Extraction_v1.md:1` |

---

## EN-101 · ★ THE FIRST REAL CI RUN FOUND A HARD DEFECT (2026-09-22)

**THE FINDING:** the workflow file `.github/workflows/gates.yml` was REJECTED ENTIRELY by GitHub
Actions — zero jobs were created. The first real CI run in this repo's history.

**THE EVIDENCE:**
```
$ git push -u origin feat/github-master-kernel
To https://github.com/leviathan-devops/jarvis-upper.git
 * [new branch]      feat/github-master-kernel -> feat/github-master-kernel

$ gh run list --repo leviathan-devops/jarvis-upper --limit 5
completed  failure  feat(W1+ruleset): ...  .github/workflows/gates.yml  push  35769132155  0s

$ gh run view 35769132155
X This run likely failed because of a workflow file issue.

$ gh api repos/.../actions/runs/35769132155/jobs
   (EMPTY — zero jobs created)
```

**THE ROOT CAUSE:** the JOB IDs contain a SLASH.
```yaml
jobs:
  "gates/anti-theatrical":      # <- INVALID job id (GitHub rejects the file)
    name: gates/anti-theatrical # <- VALID (becomes the status-check context)
```
GitHub Actions job IDs must match `^[a-zA-Z_][a-zA-Z0-9_-]*$` — **no slashes, no dots.** The
`name:` field MAY contain a slash and MUST here, because the armed ruleset requires
`gates/anti-theatrical` etc. as the status contexts.

**WHY IT SURVIVED 4 DESK AUDITS:** every audit validated the YAML with `yaml.safe_load` + checked
the `name:` list. **All five `name:` values were correct.** The `name:` is what the docs and the
ruleset care about, so nobody read the KEY. The defect is invisible to every check that looks at
`name:`.

**THE LESSON (a new audit rule):** *when a config's KEY is a different string from its VALUE,
audit BOTH.* A YAML job key and its `name:` are two strings; a passing check on one says nothing
about the other. This is the same class as the artifact-class defect — **the audit checked the
thing it was looking at, not the thing that was wrong.**

**THE FIX (steered to the W4 desk):** job KEYS become bare identifiers
(`anti_theatrical`, `issue_link`, `spec_gate`, `diff_budget`, `test`); `name:` stays EXACTLY
`gates/<the string>` so the armed ruleset still matches.

**THE SECOND FINDING (the same run):** `gates/issue-link` reads
`${{ github.event.pull_request.body }}` — empty on a `push` trigger. The job needs
`if: github.event_name == 'pull_request'` or it fails on every non-PR event.

**THE ANCHORS:**
| the claim | the anchor |
|---|---|
| the invalid job ids | `.github/workflows/gates.yml:11` (`"gates/anti-theatrical":`) |
| the valid names | `.github/workflows/gates.yml:12` (`name: gates/anti-theatrical`) |
| the ruleset's contexts | `ruleset.json:1` (armed id 23838059) |
| the contract | `src/status-contract.ts:33` (`REQUIRED_CONTEXTS`) |
| the run | the `gh run list` output above (run 35769132155) |
| the branch | `feat/github-master-kernel` |

---

## EN-102 · TWO DEFECTS THE BATTERY FOUND (2026-09-22)

### DEFECT A — the round-zero checkpoint was missing CHECKPOINT_STRUCTURE.md

**THE EVIDENCE:**
```
$ bun test
(fail) docs_current: the MODE-B checkpoint is on disk with both floors and a spaceless token
  Expected: true   Received: false
      at tests/docs_current.test.ts:65:27
```

**THE ROOT CAUSE:** `tests/docs_current.test.ts:65` asserts the NEWEST checkpoint carries BOTH
`CHECKPOINT_MANIFEST.md` (>= 40 lines) AND `CHECKPOINT_STRUCTURE.md` (>= 30 lines). My round-zero
checkpoint had the manifest but **not the structure doc.** `saving-checkpoints/SKILL.md` lists
`CHECKPOINT_STRUCTURE.md` in the mandatory structure — I skipped it.

**THE FIX:** added `Checkpoints/round-zero-pre-w1-20260922-222831/CHECKPOINT_STRUCTURE.md`
(93 lines) with the complete structure listing, the file counts, the state, and the honest gaps.

**THE LESSON:** the checkpoint skill's structure list is MANDATORY, and an EXISTING TEST enforces
it. Reading the skill's tree diagram would have caught it before the test did.

### DEFECT B — a W1-era assertion went stale when W2 landed

**THE EVIDENCE:**
```
(fail) tests/gate_header.test.ts
  the assertion: header_ok .githooks/pre-commit -> exit=1 ("carries no header YET")
  the new truth:  header_ok .githooks/pre-commit -> exit=0 (W2 added the header)
```

**THE ROOT CAUSE:** the W1 test asserted a SNAPSHOT of the state at W1 time ("pre-commit carries no
header YET — W2/W3 add headers later"). W2 then added the header, which made the assertion false.
**The test was correct when written and became wrong by design.** The W2 desk FLAGGED it rather
than silently changing another desk's file — the correct move.

**THE FIX:** the assertion updated to `exit=0`; the NEGATIVE half (a synthetic headerless file must
return exit=1) is preserved, so the checker's discriminating power is still proven.

**THE LESSON:** an assertion that encodes "X does not exist YET" is a TIME BOMB — it inverts the
moment a later wave lands X. Write the negative case against a SYNTHETIC fixture, never against the
live artifact that a sibling wave is about to change.

**THE ANCHORS:**
| the claim | the anchor |
|---|---|
| the checkpoint test | `tests/docs_current.test.ts:65` |
| the checkpoint skill's structure | `saving-checkpoints/SKILL.md` (the structure tree) |
| the fixed structure doc | `Checkpoints/round-zero-pre-w1-20260922-222831/CHECKPOINT_STRUCTURE.md:1` |
| the stale assertion | `tests/gate_header.test.ts:58` |
| the W2 scanners | `.githooks/lib/scan-silent.sh:1` · `.githooks/lib/scan-stub.sh:1` |
| the W1 standard | `.githooks/lib/pattern-header.sh:1` |

**THE BATTERY AFTER BOTH FIXES: 72 pass / 0 fail.**

---

## EN-103 · ★ THE CI IS ALIVE — AND IT FOUND TWO MORE REAL DEFECTS (2026-09-22)

**THE RUN:** `35771345534`, event `pull_request`, PR #2.

```
gates/diff-budget             | failure
gates/spec-gate               | failure
gates/issue-link              | success
gates/test                    | failure
gates/theatrical-verification | success
gates/anti-theatrical         | failure
```

**The job-id fix WORKED:** the first run created ZERO jobs; this one created SIX, all named
correctly. **The runtime proved what four desk audits could not.**

### FINDING 1 — the anti-theatrical scope defect (the FOURTH artifact-class instance)

```
BAD=$(git log --format='%s' origin/main..HEAD | grep -vE '^(feat|fix|docs|...): ' || true)
Merge f2e83d413b05a59a9b3d5af29e83bc95d73f266b into 06333fa595b54cdaead2938b44aac70128f3c551
##[error]Process completed with exit code 1.
```

The offending subject is a **MERGE COMMIT GITHUB ITSELF GENERATED.** The predicate (the
semantic-prefix regex) is CORRECT. Its SCOPE is wrong: it applies to machine-generated text.

**THE LAW, EXTENDED:** a gate is a **(predicate x artifact-class x author)** triple.

**THE FIX:** `git log --no-merges` — the git-native exclusion. Steered to W4.

### FINDING 2 — an environment dependency only the CI could expose

`gates/test` -> `69 pass / 3 fail`. The three failures are `spec_audit` tests reading
`../packages/jarvis-upper-tier/..._SPEC.md` — **a path OUTSIDE the repo.** It exists on the host,
NOT in a CI checkout. **The test passes locally and fails in the real environment.**

### THE PATTERN — EVERY DEFECT FOUND BY RUNNING

| the defect | found by | NOT found by |
|---|---|---|
| the job-id slash | the first CI run | 4 desk audits + `yaml.safe_load` + `INTERFACE:MATCH` |
| the merge-subject scope | the second CI run | every audit |
| the spec-file dependency | the CI's environment | the local battery (green) |

**The local battery was GREEN (72 pass / 0 fail) while the artifact was BROKEN.** That is the
runtime-grade law, proven in the field.

**THE ANCHORS:**
| the claim | the anchor |
|---|---|
| the subject check | `.github/workflows/gates.yml:22` |
| the job names | `.github/workflows/gates.yml:11` |
| the armed ruleset | `ruleset.json:1` |
| the same class locally | `.githooks/prepare-commit-msg:27` |
| the firing record | `.trident/firings/FIRING-010-CI-ALIVE.md:1` |

---

## EN-104 · ★ TWO HOOKS LOST THEIR SHEBANGS — AND NOTHING CAUGHT IT (2026-09-22)

**THE FINDING:** W3's edit to `.githooks/prepare-commit-msg` and `.githooks/pre-push` **replaced
the shebang line with the W1 header comment.** Both hooks became non-executable-as-bash.

**THE EVIDENCE:**
```
$ head -1 .githooks/prepare-commit-msg
# GATE W-8 — claim-evidence        <- THE SHEBANG IS GONE

$ git commit -m "..."
.githooks/prepare-commit-msg: 25: set: Illegal option -o pipefail
   (the commit DID NOT LAND)

$ head -1 .githooks/pre-push
# GATE W-2 — reachability          <- THE SHEBANG IS GONE
```

**THE MECHANISM:** a hook's shebang is what tells git which interpreter to use. With no shebang,
git falls back to `/bin/sh` — **and `sh` (dash) has no `set -o pipefail`.** The hook exits 2
before doing any work. **The ABSOLUTE keystone hook was broken.**

**WHY NOTHING CAUGHT IT:**
- The battery was GREEN (72 pass) — no test exercised a real `git commit`.
- `header_ok` checked the 5 header lines but **NOT the shebang.**
- The desk's own tests invoked the hooks with `bash <path>` explicitly — **which ignores the
  shebang**, so they passed.

**THE THIRD DEFECT CLASS:** this is the same family again — **a check that validates the thing it
looks at, not the thing that is wrong.**
| the check | what it validated | what was wrong |
|---|---|---|
| 4 desk audits | the YAML `name:` fields | the job KEY |
| `header_ok` (before) | the 5 header lines | the shebang |
| the desk's tests | `bash <hook>` | git's actual invocation path |

**THE FIXES (all three):**
1. `prepare-commit-msg` — shebang restored at line 1
2. `pre-push` — shebang restored at line 1
3. **`header_ok` now REQUIRES a shebang** — the structural fix, so the class cannot recur
4. the W1 test's `good` fixture now carries a shebang (it must match the real shape)

**THE BATTERY AFTER: 73 pass / 0 fail.**

**THE ANCHORS:**
| the claim | the anchor |
|---|---|
| the keystone hook | `.githooks/prepare-commit-msg:1` (`#!/usr/bin/env bash`) |
| the pre-push hook | `.githooks/pre-push:1` |
| the shebang check | `.githooks/lib/pattern-header.sh` (`header_ok`) |
| the test fixture | `tests/gate_header.test.ts:44` |
| the unowned hook | `.githooks/commit-msg:1` (has a shebang, no header — no desk owns it) |
| the failing commit | the `set: Illegal option -o pipefail` output above |

---

## EN-105 · ★ THE PHANTOM GATE HAD *BOTH* HALVES BROKEN (2026-09-22)

**THE FINDING:** the W3 phantom-diff gate (Jev 70) had two defects — one that made it NEVER fire
and one that made it fire on EVERYTHING. The desk's own test caught both.

### DEFECT A — THE GATE COULD NEVER FIRE (under-firing)

```bash
CLAIM_RE="^[^:]*(complete[d]?|done|finished|implemented|added|built|landed|shipped|delivered)"
```

**MEASURED:**
```
$ printf 'feat: implemented the thing\n' | grep -qiE "$CLAIM_RE"  -> *** DOES NOT MATCH ***
$ printf 'feat: implemented the thing\n' | grep -oiE "^[^:]*"      -> feat
```

**THE MECHANISM:** `^[^:]*` consumes the TYPE PREFIX and **stops at the first colon.** The claim
word then must appear BEFORE the colon — but this repo's convention puts the type before the colon
(`feat:`) and the claim AFTER it. **The regex could never match a real commit in this repo.**

**A GATE THAT NEVER FIRES IS WORSE THAN NO GATE.** It looks like enforcement and does nothing.

**THE FIX:**
```bash
CLAIM_RE='^[a-z]+(\([^)]*\))?:[[:space:]]*(complete[d]?|done|finished|implemented|added|built|landed|shipped|delivered)'
```

### DEFECT B — THE GATE FIRED ON EVERYTHING (over-firing)

```bash
STAT=$(git diff --stat "$SHA"^.."$SHA" 2>/dev/null || git diff --stat --root "$SHA" 2>/dev/null)
```

**MEASURED (a scratch repo, all three commit shapes):**
```
git diff --stat "$SHA"^.."$SHA"   -> error (a root commit has no parent)
git diff --stat --root "$SHA"     -> EMPTY (silently — `--root` is NOT a valid `git diff` flag)
  STAT=[]  -> [ -z "$STAT" ] is TRUE -> FIRES on every root commit
```

**`git diff --root` is not a valid flag for `git diff`.** It silently returns empty, so
**every root commit looked like a phantom.**

**THE FIX — one command, correct for all three shapes:**
```bash
STAT=$(git show --stat --format="" "$SHA" 2>/dev/null)
```
Verified: a root commit with a change -> `foo.ts | 1 +`; a normal commit -> `bar.ts | 1 +`; an
empty commit -> `""` (correctly fires).

### ★ THE SIXTH INSTANCE OF THE CLASS

| # | the instance | the predicate | what was wrong |
|---|---|---|---|
| 1 | W-1 | `find src -newer dist` | the repo LAYOUT |
| 2 | W-9 | `wc -l` on a `.md` | the artifact CLASS (a GitHub template) |
| 3 | W-9 | `wc -l` on a `.md` | the artifact CLASS (a checkpoint manifest) |
| 4 | the job id | the `name:` list | the KEY |
| 5 | the shebang | the 5 header lines | the INTERPRETER |
| 6 | **the phantom regex** | the claim word | **the COMMIT-MESSAGE SHAPE** |
| 6b | **the phantom stat** | the diff | **the ROOT-COMMIT SHAPE** |

**THE LAW, COMPLETE:** a gate is a **(predicate x artifact-class x author x shape)** tuple. Every
axis that is not named is an axis the gate can be wrong about — and a gate wrong on any axis is
either silent (and looks like enforcement) or deafening (and gets bypassed).

**THE ANCHORS:**
| the claim | the anchor |
|---|---|
| the claim regex | `.githooks/lib/scan-phantom.sh:44` |
| the stat command | `.githooks/lib/scan-phantom.sh` (the STAT block) |
| the test that caught both | `tests/gate_phantom_reach.test.ts:47` + `:58` |
| the W1 standard | `.githooks/lib/pattern-header.sh:1` |
| the firing record | `.trident/firings/FIRING-010-CI-ALIVE.md:1` |
