# TASK QUEUE — jarvis-upper (W4)

This doc is the **gates + evidence + status**. Each row is a gate that must be
satisfied before completion is accepted. Status values: `PASS` | `OPEN` |
`BLOCKED`. Evidence is the VERBATIM token.

---

## 1. THE GATE LIST

| Gate | Command | W4 token (VERBATIM) | Status | Evidence doc |
|------|---------|---------------------|--------|--------------|
| G1 does_anything_run | `bash gates/does_anything_run.sh .` | `VERDICT:RUNS (fail=0)` | PASS | EVIDENCE_STATE.md §2 |
| G2 shape_freeze | `bash gates/shape_freeze.sh .` | `SHAPES:all declared ids implemented` | PASS | EVIDENCE_STATE.md §3 |
| G3 orphan_scan | `bash gates/orphan_scan.sh .` | `ORPHANS=0` | PASS | EVIDENCE_STATE.md §4 |
| G4 typecheck | `bunx tsc --noEmit` | exit 0 | PASS | EVIDENCE_STATE.md §5 |
| G5 battery | `bun test` | `52 pass / 0 fail / 183 expects / 16 files` | PASS | EVIDENCE_STATE.md §6 |
| G6 two_source_verdict | `bun test -t two_source_verdict` | `8 pass / 0 fail` | PASS | EVIDENCE_STATE.md §7 |
| G7 jfm_verbs | `bun test -t jfm_verbs` | `8 pass / 0 fail` | PASS | EVIDENCE_STATE.md §8 |
| G8 AO up | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/healthz` | `200` | PASS | EVIDENCE_STATE.md §1 |
| G8b AO introspection | AO introspection | `144 paths / 164 ops / 269 schemas` | PASS | EVIDENCE_STATE.md §1 |
| G9 runtime alive | `bun src/cli.ts status` | `RUNNING (tick >3000)` | PASS | EVIDENCE_STATE.md §9 |
| G10 fence2 adjudicate | `fence2.py adjudicate upper-tier-dt-shapes --expect-spec-sha adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` | PASS | EVIDENCE_STATE.md §10 |
| G11 AO review approves same sha | AO dashboard "Reviews" | `approved_sha == adbdacf98b5cb1d57b0a802b57f756bf7d01c45b` | OPEN | EVIDENCE_STATE.md §11 |
| G12 PR #1 | GH PR #1 | `OPEN` (state) | OPEN | EVIDENCE_STATE.md §12 |
| G13 spec-audit (if invoked) | `bun run scripts/spec-audit.ts` | — | BLOCKED | pending trigger |
| G14 `upper sync` de-stub | `upper sync` returns real prNodes | — | BLOCKED | EN-010 |
| G15 worker profile pin | `cat ~/.omp/profiles/jarvis-worker/agent/config.yml` | default = poolside | PASS | EVIDENCE_STATE.md §14 |
| G16 AO review defaults | `jarvis-upper/.omp/config.yml` | autoReview:true, reviewers:muse | PASS | EVIDENCE_STATE.md §1 |

## 2. STATUS SUMMARY

| Status | Count | Gates |
|--------|-------|-------|
| PASS | 12 | G1–G10, G15, G16 |
| OPEN | 2 | G11, G12 |
| BLOCKED | 2 | G13, G14 |

## 3. THE TWO-SOURCE VERDICT (G10 + G11) — WHY BOTH

The operator's binding ruling (D-004):

> "THIS IS THE ONLY ACCEPTED VERIFICATION EVIDENCE. BOTH OF THESE. IF BOTH OF
> THESE DO NOT UNCONDITIONALLY PASS = REJECT. BOOLEAN FALSE."

This means:

- fence2 adjudicate exit 0 (G10) — the mechanical shell gate.
- AO review run approving the SAME head sha (G11) — the human-scale review.
- **One without the other is theatrical.** The operator explicitly forbade
  citing commit-exists / diff-changed / tests-pass / PR-open as verification (D-003).

Current frozen PASS row (do NOT invent a different sha):

```
job=upper-tier-dt-shapes
head=adbdacf98b5cb1d57b0a802b57f756bf7d01c45b
verdict=PASS
evidence=6954bafbd4918f75|sandbox=bwrap|spec_bound:true
```

## 4. EVIDENCE TOKENS (literal — paste these)

| Gate | Token |
|------|-------|
| AO healthz (G8) | `200` |
| AO introspection (G8b) | `144 paths / 164 ops / 269 schemas` |
| does_anything_run (G1) | `VERDICT:RUNS (fail=0)` |
| shape_freeze (G2) | `SHAPES:all declared ids implemented` |
| orphan_scan (G3) | `ORPHANS=0` |
| typecheck (G4) | exit 0 |
| battery (G5) | `52 pass / 0 fail / 183 expects / 16 files` |
| two_source_verdict (G6) | `8 pass / 0 fail` |
| jfm_verbs (G7) | `8 pass / 0 fail` |
| runtime status (G9) | `RUNNING (tick >3000)` |
| fence2 (G10) | `6954bafbd4918f75|sandbox=bwrap|spec_bound:true` |
| worker profile (G15) | default = `poolside/poolside/laguna-s-2.1:high` |
| AO review defaults (G16) | `autoReview:true`/`reviewers:[{"harness":"muse"}]` |

## 5. RISK REGISTER

| # | Risk | Likelihood | Impact | Mitigation | Linked defect |
|---|------|-----------|--------|------------|---------------|
| R1 | fence2 sandbox has NO network → network done-when steps fail offline | Certain | High | Keep network-dependent steps out of fence2; run DB_1's hermetic step offline | EN-008 context |
| R2 | `upper sync` returns prNodes 0 while a PR is open | Certain | Medium | Fix the stub (G14) before relying on sync | EN-010 |
| R3 | AO rejects `omp` as reviewer harness | Certain | High | Use `muse` (or aider/cursor) as the reviewer harness (D-005) | D-005 |
| R4 | Desk-local model pin invisible to AO spawns | Proven | High | NEVER pin models at desk level — the `jarvis-worker` profile is the only pin (D-008) | EN-019 |
| R5 | ripwire crawl EXCLUDES jarvis-upper → cannot graph-verify edits here | Proven | Medium | Use grep/tsc/battery + fence2 for jarvis-upper edits; graph gate applies to the Shared_Workspace only | EN-007 |
| R6 | AO daemon stale run-file + rotating X cookie | Proven | High | Use the daemon resume recipe in COMPACTION_SURVIVAL.md | EN-008 |
| R7 | PAT burned in session (embedded in a git remote URL, printed) | One-time | Critical | Operator must rotate; docs MUST NOT record credential material | D-008 / A-011 |
| R8 | Global omp config `~/.omp/agent/config.yml` still has deepseek default | By design | Low (non-worker) | That is the OPERATOR's omp; worker uses `jarvis-worker` profile | D-008 |
| R9 | AO review does not auto-trigger on PR update | Medium | Medium | Verify `autoReview:true` + reviewers:muse on PR event | D-005 |
| R10 | Any sha move invalidates G10 + G11 simultaneously | High (on next PR action) | High | Re-run BOTH fence2 + AO review on the new sha before any completion claim | D-004 |

## 6. QUEUED WORK (next-wave candidates)

| Task | Owner | Depends on | Gate |
|------|-------|------------|------|
| N1.1 Get AO review to approve frozen sha | Main / AO | — | G11 |
| N2.1 De-stub `upper sync` | worker | G13 analysis | G14 |
| N3.1 Confirm daemon resume recipe reproducible | CanonDocs | — | EN-008 |
| N5.1 Re-verify worker profile pin | CanonDocs | — | G15 |
| N6.1 `jfm watch` SSE tail | worker | — | G7 |
| N8.1 Update docs after sha move | CanonDocs | any sha move | doc truth |

## 7. HOW TO ADVANCE A GATE

1. Read DECISION_CHAIN.md — the operator has already ruled on acceptable evidence.
2. Do NOT cite forbidden evidence (commit-exists / diff-changed / tests-pass /
   PR-open). Only fence2 + AO review are accepted.
3. Fix the source. Re-run the SAME gate. Produce the token.
4. Record the token in EVIDENCE_STATE.md (append-only).
5. Only then mark the gate PASS and proceed.

## 8. GATES vs DEFECTS CROSSWALKS

| Defect | Gate that catches it | Status |
|--------|----------------------|--------|
| EN-001 client health() nonexistent op | G1 (does_anything_run) | FIXED |
| EN-003 no entry/loop | G1, G9 | FIXED |
| EN-006 idle stream flagged error | G1 | FIXED |
| EN-007 ripwire excludes jarvis-upper | G1, G3 | DOCUMENTED |
| EN-008 daemon stale run-file + X cookie | G1 (resume) | MITIGATED |
| EN-009 checkpoint re-ran | G5 | FIXED |
| EN-010 `upper sync` STUB | G14 | OPEN |
| EN-019 desk-local pin invisible | G15 | FIXED |
| EN-020 PAT burned | (operator) | OPEN |

End of TASK_QUEUE.
