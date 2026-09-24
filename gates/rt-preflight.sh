#!/usr/bin/env bash
# G-RT — the runtime-artifact pre-flight (the common-sense firewall)
# Prevents: a session proceeding with a dead runtime (3 sessions ran with
# the AO daemon stopped and the publisher unwired, and nobody noticed).
# Usage: bash gates/rt-preflight.sh  (run at session start)
# exit 0 = the runtime is reachable + greenable; exit 1 = REJECT (named)
set -uo pipefail

FAIL=0

# 1. the AO daemon (the kernel's data source)
if curl -sf localhost:3001/healthz >/dev/null 2>&1; then
  echo "G-RT: AO daemon UP (:3001 -> 200)"
else
  echo "REJECT(G-RT): AO daemon DOWN on :3001 — start it:" >&2
  echo "  hub start ao-daemon (or: /usr/lib/agent-orchestrator/resources/daemon/ao daemon &)" >&2
  FAIL=1
fi

# 2. the kernel service (the tick loop + the publisher)
if systemctl --user is-active jarvis-upper >/dev/null 2>&1; then
  echo "G-RT: the kernel service is active"
else
  echo "REJECT(G-RT): the kernel service is DOWN — restart it:" >&2
  echo "  systemctl --user restart jarvis-upper.service" >&2
  FAIL=1
fi

# 3. the publisher is ARMED (the token is present)
if [ -f "$HOME/.config/jarvis-upper.env" ] && grep -q '^GH_TOKEN=' "$HOME/.config/jarvis-upper.env" 2>/dev/null; then
  echo "G-RT: the publisher token is present (out-of-band)"
else
  echo "REJECT(G-RT): the publisher token is ABSENT — the kernel cannot POST factory/*" >&2
  echo "  write GH_TOKEN=<token> to ~/.config/jarvis-upper.env (mode 600)" >&2
  FAIL=1
fi

# 4. the fence can go green (the recipe works — the fixture proof)
FENCE="$HOME/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py"
FIXTURE="/tmp/fence-green/job"
if [ -f "$FENCE" ] && [ -d "$FIXTURE" ]; then
  if python3 "$FENCE" adjudicate "$FIXTURE" \
    --expect-spec-sha "$(python3 "$FENCE" invariant-sha "$FIXTURE" 2>/dev/null)" \
    >/dev/null 2>&1; then
    echo "G-RT: the fence goes GREEN on the fixture (the recipe works)"
  else
    echo "REJECT(G-RT): the fence cannot go green on the fixture — the recipe is broken" >&2
    FAIL=1
  fi
else
  echo "G-RT: the fence fixture absent (not fatal — build it if the fence is needed)"
fi

# 5. the session worktrees carry a fence job (R7, red-team audit): the kernel
# adjudicates every session worktree, and one with NO SPEC.md makes every PR post
# factory/fence2=failure forever with nobody told why. A worktree that exists but
# carries no fence job is a NAMED refusal. (No worktrees yet = nothing to fence.)
WORKTREE_ROOT="${UPPER_WORKTREE_ROOT:-$HOME/.ao/data/worktrees/jarvis-upper}"
# FIXED (ship-gate MEDIUM): an EXPLICIT-but-missing override silently disabled the gate —
# `UPPER_WORKTREE_ROOT=/nonexistent` took the else branch and passed as "nothing to fence
# yet" while real worktrees under the default root went unfenced. Fail closed.
if [ -n "${UPPER_WORKTREE_ROOT:-}" ] && [ ! -d "$UPPER_WORKTREE_ROOT" ]; then
  echo "REJECT(G-RT): UPPER_WORKTREE_ROOT=$UPPER_WORKTREE_ROOT does not exist — refusing to PASS with an unverifiable worktree root" >&2
  FAIL=1
# FIXED (ship gate MEDIUM): a root that EXISTS but is not a LISTABLE directory (a regular
# file, a broken symlink, a dir missing +r/+x) fell through to "nothing to fence yet" and
# PASSed without verifying anything. Fail closed on an unverifiable root.
# FIXED (ship gate MEDIUM): `-e` is FALSE for a dangling symlink, so a broken-symlink root
# skipped both this REJECT and the `-d` branch and fell through to PASS. `-L` covers it.
elif { [ -e "$WORKTREE_ROOT" ] || [ -L "$WORKTREE_ROOT" ]; } && { [ ! -d "$WORKTREE_ROOT" ] || [ ! -r "$WORKTREE_ROOT" ] || [ ! -x "$WORKTREE_ROOT" ]; }; then
  echo "REJECT(G-RT): the worktree root $WORKTREE_ROOT is not a listable directory — refusing to PASS unverified" >&2
  FAIL=1
elif [ -d "$WORKTREE_ROOT" ]; then
  WT_N=0; WT_NO_SPEC=0
  # FIXED (ship-gate LOW): the `*/` glob skips dot-directories, so a hidden worktree
  # bypassed the gate while still being adjudicated. dotglob makes the glob complete.
  # FIXED (ship-gate LOW): an unconditional `shopt -u` clobbered the CALLER's option state.
  # Save + restore it.
  DOTGLOB_WAS=$(shopt -p dotglob 2>/dev/null || true)
  shopt -s dotglob 2>/dev/null || true
  for wt in "$WORKTREE_ROOT"/*/; do
    [ -d "$wt" ] || continue
    WT_N=$((WT_N + 1))
    # FIXED (ship-gate MEDIUM): -f was weaker than the fence's own readability check, so an
    # unreadable/empty SPEC.md passed here and still failed as FENCE-NO-SPEC. Require readable
    # AND non-empty.
    # FIXED (ship-gate LOW): -r/-s are true for a DIRECTORY, so require -f too; and
    # `basename --` stops a dash-prefixed name being parsed as an option.
    # FIXED (ship gate LOW): -s passes a whitespace-only file (a single newline). Require
    # non-BLANK content (grep -q for a non-space char), matching the fence's own refusal.
    if [ ! -f "$wt/SPEC.md" ] || [ ! -r "$wt/SPEC.md" ] || [ ! -s "$wt/SPEC.md" ] || ! grep -q -e '[^[:space:]]' -- "$wt/SPEC.md" 2>/dev/null; then
      # FIXED (ship-gate LOW): `basename --` is GNU-only (fails on BSD/macOS). Strip in-shell.
      WT_NAME="${wt%/}"; WT_NAME="${WT_NAME##*/}"
      echo "REJECT(G-RT): the worktree $WT_NAME has NO readable, non-empty SPEC.md — the fence would answer FENCE-NO-SPEC on every PR" >&2
      echo "  fix: write a SPEC.md naming a COMMITTED artifact (see .trident/remediation-pkg/)" >&2
      WT_NO_SPEC=$((WT_NO_SPEC + 1))
    fi
  done
  if [ -n "$DOTGLOB_WAS" ]; then eval "$DOTGLOB_WAS"; else shopt -u dotglob 2>/dev/null || true; fi
  if [ "$WT_NO_SPEC" -gt 0 ]; then
    FAIL=1
  elif [ "$WT_N" -eq 0 ]; then
    echo "G-RT: the worktree root exists but holds no session worktree (nothing to fence yet)"
  else
    echo "G-RT: $WT_N session worktree(s) carry a fence job"
  fi
else
  echo "G-RT: no worktree root at $WORKTREE_ROOT (nothing to fence yet)"
fi

if [ "$FAIL" -eq 1 ]; then
  echo "G-RT: FAIL (a named check above failed — fix it before starting the session)" >&2
  exit 1
fi
echo "G-RT: PASS (the runtime is reachable + greenable)"
exit 0
