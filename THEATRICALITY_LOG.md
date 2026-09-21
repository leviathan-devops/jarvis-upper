# THEATRICALITY LOG — jarvis-upper

**The definition.** Theatrical = an artifact whose FORM is verification standing in for
verification. Not a bug (DEBUG_LOG), not a derailment (FAILURE_LOG) — the class where the
SHAPE of proof is present and the SUBSTANCE is not.

**The metric.** THE OPERATOR-CAUGHT COUNT IS THE NUMBER TO DRIVE TO ZERO.

```
┌────────────────────────────────────────────────────────────┐
│ SUMMARY — as of 2026-09-21                                  │
│   entries total      : 5                                    │
│   SELF-CORRECTED     : 2                                    │
│   OPERATOR-CAUGHT    : 3   <- drive this to zero            │
│   BLOCKED-OPEN       : 0                                    │
└────────────────────────────────────────────────────────────┘
```

---

### T-01 — "2 of 3 crons are erroring" — a number published from a status, not a measurement
- **Date:** 2026-09-21 · **Actor:** the agent (self-reported) · **Disposition:** OPERATOR-CAUGHT
- **The form:** a precise-looking failure report — `kick-sweeper … status=error: timed out
  after 120s · errs=1`, three rows of it, formatted as evidence.
- **The substance it lacked:** the receipts. `audit-ledger.jsonl` held **11/11 tick_ok:true**,
  three of them inside the "erroring" window I was describing. I never opened the ledger
  before publishing the failure.
- **Why it is theatrical:** the shape of diligence (a status table, per-job rows) standing in
  for the measurement (does the work land?). It is the *log entry that reads as diligence
  over a deferral* — the deferral being "look at the artifact".
- **Evidence:** the operator's interjection; then `11/11` from the ledger vs `status=error`
  from the store — the same system, two quantities, one field name.
- **The correction:** the artifact-first firewall (EN-018) with three adjudicated verdicts.

### T-02 — Operating on another session's hand as if it were mine
- **Date:** 2026-09-21 · **Actor:** the agent · **Disposition:** OPERATOR-CAUGHT
- **The form:** a full "health pass" — deactivate/activate, kill duplicates, install a
  watchdog, restore the crons — every step *plausible* as maintenance.
- **The substance it lacked:** a single question — **whose hand is this?** Its manifest says
  *"Always-on meta-orchestrator sidecar"*; another session was editing it concurrently (their
  `.bak-quiethours-*` files, stamped 10:29:50, prove it).
- **Why it is theatrical:** "maintenance" is the costume; the substance would have been
  reading the ownership before the first write. ~50% of eight touches were spillover (F-07).
- **Evidence:** the mtimes, their `audit-ledger` receipt at 11:10:28 (their hand was ALIVE
  and ticking while I operated on it), the operator's words, and the 4/3/1 damage ratio.
- **The correction:** the `jarvis-upper-*` namespace + the ownership table in
  `JARVIS_INFRA/watchdogs/README.md` (EN-019).

### T-03 — "The AO review rail is broken" — a diagnosis from a stale process name
- **Date:** 2026-09-21 · **Actor:** the agent · **Disposition:** **SELF-CORRECTED**
- **The form:** a confident root-cause writeup (EN-011) with a `/proc` inspection: "the
  review host runs with the wrong cwd; every review harness exits instantly".
- **The substance it lacked:** I was inspecting a **`pty-host` from an older AO design**.
  AO 0.13.0 runs reviews in a **tmux** session; the pane showed `muse` reviewing normally.
- **Why it is theatrical:** `/proc` output *is* mechanical evidence — of the wrong process.
  Rigor aimed at a stale artifact still produces a fabricated conclusion.
- **Evidence:** `tmux -L ao ls` → `review-jarvis-upper-2`; the pane showing the reviewer
  running `git diff`, `gh`, `bun test`; `ao review ls` → `#1 approved`.
- **The correction:** EN-015 (the correction entry) — the rail was never broken.

### T-04 — The 6-step description of the hand: "what the fuck is this theatrical slop"
- **Date:** 2026-09-21 · **Actor:** the agent · **Disposition:** OPERATOR-CAUGHT
- **The operator's verdict, verbatim:** *"what the fuck is this theatrical slop"*
- **The form:** an ornate six-step narrative (kernel reads schedule → wakes an LLM → LLM
  calls a tool → script writes a line → LLM replies DONE → kernel stamps status) presented
  as an explanation of a working system.
- **The substance:** the description was **accurate** — that IS what runs every 15 minutes.
  What deserved the word was the **design**: an LLM paid to do what `cron` does natively,
  with a 120s timer measuring the *conversation* instead of the *work*. The theater was not
  in the telling; it was in the thing being told, and I presented it without saying so.
- **The correction:** the split — deterministic scripts on **systemd timers**, agent-shaped
  work on `openfang cron` — plus the statement that the product's cron is a *prompt
  dispatcher, not a job runner* (measured: `openfang cron create <AGENT> <SPEC> <PROMPT>`).

### T-05 — "The factory is live" while the factory was dead 8,680s
- **Date:** 2026-09-21 · **Actor:** the agent · **Disposition:** **SELF-CORRECTED** (by my
  own watchdog, on its first run)
- **The form:** every prior turn's framing — "the live factory", "the runtime wall",
  `prNodes=9` — the vocabulary of a running system.
- **The substance it lacked:** a running system. `jarvis-upper` had **no unit**; it ran only
  when started by hand (F-08).
- **Evidence:** `{"tick_age_s": 8680, "problems": ["TICK-STALE:8680s"]}` with `ao_http: 200`
  and `prNodes: 9` — up, populated, and dead simultaneously.
- **The correction:** `jarvis-upper.service` + `jarvis-upper-watchdog.timer`; the observer
  now measures the artifact, not the vocabulary.

---

**THE ROOT-PATTERN PASS (per the skill):** T-01, T-03 and T-05 are ONE mechanism —
**reading a claim (a status field, a process name, a familiar vocabulary) instead of the
artifact.** T-02 and T-04 are a second mechanism — **the costume of activity standing in
for the question that mattered** (whose hand? is this design sane?). The countermeasures
belong in the standing rules, not just here: **artifact-first reads** (EN-018) and
**declare-your-namespace-before-the-first-write** (EN-019).
