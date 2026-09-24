/goal JARVIS-UPPER KERNEL — FULL RUNTIME OPERATIONAL: THE GREEN MERGE

## MISSION
Drive ONE REAL CHANGE end-to-end through the ENTIRE git master kernel in a LIVE runtime
environment: an AO session produces a change → the change lands as a real PR on a real
branch → the kernel's fence adjudicates it GREEN → the verdict posts SUCCESS to GitHub →
the 8 required checks all pass → the merge button UNLOCKS → the PR MERGES.

DONE only when a real PR is MERGED through the kernel's own gates, with the merge commit's
SHA recorded in the ledger. UNIT TESTS ARE SLOP — they are never evidence. The runtime
IS the test.

## THE NON-NEGOTIABLE DEFINITION OF DONE (each clause, mechanically verified)
1. A real git worktree exists at a real branch, its HEAD == a claimed 40-char sha
2. A real SPEC.md exists in that worktree in the fence's v2 format (see THE RECIPE below)
3. `fence2.py adjudicate <jobDir> --expect-spec-sha <inv>` returns **PASS** (exit 0) —
   the ledger holds a PASS row with `spec_bound:true` for that exact sha
4. The kernel's `verify()` returns **VERIFIED** — BOTH sources green on the SAME head
5. `publishStatus` POSTs `factory/fence2 = success` and `factory/verdict = success`
   to the REAL GitHub API (HTTP 201), verified by an independent API read-back
6. All 8 required status checks report success on the PR's head sha
7. `PUT /pulls/{n}/merge` returns **200** — the PR MERGES
8. The merge commit's SHA is recorded in the runtime ledger

## THE RECIPE (discovered 2026-09-24 — the knowledge gap that killed 4 sessions)

THE FENCE'S SPEC.md v2 FORMAT (the exact shape fence2.py parses):
```
job: <job-name>
seat: <seat-name>
steps:
  - id: step-0
    artifact: <ABSOLUTE path to a file INSIDE the job dir>
    done-when:
      - <a shell command that exits 0 when the artifact is correct>
```

THE FENCE COMMANDS (in order):
```
# 1. stamp the artifact's sha16 into the spec's sha16: block
python3 $FENCE2_BIN init <jobDir>

# 2. compute the invariant (the bind)
INV=$(python3 $FENCE2_BIN invariant-sha <jobDir>)

# 3. adjudicate — GREEN when the done-when passes AND the sha matches
python3 $FENCE2_BIN adjudicate <jobDir> --expect-spec-sha $INV
# → step-0 PASS  (exit 0)
```

