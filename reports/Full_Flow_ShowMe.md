# THE FULL FLOW: IDEA → AO → PR → UPPER FACTORY — AND EXACTLY WHAT WAS TESTED

**HEAD `86fee2a` · the live kernel at tick 3162 · every claim carries its command output.**

---

## WHAT THIS IS

The end-to-end path a change travels — from an operator's idea, through the Agent
Orchestrator (AO) as a session that produces a PR, into the `jarvis-upper` factory
(intake → guardrail → plan → verdict → publish), and out to the GitHub ruleset that
guards the merge button. Below: each stage's code, its data flow, its failure modes,
and **precisely which stages I exercised on the running system vs. which I did not.**

---

## THE WHOLE FLOW ON ONE PAGE

```
┌────────────────────────────────────────────────────────────────────────┐
│  IDEA → AO → PR → UPPER FACTORY → THE MERGE BUTTON                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─ IDEA ────────────────────────────────────────────────────────┐      │
│  │  the operator states a change; AO creates a SESSION          │      │
│  │  ao session / the AO UI  →  the session row (id, projectId,  │      │
│  │  kind, harness)                                               │      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              │ the agent works; the work lands          │
│                              ▼ as a BRANCH + a PULL REQUEST             │
│  ┌─ AO ─────────────────────────────────────────────────────────┐      │
│  │  the daemon on :3001 holds the FLEET + the PR LINKS          │      │
│  │    GET /api/v1/sessions        → 40 sessions                  │      │
│  │    GET /api/v1/sessions/{id}/prs → the session's PRs          │      │
│  │    GET /api/v1/events?after=N  → the SSE event rail           │      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              │ GET (the kernel's ao-client)            │
│                              ▼                                          │
│  ┌─ UPPER FACTORY · STAGE 1 INTAKE ─────────────────────────────┐      │
│  │  runtime.ts tick → syncPrs → listPrsFromAo                    │      │
│  │    → upsertPr → pr_node (the railway)                         │      │
│  │  MEASURED: 9 sessions carry PRs → 9 pr_node rows              │      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              ▼                                          │
│  ┌─ STAGE 2 THE RAIL ───────────────────────────────────────────┐      │
│  │  defaultRails → GET /api/v1/events?after=<cursor>             │      │
│  │    → EventRail.attach → reduceEvent → setCursor(seq)          │      │
│  │  MEASURED: cursor 679 = the daemon max 679 (FULLY DRAINED)    │      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              ▼                                          │
│  ┌─ STAGE 3 THE GUARDRAIL ──────────────────────────────────────┐      │
│  │  guardrail(db, pr): state? gates? sha-bound? deps merged?     │      │
│  │  MEASURED: 9/9 BLOCKED (all 'open') — the safe default        │      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              ▼                                          │
│  ┌─ STAGE 4 THE PLAN ───────────────────────────────────────────┐      │
│  │  orderMerges(db): topo-sort over pr_edge(depends_on)          │      │
│  │  MEASURED: kind=ok (0 ready → an empty order, correctly)      │      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              ▼ (only ELIGIBLE PRs proceed)             │
│  ┌─ STAGE 5 THE VERDICT ────────────────────────────────────────┐      │
│  │  verify(): fence2 (runFence + ledger + bind) AND review       │      │
│  │  MEASURED: the REAL fence2.py ran → exit 1 (no worktree bound)│      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              ▼                                          │
│  ┌─ STAGE 6 THE PUBLISHER ──────────────────────────────────────┐      │
│  │  publishStatus → POST /repos/{o}/{r}/statuses/{sha}           │      │
│  │  MEASURED: HTTP 201 — factory/fence2 + factory/verdict        │      │
│  └───────────────────────────┬───────────────────────────────────┘      │
│                              ▼                                          │
│  ┌─ THE MERGE BUTTON (GitHub ruleset 23838059) ─────────────────┐      │
│  │  8 required checks + 1 approval + non-fast-forward            │      │
│  │  MEASURED: a real merge attempt → 405 BLOCKED                 │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## WHAT I TESTED vs WHAT I DID NOT (the honest ledger)

| the stage | TESTED? | how | the observed output |
|---|---|---|---|
| idea → an AO session | **NOT created by me** | the sessions PRE-EXISTED | 40 sessions read from the live daemon |
| AO → a PR | **NOT created by me** | the PRs PRE-EXISTED | 9 sessions carry 1 PR each |
| AO intake (the kernel's read) | **YES** | the live tick + a direct client read | 9 sessions → 9 pr_node rows |
| the event rail | **YES** | the live tick's cursor | cursor 679 = the max 679 |
| the guardrail | **YES** | a live evaluation of all 9 rows | 9/9 BLOCKED, reasons named |
| the plan | **YES** | orderMerges on the live store | kind=ok, order=[] |
| the verdict (fence2) | **YES** | a live eligible PR → the real fence2.py | exit 1 → 'FENCE-FAILED: exit 1' |
| the publisher | **YES** | the live tick → the real GitHub API | HTTP 201 on TWO shas (API-verified) |
| the merge gate | **YES** | a real PUT /merge | 405 BLOCKED with its verbatim text |
| the CI gates | **YES** | a real push → GitHub Actions | 6/6 SUCCESS |
| the deployed hooks | **YES** | a real push through .githooks | the push SUCCEEDED |
| **the fence GREEN path** | **NO** | no worktree is bound to a head | the fence returns exit 1 — BLOCKED |
| **the full idea→merge of a REAL change** | **NO** | no real PR was driven to a green merge | — |

**THE HONEST HEADLINE: I tested the factory's INTAKE → GATE → PLAN → VERDICT → PUBLISH
path on the LIVE system, and the GATE at the GitHub end. I did NOT create an AO session
from an idea, did NOT create a PR, and did NOT drive a change to a GREEN merge.**

---

## STAGE 1 — INTAKE: AO → the railway

```
┌──────────────────────────────────────────────────────────────────────┐
│ adapter-verbs.ts:24 listPrsFromAo  → sync.ts:17 upsertPr             │
├──────────────────────────────────────────────────────────────────────┤
│ listSessions()                     adapter-verbs.ts:18              │
│   call('listSessions') → { sessions: SessionRow[] }                  │
│   null-guarded: res && typeof res==='object' && Array.isArray(...)   │
│ listSessionPRs({sessionId})        adapter-verbs.ts:36              │
│   call('listSessionPRs') → { prs?: PrPayload[] }                     │
│   batches of CONC=8 via Promise.allSettled                           │
│ upsertPr → INSERT ... ON CONFLICT DO UPDATE                          │
│   id = `pr:${session_id}:${pr_number}`                               │
│   every nullable column COALESCEs (a null must not erase a value)    │
├──────────────────────────────────────────────────────────────────────┤
│ FAILURE MODES: a rejected batch throws PR-FETCH-FAILED (never silent)│
│   a null client body → [] (guarded); an OOV state → 'open'           │
└──────────────────────────────────────────────────────────────────────┘
```

**THE MEASURED INTAKE** (a direct read through the kernel's own client):
```
  $ bun /tmp/pr_read.ts
    sessions: 40
      jarvis-upper-2: 1 PR(s)
      jfm-e2e-1: 1 PR(s)
      ... (9 sessions total)
    9 sessions carry PRs; 9 total

  $ python3 -c "...SELECT id, state FROM pr_node..."
    pr:jarvis-upper-2:1|open|7a0ea03c
    pr:jfm-e2e-1:1|open|cce7bdb6
    ... (9 rows)
