# JFM — JARVIS FACTORY MANAGER — BLUEPRINT v1
## The desk manager for the AO substrate
Written 2026-09-20 · blueprinting session (M1-M16) · all anchors read this session.

# §0 THE FIRST-PRINCIPLES CORE

## M3 — THE REDUCTION (the one mechanism)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ JAM = DESK SEMANTICS over a 10-VERB TRANSPORT SEAM.                       │
│                                                                          │
│   desk semantics  : contract render → tracker row → two-signal watch →    │
│                     completion gate → wave verbs                          │
│   the seam        : spawnTile · promptPane · submitPaneText · readPane ·   │
│                     killPane · listPanes · createDeskTab · listTabs ·     │
│                     closeDeskTab · copilotKey        (desk-orchestrator   │
│                     .ts:53-78, `DeskTransport`)                           │
│                                                                          │
│   transport #1 = ORCA  (src/orca-desk-transport.ts, 570L, LIVE)           │
│   transport #2 = CAO   (src/kernel/cao-transport.ts, FROZEN legacy)       │
│   transport #3 = AO    ← DOES NOT EXIST                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

**The reduction's test** (it must explain instances the operator never mentioned):
it explains why `dispatchDesk` ALREADY takes `transport?: DeskTransport`,
`cmd?: string`, `model?: string`, `stallMs?: number`, `nudgeMax?: number`
(`desk-orchestrator.ts:257-300`) — the kernel was *built* to be re-substrated.
It also explains why the old Python ancestor (`MIMOCODE/Jarvis/factory/
jarvis_supervisor.py`, 35KB) died: it hard-coded ONE substrate (tmux/CAO) instead
of a seam, so every substrate change was a rewrite.

## M4 — THE DERIVED LAWS

```
L1  SUBSTRATE = A TRANSPORT.        Nothing above the seam may know what AO is.
L2  THE DESK IS THE UNIT.           The AO session is its ADDRESS, not its identity.
L3  COMPLETION IS OBSERVED.         AO gives PR/CI state; the pane tail is a FALLBACK.
L4  THE PIN RIDES THE DISPATCH.     profile + repo overlay + project env — never a
                                    desk-local .omp/config.yml (EN-019 proved it invisible
                                    to foreman children).
L5  ONE VOCABULARY.                 dispatch · steer · watch · status · abort · wave ·
                                    pr · merge — the same words on every substrate.
```

## M5 — THE INVERSION (the design does not ask anyone to "use AO carefully")

```
BAD:  "when driving the factory, remember to check the kanban and the PRs"
GOOD: "JFM's watch verb returns a verdict derived from the AO session row + its PR
       row + its worktree; a human reading one line sees the state."
```
Every instrument below (the tracker row, the session row, the PR row, the worktree,
the transcript, the tick log) produces the state as OUTPUT; nobody has to remember.

---

# §1 WHY NOTHING EXISTING SOLVES THIS (the differential)

| existing thing | what it does | what it does NOT do |
|---|---|---|
| **JAM kernel** (`JARVIS/src`, 4404L, 25 test files) | desk contracts, tracker (`desks` table, 14 cols), two-signal watch, completion gate, 14 wave verbs | know anything about AO; reach AO's PR/CI signals |
| **orca-desk-transport** (570L) | the live transport: spawnTile/prompt/read/kill/tabs/copilotKey over `orca-ide` | speak HTTP; know sessions, PRs, or the kanban |
| **kernel/cao-transport** (frozen) | the dead substrate's argv builders | run (CAO is retired) |
| **`ao` CLI** | sessions (spawn/send/steer/kill/restore), projects, agents, imports | a DESK concept; a tracker; waves; gates; a completion verdict |
| **AO REST/SSE** (144 paths) | everything substrate-level, incl. `pr/claim`, `reviews/*`, `prs/{id}/merge` | a desk vocabulary; a wave; a verdict |
| **upper tier** (`jarvis-upper`) | the adapter, the runtime loop, the railway store, 9 verbs (`upper status/plan/order/graph/gates/sync/bug/desks/kick`), the gates | SPAWN a desk; render a contract; track a wave; watch a seat |
| **`jarvis_*` extension tools** (13: dispatch/steer/watch/status/abort/pause/resume/fleet/killwave/reconcile/copilotkey/alerts/attach) | the intended model-facing surface | REACH the model on omp 18.1.15 (EN-018 — deferred) |
| **`jarvis-factory`** (`~/.local/bin`, 6 lines) | launches the AO dashboard | anything else — it is a launcher, not a manager (NAME COLLISION) |
| **old `jarvis-ctl` + `MIMOCODE/Jarvis/factory/`** | the pre-JAM Python factory (jarvis_ctl.py 171L, jarvis_supervisor.py 35KB, FACTORY.md 9KB) | run: `jarvis-ctl --help` → `unknown command: --help` (broken, stale paths) |

