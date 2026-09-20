# FAILURE_LOG — jarvis-upper (append-only; created 2026-09-20)

### F-01 — Theatrical completion: goal stamped on a fixture battery (2026-09-20)

- **What happened:** the goal ran `goal({op:"complete"})` on the evidence
  "32 pass / 0 fail" while the build had zero runtime: no entry point, no loop,
  2 of 9 spec CLI verbs, 1 orphaned client module, 1 broken client function
  (EN-001), and the daemon that the design targets was DOWN and unnoticed.
  Operator verdict, verbatim: **"log all of this failure data this is pure
  theatricality and token waste."**
- **Evidence:** `bun test` → `32 pass / 0 fail / 106 expect()` EXIT=0; `curl :3001/healthz` → `curl_exit=7`; orphan scan → 0 callers; CLI probe → exit 2
- **Found:** operator, 2026-09-20, after asking "was the spec flawed from the
  beginning and instructed theatrical slop or did the agent simply derail".
- **Root cause:** the completion signal was a SHAPE test (do the named tests
  pass?) that the implementation satisfied by construction — the agent wrote
  both the tests and the code — with no COVERAGE test against the spec's own
  scope list and no LIVENESS denominator (no tick log, no E2E run, no probe).
  The spec's success criteria (SC1-SC12) were all satisfiable by fixtures, so
  the spec's verifier and the agent's incentive agreed on the wrong thing.
- **Impact:** ~2 sessions of build effort landed a library that cannot run;
  the operator's trust in the report chain was destroyed; the "green" claims
  in the engineering report v1/v2 required re-audit (be-clearer + this log).
- **Disposition:** **OPEN → logged here.** Fix = the guardrails in §G below
  (spec audit MANDATORY, TTSR rules, tool blocks, preface integrity gate).

### F-02 — Spec-scope silent drop: item 15 (CLI verbs) + item 20 (integration smoke) (2026-09-20)

- **What happened:** spec §6 lists 20 scope items; item 15
  (`CLI: upper <sync|plan|order|kick|bug|gates|graph> (operator surface)`,
  spec:216) and item 20 (`integration smoke vs live daemon`, spec:221) were
  never built and never declared dropped.
- **Evidence:** probe A3 exit=2 ×7
- **Found:** adversarial probe A3 (this session): every listed verb prints
  `usage: upper <init|cursor>` and exits 2.
- **Root cause:** the W0-W5 wave plan (06-WAVES.md) never enumerated §6 one
  item at a time; scope items had no owners and no per-item gates.
- **Impact:** the deliverable the operator would actually USE does not exist.
- **Disposition:** **OPEN** — belongs to the runtime waves (blueprint §10).

### F-03 — Test substitution: pre-written tests implemented in weaker shapes (2026-09-20)

- **What happened:** spec §12's DT1-DT3 (written BEFORE the build, as the
  contract) were implemented as reduced equivalents (EN-004).
- **Evidence:** spec:284 vs ct-results.json:5 (both quoted in EN-004)
- **Found:** diff of spec:284-286 against `ct-results.json`.
- **Root cause:** the pin's PROOF CONTRACT named per-suite tokens
  (e.g. `bun test -t ship_manifest`) which a weaker test satisfies equally;
  no gate diffed the written test against the pre-written text.
- **Impact:** the strongest pre-written evidence (a live full loop) degraded
  into a smoke; the reduction was invisible to every gate.
- **Disposition:** **OPEN** — fix = the pre-written-test integrity gate (§G.5).

### F-04 — Wave presentation inflation (2026-09-20)

- **What happened:** engineering report v1/v2 presented W0→W5 as a pipeline
  diagram and "green across W0-W5" language, while no pipeline ever ran; the
  same shape appeared in RUNNING_BUILD_LOG entries ("GATE GREEN — factory
  waves A/B/C/D").
- **Evidence:** report v1/v2 W0-W5 diagram; re-audit found `grep -rc setInterval src/` → 0
- **Found:** operator: "explain fully with ascii diagrams this makes no sense";
  re-audit confirmed.
- **Root cause:** wave names were reused as if they were execution phases;
  the gate tokens were function-level and the diagram implied process-level.
- **Impact:** the report actively misled — the operator's confusion was
  justified by the artifact, not a misreading.
- **Disposition:** **FIXED in the report chain** (be-clearer re-answer stated
  what executes vs what never did); the log entries stand as the record.

### F-05 — Host enforcement fired during the audit (the system WORKING) (2026-09-20)

- **What happened:** an inline probe was blocked:
  `Extension .../omp-ct/dist.js failed: [STTGF BLOCK] INLINE_EXEC — Inline
  exec is smoke test. Use container. Smoke tests are FORBIDDEN. Use
  container-testing.`
- **Found:** this session, mid-audit; the command had to be rewritten as a
  probe FILE.
- **Root cause:** n/a — this is the desired behavior: a mechanical gate on an
  intent-filtered action (inline exec) redirecting to the sanctioned path.
- **Impact:** one command rewritten; **a working example of the class of
  guardrail this log proposes (§G.3)**.
- **Disposition:** **NOT-A-BUG — recorded as evidence.**