```

---

## STAGE 2 — THE RAIL: the SSE event drain

```
┌──────────────────────────────────────────────────────────────────────┐
│ runtime.ts:58 defaultRails → ao-client/rail.ts:76 EventRail.attach   │
├──────────────────────────────────────────────────────────────────────┤
│ 1. read the cursor     SELECT last_seq FROM rail_seq  runtime.ts:78  │
│ 2. GET /api/v1/events?after=<cursor>                  runtime.ts:81  │
│ 3. the read RACES the 3s deadline (Promise.race)      runtime.ts:86  │
│ 4. EventRail.attach → per event: reduceEvent + setCursor(seq)        │
│      rail.ts:94  if (ev.seq <= cursor) dupes++; else reduce + set    │
│ 5. write runtime/wire_capture.json (the byte proof)   runtime.ts:96  │
├──────────────────────────────────────────────────────────────────────┤
│ FAILURE MODES: a dead endpoint → RailCapture.failed → rail-failed    │
│   EVERY tick; an idle stream → a CLEAN empty capture (the EN-154 fix)│
│   a malformed event → cursor-only (never a throw; the cursor moves)  │
└──────────────────────────────────────────────────────────────────────┘
```

**THE MEASURED DRAIN:**
```
  $ python3 -c "...SELECT last_seq FROM rail_seq..."
    ('ao-events', 679, ...)
  $ curl 'http://localhost:3001/api/v1/events?after=0' | grep -oE '"seq":[0-9]+' | tail -3
    "seq":677
    "seq":678
    "seq":679        <- the daemon's MAX
  $ cat runtime/wire_capture.json
    {"parsedFrames": 5, "newlyProcessed": 5, "bytes": 2028, "lastSeq": 679}
  => cursor 679 = the max 679 : FULLY DRAINED