**The gap, named precisely:** there is a desk manager for Orca terminals and
none for AO sessions; the AO surfaces are fragmented across three CLIs
(`ao`, `upper`, the launcher) with no shared vocabulary; and the completion
signal available on AO (PR + CI + reviews) is **richer than JAM's pane-tail
scrape and is not being used**.

---

# §2 THE MACRO PATTERN (the loop + the stop)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ JFM LOOP                                                                     │
│                                                                              │
│  1 DISPATCH   jfm dispatch --wave W --desk D --job <contract>                │
│       ├ render the desk contract (JAM's contract shape, unchanged)           │
│       ├ resolve the PIN (profile + overlay + project env)                    │
│       ├ POST /api/v1/sessions {projectId, kind:worker, harness:omp,          │
│       │    mode:tui, prompt, displayName:D}  → session id                    │
│       └ INSERT the tracker row (desk, wave, session_id, branch, state)       │
│  2 WATCH      jfm watch --desk D                                             │
│       ├ AO SIGNALS (primary): the session row (activity), its worktree       │
│       │    (`git log`, `git status`), its PR row, CI/review state            │
│       ├ JAM SIGNALS (fallback): stall (60s silence), nudge (≤3), deadline 45m│
│       └ returns VERDICT: WORKING | STALLED | COMPLETE | FAILED | AWAITING-PR │
│  3 GATE       jfm gate --desk D                                              │
│       ├ the job's done-when (the contract's fence) → fence2 adjudicate       │
│       ├ the PR row (claim/state) if the job minted one                       │
│       └ VERDICT: PASS | HOLD | FAILED  (JAM's completion-gate vocabulary)    │
│  4 STEER      jfm steer --desk D --text "..."    → steer-or-send            │
│  5 ABORT      jfm abort --desk D                 → kill + tracker tombstone  │
│  6 WAVE       jfm wave --wave W [--status|--kill]  (the aggregate view)      │
│  7 PR         jfm pr --desk D [--claim|--merge]   (merge = OPERATOR ONLY)    │
│                                                                              │
│  STOP CONDITION (measured, never felt): a wave closes when every desk row    │
│  is terminal (COMPLETE | FAILED | ABORTED) AND every COMPLETE desk carries a │
│  gate verdict from a tool result. A desk with no verdict is not done.        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# §3 THE UNIVERSAL GENERATOR (for any substrate)

| # | question | what it yields |
|---|---|---|
| 1 | what are the substrate's spawn/steer/read/kill primitives? | the transport's 10 verbs |
| 2 | what is a "seat" there? | the addressable unit (Orca pane / AO session) |
| 3 | what proves a seat is ALIVE? | a signal the substrate emits (pane census / session activity) |
| 4 | what proves the WORK happened? | the substrate's durable artifact (the pane's tail / the worktree + PR) |
| 5 | what proves it is DONE? | the strongest available verdict (a pane marker / a PR state + a fence) |
| 6 | what can the operator type to see all of it? | the CLI verb set (§2) |
| 7 | where does the substrate's config belong? | in the dispatch path (env/pin), never in a desk-local file |

**The composition rule:** every JFM verb must be expressible as
`<JAM verb> × <AO primitive>` — if a verb needs a NEW concept, it is either an AO
native (PR, merge) or it belongs in the upper tier, not here.

---

