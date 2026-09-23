# W2-desk wave audit — CI + governance (`.github/**`)

Scope: `.github/workflows/gates.yml`, `.github/CODEOWNERS` ONLY.
(`.github/workflows/drift.yml` was already untracked at baseline and carries
zero W2 findings — untouched. No other file touched. NO COMMITS.)
Baseline: branch `feat/github-master-kernel` @ `30bf9f8`, battery 78/0, tsc 0.

## Per-finding verdicts (7/7 adjudicated both sides)

F1 [MEDIUM] `.github/CODEOWNERS:2` — VERDICT: FIXED — header claimed
"Enforced with Pro (require_code_owner_review)" while live `ruleset.json:53`
sets `require_code_owner_review: false` (confirmed by direct read). Header now
states ADVISORY ONLY and names the exact flag. No reliance possible.

F2 [MEDIUM] `.github/CODEOWNERS:7` — VERDICT: DEFERRED (operator decision) —
the single-owner risk is REAL (all 9 entries → `@leviathan-devops`; no team or
second handle exists anywhere in the repo — grepped `.github/`,
`GITHUB_ENFORCEMENT_MAP.md`, `ruleset.RATIONALE.md`: zero team handles).
Inventing a handle would be fabrication, so no owner was added. A NOTE comment
naming the risk + the remediation (team handle or second owner) is landed in
the file. Resume: operator supplies the handle, any desk adds it.

F3 [LOW] `.github/CODEOWNERS:17` — VERDICT: FIXED — `/CODEOWNERS` matched only
a repo-root file; `glob CODEOWNERS` at root → not found. Entry was dead (the
same owner already covers via `*` and `/.github/`). Line removed.

F4 [HIGH] `.github/workflows/gates.yml:103` (+ `:26`, `:63` same class) —
VERDICT: FIXED — `github.base_ref` is empty on `merge_group`, so all three
`origin/${{ github.base_ref }}..HEAD` sites failed under `set -e`. All three
now use `env.BASE = github.event.pull_request.base.sha ||
github.event.merge_group.base_sha` with a loud refusal
(`[ -n "${BASE}" ] || { echo "no base ref … refusing to guess"; exit 1; }`)
when neither is present. Zero `origin/` range refs remain outside comments
(grep proof). Per the post-fix sweep the SAME defect in `diff_budget:63` and
the commit-subject step `:26` got the identical fix — fixed the rule, not the
site.

F5 [MEDIUM] `.github/workflows/gates.yml:117` — VERDICT: FIXED (2/3) +
PROBE-ERROR (1/3) — (a) same-line `grep mock | grep expect(` → replaced with
FILE-LEVEL co-occurrence (`HAS_MOCK` anywhere + `HAS_EXPECT` anywhere);
(b) `for f in $CHANGED` → newline-safe `while IFS= read -r` over a herestring
(pipe avoided so FAIL propagates); (c) the `^[import|from|require]`
character-class claim is a PROBE-ERROR: grep proves that exact shape is absent
— the file already uses `^[[:space:]]*(import|from|require)\b`, a real
alternation. Left as-is, adjudication recorded in a file comment.

F6 [MEDIUM] `.github/workflows/gates.yml:95` — VERDICT: FIXED —
`theatrical_verification` now carries `timeout-minutes: 10` and
`permissions: { contents: read }` (least privilege; checkout needs read).

F7 [MEDIUM] `.github/workflows/gates.yml:53` — VERDICT: FIXED — `diff_budget`
reads labels into `LABELS` and branches on `EVENT`: the `oversized` escape
hatch applies ONLY on `pull_request`; an over-budget `merge_group` run fails
closed with a named reason (no silent null-match, no phantom hatch).

F12 (contract §18, digest `gates/fence-check.py`) — VERDICT: FIXED — new
`spec_gate` step provisions an EMPTY ledger path (mkdir + `: >`) when absent,
so fresh checkouts report the NAMED verdict `NO-PASS-ROW` (exit 1) instead of
unmeasured `ledger-missing` (exit 2). The step writes zero rows; no ledger
committed (verified: `git status` shows no `.trident/verdicts.jsonl`).

## Acceptance (quoted)

- YAML: `YAML OK` — `python3 -c "import yaml;
  yaml.safe_load(open('.github/workflows/gates.yml')); print('YAML OK')"`
- Jobs unchanged: `['anti_theatrical', 'diff_budget', 'issue_link', 'spec_gate',
  'test', 'theatrical_verification']` with names `gates/anti-theatrical …
  gates/theatrical-verification` (all 6 intact; `interface_match` passes).
- `pull_request_target`: absent from both workflow files (grep exit 1).
- Battery with ONLY W2 changes live (siblings stashed): `78 pass / 0 fail /
  335 expects`, `bunx tsc --noEmit` exit 0.
- merge_group proof: payload sim (`pull_request.base.sha` empty,
  `merge_group.base_sha=abc123…`) resolves `BASE=abc123…` via `${PR_SHA:-$MG_SHA}`
  and the workflow builds `"$BASE..HEAD"` — `origin/..HEAD` is unconstructible.
  Both-absent sim → loud refusal.
- Co-occurrence proof: split-shape fixture (`vi.mock` line 2, `expect(` line
  6) — OLD same-line pipeline: no hit (false negative confirmed); NEW
  file-level check: HIT. Space-path fixture (`mock far apart.test.ts`) — OLD
  loop: 3 split iters; NEW loop: 1 whole iter, exists-check yes.
- Ledger proof: fresh dir + provision step → `FENCE:deadbeef…:NO-PASS-ROW`,
  exit 1 (named, not exit 2).

## Residual / concerns

1. Full-tree battery reads 76/2 with all waves live. Proven NOT mine: the 2
   failures (`gate_phantom_reach.test.ts`) persist with my `.github/` changes
   stashed — they track the W1 hooks desk's live `.githooks/` edits. DM sent
   to W1HooksDesk; orchestrator to re-run the battery after all waves land.
2. F2 needs an operator-supplied second owner handle before
   `require_code_owner_review` can ever be safely enabled.
3. The `${BASE}` (vs `$BASE`) brace form is load-bearing: the in-repo
   `gate_theatrical` test rewrites `${BASE}` → `${CI_BASE}` to inject its
   fixture. Do not "simplify" the braces away.
