# P4 RUNTIME SEAT PLAN — the HARDENED hooks (extends the prior 6 ops)

**STANCE:** I am the driver of the live enforcement chain (the `.githooks/` hooks + ruleset 23838059).
**THE PRIOR SESSION RAN 6 OPS against sha `3f6e5f3`.** This session's ops run against the HARDENED
hooks and target the FIXES the ocr findings named — the classes READING could not settle.

## THE OPS (each: a pre-registered expectation + an evidence channel)
| op | the target | PRE-REGISTERED expectation | the evidence channel |
|---|---|---|---|
| OP-7 | **THE WORD-SPLIT FIX** (F7/F8) | a staged path containing a SPACE is handled, not split — the gate reports the correct file or passes cleanly; NO spurious REJECT | the hook's exit + stdout, verbatim |
| OP-8 | **THE EXIT-CAP FIX** (F2) | a scan producing >255 hits returns a NON-ZERO signal (not 0 via mod-256 wrap) | `scan_stub`/`scan_silent` return value |
| OP-9 | **THE STDERR-AS-HIT FIX** (F6) | an internal error does NOT become a spurious W-13/W-14 hit | stage a file with a broken lib path; the hook must fail LOUD, not fabricate a hit |
| OP-10 | **THE W-6 OVER-FIRE FIX** (F5) | a LEGITIMATE `.includes("Timeout")` assertion PASSES; a fake-wiring `.includes("SomeSymbol")` REJECTS | the hook's verdict on both fixtures |
| OP-11 | **THE W-3 WIRING** (F1) | the phantom scanner now FIRES from pre-push (or is deleted with a recorded reason) | a pushed range with a phantom claim |
| OP-12 | **THE UNBOUND-VAR FIX** (F3) | a lib function called with NO argument returns its NAMED refusal, not an unbound-variable death | `bash -c 'source lib; fn'` output |
| OP-13 | **THE EVIDENCE-SHAPE FIX** (F9) | `fix: done a:1` REJECTS (bare path); `fix: done, 78 pass, src/x.ts:1` ACCEPTS | prepare-commit-msg on both messages |
| OP-14 | **THE MULTI-REF PUSH** (F7) | a push of 2 refs checks BOTH (not just the first) | the pre-push stdin contract |
| OP-15 | **THE KEYSTONE RE-PROOF** | a fresh clone's push to main REFUSED (`GH013`, 8 of 8) | the push output |
| OP-16 | **THE OWED W-2 PROBE** | a REAL orphan module is caught by the reachability gate | a pushed tree with an unreferenced .ts |

## THE LAW
- A generic gate preempting a specific one = UNOBSERVED, never PASS.
- Adjudicate EVERY failure BOTH ways before any verdict.
- ZERO BUGS FOUND IS A RED FLAG.
- Probes are cleaned up after (the prior session left op-1/op-2/op-5 as orphans — W-2 caught them).