# §4 THE DOMAIN PLAYBOOKS (uniform template: operator words → generator → ladder → closure → residual → handoffs)

## P-A — "FIRE A JOB AT THE FACTORY"
> operator, verbatim: *"it can accurately fire off jobs to this factory that
> actually get built to a production grade pr autonomously reliably 0 slop"*

- **Generator:** what is the job's contract, its done-when, its repo, its pin?
- **Ladder:** (1) `jobs/<id>/SPEC.md` with `artifact:` + a `done-when` fence; (2) the
  repo has a CLEAN remote (a PR must be mintable); (3) the pin is resolved
  (`OMP_PROFILE` on the project, roles in the overlay); (4) dispatch → session id +
  worktree + branch `ao/<id>/root`; (5) watch → the worktree gains commits; (6) PR row.
- **Closure test:** the desk row is COMPLETE **and** the job's done-when exits 0 **and**
  the PR row exists — three artifacts, or it is not closed.
- **Residual shape:** jobs whose acceptance is subjective (taste, prose quality) —
  the fence cannot judge them; they need a reviewer desk.
- **Handoffs:** the upper tier gates the merge; AO owns the PR; the operator owns merge.

## P-B — "STEER / OBSERVE WHILE IT RUNS"
> operator, verbatim: *"manageable/steerable through orca and jarvis"*

- **Generator:** is the session chat or tui? which surface can inject text?
- **Ladder:** tui → the PANE (Orca) or `steer-or-send`; chat → `steer-or-send`;
  observation → the transcript (`~/.omp/agent/sessions/<flattened-cwd>/<uuid>.jsonl`)
  + the AO session row + the worktree.
- **Closure test:** the steer is OBSERVED to land (the session's activity flips, or the
  transcript shows the message) — a delivery receipt is not a landing.
- **Residual:** a headed TUI owns its stdin; steering can be refused (AO's adapter
  passes no steer channel) — the pane is the reliable surface.
- **Handoffs:** Orca for pane injection; JFM for the desk-level verbs.

## P-C — "AUDIT THE BOARD"
> operator, verbatim: *"i can visibly verify and audit when i look in the AO kanban"*

- **Generator:** which signals are the operator's ground truth?
- **Ladder:** the kanban card ↔ the session row ↔ the worktree ↔ the branch ↔ the
  commits ↔ the PR row ↔ the gate verdict. Every arrow is checkable.
- **Closure test:** the audit's line count equals the desk count; every COMPLETE desk
  has a verdict; every verdict has a tool result.
- **Residual:** AO's kanban shows sessions, not desks — the mapping table is JFM's job.
- **Handoffs:** the upper tier renders the railway graph; JFM renders the desk table.

## P-D — "KICK A BUG DOWN TO THE WORKER THAT CAUSED IT"
> operator, verbatim: *"kick a bug down to the factory directly to the worker that caused it"*

- **Generator:** which commit introduced it; which session owned that commit; is that
  session alive?
- **Ladder:** the upper tier's `attribute` gives commit → session → worker + confidence;
  alive → `steer-or-send` a dossier; dead → `delegate` a fresh worker citing the commit.
- **Closure test:** the kick row records the mode + the target + the dossier hash; the
  resulting commit is on the same branch lineage.
- **Residual:** confidence < 0.6 → triage (a human rules), never a wrong kick.
- **Handoffs:** the upper tier owns attribution; JFM owns the delivery verb.

---

# §5 THE ENFORCEMENT LAWS

| # | law | forbidden behaviour | mechanical consequence |
|---|---|---|---|
| JL-1 | **SEAM PURITY** | putting an AO call above the transport | `grep -n "3001\|api/v1" jfm/*.ts` outside `ao-transport.ts` → RED |
| JL-2 | **NO SECOND TRACKER** | JFM inventing its own state store | the tracker is JAM's `.omp-waves/tracker.sqlite`; a second DB file → RED |
| JL-3 | **VERDICT OR NOTHING** | closing a desk without a gate verdict | the wave cannot close: `jfm wave --status` prints the unverdict'ed desks |
| JL-4 | **MERGE IS THE OPERATOR'S** | any auto-merge path | `prs/{id}/merge` appears only behind `--confirm` in `jfm pr --merge` |
| JL-5 | **PIN VIA DISPATCH** | a desk-local `.omp/config.yml` model pin | the dispatch sets project env + overlay; a desk-local pin → RED (EN-019) |
| JL-6 | **NO CREDENTIAL IN FLIGHT** | a key in argv, a file, a row, or a prompt | spawn bodies carry no key; the profile owns auth |
| JL-7 | **FALLBACK LOUD** | silently substituting a model | the fallback chain is declared (`retry.fallbackChains`); a substitution is logged |

