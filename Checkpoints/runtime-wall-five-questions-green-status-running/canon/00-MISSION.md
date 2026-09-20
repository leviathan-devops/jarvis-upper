# 00-MISSION — Jarvis Upper Tier: Hardening Factory + Git Railway + AO Integration

Package: jarvis-upper-tier
Written: 2026-09-19
Pipeline: build-package skill (8 steps)

## THE MISSION (operator, verbatim)

> so the good thing is that at least the working prototype of a proper build
> package can be FULLY DELEGATED to AO and it will 100% produce a working v1
> prototype that is close to 0 slop if the build package is properly built
> AND it will handle the FULL git history natively. PLUS every single worker
> agent is run through OMP ~ so all the enhancements im making to OMP's
> coding intelligence and operating behavior directly pass through to the
> bottom levels of the factory.
>
> For JARVIS we can safely mark the worker factory as complete - AO fully
> handles everything and i can directly steer it if i need to
>
> For JARVIS we now need to focus on:
> 1) Integrating AO into the TOOLS and SYSTEMS for the upper jarvis levels
>    that were previously going to use JAM or the OF daemon ~
>    https://orchestrator.inc/docs/ see EXACTLY what is the SDK/config
>    ability for us to be able to wire AO into tool systems properly. we
>    cannot attach into it like an orca terminal - need to find another
>    solution
> 2) JAM + orca is now promoted to a production hardening factory. Foreman'd
>    OMP agents are going to receive a full set of v1 functional PRs w/ full
>    git history, testing data, context that they need to first assemble
>    into a v1 ship package that can be saved properly, and then HARDEN into
>    legit runtime grade production infrastructure that is at S-tier
>    quality. 0 compromises here. the hard work has already been done - i
>    expect magic from this upper management tier. This is where Thanatos
>    can be wired in, much heavier/deeper code review - we need to build
>    multiple parallel pipelines for:
> - reverse engineering the build package from first principles directly
>   from the minted ship package (disassemble and look at the internals -
>   see how it was built) to very RIGOROUS THOROUGH spec/build package
>   alignment + runtime functionality. Any bugs immediately flag and kick
>   down to the factory
> - DEEP RESEARCH + librarian/context synthesis/data retrieval/etc relevant
>   to the Thanatos audit. Ex: Thanatos is auditing jarvis factory + orca,
>   needs deep research on orca + ao + omp sdk ~ not just a summary, but
>   here are problems X Y Z + proposed solutions A B C ~ deep research 1 2 3
>   and validate/invalidate the solutions + solve the problems further w/
>   newly acquired data if possible and report
>
> WE NEED TO BUILD A PRODUCTION GRADE GIT RAILWAY THAT WORKS AS A GRAPH,
> COMMS SYSTEM, FILEPATHS, AND BUILD GUARDRAILS SIMULTANEOUSLY.
>
> UNDERSTAND HOW DOES AO MANAGE GIT - IT AUTO FIXES REJECTED PRS/ETC
>
> HOW CAN WE KICK A BUG DOWN TO THE FACTORY DIRECTLY TO THE WORKER THAT
> CAUSED IT? WE CAN LITERALLY SEE FROM THE COMMIT HISTORY EXACTLY WHICH
> COMMIT THE BUG IS FROM AND DIRECTLY KICK THAT WORKER - HEY THIS IS BUGGED
> HERE IS THE DATA FIX IT.
>
> We can decide whether to kick the worker or fix directly - but the rails
> for this should 100% be setup. research and see exactly how. Because then
> during thanatos audits - we can literally build a bug-graph of every
> single legit runtime bug/break/derailment thanatos finds and MAP EVERY
> SINGLE BUG DIRECTLY TO ITS ORIGIN COMMIT IN THE GIT HISTORY.
>
> Git-bug-graph
>
> this would be extremely valuable for debugging + data analysis on bug
> root causes

## RESTATED UNDERSTANDING

**Status change:** the worker factory is COMPLETE (AO owns prompt→PR;
operator steers directly when needed). This package builds the layer ABOVE
it. CAO is replaced. Roles reversed (AO=core/factory; Jarvis=macro).

**Four deliverable systems:**

1. **AO tool-integration surface (the "wiring")** — upper-tier tools/systems
   need to drive and observe AO programmatically. Not a terminal attach
   (the orca-pty pattern is explicitly rejected for this). Discover the
   real surface (orchestrator.inc docs: SDK? REST API? SSE? config?) and
   build the typed adapter the upper tier standardizes on.