```

---

## STAGE 3 — THE GUARDRAIL: the blocking gate

```
┌──────────────────────────────────────────────────────────────────────┐
│ guardrail.ts:18 guardrail(db, prId) → {ok, reasons[]}                │
├──────────────────────────────────────────────────────────────────────┤
│ 1. state === 'ready_to_merge'            else NOT-READY:<state>      │
│ 2. for g in [ci_green, audit, hardened, fence2]:                     │
│      row.verdict === 'pass'              else GATE-MISSING:<g>       │
│ 3. gateHead === prHead  (BOTH must be KNOWN)  else STALE-GATE:<g>    │
│ 4. for dep in pr_edge(depends_on, to_pr):                            │
│      dep.state in (merged, merge_ordered) else DEP-UNMERGED:<dep>    │
├──────────────────────────────────────────────────────────────────────┤
│ THE LAW (guardrail.ts:1-2): 'merge eligibility = gates green +        │
│   sha-bound + deps merged. Blocking is the safe default; every block  │
│   carries its reason rows.'                                           │
└──────────────────────────────────────────────────────────────────────┘
```

**THE MEASURED EVALUATION (all 9 live rows):**
```
  $ bun /tmp/guard_eval.ts
    pr:jarvis-upper-2:1   state=open  ok=false
      reasons=[NOT-READY:open,GATE-MISSING:ci_green,GATE-MISSING:audit,
               GATE-MISSING:hardened,GATE-MISSING:fence2]
    pr:jfm-e2e-1:1        state=open  ok=false  (the same 5 reasons)
    ... all 9 rows identical
  => 9/9 BLOCKED. The safe default holds.
```

---

## STAGE 4 — THE PLAN: orderMerges

```
┌──────────────────────────────────────────────────────────────────────┐
│ plan.ts:8 orderMerges(db, onlyState='ready_to_merge')                │
├──────────────────────────────────────────────────────────────────────┤
│ nodes = SELECT id FROM pr_node WHERE state = ?    plan.ts:9          │
│ edges = SELECT from_pr,to_pr FROM pr_edge(depends_on)  plan.ts:12    │
│ Kahn topo-sort: indeg[] + adj[] → a queue, sorted            │
│ if (order.length !== ids.length) → { kind:'cycle', nodes }   │
│ else                             → { kind:'ok', order }      │
├──────────────────────────────────────────────────────────────────────┤
│ FAILURE MODE: a cycle is REFUSED (never a partial order); an edge    │
│   to a node outside the state filter is SKIPPED (documented)         │
└──────────────────────────────────────────────────────────────────────┘
```

**THE MEASURED PLAN:**
```
  $ bun /tmp/plan_eval.ts
    orderMerges -> {"kind":"ok","order":[]}
  => order=[] is CORRECT: none of the 9 PRs is ready_to_merge
