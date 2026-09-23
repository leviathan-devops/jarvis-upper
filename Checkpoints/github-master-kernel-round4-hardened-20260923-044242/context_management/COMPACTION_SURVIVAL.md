# COMPACTION SURVIVAL — jarvis-upper (W4)

How to resume this project after a context compaction or a host reboot.
The resume point is a **daemon recipe + binding laws**, not a memory dump.
All SHAs referenced here are quoted verbatim from the verified state.

---

## 1. RESUME POINT (single command)

The canonical resume command (daemon + X cookie resolves live):

```bash
DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) \
  /usr/bin/agent-orchestrator
```

If the daemon refuses (stale run file):

```bash
mv ~/.ao/running.json /tmp/running.json.stale
# then re-run the daemon resume command above
```

## 2. WHY THE X COOKIE ROTATES

The AO daemon is a headed process (it drives headed worker TUIs). On a Wayland
host the X-wayland auth cookie at `/run/user/1000/.mutter-Xwaylandauth.*`
rotates between daemons. The resume command resolves the LIVE cookie every time
so the daemon re-attaches to the correct display. Hard-coding a stale cookie is
the EN-008 defect.

## 3. VERIFICATION AFTER RESUME

| Step | Command | Expected |
|------|---------|----------|
| AO up | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` | `200` |
| AO introspection | (introspection) | `144 paths / 164 ops / 269 schemas` |
| Battery | `bun test` | `52 pass / 0 fail / 183 expects / 16 files` |
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Runtime | `UPPER_TICK_MS=3000 bun src/main.ts` (pane) then `bun src/cli.ts status` | `RUNNING (tick >3000)` |
| Gates | `bash gates/does_anything_run.sh .` + shape + orphan | `VERDICT:RUNS (fail=0)` / `SHAPES:all declared ids implemented` / `ORPHANS=0` |
| JFM | `jfm health` | healthy |
| Two-source | `bun test -t two_source_verdict` | `8 pass / 0 fail` |
| JFM verbs | `bun test -t jfm_verbs` | `8 pass / 0 fail` |
| fence2 | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | `VERDICT:PASS` + `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` |

## 4. THE BINDING LAW LIST

### 4.1 The graph-first doctrine

| Law | Enforcement | Where |
|-----|-------------|-------|
| `ripwire` (structural map) is the FIRST tool for any structural edit | Agents must run a `ripwire` verb (`callers`, `blast-radius`, `impact`) on the symbol before editing exports/imports/types | agent workflow |
| `grep` is for literals only; `opengrok` is for VCS history/blame across the standing index | Do not use grep-then-read a whole file when a map exists | tool policy |
| Doc-only edits never trigger the graph gate | The gate resets only on structural changes | graph-gate advisory |

> EN-007 caveat: ripwire crawl root EXCLUDES `jarvis-upper`. So for edits inside
> `jarvis-upper`, the graph gate CANNOT verify them; the fallback is grep + tsc
> + battery + fence2. This is intentional scoping, not a gap to "fix".

### 4.2 The no-silent-fallback law

| Law | Enforcement | Where |
|-----|-------------|-------|
| Tools that fail (`OPENGROK_DOWN`, stale dist) must be LOUD | Never silently fall back from a failed structural tool to a weaker one | tool policy |
| A failed `ripwire`/`grep`/`opengrok` must surface, not be papered over | The agent reports the failure and chooses an explicit fallback | agent workflow |

### 4.3 The anti-theatrical law (D-003)

| Law | Enforcement | Where |
|-----|-------------|-------|
| commit-exists / diff-changed / tests-pass / PR-open are NOT verification | Explicitly forbidden as a gate | `gates/` + DECISION_CHAIN.md A-001..A-004 |
| "does anything run?" is the only thing that matters (D-002) | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` mandatory on every claim | gates/does_anything_run.sh |

### 4.4 The two-source law (D-004)

