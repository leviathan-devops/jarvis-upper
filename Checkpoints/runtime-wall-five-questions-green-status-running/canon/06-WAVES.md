# WAVES — jarvis-upper-tier (entry criteria → desks → exit gate)

W0 GROUND (entry: package read; exit: tsc 0 + store boots)
  desks: upper store/store.ts + migrations + cli skeleton; ao-client/gen from
  pinned openapi. GATE: `upper store init` exit 0 + parity test 144/144 [SC1]
W1 RAIL (entry W0 green; exit: replay+sync green)
  desks: rail.ts (SSE+cursor) · reducers · sync. GATE: T1 dupes=0 gaps=0
  over ≥500 synthetic events + SC3 sync rows match [SC2/SC3]
W2 GRAPH+GUARD (entry W1; exit: plan/gates green)
  desks: plan.ts · guardrail.ts · graph.ts. GATE: T2 cycle-refuse + T3
  stale-gate + SC4/SC5/SC12 tokens
W3 BUG RAILS (entry W2; exit: attribute+kick green)
  desks: attribute.ts · kick.ts · dossier law. GATE: SC6 hit+triage +
  T4 + T5 ghost-fallback + T7 tamper-refusal + SC7/SC8
W4 FACTORY WAVES (entry W3; exit: end-to-end fixtures)
  desks: waveA assemble · waveB harden (fixture module) · waveC audit
  fixture (seeded defect) · waveD research fixture. GATE: SC9 fence2
  PASS + SC10 bug recorded + DT1/DT2 transcripts asserted
W5 SHIP (entry W4; exit: package complete)
  desks: docs close-out · battery full · index final. GATE: SC11 bun
  test green (≥30 new) + tsc 0 + DT3 + bible stamped
No wave starts with its predecessor's gate unmet. Every gate token lands
in RUNNING_BUILD_LOG (append-only).