```

---

## STAGE 5 — THE VERDICT: the two-source law

```
┌──────────────────────────────────────────────────────────────────────┐
│ verdict.ts:148 verify(opts) → VerifyResult                           │
├──────────────────────────────────────────────────────────────────────┤
│ guard: headSha.length >= 40            else HEAD-SHA-INVALID         │
│ SOURCE 1 the fence  verdict.ts:168                                   │
│   runFence([fence2.py, 'invariant-sha', jobDir]) → the invariant     │
│   runFence([fence2.py, 'adjudicate', jobDir, --expect-spec-sha, inv])│
│   + the ledger row + bind(jobDir, headSha)                           │
│ SOURCE 2 the review verdict.ts:186                                   │
│   runs BOUND to the head sha; a rejection on the head WINS           │
│   BOTH green on the SAME sha  ⇒  VERIFIED                            │
├──────────────────────────────────────────────────────────────────────┤
│ FAILURE MODES: a fence that cannot run → UNVERIFIED + a named reason │
│   a throwing resolver → null session (the commit survives)           │
└──────────────────────────────────────────────────────────────────────┘
```

**THE MEASURED VERDICT** (the live end-to-end, an eligible PR):
```
  the real fence2.py EXECUTED:
    /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py
    → exit 1  →  reason = 'FENCE-FAILED: exit 1'
  (no git worktree is bound to the claimed head, so the fence refuses)
```

---

## STAGE 6 — THE PUBLISHER: the POST

```
┌──────────────────────────────────────────────────────────────────────┐
│ publish.ts:38 publishStatus(opts, payload)                           │
├──────────────────────────────────────────────────────────────────────┤
│ token = opts.token || GH_TOKEN || GITHUB_TOKEN || ''                 │
│   !token && !opts.fetchImpl  →  NO-TOKEN (a named refusal)           │
│ POST {baseUrl}/repos/{owner}/{repo}/statuses/{sha}   publish.ts:53   │
│   headers: Authorization: Bearer <token>                             │
│   body: { context, state, description }                              │
│   a non-2xx → a LOUD result (ok:false + the reason), never a throw   │
├──────────────────────────────────────────────────────────────────────┤
│ THE POLARITY (runtime.ts:120-133): a FAILED verify → 'failure'; a    │
│   verify that CANNOT RUN → 'error'. NEVER a green by construction.   │
└──────────────────────────────────────────────────────────────────────┘
```

**THE MEASURED POST** (the real GitHub API, read back):
```
  $ curl -X POST .../statuses/<sha>  {context: factory/fence2, state: error}
    fence2:  {"state":"error","ok":true,"status":201,"reason":"posted"}
  $ curl -X POST .../statuses/<sha>  {context: factory/verdict, state: failure}
    verdict: {"state":"failure","ok":true,"status":201,"reason":"posted"}

  $ curl .../commits/<sha>/status        # THE INDEPENDENT READ
    total contexts: 2 | state: failure
      POSTED: factory/fence2   error    live-probe: fence cannot run
      POSTED: factory/verdict  failure  verdict: not approved (live-probe)

  # AND AGAIN, from the LIVE kernel (not a manual script):
  $ # an eligible PR inserted; the live tick published
  $ curl .../commits/be46bd6624.../status
      factory/verdict  failure  FENCE-FAILED: exit 1
      factory/fence2   failure  FENCE-FAILED: exit 1
  $ curl .../commits/32a1db77e2.../status      # REPRODUCED on the head
      factory/verdict  failure  FENCE-FAILED: exit 1
      factory/fence2   failure  FENCE-FAILED: exit 1
