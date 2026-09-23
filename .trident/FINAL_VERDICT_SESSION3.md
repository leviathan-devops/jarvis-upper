# THE FINAL VERDICT — the round-4/5 OCR hardening campaign (session 3)

**2026-09-23T09:14:38Z · HEAD `779951fd22205750ed1182b7dde34b4ce9d67bba`.** Every claim below names its SUBJECT, its COMMAND, and its OBSERVED OUTPUT.

## §1 THE GOAL'S DONE CONDITION (each clause, its artifact)

| the clause | the state | the artifact |
|---|---|---|
| the ocr gate re-runs PASS (0 critical, 0 high) | **0 critical · 0 high** | the scoped scans `.trident/ocr-src-final2.json` · `ocr-rest-confirm.json` · `ocr-hooks-final.json` |
| the runtime seat ledger non-empty + a named residual | `.trident/RUNTIME_LEDGER.md` (278 L), the residual NAMED | `.trident/RUNTIME_LEDGER.md:1` |
| the sealed checkpoint + the receipt | `Checkpoints/github-master-kernel-final-audit-pass-*` | `CHECKPOINT_MANIFEST.md:1` |

## §2 THE RECEIPT — WHAT RAN, ON WHAT SUBJECT, WITH WHAT OUTPUT

| \# | WHAT RAN | THE SUBJECT | THE OBSERVED OUTPUT |
|---|---|---|---|
| 1 | `bunx tsc --noEmit` | the SOURCE (20 `.ts`) | **exit 0** |
| 2 | `bun test` | the SOURCE (tests import `../src/`) | **98 pass / 0 fail** across 32 files |
| 3 | `bash .trident/p5_corpus2.sh` | the **DEPLOYED HOOKS** — real staged content through the real `.githooks` | **13 pass / 0 fail** |
| 4 | `bash .githooks/lib/scan-silent.sh` | the SOURCE tree | **0 SILENT-FALLBACK hits** |
| 5 | the ocr gate (scoped: src · scripts/gates/.github · .githooks) | the SOURCE + the hook scripts | **0 critical / 0 high** |
| 6 | `muse exec` (independent review, round 5) | the SOURCE, read COLD | **0 critical / 0 high**, all 7 prior fixes verified by live probes |

**WHAT WAS NOT RUN:** no container test this campaign (the last container round covered the
earlier hooks). The round-4/5 hunks are covered by rows 1-4 and the new pins.

## §3 THE BUG LEDGER IS NOT EMPTY (an empty one would be the red flag)

The campaign FOUND and CLOSED, from three independent sources:
- **the ocr scanner:** 4 CRITICAL + ~30 HIGH (the round-4/5 deep surface: the rail cursor,
  the spec path above the repo, the cross-domain sha, the FK migration, the ERROR-TAIL).
- **the repo's own gates (self-caught):** the W-14 stub scanner was a DEAD GATE (a
  multi-line NotImplemented stub sailed through — two independent bugs: the bash brace
  expansion and the shell-quote-eating regex); the W-8 prefix check passed a BODY-only
  prefix; the `sync.ts` SET clause carried corrupted identifiers
  (`source_branxcluded.source_branch`).
- **the independent reviewer (muse, 5 rounds):** 7 HIGH — a converging sequence
  (3 → 2 → 1 → 1 → 0) on ONE class: **an unknown value converted into a known one** (a
  swallowed rail failure; a fail-open STALE-GATE on a NULL row head_sha; a fail-open
  STALE-GATE on a NULL PR head_sha; an out-of-vocabulary state that threw into
  head-of-line blocking; a state default outside the CHECK vocabulary that rolled back the
  sync batch; a null overwriting a known sha in `upsertPr`; a rejection outvoted by an
  earlier approval in `verdict`).

**TOTAL: 4 CRITICAL + ~40 HIGH found. 41+ closed, 0 left open on the scanned surface.**

## §4 THE REFUTATIONS (measured — `.trident/OCR_ADJUDICATION.md` §7)

`Bun.spawnSync().stdout` IS a Buffer (decodes UTF-8); the `attribute.ts` `.catch` uses a
literal (`tsc` 0); the `cli.ts` dispatch catch handles verb throws; `dossierDir` refuses
traversal; `start(): void` has no unhandled rejection; the `status-contract` has no missing
state (frozen + GitHub defaults pending).

## §5 THE HONEST REMAINDER (5 rows, each with its resume condition)

1. The raw scanner tail is `medium`/`low` (style/completeness); the CONFIRMED critical/high
   count is zero, each refutation carrying its measurement.
2. No container test for the round-4/5 hunks. RESUME: a `container-testing` round.
3. The full-tree ocr scan times out (>1500 s/pass) — the coverage is three scoped scans.
4. The GitHub round-trip (the 2 `factory/*` contexts end-to-end) was not re-exercised; the
   mirror now records them (`tests/gate_pass_mirror.test.ts`).
5. Both ocr lanes are quota-capped (the free lane resets 00:00Z; poolside per its window).

## §6 THE PINS (executable — each goes RED if its fix is reverted)

`tests/probe/cursor_probe.test.ts` · `tests/dossier_traversal.test.ts` ·
`tests/desks_traversal.test.ts` · `tests/gate_pass_mirror.test.ts` ·
`tests/attribution_method.test.ts` · `tests/stub_scanner.test.ts` ·
`tests/muse_review_pins.test.ts` (8 cases) — plus the P5 corpus (the deployed hooks).

A claim without its artifact is VOID. Every row names its subject, its command, and its output.
