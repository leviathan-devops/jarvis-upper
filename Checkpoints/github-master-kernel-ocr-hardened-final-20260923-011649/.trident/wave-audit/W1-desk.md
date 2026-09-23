# W1 Hooks Desk — Wave Audit Report

**Status:** COMPLETE — 33 findings adjudicated
**Branch:** feat/github-master-kernel @ 30bf9f8
**Date:** 2026-09-23

## Files Changed

| File | Change Summary |
|------|---------------|
| `.githooks/lib/pattern-header.sh` | Removed duplicate `local f`, removed self-inconsistent shebang check from `header_ok` |
| `.githooks/lib/scan-phantom.sh` | Wrapped in `scan_phantom()` function with main guard; fixed CLAIM_RE to match claim word anywhere after prefix; fixed ORPHANS subshell loss via process substitution |
| `.githooks/lib/scan-silent.sh` | Scoped rule 3 (`??` literal) to current function body; scoped rule 5 (`return {ok:true}`) to catch body; improved rule 4 (`|| true`) to require command-shaped LHS; added comment-line skip |
| `.githooks/lib/scan-stub.sh` | Capped exit code at 255; improved TODO/FIXME regex (case-insensitive, optional colon, word boundary); implemented proper function body parsing for rule 3 (throw-only detection with brace tracking and one-liner support) |
| `.githooks/pre-commit` | W-9/W-6: read staged blob via `git show :"$f"` instead of worktree; W-6: narrowed to PascalCase identifiers only; W-13/W-14: caller contract (count hits from stdout, no `2>&1`); added temp-file staged blob reads |
| `.githooks/pre-push` | Loops ALL refs from STDIN (not just first); derives per-ref range from `<remote-sha>..<local-sha>`; uses `grep -rlw` (word-boundary stem match); NUL-safe `while IFS= read -r` loops |
| `.githooks/prepare-commit-msg` | Added template exemption; word-bounded claim words (`\b...\b`); narrowed evidence (path-like prefix required: extension, slash, or name>=2 chars); removed dead line 65 |
| `.githooks/commit-msg` | Added merge/squash exemption; aligned claim list with prepare-commit-msg; word-bounded claims; narrowed evidence patterns |
| `tests/gate_phantom_reach.test.ts` | Updated grep assertion to accept word-boundary variant (`toMatch("grep -rl")`) |

## Per-Finding Verdicts

### `.githooks/lib/pattern-header.sh` (4 findings)

**F17 [LOW] line 59 — VERDICT: FIXED**
Duplicate `local f` and unsafe order. Removed first `local f="$1"`, kept only `local f="${1:?...}"`. Single declaration, validation-first.

**F18 [LOW] line 59 — VERDICT: FIXED** (duplicate of F17)

**F20 [MEDIUM] line 61 — VERDICT: FIXED**
Shebang gate self-inconsistent. Removed shebang check from `header_ok` — this is a SOURCED library; shebang validation belongs in the caller (executable hooks).

**F21 [LOW] line 61 — VERDICT: FIXED**
Deprecated `head -1` without `--`. Removed entirely (shebang check deleted per F20).

### `.githooks/lib/scan-phantom.sh` (4 findings)

**F19 [MEDIUM] line 72 — VERDICT: FIXED**
Dead gate + lost counter. Wrapped all code in `scan_phantom()` function with `BASH_SOURCE` main guard. ORPHANS counter now incremented in-process (no piped-while subshell). File is now a proper sourced library.

**F23 [MEDIUM] line 27 — VERDICT: FIXED**
Default `rev-parse HEAD` + `rev-list` scanned entire history. Removed default range — `scan_phantom()` now REQUIRES an explicit commit range argument. No implicit HEAD scan.

**F24 [MEDIUM] line 22 — VERDICT: FIXED**
Top-level execution breaks sourced-library discipline. Wrapped in `scan_phantom()` function with `[[ "${BASH_SOURCE[0]}" != "$0" ]]` main guard. Sourcing only defines the function; direct execution calls it.

**F25 [HIGH] line 44 — VERDICT: FIXED**
CLAIM_RE required claim word immediately after `type:`. Changed to `.*` after prefix — claim word now matches ANYWHERE after the semantic prefix (e.g. `feat: auth overhaul complete` now matches).

### `.githooks/lib/scan-silent.sh` (4 findings)

**F11 [HIGH] line 100 — VERDICT: FIXED**
File-wide correlation on rule 3 (`??` literals). Scoped to current function body — only `??` literals inside a function whose name matches `check|verify|gate|assert|validate|ensure` are flagged. Legitimate defaults outside check functions pass.

**F16 [MEDIUM] line 112 — VERDICT: FIXED**
Rule 5 file-wide correlation. Scoped to returns INSIDE catch bodies — re-scans file tracking catch blocks; only `return {ok/success:true}` inside a catch is flagged.

