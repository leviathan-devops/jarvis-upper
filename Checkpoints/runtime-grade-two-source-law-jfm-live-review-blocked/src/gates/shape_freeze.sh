#!/usr/bin/env bash
# shape_freeze.sh — GR-5 / GS-4: the PRE-WRITTEN test shapes are a contract.
# Freezes the test identifiers declared in the build package's spec and
# reports any drift between the frozen list and what the tree implements.
# Usage: gates/shape_freeze.sh [repo-root]
#   first run  : writes gates/shape_freeze.sha16 (the freeze) and prints the list
#   later runs : prints DRIFT tokens when the implemented set differs
set -uo pipefail

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" || { echo "SHAPE-ERROR:root-missing"; exit 2; }

SPEC="../packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md"
FREEZE="gates/shape_freeze.sha16"

# The pre-written identifiers: `-t <id>` names + the DT ids, read from the spec.
DECLARED=$(grep -oE '(bun test -t [a-z_]+|-t [a-z_]+|DT[123])' "$SPEC" 2>/dev/null \
           | sed -E 's/.*-t //' | sort -u)
if [ -z "$DECLARED" ]; then
  echo "SHAPE-ERROR:no declared test ids found in $SPEC"
  exit 2
fi

IMPL=$(ls tests/*.test.ts 2>/dev/null | xargs -r -n1 basename | sed 's/\.test\.ts$//' | sort -u)

sha16() { printf '%s' "$1" | sha256sum | cut -c1-16; }
D_SHA=$(sha16 "$DECLARED")
I_SHA=$(sha16 "$IMPL")

echo "declared ($(printf '%s\n' "$DECLARED" | wc -l | tr -d ' ')): $(printf '%s ' $DECLARED)"
echo "implemented ($(printf '%s\n' "$IMPL" | wc -l | tr -d ' ')): $(printf '%s ' $IMPL)"

if [ ! -f "$FREEZE" ]; then
  printf '%s\n' "$D_SHA" > "$FREEZE"
  echo "FREEZE:wrote gates/shape_freeze.sha16=$D_SHA"
else
  F_SHA=$(cat "$FREEZE")
  if [ "$F_SHA" != "$D_SHA" ]; then
    echo "SHAPE-DRIFT:declared-set-changed frozen=$F_SHA now=$D_SHA"
  else
    echo "FREEZE:match=$D_SHA"
  fi
fi

DRIFT=$(comm -23 <(printf '%s\n' "$DECLARED") <(printf '%s\n' "$IMPL") | tr '\n' ' ')
if [ -n "${DRIFT// /}" ]; then
  for id in $DRIFT; do echo "TEST-SHAPE-DRIFT:$id (declared, not implemented)"; done
  exit 1
fi
echo "SHAPES:all declared ids implemented"
exit 0