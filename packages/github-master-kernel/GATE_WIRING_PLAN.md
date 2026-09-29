# THE BUILD LIFECYCLE THROUGH THE GATES — AND THE INCREMENTAL WIRING PLAN

**Measured from the live system · every gate names its wiring point · each wires in minutes.**

---

## THE FULL BUILD LIFECYCLE (entry to terminal, through every gate)

```
┌────────────────────────────────────────────────────────────────────────┐
│  A BUILD LIFECYCLE — the change's path through the gate chain         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─ 1. IDEA ─────────────────────────────────────────────────────┐     │
│  │  the operator states a change; the goal pin defines DONE      │     │
│  │  as a RUNTIME EVENT (the merge 200)                           │     │
│  │  ► GATE G-GREEN: the pin's DONE clause must name a runtime    │     │
│  │    event — never a quality bar (a count permits infinite      │     │
│  │    chasing; a runtime event terminates)                       │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 2. AUTHOR ───────────────────────────────────────────────────┐     │
│  │  the agent writes the change in a worktree; READS THE SOURCE  │     │
│  │  of every system it must drive (the fence's SPEC format, the  │     │
│  │  API's shape) BEFORE attempting to drive it                   │     │
│  │  ► GATE G-RT: no progress claim without a runtime artifact    │     │
│  │    from THIS session (a fence exit code, an API read-back)    │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 3. COMMIT ───────────────────────────────────────────────────┐     │
│  │  git commit fires .githooks/pre-commit + prepare-commit-msg:  │     │
│  │    W-6  source-string (no fake-wiring asserts)                │     │
│  │    W-8  claim-evidence (a claim word needs an artifact)       │     │
│  │    W-9  doc-density (a .md >= 100 lines + >= 3 anchors)       │     │
│  │    W-13 silent-fallback (a catch must log or rethrow)         │     │
│  │    W-14 no-stub (a stub shipped as done)                      │     │
│  │  ► GATE G-RATIO (NEW): doc commits must not outpace code      │     │
│  │    commits on the branch (docs <= code)                       │     │
│  │  ► GATE G-SEAL (NEW): no Checkpoints/ commit before the       │     │
│  │    ledger holds a PASS row (no snapshots of a dead system)    │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 4. PUSH ─────────────────────────────────────────────────────┐     │
│  │  git push fires .githooks/pre-push:                           │     │
│  │    W-2  orphan (every src module has a non-test caller)       │     │
│  │    W-3  phantom-diff (a claimed file must exist)              │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 5. CI (GitHub Actions) ──────────────────────────────────────┐     │
│  │  6 jobs fire on the PR:                                      │     │
│  │    gates/anti-theatrical · gates/issue-link · gates/spec-gate │     │
│  │    gates/diff-budget · gates/test · gates/theatrical-verification│  │
│  │  ► GATE G-SCAN (NEW): the ocr code review runs as a BOUNDED   │     │
│  │    batch (once per PR, not a fix→scan→fix loop); its real     │     │
│  │    findings are fixed, then the session RETURNS TO THE        │     │
│  │    RUNTIME — the scanner is a gate, never the work source     │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 6. THE FENCE ─────────────────────────────────────────────────┐    │
│  │  fence2.py adjudicates the worktree:                          │     │
│  │    SPEC.md (v2) → init → invariant-sha → adjudicate            │     │
│  │    the done-when runs SANDBOXED; PASS = exit 0                │     │
│  │    the ledger row: {verdict:'PASS', spec_bound:true}          │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 7. THE PUBLISHER ────────────────────────────────────────────┐    │
│  │  the kernel's tick (runtime.ts) verifies + publishes:         │     │
│  │    verify() → fence GREEN + review APPROVED (the same sha)    │     │
│  │    POST /statuses/{sha} factory/fence2  = success             │     │
│  │    POST /statuses/{sha} factory/verdict = success             │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 8. THE RULESET (23838059) ───────────────────────────────────┐    │
│  │  8 required checks + 1 approval + non-fast-forward            │     │
│  │  all 8 success → the merge button UNLOCKS                     │     │
│  └──────────────────────────┬────────────────────────────────────┘     │
│                             ▼                                          │
│  ┌─ 9. THE MERGE ─────────────────────────────────────────────────┐   │
│  │  PUT /pulls/{n}/merge → 200                                     │   │
│  │  THE RUNTIME EVENT. THE GOAL'S TERMINAL.                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## THE WIRING PLAN — ONE GATE AT A TIME (each wires in minutes)

**The order is enforcement-value-first: each gate starts enforcing the moment it lands,
and each is INDEPENDENT — no gate depends on another being present.**

### GATE 1: G-GREEN — the DONE-clause law (ZERO code, wires NOW)

```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT IT ENFORCES: a goal's DONE must name a RUNTIME EVENT, never a    │
│   quality count. 'ocr gate 0 critical' permits infinite chasing;      │
│   'PUT /merge returns 200' terminates.                                │
│ WHERE IT WIRES: the goal pin's ## STOP clause (the text itself)       │
│ HOW TO WIRE: write the DONE clause as a command whose exit code IS    │
│   the verdict: 'curl -X PUT .../merge → 200'. The pin ALREADY has it. │
│ ENFORCEMENT: the operator reads the pin before starting; a pin whose  │
│   DONE is a count is REJECTED on sight.                              │
│ COST: zero. It is already written in                                 │
│   packages/github-master-kernel/GOAL_PIN_RUNTIME_OPERATIONAL.md       │
└──────────────────────────────────────────────────────────────────────┘
```

### GATE 2: G-RT — the runtime-artifact pre-flight (a script, wires in
  5 min)

```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT IT ENFORCES: no session claims progress without a runtime       │
│   artifact from THIS session. The artifact: a fence exit code, an    │
│   API read-back, a tick's errors[] — never a source-level pass.      │
│ WHERE IT WIRES: a pre-flight script the agent runs at session start  │
│   + a claim-time check (the pin's L1 law)                           │
│ HOW TO WIRE:                                                        │
│   #!/usr/bin/env bash                                                │
│   # gates/rt-preflight.sh — the runtime-artifact pre-flight          │
│   FENCE=$HOME/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py
│   FIXTURE=/tmp/fence-green/job                                       │
│   curl -sf localhost:3001/healthz >/dev/null || { echo 'RT-PREFLIGHT:
│ AO daemon DOWN'; exit 1; }
│   systemctl --user is-active jarvis-upper >/dev/null || { echo
│ 'RT-PREFLIGHT: kernel DOWN'; exit 1; }
│   python3 $FENCE adjudicate $FIXTURE --expect-spec-sha \             │
│     $(python3 $FENCE invariant-sha $FIXTURE) >/dev/null 2>&1 \      │
│     || { echo 'RT-PREFLIGHT: the fence cannot go green'; exit 1; }   │
│   echo 'RT-PREFLIGHT: PASS (the runtime is reachable + greenable)'   │
│ ENFORCEMENT: exit 1 blocks the session's START (the pin's PREFLIGHT) │
└──────────────────────────────────────────────────────────────────────┘
```

### GATE 3: G-RATIO — the doc-ratio pre-commit hook (wires in 5 min)

```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT IT ENFORCES: doc commits must not outpace code commits on the   │
│   branch. Measured: 35 docs vs 45 fix — the doc mass was 44%.        │
│ WHERE IT WIRES: .githooks/pre-commit (after W-14)                    │
│ HOW TO WIRE (append to .githooks/pre-commit):                       │
│   # G-RATIO doc-ratio: docs must not outpace code on the branch      │
│   BASE=$(git merge-base origin/main HEAD 2>/dev/null || echo HEAD~50)│
│   DOCS=$(git log --format=%s "$BASE..HEAD" | grep -c '^docs' || true)│
│   CODE=$(git log --format=%s "$BASE..HEAD" | grep -cE
│ '^(fix|feat|refactor|test)' || true)│
│   if [ "$DOCS" -gt "$CODE" ]; then                                   │
│     echo "REJECT(G-RATIO): doc commits ($DOCS) outpace code ($CODE) —
│ the doc mass is not the work" >&2
│     FAIL=1                                                            │
│   fi                                                                  │
│ ENFORCEMENT: exit 1 blocks the doc commit itself (mechanical)        │
└──────────────────────────────────────────────────────────────────────┘
```

### GATE 4: G-SEAL — the no-checkpoint-before-green hook (wires in 5 min)

```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT IT ENFORCES: no Checkpoints/ commit until the fence ledger      │
│   holds a PASS row from THIS branch's worktree. 10 checkpoints were  │
│   sealed of a system that could not merge.                           │
│ WHERE IT WIRES: .githooks/pre-commit (after G-RATIO)                 │
│ HOW TO WIRE (append):                                                │
│   # G-SEAL no-checkpoint-before-green: a snapshot of a dead system   │
│   case "$STAGED" in *Checkpoints/*)                                   │
│     LEDGER=$HOME/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/verd
│ icts.jsonl
│     if ! grep -q '"verdict":"PASS"' "$LEDGER" 2>/dev/null; then       │
│       echo 'REJECT(G-SEAL): no fence PASS row in the ledger — a
│ checkpoint now is a snapshot of a dead system' >&2
│       FAIL=1                                                          │
│     fi ;; esac                                                        │
│ ENFORCEMENT: exit 1 blocks the checkpoint commit (mechanical)        │
└──────────────────────────────────────────────────────────────────────┘
```

### GATE 5: G-SCAN — the bounded-scan law (a pin law + a counter)

```
┌──────────────────────────────────────────────────────────────────────┐
│ WHAT IT ENFORCES: the ocr code review (MANDATORY — the operator's    │
│   law, never blamed) runs as a BOUNDED batch: once per PR, its real  │
│   findings fixed, then the session RETURNS TO THE RUNTIME. The       │
│   scanner is the QUALITY gate; the green merge is the GOAL.          │
│ WHERE IT WIRES: the goal pin's L2 clause (rewritten — see below)     │
│   + the CI's gates/spec-gate job (where the review already runs)     │
│ HOW TO WIRE: the pin's L2 becomes:                                   │
│   'THE SCAN IS A GATE, NOT A WORK SOURCE. Run it, fix every real     │
│    finding it names, then RETURN TO THE RUNTIME. A second scan       │
│    round on the same tree without a runtime event between the        │
│    rounds is the misallocation — the findings were real, the         │
│    ORDERING was wrong. The scanner's findings are prerequisites      │
│    to the green merge, never a substitute for it.'                   │
│ ENFORCEMENT: the pin's anti-derail table names the pattern           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## THE WIRING ORDER (why this order)

**The wiring points (real anchors):** `.githooks/pre-commit:190` is where G-RATIO and
G-SEAL append (after W-14, before the final FAIL check) · `.githooks/pre-push:151` is
the W-2 chain they join · `gates/fence-check.py:29` is the CI fence · `src/publish.ts:38`
is the POST · `gates/fence-check.py:29` is the CI's fence step ·
`src/runtime.ts:276` is the publish call the whole chain serves · `src/main.ts:17`
is the wired entry point.
<!-- anchors: .githooks/pre-commit:190 (where G-RATIO/G-SEAL append)
     .githooks/pre-push:1 (the W-2/W-3 chain) · gates/fence-check.py:1 (the CI fence)
     src/main.ts:17 (the wired publisher) · src/runtime.ts:276 (the publish call) -->

| # | the gate | the cost | the enforcement it adds IMMEDIATELY |
|---|---|---|---|
| 1 | G-GREEN | zero (already written) | every future goal terminates at a runtime event |
| 2 | G-RT | a 10-line script | the session cannot start with a dead runtime |
| 3 | G-RATIO | 8 lines in pre-commit | the doc mass is mechanically capped |
| 4 | G-SEAL | 6 lines in pre-commit | snapshots of dead systems are blocked |
| 5 | G-SCAN | the pin's L2 rewrite | the scan is bounded; the runtime is the work |

**Each gate is independent — land them in ANY order and each starts enforcing the moment
it lands. None depends on the master gate system being complete. Together they close the
four waste mechanisms: the quality-bar DONE (G-GREEN), the inverted feedback loop (G-RT),
the doc amplification (G-RATIO), and the dead-snapshot amplification (G-SEAL).**

---

## THE CORRECTED L2 (the scanner-blame retraction)

**THE PRIOR L2 WAS WRONG.** It said the scanner 'generates infinite findings' — a lie.
The findings were REAL: every round named real defects (null guards, fail-open guards,
cross-domain shas, dead gates), and every one was fixed. The scanner is MANDATORY and it
was RIGHT. The error was the ORDERING: treating the quality bar as the terminal activity
instead of a prerequisite. The corrected law:

```
┌──────────────────────────────────────────────────────────────────────┐
│ L2 (CORRECTED) — THE SCAN IS A GATE, NEVER THE WORK SOURCE           │
│                                                                      │
│ The qwen code review is MANDATORY (the operator's law). Its          │
│ findings are real prerequisites — fix every one it names. The        │
│ misallocation is ORDERING: a second scan round on the same tree      │
│ without a runtime event between the rounds. The findings were        │
│ real; the ordering was wrong. The scanner polices the code; the      │
│ runtime IS the build.                                                │
└──────────────────────────────────────────────────────────────────────┘
```
