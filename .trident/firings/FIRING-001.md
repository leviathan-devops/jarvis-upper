# FIRING 001 — THE FIRST LIVE FIRING OF THE ENFORCEMENT SYSTEM (2026-09-22)

**The system's first real workload was its own orchestrator.** This document is the evidence.

---

## §1 WHAT FIRED

`.githooks/pre-commit` — the **W-9 doc-density gate**.

## §2 WHEN

The orchestrator's own `git commit` of two wave audits (`A-1.md`, `B-1.md`). The commit did
**not** happen.

## §3 THE VERBATIM OUTPUT (unedited)

```
REJECT(W-9): .trident/plan-A/wave-audit/A-1.md has 36 lines (< 100)
REJECT(W-9): .trident/plan-A/wave-audit/A-1.md has 0 file:line anchors (< 3)
REJECT(W-9): .trident/plan-B/wave-audit/B-1.md has 28 lines (< 100)
REJECT(W-9): .trident/plan-B/wave-audit/B-1.md has 1 file:line anchors (< 3)
```

`git log --oneline -1` still showed `d75407b` — **the commit was refused.** The work was not
written to history.

## §4 WHY THIS IS THE PROOF THE WHOLE DESIGN EXISTS FOR

The operator's law: **"a gate that cannot BLOCK is not a gate."** This gate blocked. And it
blocked **the orchestrator that dispatched it** — the self-referential loop the D1 migration
ruling demands:

> *"the ENTIRE migration/overhaul will need to be managed through the working system"*

Three properties were proven simultaneously:

| # | the property | the evidence |
|---|---|---|
| 1 | **the anchor is real** | `core.hooksPath=.githooks` (`git config --get` returns it) — the hook fired from the VERSIONED directory, not from `.git/hooks/` |
| 2 | **the deny is real** | `git log -1` unchanged — not a warning, not a log line, the commit did not exist |
| 3 | **it fired on its own author** | no exemption for the orchestrator, no `--no-verify` used |

## §5 THE GATE WAS CORRECT — the work WAS thin

The doc-density law sets the AUDIT floor at 100+ lines with 3+ `file:line` anchors. My two
audits were 36 and 28 lines with 0 and 1 anchors.

**I wrote them at the wrong density because I was reporting progress rather than documenting a
verdict.** The gate is right; the audits were rewritten to the floor and both now pass.

## §6 FIRING 002 — the same gate, on the same orchestrator, hours later

A second commit attempt fired again:

```
REJECT(W-9): .trident/firings/FIRING-001.md has 36 lines (< 100)
REJECT(W-9): .trident/firings/FIRING-001.md has 0 file:line anchors (< 3)
REJECT(W-1): staged src/ change with no staged extensions/ change
```

Two distinct gates this time:

- **W-9** — the firing record itself was 36 lines. **The document about a thin-doc rejection was
  itself a thin doc.** The irony is the proof: the gate does not care what a file is ABOUT.
- **W-1** — `src/` was staged with no `extensions/` change. This is the deploy-freshness gate,
  written for the GI kernel's layout (`src/` -> `extensions/graph-intelligence/index.js`).

## §7 THE W-1 FINDING — a gate ported without its layout

`extensions/` does not exist in `jarvis-upper` (verified: `ls -d extensions/` -> no such file).
W-1's predicate was derived from a MEASURED GI-kernel instance:

```
extensions/graph-intelligence/index.js  Sep 20 07:11
src/omp/*.ts                            Sep 21 17:5x
-> every fix UNLOADED. 21-35 h stale.
```

That repo has an `extensions/` directory. `jarvis-upper` does not. **The gate as written can
never pass in this repo** — every `src/` commit is refused forever.

**The lesson:** a gate is a (predicate × layout) pair. Porting the predicate without checking
the layout produces a gate that fires on everything — which is a gate that gets bypassed, which
is worse than no gate.

**The fix (for the T2 wave):** W-1 must either (a) be scoped to repos that HAVE an `extensions/`
dir, or (b) be re-derived from jarvis-upper's actual deploy layout (there is none — the factory
has no dist step). Recorded as a defect for B-1's follow-up, not silently worked around.

## §8 THE ANCHOR LEDGER (verified this turn — real line numbers)

| the claim | the anchor (verified by `sed -n`) |
|---|---|
| the W-9 line floor | `.githooks/pre-commit:21` -> `if [ "$LINES" -lt 100 ]; then` |
| the W-9 anchor floor | `.githooks/pre-commit:25` -> `if [ "$ANCHORS" -lt 3 ]; then` |
| the W-1 src/extensions predicate | `.githooks/pre-commit:54-55` -> `src/*) SRC_TOUCHED=1` / `extensions/*) EXT_TOUCHED=1` |
| the W-1 REJECT line | `.githooks/pre-commit:59` -> `REJECT(W-1): staged src/ change with no staged extensions/ change` |
| the keystone prefix check | `.githooks/prepare-commit-msg:39` -> `# CHECK 1 — the semantic prefix.` |
| the keystone claim check | `.githooks/prepare-commit-msg:47` -> `grep -qiE 'verified|passed|tested|works|green'` |
| the contract's 7 contexts | `src/status-contract.ts:33` -> `export const REQUIRED_CONTEXTS = [` |
| the internal->external map | `src/status-contract.ts:41` -> `export const GATE_TO_CONTEXT = {` |
| the derived gate list | `src/guardrail.ts:11` -> `Object.keys(GATE_TO_CONTEXT)` |

**The anchor-format lesson:** the W-9 hook's own regex is `[a-z-]+\.(ts|md|json|sh|yml):[0-9]+` —
it requires a FILE EXTENSION. An anchor like `.githooks/pre-commit:21` does NOT match (no
extension on `pre-commit`). Anchors must point at `foo.ts:12`, `bar.md:40`, `baz.sh:7`.

## §9 WHAT THIS PROVES ABOUT THE BUILD

The 8-wave build's Phase 0 exit criterion was: *"the keystone test — a deliberately theatrical
PR gets `mergeStateStatus: BLOCKED`."* This is the LOCAL half of that proof, obtained
**accidentally and honestly**: the orchestrator tried to commit thin work and was refused, twice,
by two different gates.

The remote half (the ruleset + CI blocking a PR) requires Phase 0's Pro upgrade and the B-3 wave.
But the local half is now MEASURED, not claimed.
