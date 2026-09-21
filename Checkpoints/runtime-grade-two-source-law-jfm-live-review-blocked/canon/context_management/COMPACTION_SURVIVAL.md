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

## 4. THE BINDING LAWS (do not break these on resume)

| Law | Source ruling | Statement |
|-----|---------------|-----------|
| L1 two-source verdict | D-004 | VERIFIED iff fence2 adjudicate exit 0 AND AO review approves the same head sha `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`. |
| L2 does-anything-run | D-002 | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` on every claim. |
| L3 no forbidden evidence | D-003 | commit-exists / diff-changed / tests-pass / PR-open are NOT verification. |
| L4 review harness = muse | D-005 | AO reviewers = `[{"harness":"muse"}]`, autoReview = true. AO rejects `omp`. |
| L5 battery by default | D-006 | `bun test` must stay green (`52 pass / 0 fail / 183 expects / 16 files`). |
| L6 worker profile pin | D-007, D-008 | `jarvis-worker` is the only spawn profile; default/task = `poolside/poolside/laguna-s-2.1:high`. |
| L7 import-don't-fork | (operator) | JAM desk core + fence2 are IMPORTED, never forked. |
| L8 one-pin law | D-008 | AO spawns carry `OMP_PROFILE=jarvis-worker`; no desk-local pin. |
| L9 PAT law | (operator) | Never record credentials; rotate burned PATs (EN-020). |
| L10 fence sandbox law | (design) | fence2 runs under `bwrap --unshare-all` (no network); DB_1's hermetic step runs offline. |

## 5. THE FROZEN HEAD SHA (do not lose)

```
adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

This is:
- PR #1 head (`ao/jarish-upper-2/root`, commits `760ad1b`, `732083e`, `adbdacf`).
- The sha fence2 adjudicated PASS for job `upper-tier-dt-shapes`.
- The sha the AO review must approve (G11).
- The sha `verify({headSha})` in `src/verdict.ts` keys off for VERIFIED.

Any PR merge or rebase MOVES this sha — and requires re-running BOTH fence2
(G10) AND the AO review (G11) on the NEW sha before completion.

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
| Re-run `bun test` + all 3 gates after resume | Don't cite PR-open / tests-pass / commit-exists as verification |
| Re-run fence2 + AO review on any sha change | Don't fork the JAM desk core or fence2 |
| Use the worker profile `jarvis-worker` for spawns | Don't set desk-local model pins (EN-019) |
| Rotate any burned PAT before public push | Don't record credentials in docs |
| Append WN to RUNNING_BUILD_LOG each wave | Don't leave EN-xxx defects undocumented |
| Read DECISION_CHAIN.md before changing anything | Don't re-attempt A-001..A-012 |

## 8. WHAT TO READ FIRST (post-resume)

1. `POST-COMPACTION_PROMPT.md` (entry point).
2. `BUILD_STATE.md` (SHAs + module inventory).
3. `EVIDENCE_STATE.md` (literal tokens that must reproduce).
4. `DECISION_CHAIN.md` (binding rulings).
5. `TASK_QUEUE.md` (PASS / OPEN / BLOCKED).

## 9. EMERGENCY RESET (if daemon is wedged)

```bash
# Stop everything cleanly
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

> Note: `pkill -f agent-orchestrator` is a last resort. Prefer the stale-run-file
> move in §1. Never touch credential material during reset.

## 10. PEER COORDINATION POST-COMPACTION

- This session's agent id is **CanonDocs**.
- Live peers: `hub op:"list"` (shows running+idle, never parked names).
- To wake a parked peer: address it by its roster id via `hub op:"send"`.
- `history://<id>` and `agent://<id>` remain readable after parking.
- Primary peer: `Main` (the main orchestrator).

End of COMPACTION_SURVIVAL.