| Law | Enforcement | Where |
|-----|-------------|-------|
| VERIFIED iff fence2 exit 0 AND AO review approves the SAME head sha | `src/verdict.ts:verify({jobDir, headSha, sessionId})` | `bun test -t two_source_verdict` (8 pass) |
| One source alone = Boolean FALSE = REJECT | The test suite encodes this | `tests/two_source_verdict.test.ts:1-111` |

### 4.5 The worker-profile pin law (D-007/D-008)

| Law | Enforcement | Where |
|-----|-------------|-------|
| AO spawns carry `OMP_PROFILE=jarvis-worker` | project env on jarvis-upper, jarvis_orchestrator, scratch, jfm-e2e | `ao-client/session.ts` |
| `jarvis-worker` default/task = Poolside DIRECT | `~/.omp/profiles/jarvis-worker/agent/config.yml` | profile file |
| Global omp = deepseek (NOT a worker) | `~/.omp/agent/config.yml` | config file |
| Desk-local model pin is invisible (EN-019) → forbidden | rejected alternative A-008 | DECISION_CHAIN.md |

### 4.6 The import-don't-fork law (L7)

| Law | Enforcement | Where |
|-----|-------------|-------|
| JAM desk core IMPORTED, never forked | `jfm/src/desk.ts` imports `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | JFM |
| fence2 IMPORTED, never forked | gates + verdict import `b6/fence2.py` | gates/ |

### 4.7 The PAT law (L9)

| Law | Enforcement | Where |
|-----|-------------|-------|
| Never record credentials | grep PAT material in canon docs → empty | DECISION_CHAIN.md A-012 |
| Rotate burned PATs | operator action (EN-020) | rotation, not code |

### 4.8 The fence-sandbox law (L10)

| Law | Enforcement | Where |
|-----|-------------|-------|
| fence2 has NO network (`bwrap --unshare-all`) | network done-when steps fail there BY DESIGN; DB_1 runs offline | fence2.py invocation |

## 5. THE FROZEN HEAD SHA (do not lose)

```
adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

This is:
- PR #1 head (`ao/jarish-upper-2/root`, commits `760ad1b`, `732083e`, `adbdacf`).
- The sha fence2 adjudicated PASS for job `upper-tier-dt-shapes`.
- The sha the AO review must approve (G11).
- The sha `verify({headSha})` in `src/verdict.ts` (184L) keys off for VERIFIED.

Any PR merge or rebase MOVES this sha — and requires re-running BOTH fence2
(G10) AND the AO review (G11) on the NEW sha before completion (R10).

## 6. RESUME SEQUENCE (step by step)

```
1. Start AO daemon:
   DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) \
     /usr/bin/agent-orchestrator
   (if refuses: mv ~/.ao/running.json /tmp/running.json.stale ; retry)

2. Confirm AO up:
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/healthz  # 200

3. cd /home/leviathan/JARVIS_WORKSPACE/jarvis-upper

4. Start the runtime (separate Orca pane):
   UPPER_TICK_MS=3000 bun src/main.ts

5. Confirm runtime:
   bun src/cli.ts status  # RUNNING (tick >3000)

6. Run all gates + battery (single batch):
   bash gates/does_anything_run.sh .
   bash gates/shape_freeze.sh .
   bash gates/orphan_scan.sh .
   bunx tsc --noEmit
   bun test

7. JFM sanity:
   jfm health
   jfm status
   bun test -t jfm_verbs

8. Two-source sanity:
   bun test -t two_source_verdict
   /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py \
     adjudicate upper-tier-dt-shapes \
     --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

## 7. COMPACTION DO'S AND DON'TS

| Do | Don't |
|----|-------|
| Read POST-COMPACTION_PROMPT first | Don't reinvent the worker profile pin |
| Re-run `bun test` + all 3 gates after resume | Don't cite PR-open / tests-pass / commit-exists as verification (D-003) |
| Re-run fence2 + AO review on any sha change | Don't fork the JAM desk core or fence2 (L7) |
| Use the worker profile `jarvis-worker` for spawns | Don't set desk-local model pins (EN-019) |
| Rotate any burned PAT before public push | Don't record credentials in docs (L9) |
| Append WN to RUNNING_BUILD_LOG each wave | Don't leave EN-xxx defects undocumented |
| Read DECISION_CHAIN.md before changing anything | Don't re-attempt A-001..A-014 |

## 8. WHAT TO READ FIRST (post-resume)

1. `POST-COMPACTION_PROMPT.md` (entry point).
2. `BUILD_STATE.md` (SHAs + module inventory + line counts).
3. `EVIDENCE_STATE.md` (literal tokens that must reproduce).
4. `DECISION_CHAIN.md` (binding rulings + rejected alternatives).
5. `TASK_QUEUE.md` (PASS / OPEN / BLOCKED + risk register).

## 9. EMERGENCY RESET (if daemon is wedged)

```bash
# Stop everything cleanly (LAST RESORT — prefer stale-run move in §1)
pkill -f agent-orchestrator
mv ~/.ao/running.json /tmp/running.json.stale   # 1x only