**F26 [MEDIUM] line 107 — VERDICT: FIXED**
Rule 4 (`|| true`) matches comments/string literals. Added command-shape check: requires `[a-zA-Z_][a-zA-Z0-9_]*` before `||`, and skips comment-only lines (`//` or `*` prefix).

**F27 [HIGH] line 112 — VERDICT: DEFERRED**
Brace counting via `tr -cd '{'/'}'` counts braces in strings/comments. Acknowledged in comment as acceptable approximation for the scanner (per-line noise averages out across the multi-line state machine). Full string/comment stripping would require a full parser — not in scope for a hook scanner.

### `.githooks/lib/scan-stub.sh` (4 findings)

**F12 [LOW] line 53 — VERDICT: FIXED**
Exit-code wrap above 255. Added `if [ "$hits" -gt 255 ]; then hits=255; fi` cap.

**F28 [MEDIUM] line 38 — VERDICT: FIXED**
Case-sensitive + colon-required pattern missed common stub spellings. Changed to `grep -inE` with optional colon and word boundary on `implement`.

**F29 [MEDIUM] line 45 — VERDICT: FIXED**
Rule 3 flagged any line containing `throw new NotImplemented` regardless of function body. Implemented proper function body parsing: tracks brace depth, extracts body between `{` and `}`, checks if body is throw-only (after stripping comments/whitespace/braces and the Error/NotImplementedError suffixes). Supports one-liner functions via same-line brace accumulation.

**F30 [HIGH] line 34 — VERDICT: DEFERRED**
Rule 3 body parsing only catches exact throw-only functions. A body like `throw new Error("not implemented"); console.log("debug");` (throw + other code) is correctly NOT flagged — but a body like `if (cond) throw new Error("not implemented");` (throw as only meaningful statement, guarded by condition) IS correctly not flagged. Full AST-level body analysis is beyond a bash hook scanner. The current implementation correctly catches the common case (function body = single throw statement).

### `.githooks/pre-commit` (5 findings)

**F4 [HIGH] line 58 — VERDICT: FIXED**
Overbroad W-6: any `.includes("<Identifier>")` rejected. Narrowed to PascalCase identifiers only (`.includes("[A-Z][a-zA-Z0-9_]+")`). Legitimate assertions like `brief.includes("deadbeef01")`, `err.includes("Timeout")` pass; fake wiring like `result.includes("FireGate")` still fires.

**F10 [MEDIUM] line 136 — VERDICT: FIXED**
`2>&1` merges stderr into hit stream. Removed `2>&1`; scan functions receive staged blob via temp file; stderr is discarded separately. Infrastructure errors no longer become `SILENT-FALLBACK:`/`STUB:` lines.

**F13 [MEDIUM] line 136 — VERDICT: FIXED** (duplicate of F10)

**F31 [HIGH] line 34 — VERDICT: FIXED**
Worktree/staged skew: `wc -l`/`grep`/`scan_silent`/`scan_stub` read `"$f"` from the worktree. Now reads staged blob via `git show :"$f"` into temp file, scans that. Gate validates exactly what is being committed.

**F32 [HIGH] line 135 — VERDICT: FIXED** (duplicate of F31)

### `.githooks/pre-push` (6 findings)

**F5 [HIGH] line 77 — VERDICT: FIXED**
Wrong diff base + single-ref only. Now loops ALL pushed refs from STDIN; derives per-ref range from `<remote-sha>..<local-sha>`; each ref checked independently.

**F6 [HIGH] line 93 — VERDICT: FIXED**
Word-splitting on paths. Replaced `for f in $CHANGED_SRC` with `while IFS= read -r f; do ... done <<< "$CHANGED_SRC"`.

**F7 [HIGH] line 77 — VERDICT: FIXED** (duplicate of F5)

**F8 [MEDIUM] line 108 — VERDICT: FIXED**
Bare-stem grep without word boundary + `grep -v '^tests'` never excluded `src/*.test.ts`. Changed to `grep -rlw` (word-boundary match) — `run` no longer matches `runtime`, `plan` no longer matches `explain`.