THE FENCE'S CONTRACT (read from fence2.py — never guess):
- `artifact:` must be an ABSOLUTE path under the job dir (relative = INVALID_SPEC)
- `done-when:` must be non-empty (empty = INVALID_SPEC:done-when_empty)
- the artifact's sha16 must be in the spec's `sha16:` block (init does this)
- the spec is bound by its invariant sha (any edit after adjudicate = SPEC_FORGED)
- the done-when runs SANDBOXED (bwrap) — it must not need network or X
- the ledger is APPEND-ONLY at $FENCE2_LEDGER (default: JARVIS-CORE/b6/verdicts.jsonl)
- a v1 spec (no steps:, just artifact: + a ```done-when block) also works — but the
  artifact must STILL be absolute and the sha16 must still be stamped by init

THE KERNEL'S PUBLISH PATH (src/main.ts is NOW wired — do not re-wire):
- the daemon reads env: UPPER_OWNER / UPPER_REPO / GH_TOKEN / UPPER_WORKTREE_ROOT
- jobDirFor(prId) = `${WORKTREE_ROOT}/${session}` — the AO worktree for that session
- the publisher fires ONLY for eligible PRs (state=ready_to_merge + 4 gates green)
- to make a PR eligible: `recordGatePass(db, prId, headSha, states)` with all 8 green
- the worktree at jobDir must have HEAD == the PR's head_sha (the bind check)

## THE HARD LAWS (each one paid for with a dead session)

### L1 — THE RUNTIME IS THE ONLY TEST
`bun test`, `tsc`, the ocr scan, the source-import corpus: ALL SLOP. They never touch
the running system. A claim without a runtime artifact (a real API read-back, a real
fence exit code, a real HTTP status) is VOID. Never report a source-level pass as a
system-level fact. The unit battery may run as a regression guard AFTER the green
merge — never as the evidence FOR it.

### L2 — THE SCANNER TREADMILL IS BANNED
`ocr scan` and `muse exec`-review loops are FORBIDDEN as work drivers. An LLM reviewer
generates infinite findings; the count NEVER reaches zero; the loop never terminates.
The scanner may run ONCE as a gate at the END, never as the work itself. If you catch
yourself in a fix→scan→fix→scan cycle: STOP. That is the treadmill. Go drive the runtime.
Measured cost: 6 rounds, ~4 hours, ZERO runtime value.

### L3 — THE DOC TREADMILL IS BANNED
Doc updates are proportional to RUNTIME MILESTONES, not to fixes. One doc commit per
merged PR, maximum. A doc commit with no runtime event behind it is slop. If doc commits
outpace code commits: STOP. You are documenting a system that does not work.
Measured cost: 27 of 77 commits were docs — for a system that never drove a green.

### L4 — READ THE SOURCE BEFORE DRIVING THE SYSTEM
The fence's SPEC format was never read in 4 sessions. The knowledge gap was closed in
10 minutes of reading fence2.py. When a system does not go green: READ ITS SOURCE. Never
guess, never try random inputs, never "try one more thing" — READ THE PARSER. The error
names the gap: INVALID_SPEC:artifact-not-absolute → read the parser → absolute paths.
INVALID_SPEC:done-when_empty → read the parser → a done-when block. Each refusal names
its own fix.

### L5 — THE GREEN IS THE ONLY PROOF
A red/error/failure POST is NOT a green. "The publisher is wired" is NOT a green.
"The gate fails closed" is NOT a green. The ONLY proof is `factory/fence2 = success`
on a REAL sha, read back from the REAL API, followed by a 200 merge. A 405 merge
rejection proves the gate blocks — it does not prove the system works.

### L6 — GIT RAILS: EVERYTHING TRACKED
Every file that matters is committed. No untracked source, no uncommitted fixes, no
"the change is on disk but not in git". The branch is pushed. If it cannot be pushed,
the push blocker is named and fixed (it is a gate bug, not a reason to stop). Generated
snapshots (Checkpoints/, .trident/) stay gitignored — the SOURCE, the TESTS, the HOOKS,
the WORKFLOWS, the SPEC, the RECIPE are tracked.

### L7 — NEVER SEAL A CHECKPOINT OF A DEAD SYSTEM
A checkpoint of a system that has never driven a green is a snapshot of failure.
Checkpoints are sealed AFTER the first green merge, never before. 10 checkpoints were
sealed across the dead sessions — every one a snapshot of a system that could not merge.

### L8 — THE AO DAEMON IS THE DEPENDENCY
`/usr/lib/agent-orchestrator/resources/daemon/ao daemon` on :3001. It is INSTALLED
(agent-orchestrator 0.13.0). If it is not running: START IT (hub start, or the systemd
unit ao-daemon.service). The kernel is DEAD without it — daemonOk=false, prNodes=0,
nothing publishes. `ao doctor` verifies. Never "work around" a stopped daemon — start it.
It was stopped for the entire first 3 sessions and nobody started it.

### L9 — NEVER REPORT A BLOCKED STATE AS PROGRESS
"The fence returns exit 1 because no worktree is bound" is a BLOCK, not a finding. The
block's remedy is THE WORK: build the worktree, write the SPEC, drive the green. Never
name a block and move on to something else (the scanner, the docs) — the block IS the task.

## THE EXECUTION ORDER (dependency-driven, no skipping)

### PHASE 1 — THE GREEN WORKTREE (the fence's needs)
1. Create a real git worktree on a real branch (a branch of the jarvis-upper repo)
2. Make a real change (a file, a fix, an artifact — something real)
3. Write SPEC.md in the v2 format, `init`, `invariant-sha`, `adjudicate`
4. **PROVE: `fence2.py adjudicate` returns PASS (exit 0) — the ledger row is green**
   The exit code is the evidence. Paste it.

### PHASE 2 — THE KERNEL SEES IT
5. Ensure the AO daemon is running (:3001 → 200)
6. Ensure the kernel daemon is running with the publisher ARMED (GH_TOKEN set)
7. Insert the PR row + the 4 green gates (`recordGatePass`) at the worktree's HEAD sha
8. **PROVE: the live kernel's tick publishes `factory/fence2 = success` (a real 201)**
   The API read-back is the evidence. Paste the contexts.

### PHASE 3 — THE MERGE
9. The CI's 6 gates pass on the PR (they already do — the branch is green)
10. The 2 factory contexts are SUCCESS (phase 2's output)
11. The approval requirement is met (the operator approves, or the ruleset is confirmed)
12. **PROVE: `PUT /pulls/{n}/merge` returns 200 — THE PR MERGES**
    The 200 is the evidence. The merge SHA goes in the ledger.

### PHASE 4 — THE RECORD
13. The merge commit's SHA in the runtime ledger
14. One doc commit recording the green merge (the FIRST doc commit that matters)
15. The goal is DONE

## THE ANTI-DERAIL PATTERNS (recognize; do not re-live)
- "The ocr gate returned N findings" → L2. THE TREADMILL. Drive the runtime.
- "Let me run one more scan to confirm" → L2. THE TREADMILL. Drive the runtime.
- "The tests pass (124/124)" → L1. SLOP. What does the RUNTIME say?
- "The gate fails closed (405)" → L5. That is NOT a green. Drive to 200.
- "The system is 90% working" → L5. There is no 90%. There is a green merge or not.
- "Let me update the canon docs" → L3. One doc commit per merged PR. Maximum.
- "Let me seal a checkpoint" → L7. Not before the first green merge.
- "The daemon is down" → L8. START IT. It is installed.
- "I cannot figure out the format" → L4. READ THE SOURCE. The recipe is above.
- "The fence returns exit 1" → L9. THE BLOCK IS THE TASK. Build the green.
- ANY scan/review loop > 1 round → L2. THE TREADMILL. STOP.
- "Let me write an engineering report" → L3. Not before the green merge.
- "The publisher is ARMED" → L5. Armed is not green. POST a success.

## THE ENVIRONMENT (measured 2026-09-24)
<!-- anchors: src/main.ts:17 (the wired publisher) · src/runtime.ts:58 (the rail)
     src/guardrail.ts:18 (the gate) · src/verdict.ts:148 (the two-source law)
     src/publish.ts:38 (the POST) · .githooks/pre-push:151 (the W-2 fix) -->
- repo: /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-FACTORY/jarvis-upper
- branch: feat/github-master-kernel (pushed, CI 6/6 green)
- remote: https://github.com/leviathan-devops/jarvis-upper.git
- ruleset: 23838059 (active, 8 required checks, 1 approval, non-fast-forward)
- AO daemon: /usr/lib/agent-orchestrator/resources/daemon/ao daemon (:3001)
- fence2: /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py
- ledger: /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl
- the kernel service: systemctl --user jarvis-upper.service (active, publisher ARMED)
- the token: ~/.config/jarvis-upper.env (GH_TOKEN, 0600, out-of-band — never the repo)
- the kernel's store: store.sqlite (pr_node, gate_pass, rail_seq — 9 PRs live)
- the AO worktrees: ~/.ao/data/worktrees/jarvis-upper/<session>/
- THE PROVEN-GREEN FIXTURE: /tmp/fence-green/job (the SPEC.md that passed — copy it)

## PREFLIGHT (run these FIRST; each names its own remedy)
```
curl -sf http://localhost:3001/healthz || echo "AO DAEMON DOWN — START IT (L8)"
systemctl --user is-active jarvis-upper.service || echo "KERNEL DOWN — RESTART IT"
grep -c 'publishOpts' src/main.ts || echo "THE PUBLISHER IS UNWIRED — L6"
python3 /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py \
  adjudicate /tmp/fence-green/job --expect-spec-sha \
  $(python3 /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py \
  invariant-sha /tmp/fence-green/job) # → must print step-0 PASS
```

## STOP
The run stops ONLY when the merge commit's SHA is in the ledger AND the API read-back
shows `factory/fence2 = success` on the merged PR's head. ANYTHING LESS IS OPEN.
A BLOCKED state is never a stop: it names its resume condition. The resume condition
is always THE GREEN — build the worktree, drive the fence, post the success, merge.
