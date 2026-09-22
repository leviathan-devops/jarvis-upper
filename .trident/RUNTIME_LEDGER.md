# THE RUNTIME LEDGER — P4 · THE RUNTIME SEAT (2026-09-22)

**STANCE (declared in writing):** *I am the driver of the live enforcement chain — the `.githooks/`
hooks AND the ruleset id `23838059`.*

**THE INSTANCE:**
```
repo:      /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-FACTORY/jarvis-upper
sha:       3f6e5f3
branch:    feat/github-master-kernel
hooksPath: .githooks
hooks:     commit-msg · pre-commit · pre-push · prepare-commit-msg
lib:       pattern-header.sh · scan-phantom.sh · scan-silent.sh · scan-stub.sh
ruleset:   23838059 · enforcement=active · bypass_actors [] · 8 contexts
```

---

## §1 THE OPERATIONS — numbered, each with a PRE-REGISTERED expectation

### OP-1 · THE LEGIT PATH
**PRE-REGISTERED:** exit 0, `PRE-COMMIT: PASS`, the commit lands.
**OBSERVED:** `[feat/github-master-kernel 448d179] test(op-1): the legit path...`
**VERDICT: CORRECT.**

### OP-2 · ★ THE `--no-verify` BYPASS (THE CRITICAL ONE)
**PRE-REGISTERED:** `REJECT(W-8)` + exit 1 — `--no-verify` must NOT skip `prepare-commit-msg`.
**OBSERVED:**
```
$ git commit --no-verify -m "fix: verified the whole thing works"
REJECT(W-8): claim word ... with no artifact; include a test count, a sha, or a file:line
   (the commit DID NOT LAND — 0 op-2 commits)
```
**VERDICT: CORRECT — the ABSOLUTE hook survived `--no-verify`.**

**THIS IS THE SINGLE MOST IMPORTANT LOCAL PROOF.** `--no-verify` is the flag that skips
`pre-commit` and `commit-msg`. It did **not** skip `prepare-commit-msg` — because the git manual
says that hook *"is not suppressed by the `--no-verify` option."* **The design's load-bearing
claim, proven by running it.**

### OP-3 · THE HOSTILE MESSAGE — ★ AND IT FOUND A GAP
**PRE-REGISTERED:** a claim with no artifact → REJECT; a legit non-claim → ACCEPT.
**OBSERVED (first run):**
| the message | the result |
|---|---|
| `fix: verified everything` | REJECTED |
| `fix: passed all the tests` | REJECTED |
| **`feat: done`** | **ACCEPTED**  ← ★ THE GAP |
| `update stuff` | REJECTED |

**★ THE FINDING:** `feat: done` was ACCEPTED. **"done" IS a completion claim** — the phantom gate's
own `CLAIM_RE` includes it — but the W-8 lexicon (`verified|passed|tested|works|green`) did not.
**An asymmetry between two gates policing the same family.**

**THE FIX (applied in the hot seat):** the lexicon extended to
`verified|passed|tested|works|green|done|complete|completed|finished|shipped|landed|delivered`,
and the REJECT message updated to name the real set.

**RE-PROVEN (the same six messages):**
| the message | the result |
|---|---|
| `fix: verified everything` | REJECTED |
| `fix: passed all the tests` | REJECTED |
| `feat: done` | **REJECTED** ← fixed |
| `feat: complete the work` | **REJECTED** ← fixed |
| `docs: updated the readme` | **ACCEPTED** ← correct (a legit non-claim) |
| `update stuff` | REJECTED |

**VERDICT: CORRECT after the fix. The zero-misfire half holds (`docs:` accepted).**

### OP-4 · A SILENT-FALLBACK DIFF (the W-13 gate)
**PRE-REGISTERED:** `REJECT(W-13)` + the commit does NOT land.
**OBSERVED:**
```
REJECT(W-13): SILENT-FALLBACK:src/__op4_probe.ts:2:  try { return x; } catch {}
   (0 op-4 commits — correctly blocked)
```
**VERDICT: CORRECT.**

### OP-5 · TEN COMMITS AT ONCE
**PRE-REGISTERED:** the chain holds under repetition — no crash, no hang, consistent verdicts.
**OBSERVED:** `landed: 10  rejected: 0` — ten sequential commits, each policed, all landed.
**VERDICT: CORRECT — the chain held under repetition.**

### OP-6 · A FRESH CLONE PUSHING `main` (the REMOTE tier)
**PRE-REGISTERED:** GitHub refuses, naming the required checks.
**OBSERVED (FIRING 011):**
```
$ git clone ... /tmp/keystone-8 && cd /tmp/keystone-8
$ git config --get core.hooksPath     -> (empty — NO local hooks)
$ git push origin main
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - 8 of 8 required status checks are expected.
remote: - Changes must be made through a pull request.
 ! [remote rejected] main -> main
```
**VERDICT: CORRECT — the remote tier is unbypassable, proven with ZERO local hooks.**

---

## §2 ★ THE RUNTIME LEDGER — WHAT RUNNING TAUGHT THAT READING COULD NOT

