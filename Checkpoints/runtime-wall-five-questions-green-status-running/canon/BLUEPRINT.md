# MASTER BLUEPRINT — JARVIS UPPER TIER
(system: AO integration adapter + lifecycle controls + hardening factory + bug-kick rails)
Package: jarvis-upper-tier · Blueprint v1.0 · 2026-09-19
Companions: jarvis_upper_tier_DPL1_SPEC.md (contract) · 01-DISCOVERY.md (measured)
Provenance grades: [D] verified this session · [L] live-measured · [I] inferred · [P] proposed

---

# §1 MACRO (one page)

```
┌──────────────────────────── OPERATOR ────────────────────────────┐
│  confirms merge plans · resolves triage bugs · flips kick mode   │
└──────────────┬───────────────────────────────────────────────────┘
               │ upper CLI (sync|plan|order|kick|bug|gates|graph)
┌──────────────▼───────────────────────────────────────────────────┐
│ JARVIS UPPER TIER                                                │
│                                                                  │
│  ┌────────────────┐  facts (SSE after=cursor, idempotent)        │
│  │ AO ADAPTER      │◄─────────── AO daemon :3001 (144 routes,    │
│  │ ao-client/ (TS) │───────────► OpenAPI-pinned, REST-first)     │
│  └───────┬────────┘  actions (spawn/send/steer/claim/review/     │
│          │                merge[explicit]/delegate)              │
│  ┌───────▼────────────────────────────────────────────────────┐  │
│  │ LIFECYCLE CONTROLS (deterministic engine, SQLite WAL, NO LLM)      │  │
│  │  store: pr_node · pr_edge(depends_on) · gate_pass ·         │  │
│  │         bug_record · kick · rail_seq                     │  │
│  │  engine: syncProject · orderMerges(topo+cycle-refuse) ·     │  │
│  │          guardrail(gates+deps+AO-ready) · attributeBug      │  │
│  │          (blame/log→commit→session→worker, confidence)      │  │
│  │  guard: inherits JGM refuse-token law (exit 2 + named token)│  │
│  └───────┬──────────────────────────┬─────────────────────────┬─┘  │
│     PR set + dossiers          bug flags + kicks          graph   │
│  ┌───────▼──────────┐   ┌───────▼──────────┐   ┌───────▼─────┐  │
│  │ HARDENING FACTORY │   │ BUG-KICK RAILS   │   │ GRAPH RENDER │  │
│  │ (foreman'd OMP    │   │ kick_live (steer │   │ (operator    │  │
│  │  macro desks on   │   │  -or-send+dosssr)│   │  view: DAG + │  │
│  │  orca seats)      │   │ kick_spawn       │   │  bug overlay)│  │
│  │  A ASSEMBLE→pkg   │   │  (delegateTask   │   └──────────────┘  │
│  │  B HARDEN→S-tier  │   │   +attachments)  │                     │
│  │  C AUDIT: Thanatos│   │ fix_direct (rail │                     │
│  │    +reverse-engin │   │  branch, never   │                     │
│  │    +runtime batt  │   │  factory tree)   │                     │
│  │  D RESEARCH: deep │   └──────────────────┘                     │
│  │    research/libr. │                                            │
│  └───────────────────┘                                            │
└──────────────────────────────┬────────────────────────────────────┘
                               │ minted PRs arrive from below
┌──────────────────────────────▼────────────────────────────────────┐
│ AO = JARVIS CORE (factory, COMPLETE): spawn→worktree→PR→CI/review │
│ →auto-fix→ready_to_merge. Loopback-only. Merge always explicit.   │
└────────────────────────────────────────────────────────────────────┘
```

Existing machinery this system RIDES (not rebuilds): AO daemon [D], JARVIS
kernel desks + foreman + fence2 [D, battery 240/0], JGM refuse-token +
preview/SHA-gated mutation law [D, GATE_RULES_SPEC VERIFIED], Thanatos
three-engine design (E1 hunter/E2 killer/E3 takeover) [D, MASTER_PROMPT],
Omp_Context_Manager corpus [D].

