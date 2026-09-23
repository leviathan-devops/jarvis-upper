# CHECKPOINT STRUCTURE — github-master-kernel-ocr-hardened-20260922-232253

## §1 THE SEAL MODE
**Mode A — the FULL-TREE copy.** This checkpoint carries the real files (not a manifest-only
reference): the source, the enforcement layer, the docs, the build package, and the evidence
artifacts. A manifest-only checkpoint would break the moment the working tree changed; this one is
self-contained.

## §2 THE LAYOUT (path → what → the count)
| path | what | the measured count |
|---|---|---|
| `src/` | the kernel source | 20 `.ts` files |
| `.githooks/` | the 8 local gates — 4 hooks + 4 libs | 8 files |
| `.github/` | the CI workflows + CODEOWNERS | 3 files |
| `gates/` | the fence-check + the shell gates | 5 files |
| `scripts/` | the spec-audit / interface-check / spec-diff | 3 files |
| `W6_ARM_COMMAND.sh` | the ruleset arm command | 1 file |
| `context_management/` | the 11 canon docs | 11 files |
| the ship docs | BUILD_REPORT · DEBUG_LOG · FAILURE_LOG · SPEC_VIOLATION_LOG · TESTING_LOG · THEATRICALITY_LOG | 6 files |
| `packages/github-master-kernel/` | the DPL1 spec + wave-plan + blueprint | 3 files |
| `.trident/` | the wave audits · the container results · the P5 corpus · the findings digests | 6+ files |
| `DEPLOYED_SHA.txt` | HEAD + the per-hook sha256 | 1 file |
| `CHECKPOINT_MANIFEST.md` | the state + the HONEST GAPS | this dir |

## §3 THE FILE COUNT GATE
The structure gate passes when: `src/` holds the full `.ts` tree (20) · the 8 gates are present ·
the 11 canon docs are present · the 6 ship docs are present · the manifest and this structure doc
both exist. A checkpoint missing any of these is INCOMPLETE.

## §4 THE VERIFICATION AT SEAL (the numbers, quoted from the runs)
- `bun test` → **78 pass / 0 fail / 335 expects / 25 files**
- `bunx tsc --noEmit` → **exit 0**
- the P5 corpus (`.trident/p5_corpus2.sh`) → **13 pass / 0 fail**
- the container test (`jarvis-upper-ct`) → **11 scenarios PASS**
- a REAL `git push` of a new branch with a phantom → **REJECT(W-3) rc=1**
- the 8 status contexts → **unchanged**; the live ruleset 23838059 → **active, bypass_actors []**

## §5 THE PROVENANCE
Every file under `src/`, `.githooks/`, `.github/`, `gates/`, `scripts/` is a byte-copy of the
working tree at HEAD `a533bf7` (the checkpoint commit) — verified by `diff -rq` at copy time. The
`.trident/` artifacts are the campaign's own evidence (the audit, the corpus, the container
results), not re-derivations.

## §6 HOW TO RESTORE
`cp -r <this dir>/src/* <target>/src/` · `cp -r <this dir>/.githooks <target>/` · then
`git config core.hooksPath .githooks` in the target. The `DEPLOYED_SHA.txt` names the exact HEAD
and the per-hook sha256 to verify the restore is byte-identical.

## §7 THE HONEST LIMITS
This checkpoint does NOT carry: a `dist/` bundle (there is none — the hooks ARE the artifact) ·
the node_modules tree (reproducible via `bun install --frozen-lockfile`) · the provider credentials
(out-of-band by law) · the publisher's live POST evidence (never exercised). The manifest's HONEST
GAPS section names the campaign-level residuals.
