# WAVE C — AUDIT (seeded defect; the adversarial half)
GOAL: audit the hardened tree; every legit defect → bug_record + dossier.
FIXTURE: fixture/seeded-defect.json (a real planted bug, known commit).
CONTRACT:
  1. inspect hardened tree with no knowledge of the seed (adversarial: you are blind)
  2. for EACH legit defect found: insert bug_record (status open) + write dossier/ (dossier.md + origin.json + manifest.sha16 via dossier.ts)
  3. done condition: `bun desks/run.ts w4c` prints `bug recorded` AND seeded defect has a bug_record row
A SILENT FIX (defect fixed without bug_record) = FAIL, wave red, finding to RUNNING_DEBUG_LOG.