# §2 LIFECYCLE (per stage: WHAT/HOW/WHERE/WHY)

## Stage 0 — FACT INTAKAKE (continuous)
- WHAT: AO facts → control layer rows, zero loss, zero dupes.
- HOW: EventRail SSE `/api/v1/events?after=rail_seq.last_seq`;
  reconnect Last-Event-ID; reducers idempotent on (source,seq); on gap →
  syncProject refetch (events are hints, API rows are truth).
- WHERE: ao-client/src/rail.ts · jarvis-upper/src/reducers.ts.
- WHY: agents.md law "CLI/daemon is the client; don't read SQLite" + the
  cursor semantics [D openapi streamEvents] make SSE the only sanctioned
  push channel. At-least-once ⇒ idempotence is mandatory (T1/T6).

## Stage 1 — PR MINT RECEPTION
- WHAT: factory PR (opened by an AO worker) becomes a pr_node.
- HOW: reducer pr_state_changed → syncProject pulls listSessionPRs +
  getSession → upsert pr_node{session_id, head_sha, branches, state}.
- WHERE: jarvis-upper/src/sync.ts.
- WHY: the control layer only plans over rows it can attribute; AO's PR table
  has session_id + head_sha [D schema] = the attribution join keys.

## Stage 2 — ASSEMBLY WAVE (hardening factory, wave A)
- WHAT: minted PR set + history + tests + context → saved v1 ship package.
- HOW: macro desk (dispatchDesk explicit cmd pin) with dossier bundle:
  workspace/diffs + file/revision (git history), pr_checks (testing
  data), the minted build package (context); desk contract = ship-package
  canon; gate_pass(gate=fence2) on the package manifest via fence2.
