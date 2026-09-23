# OCR FINDINGS DIGEST — the GATE FAIL inventory (128 findings / 40 files)

## summary: {"files_reviewed": 58, "comments": 128, "total_tokens": 3396845, "input_tokens": 3184172, "output_tokens": 212673, "cache_read_tokens": 2578922, "elapsed": "11m38s"}

## session_id: fc337185-e58e-46af-84d5-e2a20b017242

## per-file counts (normalized — live == checkpoint copy)
    8  src/verdict.ts
    6  W6_ARM_COMMAND.sh
    6  .githooks/pre-push
    5  scripts/spec-audit.ts
    5  .githooks/pre-commit
    5  src/kick.ts
    5  src/runtime.ts
    4  .github/workflows/gates.yml
    4  .githooks/lib/pattern-header.sh
    4  .githooks/lib/scan-phantom.sh
    4  .githooks/lib/scan-silent.sh
    4  .githooks/lib/scan-stub.sh
    4  .githooks/prepare-commit-msg
    4  src/desks.ts
    4  src/guardrail.ts
    4  src/cli-verbs.ts
    3  .github/CODEOWNERS
    3  scripts/interface-check.ts
    3  scripts/spec-diff.ts
    3  src/attribute.ts
    3  src/adapter-verbs.ts
    3  src/cli.ts
    3  src/sync.ts
    3  src/plan.ts
    3  src/publish.ts
    2  gates/fence-check.py
    2  .githooks/commit-msg
    2  src/dossier.ts
    2  src/execute.ts
    2  gates/shape_freeze.sh
    2  gates/orphan_scan.sh
    2  gates/does_anything_run.sh
    2  src/main.ts
    2  src/status-contract.ts
    2  src/status.ts
    1  theatrical_verification_scanner.sh
    1  .gitignore
    1  src/graph.ts
    1  src/reducers.ts
    1  src/store.ts

## the HIGH findings (verbatim, the gate blockers)

### [theatrical_verification_scanner.sh]
Empty stub exits 0: file contains only shebang + duplicated `set -e` with no scan logic. Verified `gates.yml:theatrical_verification` implements the check inline and no code references this script, so it is currently dead code — but if later wired to `gates/theatrical-verification` it would vacuously pass. Either implement the scan (mirroring the inline grep logic) or delete the file.

### [scripts/interface-check.ts]
Dynamic import, spread of REQUIRED_CONTEXTS, and JSON.parse have no try/catch or shape validation. A missing export, syntax error, or invalid JSON throws an unhandled rejection instead of the documented exit 2 (cannot-measure), conflating disagreement (exit 1) with unmeasured. Validate Array.isArray(mod.REQUIRED_CONTEXTS) and wrap import/parse in try/catch exiting 2, as done in tests/interface_match.test.ts.

### [scripts/spec-audit.ts]
readFileSync(specPath) has no existsSync guard or try/catch, so a missing default spec throws raw ENOENT with stack trace and no VERDICT line instead of fail-closed exit 2. The fixed scripts/spec-audit.ts and tests/spec_audit.test.ts require SPEC-AUDIT-ERROR:spec-missing + exit 2. Add the same guard before reading.

### [.github/workflows/gates.yml]
github.base_ref is empty on merge_group, so BASE is empty and `origin/..HEAD` fails with set -e. Same pattern breaks anti_theatrical (`origin/${{ github.base_ref }}..HEAD`) and diff_budget on merge_group despite their `if: ... merge_group`. Gate the merge_group path on github.event.merge_group.base_sha/head_sha or skip when BASE is empty.

### [gates/fence-check.py]
.trident/verdicts.jsonl is not committed and no CI step sets FENCE_LEDGER or creates the ledger, so spec_gate (`python3 gates/fence-check.py ... || exit 1`) always exits 2 ledger-missing in a fresh checkout and blocks all PRs. Either provision the ledger/artifact in CI or make spec_gate handle exit 2 as UNMEASURED/skip instead of fail.

