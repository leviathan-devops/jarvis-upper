# CHECKPOINT STRUCTURE — runtime-wall-five-questions-green-status-running

```
Checkpoints/runtime-wall-five-questions-green-status-running/
├─ CHECKPOINT_MANIFEST.md        40+ lines · state, SHAs, contents, honest gaps
├─ CHECKPOINT_STRUCTURE.md       this file
├─ ARTIFACT_SHAS.txt             the 5 artifact sha256s (no dist in this class)
├─ SPEC.md                       the authority spec (from the build package)
├─ BUILD_REPORT.md               ship doc 1/5  (99L)
├─ DEBUG_LOG.md                  ship doc 2/5  (101L, EN-001…EN-008+)
├─ FAILURE_LOG.md                ship doc 3/5  (81L)
├─ SPEC_VIOLATION_LOG.md         ship doc 4/5  (72L)
├─ TESTING_LOG.md                ship doc 5/5  (88L)
├─ GUARDRAILS.md                 the guardrail design (305L)
├─ RESUME.md                     the next-session entry (34L)
├─ OPERATIONAL_VERIFICATION.md   the re-run transcript (175L, 11 sections)
├─ src/                          the FULL tree
│  ├─ *.ts (12 modules)          store cli sync reducers plan guardrail graph
│  │                             attribute kick dossier desks execute status
│  │                             runtime main cli-verbs adapter-verbs
│  ├─ ao-client/                 client.ts rail.ts gen.ts + gen/routes.ts
│  │                             openapi.yaml pin.json
│  ├─ *.test.ts.frozen (15)      the battery (suffixed so the runner ignores the copies)
│  ├─ gates/                     does_anything_run.sh orphan_scan.sh
│  │                             shape_freeze.sh + shape_freeze.sha16
│  ├─ scripts/                   spec-audit.ts
│  ├─ desks/                     4 contracts
│  └─ probes/                    3 probes
├─ canon/                        11 docs (the build package = this project's canon)
├─ artifacts/                    main/runtime/status/spec-audit/does_anything_run + SHAs
└─ runtime-state/                status.json · ticks.log · wire_capture.json
```

## STATE
The five questions answer YES on this tree; the loop is supervised and RUNNING; the wire has carried
real daemon bytes; every verb answers with one JSON object; the refusal gates execute. Battery 44/0,
tsc 0, daemon 200.

## HONEST GAPS
See `CHECKPOINT_MANIFEST.md` §HONEST GAPS (8 items: no dist · no context_management/ · ship-doc floors
below the 500L checkpoint law with the reason · prNodes 0 · kick unwired · EN-009 · the ripwire
exemption · the parallel session).
