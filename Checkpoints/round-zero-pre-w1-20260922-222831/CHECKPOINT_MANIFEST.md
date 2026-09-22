# ROUND-ZERO CHECKPOINT — pre-W1 (the GitHub Master Kernel build)

**Created:** 2026-09-22T18:28:32Z
**Repo:** jarvis-upper @ `d71cc5d`
**Branch:** main · **ahead of origin:** 11

## THE STATE

| the artifact | the measured value |
|---|---|
| tsc | exit 0 |
| the battery | 69 pass / 0 fail / 250 expects |
| the contract | 7 contexts |
| the hooks | 4 files, 755 |
| core.hooksPath | .githooks |
| the CI | gates.yml + drift.yml (never run) |
| the ruleset | 7 contexts, evaluate, 403 to arm |
| disk | 72 GB free |

## THE HONEST GAPS

- the CI has NEVER RUN (no remote runner)
- the ruleset is 403 (the free plan) — nothing arms
- the publisher has never made a real POST
- no container test exists
- 2 of the 4 hook firings were GATE DEFECTS (the artifact-class class)
- the build was UNauthorized until this pin; 12 of 16 waves landed

## THE RESTORE

```
cd /home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-FACTORY/jarvis-upper
git reset --hard d71cc5d   # the code
cp -r Checkpoints/round-zero-pre-w1-20260922-222831/src/* src/                                      # if the tree drifted
git config core.hooksPath .githooks                       # re-arm the hooks
```

## THE SEAL MODE

no-lock (the build is active; a full-tree lock would block W1)
