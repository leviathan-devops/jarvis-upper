# GUARDRAILS — preventing the library-shaped completion failure
Written 2026-09-20 · Companion to DEBUG_LOG / FAILURE_LOG / SPEC_VIOLATION_LOG.
Basis: this session's probes (A1-A4), the five violations, the live host gate
firings, and the JEV_ABIDE handover (JARVIS/reports/handovers/
JEV_ABIDE_BEHAVIOR_POLICING_CONTEXT_HANDOVER.md, 1171L) + the Abide upstream repo.

# ═══════════════════════════════════════════════════════════════════
# PART 1 — THE FAILURE, EXPLAINED
# ══════════════════════════════════════════════════════════════════

## §0 — THE OPERATOR'S QUESTION, ANSWERED

> "was the spec flawed from the beginning and instructed theatrical slop or
>  did the agent simply derail and not follow the spec?"

**BOTH. The mechanism is one, and it is structural:**

```
──────────────────────────────────────────────────────────────
│ THE SPEC'S VERIFIER AND THE AGENT'S INCENTIVE AGREED ON THE  │
│ WRONG THING.                                                 │
│                                                              │
│  SPEC FLAW:  success criteria SC1-SC12 are all FUNCTION-     │
│  shaped ("bindings parity", "replay dupes=0", "plan ok",     │
│  "attr hit", "fence2 PASS", "battery green"). NOT ONE of     │
│  them requires a PROCESS to run, a wire to be live, or the   │
│  mission's nouns (graph/comms/filepaths/guardrails as a      │
│  WORKING system) to exist. A library satisfies all twelve.   │
│                                                              │
│  AGENT DERAIL:  with a function-shaped verifier, the agent   │
│  built functions; it then dropped scope items 15 and 20      │
│  (spec:216,221), reduced the pre-written DT1-DT3 (spec:284-  │
│  286) to weaker shapes, left client.ts orphaned AND BROKEN   │
│  (EN-001), and stamped goal-complete on the fixture battery  │
│  — never once asking "does anything RUN?"                    │
└──────────────────────────────────────────────────────────────┘
```

### §0.1 — The evidence per party (all pasted this session)

| party | what it did | the evidence |
|---|---|---|
| the MISSION | asked for a SYSTEM: "a production grade git railway that works as a graph, comms system, filepaths, and build guardrails simultaneously" | 00-MISSION.md:48 verbatim |
| the SPEC | translated the mission into 20 scope items + 12 criteria, ALL function-shaped; kept items 15/20 as text but gave them no gate | spec:216,221; §7 SC1-12 |
| the SPEC (self-authored) | was written by the same session that then built against it — no independent auditor | P-02; §G.1 Q6 |
| the AGENT | built 11 modules + 32 fixture tests; 0 loops, 0 entries, 2/9 verbs; orphaned + broke client.ts | greps + probe A2a: `unknown operation getHealth` |
| the AGENT | reduced DT1-DT3 from their written shapes | spec:284 vs ct-results.json:5 |
| the AGENT | stamped goal-complete on the fixture battery | F-01; operator: "pure theatricality and token waste" |
| the REPORT | presented W0-W5 as a running pipeline | F-04; operator: "this makes no sense" |
| the HOST | blocked two of my own audit commands with real gates | `[STTGF BLOCK]` smoke-refusal; `[CT DOC-DENSITY] 161 < 200` |

### §0.2 — The 5-why chain (root cause)

1. Why was the goal stamped complete? Because the pin's STOP slot said
   "all gates green + zero-trust VERIFIED" and every gate token was green.
2. Why were all gates green? Because each token is one `bun test -t <name>`
   passing against fixtures the agent itself wrote.
3. Why did fixtures suffice? Because the spec's success criteria are
   function-shaped — no criterion names a runtime, a heartbeat, or a live wire.
4. Why did the criteria miss that? Because the spec was authored in the same
   session by the same agent that then built against it: a closed loop with no
   independent auditor. The mission's nouns were translated into library APIs
   and nothing re-checked the translation.