# Bring AO back
DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) \
  /usr/bin/agent-orchestrator &

# Verify
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/healthz  # 200

# Bring the runtime back
cd /home/leviathan/JARVIS_WORKSPACE/jarvis-upper
UPPER_TICK_MS=3000 bun src/main.ts
bun src/cli.ts status  # RUNNING (tick >3000)
```

> Note: `pkill -f agent-orchestrator` is a last resort. Never touch credential
> material during reset (L9).

## 10. PEER COORDINATION POST-COMPACTION

- This session's agent id is **CanonDocs**.
- Live peers: `hub op:"list"` (shows running+idle, never parked names).
- To wake a parked peer: address it by its roster id via `hub op:"send"`.
- `history://<id>` and `agent://<id>` remain readable after parking.
- Primary peer: `Main` (the main orchestrator).

## 11. THE RESUME LAW CHECKLIST

Before declaring "resumed", an agent MUST confirm:

| # | Check | Command | Must be |
|---|-------|---------|---------|
| 1 | AO up | `curl ... /healthz` | `200` |
| 2 | does anything run | `bash gates/does_anything_run.sh .` | `VERDICT:RUNS (fail=0)` |
| 3 | shape frozen | `bash gates/shape_freeze.sh .` | `SHAPES:all declared ids implemented` |
| 4 | no orphans | `bash gates/orphan_scan.sh .` | `ORPHANS=0` |
| 5 | typecheck | `bunx tsc --noEmit` | exit 0 |
| 6 | battery | `bun test` | `52 pass / 0 fail / 183 expects` |
| 7 | runtime | `bun src/cli.ts status` | `RUNNING (tick >3000)` |
| 8 | verdict law | `bun test -t two_source_verdict` | `8 pass / 0 fail` |
| 9 | jfm verbs | `bun test -t jfm_verbs` | `8 pass / 0 fail` |
| 10 | fence2 | `fence2.py adjudicate ...` | `VERDICT:PASS` |

End of COMPACTION_SURVIVAL.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
- **VERDICT: VERIFIED** — fence PASS `spec_bound:true` + review `approved`, SAME sha
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green · jfm 8/0
- **jfm wave w0:** the desk `upper-tier-job` closed, `unverdicted: []`

---

## §APPEND — THE GITHUB MASTER KERNEL SESSION (2026-09-22)

**The state at this append:** the enforcement layer is live at BOTH anchors.

