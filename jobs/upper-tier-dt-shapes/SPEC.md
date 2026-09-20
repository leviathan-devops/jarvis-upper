# DT SHAPES — PRE-WRITTEN DEEP CONTAINER TEST CONTRACT

**Slug:** upper-tier-dt-shapes · **Version:** 1.0 · **Date:** 2026-09-21
**Author:** task assignment — implement against the DPL1 SPEC §12
**Run:** `bun test -t dt_shapes`
**Declared test id:** `dt_shapes`

---

## §1 SCOPE

Three deep-container test shapes that exercise the JARVIS upper-tier control
loop end-to-end. Each shape produces a JSON transcript that the suite
asserts against. Daemon-touching parts use the `scratch` project ONLY.

## §2 SHAPE CONTRACTS

### DT-1 — full-loop (scratch repo, live daemon)

**Shape:** spawn → PR → sync → gate → plan → (confirm) → merge → state=merged

| Step | Primitive | Evidence |
|---|---|---|
| spawn | `call("spawnSession", {projectId:"scratch",...})` | session.id returned |
| PR | list session PRs from AO | ≥0 PR rows from `listSessionPRs` |
| sync | `syncPrs(db, listFn)` | pr_node rows == API PR count |
| gate | `guardrail(db, prId)` per ready PR | eligibility ok=true when gates green |
| plan | `orderMerges(db)` | kind="ok", non-empty order |
| confirm | `executePlan(db, adapter, {confirm:true})` | plan executed, no CYCLE |
| merge | mock MergeAdapter returns ok=true | pr_node.state=="merged" |

**Blocked shape (daemon down):** transcript carries `daemon:"down"`,
`transcript:"BLOCKED"`, and the test asserts the named refusal token
`SHAPE-BLOCKED:daemon-down` — never a silent pass.

### DT-2 — bug-loop (scratch git repo)

**Shape:** seed defect commit → attribute → kick_live → observe fix → close bug

| Step | Primitive | Evidence |
|---|---|---|
| seed | git commit introducing a defect line | origin commit sha known |
| attribute | `attributeBug(db, input, resolve)` | commit matches seed, confidence ≥0.9 |
| dossier | `writeDossier(root, bugId, md, origin)` | manifest.sha16 written |
| record | INSERT INTO bug_record | bug row with origin_commit + status="open" |
| kick | `kick(db, deps, input)` with live session | mode="live", outcome="delivered" |
| observe | kick row outcome field | outcome=="delivered" |
| close | UPDATE bug_record.status="fixed" | closed_at set |

**Dossier law (T7):** the `manifest.sha16` must hash-match the dossier body;
any tamper → `DOSSIER-TAMPER` refusal (tested by the kick path).

### DT-3 — loss-replay (kill -9 storm)

**Shape:** kill -9 storm ×20 → rail must converge (dupes=0, gaps=0)

| Step | Primitive | Evidence |
|---|---|---|
| seed | `openStore(":memory:")` + `EventRail` | cursor=0 |
| storm | 20 kill-9 cycles: attach N frames, die, restart from cursor | seq advances to 500 |
| reduce | `reduceEvent(db, ev)` per frame | pr_node upsert idempotent |
| converge | final `RailStats` | dupes=0, gaps=0, cursor=500 |
| idempotence | double-process same seq | `INSERT OR REPLACE` → 1 row |

**Gap law:** a seq jump (gap) fires `onResync` (caller refetches facts);
state change only on in-order events (no phantom writes during gaps).

## §3 JSON TRANSCRIPT CONTRACT

Each shape writes a transcript object to `runtime/dt_transcripts/<shape>.json`:

```typescript
interface DtTranscript {
  shape: "DT1" | "DT2" | "DT3";
  status: "pass" | "blocked" | "fail";
  daemon?: "up" | "down";
  steps: string[];           // ordered step names reached
  transcript: string;       // SPACE-delimited token trail
  evidence: Record<string, unknown>;
}
```

The suite asserts:
- `status` is `"pass"` when the full shape ran, or `"blocked"` when the
  daemon was down (DT-1/DT-2 only).
- `transcript` contains the expected token trail for the shape.
- `evidence` fields match the contract table above.

## §4 CONSTRAINTS

1. NO daemon source mods.
2. NO factory PRs minted during tests (scratch project only).
3. `executePlan` is the ONLY merge path (confirm-gated).
4. Dossier hash gate enforced on every kick.
5. Tests must be deterministic and isolated (in-memory store or temp dirs).
