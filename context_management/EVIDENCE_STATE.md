# EVIDENCE STATE — jarvis-upper (W4)

This doc is the **per-gate evidence with exact tokens**. Copy these tokens and
re-run the commands — they MUST reproduce. If a token does not reproduce, the
gate is not actually PASS. All SHAs quoted verbatim.

---

## 1. AO DAEMON (G8, G8b)

| Check | Command | Token (VERBATIM) | Status |
|-------|---------|-------------------|--------|
| AO healthz | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` | `200` | PASS |
| AO introspection | introspection | `144 paths / 164 ops / 269 schemas` | PASS |
| AO SSE | `GET /api/v1/events?after=0` | live push stream | PASS |
| AO merge model | AO semantics | `explicit-only` (no webhook/notifier/plugin surface) | PASS |

> The AO daemon is the worker factory ("Jarvis Core"). `autoReview: true` is an
> AO-level default, NOT a plugin surface — AO has no plugin surface. Reviewer
> harness is `muse` (AO REJECTS `omp` → `INVALID_PROJECT_CONFIG`).

## 2. GATE: does_anything_run (G1)

| Field | Value |
|-------|-------|
| Command | `bash gates/does_anything_run.sh .` |
| Token (VERBATIM) | `VERDICT:RUNS (fail=0)` |
| Status | PASS |
| Operator law | "Never once asked does anything run? — THIS IS THE ONLY THING THAT MATTERS." (D-002) |
| file:line | `gates/does_anything_run.sh:1-49` |

## 3. GATE: shape_freeze (G2)

| Field | Value |
|-------|-------|
| Command | `bash gates/shape_freeze.sh .` |
| Token (VERBATIM) | `SHAPES:all declared ids implemented` |
| Status | PASS |
| file:line | `gates/shape_freeze.sh:1-50` |

## 4. GATE: orphan_scan (G3)

| Field | Value |
|-------|-------|
| Command | `bash gates/orphan_scan.sh .` |
| Token (VERBATIM) | `ORPHANS=0` |
| Status | PASS |
| file:line | `gates/orphan_scan.sh:1-35` |
| EN-007 note | ripwire crawl EXCLUDES jarvis-upper; this gate is local, not graph. |

## 5. TYPECHECK (G4)

| Field | Value |
|-------|-------|
| Command | `bunx tsc --noEmit` |
| Token (VERBATIM) | exit 0 |
| Status | PASS |
| Scope | whole jarvis-upper tree |

## 6. BATTERY (G5)

| Field | Value |
|-------|-------|
| Command | `bun test` |
| Token (VERBATIM) | `52 pass / 0 fail / 183 expects / 16 files (jarvis-upper)` |
| Status | PASS |
| file:line | `tests/*.ts` (16 files, lines listed in BUILD_STATE.md §3.8) |
| Operator law | "test needs to enforce by default." (D-006) |

## 7. TWO-SOURCE VERDICT — fence half (G6a) + impl (G6)

| Field | Value |
|-------|-------|
| Command | `bun test -t two_source_verdict` |
| Token (VERBATIM) | `8 pass / 0 fail` |
| Status | PASS |
| file:line | `tests/two_source_verdict.test.ts:1-111` + `src/verdict.ts:1-184` |

`src/verdict.ts:1-184`:

```ts
function verify({ jobDir, headSha, sessionId }): boolean {
  // VERIFIED iff BOTH:
  // (1) fence2 adjudicate <job> --expect-spec-sha <headSha> exits 0   (G10)
  // (2) AO review run approves the SAME headSha                       (G11)
  return fence2Exit0 && aoReviewApprovedSameSha;
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
| JAM desk core | `Shared_Workspace/JARVIS/src/desk-orchestrator.ts:1-1080` (IMPORTED) |
| file:line | `tests/jfm_verbs.test.ts` (JFM repo) + `jfm/src/cli.ts:1-155` |
| Status | PASS |

## 9. RUNTIME (G9)

| Field | Value |
|-------|-------|
| Command | `UPPER_TICK_MS=3000 bun src/main.ts` (pane) + `bun src/cli.ts status` |
| Token (VERBATIM) | `RUNNING (tick >3000)` |
| State files | `runtime/status.json:1-13`, `runtime/ticks.log:1-5005`, `runtime/wire_capture.json:1-7` |
| wire_capture frozen frame | `parsedFrames=168, bytes=65638` |
| file:line | `src/main.ts:1-19` → `src/runtime.ts:1-150` → `src/status.ts:1-48` |
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
| file:line | `Shared_Workspace/JARVIS-CORE/b6/fence2.py:1-966` |
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
| Operator law | D-004: Boolean FALSE unless BOTH G10 and G11 pass on the same sha. |

> This is the OTHER half of the two-source law. Do NOT claim VERIFIED without it.

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
| file:line | (GH PR — not a local file) |

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
| Config | `autoReview: true` (`jarvis-upper/.omp/config.yml`) |
| Reviewers | `[{"harness":"muse"}]` |
| AO-rejected harness | `omp` → `INVALID_PROJECT_CONFIG: unknown harness "omp"` |
| Reviewer-capable installed | muse (primary), aider, cursor |

## 16. THE FORBIDDEN EVIDENCE SET (cite NEVER — D-003)

| Forbidden claim | Token that is REJECTED |
|-----------------|------------------------|
| commit-exists | D-003: "theatrical bullshit. explicitly forbid this as a verification gate." |
| diff-changed | D-003: same forbiddance |
| tests-pass | D-003: "this is NOT tangible verification evidence." |
| PR-open | D-003: forbidden |

> Accepted verification evidence is ONLY: fence2 adjudicate exit 0 (G10) AND
> AO review approval of the same sha (G11). Both. Boolean FALSE otherwise.

## 17. HONEST GAPS (what is NOT proven yet)

| Gap | Status |
|-----|--------|
| G11: AO review approval of `adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | OPEN — not yet observed |
| G14: `upper sync` de-stubbed | BLOCKED — EN-010 (returns prNodes 0 while PR open) |
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

## 19. TOKEN REPRO CHECKLIST

| Gate | Token | Reproduce? (re-run) |
|------|-------|---------------------|
| G8 | `200` | `curl /healthz` |
| G1 | `VERDICT:RUNS (fail=0)` | `bash gates/does_anything_run.sh .` |
| G2 | `SHAPES:all declared ids implemented` | `bash gates/shape_freeze.sh .` |
| G3 | `ORPHANS=0` | `bash gates/orphan_scan.sh .` |
| G4 | exit 0 | `bunx tsc --noEmit` |
| G5 | `52 pass / 0 fail / 183 expects / 16 files` | `bun test` |
| G6 | `8 pass / 0 fail` | `bun test -t two_source_verdict` |
| G7 | `8 pass / 0 fail` | `bun test -t jfm_verbs` |
| G9 | `RUNNING (tick >3000)` | `bun src/cli.ts status` |
| G10 | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` | fence2 adjudicate |

End of EVIDENCE_STATE.

---
<!-- CROSS-CONSISTENCY ANCHOR (all 11 canon docs carry this identical line) -->
- **factory head:** `98cd7aaf111781891e2e52ca822889bcfb503471` (jarvis-upper main) · **job head (PR #1):** `acc7a688b56cd2db7e28f28a19db800da8baf1be`
- **battery:** 56 pass / 0 fail · tsc 0 · gates RUNS/SHAPES/ORPHANS=0 green
- **source 1 (fence):** PASS `spec_bound:true` · **source 2 (review):** the real muse run on AO's rail (per-run verdict in the AO store)
- **review fixes applied:** byte-identical dup deleted · DT-1 prId derived + gate asserted · DT-3 proved loss+restart · DT-1 live opt-in · .aider* removed
