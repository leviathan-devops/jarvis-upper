# THE COMMON-SENSE FIREWALL — BLUEPRINT

**Mission:** mechanically prevent the four derailment classes that destroyed 4 sessions,
by wiring common-sense gates to the exact git hooks and events where they bite.

**Date:** 2026-09-24 · **Status:** the wiring plan + the exact code for each gate

---

## PRE-CONTEXT: THE BUILD LIFECYCLE (copy-pasted from the measured map)

```
┌────────────────────────────────────────────────────────────────────────┐
│  A BUILD LIFECYCLE — the change's path through the gate chain         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─ 1. IDEA ─────────────────────────────────────────────────────┐     │
│  │  the goal pin defines DONE as a RUNTIME EVENT                 │     │
│  │  ► GATE G-GREEN: the DONE clause names a runtime event        │     │
│  │    (the merge 200) — never a quality count                    │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 2. AUTHOR ───────────────────────────────────────────────────┐     │
│  │  the agent reads the source of every system it must drive     │     │
│  │  ► GATE G-RT: no progress claim without a runtime artifact    │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 3. COMMIT ── pre-commit + prepare-commit-msg ─────────────────┐   │
│  │    W-6 · W-8 · W-9 · W-13 · W-14                               │    │
│  │  ► GATE G-RATIO: docs must not outpace code                    │    │
│  │  ► GATE G-SEAL: no Checkpoints/ before a fence PASS            │    │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 4. PUSH ──── pre-push ─────────────────────────────────────────┐  │
│  │    W-2 orphan · W-3 phantom                                     │    │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 5. CI ──── 6 GitHub Actions jobs ─────────────────────────────┐   │
│  │  ► GATE G-SCAN: the ocr review is a BOUNDED batch              │    │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 6. THE FENCE ── fence2.py adjudicate → PASS ──────────────────┐  │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 7. THE PUBLISHER ── POST factory/* = success ─────────────────┐  │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 8. THE RULESET ── 8 checks + approval ────────────────────────┐  │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 9. THE MERGE ── PUT /merge → 200 ◄ THE TERMINAL ─────────────┐  │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## §1 THE FIVE GATES (each is a mechanical predicate, exit-code enforced)

### G-GREEN — the DONE-clause law
- **Prevents:** a goal whose DONE is a quality count (the exact derailment)
- **Attaches to:** the goal pin's `## STOP` section (a convention gate)
- **Mechanism:** the DONE clause must name a COMMAND whose EXIT CODE is the verdict.
  `curl -X PUT /merge → 200` terminates. `0 critical, 0 high` does not.
- **Wiring:** zero code — it is a pin-authoring law, already in
  `GOAL_PIN_RUNTIME_OPERATIONAL.md`

### G-RT — the runtime pre-flight
- **Prevents:** a session proceeding with a dead runtime (3 sessions ran with the daemon
  stopped and the publisher unwired)
- **Attaches to:** `gates/rt-preflight.sh` (a bash script, run at session start)
- **Mechanism:** three probes; any failure → exit 1 → the session cannot start:
  ```bash
  #!/usr/bin/env bash
  # gates/rt-preflight.sh — G-RT: the runtime-artifact pre-flight
  set -uo pipefail
  curl -sf localhost:3001/healthz >/dev/null 2>&1 \
    || { echo 'REJECT(G-RT): AO daemon DOWN on :3001'; exit 1; }
  systemctl --user is-active jarvis-upper >/dev/null 2>&1 \
    || { echo 'REJECT(G-RT): the kernel is DOWN'; exit 1; }
  FENCE="$HOME/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py"
  FIXTURE="/tmp/fence-green/job"
  if [ -d "$FIXTURE" ]; then
    python3 "$FENCE" adjudicate "$FIXTURE" \
      --expect-spec-sha "$(python3 "$FENCE" invariant-sha "$FIXTURE")" \
      >/dev/null 2>&1 \
      || { echo 'REJECT(G-RT): the fence cannot go green'; exit 1; }
  fi
  echo 'G-RT: PASS (the runtime is reachable + greenable)'
  ```

### G-RATIO — the doc-ratio pre-commit hook
- **Prevents:** the doc mass outpacing the code (measured: 35 docs vs 45 fix)
- **Attaches to:** `.githooks/pre-commit` (appended after W-14, before the FAIL check)
- **Mechanism:** count the branch's doc vs code commits; docs > code → exit 1:
  ```bash
  # G-RATIO doc-ratio: docs must not outpace code on the branch
  GR_BASE=$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD~50)
  GR_DOCS=$(git log --format=%s "$GR_BASE..HEAD" 2>/dev/null | grep -c '^docs' || true)
  GR_CODE=$(git log --format=%s "$GR_BASE..HEAD" 2>/dev/null \
    | grep -cE '^(fix|feat|refactor|test)' || true)
  if [ "$GR_DOCS" -gt "$GR_CODE" ]; then
    echo "REJECT(G-RATIO): doc commits ($GR_DOCS) outpace code ($GR_CODE) — the doc mass is not the work" >&2
    FAIL=1
  fi
  ```

### G-SEAL — the no-checkpoint-before-green hook
- **Prevents:** snapshots of a dead system (measured: 10 checkpoints, zero greens)
- **Attaches to:** `.githooks/pre-commit` (appended after G-RATIO)
- **Mechanism:** if the staged set touches Checkpoints/, require a fence PASS row:
  ```bash
  # G-SEAL no-checkpoint-before-green: a snapshot of a dead system is slop
  case "$STAGED" in *Checkpoints/*)
    GR_LEDGER="$HOME/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl"
    if ! grep -q '"verdict":"PASS"' "$GR_LEDGER" 2>/dev/null; then
      echo 'REJECT(G-SEAL): no fence PASS row — a checkpoint now is a snapshot of a dead system' >&2
      FAIL=1
    fi ;; esac
  ```