| # | the lesson | how it was learned |
|---|---|---|
| 1 | **`--no-verify` does not skip `prepare-commit-msg`** | OP-2: the commit was refused |
| 2 | **"done" was not in the W-8 claim lexicon** | OP-3: `feat: done` was ACCEPTED |
| 3 | **the hooks survive 10 sequential commits** | OP-5: 10/10 landed |
| 4 | **the ruleset refuses even the ADMIN token** | OP-6 / FIRING 007: bypass_actors [] |
| 5 | **two hooks had lost their shebangs** | EN-104: a real commit exited 2 |
| 6 | **`git diff --root` is not a valid flag** | EN-105: it silently returned empty |
| 7 | **a claim regex anchored at `^[^:]*` cannot match a prefixed subject** | EN-105 |
| 8 | **the CI rejects a job id containing a slash** | FIRING 010: zero jobs created |
| 9 | **GitHub generates a `Merge <sha> into <sha>` subject** | FIRING 010: the anti-theatrical gate failed on it |
| 10 | **the local battery was green while the artifact was broken** | FIRING 010: 72/0 locally, 4 failures in CI |

**Every one of these was invisible to reading. Each required RUNNING the thing.**

---

## §3 THE HONEST RESIDUAL

| # | the gap | the reason |
|---|---|---|
| 1 | OP-3's lexicon extension has no unit test | it was proven by the six-message table, not a test file — **owed** |
| 2 | the reachability gate (W-2) was not probed with a real orphan | the desk wired it; **the probe is owed at P5** |
| 3 | the `factory/*` contexts still have no poster | W5 (the publisher wiring) is in flight |
| 4 | the CI has never gone green | 4 jobs fail on real findings |
| 5 | `commit-msg` has no W1 header | no desk owns it |
| 6 | no container test exists | the rig has not been stood up |

---

## §4 THE ANCHOR LEDGER (every claim's real file:line — verified this turn)

| the claim | the anchor |
|---|---|
| the ABSOLUTE hook | `.githooks/prepare-commit-msg:1` |
| the W-8 claim lexicon (extended) | `.githooks/prepare-commit-msg:61` |
| the W-8 anchor regex (case + bare path) | `.githooks/prepare-commit-msg:65` |
| the W-9 doc floor | `.githooks/pre-commit:21` |
| the W-13 silent scanner | `.githooks/lib/scan-silent.sh:1` |
| the W-14 stub scanner | `.githooks/lib/scan-stub.sh:1` |
| the phantom claim regex (fixed) | `.githooks/lib/scan-phantom.sh:44` |
| the phantom stat command (fixed) | `.githooks/lib/scan-phantom.sh:1` |
| the W-2 reachability gate | `.githooks/pre-push:1` |
| the gate-header standard | `.githooks/lib/pattern-header.sh:1` |
| the W1 test | `tests/gate_header.test.ts:1` |
| the W3 test | `tests/gate_phantom_reach.test.ts:1` |
| the W2 test | `tests/gate_silent_stub.test.ts:1` |
| the W4 test | `tests/gate_theatrical.test.ts:1` |
| the W6 test | `tests/interface_match.test.ts:1` |
| the frozen contract | `src/status-contract.ts:33` |
| the armed ruleset payload | `ruleset.json:1` |
| the arm command | `W6_ARM_COMMAND.sh:1` |
| the CI workflow | `.github/workflows/gates.yml:11` |
| the merge-scope fix | `.github/workflows/gates.yml:26` |
| the interface check | `scripts/interface-check.ts:1` |

**21 anchors, every one verified by `grep -n` / the actual operation this turn — none invented.**

---

# SESSION 2 — THE OCR-HARDENING RUNTIME SEAT · 2026-09-22T23:55:32Z
**STANCE:** *"I am the driver of the `jarvis-upper` kernel."* Instance: the repo @
`548086c`→`b4d91c8` · `core.hooksPath=.githooks` · ruleset 23838059 · the 8 hooks.
**METHOD:** every op ran the DEPLOYED hook via a REAL commit/push in a THROWAWAY clone — never a
source import. The prior session's OP-1..OP-6 ran against `3f6e5f3`; these ran against the
HARDENED hooks.

## OP-7 · THE WORD-SPLIT / IFS LOOP — ★ THE DEEPEST DEFECT (a CRITICAL find)
- **PRE-REGISTERED EXPECTATION:** a phantom claim pushed to a NEW branch fires W-3.
- **THE PROBE:** `git push origin HEAD:refs/heads/feature-x` on a commit whose body claims
  `created phantom-widget.ts` (a file that does not exist).