- WHERE: desks/waveA/*.md prompts · upper gate ingest.
- WHY: mission: "first assemble into a v1 ship package that can be saved
  properly"; fence2 is the only completion verdict (carried law).

## Stage 3 — HARDENING WAVE (B)
- WHAT: v1 package → S-tier runtime grade.
- HOW: per-module hardening desks (foreman supervision, Jev ladder,
  done.mk + fence2 per desk); gate_pass(gate=hardened) per module;
  refusals reopen desks, never lower the bar (0 compromises ruling).
- WHERE: desks/waveB/.
- WHY: mission S-tier mandate; foreman's stop/escalate ladder is the
  proven supervision contract [D run 4b753325f73d].

## Stage 4 — AUDIT WAVE (C): Thanatos + reverse-engineering
- WHAT: deep review of the hardened tree; independent rebuild of the
  spec from the minted package; runtime verification.
- HOW: E1 hunter runs over the tree (read-only); reverse-engineer desk
  (fresh context) authors spec-from-package; diff vs authored spec;
  script-test battery drives runtime; every legit defect → bug_record +
  dossier (never silent fixes).
- WHERE: desks/waveC/ · Thanatos reports/ feed.
- WHY: mission "reverse engineering the build package from first
  principles… any bugs immediately flag and kick down"; Thanatos E1 is
  purpose-built (6-phase hunt loop) [D MASTER_PROMPT].

## Stage 5 — RESEARCH WAVE (D): librarian pipeline
- WHAT: problems X/Y/Z → solutions A/B/C → deep research validates/
  invalidates → extend → report.
- HOW: research desk contract (problems array in, verdict matrix out)
  riding deep-research skills + OCM corpus retrieval; output cited
  (links/receipts), feeds audit decisions + operator reports.
- WHERE: desks/waveD/ · Omp_Context_Manager.
- WHY: mission deep-research pipeline; "not just a summary".

## Stage 6 — ATTRIBUTION (bug → origin commit → worker)
- WHAT: each bug_record gets origin_commit/session/worker + confidence.
- HOW: attributeBug (spec Appendix E): git log -L/-S + blame -C -M over
  flagged hunks, bounded to the pr_node merge window; commits joined to
  sessions via pr.head_sha/session_worktrees.branch through the ADAPTER;
  score; <0.6 → triage.
- WHERE: jarvis-upper/src/attribute.ts.
- WHY: mission git-bug-graph; AO tables provide commit↔session↔worker
  keys [D]; ambiguity must degrade to triage, never wrong-kick (T4).

## Stage 7 — KICK DECISION + EXECUTION
- WHAT: choose kick_live | kick_spawn | fix_direct; execute.
- HOW: default rule (live if origin session alive else spawn; D1);
  kick_live = steerOrSend with dossier citation + manifest.sha16;
  kick_spawn = delegateTask{projectId, brief=FIX_CONTRACT,
  attachments=[dossier]}; fix_direct = control branch fix/<bug-id>
  (JGM commit-cone law applies: cone-only, secret-scan, trailers).
- WHERE: jarvis-upper/src/kick.ts.
- WHY: mission "rails 100% setup for both"; dossier-hash gate extends
  fence2 tamper law to kicks (T7).

## Stage 8 — MERGE ORDERING + EXPLICIT MERGE
- WHAT: ready PRs sequenced by dependency graph; operator-confirmed plan
  executed.
- HOW: orderMerges = topo over pr_edge(depends_on) ∩ state=ready_to_merge
  ∩ gates green; cycle ⇒ CYCLE refusal (exit 2); plan printed; execution
  ONLY via executePlan(plan,{confirm}) → sequential mergePR calls; every
  merge lands merged_at + dependent re-check.
- WHERE: jarvis-upper/src/plan.ts.
- WHY: AO lacks depends_on [D]; merge must stay explicit (AO law + R09
  lineage); graph+guardrails simultaneously (mission).

## Stage 9 — CLOSE-OUT
- bug fixed (factory PR merged or fix_direct merged) → bug_record
  status=fixed + kick outcome row; worktree reclamation is AO's (cleanup);
  the control layer keeps forensic rows forever (append-only ledger law).

# §3 DISPATCH TRACES (entry surfaces)

## Trace A — cold start
```
upper init            → store schema + rail_seq(0)
upper sync <project>  → adapter: listProjects→getProject→listSessions
                          → per-session listSessionPRs → upsert pr_node
                          → EventRail attach (SSE, after=cursor)
```
## Trace B — live event flow
```
SSE event(seq=n, pr_state_changed)
  → reducer: idempotent check (source,seq) seen? skip
  → syncProject(one) → pr_node upsert → guardrail(pr) recompute
  → if all-green ∧ deps merged → plan suggestion emitted (CLI/notify)
```
## Trace C — audit bug lands
```
Thanatos finding → bug_record(open, dossier/)
  → attributeBug → origin ok (conf≥0.6) → macro decides mode
  → kick_live: steerOrSend(session, dossier brief) → kick row(delivered)
     └ outcome watch: session events → fix PR → gate ci_green
  → OR kick_spawn: delegateTask(brief=FIX_CONTRACT, attachments)
     └ spawned_session recorded → same gate path
  → OR fix_direct: branch fix/<id> + commit-cone → pr_node(kind=fix)
```
## Trace D — merge wave
```
upper plan → ordered [PR-12, PR-9, PR-15] (deps respected)
  → operator: upper order --confirm <plan-id>
  → executePlan: mergePR(12) → re-eval → mergePR(9) → mergePR(15)
  → any mid-plan failure ⇒ plan halts (partial state recorded, no
    auto-continue)
```
## Trace E — operator triage
```
upper bug --triage   → candidates[] w/ attribution methods
  → upper bug resolve <id> --session <sid>  → origin assigned
  → normal kick path resumes
```

# §4 TYPES + ENGINE CHECKS

## 4.1 Store schema (SQLite WAL; migration = numbered sql files, forward-only)
```
pr_node(id TEXT PK, project TEXT, pr_number INT, session_id TEXT,
        worker_hint TEXT, head_sha TEXT, base_sha TEXT,
        source_branch TEXT, target_branch TEXT, kind TEXT DEFAULT 'feature',
        state TEXT, minted_at INT, merged_at INT, metadata_json TEXT)
pr_edge(id TEXT PK, from_pr TEXT, to_pr TEXT, kind TEXT, created_at INT)
gate_pass(id TEXT PK, pr_node TEXT, gate TEXT, verdict TEXT,
          evidence TEXT, sha16 TEXT, at INT)
bug_record(id TEXT PK, found_by TEXT, category TEXT, severity INT,
           dossier_path TEXT, origin_commit TEXT, origin_session TEXT,
           origin_worker TEXT, attribution_json TEXT,
           attribution_confidence REAL, status TEXT,
           created_at INT, closed_at INT)
kick(id TEXT PK, bug_record TEXT, mode TEXT, target_session TEXT,
     spawned_session TEXT, dossier_path TEXT, dossier_sha16 TEXT,
     sent_at INT, outcome TEXT, outcome_at INT)
rail_seq(source TEXT PK, last_seq INT, updated_at INT)
CHECKs: state IN (open,ready_to_merge,merge_ordered,merged,rejected,kicked)
        kind IN (feature,fix,hardening) · gate IN (ci_green,audit,hardened,fence2)
        kick.mode IN (live,spawn,direct) · severity IN (1,2,3)
```
## 4.2 Refuse-token vocabulary (extends JGM law: exit 2 + `<TOKEN>: msg` stderr)
```
CYCLE             plan graph has a cycle — no partial merges emitted
GATE-MISSING      merge-order requested for PR without all gates green
STALE-GATE        gate_pass sha16 ≠ current pr head_sha
GHOST-SESSION     kick_live target dead at send time (→ fallback rule)
ATTR-AMBIGUOUS    confidence < 0.6 — bug stays triage, kick refused
DOSSIER-TAMPER    kick payload hash ≠ recorded manifest.sha16
CURSOR-RESET      replay gap unresolvable — full resync ordered
UNCONFIRMED-PLAN  executePlan without confirm flag
BRIDGE-FORBIDDEN  adapter code attempting ao.db direct write
LLM-IN-ENGINE     upper module importing desk/foreman/jev modules
```
## 4.3 Engine checks (mechanical, in CI)
| Check | Mechanism |
|---|---|
| route parity | bindings route set == openapi paths (144) [SC1] |
| reducer idempotence | double-replay state hash equal [T6] |
| cycle jail | diamond+cycle fixture → CYCLE token, zero merges [T2] |
| stale gate | sha flip fixture → STALE-GATE [T3] |
| ambiguity | two-session fixture → ATTR-AMBIGUOUS [T4] |
| dossier tamper | edited dossier → DOSSIER-TAMPER [T7] |
| no-SQLite-writes | grep ao.db outside forensic/ fails CI |
| no-LLM-imports | import-lint rule in jarvis-upper/ |
| confirm-only merges | call-graph check: mergePR only via executePlan |

# §5 INVOKE PSEUDOCODE

## 5.1 EventRail
```
attach():
  cur = store.getCursor('ao-events')
  sse = fetch SSE /api/v1/events?after=cur   // Last-Event-ID on retry
  for ev in sse:
    if store.seqSeen('ao-events', ev.seq): continue
    reducers[ev.type]?.(ev)                  // hints only
    store.setCursor('ao-events', ev.seq)
onGap(): syncAll()                            // CURSOR-RESET if refetch fails
```
## 5.2 syncProject(p)
```
proj = adapter.getProject(p)
for s in adapter.listSessions(project=p):
  for pr in adapter.listSessionPRs(s):
    upsert pr_node(project=p, pr, session=s, head=pr.head_sha,
                   state=pr.state)             // API rows are truth
recompute gates for touched pr_nodes (guardrail)
```
## 5.3 orderMerges(p)
```
ready = pr_nodes(state=ready_to_merge, project=p)
elig  = [pr for pr in ready if guardrail(pr).ok]   // else GATE-MISSING/STALE-GATE
order = topo_sort(elig, edges=pr_edge(depends_on)) // cycle → CYCLE exit 2
return plan(order, hash=sha16(order))               // printed, NOT executed
```
## 5.4 guardrail(pr)
```
checks = [ao_ready(pr),                          // state from API
          all(gate_pass(pr,g).verdict==pass and g.sha16==pr.head_sha
              for g in [ci_green,audit,hardened,fence2]),
          all(dep merged for dep in pr_edge(pr.depends_on))]
return ok ∧ reasons[]                              // blocked reasons recorded
```
## 5.5 attributeBug(bug) — full algorithm in spec Appendix E
```
cands = git archaeology(flagged files) ∩ merge-window
sess  = adapter.resolve(cands → pr.head_sha | worktree branch)
conf  = score(cands, sess)
if conf < 0.6: bug.status=triage; refuse(ATTR-AMBIGUOUS)
else: assign origin_commit/session/worker(+method+inputs)
```
## 5.6 kick(bug, mode?)
```
sha = sha16(dossier.md + origin.json)
if sha ≠ bug.manifest.sha16: refuse(DOSSIER-TAMPER)
mode = mode ?? (sessionAlive(origin_session) ? 'live' : 'spawn')
live : adapter.steerOrSend(origin_session, FIX_BRIEF(bug)) → outcome=delivered
spawn: adapter.delegateTask(project, brief=FIX_CONTRACT(bug),
                            attachments=[dossier.md, origin.json],
                            agent='omp', approvalMode='bypass-permissions')
direct: branch fix/<bug-id>; JGM commit-cone; pr_node(kind=fix)
kick row opened; outcome watcher = reducer on session/PR events
```
## 5.7 executePlan(planId, {confirm})
```
plan = load(planId); if not confirm: refuse(UNCONFIRMED-PLAN)
for pr in plan.order:
  guardrail(pr) or halt(partial=pr)          // re-eval EVERY step
  adapter.mergePR(pr) → state=merged, merged_at=now
  recompute dependents
```

# §6 TREES

## 6.1 Component tree (new code)
```
JARVIS_WORKSPACE/jarvis-upper/
├── ao-client/            (bun/TS)
│   ├── gen/              openapi-generated bindings (pinned sha)
│   ├── client.ts         AoClient (wrapped routes, retry, errors→tokens)
│   └── rail.ts           EventRail (SSE, cursor, reconnect)
├── src/
│   ├── store.ts          schema + migrations + WAL
│   ├── sync.ts           syncProject/syncAll
│   ├── reducers.ts       event→state (idempotent)
│   ├── plan.ts           orderMerges + executePlan
│   ├── guardrail.ts      eligibility
│   ├── attribute.ts      git archaeology + scoring
│   ├── kick.ts           three rails + dossier law
│   ├── graph.ts          render (DAG + bug overlay)
│   └── cli.ts            upper <verb>
├── desks/                wave prompts A/B/C/D (mission contracts)
├── tests/                §4.3 checks + spec §11 names
└── dossiers/             <bug-id>/ runtime artifacts
```
## 6.2 Dependency tree (what it calls, never forks)
```
jarvis-upper → ao-client → AO :3001 (REST+SSE)
jarvis-upper.desks → JARVIS kernel dispatchDesk (explicit cmd) → foreman → omp
jarvis-upper.gates → fence2 adjudicate (subprocess, exit-code law)
jarvis-upper.fix_direct → JGM commit-cone (cone law, secret scan, trailers)
jarvis-upper.research → deep-research skills + OCM corpus
audit wave → Thanatos E1 (read-only hunt) + reverse-engineer desk
```

# §7 LAWS + INVARIANTS
L1 merge is explicit-only; the control layer ORDERS, never merges unconfirmed.
L2 the engine is deterministic: no LLM/agent imports inside jarvis-upper/src.
L3 REST-first: adapter never writes ao.db; SQLite reads = forensic tools only.
L4 events are hints, API rows are truth; gaps force resync.
L5 every bug edge carries attribution method + inputs; ambiguity → triage.
L6 dossier hash gates every kick (tamper = refuse).
L7 gates are sha-bound; stale gate blocks ordering.
L8 kicks cite origin commits; fix_contract forbids unrelated changes.
L9 append-only ledgers (bug/kick/gate rows never rewritten; corrections = new rows).
L10 fix_direct never touches a factory session's worktree.
Invariants INV-1..12: enumerated in spec SC table; mechanically checked per §4.3.

# §8 ERROR VOCABULARY + SCHEMA + SHELL
Tokens: §4.2 (nine). Persisted schemas: §4.1 + dossier format (spec App D).
Shell contract: `upper <verb>` prints exactly one JSON object (stdout),
human text (stderr), exit 0/1/2 per JGM law. Verbs: init sync plan order
kick bug gates graph cursor.

# §9 BACKWARDS MAP + PROVENANCE
| Mission requirement | Mechanism | Proof token |
|---|---|---|
| wire AO into tool systems | ao-client REST+SSE pinned-openapi | SC1 parity 144 |
| not an orca-terminal attach | no pty dependency anywhere | import-lint |
| assemble v1 ship package | wave-A desk + fence2 gate | SC9 fence2 PASS |
| harden to S-tier | wave-B desks, refusals reopen | gate=hardened rows |
| Thanatos heavier review | wave-C E1 + reverse-engineer desk | SC10 bug recorded |
| deep research pipeline | wave-D research contract | cited report fixture |
| lifecycle controls = graph+comms+paths+guardrails | store+edges+cursor+gates | SC3/SC4/SC5 |
| understand AO git mgmt | discovery §2 + reducer table | 01-DISCOVERY |
| kick bug to origin worker | attribute + kick_live/spawn | SC6/SC7/SC8 |
| bug-graph for root-cause analysis | bug_record edges + graph render | SC12 |
Read stamps: openapi.yaml @main 12,809L · documentation-map.md · agents.md ·
lifecycle-automation + notifiers docs · Thanatos MASTER_PROMPT (v4) · JGM
GATE_RULES_SPEC §0 VERIFIED · OCM MIGRATION_MANIFEST · AO manual/hook-map
(JARVIS_WORKSPACE/reports/) · live ao.db :3001 measurements.

---

# §10 WAVE-DESK CONTRACTS (verbatim desk prompt skeletons — Step 7 expands)

## 10.1 Wave A — ASSEMBLE desk (one per PR-set)
```
/goal
Assemble the v1 ship package for <project> from the minted PR set.

INPUTS (dossier bundle in desk dir):
  pr-set.json      control layer export: pr_node rows + diffs + metadata
  history/         workspace/diffs + file/revision exports per PR
  checks/          pr_checks exports (testing data)
  build-package/   the minted build package (context of intent)

CONTRACT:
  1. Reconstruct intent: read build-package/ specs — what was ordered.
  2. Reconstruct reality: read history/ + checks/ — what was built+proven.
  3. Assemble SHIP_PACKAGES/<project>-v1/: manifest + BUILD_REPORT +
     DEBUG_LOG + TESTING_LOG + FAILURE_LOG + SPEC_VIOLATION_LOG (canon
     formats), full source snapshot (sha16-stamped), git history export.
  4. Prove: fence2 adjudicate on the package manifest (done-when:
     manifest rows sha-match; battery tokens present). done.mk = ASSEMBLED.
FORBIDDEN: editing factory PR content; weakening check data; padding
docs; any secret material in the package.
```

## 10.2 Wave B — HARDEN desks (one per module)
```
/goal
Harden <module> from v1-package grade to S-tier runtime grade. 0 compromises.

CONTRACT:
  1. Battery-first: run the module's tests; record the real tokens.
  2. Harden: error paths, retries, observability, invariants, docs —
     each change cone-committed (JGM law) with wave: harden trailers.
  3. Prove runtime-grade: script-test against OBSERVED effects (not
     mocks); red→green per fix; self-defect rate reported.
  4. done.mk = HARDENED only when fence2 PASS on the module gate.
REFUSALS REOPEN THE DESK. A red at close = foreman ESCALATE (never
lower the bar, never "small exception").
```

## 10.3 Wave C — AUDIT desks (Thanatos E1 + reverse-engineer)
```
/goal
Audit the hardened <project> v1. Two independent passes, one dossier each.

PASS 1 (E1 hunter): 6-phase hunt over the tree; every finding →
  bug_record dossier (symptom/evidence/repro/files:lines). Read-only.
PASS 2 (reverse-engineer): FRESH context. Author spec-from-package
  (what WOULD order this output?); diff vs authored spec; run the
  script-test battery live; divergences → bug_record dossiers.
OUTPUT: bug_records + alignment report (aligned|drifted per spec section).
FORBIDDEN: fixing anything (flag only — kicks are the rails' job);
  reading the authored spec BEFORE authoring the reconstruction.
```

## 10.4 Wave D — RESEARCH desk (librarian)
```
/goal
Research contract for audit findings <bug-ids> / topic <T>.

INPUT: problems X[] (from dossiers/audit), proposed solutions A[] (if any).
CONTRACT: for each X: candidate solutions (with sources); deep research
  1-2-3 per candidate (validate | invalidate | extend with new data);
  verdict matrix; remaining-unknowns; feed-ready citations.
FORBIDDEN: summary-only output (verdicts without evidence); uncited
  claims; solution proposals that mutate code (research only).
```

## 10.5 FIX_CONTRACT (kick brief body — spec App B)
```
BUG <bug-id> — origin commit <sha> (your session, branch <src>).
FILES: <files:lines>   EVIDENCE: <dossier.md path + inline top-3 lines>
EXPECTED: <acceptance[]>
FIX RULES: smallest correct change; no unrelated edits; add/extend the
regression test that would have caught this; report via PR citing
<bug-id> in the title.
DO NOT: touch other modules; amend history; close without the test.
```

# §11 CLI REFERENCE (operator surface; JGM output law)
```
upper init                          schema + cursor boot
upper sync [<project>|--all]        facts pull + reducer convergence
upper plan [<project>]              merge plan (ordered, hash-stamped)
upper order --confirm <plan-id>     execute confirmed plan (explicit)
upper bug [ls|show|triage|resolve]  bug-graph ops
upper kick <bug-id> [--mode live|spawn|direct]   kick rail (default D1)
upper gates [<pr>]                  gate_pass view (sha-bound)
upper graph [--bugs]                DAG render + bug overlay
upper cursor                        rail cursor state
stdout: exactly one JSON object · stderr: human · exit 0/1/2(token)
```

# §12 PROVENANCE REGISTER (read stamps, this package)
openapi.yaml@main (12,809L; 144 routes; streamEvents/delegateTask
schemas extracted) · documentation-map.md@main (contract-layer law) ·
agents.md@site (REST-first law, loopback-only) · lifecycle-automation@
site (no-webhooks verdict) · notifiers/dashboard@site (no external
notifiers) · llms.txt@site · Thanatos/MASTER_PROMPT.md (v4 three-engine)
· Thanatos git HEAD 2860a00 · JGM/GATE_RULES_SPEC.md §0 (VERIFIED
capabilities + 9 refuse tokens + commit-cone law) · OCM/
MIGRATION_MANIFEST.md · AO_OPERATORS_MANUAL.md + AO_Hook_Config_Surface_
Map_ShowMe.md (JARVIS_WORKSPACE/reports/) · live: ao.db projects/
sessions rows, :3001 healthz, import validation (12/12), bypass×3+yolo.
BlueprinT STATUS: v1.0 architecture-complete; §10-11 carry the desk+CLI
contracts; DEPTH GROWS per wave landing (canon law) — battery-green
stamps land in RUNNING_BUILD_LOG as waves execute.