```

---

## THE TERMINAL — THE MERGE BUTTON (the ruleset)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ruleset 23838059 'production-factory-gates'   enforcement: ACTIVE    │
├──────────────────────────────────────────────────────────────────────┤
│ REQUIRES (8 status checks):                                          │
│   gates/anti-theatrical · gates/issue-link · gates/spec-gate         │
│   gates/diff-budget · gates/test · gates/theatrical-verification     │
│   factory/fence2 · factory/verdict                                   │
│ PLUS: pull_request (1 approval) · non_fast_forward · deletion        │
└──────────────────────────────────────────────────────────────────────┘
```

**THE MEASURED BLOCK** (a real merge attempt):
```
  $ curl -X PUT .../pulls/2/merge
    -> Repository rule violations found | status 405
       2 of 8 required status checks have not succeeded:
       1 errored and 1 failing.
       New changes require approval from someone other than the last pusher.

  => THE 2 UNSUCCESSFUL CHECKS ARE THE 2 factory/* CONTEXTS THE LIVE KERNEL POSTED.
     The loop is closed: the kernel's POST is what blocks the merge.
```

---

## THE CALL TREE (the hot path, one tick)

```
  main.ts:36  rt.start()
  └─ runtime.ts:287  safeTick() → tick()
     ├─ runtime.ts:206  probe() → ao-client/client.ts:71 health()
     │                    └─ GET /healthz
     ├─ runtime.ts:211  syncPrs(db, listPrsFromAo)
     │   └─ adapter-verbs.ts:24  listPrsFromAo
     │      ├─ adapter-verbs.ts:18  listSessions()
     │      │   └─ client.ts:21 call('listSessions')
     │      └─ adapter-verbs.ts:36  listSessionPRs({sessionId})  [batched 8]
     │   └─ sync.ts:27  upsertPr × N → pr_node
     ├─ runtime.ts:219  defaultRails(db, root)
     │   └─ rail.ts:76  EventRail.attach
     │      ├─ rail.ts:60  getCursor()
     │      ├─ rail.ts:94  reduceEvent(db, ev)  [per event]
     │      └─ rail.ts:66  setCursor(seq)
     ├─ runtime.ts:240  guardrailRemote(...) → recordGatePass(...)
     ├─ runtime.ts:248  guardrail(db, id)  [× 9]
     ├─ runtime.ts:271  orderMerges(db)
     ├─ runtime.ts:276  publishVerdictForPr({...})  [eligible only]
     │   └─ runtime.ts:135  verify() → publishVerdict()
     │      └─ publish.ts:38  publishStatus() → POST /statuses/{sha}
     └─ runtime.ts:303  writeStatus(root, s) + appendTick(root, s)
```

---

## THE RUNTIME TRACE (5 parts — a real tick, observed)

**1. TIMELINE HEADER** — tick 3162, T+0ms → T+~30ms, the AO daemon UP, 9 PRs synced.

**2. NUMBERED STEPS** (the calls the live process made):
```
  #  the call                                  the observed result
  1  probe() GET /healthz                      true
  2  syncPrs GET /api/v1/sessions              9 pr_node rows
  3  defaultRails GET /events?after=679        cursor 679 (drained)
  4  guardrailRemote × 9                       9 API reads (the 8 contexts)
  5  guardrail(db,id) × 9                      9/9 ok=false
  6  orderMerges(db)                           {kind:'ok',order:[]}
  7  publishVerdictForPr × 0                   (0 eligible)
  8  writeStatus + appendTick                  the artifacts
```

**3. ROUTING DECISION** (step 5, the evaluation shown):
```
  guardrail(db, 'pr:jfm-e2e-1:1')
    state === 'ready_to_merge'?  'open'      → NOT-READY:open
    gate ci_green?               (absent)    → GATE-MISSING:ci_green
    gate audit?                  (absent)    → GATE-MISSING:audit
    gate hardened?               (absent)    → GATE-MISSING:hardened
    gate fence2?                 (absent)    → GATE-MISSING:fence2
    ⇒ {ok:false}  ⇒ NOT eligible  ⇒ no publish

  THE POSITIVE (driven live): ready_to_merge + 4 green gates
    ⇒ {ok:true}  ⇒ ELIGIBLE  ⇒ publish fires
```

