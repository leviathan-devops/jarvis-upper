# PLAN B — THE GITHUB SYSTEM BRAIN (the enforcement surface) — WAVE PLAN

WAVES: 4

Base tree: jarvis-upper @ main · measured: 0 workflows, 0 rulesets (403), 0 real hooks
Interface contract: reads Plan A's `src/status-contract.ts` (B-3 consumes the 7 strings)

## B-1 · HOOKS  (owner: desk-b1 · dep: none)
files:   .githooks/{prepare-commit-msg,pre-commit,pre-push,commit-msg} (new) · core.hooksPath
deliver: the 4 hooks; prepare-commit-msg carries W-8 (the absolute anchor)
done-when:
  - `git config --get core.hooksPath` -> .githooks
  - `bash .githooks/prepare-commit-msg /tmp/msg.txt message` on `fix: verified the gate` -> REJECT(W-8) exit 1
  - the same with `fix: 62 pass / 0 fail` -> exit 0
  - `.git/hooks/` untouched (14 samples only)

## B-2 · CI  (owner: desk-b2 · dep: none)
files:   .github/workflows/gates.yml (new) · gates/fence-check.py (new) · scripts/spec-diff.ts (new)
deliver: the 5-job workflow + the 2 missing scripts
done-when:
  - the YAML parses with 5 jobs named exactly: gates/anti-theatrical, gates/issue-link,
    gates/spec-gate, gates/diff-budget, gates/test
  - `python3 -m py_compile gates/fence-check.py` exit 0
  - `bun build scripts/spec-diff.ts --target=bun` exit 0
  - no `pull_request_target` anywhere

## B-3 · RULESET  (owner: desk-b3 · dep: A-1, B-2)  <- THE ONLY SERIAL POINT
files:   ruleset.json (new) · .github/CODEOWNERS · .github/pull_request_template.md ·
         .github/ISSUE_TEMPLATE/{task,incident}.md
deliver: the ruleset with the 7 contexts from the contract + the governance files
done-when:
  - the interface check passes: the 7 strings in ruleset.json == REQUIRED_CONTEXTS in src/status-contract.ts
  - the job names in ruleset.json == the job names in gates.yml
  - `gh api repos/.../rulesets --jq '.[].enforcement'` -> evaluate (then active after observation)

## B-4 · DRIFT + DOCS  (owner: desk-b4 · dep: B-2)
files:   .github/workflows/drift.yml (new) · the canon registration
deliver: the scheduled stale-gate sweep
done-when:
  - the workflow parses; `on: schedule` present
  - the canon docs record the wave
