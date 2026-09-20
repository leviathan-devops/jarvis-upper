# WAVE A — ASSEMBLE (fixture desk)
GOAL: assemble a v1 ship package from a PR set + history + tests + context.
INPUT (fixture, deterministic — no daemon, no factory):
  fixture/pr-set.json, fixture/history/, fixture/checks.json, fixture/context/
CONTRACT:
  1. read fixture/context (intent) and fixture/history + fixture/checks (reality)
  2. write ship/<target>-v1/ with manifest.json + source snapshot (sha16 per file)
  3. done condition: `bun desks/run.ts w4a` prints ship_manifest + manifest row exists
FORBIDDEN: network calls · daemon calls · editing fixture inputs.
FILES: ship/<target>-v1/manifest.json (created by you), src/assemble.ts
