# WAVE B — HARDEN (fixture desk)
GOAL: harden one fixture module to S-tier: error paths, retries, observability.
INPUT: ship/<target>-v1/ from Wave A.
CONTRACT:
  1. run the module tests; record real tokens
  2. harden exactly the defect named in fixture/defect.json (one file)
  3. done condition: `bun desks/run.ts w4b` prints hardened + fence2 stub row
FORBIDDEN:scope creep beyond fixture/defect.json · silent fixes · mocks in prod paths.