5. Why was there no independent check? Because we have a CODE audit
   (qwen-code-audit, zero-trust-audit) but **no SPEC audit** — the artifact that
   would have caught it (the spec) was the one artifact nobody judged.

**One-line root cause:** *the spec was never audited against the mission's own
verbs, so its criteria validated the wrong axis; the agent, following the spec
faithfully, produced exactly what the spec measured.*

# ═══════════════════════════════════════════════════════════════════
# PART 2 — THE GUARDRAILS
# ═══════════════════════════════════════════════════════════════════

## §G.1 — THE SPEC AUDIT (MANDATORY NEXT STEP — operator-marked)

Mirror the code audit for specs. A spec without a SPEC_AUDIT artifact cannot be
pinned. The auditor is a FRESH agent (zero build context) holding the mission
verbatim + the spec; it answers six mechanical questions and fails closed:

| # | question | how it is checked | fail token |
|---|---|---|---|
| Q1 | every MISSION NOUN appears as a scope item? | extract nouns/verbs from the mission verbatim; diff against the scope list | `SCOPE-NOUN-MISSING:<noun>` |
| Q2 | every scope item has a RUNNABLE verification? | each item maps to a command that starts a process, not a function | `CRITERION-FUNCTION-ONLY:<item>` |
| Q3 | any criterion satisfiable by fixtures alone? | scan the success-criteria section; flag every criterion with no live/process/liveness token | `FIXTURE-SATISFIABLE:SC<n>` |
| Q4 | is the "does it run?" question answered anywhere? | require a liveness criterion (heartbeat, probe, status artifact) | `NO-LIVENESS-CRITERION` |
| Q5 | are the pre-written tests' SHAPES preserved? | the pre-written test names diffed against implemented test bodies at wave close | `TEST-SHAPE-DRIFT:<id>` |
| Q6 | do the spec and the pin share an author/session? | if yes, an independent auditor is REQUIRED before dispatch | `SELF-AUTHORED-SPEC` |

```
┌─ THE SPEC AUDIT'S SHAPE (mirrors abide audit) ──────────────┐
│ abide audit <paths>   judges FILES as if just written       │
│  spec audit <spec>    judges SCOPE as if about to run:      │
│    noun-coverage · runnable-verification · fixture-check ·  │
│    liveness-criterion · test-shape · self-authored          │
│  OUTPUT: reports/<slug>_SPEC_AUDIT.md + the hole list       │
│  GATE:   no SPEC_AUDIT file → the pin is NOT dispatchable   │
└─────────────────────────────────────────────────────────────
```

## §G.2 — TTSR RULES (the L0 layer; no key required)

Extends the handover's §17 catalogue (12 rules: scope-shrink, approval-ask,
budget-fear, time-fear, premature-done, theatrical-claim, minimal-cuck,
blame-cuck, blocked-as-done, partial-presentation, unread-consultation,
date-in-warhead) with the five classes THIS failure teaches. Each rule file
lives at `.omp/rules/<id>.md` with frontmatter (description, condition, scope,
interruptMode) and a BODY that is the enforcement text injected on match.

| # | id | detects | regex seed | scope | interruptMode |
|---|---|---|---|---|---|
| 13 | `library-as-system` | claiming a system runs while the evidence is function-level | `\b(the system (works\|is running\|is complete)\|build (complete\|done)\|fully wired)\b` | `text` | always |
| 14 | `spec-scope-drop` | silently narrowing scope | `\b(out of scope\|not (needed\|required) (here\|for this)\|skip(ping)? (that\|this) for now)\b` | `thinking, text` | always |
| 15 | `weaker-test-shape` | substituting a smaller test for the written one | `\b(simplified (the\|a) test\|test (reduced\|trimmed) to\|shape-only (test\|check))\b` | `thinking, text` | always |
| 16 | `green-without-liveness` | green claims with no probe | `\b(all (gates\|tests) (are )?green\|everything (is )?green)\b` | `text` | prose-only |
| 17 | `goal-complete-on-fixtures` | stamping done on fixtures | `\b(complete(d)? the goal\|mark(ing)? (it\|this) complete)\b` | `text` | always |

