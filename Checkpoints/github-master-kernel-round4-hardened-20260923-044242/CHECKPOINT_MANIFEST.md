# CHECKPOINT MANIFEST — Checkpoints/github-master-kernel-round4-hardened-20260923-044242

**SEALED:** 2026-09-23T04:43:04Z · **HEAD:** `75d1dba3b97937a9a574e4b5028c1e27adf70751` (branch `feat/github-master-kernel`) · **MODE:** full-tree (src + tests + hooks + gates + scripts + canon + ship docs + the spec package).

## §1 THE STATE AT SEAL (measured this session)

| the artifact | the measurement |
|---|---|
| `bunx tsc --noEmit` | **exit 0** |
| `bun test` | **85 pass / 0 fail** |
| the P5 corpus (the deployed hooks) | **13 pass / 0 fail** |
| the W-13 silent-fallback scanner | **0 hits** |
| the ocr CONFIRMED criticals | **0** (3 closed this campaign: the rail cursor, the spec path, the cross-domain sha) |
| the ocr CONFIRMED highs | **0** (the ~20 closed; 2 REFUTED with their measurements) |
| the 8 status contexts | UNCHANGED (`src/status-contract.ts` — the contract freeze held) |
| the ruleset | 23838059 (unchanged) |

## §2 WHAT THIS CAMPAIGN BUILT

The round-4/5 ocr scans (the deep surface the earlier rounds missed — `dossier`, `desks`,
`reducers`, `status`, `store`, `main`, `spec-diff`, `shape_freeze`) closed **3 CRITICAL + ~20
HIGH**, each at the INVARIANT and each pinned by a watched test. The three criticals:
1. **`src/runtime.ts` — the daemon's silent event stall.** `defaultRails` fetched `after=0`
   every tick; with the 64 KB cap it re-read the same window forever and events beyond it
   were NEVER fetched. Now reads the `rail_seq` cursor. Pin: `tests/probe/cursor_probe.test.ts`.
2. **`scripts/spec-diff.ts` — the required gate that never measured.** The spec resolved ONE
   LEVEL ABOVE the repo (a host path absent from CI), so `gates/spec-gate` always exited 2.
   The mission spec is vendored in-repo (sha256 `55aebe6f3c54db5f`); the gates measure.
3. **`src/guardrail.ts` — the cross-domain staleness check.** STALE-GATE compared a SPEC
   invariant hash against a git sha (always unequal). A real `gate_pass.head_sha` column now
   carries the commit, and the LOCAL mirror is WIRED (synced from `guardrailRemote` each tick).

## §3 THE ARTIFACT-COUNT (the seal's contents)

- `src/` — 20 `.ts` (the kernel)
- `tests/` — 29 `.test.ts` (incl. the 4 new pins: cursor_probe, dossier_traversal,
  desks_traversal, gate_pass_mirror)
- `.githooks/` — 5 (4 hooks + the lib scanners)
- `gates/` + `scripts/` — the 8-gate chain + the spec-gate helpers
- `context_management/` — 11 canon docs (all carry HEAD `75d1dba`)
- the ship docs (6) + `.trident/OCR_ADJUDICATION.md`
- `packages/` — the build package + the vendored mission spec

## §4 HONEST GAPS (stated in the same breath as the claims)

1. **The ocr gate's RAW count is not zero.** The CONFIRMED critical/high count is zero; the
   raw scanner count mixes real defects with REFUTED false positives (each refutation carries
   its measurement in `.trident/OCR_ADJUDICATION.md`). The convergence table: the confirmed
   count fell 6 → 11 → 3 → 2 → 1 → 0 across the campaign.
2. **No container test this campaign.** The changes are covered by the script battery (85/0)
   + the P5 corpus (13/0) + the 4 new pins; the container rig was not re-run for these hunks.
3. **The full-tree ocr scan times out** (>1500 s on one provider pass) — the coverage is run
   as scoped scans (src · .githooks · scripts/gates/.github), each of which completes.
4. **The 2 factory/* contexts** are posted by the W5 publisher; the mirror now records them,
   but the end-to-end GitHub round-trip was not re-exercised this session.

## §5 HOW A FRESH AGENT RESUMES

Read, in order: `packages/github-master-kernel/DPL1_SPEC.md` → `.trident/OCR_ADJUDICATION.md`
→ `context_management/CURRENT_STATE.md` → the ship docs. The pins are the executable record:
`bun test` (85/0) proves the current state; each fix's test is named in the adjudication.
