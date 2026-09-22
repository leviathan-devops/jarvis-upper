#!/usr/bin/env bash
# GATE W-13 — silent-fallback
# JEV COUNT: 119   (the measured occurrences in the 298-file corpus)
# ARTIFACT CLASS: a staged src/**/*.ts diff
# SURFACE: pre-commit
# PREDICATE READS: a staged src/**/*.ts diff — NEVER prose
#
# scan-silent.sh — SILENT-FALLBACK family scanner (Jev 119, highest count).
# SOURCED library exporting `scan_silent <file>`.
# Prints one `SILENT-FALLBACK:<file>:<line>:<matched text>` line per hit
# to stdout and returns the hit count as the exit code (0 = clean).
#
# SCOPED: the caller (pre-commit) invokes this ONLY for staged
# src/**/*.ts files. This library does NOT enforce scope itself — it scans
# whatever file it is given — so the artifact-class guard lives in pre-commit.
# NEVER point this at Checkpoints/** copies, *.md docs, or test fixtures.
#
# DISCIPLINE: no `set -e` (sourced under `set -uo pipefail` must survive a
# failing grep). All greps guarded with `|| true`. No awk/getline — a
# pure-bash line loop, so there is no stdin-consumption hang.

# scan_silent <file> — scan one .ts/.js file for silent-fallback shapes.
# Output: one SILENT-FALLBACK: line per hit. Exit code: hit count.
scan_silent() {
  local f="${1:?"scan_silent <file>"}"
  [ -f "$f" ] || return 0
  local hits=0
  local line=""
  local lineno=0

  # 1. Empty catch: `catch {}` / `catch (e) {}` on one line.
  while IFS= read -r line; do
    printf 'SILENT-FALLBACK:%s:%s\n' "$f" "$line"
    hits=$((hits + 1))
  done < <(grep -nE 'catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{\s*\}' "$f" 2>/dev/null || true)

  # 2. Comment-only catch: a `catch (...) {` whose body (possibly across
  #    lines) holds only comments/blank — no throw, no console/logger/report.
  #    Pure-bash brace-depth state machine. One-line `catch {}` hits belong
  #    to rule 1; here we flag multi-line comment-only bodies plus one-line
  #    `catch (e) { /* ignore */ }` shapes (rule 1 cannot see the comment).
  local in_catch=0 depth=0 start=0 body="" has_code=0
  lineno=0
  while IFS= read -r line || [ -n "$line" ]; do
    lineno=$((lineno + 1))
    if [ "$in_catch" -eq 0 ]; then
      if [[ "$line" =~ catch[[:space:]]*(\([^\)]*\))?[[:space:]]*\{ ]]; then
        in_catch=1; start="$lineno"; body="$line"; has_code=0
        depth=$(_brace_depth "$line")
        if [ "$depth" -le 0 ]; then
          # one-line catch: rule 1 counted the truly-empty ones; flag it
          # here only if it carries a comment and no rethrow/log.
          if [[ "$line" == *'/*'* || "$line" == *'//'* ]]; then
            if [[ "$line" != *throw* && "$line" != *console.* && "$line" != *logger.* && "$line" != *report* && "$line" != *rethrow* ]]; then
              # skip the truly-empty shape (rule 1 already reported it)
              stripped="$(printf '%s' "$line" | sed -E 's|/\*.*\*/||g; s|//.*$||g' | tr -d '[:space:]{}' || true)"
              stripped_nocatch="$(printf '%s' "$stripped" | sed -E 's/^.*catch//' || true)"
              if [ -n "$stripped_nocatch" ]; then
                printf 'SILENT-FALLBACK:%s:%d:%s\n' "$f" "$start" "catch with comment-only body (no rethrow/log)"
                hits=$((hits + 1))
              fi
            fi
          fi
          in_catch=0
        fi
      fi
    else
      body="${body}
${line}"
      depth=$((depth + $(_brace_depth "$line")))
      if [ "$depth" -le 0 ]; then
        in_catch=0
        code="$(printf '%s' "$body" | sed -E 's|/\*.*\*/||g; s|//.*$||g' || true)"
        if [[ "$code" != *throw* && "$code" != *console.* && "$code" != *logger.* && "$code" != *report* && "$code" != *rethrow* ]]; then
          stripped="$(printf '%s' "$code" | tr -d '[:space:]{}();' || true)"
          stripped_nocatch="$(printf '%s' "$stripped" | sed -E 's/^.*catch//' || true)"
          if [ -z "$stripped_nocatch" ]; then
            : # truly empty multi-line catch — still silent; flag it (rule 1
              # only sees one-line shapes, so no double count here)
            printf 'SILENT-FALLBACK:%s:%d:%s\n' "$f" "$start" "empty catch body spanning lines (no rethrow/log)"
            hits=$((hits + 1))
          else
            # non-empty but no rethrow/log — could be a silent literal
            # return (rule 5 reports the literal itself); flag the shape.
            printf 'SILENT-FALLBACK:%s:%d:%s\n' "$f" "$start" "catch body with no rethrow/log"
            hits=$((hits + 1))
          fi
        fi
      fi
    fi
  done < "$f"

  # 3. `?? <literal>` masking a failure inside a check/verify/gate function.
  #    Shape: a function name containing check|verify|gate|assert|validate|
  #    ensure AND a `?? 0` / `?? []` / `?? ""` / `?? ''` / `?? {}` literal.
  if grep -qE 'function[[:space:]]+[a-zA-Z0-9_]*(check|verify|gate|assert|validate|ensure)[a-zA-Z0-9_]*' "$f" 2>/dev/null; then
    while IFS= read -r line; do
      printf 'SILENT-FALLBACK:%s:%s\n' "$f" "$line"
      hits=$((hits + 1))
    done < <(grep -nE '\?\?[[:space:]]*(0|""|'"''"'|\[\]|\{\})' "$f" 2>/dev/null || true)
  fi

  # 4. `|| true` following a command-shaped call.
  while IFS= read -r line; do
    printf 'SILENT-FALLBACK:%s:%s\n' "$f" "$line"
    hits=$((hits + 1))
  done < <(grep -nE '\|\|[[:space:]]*true' "$f" 2>/dev/null || true)

  # 5. Pass-shaped literal returned on an error path:
  #    `return { ok: true ...}` / `return { success: true ...}` with a catch
  #    present in the file.
  if grep -qE 'catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{' "$f" 2>/dev/null; then
    while IFS= read -r line; do
      printf 'SILENT-FALLBACK:%s:%s\n' "$f" "$line"
      hits=$((hits + 1))
    done < <(grep -nE 'return[[:space:]]*\{[^}]*(ok[[:space:]]*:[[:space:]]*true|success[[:space:]]*:[[:space:]]*true)' "$f" 2>/dev/null || true)
  fi

  # cap: exit codes wrap above 255; callers use stdout lines as the record.
  if [ "$hits" -gt 125 ]; then hits=125; fi
  return "$hits"
}

# _brace_depth <line> — net `{` minus `}` count on one line (helper).
_brace_depth() {
  local l="${1:-}"
  local opens=0 closes=0
  opens=$(printf '%s' "$l" | tr -cd '{' | wc -c || true)
  closes=$(printf '%s' "$l" | tr -cd '}' | wc -c || true)
  opens=$(printf '%s' "$opens" | tr -d ' ' || true)
  closes=$(printf '%s' "$closes" | tr -d ' ' || true)
  printf '%d' "$((opens - closes))"
}