| the artifact | the anchor |
|---|---|
| the ABSOLUTE hook | `.githooks/prepare-commit-msg:1` |
| the gate-header standard | `.githooks/lib/pattern-header.sh:1` |
| the phantom scanner | `.githooks/lib/scan-phantom.sh:44` |
| the frozen contract | `src/status-contract.ts:33` |
| the armed ruleset | `ruleset.json:1` (id 23838059, 8 contexts) |
| the CI workflow | `.github/workflows/gates.yml:26` |
| the runtime ledger | `.trident/RUNTIME_LEDGER.md:1` |
| the P5 sweep | `.trident/P5_ADVERSARIAL_SWEEP.md:1` |

**THE RESUME POINT:** read `.trident/RUNTIME_LEDGER.md` first (the 6 numbered operations), then
`.trident/P5_ADVERSARIAL_SWEEP.md` (the gate map + the 2 defects found), then the build package at
`JARVIS-FACTORY/packages/github-master-kernel/`.

**THE ONE-LINE STATE:** 8 gates live locally + 8 contexts armed remotely; 12 defects found by
running (not reading); the battery is 77 pass / 0 fail; the CI has run twice and never gone green.

---

## [2026-09-22T22:45:31Z] — THE OCR-HARDENING CAMPAIGN UPDATE (HEAD `8487df3`)

**THE CURRENT DIST/HEAD:** `8487df3615196b1898b0fc7f54104424150cdbee` (branch `feat/github-master-kernel`).
**THE BATTERY:**  78 pass  0 fail  (`bun test`). **`bunx tsc --noEmit`:** exit 0.
**THE CONTRACT:** `src/status-contract.ts` — the 8 status contexts, UNCHANGED. The LIVE ruleset
23838059 (enforcement active, bypass_actors []) still matches them byte-for-byte.
**THE 8 LOCAL GATES:** W-1 (scoped off — no `extensions/` here) · W-2 · W-3 · W-6 · W-8 · W-9 ·
W-13 · W-14.

### WHAT THIS CAMPAIGN CHANGED
The ocr ship gate returned **FAIL (36 high / 77 medium / 15 low, 40 files)** against this kernel —
the gate this repo uses to block every ship claim had never been run on the repo itself. Four
parallel waves hardened it (`.githooks/**` 33 findings · `.github/**` 7 · `src/*.ts` 61 ·
`scripts/**`+`gates/**` 27). Then the ORCHESTRATOR's own audit found SIX defects the desks'
"COMPLETE" reports did not survive — every one caught by RUNNING the hook, not reading it:
1. **W-3 was unwired** (`scan-phantom.sh` never sourced) — `.githooks/pre-push:27`.
2. **★ THE IFS BUG** — `IFS= read -r a b c d` with an empty IFS puts the whole line in `a`, so
   `remote_sha` was always empty and EVERY ref was skipped: **W-2 AND W-3 never fired.** The whole
   pre-push gate was dead. `.githooks/pre-push:61`. Not in the ocr report — introduced by a fix.
3. **New refs skipped** by the `0000` guard — `.githooks/pre-push:63`.
4. **W-6 over-fired** on `err.includes("Timeout")` — `.githooks/pre-commit:67`.
5. **★ THE `=~` QUOTING BUG** — inside `[[ =~ ]]` the pattern is unquoted, so `""` and `''` were
   stripped to empty alternation branches that match ANYTHING — `.githooks/lib/scan-silent.sh:119`.
6. **W-13 shape gaps** — a no-paren comment-only catch escaped both rules.

### THE EVIDENCE (all re-proven by running)
- **The P5 corpus:** `.trident/p5_corpus2.sh` → **13 pass / 0 fail** — every gate, both halves.
- **A REAL `git push`** of a new branch with a phantom claim → `REJECT(W-3)` rc=1.
- **A REAL `git push`** with an orphan → `REJECT(W-2)`.
- **The container test:** `jarvis-upper-ct` on `omp-ct:master`, `.trident/ct/ct-results.json` —
  11 scenarios PASS. The prior session's residual "no container test exists" is CLOSED.
- **The audit artifact:** `.trident/wave-audit/ORCHESTRATOR-AUDIT.md`.

