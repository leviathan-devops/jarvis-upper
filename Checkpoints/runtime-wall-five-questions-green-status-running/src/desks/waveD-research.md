# WAVE D — RESEARCH (librarian fixture)
GOAL: problem/solution research contract — NOT a summary.
INPUT: fixture/research.json {problems[], candidateSolutions[]}.
CONTRACT:
  1. for each problem: validate or invalidate each candidate with evidence (cite)
  2. extend with newly found data where possible
  3. write research/report.json {verdicts[{problem, solution, verdict, evidence[], unknowns[]}]}
  4. done condition: `bun desks/run.ts w4d` prints research_reported + every problem has ≥1 verdict with ≥1 evidence row
FORBIDDEN: summary-only output · uncited claims · code mutation.