---

# §6 THE FALSIFICATION INSTRUMENTS

```
┌──────────────────────────────────────────────────────────────────────────┐
│ INST-1  THE SESSION ROW   GET /api/v1/sessions/<id>                      │
│   answers: does the seat exist, and is it alive?                          │
│   ran: jarvis-upper-2 | worker | omp | tui | activity=active              │
├──────────────────────────────────────────────────────────────────────────┤
│ INST-2  THE WORKTREE      ~/.ao/data/worktrees/<project>/<id>            │
│   answers: did anything land?                                             │
│   ran: branch ao/jarvis-upper-1/root · commit 50e19a1 · M gates/…         │
├──────────────────────────────────────────────────────────────────────────┤
│ INST-3  THE TRANSCRIPT    ~/.omp/agent/sessions/<flat-cwd>/<uuid>.jsonl  │
│   answers: what is the worker DOING? (the live reasoning + tool calls)     │
│   ran: read SPEC → bash shape_freeze → 175KB and growing                  │
├──────────────────────────────────────────────────────────────────────────┤
│ INST-4  THE PR ROW        GET /sessions/<id>/pr  +  the upper tier sync   │
│   answers: did the work become an artifact the world can see?              │
│   ran: prNodes=0 today (no PR yet — the thing P-A exists to close)        │
├──────────────────────────────────────────────────────────────────────────┤
│ INST-5  THE GATE          the job's done-when → fence2 adjudicate         │
│   answers: is it DONE (bytes) rather than finished (words)?                │
│   ran: fence2 ledger 102 PASS rows; the DT-shapes fence still red          │
├──────────────────────────────────────────────────────────────────────────┤
│ INST-6  THE TICK LOG      jarvis-upper/runtime/ticks.log                  │
│   answers: is the OBSERVER alive while the factory works?                  │
│   ran: 1337 rows, status RUNNING, cursor 336                              │
└──────────────────────────────────────────────────────────────────────────┘
```
**Selection rule:** seat questions → INST-1 · work questions → INST-2/3 · artifact
questions → INST-4/5 · observer questions → INST-6. **No claim without one of them.**

---

# §7 THE ARTIFACT (what JFM writes, and the closure math)

