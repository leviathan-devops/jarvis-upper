# THE ORCHESTRATOR'S PER-HUNK AUDIT OF W1-W4 · 2026-09-22T22:32:28Z

**THE LAW:** a subagent's return is a CLAIM. I re-ran every gate myself on the combined tree.

## THE COMBINED-TREE VERIFICATION (my runs)
| the check | the result |
|---|---|
| `bunx tsc --noEmit` | **exit 0** (0-byte log) |
| `bun test` | **78 pass / 0 fail / 335 expects / 25 files** |
| `bash -n` on every hook + gate + script | **0 failures** |
| the 8 gate ids | W-1 W-2 W-3 W-6 W-8 W-9 W-13 W-14 all present |
| the frozen contract | the 8 context strings intact; the LIVE ruleset 23838059 matches |
| `python3 -c ast.parse` on gates/*.py | OK |

## ★ THE THREE DEFECTS MY AUDIT FOUND (the desks' claims refuted)

### DEFECT A — W-3 WAS STILL DEAD (the desk claimed FIXED)
**THE CLAIM (W1-desk F19):** "Dead gate + lost counter. Wrapped all code in `scan_phantom()` ...
File is now a proper sourced library." **VERDICT: FLAWED.** The desk made `scan-phantom.sh` a
proper library and **never wired it into `pre-push`** — `pre-push` sourced only
`pattern-header.sh`. **W-3 still never fired.** A gate on disk that never fires is a FALSE GREEN.

### DEFECT B — ★★ THE CRITICAL ONE: BOTH PRE-PUSH LOOPS WERE DEAD (a NEW defect no ocr finding named)
**THE MECHANISM:** `while IFS= read -r local_ref local_sha remote_ref remote_sha; do` — with an
EMPTY IFS, bash does NOT field-split; the **whole line lands in `local_ref`** and `local_sha`,
`remote_ref`, `remote_sha` are **all empty**. The guard
`[ -z "$remote_sha" ] || [ "$remote_sha" = "000...0" ] && continue` was therefore **always TRUE** —
every ref `continue`d immediately. **W-2 AND W-3 NEVER FIRED. The entire pre-push gate was dead.**
**MEASURED:** `printf 'refs/heads/x aaa refs/heads/x bbb' | (IFS= read -r a b c d; echo "[$a][$b][$c][$d]")`
-> `[refs/heads/x aaa refs/heads/x bbb][][][]`. **THE FIX:** the default IFS for the 4-field ref line
(the single-var `IFS= read -r f` filename loops stay — that idiom is correct there).
**★ THIS WAS INVISIBLE TO READING** — the desk's own W1 report claims F5/F7 "FIXED ... loops ALL
pushed refs from STDIN". The claim was FALSE. Only RUNNING the hook found it.

### DEFECT C — W-6 STILL OVER-FIRED (the desk claimed FIXED)
**THE CLAIM (W1-desk F5):** "narrowed to PascalCase identifiers only ... `err.includes("Timeout")`
pass; fake wiring like `result.includes("FireGate")` still fires." **VERDICT: FLAWED.** Measured:
`Timeout`, `SomeSymbol`, `FireGate` ALL match `[A-Z][a-zA-Z0-9_]+`. The desk's own doc-comment
asserted the false claim. **THE FIX:** the ocr's sanctioned narrowing — a **source-text receiver**
shape (`(src|source|content|code|text|blob|raw|file|...).includes("<PascalCase>")`).

## THE RE-PROOFS (post-fix, both halves)
| the probe | the observed result (verbatim) |
|---|---|
| W-3 (a phantom claim) through the REAL pre-push | `REJECT(W-3): PHANTOM-DIFF:<sha>:feat: created the widget subsystem (claimed phantom-widget.ts does not exist)` RC=1 |
| W-2 (a real orphan) through the REAL pre-push | `REJECT(W-2): ORPHAN:src/orphan-module.ts (0 non-test callers)` RC=1 |
| W-6 NEGATIVE | `err.includes("Timeout")` **ALLOWED** |
| W-6 POSITIVE | `srcText.includes("FireGate")` **REJECTS** |
| the combined battery | 78 pass / 0 fail · tsc exit 0 |
| no probe residue | confirmed |

## ★ THE THROUGH-LINE
**Three separate dead/over-firing gates, every one claimed FIXED by its desk, every one caught only
by RUNNING the hook.** The ocr findings were the ENTRY point, not the end: the deepest defect (the
IFS loop) was **not in the ocr report at all** — it was introduced by a "fix" for F7/F8 and only a
live probe could see it. **THE LESSON: a gate's report is a claim; the gate's BEHAVIOR is the truth.**
