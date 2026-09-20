# CANON MANIFEST — jarvis-upper-tier

This package is architecture-only: pre-build specs, not code. Every file
below was authored 2026-09-19 from discovered intelligence (AO API spec,
JAM kernel, foreman patch, Thanatos design, JGM gate rules) — no code
was written.

| # | File | Role | Gate |
|---|---|---|---|
| 1 | 00-MISSION.md | Mission (verbatim operator quotes + restated understanding) | Frozen; operator's verbatim text untouchable |
| 2 | 01-DISCOVERY.md | Measured inventory + variant table (what exists, what is proven) | Append on new discoveries |
| 3 | jarvis_upper_tier_DPL1_SPEC.md | The contract (14 sections + appendices, 413L) | §13 mechanical checklist |
| 4 | BLUEPRINT.md | Architecture (9 sections, 494L) | Wave-stamped as builds land |
| 5 | 06-WAVES.md | Wave decomposition (W0→W5 + gate tokens) | Token-gated; red = stop |
| 6 | 07-GOALS.md | Hydra org + goal-prompt law | Updated per wave |
| 7 | 00-INDEX.md | Fresh-agent read path | Always current |
| 8 | RUNNING_BUILD_LOG.md | Append-only build receipts | Each stamp: date + what + token |
| 9 | RUNNING_DEBUG_LOG.md | Append-only debug ledger | EN format; only real findings |

## CHANGE LAW
Spec changes = new versioned section, never silent edits. Binding:
this spec > 00-MISSION > 01-DISCOVERY > prior-era specs (L2/V2 closed).

## LANDING ZONE
When W0 code first exists: JARVIS_WORKSPACE/jarvis-upper/{ao-client,src,desks,tests}/
(source tree layout per BLUEPRINT §6; ao-client/ and src/ are separate dirs,
NOT a nested railway/ wrapper — each is its own top-level under jarvis-upper/).
