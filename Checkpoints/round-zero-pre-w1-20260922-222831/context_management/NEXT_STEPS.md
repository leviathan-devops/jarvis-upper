# NEXT STEPS — jarvis-upper (W4 → W5)

Queued work for the next wave, with the **risk register** (likelihood / impact /
mitigation) + a **dependency-ordered work queue**. Each item lists the gate it
unlocks and the defect or ruling it answers. All SHAs quoted verbatim.

---

## 1. RISK REGISTER (full)

| # | Risk | Likelihood | Impact | Mitigation | Linked defect / ruling |
|---|------|-----------|--------|------------|------------------------|
| R1 | fence2 sandbox has NO network → network done-when steps fail offline | Certain | High | Keep network-dependent steps out of fence2; run DB_1's hermetic step offline | EN-008 |
| R2 | `upper sync` returns prNodes 0 while a PR is open | Certain | Medium | Fix the stub (G14) before relying on sync | EN-010 |
| R3 | AO rejects `omp` as reviewer harness | Certain | High | Use `muse` (or aider/cursor) as the reviewer harness | D-005 |
| R4 | Desk-local model pin invisible to AO spawns | Proven | High | NEVER pin models at desk level — the `jarvis-worker` profile is the only pin | EN-019 / D-008 |
| R5 | ripwire crawl EXCLUDES jarvis-upper → cannot graph-verify edits here | Proven | Medium | Use grep/tsc/battery + fence2 for jarvis-upper edits; graph gate applies to Shared_Workspace only | EN-007 |
| R6 | AO daemon stale run-file + rotating X cookie | Proven | High | Use the daemon resume recipe in COMPACTION_SURVIVAL.md | EN-008 |
| R7 | PAT burned in session (embedded in a git remote URL, printed) | One-time | Critical | Operator must rotate; docs MUST NOT record credential material | D-010 / EN-020 |
| R8 | Global omp config still has deepseek default (operator's main omp) | By design | Low (non-worker) | That is the OPERATOR's omp; worker uses `jarvis-worker` profile | D-008 |
| R9 | AO review does not auto-trigger on PR update | Medium | Medium | Verify `autoReview:true` + reviewers:muse on PR event | D-005 |
| R10 | Any sha move invalidates G10 + G11 simultaneously | High (on next PR action) | High | Re-run BOTH fence2 + AO review on the new sha before any completion claim | D-004 |
| R11 | Canon docs fall under 200-line floor | Low | Low | Enforce `wc -l` ≥200 on every canon doc | D-001 |
| R12 | A desk-local or non-poolside model pin reappears | Medium | High | Reject desk-local pins; only `jarvis-worker` env | EN-019 |
| R13 | A single-source verdict is cited as completion | Medium | Critical | D-004 forbids; gate on BOTH G10+G11 | D-004 |
| R14 | A forbidden evidence token (commit/diffs/tests/PR) is cited | Medium | Critical | D-003 forbids; reviewer must reject | D-003 |

## 2. DEPENDENCY-ORDERED WORK QUEUE

### Wave W5a — CLOSE THE VERDICT LOOP (operator: "THIS IS THE ONLY THING THAT MATTERS")

Priority P1. Goal: get G11 (AO review approval of the frozen sha) to PASS so
the two-source law can close.

- **W5a.1** Confirm AO daemon up post-resume.
  Depends on: resume recipe (COMPACTION_SURVIVAL.md §1).
  Unlocks: W5a.2.
  Evidence: `curl /healthz` → 200.
- **W5a.2** Get an AO review run to APPROVE `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`.
  Depends on: W5a.1.
  Unlocks: G11.
  Evidence: `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`.
- **W5a.3** After sha move: RE-RUN fence2 on NEW head.
  Depends on: sha move.
  Unlocks: keeps G10 green.
  Evidence: new `VERDICT:PASS` row in `.../b6/verdicts.jsonl`.
- **W5a.4** After sha move: RE-RUN AO review on NEW head.
  Depends on: sha move.
  Unlocks: keeps G11 green.
  Evidence: `approved_sha == <new>`.

> D-004: Boolean FALSE unless BOTH G10 and G11 pass on the SAME sha.

### Wave W5b — FIX `upper sync` STUB (EN-010)

Priority P2. Goal: de-stub the sync path so sync returns live prNodes.

- **W5b.1** Make `upper sync` return real prNodes while a PR is open.
  Depends on: —
  Unlocks: G14.
  Evidence: `upper sync` > 0 prNodes when PR #1 OPEN.
- **W5b.2** Add regression test: sync must not return 0 when a PR exists.
  Depends on: W5b.1.
  Unlocks: G5.
  Evidence: test passes.
- **W5b.3** Re-run battery.
  Depends on: W5b.2.
  Unlocks: G5.
  Evidence: `52 pass / 0 fail / 183 expects / 16 files` (+1 test OK).

### Wave W5c — HARDEN THE DAEMON RESUME (EN-008)

Priority P3. Goal: make the daemon resume recipe one-liner and auto-park stale
run files.

- **W5c.1** Confirm daemon resume recipe reproducible after host reboot.
  Depends on: —
  Unlocks: operator confidence.
  Evidence: recipe boots; healthz 200.
- **W5c.2** Add one-liner guard: auto-park stale `~/.ao/running.json`.
  Depends on: —
  Unlocks: fewer manual steps.
  Evidence: stale file → `/tmp/running.json.stale`.

### Wave W5d — WORKER PROFILE RE-VERIFY (D-007/D-008)

Priority P4. Goal: confirm the worker profile pin has not drifted (R4, R12).

- **W5d.1** `cat ~/.omp/profiles/jarvis-worker/agent/config.yml` → default/task = `poolside/poolside/laguna-s-2.1:high`.
  Evidence: default poolside.
- **W5d.2** sonic/review/plan/slow = `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh`.
  Evidence: sonic row.
- **W5d.3** smol/scout = `openrouter/nvidia/nemotron-3.5-lightning:free`.
  Evidence: scout row.
- **W5d.4** `cat ~/.omp/agent/config.yml` → deepseek (NOT worker).
  Evidence: default deepseek.
- **W5d.5** AO spawn carries `OMP_PROFILE=jarvis-worker`.
  Depends on: `ao-client/session.ts`.
  Evidence: env var present in spawn.

### Wave W5e — JFM / AO INTEGRATION POLISH

Priority P5. Goal: tighten the JFM dispatch/steer/watch loop.

- **W5e.1** `jfm watch` SSE tail (INST-1/2/4).
  Depends on: `jfm/src/watch-ao.ts:1-84`.
  Unlocks: real-time.
  Evidence: SSE tails without false errors.
- **W5e.2** `jfm pr` open/create AO review PR.
  Depends on: `jfm/src/cli.ts:1-155`.
  Unlocks: tighter loop.
  Evidence: `jfm pr` opens GH PR.
- **W5e.3** Keep `bun test -t jfm_verbs` green.
  Unlocks: G7.
  Evidence: `8 pass / 0 fail`.
- **W5e.4** `jfm wave` integration with wave tracker.
  Depends on: `jfm/src/cli.ts:1-155`.
  Unlocks: wave dispatch.
  Evidence: `jfm wave` lists wave rows.

### Wave W5f — PAT ROTATION (operator must do — R7)

Priority P6. Operator action, not code.

- **W5f.1** ROTATE the PAT burned this session (W3).
  Evidence: operator confirms new PAT in use.
- **W5f.2** NEVER record the PAT in any doc.
  Evidence: `grep -RI "ghp_" context_management/` → empty.

### Wave W5g — CANON DOCS MAINTENANCE

Priority P7. Goal: keep the canon docs truthful across waves.

- **W5g.1** After sha move / PR close, update BUILD_STATE + EVIDENCE_STATE +
  TASK_QUEUE.
  Depends on: sha move / PR close.
  Evidence: SHAs match `git rev-parse HEAD`.
- **W5g.2** After new defect, append EN-xxx to RUNNING_DEBUG_LOG.
  Evidence: EN-xxx present.
- **W5g.3** After new wave, append WN to RUNNING_BUILD_LOG.
  Evidence: WN present.
- **W5g.4** Verify all 11 docs ≥200 lines + no placeholders.
  Evidence: `wc -l` table + grep empty.

## 3. BLOCKED ITEMS (and how to unblock)

| Blocker | If true | Then |
|---------|---------|------|
| G11 stays OPEN (no AO review approval of this sha) | two-source verdict never completes | NO completion claim is valid — operator will REJECT (D-004) |
| W5b N2 (upper sync stub) stays unfixed | sync returns 0 | any future sync-based automation breaks (EN-010) |
| W5d profile drifts | worker uses deepseek or a desk-local pin | EN-019 repeats (invisible pin) |
| PAT not rotated (R7) | credential leaked | operator must rotate before any public push |

## 4. THE FROZEN SHA WATCH

Any PR action that moves PR #1's head from `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`
INVALIDATES G10 + G11 simultaneously (R10). Before any completion claim after a
sha move, re-run:

```bash
fence2.py adjudicate upper-tier-dt-shapes \
  --expect-spec-sha <NEW_SHA>
# and confirm AO review approves <NEW_SHA>
```

## 5. QUEUE PRIORITY SUMMARY

| Priority | Wave | Purpose | Key gate moved |
|----------|------|---------|----------------|
| P1 | W5a | Close verdict loop | G11 OPEN → PASS |
| P2 | W5b | Fix sync stub | G14 BLOCKED → PASS |
| P3 | W5c | Daemon resume guard | EN-008 hardened |
| P4 | W5d | Profile re-verify | G15 stays PASS |
| P5 | W5e | JFM polish | G7 stays PASS |
| P6 | W5f | PAT rotation | R7 mitigated |
| P7 | W5g | Docs maintenance | D-001 satisfied |

## 6. ORDERING PRINCIPLES (operator-derived)

These principles are derived from the operator's rulings and the W1–W4 evidence.
They govern the order in which W5 waves execute.

- **Two-source is terminal.** Any job's completion requires BOTH G10 (fence2
  exit 0) AND G11 (AO review approves the same sha). Battery/tsc/runtime are
  supporting, never terminal. (D-004)