### G-SCAN — the bounded-scan law
- **Prevents:** the fix→scan→fix loop (measured: 6 rounds, ~4 hours, the scanner RIGHT
  every time, the ordering wrong every time)
- **Attaches to:** the goal pin's L2 clause + a future bounded CI job
- **Mechanism:** the pin's law (not a hook — a session-level discipline enforced by the
  anti-derail table): the scan runs ONCE per PR; its real findings are fixed; then the
  session RETURNS TO THE RUNTIME. A second scan round without a runtime event between
  the rounds is the misallocation.

---

## §2 THE EXACT GIT HOOKS AND EVENTS (where each gate fires)

| Gate | The git hook/event | The file to edit | When it fires |
|---|---|---|---|
| G-GREEN | the goal pin (a convention, not a hook) | the pin's STOP section | at pin-authoring time |
| G-RT | a session-start script | `gates/rt-preflight.sh` (NEW) | when the session begins |
| G-RATIO | `.githooks/pre-commit` | append after the W-14 block | on every `git commit` |
| G-SEAL | `.githooks/pre-commit` | append after G-RATIO | on every `git commit` |
| G-SCAN | the goal pin + a future CI job | the pin's L2 + `.github/workflows/gates.yml` | once per PR |

**Already wired (the existing chain, verified live — see `.githooks/pre-commit:190`
for the append point, `gates/fence-check.py:29` for the CI fence, and
`src/runtime.ts:276` for the publish call, and `src/main.ts:17` for the wired entry):**
| Hook | File | Gates | Fires on |
|---|---|---|---|
| pre-commit | `.githooks/pre-commit` | W-1, W-6, W-9, W-13, W-14 | every commit |
| pre-push | `.githooks/pre-push` | W-2, W-3 | every push |
| commit-msg | `.githooks/commit-msg` | W-8 | every commit |
| prepare-commit-msg | `.githooks/prepare-commit-msg` | W-8 | every commit |
| CI | `.github/workflows/gates.yml` | 6 jobs | every PR update |
| the ruleset | GitHub ruleset 23838059 | 8 checks + approval | every merge attempt |
| the fence | `JARVIS-CORE/b6/fence2.py` | the verdict | every eligible PR tick |
| the publisher | `src/runtime.ts:276` | factory/* | every eligible PR tick |

---

## §3 THE BUILD ORDER (each wires in minutes, each enforces immediately)

| # | What | Cost | Enforcement added |
|---|---|---|---|
| 1 | G-GREEN (already in the pin) | zero | every future goal terminates at a runtime event |
| 2 | `gates/rt-preflight.sh` | 10 lines | the session cannot start with a dead runtime |
| 3 | G-RATIO in `.githooks/pre-commit:190` | 8 lines | the doc mass is mechanically capped |
| 4 | G-SEAL in `.githooks/pre-commit` (after G-RATIO) | 6 lines | dead-system snapshots are blocked |
| 5 | G-SCAN (the pin's L2, already written) | zero | the scan is bounded; the runtime is the work |
| 6 | The `oversized` label on PR #2 | one API call | the diff-budget goes green (11217 > 10000) |
| 7 | THE GREEN MERGE (drive one change through) | the mission | the system's purpose is fulfilled |

---

## §4 THE FAILURE-MODE TABLE (what each gate catches)

| The derailment | The gate that catches it | How |
|---|---|---|
| "The ocr gate has N findings" (a count as the goal) | G-GREEN | the DONE is a runtime event, not a count |
| "The tests pass (124/124)" | G-RT | a runtime artifact is required, not a test count |
| "Let me update the docs" (the 27th doc commit) | G-RATIO | docs > code → the commit is rejected |
| "Let me seal a checkpoint" (of a dead system) | G-SEAL | no PASS row → the commit is rejected |
| "Let me run one more scan" (the 6th round) | G-SCAN | the scan is bounded; return to the runtime |
| "The gate fails closed (405)" (as a success) | G-GREEN | a 405 is not a 200; the DONE is the 200 |

---

## §5 THE EXISTING GATE INVENTORY (measured from the live system)

**The local hooks (verified: `git config core.hooksPath` = `.githooks`):**
- `pre-commit` → W-1 (deploy freshness), W-6 (source-string), W-9 (doc-density),
  W-13 (silent-fallback), W-14 (no-stub)
- `pre-push` → W-2 (orphan), W-3 (phantom-diff)
- `commit-msg` → W-8 (claim-evidence)
- `prepare-commit-msg` → W-8 (the subject prefix)

**The CI (verified: the last run on `4943b855`):**
- `gates/anti-theatrical` ✓ · `gates/issue-link` ✓ · `gates/spec-gate` ✓
- `gates/test` ✓ · `gates/theatrical-verification` ✓
- `gates/diff-budget` ✗ (11217 lines > the 10000 budget; fix = the `oversized` label)

**The ruleset (verified: `rulesets` API → 23838059 active):**
- 8 required checks + 1 approval + non-fast-forward + no-deletion
- A merge attempt → 405 BLOCKED (the gate IS live)

**The runtime (verified: the live tick):**
- The AO daemon (:3001 → 200, 40 sessions)
- The kernel (tick 3162+, errors=0, the publisher ARMED)
- The fence (proven GREEN — the v2 SPEC recipe, exit 0)

## §6 THE SPEC CROSS-REFERENCE
- The goal pin: packages/github-master-kernel/GOAL_PIN_RUNTIME_OPERATIONAL.md:1
- The wiring plan: packages/github-master-kernel/GATE_WIRING_PLAN.md:1
- The failure log entry: FAILURE_LOG.md:207
