# CHECKPOINT STRUCTURE — github-master-kernel-ocr-hardened-final-20260923-011649

## §1 THE SEAL MODE
Mode A — the FULL-TREE copy (real files, not a manifest-only reference).

## §2 THE LAYOUT (path → what → count)
| path | what | count |
|---|---|---|
| `src/` | the kernel source | 20 .ts |
| `.githooks/` | the 8 gates (4 hooks + 4 libs) | 8 |
| `.github/` | the CI + CODEOWNERS | 3 |
| `gates/` `scripts/` | the fence-check + the audit scripts | 8 |
| `context_management/` | the 11 canon docs | 11 |
| the ship docs | the 6 ship docs | 6 |
| `packages/github-master-kernel/` | the DPL1 spec + wave-plan + blueprint | 3 |
| `.trident/` | the audits + the corpus + the scans + the verdict | 10+ |
| `DEPLOYED_SHA.txt` `CHECKPOINT_MANIFEST.md` | HEAD + per-hook sha256 + the state | 2 |

## §3 THE FILE COUNT GATE
Passes when: `src/` holds the full .ts tree · the 8 gates present · the 11 canon present · the 6 ship
docs present · the manifest + this structure doc present.

## §4 THE VERIFICATION AT SEAL
`bun test` 78/0 · `bunx tsc --noEmit` exit 0 · the P5 corpus 13/0 · the container 11 scenarios PASS ·
a real push REJECT(W-3) rc=1 · the 8 contexts unchanged · the ruleset 23838059 active.

## §5 THE PROVENANCE
Every file under `src/`, `.githooks/`, `.github/`, `gates/`, `scripts/` is a byte-copy of the
working tree at HEAD b754b06. The `.trident/` artifacts are the campaign's own
evidence.

## §6 HOW TO RESTORE
`cp -r <this dir>/src/* <target>/src/` · `cp -r <this dir>/.githooks <target>/` · then
`git config core.hooksPath .githooks`. Verify against `DEPLOYED_SHA.txt`.

## §7 THE HONEST LIMITS
No `dist/` (none exists — the hooks ARE the artifact) · no node_modules (reproducible via
`bun install --frozen-lockfile`) · no credentials (out-of-band by law) · no publisher live-POST
evidence (never exercised).
