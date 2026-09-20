# GOALS + HYDRA — jarvis-upper-tier

## HYDRA ORG
orchestrator (this package's executor session)
├── W0-W3 desks: deterministic build (bun/TS; single-writer per module;
│   no LLM deps) — mode: kernel desks w/ explicit cmd
├── W4 wave desks (A/B/C/D per BLUEPRINT §10): foreman-supervised OMP
│   macro agents on orca seats; escalation = foreman ESCALATE → operator
└── audits: Thanatos E1 pass + reverse-engineer desk (fresh context)
        escalation path: bug_record → triage|kick (operator-visible)

## GOAL PROMPT LAW (per desk)
Every goal prompt carries: anchor files (spec § + blueprint §) · laws
(L1-L10 excerpt for its surface) · the battery lines it must print ·
stop condition (gate token list) · forbidden list (anti-patterns A-E).
Skeletons: BLUEPRINT §10 (verbatim). Wave gates: 06-WAVES.md.
Executor rule: BLOCKED is legal; prose "done" is not; every claim
carries its token into RUNNING_BUILD_LOG.