- **Does-anything-run gates everything.** Before any completion claim, re-run
  `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)`. (D-002)
- **No forbidden evidence.** Do not cite commit-exists / diff-changed /
  tests-pass / PR-open as proof of completion. (D-003)
- **Sha move = reset the verdict.** Any PR merge/rebase on PR #1 moves the head
  from `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` and invalidates G10+G11
  simultaneously. Re-run both before any new completion claim. (R10)
- **One pin, one place.** The model pin lives ONLY in the `jarvis-worker`
  profile. Desk-local pins are invisible (EN-019). (D-008)
- **Workers ≠ main omp.** The global `~/.omp/agent/config.yml` (deepseek) is
  the operator's interactive omp — NOT a worker. Do not touch it. (D-008)
- **Import, don't fork.** The JAM desk core and fence2 are imported, not
  forked. (L7)
- **Canon docs stay truthful.** After any sha move / PR close / new defect /
  new wave, update BUILD_STATE + EVIDENCE_STATE + TASK_QUEUE + the two running
  logs. (D-001)

## 7. WAVE-BY-WAVE EVIDENCE TARGETS

| Wave | G1 | G5 | G9 | G10 | G11 | G14 | G15 |
||------|----|----|----|-----|-----|-----|-----|
| W5a | PASS | PASS | PASS | PASS | OPEN→PASS | BLOCKED | PASS |
| W5b | PASS | PASS (+1) | PASS | — | — | OPEN→PASS | PASS |
| W5c | PASS | PASS | PASS | — | — | — | PASS |
| W5d | PASS | PASS | PASS | — | — | — | PASS (re-verify) |
| W5e | PASS | PASS | PASS | — | — | — | PASS |
| W5f | PASS | PASS | PASS | — | — | — | PASS |
| W5g | PASS | PASS | PASS | — | — | — | PASS |