**The tracker row (JAM's `desks` table, extended by 3 AO columns):**
```
desk · wave · pane_id→session_id · workspace · state · steers · yield_preview ·
started_at · completed_at · paused_at · go_key_idx · foreman_pid · omp_pid
  + ao_project · ao_branch · ao_pr_url          ← the three JFM additions
```
**The CLI output contract:** every verb prints ONE JSON object on stdout,
human text on stderr, exit `0` ok / `1` negative verdict / `2` refused
(the `upper` contract, already proven).

**The verdict line (`jfm wave --status`):**
```
WAVE W: 4 desks · 2 COMPLETE (2 verdicted) · 1 WORKING · 1 AWAITING-PR · 0 FAILED
  D1 dt-shapes-fix   COMPLETE  gate PASS   pr #12
  D2 …
UNVERDICTED: none            ← any name here blocks the wave close (JL-3)
```

---

# §8 THE COMPOSITION MAP (owns / hands off)

```
┌─────────────────────────┐  owns: the AO TRANSPORT · the CLI verbs · the
│ JFM (jfm)               │  desk↔session mapping · the PR-aware gate
└───────┬─────────────────┘
        │ calls (never re-implements)
        ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ JAM kernel   │ │ AO daemon    │ │ upper tier   │ │ fence2           │
│ desk core +  │ │ sessions/PRs │ │ railway +    │ │ the byte verdict │
│ tracker      │ │ REST + SSE   │ │ gates        │ │                  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────────┘
        ▲                                     ▲
        │ Orca transport (unchanged)          │ attribution + kick
┌──────────────┐                    ┌──────────────────┐
│ Orca panes   │                    │ foreman (opt.)   │
└──────────────┘                    └──────────────────┘
```
**Boundary paragraph:** JFM owns exactly three things — the AO transport, the CLI
vocabulary, and the PR-aware completion gate. The desk core, the tracker, the
contract shape, and the wave semantics are JAM's and are CONSUMED, not forked.
The railway, the attribution, and the merge ordering are the upper tier's. AO owns
sessions, worktrees, PRs, and the board. fence2 owns "done". **No duplication law:**
if JFM needs a behaviour JAM has, it imports it; if it needs a behaviour the upper
tier has, it calls it; it never re-implements either.

---

# §9 THE TRIGGER SURFACE

**Forward:** "what is the JAM for AO" · "JFM" · "factory manager" · "fire a job at the
factory" · "drive the factory" · "which CLI drives AO" · "the desk manager for AO" ·
"manage AO sessions as desks" · "spawn a desk on AO" · "watch the factory job" ·
"steer the factory worker" · "the factory CLI".
**Negative:** plain AO session questions → `ao-knowledge-package` · Orca terminal work →
`orca-cli` / `orca-docs` · the upper tier's railway/gates → the upper-tier docs ·
foreman supervision → the foreman bible · designing a NEW substrate → this blueprint.

---

# §10 FILE LAYOUT + DEPLOYMENT

```
jfm/                                   (new tree, sibling of JARVIS/)
├─ src/
│  ├─ ao-transport.ts        the 10-verb seam against AO REST + 3 natives (pr/claim/merge)
│  ├─ transport-select.ts    pick the transport: --substrate ao|orca
│  ├─ desk.ts                dispatchDesk wrapper: render contract + resolve pin + INSERT
│  ├─ watch-ao.ts            the AO-signal watcher (INST-1/2/4) + JAM's stall fallback
│  ├─ gate.ts                the job fence → fence2 + the PR row → PASS|HOLD|FAILED
│  ├─ pin.ts                 resolve + assert the pin (profile/overlay/project env)
│  └─ cli.ts                 the verbs: dispatch|watch|steer|abort|wave|status|pr|pin
├─ tests/                    ao-transport.test.ts (the seam contract, offline) ·
│                            watch-ao.test.ts · gate.test.ts · pin.test.ts
└─ README.md                 the operator manual (later: operator-manual-generate)
```
**Deployment proof (4 steps, mechanical):**
1. `diff -rq JARVIS/src/desk-orchestrator.ts` — untouched (the core is consumed, not forked).
2. `jfm dispatch --substrate ao --wave w0 --desk d0 --job jobs/<id>/SPEC.md` → a session id
   + a tracker row + a worktree on `ao/<id>/root`.
3. `jfm watch --desk d0` → a verdict derived from INST-1/2/4 (never from prose).
4. `jfm gate --desk d0` → `PASS|HOLD|FAILED` with the fence's exit code quoted.
**Name:** `jfm` — because `jarvis-factory` is TAKEN (the 6-line dashboard launcher).

---

# §11 WORKED EXAMPLE (the live dt-shapes job, walked through JFM's machinery)

The job that is running RIGHT NOW (`jarvis-upper-2`) re-read as a JFM run:

| JFM step | what actually happened (measured) | JFM's instrument |
|---|---|---|
| contract render | `jobs/upper-tier-dt-shapes/SPEC.md` written with `artifact:` + a 3-command fence | the contract file |
| pin resolve | project env `OMP_PROFILE=jarvis-worker` + the repo overlay's role map | INST-1 (`/proc/<pid>/environ`) |
| dispatch | `POST /sessions {projectId:jarvis-upper, kind:worker, harness:omp, mode:tui}` → `jarvis-upper-2` | INST-1 (the session row) |
| seat on disk | `~/.ao/data/worktrees/jarvis-upper/jarvis-upper-2`, branch `ao/jarvis-upper-2/root` | INST-2 |
| watch | the transcript: read SPEC → ran `shape_freeze` → read the spec → 175KB growing; CPU 50% | INST-3 |
| (today) the gate | the fence is STILL RED (`TEST-SHAPE-DRIFT:DT1/2/3`) — the desk is WORKING, not COMPLETE | INST-5 |
| (today) the PR | `prNodes=0` — no PR row exists yet | INST-4 |
| observer | the upper tier: `RUNNING tick 1326 cursor 336`, ticks.log 1337 rows | INST-6 |

**Shallow vs deep contrast (the same job, two ways):**
```
SHALLOW (the pre-JFM way):  "the job is running, I can see it in the kanban"
   → no verdict, no gate, no PR row, no tracker row; the operator must remember
     to check three surfaces and trust their own eyes.
DEEP (JFM):                 "desk d0: WORKING · fence RED (3 drift tokens) ·
     session jarvis-upper-2 · branch ao/jarvis-upper-2/root · prNodes 0 ·
     observer RUNNING"
   → one line, six instruments, every element a tool result.
```

---

# §12 OPEN DECISIONS

| # | fork | options | default | needs the operator? |
|---|---|---|---|---|
| D1 | **the name** | `jfm` · take over `jarvis-factory` (currently the launcher) · `jarvis-desk` | **`jfm`** (no collision; the launcher keeps its name) | **YES** |
| D2 | **fork vs transport** | (a) fork JAM's 4404L into `jfm/`; (b) add `ao-transport.ts` + a CLI that imports the kernel | **(b)** — the kernel already parameterizes the transport; a fork duplicates 25 test files | **YES** (it is the operator's stated instinct) |
| D3 | where the PR gate lives | in JFM · in the upper tier | **both, layered**: JFM reads the PR row; the upper tier sequences merges | no |
| D4 | the AO natives' names | `jfm pr` / `jfm merge` vs mirroring `upper order` | `jfm pr --merge --confirm` | no |
| D5 | tracker | extend JAM's `desks` (+3 cols) vs a new table | extend (one source of truth) | no |
| D6 | the model pin | project env only vs env + overlay | both (env for the profile, overlay for the roles) | no |