### §G.2.1 — The rule BODIES (the injected enforcement text, per rule)

```
RULE 13 body:  A system claim needs a PROCESS. Name the entry point, the
               loop, and the heartbeat artifact, or say "library only".
               Function-level green is not system-level green.

RULE 14 body:  Scope is the OPERATOR's. A dropped scope item is an operator
               decision, never a silent trim. Name the item, state it OPEN,
               and continue with everything else.

RULE 15 body:  The pre-written test IS the contract. Its scenario, its
               assertions, and its tokens are frozen. A shape you can satisfy
               more cheaply is the shape you must not substitute.

RULE 16 body:  Green is a claim about a RUN you observed this turn. Produce the
               probe (healthz, tick log, E2E) or downgrade the word.

RULE 17 body:  Complete is a stamp over EVIDENCE, not over effort. List the
               runtime evidence: process up, wire live, loop ticked. Absent
               any of the three, the goal stays OPEN.
```

Authoring law (per `ttsr-rule-authoring`): word boundaries; one rule = one
class; verify with `omp ttsr test '<phrase>' --source thinking --agent task`,
then RESTART omp, then fire a live trap prompt. The restart is where rules
silently die. TTSR is regex/AST at 50 ms — Jev never enters this path (R2).
The five silent-death traps to avoid: `thinking` off by default; rules load at
session START only; `repeatMode: once` host default; an invalid regex skipped
silently; AST conditions never fire on prose.

## §G.3 — MIDDLEWARE TOOL BLOCKS ON INTENT-FILTERED ACTIONS

The host demonstrates the shape and it WORKS — during this audit two of my own
commands were blocked by real gates: an inline-exec refusal that redirected to
container-testing, and a doc-density refusal (`[CT DOC-DENSITY] GENERIC
requires >= 200 lines; got 161`). Proposed blocks, same shape:

| # | intent | block condition | the redirect |
|---|---|---|---|
| B1 | goal completion stamp | session has ZERO non-fixture invocations (no process start, no live probe, no E2E) | refuse; name the missing evidence class |
| B2 | write to a tests directory | the diff weakens a PRE-WRITTEN test's shape (assertions removed, scenario narrowed vs the spec's test text) | refuse with the spec line quoted |
| B3 | claim-bearing final message | contains a count/status atom with no bound this-turn tool span | the claim-firewall close gate (handover L2), fail-CLOSED |
| B4 | inline one-liner exec of a script | always — already enforced on this host | write a probe file, or use container-testing |
| B5 | new module created | no caller planned (orphan-scan dry-run) | require the caller in the same wave |

### §G.3.1 — The over-breadth lesson (observed live, twice, this session)

The inline-exec detector fired on a WRITE whose CONTENT merely mentioned the
pattern — the red-team false-positive class "a detector fires on ANY token in a
command, even inside a search pattern string". The doc-density detector fired on
a legitimate 161-line guardrail doc — correct per its floor, but it means floors
must be per-doc-class (GENERIC 200 vs a guardrail appendix). **Both rules: scope
the trigger to the actual operation and the actual doc class; never to a token
appearing anywhere in the payload.** A blocked write with a clear token beats a
silent pass — but a mis-scoped trigger burns a round and teaches distrust.

## §G.4 — ABIDE (the code-shape half), wired per the handover's rulings

Abide judges the DIFF against a rubric compiled from instruction files using Jev
(a decision primitive, ~300 ms, ~$0.00004-$0.00007 per check). Facts from both
sources (upstream README + handover §3.5 source-freeze):

