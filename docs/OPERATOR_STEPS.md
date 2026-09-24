# OPERATOR STEPS — the human's part of the factory loop

The factory DECIDES (order, fence, review); a human DECIDES readiness. This document is the
operator's manual for the three human steps, the kernel's tick loop they feed, and the
recovery table. Every refusal is NAMED so a failure is never a shrug.

The kernel is `jarvis-upper` (a TypeScript daemon under `src/`), driven by the AO daemon
(`:3001`) and gated by `fence2.py`. The store is `store.sqlite` (WAL).

## 0. The loop, end to end

```
 AO session ──▶ listPrsFromAo ──▶ syncPrs ──▶ pr_node(state=open)
                                                    │
                        upper promote <id> ─────────┘   (a HUMAN decides readiness)
                                                    ▼
                                            pr_node(state=ready_to_merge)
                                                    │
                              upper order ──────────┘   (the factory DECIDES the order)
                                                    ▼
                            guardrail (the fence + review two-source law)
                                                    │
                              upper order --execute ┘   (ORDER, never merge)
                                                    ▼
                                            pr_node(state=merge_ordered)
                                                    │
                    the HUMAN merges on GitHub ─────┘
                                                    ▼
                        the ledger row binds the merge ──▶ pr_node(state=merged)
```

The factory never writes `merged` (only the merge-record path, after a real merge commit is
observed). This is the inversion: **the factory ORDERS, the human MERGES** — see
`src/guardrail.ts:56` (the DEP-UNMERGED check accepts `merge_ordered` as satisfied because
the order is the factory's last act).

## 1. Promote a PR to eligible — `upper promote <pr_node id>`

A PR enters `open` when the sync first sees it (src/sync.ts:34). It becomes ELIGIBLE for the
merge order only when a human promotes it — the factory never promotes itself
(src/cli-verbs.ts:123).

```
upper promote pr:<project>:<n>
```

- success → `{ok:true, promoted, head_sha, note:"eligibility only — the fence+review must still verify"}`
- refusals (each named, exit 1):
  - `NO-SUCH-PR` — no row with that id
  - `NO-HEAD-SHA` — a row with no head sha cannot be bound to a fence (src/cli-verbs.ts:140)
  - `NOT-PROMOTABLE:<state>` — only an `open` row promotes (src/cli-verbs.ts:142)

The `ready_to_merge` state is the ONLY input to `upper order` (src/plan.ts:8). A row that was
hand-INSERTed into `ready_to_merge` skipped this step — that is the F-19 defect the verb
exists to close: a green produced by a hand-insert was reported as the kernel's own work.

## 2. Kick a bug fix — `upper kick <bug-id> [--mode live|spawn|direct]`

Dispatch a recorded bug to a fixer. The dossier hash gates it: the kick REFUSES
(`DOSSIER-TAMPER`) unless `dossier.md`+`origin.json` hash-match `manifest.sha16`
(src/kick.ts:53). Validation runs BEFORE any file read (src/kick.ts:39).

```
upper kick <bug-id>                 # mode auto: live if the origin session is alive, else spawn
upper kick <bug-id> --mode direct
```

| mode | transport | what happens |
|---|---|---|
| `live` | AO `sendSessionMessage` | the brief is sent into the origin session |
| `spawn` | AO `spawnSession` | a fresh fixer session is spawned |
| `direct` | local git | a `fix/<bug-id>` branch is opened |

The adapter that binds these is `src/kick-adapter.ts:1` (R9: before this, `verbKick` always
answered `KICK-ADAPTER-UNWIRED` — a stub wearing a feature's shape).

Refusals: `KICK-NEEDS-BUG-ID` · `NO-SUCH-BUG` · `NO-DOSSIER-PATH` ·
`KICK-FAILED:DOSSIER-TAMPER` · `KICK-FAILED:DOSSIER-PATH-MISMATCH` · `KICK-FAILED:BUG-UNKNOWN`.

## 3. Run the runtime preflight — `bash gates/rt-preflight.sh`

Run at session start. It refuses (exit 1, named) when the runtime is not greenable:

| check | refusal |
|---|---|
| the AO daemon (:3001) | `AO daemon DOWN` |
| the kernel service | `kernel service is DOWN` |
| the publisher token | `publisher token missing` |
| the fence recipe | `fence cannot go green on the fixture` |
| the session worktrees | `worktree <x> has NO SPEC.md` |

The last check is the R7 fix (gates/rt-preflight.sh:54): a worktree the kernel will
adjudicate but that carries no `SPEC.md` makes every PR post `factory/fence2=failure` forever
(FENCE-NO-SPEC) with nobody told why. A worktree that exists but has no fence job is a NAMED
refusal. Set `UPPER_WORKTREE_ROOT` to point the check at a non-default worktree root.

## 4. The tick loop (what the kernel does on its own)

`src/runtime.ts` runs a tick every `tickMs`. Each tick:

1. probes the daemon (`probe`), lists PRs, syncs them into `pr_node`
2. captures the event rails (the SSE stream) — a truncation is NAMED `TRUNCATED-<N>`
   (src/runtime.ts:113), never a silent clean read
3. publishes the two `factory/*` statuses for every eligible PR (only when a caller supplies
   `publishOpts` — a bare tick never POSTs to GitHub)
4. writes the status file; a write failure is SURFACED in the returned status, never swallowed
   (src/runtime.ts:390)

A tick that throws still writes its status (with `tick-threw`), so a file reader never sees a
stale-but-healthy status.

## 5. Troubleshooting

| symptom | cause | action |
|---|---|---|
| `FENCE-NO-SPEC` on every PR | a worktree with no SPEC.md | write one (see the preflight refusal) |
| every PR posts `factory/fence2=failure` | the fence job is absent or misnamed | check `job:` in the SPEC matches the ledger row |
| the publisher never posts | `publishOpts` absent, or the token missing | run the preflight; check `~/.config/jarvis-upper.env` |
| `KICK-ADAPTER-UNWIRED` | (retired) | if seen, the adapter import is broken |
| a PR is `open` but never orders | it was never promoted | `upper promote <id>` |
| `TARGET-MISMATCH` at startup | the tree's origin is a different repo | check `OWNER`/`REPO` env vs `git remote get-url origin` |

## 6. Environment

| var | meaning |
|---|---|
| `AO_DAEMON` | the AO daemon base URL (default `http://localhost:3001`) |
| `GH_TOKEN` | the publisher token (from `~/.config/jarvis-upper.env`) |
| `UPPER_STORE` | the sqlite path (default `<repo>/store.sqlite`) |
| `UPPER_WORKTREE_ROOT` | the worktree root the preflight scans |
| `UPPER_PROJECT_ID` | the project id a spawn-kick uses |

## 7. Anchor index

- the promote verb — src/cli-verbs.ts:123
- the kick verb + adapter — src/cli-verbs.ts:130, src/kick-adapter.ts:1
- the preflight (incl. the R7 fence-job check) — gates/rt-preflight.sh:54
- the sync + the merged clamp — src/sync.ts:34, src/sync.ts:11
- the tick + the surfaced write failure — src/runtime.ts:390
- the order planner — src/plan.ts:8
- the guardrail (the two-source law) — src/guardrail.ts:56
