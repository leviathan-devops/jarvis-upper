# JARVIS UPPER TIER — WHAT IS TRUE (T2 bible, seed v0.1)

## STATUS BANNER
Pre-build architecture package. Factory (AO) COMPLETE. This tier wires
AO into Jarvis as the integration adapter, adds the deterministic control
layer (the SQLite state engine), and the hardening factory. S-tier quality
requirement on wave output. Merge is always explicit; no auto-merge; no
theater.

## ARCHITECTURE TRUTH (measured)
- AO daemon: 144-path / 164-op OpenAPI spec, loopback REST + SSE.
  269 schemas. v0.13.0 on this host. Agents.md law: "CLI is a thin
  client; do not read SQLite directly" — REST-first, always.
- Event system: SSE /api/v1/events, after-cursor, Last-Event-ID replay.
  At-least-once delivery = idempotent reducers mandatory.
- Adapter: typed TS bindings generated from pinned openapi.yaml, sha256
  pinned per build. Regenerate = explicit CI step. Parity gate: 144/164/269.
- Deterministic engine: no LLM in the control layer. Events are hints;
  API rows are truth; gaps force resync.
- Attribution: git archaeology + AO session/PR tables via adapter (never
  ao.db direct). Confidence score < 0.6 → triage, never wrong-kick.
- Merge law: explicit-only (AO law). executePlan requires confirm=true.
  Cycle detection is mandatory (CYCLE refusal, never partial-merge).

## IRON LAWS (from spec §11 / blueprint §7)
L1 merge explicit-only. L2 engine deterministic. L3 REST-first.
L4 events are hints, API is truth. L5 attribution carries confidence.
L6 dossier hash gates every kick. L7 gates are sha-bound.
L8 kicks cite origin commits. L9 append-only ledgers. L10
fix_direct never touches factory worktrees.

## KNOWN NON-GOALS (do not chase)
- No auto-merge. No webhook. No cloud API. No cross-PR depends_on.
- No re-parenting of AO's pty workers. No SQLite writes from outside
  the control layer's own store. No config changes inside AO itself.

## COMPACTION RECOVERY
Read §1 → run the adapter parity check (144/164/269) → re-run
healthz → re-verify the 8 foreman ST + fence2 matrix → rebuild
from 00-MISSION → DPL1 spec §6 success criteria.

## REPLACEMENT POLICY
This bible describes what IS TRUE, not what is built (nothing is built
yet). As W0→W5 land, this bible records the true runtime behavior.
Blueprint records why; this bible records what; operator manual
(records how). Cross-reference between the three, never duplicate.
