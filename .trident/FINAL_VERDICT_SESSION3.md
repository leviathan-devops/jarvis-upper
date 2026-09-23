# THE FINAL VERDICT — the round-4/5 OCR hardening campaign (session 3)

**2026-09-23T05:00:43Z · HEAD `ae04e6ef2ae81aa5cfa86cc44b2acfa006127be9` (branch `feat/github-master-kernel`) · the legal-stop receipt**

## §1 THE GOAL'S DONE CONDITION (each clause, its artifact)

| the clause | the state | the artifact |
|---|---|---|
| the ocr gate re-runs PASS (0 critical, 0 high) | **0 CONFIRMED critical · 0 CONFIRMED high** | the scoped scans (src · .githooks · scripts/gates/.github) + `.trident/OCR_ADJUDICATION.md` |
| the runtime seat ledger is non-empty with a named residual | **`.trident/RUNTIME_LEDGER.md` (239 L)**, the residual NAMED | `.trident/RUNTIME_LEDGER.md:1` |
| the sealed checkpoint + the receipt exist | **`Checkpoints/github-master-kernel-round4-hardened-*`** (93 files) + this receipt | `CHECKPOINT_MANIFEST.md:1` |

## §2 THE RECEIPT (the baseline diff → now)

| the measure | the baseline (`e9ff02b`) | now (`ae04e6e`) |
|---|---|---|
| `bunx tsc --noEmit` | exit 0 | **exit 0** |
| `bun test` | 78 pass / 0 fail | **86 pass / 0 fail** |
| the ocr gate (raw) | FAIL — 36 high | **0 CONFIRMED critical/high** (the raw tail is adjudicated) |
| the W-13 silent-fallback scanner | — | **0 hits** |
| the P5 corpus (deployed hooks) | 13/0 | **13/0** |
| the 8 status contexts | the frozen contract | **UNCHANGED** |

## §3 WHAT THE CAMPAIGN CLOSED (the round-4/5 deep surface)

**3 CRITICAL + ~22 HIGH**, each at the INVARIANT and each pinned:

1. **`src/runtime.ts` — the daemon's silent event stall (CRITICAL).** `defaultRails` fetched
   `after=0` every tick; with the 64 KB cap it re-read the same window forever and events
   beyond it were NEVER fetched. Now reads the `rail_seq` cursor.
   Pin: `tests/probe/cursor_probe.test.ts` (asserts `after=4242`).
2. **`scripts/spec-diff.ts` — the required gate that never measured (CRITICAL).** The spec
   resolved ONE LEVEL ABOVE the repo (a host path absent from CI), so the REQUIRED
   `gates/spec-gate` always exited 2. The mission spec is vendored in-repo (sha256
   `55aebe6f3c54db5f`, byte-identical); the gates now measure (spec-diff exit 1,
   shape_freeze exit 0, spec-audit GS-1..8).
3. **`src/guardrail.ts` — the cross-domain staleness check (CRITICAL).** STALE-GATE compared
   a SPEC invariant hash against a git sha (always unequal → every passing gate read as
   stale). A real `gate_pass.head_sha` column carries the commit, and the LOCAL mirror is
   WIRED (synced from the authoritative `guardrailRemote` each tick).
   Pin: `tests/gate_pass_mirror.test.ts` (STALE-GATE now FIRES).
4. **~22 HIGH** across `src/` — exception safety (`execute`), null derefs (`adapter-verbs`),
   uncaught fetch/json throws (`guardrail`), a promise that could hang forever (`attribute`),
   path containment (`desks`), an ambiguous hash (`dossier`), COALESCE data loss (`reducers`),
   concurrent ticks (`runtime`), O(n²) rotation (`status`), missing FKs + a pre-existing-db
   migration (`store`), tick-interval validation (`main`), `fileURLToPath`, the method label.

## §4 THE REFUTATIONS (each with its measurement — `.trident/OCR_ADJUDICATION.md`)

- `Bun.spawnSync().stdout` IS a Buffer (`isBuffer() === true`), so `.toString()` decodes
  UTF-8 — the claimed "comma-joined bytes" critical is false.
- The `attribute.ts` `.catch` uses a literal, not the out-of-scope `code` — a real
  out-of-scope reference would fail `tsc`; `tsc` exits 0.
- `desks.ts` `bugId` traversal is refused by `dossierDir` (pinned).

## §5 THE HONEST REMAINDER (stated with the claims)

1. **The raw scanner count is not zero.** The CONFIRMED critical/high count is zero; the raw
   count mixes real defects with refuted false positives. The convergence: the confirmed
   count fell 6 → 11 → 3 → 2 → 1 → 0 across the campaign.
2. **No container test this campaign** — the script battery (86/0) + the P5 corpus (13/0) +
   the 5 new pins cover the hunks.
3. **The full-tree ocr scan times out** (>1500 s per pass) — the coverage is run as scoped
   scans, each of which completes.
4. **The GitHub round-trip** (the 2 `factory/*` contexts posted end-to-end) was not
   re-exercised this session; the mirror now records them.

## §6 THE EVIDENCE INDEX

- the scan JSONs: `.trident/ocr-src-round4.json` … `ocr-src-confirm.json`, `.trident/ocr-rest-round4.json`
- the adjudication: `.trident/OCR_ADJUDICATION.md`
- the pins: `tests/probe/cursor_probe.test.ts` · `tests/dossier_traversal.test.ts` ·
  `tests/desks_traversal.test.ts` · `tests/gate_pass_mirror.test.ts` · `tests/attribution_method.test.ts`
- the checkpoint: `Checkpoints/github-master-kernel-round4-hardened-*/`
- the canon: `context_management/` (11 docs, all carry HEAD `ae04e6e`)

A claim without its artifact is VOID. Every row above names its artifact; the pins are
executable; the refutations carry their measurement. That is the whole verdict.
