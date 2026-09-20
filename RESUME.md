# RESUME — jarvis-upper (for the next session)

## WHERE THE STATE LIVES (read these first, in order)
1. `OPERATIONAL_VERIFICATION.md` — every command + output; §10 the RUNNING seal; §11 the declaration + residual.
2. `gates/does_anything_run.sh` — the five questions. RUN IT FIRST: it answers whether anything runs, in ~1s.
3. `runtime/status.json` + `runtime/ticks.log` — the live state. A STALE status means the loop is not running.
4. `DEBUG_LOG.md` (EN-001…EN-008) — every defect and its mechanism.
5. `../reports/JarvisUpperTier_Runtime_Blueprint.md` (the design) + the two `*_source_derailment_pattern.md` recoveries (the 18 gates).

## HOW TO START / STOP / VERIFY
```
# start the loop (supervised)
hub start upper-runtime  (bun src/main.ts, UPPER_TICK_MS=3000)
# or one-shot:  UPPER_TICK_MS=1500 bun src/main.ts
bun src/cli.ts status        # RUNNING | STALE | DOWN  (exit 0 only when RUNNING)
bash gates/does_anything_run.sh .   # Q1..Q5, exit 0 iff all YES
bun test ; bunx tsc --noEmit ; bun scripts/spec-audit.ts
# the DAEMON (AO) if down:
DISPLAY=:1 XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.* | head -1) /usr/bin/agent-orchestrator
```

## OPEN (in priority order)
1. `prNodes=0` — no live PR has flowed; the railway's gates/plan/merge paths are test-proven, not PR-proven. Feed it a real (scratch) PR.
2. `kick` — wire the write-side adapter (steer-or-send / delegate) and clear `KICK-ADAPTER-UNWIRED`.
3. the desk RUNNER to foreman/Orca (the macro level: receive → assemble → harden → audit → research).
4. run the NEW pin through `scripts/spec-audit.ts` (it is audit-shaped; prove it).
5. the tree sits outside ripwire's crawl root (EN-007) — either move it inside or keep the recorded exemption.

## THE RULES THIS TREE RUNS UNDER
- No completion claim without `bash gates/does_anything_run.sh .` answering YES five times.
- Every capability has a non-test caller (`orphan_scan.sh`).
- Pre-written test shapes are frozen (`shape_freeze.sh`).
- JSON out of verbs; exit 0/1/2; no usage text on a real verb.
- Dead paths: never "railway" as a path/module; no `foreman start`; no partial project set-config.
