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

if [ "$FAIL" -eq 1 ]; then
  echo "G-RT: FAIL (a named check above failed — fix it before starting the session)" >&2
  exit 1
fi
echo "G-RT: PASS (the runtime is reachable + greenable)"
exit 0