2. **Production hardening factory (JAM+orca promoted)** — foreman'd OMP
   agents receive the factory's minted v1 PRs (with git history, testing
   data, context) → assemble a saved v1 ship package → harden to S-tier
   runtime-grade production infrastructure. 0 compromises. Thanatos wired
   in for deep/heavy code review. Two parallel pipelines MINIMUM:
   - **Reverse-engineering pipeline:** disassemble the minted package from
     first principles → rigorous spec/build-package alignment + runtime
     verification → bugs flagged + kicked DOWN to the factory.
   - **Deep-research pipeline:** librarian/context-synthesis/data-retrieval
     in service of the audit (problems X/Y/Z → proposed solutions A/B/C →
     deep research validates/invalidates → extend → report). Not summaries.

3. **Git railway (production grade)** — one system that is SIMULTANEOUSLY:
   - a **graph** (PR DAG, cross-PR dependencies, merge order)
   - a **comms system** (bug-kick messages, fact routing to owning workers)
   - **filepaths** (every node addressable on disk)
   - **build guardrails** (what may merge when, under which gates)
   Must integrate with AO's own git management (AO auto-fixes rejected
   PRs; merge is always explicit). The railway wraps/extends — never
   fights — AO's lifecycle.

4. **Git-bug-graph** — every legit runtime bug/break/derailment Thanatos
   finds gets mapped to its ORIGIN COMMIT in git history (commit→session→
   worker attribution via AO's session/PR tables). Enables the direct
   kick: "this is bugged, here is the data, fix it" targeted at the exact
   worker that caused it — OR the decision to fix directly. The rails must
   exist for both paths. Valuable for debugging + root-cause data analysis.

## NON-NEGOTIABLES

- AO stays vanilla at the factory level; upper tier integrates via its
  REAL documented surfaces only (no daemon source mods unless the docs
  prove no other path).
- Merge stays explicit (`ao pr merge`) — the railway SEQUENCES, never
  auto-merges behind the operator's back.
- S-tier = 0 compromises on the hardening tier's output quality.
- Bug-kick rails must be bidirectional-capable: kick-to-worker AND
  fix-in-place, decision left to the orchestrator/operator.
- OMP enhancements pass through to factory workers natively (already true
  via AO's harness spawn) — nothing to build, but nothing may break it.

## FORBIDDEN

- No re-parenting AO's factory ptys (the orca-terminal attach pattern).
- No auto-merge.
- No re-introduction of the JAM-as-factory-door architecture (dead).
- No theatrical "integration" that registers but doesn't function
  (the EN-018 lesson).
- No config-wipe roulette with `ao project set-config` (whole-object
  replace — one call, all fields, verify).

## OPEN QUESTIONS (≤5, architecture-changing only — recorded, not asked)

1. **Q1 (SDK shape):** orchestrator.inc/docs — if no SDK exists, is the
   REST API on :3001 + SSE + SQLite(read) an acceptable "SDK" for the
   upper tier? ASSUMPTION for this package: yes — the adapter targets the
   documented REST/SSE surface first; SQLite remains read-only fallback.
   (Discovery Step 2 resolves this; if the docs reveal an official SDK,
   the adapter targets THAT instead.)
2. **Q2 (bug→commit attribution precision):** if a bug spans a merge
   commit or lands in generated files with no single author, the
   git-bug-graph edge must degrade gracefully (nearest owning session by
   file-path majority?). ASSUMPTION: bisection + blame + AO session/PR
   tables, with a confidence field on every edge; ambiguous edges land in
   a triage queue, never silently assigned.
3. **Q3 (railway store):** graph in SQLite (consistent with tracker/
   ao.db precedent) vs a graph DB. ASSUMPTION: SQLite + typed edge table
   + JSON payloads; revisit only if traversal benchmarks fail.
4. **Q4 (Thanatos current state):** inventory in Discovery; if Thanatos is
   not runtime-ready, the hardening pipeline v1 wires its interface with
   the reviewer slot it has today and upgrades later.
5. **Q5 (kick channel):** kicking a worker = `ao send --session <id>` to a
   LIVE session vs spawn-a-fix-worker with the bug data. ASSUMPTION:
   both rails built; default = live-session kick if session alive, else
   spawn fix-worker referencing the origin commit.

## PROCEEDING

Steps 2-8 execute now. Ambiguities above are recorded as assumptions and
will be validated by discovery (Q1, Q4) or by the spec's open-decisions
section (Q2, Q3, Q5). None block architecture — the four-system shape is
fixed by the mission.