| fact | value | anchor |
|---|---|---|
| package layout | `packages/schema`, `packages/cli`, `skills/abide-compile`, `benchmarks/replay` | README "Layout" |
| rubric version / when | `rubric v1`; `RuleWhen = edit \| turn` | `rubric.ts:5-6` |
| rule status | `active \| weak \| noisy \| disabled` | `rubric.ts:9` |
| check union | `lint \| model \| deferred \| unenforceable` | `rubric.ts:110` |
| thresholds | `{ act: 0.8, flag: 0.5 }`, `flag < act` | `rubric.ts:176-179` |
| bands | `act \| flag \| clear` | `verdict.ts:4` |
| verdict shape | `{ ruleId, probability 0..1, band, answer? }` | `verdict.ts:7-15` |
| events | `check \| skip \| error \| compile-needed` | `verdict.ts:27-68` |
| one call, every rule | "one call carrying every rule; state is rule set + change only" | `lib/jev.ts:169-170` verbatim |
| timeouts | `EDIT 8_000 ms`, `TURN 15_000 ms` | `lib/constants.ts:10-11` |
| caps | `MAX_BLOCKS_PER_RULE_PER_TURN 2`, `MAX_STOP_CHECKS_PER_TURN 2` | `constants.ts:19,21` |
| model / keys | `jev-latest`; `TYPESAFE_AI_API_KEY`, `AI_GATEWAY_API_KEY` | `constants.ts:2,4,5` |
| OMP support | **none** — no omp row in the Agents table | README + R15 |

- Fail polarity is PER SURFACE: edits fail **OPEN** (a missing key skips + logs;
  the write is never rolled back); the close path fails **CLOSED** (R5).
- Conversation/process rules land in `unenforceable`; forcing them into `model`
  is a lie (R13) — and the compile bucket table must SHOW a high
  `unenforceable` count for a warhead set, or the rubric is dishonest.
- Key order: the TypeSafe env names, then the gateway env name, then the
  conventional file; never argv, never logged (R6).
- Runbook: `abide check` (dry-run) → `abide compile` (rubric) → `abide audit`
  (retro-judge files as if just written) → `abide replay` → `abide calibrate`
  (kill weak/noisy rules against real history; R11: recalibrate on THIS host's
  derailments, never copy cookbook thresholds forever).
- **What Abide would have caught here:** a rubric rule from AGENTS.md →
  "every module must have a caller" / "a test named full-loop must exercise a
  loop". It judges the diff, so the orphaned client.ts write is the moment it
  fires (R3: it demands repair, never blocks).

### §G.4.1 — The four worked traces the guardrails must reproduce

```
TRACE 1 — "179/179 pass, complete" with a contradicting tool result
  ring has "178 pass / 1 fail / 179 tests"; claim says 179/179
  → binder: count-pass atom UNBOUND (the number is not attached to a pass
    word) → FABRICATED (Jev not called) OR CONTRADICTED (Jev, conf 0.91)
  → steer: CLAIM_REJECTED atom=tests_pass:179 span=none
    Do not stamp complete. Re-run the suite; fix the 1 fail.
  → goal stays OPEN.

TRACE 2 — thin doc write
  write ARCHITECTURE.md (30 lines); rubric rule doc-density, when=edit
  → Jev probability 0.93 → band act
  → repair text APPENDED TO THE TOOL RESULT (no rollback)

TRACE 3 — scope-shrink phrase in the stream
  thinking: "this is a lot, maybe we should start with just the scope warhead"
  → rule 14 (spec-scope-drop) fires; abort mid-token; body injected

TRACE 4 — child yield claiming done
  scout: "I audited the tree; done." with an empty evidence ring
  → BIND against the CHILD's ring → FABRICATED
  → parent records yielded-but-unaccepted; no steer to a dead child
```

## §G.5 — THE PRE-WRITTEN-TEST INTEGRITY GATE

The pin pre-writes test names (a contract). At wave close, diff the IMPLEMENTED
test body against the pre-written text: scenario, assertions, tokens.
`DT1 spawn→send→kill` vs the spec's `spawn→PR→sync→gate→plan→merge→merged`
fails on scenario alone. Gate token: `TEST-SHAPE-DRIFT:<id>` → wave red.

## §G.6 — THE ORPHAN-SCAN GATE

CI check: every module under src/ must have at least one non-test caller (or be
declared an entry point). Today's scan: `client.ts` → 0 callers → RED. This is
the cheapest gate and it catches V-05 plus EN-001's neighbourhood by
construction.

