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

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
CURRENT="$WORK/current.json"
PATCHED="$WORK/patched.json"
RESULT="$WORK/result.json"

# 1. read the current LIVE ruleset
gh api "repos/$REPO/rulesets/$RULESET_ID" > "$CURRENT"

# 2. patch the required_status_checks array (idempotent: a second run
#    finds NEW_CONTEXT already present and changes nothing)
python3 - "$CURRENT" "$PATCHED" "$NEW_CONTEXT" <<'EOF'
import json
import sys
src, dst, new_ctx = sys.argv[1], sys.argv[2], sys.argv[3]
rs = json.load(open(src))
changed = False
for rule in rs.get("rules", []):
    if rule.get("type") != "required_status_checks":
        continue
    params = rule.setdefault("parameters", {})
    checks = params.setdefault("required_status_checks", [])
    have = [c.get("context") for c in checks]
    if new_ctx in have:
        continue  # already armed — leave this rule untouched
    entry = {"context": new_ctx}
    if "gates/test" in have:
        checks.insert(have.index("gates/test") + 1, entry)
    else:
        checks.append(entry)
    changed = True
# strip GET-only read-only fields the PUT endpoint rejects
for key in ("id", "node_id", "created_at", "updated_at", "_links"):
    rs.pop(key, None)
with open(dst, "w") as fh:
    json.dump(rs, fh, indent=2)
    fh.write("\n")
print("patched:", changed)
EOF

# 3. PUT the patched ruleset back
gh api -X PUT "repos/$REPO/rulesets/$RULESET_ID" --input "$PATCHED" > "$RESULT"

# 4. print the resulting context list so the orchestrator can verify
python3 - "$RESULT" <<'EOF'
import json
import sys
d = json.load(open(sys.argv[1]))
contexts = [
    c["context"]
    for r in d.get("rules", [])
    if r.get("type") == "required_status_checks"
    for c in r["parameters"]["required_status_checks"]
]
print(contexts)
print("count:", len(contexts))
EOF