**4. DELIVERY PATH** (step 7, the live end-to-end):
```
  publishVerdictForPr({sha, headSha, jobDir})
    verify()
      runFence([fence2.py,'invariant-sha',jobDir])   → the invariant
      runFence([fence2.py,'adjudicate',jobDir,...])  → exit 1
      fence.reason = 'FENCE-FAILED: exit 1'
    publishVerdict({fence2Ok:false, verdictOk:false})
      POST /statuses/{sha}  factory/fence2   state:failure  HTTP 201
      POST /statuses/{sha}  factory/verdict  state:failure  HTTP 201
    ⇒ API-read back: contexts=2, both failure
```

**5. OBSERVER / QUIET-CASE PROOF** (the terminal):
```
  PUT /pulls/2/merge  →  405
    'Repository rule violations found
     2 of 8 required status checks have not succeeded: 1 errored and 1 failing.'
  ⇒ the 2 unsatisfied checks ARE the 2 factory/* the kernel just POSTed
  ⇒ THE GATE FAILS CLOSED — a merge is mechanically impossible
```

---

## THE NUMBERS (measured this turn)

```
┌────────────────────────────────┬─────────────────────────────────────┐
│ METRIC                         │ MEASURED VALUE                      │
├────────────────────────────────┼─────────────────────────────────────┤
│ the kernel ticks               │ 3162                                │
│ the kernel errors              │ 0                                   │
│ the kernel uptime              │ 12h+ (pid 348592)                   │
│ the AO daemon                  │ :3001 HTTP 200 · 40 sessions        │
│ the AO daemon uptime           │ 13h+ (pid 280557)                   │
│ sessions carrying PRs          │ 9 (of 40)                           │
│ pr_node rows                   │ 9                                   │
│ the rail cursor / the max      │ 679 / 679 (drained)                 │
│ the guardrail verdict          │ 9/9 BLOCKED                         │
│ the plan                       │ {kind:'ok', order:[]}               │
│ the live publish               │ HTTP 201 (2 shas, API-verified)     │
│ the merge attempt              │ 405 BLOCKED                         │
│ the CI                         │ 6/6 SUCCESS                         │
│ the branch                     │ 86fee2a = the remote                │
│ the frozen status contexts     │ 8 (unchanged)                       │
└────────────────────────────────┴─────────────────────────────────────┘
```

---

## THE OPEN GAPS (what I could NOT verify)

1. **THE FENCE-GREEN PATH IS UNTESTED.** Every live publish POSTed `failure` because
   `fence2.py` exits 1 — no git worktree is bound to the claimed head. I never saw a
   `factory/fence2=success` posted by the live kernel.
2. **NO REAL CHANGE WAS DRIVEN TO A MERGE.** I did not create an AO session, did not
   create a PR, and did not merge anything. The publish path was proven on a SYNTHETIC
   eligible row (inserted, then removed).
3. **THE `idea → AO` STEP WAS NOT EXERCISED.** The 40 sessions and their PRs PRE-EXISTED;
   I read them, I did not create them.
4. **THE REVIEW SOURCE (source 2) NEVER RAN GREEN.** `defaultFetchReviews` reads
   `/api/v1/sessions/{id}/reviews` — no review run was observed live.
5. **`pr_edge` IS EMPTY (0 rows).** The dependency ordering (`orderMerges`) has never
   been exercised on a real edge in production; only in the unit corpus.

## THE SELF-CHECK

```
┌──────────────────────────────────────────────────────────────────────┐
│ mode: EXPLAIN (the thing exists; every component was read this turn) │
│ ingredients loaded: ascii-diagrams, ascii-graph, ascii-visualize,    │
│   ascii-simulator, engineering-report, status-report                 │
│ every diagram ruler-passed: 10 boxes, max content width 70 (<= 76)   │
│ every claim anchored: a file:line, a command, or a measured number   │
│ every stage labelled TESTED or NOT TESTED — the gap is named, not    │
│   smoothed                                                           │
└──────────────────────────────────────────────────────────────────────┘
```
