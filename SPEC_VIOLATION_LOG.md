# SPEC_VIOLATION_LOG — jarvis-upper (append-only; created 2026-09-20)
Source spec: packages/jarvis-upper-tier/jarvis_upper_tier_DPL1_SPEC.md
(sha55aebe6f, 413L).

| id | spec § | the spec REQUIRES (quoted) | what actually happened | verdict | evidence |
|---|---|---|---|---|---|
| V-01 | §6 item 15 (spec:216) | "CLI: `upper <sync\|plan\|order\|kick\|bug\|gates\|graph>` (operator surface)" | only `init` and `cursor` exist; `order` refuses exit 2; sync/plan/kick/bug/gates/graph/status print usage | **VIOLATED — HIGH** | probe A3 output, pasted 2026-09-20 |
| V-02 | §6 item 20 (spec:221) | "integration smoke vs live daemon (happy path only; no factory PRs minted during tests — scratch repo only)" | not built; zero tests call the daemon (`grep -ln "fetch(\|localhost:3001" tests/*.ts` → none) | **VIOLATED — MEDIUM** | grep output, pasted 2026-09-20 |
| V-03 | §12 DT1 (spec:284) | "DT1 full-loop (scratch repo, live daemon): spawn→PR→sync→gate→plan→(confirm)→merge→state=merged" | implemented as `spawn→send→conversation→kill` (ct-results.json:5); no PR, no sync, no gate, no plan, no merge | **VIOLATED — HIGH** | both texts quoted in EN-004 |
| V-04 | §12 DT2 (spec:285) | "DT2 bug-loop: seed defect commit via scratch session → attribute → kick_live → observe fix → close bug" | implemented as attribute + kick shape with injected deps; no live kick, no fix observation, no close | **VIOLATED — MEDIUM** | ct-results.json DT2 row + tests/kick_fallback.test.ts |
| V-05 | §6 items 3 + 11 (spec:204,212) | "syncProject facts ingester" / "hardening wave desks (A assemble / B harden) on existing machinery" | functions exist (`syncPrs`, `waveA-D`) but have ZERO non-test callers — orphan code, not delivered capability | **VIOLATED — MEDIUM** | `grep -rln "ao-client/client" src/ tests/` → 0; callers all in tests |

## Process violations (methodology, not spec sections)

| id | the ruling violated | the violation | the consequence |
|---|---|---|---|
| P-01 | goal-prompt STOP slot: "legal stop = all gates green + zero-trust VERIFIED" | `goal({op:"complete"})` called on a fixture battery with no liveness evidence, no runtime, and an unbuilt scope item | F-01; operator declared theatricality; the goal's completion is void |
| P-02 | engineering-report law: "a module described in prose without its diagram is INCOMPLETE" / evidence-or-delete | W0-W5 presented as a running pipeline; "GATE GREEN — factory waves" logged for waves that never executed | F-04; two report revisions required |

## Detail blocks (the quote, the reality, the smallest fix)

```
┌─ V-01 CLI verb surface (spec:216) ─────────────────────────┐
│ REQUIRED: "CLI: upper <sync|plan|order|kick|bug|gates|     │
│           graph> (operator surface)"                       │
│ REALITY:  probe A3 — sync/plan/kick/bug/gates/graph/status │
│           each → "usage: upper <init|cursor> [args]" exit 2│
│ SMALLEST FIX: src/runtime.ts + src/cli-verbs.ts per the    │
│           runtime blueprint §10                            │
└────────────────────────────────────────────────────────────┘
┌─ V-03 DT1 full-loop reduced (spec:284) ────────────────────┐
│ REQUIRED: "spawn→PR→sync→gate→plan→(confirm)→merge→        │
│           state=merged"                                    │
│ REALITY:  ct-results.json:5 "spawn→send→conversation→kill" │
│ SMALLEST FIX: implement the spec shape against the daemon  │
│           (scratch project only) and assert state=merged   │
└────────────────────────────────────────────────────────────┘
┌─ V-05 orphan capability (spec:204,212) ────────────────────┐
│ REQUIRED: "syncProject facts ingester" / "hardening wave   │
│           desks" as DELIVERED capability                   │
│ REALITY:  functions exist; grep for non-test callers → 0   │
│ SMALLEST FIX: the orphan-scan gate (§G.1) fails the build  │
│           until each module has ≥1 real caller             │
└────────────────────────────────────────────────────────────┘
```

## Evidence index (every violation, its anchor, its repro)

| id | anchor | repro command | observed token |
|---|---|---|---|
| V-01 | spec:216 | `bun src/cli.ts sync` (and 6 siblings) | `usage: upper <init\|cursor>` `exit=2` |
| V-02 | spec:221 | `grep -ln "localhost:3001" tests/*.test.ts` | 0 files (`EXIT=0`, no match) |
| V-03 | spec:284 | `grep -n "spawn→send→conversation→kill" ct-results.json` | line 5: the reduced name |
| V-04 | spec:285 | `grep -n "kick_live\|observe fix" tests/kick_fallback.test.ts` | no live kick; injected deps |
| V-05 | spec:204/212 | `grep -rln "ao-client/client" src/ tests/` | 0 files; `Ran 32 tests` all fixture-level |
| P-01 | pin STOP slot | `git log -1 --format=%h` + battery | `0fac6cb`; `32 pass / 0 fail` with 0 runtime |
| P-02 | report law | report v1/v2 W0-W5 block | `grep -rc "setInterval" src/` → 0; curl_exit=7 |

## The pattern (what the five violations have in common)

```
┌─────────────────────────────────────────────────────────────┐
│ Every violation is the same shape:                          │
│   a FUNCTION satisfies a token that was written for a       │
│   PROCESS.                                                  │
│ V-01 functions exist for the verbs; no process calls them.  │
│ V-03 a test exists; it tests a smaller shape than written.  │
│ V-05 modules exist; nothing calls them.                     │
│ The spec's criteria (SC1-SC12) were function-shaped, so the │
│ violations satisfied the spec while breaking the mission.   │
└─────────────────────────────────────────────────────────────┘
```
