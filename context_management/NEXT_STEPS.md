# NEXT STEPS — jarvis-upper (W4 → W5)

Queued work for the next wave. Each item lists the gate it unlocks and the
defect or ruling it answers. Priority is operator-driven (D-001 density, D-002
does-anything-run, D-003 no forbidden evidence, D-004 two-source law).

---

## PRIORITY 1 — CLOSE THE VERDICT LOOP (operator: "THIS IS THE ONLY THING THAT MATTERS")

| # | Task | Target | Unlocks | Evidence required |
|---|------|--------|---------|--------------------|
| N1.1 | Get an AO review run to APPROVE `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | `ao-client/review.ts` + AO dashboard | G11 | `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| N1.2 | Merge or rebase PR #1 (`ao/jarvis-upper-2/root`) so head sha advances | `jarvis-upper` repo PR #1 | G12 | PR state = merged/closed; new head sha recorded in BUILD_STATE |
| N1.3 | After any sha move, RE-RUN fence2 adjudicate on the NEW head | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha <new>` | keeps G10 green on new sha | new `VERDICT:PASS` row in `.../b6/verdicts.jsonl` |
| N1.4 | After any sha move, RE-RUN AO review on the NEW head | AO dashboard | keeps G11 green on new sha | `approved_sha == <new>` |

> The operator's ruling (D-004) is Boolean FALSE unless BOTH G10 and G11 pass on
> the SAME sha. Do not ship on a single source.

## PRIORITY 2 — FIX `upper sync` STUB (EN-010)

| # | Task | Target | Unlocks | Evidence required |
|---|------|--------|---------|--------------------|
| N2.1 | Make `upper sync` return real prNodes while a PR is open | `src/main.ts` (sync path) | G13 / G14 | `upper sync` output > 0 prNodes when PR #1 is OPEN |
| N2.2 | Add a regression test: sync must not return 0 when a PR exists | `tests/sync_test.ts` | G5 battery | test passes |
| N2.3 | Re-run battery after the fix | `bun test` | G5 | `52 pass / 0 fail / 183 expects / 16 files` (unchanged count OK if test added) |

## PRIORITY 3 — HARDEN THE DAEMON RESUME (EN-008)

| # | Task | Target | Unlocks | Evidence required |
|------|------|--------|---------|--------------------|
| N3.1 | Confirm daemon resume recipe is reproducible after a host reboot | COMPACTION_SURVIVAL.md recipe | operator confidence | `DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* \| head -1) /usr/bin/agent-orchestrator` boots; healthz `200` |
| N3.2 | Add a one-liner guard: if `~/.ao/running.json` is stale, auto-park it | `src/main.ts` pre-flight | fewer manual steps | stale run file auto-parked to `/tmp/running.json.stale` |

## PRIORITY 4 — RIPLEY/GRAPH GATE GAP (EN-007)

| # | Task | Target | Unlocks | Evidence required |
|------|------|--------|---------|--------------------|
| N4.1 | Confirm ripwire crawl EXCLUDES jarvis-upper (intentional) | ripwire config | clarity | `ripwire ... jarvis-upper` returns empty crawl |
| N4.2 | Gate jarvis-upper edits via grep + tsc + battery + fence2 (not graph) | gates/ | correct verification | all 4 gates green on edit |

## PRIORITY 5 — WORKER PROFILE / MODEL LAW (D-005, D-006, D-007, D-008)

The operator's rulings are binding. Do NOT regress:

| # | Task | Target | Evidence required |
|------|------|--------|--------------------|
| N5.1 | Verify `~/.omp/profiles/jarvis-worker/agent/config.yml` still has default/task = `poolside/poolside/laguna-s-2.1:high` | worker profile | `cat` the file → default poolside |
| N5.2 | Verify sonic/review/plan/slow = `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh` | worker profile | `cat` the file → sonic row |
| N5.3 | Verify smol/scout = `openrouter/nvidia/nemotron-3.5-lightning:free` | worker profile | `cat` the file → scout row |
| N5.4 | Verify GLOBAL `~/.omp/agent/config.yml` still has deepseek default | global config | `cat` → default `verboo/deepseek-v4.1-flash:max` |
| N5.5 | Verify AO spawn carries `OMP_PROFILE=jarvis-worker` | `ao-client/session.ts` | env var present in spawn |

## PRIORITY 6 — JFM / AO INTEGRATION POLISH

| # | Task | Target | Unlocks | Evidence required |
|------|------|--------|---------|--------------------|
| N6.1 | Add `jfm watch` for AO SSE stream (INST-1/2/4) | `jfm/src/watch-ao.ts` | real-time | `jfm watch` tails SSE without false errors |
| N6.2 | Add `jfm pr` to open/create AO review PR from a pinned job | `jfm/src/pr.ts` (if exists) | tighter loop | `jfm pr` opens GH PR |
| N6.3 | Keep `bun test -t jfm_verbs` green | JFM tests | G7 | `8 pass / 0 fail` |
| N6.4 | Add `jfm wave` integration with the wave tracker | `jfm/src/cli.ts` | wave dispatch | `jfm wave` lists wave rows |

## PRIORITY 7 — PAT ROTATION (operator must do)

| # | Task | Target | Evidence required |
|------|------|--------|--------------------|
| N7.1 | ROTATE the PAT burned this session (embedded in a git remote URL, printed) | repo secret / `gh auth` | operator confirms new PAT in use |
| N7.2 | NEVER record the PAT in any doc | all canon docs | grep PAT material → empty |

> This is operator responsibility (rotation, D-008). The doc set has already
> excluded all credential material per DECISION_CHAIN.md A-011.

## PRIORITY 8 — CANON DOCS MAINTENANCE

| # | Task | Target | Evidence required |
|------|------|--------|--------------------|
| N8.1 | After any sha move / PR close, update BUILD_STATE + EVIDENCE_STATE + TASK_QUEUE | context_management/ | SHAs match live `git rev-parse HEAD` |
| N8.2 | After any new defect, append EN-xxx to RUNNING_DEBUG_LOG | RUNNING_DEBUG_LOG.md | EN-xxx present |
| N8.3 | After any new wave, append WN to RUNNING_BUILD_LOG | RUNNING_BUILD_LOG.md | WN present |
| N8.4 | Verify all 11 docs ≥ 200 lines + no FILL/TODO | `wc -l` + `grep` | table in final report |

## RISK IF BLOCKED

| Blocker | If true | Then |
|---------|---------|------|
| G11 stays OPEN (no AO review approval of this sha) | two-source verdict never completes | NO completion claim is valid — operator will REJECT (D-004) |
| N2 (upper sync stub) stays unfixed | sync returns 0 | any future sync-based automation breaks (EN-010) |
| N5 profile drifts | worker uses deepseek or a desk-local pin | EN-019 repeats (invisible pin) |
| PAT not rotated | credential leaked | operator must rotate before any public push |

## WAVE PLANNING (W5 shape)

| Wave | Focus | Owner | Gates touched |
|------|-------|-------|--------------|
| W5a | Close verdict loop (G11 + G12) | Main + AO review | G10, G11, G12 |
| W5b | Fix `upper sync` stub | worker | G5, G14 |
| W5c | Daemon resume guard | CanonDocs | EN-008 |
| W5d | JFM polish (watch/pr/wave) | worker | G7 |

End of NEXT_STEPS.