**The named fork needing a ruling: D2.** The operator asked for "a direct fork of JAM";
the evidence says the seam already exists and a fork would duplicate a green kernel
(25 test files, 4404L). Recommended: **transport + CLI, not a fork** — but this is the
operator's call and is recorded as such.

---

# §13 THE SELF-CHECK + THE RESIDUAL

**Reflexive application (M16):** this blueprint's own law L1 says *nothing above the
seam may know the substrate*. Applied to the blueprint itself: §11's worked example
names AO primitives freely — correct, because §11 describes the TRANSPORT's behaviour,
not the desk core's. §8's boundary paragraph is where that discipline is enforced.

**Named residual (what is NOT designed here):**
- **The AO transport's exact error mapping** (which AO error token becomes which JAM
  transport error) — the 4 Orca tokens have no AO analogue yet; PROPOSED.
- **`createDeskTab`/`listTabs`/`closeDeskTab` have no AO meaning** (AO has no tabs; the
  session IS the card). The transport must implement them as no-ops that return the
  session address — unexercised.
- **The stall detector on AO**: JAM's 60s silence rule reads a pane; on AO the session
  row's `activity` is the signal, but its refresh cadence is unmeasured — PROPOSED.
- **`copilotKey` on AO**: the attach string is the session id + the kanban URL; not
  written.
- **Nothing is built.** This is a design of record: no `jfm/` tree exists; the 3 AO
  tracker columns are proposed; the CLI verbs are named, not implemented.
- **The `jarvis_*` extension tools remain deferred** (EN-018) — JFM does NOT depend on
  them; it is a process-level CLI, which is exactly why it can exist today.
- **The old Python factory** (`MIMOCODE/Jarvis/factory/`, 35KB supervisor + FACTORY.md)
  was NOT read beyond its file list — its ideas may contain precedent worth mining;
  flagged, not absorbed.

**Files touched this session:** `reports/JFM_Blueprint_v1.md` (this file). No code.