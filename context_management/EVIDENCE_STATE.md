# EVIDENCE STATE — jarvis-upper (W4)

This doc is the **per-gate evidence with exact tokens**. Copy these tokens and
re-run the commands — they MUST reproduce. If a token does not reproduce, the
gate is not actually PASS.

---

## 1. AO DAEMON (G8, G8b)

| Check | Command | Token (VERBATIM) | Status |
|-------|---------|-------------------|--------|
| AO healthz | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` | `200` | PASS |
| AO introspection | AO introspection | `144 paths / 164 ops / 269 schemas` | PASS |
| AO SSE | `GET /api/v1/events?after=0` | live push stream | PASS |
| AO merge model | AO semantics | `explicit-only` (no webhook/notifier/plugin surface) | PASS |

> The AO daemon is the worker factory ("Jarvis Core"). `autoReview: true` is an
> AO-level default, NOT a plugin surface — AO has no plugin surface.

## 2. GATE: does_anything_run (G1)

| Field | Value |
|-------|-------|
| Command | `bash gates/does_anything_run.sh .` |
| Token (VERBATIM) | `VERDICT:RUNS (fail=0)` |
| Status | PASS |
| Operator law | "Never once asked does anything run? — THIS IS THE ONLY THING THAT MATTERS." (D-002) |

## 3. GATE: shape_freeze (G2)

| Field | Value |
|-------|-------|
| Command | `bash gates/shape_freeze.sh .` |
| Token (VERBATIM) | `SHAPES:all declared ids implemented` |
| Status | PASS |

## 4. GATE: orphan_scan (G3)

| Field | Value |
|-------|-------|
| Command | `bash gates/orphan_scan.sh .` |
| Token (VERBATIM) | `ORPHANS=0` |
| Status | PASS |

## 5. TYPECHECK (G4)

| Field | Value |
|-------|-------|
| Command | `bunx tsc --noEmit` |
| Token (VERBATIM) | exit 0 |
| Status | PASS |

## 6. BATTERY (G5)

| Field | Value |
|-------|-------|
| Command | `bun test` |
| Token (VERBATIM) | `52 pass / 0 fail / 183 expects / 16 files (jarvis-upper)` |
| Status | PASS |

## 7. TWO-SOURCE VERDICT — fence half (G6)

| Field | Value |
|-------|-------|
| Command | `bun test -t two_source_verdict` |
| Token (VERBATIM) | `8 pass / 0 fail` |
| Status | PASS |

`src/verdict.ts`:

```ts
function verify({ jobDir, headSha, sessionId }): boolean {
  // VERIFIED iff BOTH:
  // (1) fence2 adjudicate <job> --expect-spec-sha <headSha> exits 0   (G10)
  // (2) AO review run approves the SAME headSha                       (G11)
}
```

## 8. JFM VERBS (G7)

| Field | Value |
|-------|-------|
| Command | `bun test -t jfm_verbs` |
| Token (VERBATIM) | `8 pass / 0 fail` |
| Verbs | `health|status|watch|pin|dispatch|steer|abort|pr|gate|board|wave` |
| JFM repo | `/home/leviathan/JARVIS_WORKSPACE/jfm/` (branch main) |
| JFM symlink | `~/.local/bin/jfm` |
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts` (IMPORTED) |
| Status | PASS |

## 9. RUNTIME (G9)

| Field | Value |
|-------|-------|
| Command | `UPPER_TICK_MS=3000 bun src/main.ts` (pane) + `bun src/cli.ts status` |
| Token (VERBATIM) | `RUNNING (tick >3000)` |
| State files | `runtime/status.json`, `runtime/ticks.log`, `runtime/wire_capture.json` |
| wire_capture frozen frame | `parsedFrames=168, bytes=65638` |
| Status | PASS |

## 10. FENCE2 ADJUDICATE (G10)

| Field | Value |
|-------|-------|
| Command | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| Job | `upper-tier-dt-shapes` |
| Head sha | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| Token (VERBATIM, ledger row) | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` |
| Verdict | PASS |
| Ledger | `Shared_Workspace/JARVIS-CORE/b6/verdicts.jsonl` |
| Status | PASS |

> The fence sandbox is `bwrap --unshare-all` — NO network. Network-dependent
> done-when steps fail there BY DESIGN; DB_1's hermetic step runs offline.
> This is why the two-source law exists: fence2 is hermetic but not
> peer-reviewed; AO review is peer-reviewed but not hermetic.

## 11. AO REVIEW APPROVES SAME SHA (G11)

| Field | Value |
|-------|-------|
| Where | AO dashboard "Reviews" tab on repo `jarvis-upper` |
| Must prove | `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| Status | OPEN |
| Why OPEN | AO review run for PR #1 has not yet produced an approval record for this sha. |

