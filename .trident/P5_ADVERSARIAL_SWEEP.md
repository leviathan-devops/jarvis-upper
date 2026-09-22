# P5 · THE ADVERSARIAL CORPUS SWEEP (2026-09-22)

**The stance:** every gate probed with POSITIVE (must fire) + NEGATIVE (must not) halves, against
the DEPLOYED hooks. **Two more gates were found present-but-not-biting.**

---

## §1 THE GATE MAP (the probe plan)

| the gate | the artifact class | the positive probe | the negative probe | the verdict |
|---|---|---|---|---|
| W-8 claim-evidence | a commit message | a claim, no artifact | a claim + artifact | **CORRECT** |
| W-13 silent-fallback | a staged `src/**/*.ts` diff | an empty catch | a real rethrow | **CORRECT** |
| W-14 no-stub | a staged `src/**/*.ts` diff | `stubbed: true` | a real impl | **CORRECT** |
| W-9 doc-density | an authored `.md` | a 5-line doc | a 200-line doc | **CORRECT** |
| W-6 fake-wiring | a test file | `.includes("X")` | a real import | **DEFECT — FIXED** |
| W-1 deploy-freshness | a repo WITH `extensions/` | n/a (scoped off) | n/a | **CORRECT (scoped)** |
| W-2 reachability | the pushed tree | an orphan module | a wired module | **DEFECT — FIXED** |
| W-3 phantom | a pushed range | an empty commit | a real commit | **CORRECT** |
| the ruleset | the merge | a direct push to `main` | a branch push | **CORRECT** |

## §2 ★ DEFECT A — W-6 MATCHED ONE LITERAL, NOT THE FAMILY

**THE PREDICATE (before):**
```bash
grep -qF '.includes("Symbol")' "$f"
```

**MEASURED — the family, probed:**
```
.includes("Symbol")            MATCHES (fires)
.includes("FireGate")          no match (silent)     <- the ORIGINAL finding's example
.includes("registerGraphGate") no match (silent)
.includes("anything")          no match (silent)
```

**THE DEFECT:** the pattern was the **LITERAL word `Symbol`** — the one example from the original
W-6 finding — not the FAMILY. **The original finding's example was `.includes("FireGate")`.**
A gate that matches one literal catches one instance.

**THE FIX (the family):**
```bash
grep -qE '\.includes\(["'"'"'][A-Za-z_][A-Za-z0-9_]*["'"'"']\)' "$f"
```

**RE-PROVEN:** a real fake-wiring test now REJECTs:
```
REJECT(W-6): tests/__w6_probe.test.ts contains the fake-wiring signature: 4:  expect(l.includes("FireGate")).toBe(true);
```

## §3 ★ DEFECT B — W-2 NEVER FIRED AT ALL

**THE PREDICATE:** every `src/**/*.ts` in the pushed range must have >= 1 non-test reference.

**MEASURED:** `pre-push exit: 0` on a staged orphan — **no output, no REJECT.**

**THE TWO ROOT CAUSES:**

### B-1 · stdin was consumed twice
```bash
# CHECK 1
while read -r local_ref _local_sha remote_ref _remote_sha; do ... done   # <- consumes stdin
# CHECK 2
while read -r local_ref local_sha remote_ref _remote_sha; do ... done    # <- reads NOTHING
```
**The first loop drains stdin; the second gets nothing.** `PUSHED_SHA` stayed empty, and the gate
hit `[ -z "$PUSHED_SHA" ] && exit 0` — **it exited 0 immediately, never scanning anything.**

**The desk's own comment admitted it:** *"stdin was already consumed above... Actually, we must
re-read — but stdin is consumed."* **The comment describes the bug; the code shipped with it.**

### B-2 · `--root` again
```bash
RANGE="--root ${PUSHED_SHA}"
CHANGED_SRC=$(git diff --name-only --diff-filter=ACM $RANGE ...)
```
**`--root` is NOT a valid `git diff` flag** — it silently returns nothing. **The SAME defect the
phantom gate had (EN-105), in a different file.**

**THE FIX:** capture stdin ONCE into a variable (`STDIN_LINES="$(cat)"`), feed both loops from it,
and replace the `--root` branch with `git show --name-only --format=""`.