- **ACTUAL (verbatim):** `*` [new branch] ... ` — the push SUCCEEDED. No W-3.
- **THE MECHANISM:** `while IFS= read -r local_ref local_sha remote_ref remote_sha` — with an EMPTY
  IFS bash does NOT field-split: the WHOLE line lands in `local_ref`, the other three are EMPTY.
  So `[ -z "" ]` was ALWAYS true → every ref `continue`d → **W-2 AND W-3 NEVER FIRED.**
  Measured: `IFS= read -r a b c d` on `"x y x z"` → `a="x y x z"`, b/c/d empty.
- **VERDICT:** FIRED-WRONG (the gate was DEAD). **Not in the ocr report** — introduced by the desks'
  own fix for F7/F8.
- **THE FIX:** the default IFS for the 4-field ref line (`.githooks/pre-push:61`).
- **RETEST:** OP-8.

## OP-8 · THE PHANTOM, RE-PROVEN (the retest of OP-7)
- **EXPECTATION:** the same probe now fires W-3.
- **ACTUAL:** `REJECT(W-3): PHANTOM-DIFF:<sha>:feat: created the widget (claimed phantom-widget.ts
  does not exist)` — the push REFUSED (rc=1). **VERDICT: FIRED-CORRECT.**

## OP-9 · THE NEW-REF SKIP (found by running OP-7)
- **EXPECTATION:** a first push of a branch is scanned.
- **ACTUAL:** before the fix the `remote_sha == 0000` guard (meant for "the empty ref that closes
  the pipe") ALSO skipped every NEW branch. **VERDICT: FIRED-WRONG.**
- **THE FIX:** `.githooks/pre-push:63` — a new ref scans all commits reachable from `local_sha`.

## OP-10 · W-2 (THE OWED PROBE — the prior session's residual #4)
- **EXPECTATION:** a real orphan module is caught.
- **ACTUAL:** `REJECT(W-2): ORPHAN:src/orphan-mod.ts (0 non-test callers)` — refused.
  **VERDICT: FIRED-CORRECT.**

## OP-11 · W-6 BOTH HALVES
- **NEGATIVE (a legit string check):** `err.includes("Timeout")` → `PRE-COMMIT: PASS`.
  **FIRED-CORRECT** (the over-fire closed).
- **POSITIVE (a source-text fake-wiring):** `srcText.includes("FireGate")` → `REJECT(W-6): ...
  asserts a symbol against SOURCE TEXT`. **FIRED-CORRECT.**

## OP-12 · W-13 ACROSS THE FOUR CATCH SHAPES
- `catch {}` → REJECT · `catch{ /* ignore */ }` → REJECT (the no-paren gap closed) ·
  `catch(e){throw e}` → PASS · `catch{ /* already dead */ }` → PASS (the named-reason allowlist).
  **ALL FOUR FIRED-CORRECT.**

## OP-13 · THE `=~` QUOTING BUG (found by running the commit through the live hook)
- **EXPECTATION:** a commit with only compliant docs passes W-13.
- **ACTUAL:** `REJECT(W-13): SILENT-FALLBACK:src/verdict.ts:...` on EVERY `?? <anything>` — including
  `opts.fenceBin ?? FENCE_DEFAULT` (an option default, not a swallow).
- **THE MECHANISM:** `[[ "" =~ \?\?[[:space:]]*(0|""|''|\[\]|\{\}) ]]` — inside `[[ =~ ]]` the
  pattern is UNQUOTED, so `""` and `''` are STRIPPED to empty strings, giving the alternation two
  EMPTY branches that match anything. Proven: the inline form matched `?? x` for every x; a
  VARIABLE pattern matches only the literals.
- **VERDICT:** FIRED-WRONG (over-fire). **THE FIX:** the pattern in a variable
  (`.githooks/lib/scan-silent.sh:119`). **RETEST:** the 4-shape probe above — FIRED-CORRECT.

## OP-14 · THE CONTAINER (the L3/L4 tier — the clean-room proof)
- **THE RIG:** `jarvis-upper-ct` on `omp-ct:master` · the repo at `/workspace/repo` ·
  `core.hooksPath=.githooks` · git 2.39.5 · no host state.
- **BASELINE (pre-fix hooks):** S5 (a legit `err.includes("Timeout")`) → **REJECTED** — the W-6
  over-fire reproduced in a CLEAN ROOM; both scanners returned uncapped; W-3 never fired.
- **POST-FIX:** S5 → `PRE-COMMIT: PASS`; S1/S2/S3/S4/S6/S7 all correct; W-3 + W-2 fire via
  pre-push. **11 scenarios, `.trident/ct/ct-results.json` → overall PASS.**
- **WHAT THE CONTAINER TAUGHT:** the W-6 over-fire is environment-INDEPENDENT; the exit-cap defect
  was in BOTH scanners (the ocr named one); the gates carry their OWN environment (the shebang, the
  lib sources, the relative paths) — the kernel is not host-dependent.

## THE LEDGER'S LESSON (H6 — what RUNNING taught that READING could not)
**Six defects, every one claimed FIXED by its desk, every one invisible to reading:**
1. W-3 unwired · 2. the IFS loop (the whole pre-push gate DEAD) · 3. the new-ref skip ·
4. the W-6 over-fire · 5. the `=~` quoting bug · 6. the W-13 catch-shape gaps.
**The deepest (the IFS bug) was INTRODUCED by a fix and was NOT in the ocr report.** A gate's report
is a claim; the gate's BEHAVIOR is the truth. The container reproduced the baseline defects and
confirmed the fixes — the clean-room probe is the only proof that survives a warm shell.