Legend: `OPEN→PASS` = the target is to flip that gate from OPEN to PASS;
`BLOCKED` = stays blocked until its unblocked; `—` = out of scope for that
wave (already PASS or unrelated).

## 8. WHAT TO READ BEFORE STARTING W5

1. `POST-COMPACTION_PROMPT.md` — entry point + resume commands.
2. `BUILD_STATE.md` — SHAs + module inventory + line counts.
3. `EVIDENCE_STATE.md` — live tokens (reproduce before changing anything).
4. `DECISION_CHAIN.md` — rulings + rejected alternatives (read FIRST).
5. `TASK_QUEUE.md` — PASS / OPEN / BLOCKED + risk register.
6. `COMPACTION_SURVIVAL.md` — resume recipe + binding laws.
7. `RUNNING_BUILD_LOG.md` — W0–W4 receipts.
8. `RUNNING_DEBUG_LOG.md` — EN-001..EN-020.

## 9. THE FROZEN SHA WATCH (repeated)

`adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` — do not lose. Any move → re-run
G10 + G11 on the new sha.

End of NEXT_STEPS.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `2ee3f38f468f53cd15e376e8cca96d75fdcdc636` (jarvis-upper main) · **job head (PR #1):** `74f1b45a97a600b330db520a6e1f044564de1fa5`
- **VERDICT: VERIFIED** — fence PASS `spec_bound:true` + review `approved`, SAME sha
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green · jfm 8/0
- **jfm wave w0:** the desk `upper-tier-job` closed, `unverdicted: []`

---

# §APPEND — THE PARALLEL BUILD QUEUE (2026-09-22)

The W4→W5 queue above remains open. This appends the parallel build's live queue.

## THE ACTIVE LOOP

```
POLL -> AUDIT -> TODO BOARD -> CANON DOCS
```

## IN FLIGHT (at this append)

| the desk | the wave | the files |
|---|---|---|
| `DeskA2Publisher` | A-2 | `src/publish.ts` + `tests/publish_shape.test.ts` |
| `DeskA3Guardrail` | A-3 | `src/guardrail.ts` + `src/execute.ts` + 2 tests |
| `DeskB2CI` | B-2 | `.github/workflows/gates.yml` + `gates/fence-check.py` + `scripts/spec-diff.ts` |
| `D1MigrationMap` | D1 | `reports/D1_Migration_Map_v1.md` |

## THE IMMEDIATE QUEUE

| # | the action | the trigger |
|---|---|---|
| 1 | audit A-2 + A-3 on their returns | both desks idle |
| 2 | audit B-2 on its return | desk-b2 idle |
| 3 | fire the T2 gate: A-2+A-3 -> A-4 | A-2 and A-3 GREEN |
| 4 | fire the T1 gate: A-1+B-2 -> B-3 | B-2 GREEN + the contract on disk |
| 5 | harvest the D1 migration map | `D1MigrationMap` idle |
| 6 | the QC integration audit | all 8 waves green |
| 7 | the DOC loop | every completed todo |

## THE OPERATOR-ACTION ITEMS

| # | the action | why | the anchor |
|---|---|---|---|
| 1 | **UPGRADE to GitHub Pro ($4/mo)** | nothing arms without it | `gh api repos/.../rulesets` -> 403 |
| 2 | ratify the D1 phasing | the migration map governs the workspace rollout | `reports/D1_Migration_Map_v1.md` |

## NEW RISKS (append to the register above)

| # | Risk | Likelihood | Impact | Mitigation | Linked |
|---|---|---|---|---|---|
| R14 | A gate ported without checking the target's layout fires on everything | Proven | High | scope the predicate to the layout (`W-1`'s `[ -d extensions ]` guard) | FIRING-001 |
| R15 | The canon docs are overwritten instead of appended (destroying the W4 record) | Proven (this session) | High | state docs are UPDATED, logs APPEND; restore from git + append, never thin-replace | this append |
| R16 | `src/store.ts`'s SQL CHECK is a second source of truth for the gate names | Certain | Medium | keep the SQL list in sync with `GATE_TO_CONTEXT`'s keys; annotate the site | A-1 audit |