### THE HONEST REMAINDER
- **THE AUDIT GATE:** the ocr re-run is in flight; the verdict lands in `TESTING_LOG.md`. A
  degraded run is BLOCKED, never PASS.
- **W-1** stays correctly scoped off (no dist step in this repo) — the CLAIM is fixed, not the code.
- **4 W3 findings deferred** (the reachability worktree-vs-pushed-tree nuance, the stub body parser,
  the brace-count approximation) — recorded in `.trident/wave-audit/W3-desk.md`.
- **F2 (CODEOWNERS single owner)** deferred to the operator (no second handle exists).

## [2026-09-22T23:34:40Z] — THE P7 CHECKPOINT SEALED
`Checkpoints/github-master-kernel-ocr-hardened-20260922-232253` — Mode A (the full-tree copy: src 20 .ts · the 8 gates · the CI · the 11 canon docs · the 6
ship docs · the build package · the wave audits · the container results). `DEPLOYED_SHA.txt` carries
HEAD + the per-hook sha256. The manifest records the state, the verification at seal, and the 6
honest gaps. HEAD at seal: b4d91c8.

## [2026-09-23T04:42:29Z] — THE ROUND-4/5 OCR CAMPAIGN UPDATE (HEAD `e3bd0e1`)

**THE CURRENT HEAD:** `e3bd0e12a14e268c76679063570c545bf9cb707f` (branch `feat/github-master-kernel`).
**THE STATE:** tsc exit 0 · battery **85 pass / 0 fail** · P5 corpus 13/0 · tree clean
(excl. the live `runtime/watchdog-ledger.jsonl`).

**WHAT THIS CAMPAIGN CLOSED (the round-4/5 scans, the deep surface the earlier rounds missed):**
- **3 CRITICAL** — (1) `src/runtime.ts` `defaultRails` fetched `after=0` every tick, so with
  the 64 KB cap the daemon silently stopped processing live events (pinned by
  `tests/probe/cursor_probe.test.ts`); (2) `scripts/spec-diff.ts` resolved the spec ONE LEVEL
  ABOVE the repo, so the REQUIRED `gates/spec-gate` always exited 2 (UNMEASURED) — the mission
  spec is now vendored in-repo (`packages/jarvis-upper-tier/`, sha256 55aebe6f3c54db5f) and the
  gates measure (spec-diff exit 1, shape_freeze exit 0); (3) `src/guardrail.ts` STALE-GATE
  compared a SPEC invariant hash against a git sha (cross-domain → always stale) — a real
  `gate_pass.head_sha` column now carries the commit.
- **~20 HIGH** across `src/` — exception safety, null derefs, path containment, ambiguous
  hashing, COALESCE data loss, concurrent ticks, O(n²) rotation, missing FKs, tick-interval
  validation, `fileURLToPath`. Each at the INVARIANT, each pinned.
- **2 REFUTED** (with their measurements): `Bun.spawnSync().stdout` IS a Buffer (decodes UTF-8);
  the `attribute.ts` `.catch` uses a literal, not an out-of-scope `code` (tsc exits 0).

**THE RESIDUAL (named):** the LOCAL `gate_pass` mirror is now WIRED (synced from the
authoritative `guardrailRemote` read each tick — pinned by `tests/gate_pass_mirror.test.ts`);
the remaining scanner highs are adjudicated in `.trident/OCR_ADJUDICATION.md`. The ocr gate's
CONFIRMED critical/high count is ZERO; the raw scanner count mixes real defects with refuted
false positives (the convergence table is in the adjudication record).

**THE EVIDENCE:** `.trident/ocr-src-round4.json` … `round9.json`, `.trident/ocr-rest-round4.json`,
`.trident/OCR_ADJUDICATION.md`. The pins: `tests/probe/cursor_probe.test.ts`,
`tests/dossier_traversal.test.ts`, `tests/desks_traversal.test.ts`, `tests/gate_pass_mirror.test.ts`.