### [.githooks/pre-commit]
Overbroad W-6: any `.includes("<Identifier>")` in tests/*.ts rejects, including legitimate string-containment assertions (e.g. `brief.includes("deadbeef01")`, `err.includes("Timeout")`). This blocks valid test commits. Narrow to source-text grep shapes (e.g. reading `src/` file content) or allowlist assertion targets.

### [.githooks/pre-push]
Wrong diff base + single-ref only + word-splitting + substring match: `head -1` picks arbitrary remote-tracking branch (wrong base with multiple remotes/branches); `break` keeps only first pushed SHA (multi-ref pushes unchecked); `for f in $CHANGED_SRC` splits on spaces; `grep -- "$BASENAME"` matches substrings (e.g. `run` hits `runtime`). Diverges from `gates/orphan_scan.sh` (searches `ao-client/ package.json`, handles `gen/routes.ts`). Resolve base per-ref via `<remote-sha>..<local-sha>`, loop all refs, use NUL/`while read`, anchor stem match.

### [.githooks/pre-push]
Word-splitting on paths: filenames with spaces break the orphan loop and `grep -v "^$f$"` exclusion. Use `while IFS= read -r` over NUL-delimited (`git diff -z`) or newline-safe loop.

### [.githooks/prepare-commit-msg]
Permissive evidence fallback: `[A-Za-z0-9_/.-]+:[0-9]+` accepts `a:1`, `12:30` (time) as file:line evidence, and `[a-f0-9]{7,}` accepts `1234567` as sha. Bare `done/complete/shipped` claims bypass the keystone gate. Require word boundaries + realistic shapes (e.g. sha `\b[0-9a-f]{7,40}\b` with a letter, path with `/` or known extension). Line 65 is subsumed by line 66, making it dead.

### [.githooks/pre-push]
Push range derived from arbitrary tracking branch instead of stdin range. `git for-each-ref | head -1` picks an unrelated base, checks only first PUSHED_SHA, and diffs full history when branches diverge (perf blowup / false REJECT / bypass). Derive per-ref `remote_sha..local_sha` from STDIN_LINES.

### [.githooks/lib/scan-silent.sh]
Fragile `??`-literal quoting and brace counting via `tr -cd '{'/'}'` counts braces inside strings/comments. Highest-count gate (Jev 119) can mis-attribute catch blocks and is hard to audit; no `??` usages exist in repo to validate the `('"'...` splice.

### [src/attribute.ts]
Shell injection: default Proc joins argv with `c.join(" ")` and runs via `sh -c`. Unsanitized `repo`/`file`/`line` (e.g. `foo;rm -rf …`, `$(…)` , quotes) can inject commands or spoof blame/log output. Helper `q()` is defined but never used. Spawn git directly with argv (no shell) or properly quote every arg.

### [src/dossier.ts]
Path traversal: `bugId` interpolated into dossier path with no sanitization, so `../` escapes `dossiers/` and `writeDossier` can overwrite arbitrary files via `mkdir -p` + `Bun.write`. Validate `bugId` against allowlist (e.g. /^[A-Za-z0-9_-]+$/) and reject `.`/`/` sequences.

### [src/desks.ts]
Path traversal/file overwrite: fixture-controlled `prs.files` entries interpolated into read/write paths with only `/`-root check. A `../` entry escapes `ship/<target>-v1/`. Canonicalize and enforce `startsWith(dir+"/")` for both source and dest.

### [src/guardrail.ts]
First-wins freezes stale status: `if (!(r.context in latest))` keeps the first row per context. If the statuses endpoint returns oldest-first, a red gate stays green (unsafe) or vice versa. Use last-wins or pick newest by timestamp.

### [src/kick.ts]
Unguarded JSON.parse crashes caller on malformed origin.json instead of controlled KICK error. Wrap with try/catch and throw `DOSSIER-CORRUPT`.

### [src/kick.ts]
Null-session crash when mode forced to `live`: `input.originSession!` throws TypeError if null instead of falling back or throwing `KICK-NO-SESSION`. Guard explicitly before `send`.

### [W6_ARM_COMMAND.sh]
Denylist strip is fragile for GET->PUT round-trip: only 5 keys are removed, so any other GET-only fields (e.g. `source`/`source_type`) are sent back to the PUT endpoint which rejects unknown/read-only fields. The in-repo canonical PUT shape in `ruleset.json` is allowlisted to `name/target/enforcement/conditions/rules/bypass_actors` — build the PUT body from those keys instead of pruning the GET payload.

### [gates/fence-check.py]
Bidirectional prefix test contradicts the docstring (`first |-segment is a prefix of <sha>`). `first.startswith(needle)` lets a truncated `sha` argument PASS on a short collision. CI passes full `${{ github.sha }}` so the second disjunct is dead there, but the helper still accepts short input as PASS locally and disagrees with its contract. Keep only the documented direction.

### [src/verdict.ts]
Inline require("node:fs") inside ESM/Bun module will throw ReferenceError where require shim is absent. Top-level `import { readFileSync } from "node:fs"` already exists at line 9 — reuse it instead of inline require so bind does not crash into FENCE-CANNOT-RUN path.

### [src/verdict.ts]
Hardcoded absolute machine paths make verify non-portable; any checkout without this path falls back to FENCE-NOT-RUN / LEDGER miss. Make defaults env-overridable or repo-relative.

### [src/verdict.ts]
Review source only inspects payload.runs and ignores payload.reviews (typed but unused). A daemon returning {reviews:[...]} with no runs is misclassified as REVIEW-NO-RUNS -> UNVERIFIED/red verdict. Merge runs+reviews or handle both shapes.

### [src/runtime.ts]
start() fires void tick() + setInterval without overlap guard or catch: overlapping ticks race on state.tick/status.json/rail_seq, and rejection in tick (writeStatus/orderMerges/guardrail) becomes unhandled rejection crashing daemon. Add in-flight flag and .catch.

### [.githooks/lib/scan-silent.sh]
Rule 5 correlates at file scope: any `return {ok:true/success:true}` is flagged if the file contains any `catch` anywhere, even when the return is on a success path unrelated to the catch. This yields false W-13 rejects. Restrict to returns inside the catch body tracked by the state machine above.

### [.githooks/pre-commit]
Worktree/staged skew: `wc -l/grep/scan_silent/scan_stub` read `"$f"` from the worktree, not the staged blob. Staging a clean doc then dirtying the worktree (or vice versa) gates the wrong content — bypass or false REJECT. Read via `git show :"$f"` (or `git cat-file -p :"$f" | ...`). Same flaw applies to the W-6 and W-13/W-14 loops below.

### [.githooks/pre-push]
Reachability greps the worktree (`src/ scripts/ gates/ bin/` on disk), not the pushed tree at $PUSHED_SHA. Pushing a branch while the worktree is on another ref checks the wrong code — false ORPHAN rejects or missed orphans. Use `git grep -l "$PUSHED_SHA" -- "$BASENAME" -- src scripts gates bin` / `git ls-tree`.

### [.githooks/lib/scan-phantom.sh]
CLAIM_RE still requires the claim word immediately after `type:` (`:[[:space:]]*(complete|done|...)`), so `feat: auth overhaul complete` / `fix: login works after retry` never match. This contradicts the comment promising 'claim word anywhere after' the prefix. Add `.*` after the prefix, e.g. `^[a-z]+(\([^)]*\))?:[[:space:]].*(complete[d]?|done|...)`.

### [.githooks/pre-commit]
W-13/W-14 scan the worktree file instead of the staged blob. If working-tree edits differ from the index (unstaged changes, partial staging), the gate approves/rejects the wrong content. Read the staged version (e.g. `git show :"$f" | scan_*`) or diff `--cached` output.

### [src/desks.ts]
Gate records `sha16(before)` (pre-fix content) while file on disk is post-fix, so any same-domain sha check compares stale value. Store hash of written content instead.

### [src/guardrail.ts]
Unvalidated `owner`/`repo`/`sha` interpolated into fetch URL allows path traversal/SSRF (`../`, query string). Validate against `^[A-Za-z0-9_.-]+$` / `^[0-9a-f]{40}$` and `encodeURIComponent` each segment.

### [src/kick.ts]
Split-brain dossier paths: content read from `input.dossierPath` but manifest read from `dossierRow?.p ?? input.dossierPath`. If DB and input diverge, TAMPER check is bypassed/misfires. Canonicalize to one path and reject mismatch.

### [gates/does_anything_run.sh]
Q3 fallback inverts semantics: it counts test files importing from `../src/` and stores that count in `ORPHANS`. Zero test importers then reports YES (no orphans), and N test importers is reported as N orphan modules. Fall back to fail-closed (e.g. ORPHANS=-1 / V3=NO) instead of reusing an importer count as an orphan count.

### [src/plan.ts]
Dropping edges where either endpoint is not in `onlyState` hides real dependencies (e.g. ready PR depends on open PR). Plan then orders it as if unconstrained, risking unsafe merge order. Include transitive deps or refuse/flag blocked nodes instead of `continue`.

### [src/publish.ts]
POST fetch has no timeout/abort, unlike rails/reviews paths. A hung GitHub API call stalls the whole runtime tick (and per-PR loop). Add AbortSignal.timeout.

### [src/reducers.ts]
Raw `state` string inserted without allow-list validation. Any daemon value outside ('open','ready_to_merge','merge_ordered','merged','rejected','kicked') violates the SQLite CHECK and throws inside the rail callback, losing frames. Validate/whitelist before upsert.

### [src/verdict.ts]
Empty headSha bypasses binding: ''.slice(0,40)==='' so startsWith('') is always true, no mismatch reported, allowing FENCE-GREEN on unknown sha. Reject empty/short headSha upfront.