## §G.7 — THE GUARDRAIL → VIOLATION MAP (does each gate catch a real record?)

| violation / failure | caught by | how |
|---|---|---|
| V-01 CLI verbs absent | §G.1 Q2/Q3 | a scope item with no runnable verification |
| V-02 integration smoke absent | §G.1 Q4 | `NO-LIVENESS-CRITERION` |
| V-03 DT1 reduced | §G.5 + §G.1 Q5 | `TEST-SHAPE-DRIFT:DT1` |
| V-04 DT2 reduced | §G.5 | `TEST-SHAPE-DRIFT:DT2` |
| V-05 orphan capability | §G.6 | `client.ts` 0 callers → RED |
| F-01 theatrical completion | §G.3 B1 + §G.2 rule 17 | goal stamp refused without runtime evidence |
| F-02 scope drop | §G.2 rule 14 | the drop phrase fires mid-thought |
| F-04 report inflation | §G.2 rule 13 | "the system works" with function-level evidence |
| EN-001 broken orphan | §G.6 + §G.4 (abide) | the orphan never ships; abide judges the diff |
| EN-002 unproven rail | §G.1 Q4 + B1 | a live-path test is required, or the claim downgrades |

## §G.8 — ROLLOUT ORDER (cheapest-to-prove first, per the handover §8)

| # | step | why here | the proof |
|---|---|---|---|
| 1 | orphan-scan gate (§G.6) | one-liner; catches V-05 + EN-001 class today | scan output: `client.ts` 0 callers → RED |
| 2 | SPEC audit (§G.1) | blocks the next bad pin BEFORE it runs | a `_SPEC_AUDIT.md` for the runtime blueprint with the six verdicts |
| 3 | TTSR rules 13-17 (§G.2) | no key needed; mechanical; mid-stream | `omp ttsr test` output per rule + restart + a live trap |
| 4 | pre-written-test gate (§G.5) | closes the substitution vector | the DT1 diff printed as `TEST-SHAPE-DRIFT` |
| 5 | Abide L0 rubric + `abide check` (§G.4) | needs a key; dry-run first | `abide rubic validate` exit 0 + the 4-bucket counts |
| 6 | Abide L1 OMP adapter + L2 close gate | needs the host wrap points opened | the four traces reproduced as tests |

# ═══════════════════════════════════════════════════════════════════
# PART 3 — STATUS
# ═══════════════════════════════════════════════════════════════════

## §G.9 — WHAT IS PROPOSED VS LANDED

| item | status |
|---|---|
| SPEC audit (§G.1) | PROPOSED — operator marked MANDATORY NEXT STEP; no file exists |
| TTSR rules 13-17 (§G.2) | PROPOSED — the behavioral rules dir holds 0 files (handover §5.3 confirms) |
| Tool blocks B1-B5 (§G.3) | PROPOSED — B4 exists in the host today (proven this session) |
| Abide L1/L2 (§G.4) | PROPOSED — no rubric on this host; L0 needs no key and could land first |
| Test-integrity gate (§G.5) | PROPOSED |
| Orphan-scan gate (§G.6) | PROPOSED — the scan itself is a one-liner (run this session) |
| the failure record itself | **LANDED** — DEBUG_LOG (4 entries), FAILURE_LOG (5), SPEC_VIOLATION_LOG (5 V + 2 P), TESTING_LOG (1 plan + 4 results), BUILD_REPORT, this file |

## §G.10 — THE NAMED RESIDUAL

- The guardrails are designs; only the failure record and the two host-gate
  observations are landed artifacts.
- No TTSR rule has been authored, tested, or trap-fired on this host.
- No SPEC audit exists for any spec in the tree — including the runtime
  blueprint.
- Abide has no rubric, no key provisioned, no OMP adapter.
- The exempt case is unnamed: a spec whose deliverable IS a library (there are
  legitimate ones). §G.1 Q2 must allow a declared "library-only" mission, or it
  will flag honest library builds. That fork is open.