#!/usr/bin/env bash
# theatrical_verification_scanner.sh — THE DEAD STUB (RECORD OF DECISION).
#
# STATUS: NOT WIRED — this file implements NO scan and is referenced by NO
# code path. The scan it names lives INLINE in
# `.github/workflows/gates.yml` (job `theatrical_verification`), and the
# in-repo executable copy of that logic is asserted by
# `tests/gate_theatrical.test.ts` (which extracts the job's run: body and
# fires it on bad/good fixtures). `git ls-files` below proves no job, hook,
# script, or test invokes this path.
#
# WHY A STUB THAT "EXITS 0" WOULD BE A FALSE GREEN: a later
# `gates/theatrical-verification` wiring that shells to this file would
# vacuously PASS every PR. A stub must therefore REFUSE, loudly (exit 1),
# so any accidental wiring fails closed instead of certifying nothing.
#
# IF YOU CAME HERE TO WIRE IT: do not shell to this file — invoke the
# gates.yml inline block (or the test's extracted copy), which is the
# reviewed logic. Deleting this file is also acceptable; this record exists
# only so the refusal is named rather than silent.
set -euo pipefail
echo "theatrical-verification-stub: NOT WIRED — the scan lives inline in .github/workflows/gates.yml (job theatrical_verification); this file refuses so an accidental wiring fails closed" >&2
echo "  evidence: no reference in CI/hooks/scripts/tests — run: git ls-files | xargs grep -l theatrical_verification_scanner" >&2
exit 1
