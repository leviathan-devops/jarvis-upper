# pattern-header.sh — the GATE-HEADER STANDARD (W1 interfaces wave).
#
# SOURCED library, NOT an executable hook. Every gate sources it:
#   source "$(dirname "$0")/lib/pattern-header.sh"
#   pattern_header W-13 119 "a src/**/*.ts diff" "silent-fallback" "pre-commit"
#
# THE LAW (DPL1 §5 + §9): a gate is a (predicate x artifact-class) pair.
# The predicate is the easy half; naming the artifact class it applies to is
# the half that gets skipped — and skipping it produced both defects found
# this session (W-1 fired on every src/ commit in a repo with no extensions/
# dir; W-9 demanded a 100-line GitHub PR template). Every gate header MUST
# name (a) its Jev count — the measured occurrences in the 298-file corpus —
# and (b) the ARTIFACT CLASS its predicate applies to.
#
# DISCIPLINE: this file NEVER `set -e` — a sourced `set -e` would kill the
# caller on the first failing grep. Functions are `set -u`-safe (`${1:?...}`
# guards) and use no bare pipelines, so callers under `set -uo pipefail`
# source this safely.

# pattern_header <ID> <JEV_N> <ARTIFACT_CLASS> <THE_PATTERN_NAME> <THE_SURFACE>
# Prints the standard 5-line gate header to stdout.
pattern_header() {
  local id="${1:?"pattern_header <ID> <JEV_N> <ARTIFACT_CLASS> <PATTERN_NAME> <SURFACE>"}"
  local jev_n="${2:?"pattern_header <ID> <JEV_N> <ARTIFACT_CLASS> <PATTERN_NAME> <SURFACE>"}"
  local artifact_class="${3:?"pattern_header <ID> <JEV_N> <ARTIFACT_CLASS> <PATTERN_NAME> <SURFACE>"}"
  local pattern_name="${4:?"pattern_header <ID> <JEV_N> <ARTIFACT_CLASS> <PATTERN_NAME> <SURFACE>"}"
  local surface="${5:?"pattern_header <ID> <JEV_N> <ARTIFACT_CLASS> <PATTERN_NAME> <SURFACE>"}"
  printf '# GATE %s — %s\n' "$id" "$pattern_name"
  printf '# JEV COUNT: %s   (the measured occurrences in the 298-file corpus)\n' "$jev_n"
  printf '# ARTIFACT CLASS: %s\n' "$artifact_class"
  printf '# SURFACE: %s\n' "$surface"
  printf '# PREDICATE READS: %s — NEVER prose\n' "$artifact_class"
}

# gate_reject <ID> <THE_REASON> — prints REJECT(<ID>): <reason> to stderr,
# sets FAIL=1 (the pre-commit accumulation contract: return 0 so later
# checks still run; the caller exits 1 iff FAIL != 0 at the end).
gate_reject() {
  local id="${1:?"gate_reject <ID> <REASON>"}"
  local reason="${2:?"gate_reject <ID> <REASON>"}"
  printf 'REJECT(%s): %s\n' "$id" "$reason" >&2
  FAIL=1
  return 0
}

# gate_pass <ID> — prints "<ID>: PASS" to stdout.
gate_pass() {
  local id="${1:?"gate_pass <ID>"}"
  printf '%s: PASS\n' "$id"
}

# header_ok <a gate file> — exit 0 iff the file carries all 5 header lines,
# exit 1 otherwise (missing file included).
header_ok() {
  local f="${1:?"header_ok <gate-file>"}"
  [ -f "$f" ] || return 1
  grep -qE '^# GATE ' "$f" || return 1
  grep -qE '^# JEV COUNT: ' "$f" || return 1
  grep -qE '^# ARTIFACT CLASS: ' "$f" || return 1
  grep -qE '^# SURFACE: ' "$f" || return 1
  grep -qE '^# PREDICATE READS: ' "$f" || return 1
  return 0
}
