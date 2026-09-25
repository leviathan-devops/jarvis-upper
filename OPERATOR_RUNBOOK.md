# OPERATOR RUNBOOK — jarvis-upper

**For a zero-context operator.** Every command below is COPY-PASTEABLE and its expected output
is stated. If an output does not match, the named diagnosis is in the table at the end.

---

## 1 · WHAT THIS SYSTEM DOES (one paragraph)

`jarvis-upper` is a **merge gate**. It watches GitHub PRs, verifies each one through TWO
independent sources (a `fence2` adjudication of a committed artifact + an LLM review), and
POSTS two GitHub commit statuses — `factory/fence2` and `factory/verdict`. GitHub's ruleset
requires **8 contexts** to be green before a PR can merge: the 6 `gates/*` CI jobs (posted by
GitHub Actions) plus these 2 `factory/*` statuses (posted by this daemon). The daemon runs as a
systemd user service and ticks every 15 s.

**THE CORE LAW:** the factory NEVER merges. It certifies. A human merges.

---

## 2 · IS IT ALIVE?

```console
$ systemctl --user is-active jarvis-upper
active
$ cat runtime/status.json
{"ts":"...","tick":365,"daemonOk":true,"cursor":1050,"prNodes":11,
 "ready":1,"eligible":1,"planHash":"5d57ef06cef90b7c","planKind":"ok","kicks":0,"errors":[]}
```

**READ THESE FIELDS, NOT `errors`:**
- `daemonOk: true` — the daemon reached the AO daemon.
- `tick` — MUST advance between two reads 20 s apart. A frozen `tick` = a hung tick.
- `ready` — PRs an operator has PROMOTED. **0 is normal until you promote.**
- `eligible` — promoted PRs whose gates are all green locally. **0 is normal until you promote.**
- `planHash` — the hash of the merge plan. **`e3b0c44298fc1c14` IS `sha256("")`** — the
  EMPTY plan. That is the IDLE-GREEN: `errors:[]` with an empty plan means NO WORK, not health.
- `errors: []` — the tick's errors. **An empty list does NOT mean healthy** (see `planHash`).

---

## 3 · THE BOOT LINE (the publisher's arm state)

```console
$ journalctl --user -u jarvis-upper --since '-1min' | grep started
{"started":true,"root":".../jarvis-upper","tickMs":15000,
 "publisher":"ARMED:leviathan-devops/jarvis-upper", ...}
```
`ARMED` = the token was found and the publisher will POST. `DISARMED:no-token` = no GH_TOKEN.

---

## 4 · THE OPERATOR'S PROMOTION STEP (the ONLY way a PR becomes eligible)

```console
$ bun src/cli.ts promote pr:<session>:<pr-number>
{"ok":true,"promoted":"pr:jarvis-upper-4:2","head_sha":"c3c3ed0d...","note":"eligibility only"}
```
Then watch `ready` and `eligible` go to 1 in `runtime/status.json`. **Promotion is a HUMAN
decision** (the factory decides ORDER; a human decides READINESS). Nothing auto-promotes.

---

## 5 · FIRING A KICK (dispatch a bug fix to an AO worker)

```console
$ bun src/cli.ts kick <bug-id> [live|spawn|direct]
{"ok":true,"bugId":"LIVE-KICK-1","mode":"spawn","target":"jarvis-upper-5","dossierSha16":"93abd276f88e0edb"}
```
Prerequisites: a `bug_record` row + a dossier (see `src/dossier.ts writeDossier`). The kick
REFUSES on a tampered dossier (`DOSSIER-TAMPER`), a dead session (`KICK-LIVENESS-DEAD`), or a
transport failure (`KICK-LIVENESS-UNKNOWN` — it will NOT spawn a duplicate).

---

## 6 · THE VERIFY CHAIN (proving the factory's job end-to-end)

```console
$ bun src/cli.ts gates
{"ok":true,"ready":1,"eligible":1,"checks":[{"pr":"...","ok":true,"reasons":[]}]}
$ gh pr view <n> --repo leviathan-devops/jarvis-upper --json mergeable,reviewDecision
{"mergeable":"MERGEABLE","reviewDecision":"REVIEW_REQUIRED"}
```
`MERGEABLE` = every required check is green. `REVIEW_REQUIRED` = the operator must approve.

---

## 7 · THE DIAGNOSIS TABLE

| the symptom | the layer | the command | the remedy |
|---|---|---|---|
| `tick` frozen | the tick hung | `journalctl --user -u jarvis-upper -n 50` | restart the unit; report the hang |
| `planHash` = `e3b0c44298fc1c14` | the EMPTY plan (no promoted PRs) | `bun src/cli.ts gates` | promote a PR (section 4) |
| `eligible:0` with `ready:1` | a gate is not green | `bun src/cli.ts gates` (it names the reason) | fix the named gate |
| `GATE-MISSING:ci_green` | the CI contexts are not green | `gh api .../commits/<sha>/check-runs` | wait for CI; re-run a failed job |
| `DISARMED:no-token` | no credential | `ls ~/.config/jarvis-upper.env` | provision GH_TOKEN (operator) |
| `FATAL: TARGET-...` | the tree's origin != the config | `git remote get-url origin` | set UPPER_OWNER/UPPER_REPO |
| `REJECT(G-RT): ...SPEC.md` | a worktree has no fence job | `bash gates/rt-preflight.sh` | write a SPEC.md naming a committed artifact |
| the audit gate BLOCKED | the Go workspace privacy gate | (see HT-BUG-20) | opencode.ai → workspace Privacy settings (operator) |

---

## 8 · THE EXTERNAL DEPENDENCIES (outside this tree)

| dependency | path | what breaks without it |
|---|---|---|
| the fence adjudicator | `JARVIS-CORE/b6/fence2.py` | `factory/fence2` cannot adjudicate |
| the fence ledger | `JARVIS-CORE/b6/verdicts.jsonl` | no PASS row → the fence refuses |
| the AO daemon | `http://localhost:3001` | the rail + the kick transport are dead |
| the per-session worktrees | `~/.ao/data/worktrees/<repo>/<session>` | no jobDir → no verify |

---

## 9 · THE HONEST RESIDUALS (what is NOT proven)

1. **`eligible` reads 0 until an operator promotes** — by design.
2. **No PR has completed a full merge through the factory** — the checks are green
   (`MERGEABLE`), the operator's approval is the last step.
3. **The `muse-go` audit lane is BLOCKED** by the workspace privacy setting (HT-BUG-20).


---

## 10 · THE SOURCE ANCHORS (where each behavior lives)

| the behavior | the anchor |
|---|---|
| the entry point + the publisher arming | src/main.ts:60 |
| the tick loop + the status write | src/runtime.ts:290 |
| the eligibility chain (statuses + check-runs) | src/guardrail.ts:127 |
| the publish dedup hook | src/runtime.ts:230 |
| the two-source verdict | src/verdict.ts:247 |
| the fail-closed target guard | src/target-guard.ts:128 |
| the kick decision (the tri-state liveness) | src/kick.ts:66 |
| the AO transport (spawn/send/attachments) | src/kick-adapter.ts:20 |
| the schema + the POST_REBUILD dedupe | src/store.ts:63 |
| the preflight gate | gates/rt-preflight.sh:58 |
| the local enforcement hooks | .githooks/pre-commit |
| the 8-context contract | src/status-contract.ts:47 |
