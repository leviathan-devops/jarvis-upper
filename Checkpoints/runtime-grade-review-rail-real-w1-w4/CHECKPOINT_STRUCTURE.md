# CHECKPOINT STRUCTURE — runtime-grade-review-rail-real-w1-w4

\`\`\`
Checkpoints/runtime-grade-review-rail-real-w1-w4/
├─ CHECKPOINT_MANIFEST.md      identity · the measured state · contents · what was proved · honest gaps · resume
├─ CHECKPOINT_STRUCTURE.md     this map
├─ src/                        the FULL jarvis-upper tree
│  ├─ *.ts                     the 17 modules (verdict, sync, runtime, plan, execute, guardrail, desks, ...)
│  ├─ ao-client/               the typed AO client + rail (+ gen/routes.ts)
│  ├─ tests/                   the 17-file battery
│  ├─ gates/                   does_anything_run · shape_freeze · orphan_scan
│  ├─ scripts/ desks/ probes/  the harnesses
│  └─ package.json tsconfig.json bunfig.toml .gitignore
├─ jobs/                       the job definition + its fence subset test + runtime transcripts
├─ jfm/                        the JFM CLI (src + tests + configs)
├─ artifacts/                  status.json · ticks.log · fence2-verdicts.jsonl · the review task/body/payload
├─ canon/                      the 11 canon docs (≥200L each, one shared anchor)
├─ SPEC.md                     the authority build spec (DPL1)
├─ JFM_BLUEPRINT.md            the JFM design of record
├─ BUILD_REPORT.md             what was built (append-only)
├─ DEBUG_LOG.md                EN-001..EN-016
├─ FAILURE_LOG.md              the derailment ledger
├─ SPEC_VIOLATION_LOG.md       spec-section mapping
├─ TESTING_LOG.md              every re-run + its result
├─ GUARDRAILS.md               the laws this build enforces
├─ RESUME.md                   the resume recipe
├─ OPERATIONAL_VERIFICATION.md the operator's verification walk
├─ RUNTIME_GRADE_TRANSCRIPT.md the verbatim re-run transcript
└─ SHIP_DOCS_MANIFEST.md       the ship-doc index
\`\`\`

## STATE
- **SOURCE 1 (fence):** PASS with \`spec_bound:true\` on the job head.
- **SOURCE 2 (review):** a real muse run on AO's tmux rail; \`changes_requested\` on the prior head,
  its Required findings fixed on the current head.
- **The job:** UNVERIFIED until a fresh review approves the current head (one source is not enough).
- **Battery:** 56/0 (jarvis-upper) + 8/0 (jfm); all three refusal gates green.

## HONEST GAPS
1. The review stands at \`changes_requested\`; the fixes await a fresh approval pass.
2. The reviewer's own \`gh\` could not POST; the operator submitted its payload.
3. JFM's dispatch path is test-exercised, not live-exercised (wave = NO-DESKS).
4. No single-writer lock on the runtime (double-start observed).
5. No container for this class (host-live by design).