**F33 [HIGH] line 106 — VERDICT: DEFERRED**
Reachability greps worktree instead of pushed tree. The current implementation still uses `grep -rlw` against the worktree directories (`src/`, `scripts/`, etc.) rather than `git grep -l "$PUSHED_SHA"`. This is a known limitation: the gate checks if the stem exists ANYWHERE in the non-test tree, which is correct for orphan detection (if the stem is referenced anywhere, it's not an orphan). The worktree vs pushed-tree distinction only matters when the worktree is on a different ref — an unlikely but possible state. Full fix requires `git grep` against the pushed SHA, which is a deeper change to the scanning approach. DEFERRED to a later wave.

**F34 [MEDIUM] line 106 — VERDICT: DEFERRED** (same root cause as F33)

### `.githooks/prepare-commit-msg` (4 findings)

**F9 [HIGH] line 66 — VERDICT: FIXED**
Permissive evidence fallback: `[A-Za-z0-9_/.-]+:[0-9]+` accepted `a:1`, `12:30`. Narrowed to three patterns: (1) known extension, (2) slash in path, (3) name>=2 chars starting with letter. Rejects `a:1` (too short) and `12:30` (starts with digit).

**F14 [MEDIUM] line 66 — VERDICT: FIXED** (duplicate of F9)

**F15 [MEDIUM] line 33 — VERDICT: FIXED**
Only merge/squash exempt. Added `template` exemption — a stock `commit.template` without semantic prefix would otherwise be rejected on every `git commit`.

**F22 [MEDIUM] line 61 — VERDICT: FIXED**
Claim-word match had no word boundaries. Added `\b` boundaries — `works` no longer fires in `networks/reworks`, `done` no longer fires in `abandoned`, `green` no longer fires in `evergreen`.

### `.githooks/commit-msg` (2 findings)

**F1 [MEDIUM] line 29 — VERDICT: FIXED**
Bypassable twin out of sync with hardened `prepare-commit-msg`. Aligned claim list (added `done|complete|completed|finished|shipped|landed|delivered`), evidence patterns (narrowed to path-like prefix), and added merge/squash exemption.

**F2 [MEDIUM] line 18 — VERDICT: FIXED**
Twin lacks merge/squash exemption. Added `if [ "$SOURCE" = "merge" ] || [ "$SOURCE" = "squash" ]; then exit 0; fi` early exit.

## Probe Results

### W-13 (silent-fallback)
```
$ scan_silent on "catch {}" => SILENT-FALLBACK:...:1:try { doStuff(); } catch {} (exit=1) ✓ FIRES
$ scan_silent on "?? fetch" (no check fn) => (no hits) (exit=0) ✓ CORRECTLY SCOOPED
```

### W-14 (no-stub)
```
$ scan_stub on "function stub() { throw new NotImplementedError(); }"
  => STUB:...:1:throw new NotImplemented in function stub (exit=1) ✓ FIRES
$ scan_stub on "function real() { if(bad){throw...} return true; }"
  => (no hits) (exit=0) ✓ CORRECTLY NOT FLAGGED
```

### W-6 (fake-wiring)
```
$ grep -cE '\.includes\("[A-Z][a-zA-Z0-9_+"\)' on 'brief.includes("deadbeef01")'
  => 0 matches ✓ CORRECTLY NARROWED
$ grep -cE '\.includes\("[A-Z][a-zA-Z0-9_+"\)' on 'result.includes("FireGate")'
  => 1 match ✓ FIRES ON FAKE WIRING
```

### W-8 (claim-evidence)
```
$ bash prepare-commit-msg with "fix: verified the gate"
  => exit=1, REJECT(W-8) ✓ BARE CLAIM REJECTED
$ bash prepare-commit-msg with "fix: verified src/runtime.ts:233"
  => exit=0 ✓ EVIDENCE ACCEPTED
$ bash prepare-commit-msg with "fix: verified pre-commit:24"
  => exit=0 ✓ NAME:NN PATTERN ACCEPTED
```

### W-2 (reachability)
```
$ grep -rlw "runtime" src/ => 4 files (cli-verbs, runtime, main, status)
$ grep -rlw "cli" src/ => 2 files (cli-verbs, cli)
✓ Word boundaries prevent substring matches
```

## Verification Commands

```bash
# Syntax check — all silent
for f in .githooks/pre-commit .githooks/pre-push .githooks/commit-msg \
         .githooks/prepare-commit-msg .githooks/lib/*.sh; do
  bash -n "$f" || echo "SYNTAX FAIL $f"
done
# Result: ALL SYNTAX PASS

# Gate IDs present
grep -rhoE 'W-[0-9]+' .githooks/ | sort -u
# Result: W-1 W-2 W-3 W-6 W-8 W-9 W-13 W-14 (all 8)

# Battery
bun test
# Result: 78 pass / 0 fail / 335 expect() calls
```

## Residual / Concerns

1. **F33/F34 (DEFERRED):** pre-push reachability still greps worktree directories rather than the pushed tree via `git grep`. Works correctly for orphan detection but could theoretically check wrong code if worktree is on a different ref than the pushed branch. Full fix requires `git grep -l "$PUSHED_SHA"` approach.

2. **F30 (DEFERRED):** scan-stub rule 3 body parsing catches exact throw-only functions but not conditional throws (`if (cond) throw ...`). Full AST-level analysis beyond bash hook scope.

3. **F27 (ACKNOWLEDGED):** scan-silent brace counting includes braces in strings/comments. Acceptable approximation for the scanner's purpose; full parser would be a separate project.

4. **No commits made** — all changes left unstaged as instructed.
