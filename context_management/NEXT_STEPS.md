# NEXT STEPS — jarvis-upper (W4 → W5)

Queued work for the next wave, with the risk register (likelihood / impact /
mitigation) + a dependency-ordered work queue. Each item lists the gate it
unlocks and the defect or ruling it answers. All SHAs quoted verbatim.

---

## 1. RISK REGISTER

| # | Risk | Likelihood | Impact | Mitigation | Linked defect / ruling |
|---|------|-----------|--------|------------|------------------------|
| R1 | fence2 sandbox has NO network → network done-when steps fail offline | Certain | High | Keep network-dependent steps out of fence2; run DB_1's hermetic step offline | EN-008 context |
| R2 | `upper sync` returns prNodes 0 while a PR is open | Certain | Medium | Fix the stub (G14) before relying on sync | EN-010 |
| R3 | AO rejects `omp` as reviewer harness | Certain | High | Use `muse` (or aider/cursor) as the reviewer harness | D-005 |
| R4 | Desk-local model pin invisible to AO spawns | Proven | High | NEVER pin models at desk level — the `jarvis-worker` profile is the only pin | EN-019 / D-008 |
| R5 | ripwire crawl EXCLUDES jarvis-upper → cannot graph-verify edits here | Proven | Medium | Use grep/tsc/battery + fence2 for jarvis-upper edits; graph gate applies to Shared_Workspace only | EN-007 |
| R6 | AO daemon stale run-file + rotating X cookie | Proven | High | Use the daemon resume recipe in COMPACTION_SURVIVAL.md | EN-008 |
| R7 | PAT burned in session (embedded in a git remote URL, printed) | One-time | Critical | Operator must rotate; docs MUST NOT record credential material | D-008 / A-011 / EN-020 |
| R8 | Global omp config still has deepseek default (operator's main omp) | By design | Low (non-worker) | That is the OPERATOR's omp; worker uses `jarvis-worker` profile | D-008 |
| R9 | AO review does not auto-trigger on PR update | Medium | Medium | Verify `autoReview:true` + reviewers:muse on PR event | D-005 |
| R10 | Any sha move invalidates G10 + G11 simultaneously | High (on next PR action) | High | Re-run BOTH fence2 + AO review on the new sha before any completion claim | D-004 |
| R11 | W4 docs fall under 200-line floor | Low | Low | Enforce `wc -l` ≥200 on every canon doc | D-001 |
| R12 | A desk-local or non-poolside model pin reappears | Medium | High | Reject desk-local pins; only `jarvis-worker` env | EN-019 / L8 |

## 2. DEPENDENCY-ORDERED WORK QUEUE

### Wave W5a — CLOSE THE VERDICT LOOP (operator: "THIS IS THE ONLY THING THAT MATTERS")

| Step | Task | Depends on | Unlocks | Evidence |
|------|------|------------|---------|----------|
| W5a.1 | Confirm AO daemon up post-resume | resume recipe | W5a.2 | `curl /healthz` → 200 |
| W5a.2 | Get an AO review run to APPROVE `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | W5a.1 | G11 | `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| W5a.3 | If sha move: RE-RUN fence2 on NEW head | sha move | G10 | new `VERDICT:PASS` row |
| W5a.4 | If sha move: RE-RUN AO review on NEW head | sha move | G11 | `approved_sha == <new>` |

> D-004: Boolean FALSE unless BOTH G10 and G11 pass on the SAME sha.

### Wave W5b — FIX `upper sync` STUB (EN-010)

| Step | Task | Depends on | Unlocks | Evidence |
|------|------|------------|---------|----------|
| W5b.1 | Make `upper sync` return real prNodes while a PR is open | — | G14 | `upper sync` > 0 prNodes when PR #1 OPEN |
| W5b.2 | Add regression test: sync must not return 0 when a PR exists | W5b.1 | G5 | test passes |
| W5b.3 | Re-run battery | W5b.2 | G5 | `52 pass / 0 fail / 183 expects` (+1 test) |

### Wave W5c — DAEMON RESUME GUARD (EN-008)

| Step | Task | Depends on | Unlocks | Evidence |
|------|------|------------|---------|----------|
| W5c.1 | Confirm daemon resume recipe reproducible after reboot | — | operator confidence | recipe boots; healthz 200 |
| W5c.2 | Add one-liner guard: auto-park stale `~/.ao/running.json` | — | fewer manual steps | stale file → `/tmp/running.json.stale` |

### Wave W5d — WORKER PROFILE RE-VERIFY (D-006/7/8)

| Step | Task | Depends on | Unlocks | Evidence |
|------|------|------------|---------|----------|
| W5d.1 | `cat ~/.omp/profiles/jarvis-worker/agent/config.yml` → default/task = poolside | — | profile law | default poolside |
| W5d.2 | sonic/review/plan/slow = muse-spark on zen-free | — | profile law | sonic row |
| W5d.3 | smol/scout = nemotron | — | profile law | scout row |
| W5d.4 | `cat ~/.omp/agent/config.yml` → deepseek (NOT worker) | — | non-regression | default deepseek |
| W5d.5 | AO spawn carries `OMP_PROFILE=jarvis-worker` | ao-client/session.ts | spawn law | env var present |

### Wave W5e — JFM / AO INTEGRATION POLISH

| Step | Task | Depends on | Unlocks | Evidence |
|------|------|------------|---------|----------|
| W5e.1 | `jfm watch` SSE tail (INST-1/2/4) | — | real-time | SSE tails without false errors |
| W5e.2 | `jfm pr` open/create AO review PR | — | tighter loop | `jfm pr` opens GH PR |
| W5e.3 | Keep `bun test -t jfm_verbs` green | — | G7 | `8 pass / 0 fail` |
| W5e.4 | `jfm wave` integration with wave tracker | — | wave dispatch | `jfm wave` lists wave rows |

### Wave W5f — CANON DOCS MAINTENANCE

| Step | Task | Depends on | Unlocks | Evidence |
|------|------|------------|---------|----------|
| W5f.1 | After any sha move / PR close, update BUILD_STATE + EVIDENCE_STATE + TASK_QUEUE | sha move | doc truth | SHAs match `git rev-parse` |
| W5f.2 | After any new defect, append EN-xxx to RUNNING_DEBUG_LOG | defect | debug continuity | EN-xxx present |
| W5f.3 | After any new wave, append WN to RUNNING_BUILD_LOG | wave | build continuity | WN present |
| W5f.4 | Verify all 11 docs ≥200 lines + no FILL/TODO | — | D-001 | `wc -l` table + grep empty |

## 3. BLOCKED ITEMS (and how to unblock)

| Blocker | Unblock path |
|---------|--------------|
| G11 AO review approval not yet observed | W5a.2: drive the AO review run to approve `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| G14 `upper sync` STUB | W5b.1: de-stub the sync path |
| G13 spec-audit not triggered | trigger `bun run scripts/spec-audit.ts` per job |
| G12 PR #1 merge | W5a.2 approval → merge/rebase (then re-run G10+G11 on new sha) |

## 4. THE FROZEN SHA WATCH

Any PR action that moves PR #1's head from `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`
INVALIDATES G10 + G11 simultaneously (R10). Before any completion claim after a
sha move, re-run:

```bash
fence2.py adjudicate upper-tier-dt-shapes \
  --expect-spec-sha <NEW_SHA>
# and confirm AO review approves <NEW_SHA>
```

## 5. PAT ROTATION (operator must do — R7)

| Step | Task | Evidence |
|------|------|----------|
| N7.1 | ROTATE the PAT burned this session | operator confirms new PAT in use |
| N7.2 | NEVER record the PAT in any doc | `grep -R "<pat>" context_management/` → empty |

End of NEXT_STEPS.
