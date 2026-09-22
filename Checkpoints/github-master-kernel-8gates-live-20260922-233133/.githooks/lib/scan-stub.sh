#!/usr/bin/env bash
# GATE W-14 — no-stub
# JEV COUNT: 68   (the measured occurrences in the 298-file corpus)
# ARTIFACT CLASS: a staged src/**/*.ts diff
# SURFACE: pre-commit
# PREDICATE READS: a staged src/**/*.ts diff — NEVER prose
#
# scan-stub.sh — NO-STUB family scanner (Jev 68).
# SOURCED library exporting `scan_stub <file>`.
# Prints one `STUB:<file>:<line>:<matched text>` line per hit to stdout
# and returns the hit count as the exit code (0 = clean).
#
# SCOPED: the caller (pre-commit) invokes this ONLY for staged
# src/**/*.ts files. This library does NOT enforce scope itself — it scans
# whatever file it is given — so the artifact-class guard lives in pre-commit.
# NEVER point this at Checkpoints/** copies, *.md docs, or test fixtures.
#
# DISCIPLINE: no `set -e` (sourced under `set -uo pipefail` must survive a
# failing grep). All greps guarded with `|| true`.

# scan_stub <file> — scan one .ts/.js file for stub shapes.
# Output: one STUB: line per hit. Exit code: hit count (capped at 255).
scan_stub() {
  local f="${1:?"scan_stub <file>"}"
  [ -f "$f" ] || return 0
  local hits=0

  # 1. `stubbed: true` literal (incl. `return { stubbed: true }`).
  while IFS= read -r line; do
    printf 'STUB:%s:%s\n' "$f" "$line"
    hits=$((hits + 1))
  done < <(grep -nE 'stubbed[[:space:]]*:[[:space:]]*true' "$f" 2>/dev/null || true)

  # 2. `// TODO: implement` / `// FIXME: implement` on/near a function body.
  while IFS= read -r line; do
    printf 'STUB:%s:%s\n' "$f" "$line"
    hits=$((hits + 1))
  done < <(grep -nE '//[[:space:]]*(TODO|FIXME)[[:space:]]*:[[:space:]]*implement' "$f" 2>/dev/null || true)

  # 3. A function whose body is ONLY a NotImplemented throw:
  #    `throw new Error("not implemented")` / `throw new NotImplemented...`.
  while IFS= read -r line; do
    printf 'STUB:%s:%s\n' "$f" "$line"
    hits=$((hits + 1))
  done < <(grep -nE 'throw[[:space:]]+new[[:space:]]+(Error\([[:space:]]*["'"'"']not implemented|NotImplemented)' "$f" 2>/dev/null || true)

  # 4. `/* PROPOSED — empty */` / `/* PLACEHOLDER */` markers.
  while IFS= read -r line; do
    printf 'STUB:%s:%s\n' "$f" "$line"
    hits=$((hits + 1))
  done < <(grep -nE '/\*[[:space:]]*(PROPOSED[[:space:]]*—[[:space:]]*empty|PLACEHOLDER)[[:space:]]*\*/' "$f" 2>/dev/null || true)

  return "$hits"
}