> This is the OTHER half of the two-source law. Do NOT claim VERIFIED without it.
> The operator's ruling (D-004) is Boolean FALSE unless BOTH G10 and G11 pass on
> the same sha.

## 12. PR #1 (G12)

| Field | Value |
|-------|-------|
| URL | `https://github.com/leviathan-devops/jarvis-upper/pull/1` |
| Branch | `ao/jarvis-upper-2/root` |
| Commits | `760ad1b`, `732083e`, `adbdacf` |
| Head sha | `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` |
| Status | OPEN |
| Job that fixed it | `jarvis-upper-2` (worker/omp/tui, profile `jarvis-worker`) fixed the DT-shapes drift bug (EN-001) |
| Reviewer config | `autoReview: true`, `reviewers: [{"harness":"muse"}]` (AO REJECTS `omp` harness) |

## 13. jfm-e2e-1 PROOF (separate repo)

| Field | Value |
|-------|-------|
| PR | `https://github.com/leviathan-devops/jfm-e2e/pull/1` |
| Commit | `cce7bdb` |
| Proof file | `E2E-PROOF.txt` = `DT1-OK` |
| Meaning | First end-to-end spawn→commit→push→PR by a factory worker |

## 14. WORKER PROFILE PIN (G15)

| Field | Value |
|-------|-------|
| File | `~/.omp/profiles/jarvis-worker/agent/config.yml` |
| default / task | `poolside/poolside/laguna-s-2.1:high` (Poolside DIRECT) |
| sonic / reviewer / plan / slow | `opencode-zen-free/muse-spark-1.3-contributor-free:xhigh` |
| smol / scout | `openrouter/nvidia/nemotron-3.5-lightning:free` |
| Env on spawn | `OMP_PROFILE=jarvis-worker` |
| Global omp default (NOT a worker) | `~/.omp/agent/config.yml` → `default: verboo/deepseek-v4.1-flash:max` |

## 15. AO REVIEW DEFAULTS (G16)

| Field | Value |
|-------|-------|
| Config | `autoReview: true` |
| Reviewers | `[{"harness":"muse"}]` |
| AO-rejected harness | `omp` → `INVALID_PROJECT_CONFIG: unknown harness "omp"` |
| Reviewer-capable installed | muse (primary), aider, cursor |

## 16. THE FORBIDDEN EVIDENCE SET (cite NEVER)

The operator explicitly forbade these as verification gates (D-003):

| Forbidden claim | Why forbidden |
|-----------------|---------------|
| commit-exists | "theatrical bullshit" — not tangible verification |
| diff-changed | "this is all theatrical bullshit. explicitly forbid this as a verification gate." |
| tests-pass | "this is NOT tangible verification evidence." |
| PR-open | forbidden — a PR being open is not verification of the two-source law |

> Accepted verification evidence is ONLY: fence2 adjudicate exit 0 (G10) AND
> AO review approval of the same sha (G11). Both. Boolean FALSE otherwise.

## 17. HONEST GAPS (what is NOT proven yet)

| Gap | Status |
|-----|--------|
| G11: AO review approval of `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | OPEN — not yet observed |
| G14 (G14): `upper sync` de-stubbed | BLOCKED — EN-010 (returns prNodes 0 while PR open) |
| G13: spec-audit gate invoked per job | BLOCKED — pending trigger |

## 18. REPRODUCTION SCRIPT (one batch)

```bash
cd /home/leviathan/JARVIS_WORKSPACE/jarvis-upper

echo "=== G8 AO ==="
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/healthz

echo "=== G1 ==="
bash gates/does_anything_run.sh .

echo "=== G2 ==="
bash gates/shape_freeze.sh .

echo "=== G3 ==="
bash gates/orphan_scan.sh .

echo "=== G4 ==="
bunx tsc --noEmit; echo "exit=$?"

echo "=== G5 ==="
bun test

echo "=== G6 ==="
bun test -t two_source_verdict

echo "=== G7 ==="
bun test -t jfm_verbs

echo "=== G9 ==="
bun src/cli.ts status

echo "=== G10 ==="
/home/leviathan/JARVIS_WORKSPACE/Shared_Workspace/JARVIS-CORE/b6/fence2.py \
  adjudicate upper-tier-dt-shapes \
  --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
```

End of EVIDENCE_STATE.
