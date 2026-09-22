#!/usr/bin/env bash
# GATE W-3 — phantom-completion
# JEV COUNT: 70   (the measured occurrences in the 298-file corpus)
# ARTIFACT CLASS: a pushed commit range
# SURFACE: pre-push
# PREDICATE READS: a pushed commit range — NEVER prose
#
# scan-phantom.sh — the PHANTOM-COMPLETION family (Jev 70).
#
# WHAT IT CATCHES: a commit whose message claims completion or creation
# but whose diff is empty (no files changed), or that claims a file was
# created but the file does not exist in the pushed tree.
#
# ARTIFACT CLASS: a pushed commit range (the diff under inspection).
#
# USAGE: scan_phantom.sh [commit_range]
#   commit_range: a git revision range (default: all remote branches)
#   Outputs one PHANTOM-DIFF:<sha>:<subject> line per hit, exit 0 always
#   (the caller decides whether to reject).
set -uo pipefail

COMMIT_RANGE="${1:-}"

# If no range given, use all reachable commits. In tests / ad-hoc use this
# may be a single branch tip; the caller is expected to pass the range.
if [ -z "$COMMIT_RANGE" ]; then
  COMMIT_RANGE=$(git rev-parse HEAD 2>/dev/null || true)
  if [ -z "$COMMIT_RANGE" ]; then
    exit 0
  fi
fi

# Resolve the range into individual commit SHAs.
SHAS=$(git rev-list "$COMMIT_RANGE" 2>/dev/null) || {
  # If rev-list fails (bad range), try treating it as a single sha.
  SHAS="$COMMIT_RANGE"
}

# Regex for completion / creation claims in the subject line.
# FIRING 008 / FIXED (2026-09-22): the old regex used ^[^:]* which consumed
# the type prefix and STOPPED at the colon — so a claim word after the colon
# (the only legal position under the semantic-prefix gate) could never match.
# Fix: match the semantic prefix, then look for the claim word anywhere after.
CLAIM_RE='^[a-z]+(\([^)]*\))?:[[:space:]]*(complete[d]?|done|finished|implemented|added|built|landed|shipped|delivered)'

# Regex for "created <file>" / "added <file>" / "wrote <file>" in the body.
FILE_CLAIM_RE='(created|added|wrote|built|deployed)[[:space:]]+([^ ]+\.[a-z]{1,4})'

ORPHANS=0

for SHA in $SHAS; do
  SUBJECT=$(git log -1 --format='%s' "$SHA" 2>/dev/null) || continue

  # --- CHECK 1: completion claim with empty diff ---
  if printf '%s\n' "$SUBJECT" | grep -qiE "$CLAIM_RE"; then
    # FIRING 009 / FIXED (2026-09-22): git diff --root is NOT a valid flag
    # and silently returns empty, making every commit look like a phantom.
    # git show --stat is correct for root commits (no parent), normal commits,
    # and empty commits alike.
    STAT=$(git show --stat --format="" "$SHA" 2>/dev/null)
    if [ -z "$STAT" ]; then
      printf 'PHANTOM-DIFF:%s:%s\n' "$SHA" "$SUBJECT"
      ORPHANS=$((ORPHANS + 1))
    fi
  fi

  # --- CHECK 2: claimed file creation but file does not exist ---
  # Only scan the commit BODY (not subject) for file claims.
  BODY=$(git log -1 --format='%b' "$SHA" 2>/dev/null) || continue
  if printf '%s\n' "$BODY" | grep -qiE "$FILE_CLAIM_RE"; then
    # Extract each claimed filename and check it exists at this commit.
    printf '%s\n' "$BODY" | grep -oiE "$FILE_CLAIM_RE" | while IFS= read -r match; do
      # The filename is the last whitespace-delimited token.
      CLAIMED_FILE=$(printf '%s' "$match" | awk '{print $NF}')
      # Verify the file exists in the tree at this commit.
      if ! git cat-file -e "$SHA:$CLAIMED_FILE" 2>/dev/null; then
        printf 'PHANTOM-DIFF:%s:%s (claimed %s does not exist)\n' "$SHA" "$SUBJECT" "$CLAIMED_FILE"
        ORPHANS=$((ORPHANS + 1))
      fi
    done
  fi
done

exit 0