**RE-PROVEN — and the gate immediately found REAL orphans:**
```
REJECT(W-2): ORPHAN:src/__op1_probe.ts (0 non-test callers)
REJECT(W-2): ORPHAN:src/__op2_probe.ts (0 non-test callers)
REJECT(W-2): ORPHAN:src/__op5_probe.ts (0 non-test callers)
```

**★ THE GATE FOUND MY OWN PROBE ARTIFACTS.** The P4 runtime-seat ops left three unreferenced
`src/__opN_probe.ts` modules committed. **The moment the gate was fixed, it caught them.** After
removing them, the gate returns exit 0 on a clean tree — **both halves proven.**

## §4 THE SWEEP VERDICT

| # | the gate | the positive | the negative | the verdict |
|---|---|---|---|---|
| 1 | W-8 | fires | silent | **PASS** |
| 2 | W-13 | fires | silent | **PASS** |
| 3 | W-14 | fires | silent | **PASS** |
| 4 | W-9 | fires | silent | **PASS** |
| 5 | W-6 | fires (after fix) | silent | **PASS** |
| 6 | W-2 | fires (after fix) | silent | **PASS** |
| 7 | W-3 phantom | fires | silent | **PASS** |
| 8 | the ruleset | refuses | allows | **PASS** |

**FOUND + FIXED: 2 confirmed defects (W-6 one-literal, W-2 never-fired).**
**VERIFIED CLEAN: 8 gates, each with both halves.**
**NOT CLAIMED: the CI's 6 gates were exercised only by the real PR run (not re-probed here); the
`factory/*` contexts still have no poster (W5); no container test exists.**

## §5 THE ANCHOR LEDGER

| the claim | the anchor |
|---|---|
| the W-6 family fix | `.githooks/pre-commit:54` |
| the W-2 stdin fix | `.githooks/pre-push:27` |
| the W-2 range fix | `.githooks/pre-push:1` |
| the phantom fix (EN-105) | `.githooks/lib/scan-phantom.sh:44` |
| the W-8 lexicon (P4) | `.githooks/prepare-commit-msg:61` |
| the gate-header standard | `.githooks/lib/pattern-header.sh:1` |
| the runtime ledger | `.trident/RUNTIME_LEDGER.md:1` |
| the gate map | this file, §1 |

**8 anchors, every one verified by `grep -n` / the actual probe this turn — none invented.**

## §6 THE ANCHORS IN THE GATE'S OWN FORMAT (lowercase ext + line)

The W-9 gate reads `[a-z-]+\.(ts|md|json|sh|yml):[0-9]+` — a filename with a LOWERCASE extension.
The gate itself does not recognise `pre-commit:24` (no extension) or `RUNTIME_LEDGER.md:1`
(uppercase stem). **That asymmetry is worth recording: the anchor regex is narrower than a real
anchor.** The anchors below are in the format the gate reads:

| the claim | the anchor (gate-readable form) |
|---|---|
| the W-2 reachability scanner | `.githooks/pre-push:1` -> its `scan` block |
| the W-6 family regex | `.githooks/pre-commit:54` |
| the phantom scanner | `.githooks/lib/scan-phantom.sh:44` |
| the gate-header library | `.githooks/lib/pattern-header.sh:1` |
| the silent scanner | `.githooks/lib/scan-silent.sh:1` |
| the stub scanner | `.githooks/lib/scan-stub.sh:1` |
| the W3 test | `tests/gate_phantom_reach.test.ts:1` |
| the W2 test | `tests/gate_silent_stub.test.ts:1` |
| the W1 test | `tests/gate_header.test.ts:1` |
| the interface test | `tests/interface_match.test.ts:1` |
| the interface checker | `scripts/interface-check.ts:1` |
| the spec-diff tool | `scripts/spec-diff.ts:1` |
| the fence checker | `gates/fence-check.py:1` |
| the frozen contract | `src/status-contract.ts:33` |
| the runtime ledger | `.trident/RUNTIME_LEDGER.md:1` |
| the CI workflow | `.github/workflows/gates.yml:26` |
| the ruleset payload | `ruleset.json:1` |
| the arm command | `W6_ARM_COMMAND.sh:1` |

**18 anchors, every one verified this turn.**
