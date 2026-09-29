#!/usr/bin/env bash
# W6 — update the ARMED ruleset (id 23838059) to require the 8th context.
# Run by the ORCHESTRATOR (it holds the token out-of-band).
#
# Usage (from the repo root):
#   bash W6_ARM_COMMAND.sh
set -euo pipefail
RULESET_ID=23838059
REPO=leviathan-devops/jarvis-upper
NEW_CONTEXT=gates/theatrical-verification

# DEFENSIVE INIT under `set -u`: WORK is bound (empty) before mktemp, and the
# EXIT trap is guarded — a mktemp failure exits with mktemp's own error
# instead of the trap erroring on an unbound variable and masking it.
WORK=""
trap '[ -n "${WORK:-}" ] && rm -rf "$WORK"' EXIT
WORK=$(mktemp -d)
CURRENT="$WORK/current.json"
PATCHED="$WORK/patched.json"
PATCH_OUT="$WORK/patch.out"
RESULT="$WORK/result.json"

# 1. read the current LIVE ruleset
gh api "repos/$REPO/rulesets/$RULESET_ID" > "$CURRENT"

# 2. patch the required_status_checks array (idempotent: a second run
#    finds NEW_CONTEXT already present and changes nothing)
python3 - "$CURRENT" "$PATCHED" "$NEW_CONTEXT" <<'EOF' > "$PATCH_OUT"
import json
import sys
src, dst, new_ctx = sys.argv[1], sys.argv[2], sys.argv[3]
rs = json.load(open(src))
# ALLOWLIST PUT SHAPE: the PUT endpoint rejects unknown/read-only fields, and
# the GET payload carries server-owned keys beyond any denylist. Build the body
# from the canonical keys in ruleset.json
# (name/target/enforcement/conditions/rules/bypass_actors) instead of pruning.
PUT_KEYS = ("name", "target", "enforcement", "conditions", "rules", "bypass_actors")
changed = False
for rule in rs.get("rules", []) or []:
    if not isinstance(rule, dict):
        continue
    if rule.get("type") != "required_status_checks":
        continue
    params = rule.get("parameters")
    if not isinstance(params, dict):
        params = {}
        rule["parameters"] = params
    checks = params.get("required_status_checks")
    if not isinstance(checks, list):
        checks = []
        params["required_status_checks"] = checks
    have = [c.get("context") for c in checks if isinstance(c, dict)]
    if new_ctx in have:
        continue  # already armed — leave this rule untouched
    entry = {"context": new_ctx}
    if "gates/test" in have:
        checks.insert(have.index("gates/test") + 1, entry)
    else:
        checks.append(entry)
    changed = True
rs = {k: rs[k] for k in PUT_KEYS if k in rs}
with open(dst, "w") as fh:
    json.dump(rs, fh, indent=2)
    fh.write("\n")
print("patched:", changed)
EOF

# 3. PUT the patched ruleset back — SKIPPED when the patch is a no-op.
# Idempotence: re-running on an armed ruleset must not write the live ruleset
# needlessly (every PUT is a read-modify-write race window). An unreadable
# patch flag defaults to the no-op path, and step 4 still fails closed.
PATCHED_FLAG=$(sed -n 's/^patched: //p' "$PATCH_OUT" | tail -1)
if [ "$PATCHED_FLAG" = "True" ]; then
  gh api -X PUT "repos/$REPO/rulesets/$RULESET_ID" --input "$PATCHED" > "$RESULT"
else
  echo "already armed — skipping PUT (no-op)"
  cp "$CURRENT" "$RESULT"
fi

# 4. verify the resulting context list and FAIL CLOSED when NEW_CONTEXT is
# absent (a rejected PUT or concurrent edit must read as unarmed, never exit 0)
python3 - "$RESULT" "$NEW_CONTEXT" <<'EOF'
import json
import sys
d = json.load(open(sys.argv[1]))
want = sys.argv[2]
rules = d.get("rules", [])
if not isinstance(rules, list):
    print("ARM-ERROR:ruleset has no rules array", file=sys.stderr)
    sys.exit(1)
contexts = []
for r in rules:
    if not isinstance(r, dict) or r.get("type") != "required_status_checks":
        continue
    params = r.get("parameters") or {}
    if not isinstance(params, dict):
        print("ARM-ERROR:required_status_checks rule has no parameters mapping", file=sys.stderr)
        sys.exit(1)
    checks = params.get("required_status_checks") or []
    if not isinstance(checks, list):
        print("ARM-ERROR:required_status_checks is not a list", file=sys.stderr)
        sys.exit(1)
    for c in checks:
        contexts.append(c.get("context") if isinstance(c, dict) else None)
print(contexts)
print("count:", len(contexts))
if want not in contexts:
    print(f"ARM-FAILED:{want} absent after PUT", file=sys.stderr)
    sys.exit(1)
print(f"ARMED:{want} present")
EOF
