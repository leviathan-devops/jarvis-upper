# DECISION CHAIN — jarvis-upper (W4)

The operator's **full verbatim ruling set** + the **rejected alternatives** with
the reason each was killed AND its consequence. If a task conflicts with a ruling
here, STOP and escalate. SHAs referenced are quoted verbatim.

---

## 1. THE FULL VERBATIM RULING SET (all 10)

| Ruling ID | Verbatim text | Category | Binding effect |
|-----------|---------------|----------|----------------|
| D-001 | "I NEVER WANT TO SEE ANOTHER BULLSHIT SLOP REPORT AGAIN." | report discipline | All reports must be dense, evidence-grounded, no filler (density floor ≥200 lines for canon docs). |
| D-002 | "Never once asked does anything run? — THIS IS THE ONLY THING THAT MATTERS." | verification priority | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` is mandatory on every claim. |
| D-003 | "this is all theatrical bullshit. explicitly forbid this as a verification gate. this is NOT tangible verification evidence." (about commit-exists / diff-changed / tests-pass / PR-open) | forbidden evidence | Citing commit-exists, diff-changed, tests-pass, or PR-open as verification is EXPLICITLY FORBIDDEN. |
| D-004 | "THIS IS THE ONLY ACCEPTED VERIFICATION EVIDENCE. BOTH OF THESE. IF BOTH OF THESE DO NOT UNCONDITIONALLY PASS = REJECT. BOOLEAN FALSE." (about fence2 + AO review) | two-source law | VERIFIED iff fence2 adjudicate exit 0 AND AO review approves the SAME head sha. One alone = Boolean FALSE = REJECT. |
| D-005 | "review harness should be muse code, auto review should be true. fix this as default settings." | AO review config | AO review defaults: `autoReview: true`, `reviewers: [{"harness":"muse"}]`. |
| D-006 | "test needs to enforce by default." | battery discipline | `bun test` must pass on every commit (`52 pass / 0 fail / 183 expects / 16 files`). Gates enforce this. |
| D-007 | "worker profile needs the direct poolside api wired as the default model + the task agent's pinned default" | worker profile | `jarvis-worker` profile: `default`/`task` = `poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT, not OpenRouter). |
| D-008 | "the default model for the jarvis workers needs to be set to muse spark 1.3 contributor on opencode go. NOT conflicting with my main omp having deepseek pinned." | worker vs main | `sonic`/`reviewer`/`plan`/`slow` = `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh`; `smol`/`scout` = `openrouter/nvidia/nemotron-3.5-lightning:free`. The GLOBAL `~/.omp/agent/config.yml` keeps `default: verboo/deepseek-v4.1-flash:max` (operator's main omp, deliberately NOT a worker). |
| D-009 | "AO should have built in gates for this already." | AO expectation | AO was expected to enforce gates natively; in practice the gates live in `gates/` + JFM. The expectation stands: do not ship without gates green. |
| D-010 | "test needs to enforce by default." (re-stated as emphasis on G5/G6/G7) | battery discipline | `bun test -t two_source_verdict` → `8 pass / 0 fail`; `bun test -t jfm_verbs` → `8 pass / 0 fail` must hold on every commit. |

> Note: D-006 and D-010 are the same ruling restated (test enforcement). Both are
> binding; both appear verbatim for completeness.

## 2. THE DECISION FLOW (how a ruling was reached)

```
Operator observes claim of completion
        ↓
D-003 fires: commit/diffs/tests/PR as proof → REJECT (theatrical)
        ↓
D-004 fires: two-source required → D-002 does_anything_run + fence2 + AO review
        ↓
D-005 fires: review harness must be muse (AO rejects omp)
        ↓
D-006/D-010 fires: battery enforces by default (bun test)
        ↓
D-007 fires: worker pin = poolside direct
        ↓
D-008 fires: worker muse-spark on zen-free; main omp = deepseek
        ↓
VERIFIED only if fence2 exit 0 AND AO review approves same sha
```

## 3. REJECTED ALTERNATIVES — WITH REASON + CONSEQUENCE

| # | What was rejected | Reason killed | Consequence if it had shipped | Verdict law |
|---|-------------------|---------------|-------------------------------|-------------|
| A-001 | Citing commit-exists as verification | D-003: "theatrical bullshit. explicitly forbid this as a verification gate. this is NOT tangible verification evidence." | False completion claims; a commit can exist with zero running code | D-003 |
| A-002 | Citing diff-changed as verification | D-003: same forbiddance | Lines changed ≠ code runs; theater | D-003 |
| A-003 | Citing tests-pass as verification | D-003: "this is NOT tangible verification evidence." | Green fixtures on a non-running system | D-003 |
| A-004 | Citing PR-open as verification | D-003: forbidden | A PR can be open against a broken build | D-003 |
| A-005 | Single-source verdict (fence2 only) | D-004: "BOTH OF THESE ... = REJECT. BOOLEAN FALSE." | Unreviewed mechanical pass = theater | D-004 |
| A-006 | Single-source verdict (review only) | D-004: "BOTH OF THESE ... = REJECT. BOOLEAN FALSE." | Non-hermetic human review = theater | D-004 |
| A-007 | AO `omp` as a reviewer harness | AO returns `INVALID_PROJECT_CONFIG: unknown harness "omp"` | Broken AO config; no review runs | D-005 |
| A-008 | Desk-local model pin | EN-019 proved it invisible to AO spawns; AO spawn carries `OMP_PROFILE=jarvis-worker`, does not read desk config | Workers run the wrong model silently | D-008 |
| A-009 | Forking the JAM desk core into JFM | Would fork `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` (1080L) | Drift; two trackers out of sync | import law |
| A-010 | Auto-merge path | D-004 forbids non-two-source completion | Merge without both gates = theater | D-004 |
| A-011 | A second tracker (besides JAM tracker in `jfm/src/desk.ts`) | Operator: "one tracker law" — explicitly rejected | Conflicting state; operators can't trust either tracker | (operator) |
| A-012 | Recording the burned PAT material in a doc | Forbidden credential material; D-008 / A-011 | Credential leak | D-008 / A-011 |
| A-013 | A non-hermetic fence2 (network inside sandbox) | fence2 runs under `bwrap --unshare-all` (no network) BY DESIGN — reverting breaks the two-source law's hermetic half | Non-reproducible verdicts; network flakes | D-004 |
| A-014 | Global omp deepseek used as worker default | D-008: workers must NOT use the operator's main omp; that is for interactive coding, not factory workers | Workers burn operator quota / wrong tier | D-008 |

## 4. BINDING LAWS DERIVED FROM RULINGS

| Law | Source ruling | Statement |
|-----|---------------|-----------|
| L1 two-source verdict | D-004 | VERIFIED iff fence2 adjudicate exit 0 AND AO review approves the same head sha `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b`. |
| L2 does-anything-run | D-002 | `bash gates/does_anything_run.sh .` → `VERDICT:RUNS (fail=0)` on every claim. |
| L3 no forbidden evidence | D-003 | commit-exists / diff-changed / tests-pass / PR-open are NOT verification. |
| L4 review harness = muse | D-005 | AO reviewers = `[{"harness":"muse"}]`, autoReview = true. AO rejects `omp`. |
| L5 battery by default | D-006, D-010 | `bun test` must stay green (`52 pass / 0 fail / 183 expects / 16 files`); `two_source_verdict` → 8 pass; `jfm_verbs` → 8 pass. |
| L6 worker profile pin | D-007, D-008 | `jarvis-worker` is the only spawn profile; default/task = `poolside/poolside/laguna-s-2.1:high`; sonic..slow = `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh`; smol/scout = `openrouter/nvidia/nemotron-3.5-lightning:free`. |
| L7 import-don't-fork | (operator) | JAM desk core (`desk-orchestrator.ts` 1080L) + fence2 (`fence2.py` 966L) are IMPORTED, never forked. |
| L8 one-pin law | D-008 | AO spawns carry `OMP_PROFILE=jarvis-worker` (env on projects jarvis-upper, jarvis_orchestrator, scratch, jfm-e2e). |
| L9 PAT law | (operator) | Never record credentials; rotate burned PATs (EN-020). |
| L10 fence sandbox law | (design) | fence2 runs under `bwrap --unshare-all` (no network); DB_1 hermetic step runs offline. |
| L11 one-tracker law | (operator) | One JAM tracker (`jfm/src/desk.ts`); rejected A-011. |

## 5. THE FROZEN DECISION ARTIFACTS

| Artifact | Path | Lines (measured) | Used by ruling |
|----------|------|-------------------|----------------|
| `src/verdict.ts` | `jarvis-upper/src/verdict.ts` | 184 | D-004 (two-source law impl) |
| `gates/does_anything_run.sh` | `jarvis-upper/gates/does_anything_run.sh` | 49 | D-002 |
| `gates/shape_freeze.sh` | `jarvis-upper/gates/shape_freeze.sh` | 50 | D-002 (shape) |
| `gates/orphan_scan.sh` | `jarvis-upper/gates/orphan_scan.sh` | 35 | D-002 (orphan) |
| `src/runtime.ts` | `jarvis-upper/src/runtime.ts` | 150 | D-002 (does anything run) |
| `src/status.ts` | `jarvis-upper/src/status.ts` | 48 | D-002 |
| `src/main.ts` | `jarvis-upper/src/main.ts` | 19 | entry |
| `ao-client/client.ts` | `jarvis-upper/ao-client/client.ts` | 75 | AO transport |
| `ao-client/rail.ts` | `jarvis-upper/ao-client/rail.ts` | 113 | AO API rail |
| `ao-client/gen/routes.ts` | `jarvis-upper/ao-client/gen/routes.ts` | 173 | AO route surface |
| Worker profile | `~/.omp/profiles/jarvis-worker/agent/config.yml` | — | D-007, D-008 |
| Global omp config | `~/.omp/agent/config.yml` | — | D-008 |
| AO review config | `jarvis-upper/.omp/config.yml` | — | D-005 |
| fence2 | `Shared_Workspace/JARVIS-CORE/b6/fence2.py` | 966 | D-004 (hermetic half) |
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` | 1080 | L7 (import law) |
| Blueprint | `reports/JFM_Blueprint_v1.md` | 395 | reference |
| verdicts.jsonl | `Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl` | append-only | D-004 |
| two_source_verdict test | `tests/two_source_verdict.test.ts` | 111 | D-004 / D-010 |
| jfm_verbs test | `jfm/tests/jfm_verbs.test.ts` | (JFM repo) | D-006 |

## 6. HOW A NEW TASK MUST CHECK OUT

Before starting any task, the agent MUST:

1. Read this doc (§1–§4) — the rulings and rejected alternatives.
2. Read EVIDENCE_STATE.md — reproduce the tokens.
3. Read TASK_QUEUE.md — see what is PASS / OPEN / BLOCKED.
4. Read COMPACTION_SURVIVAL.md — the resume recipe.
5. Confirm it is not re-attempting A-001..A-014.

If a task would re-attempt a rejected alternative, the agent MUST STOP and
escalate to the operator. The rulings are non-negotiable.

## 7. THE PAT INCIDENT (recorded, no material)

A PAT was burned this session (W3) because it was embedded in a git remote URL
and printed. The operator MUST rotate it. This doc (and all canon docs) MUST NOT
record the credential material. The fix is operator action (rotation, EN-020).
The doc set has already grep-verified empty for credential material.

## 8. THE FROZEN SHA TABLE (quote verbatim)

| Name | SHA | Context |
|------|-----|---------|
| PR #1 commit 1 | `760ad1b` | `ao/jarvis-upper-2/root` (W1) |
| PR #1 commit 2 | `732083e` | `ao/jarvis-upper-2/root` (W2) |
| PR #1 commit 3 | `adbdacf` | `ao/jarvis-upper-2/root` (W3) |
| PR #1 head (current, W4) | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | the two-source verdict key |
| jfm-e2e PR #1 commit | `cce7bdb` | merged proof |

End of DECISION_CHAIN.
