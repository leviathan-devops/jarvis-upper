// W3 — THE SLOP SUITE (red-team audit R10/R12/R13).
import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listPrsFromAo } from "../src/adapter-verbs";
import { verify } from "../src/verdict";

// ── R10: a batch-N failure must name the RIGHT session ──────────────────────
test("test_batch_error_correct_session", async () => {
  // 10 sessions -> batch 0 = s-0..s-7 (i=0), batch 1 = s-8,s-9 (i=8).
  // The failure lands on s-9 => batch 1, k=1. The OLD bug named sessions[1] = "s-1"
  // (the batch-0 shadow). The fix names batch[k] = scoped[i+k] = "s-9".
  const sessions = Array.from({ length: 10 }, (_, i) => ({ id: `s-${i}`, projectId: "p" }));
  const captured: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { captured.push(a.map(String).join(" ")); };
  try {
    const callFn = (async (op: string, o: { params?: { sessionId?: string } }) => {
      if (op === "listSessions") return { sessions };
      if (op === "listSessionPRs") {
        if (o.params?.sessionId === "s-9") throw new Error("AO-500");
        return { sessionId: o.params?.sessionId, prs: [] };
      }
      return null;
    }) as never;
    await listPrsFromAo({ callFn, project: "p" });
  } finally { console.error = orig; }
  const line = captured.find((l) => l.includes("PARTIAL")) ?? "";
  expect(line).toContain("s-9");
  expect(line).not.toContain('"s-1"');   // the batch-0 shadow must NOT appear
});

// ── R12: ONE authority for the confidence threshold ────────────────────────
test("test_confidence_floor_single_authority", async () => {
  const { CONFIDENCE_FLOOR } = await import("../src/attribute");
  expect(CONFIDENCE_FLOOR).toBe(0.6);
  const src = await Bun.file(new URL("../src/cli-verbs.ts", import.meta.url)).text();
  expect(src).not.toContain("confidence >= 0.6");       // the duplicate is GONE
  expect(src).toContain("CONFIDENCE_FLOOR");            // the single authority is imported
});

// ── R13: the SPEC-read failure is its own NAMED reason ─────────────────────
test("test_spec_read_failure_is_named", async () => {
  const HEAD = "a".repeat(40);
  // a fence that PASSES but whose ledger yields NO row (the needle cannot match)
  const stub = {
    runFence: async (argv: string[]) => argv.includes("invariant-sha")
      ? { code: 0, stdout: "763f2967da4fc061", stderr: "" }
      : { code: 0, stdout: "PASS", stderr: "" },
    fetchReviews: async () => ({ reviewerHarness: "muse", reviews: [{ status: "approved", targetSha: HEAD }], runs: [] }),
    bind: () => ({ ok: true, reason: "FENCE-GREEN" }),
  };
  const noRow = mkdtempSync(join(tmpdir(), "w3-ledger-"));
  const ledger = join(noRow, "v.jsonl");
  writeFileSync(ledger, JSON.stringify({ job: "OTHER-JOB", verdict: "PASS", evidence: `${HEAD.slice(0, 16)}|sandbox=bwrap` }) + "\n");

  // (a) no SPEC.md -> the refusal NAMES SPEC-UNREADABLE
  const absent = mkdtempSync(join(tmpdir(), "w3-nospec-"));
  const r1 = await verify({ jobDir: absent, headSha: HEAD, sessionId: "s-w3", ledgerPath: ledger, ...stub });
  expect(r1.reasons.join("|")).toContain("LEDGER-NEEDLE:SPEC-UNREADABLE");

  // (b) a SPEC.md with NO job: line -> SPEC-NO-JOB
  const noJob = mkdtempSync(join(tmpdir(), "w3-nojob-"));
  writeFileSync(join(noJob, "SPEC.md"), "# spec\nARTIFACT: src/x.ts\n");
  const r2 = await verify({ jobDir: noJob, headSha: HEAD, sessionId: "s-w3", ledgerPath: ledger, ...stub });
  expect(r2.reasons.join("|")).toContain("LEDGER-NEEDLE:SPEC-NO-JOB");

  // (c) the GREEN case: a matching row + a readable SPEC -> NO needle note at all
  const ok = mkdtempSync(join(tmpdir(), "w3-ok-"));
  writeFileSync(join(ok, "SPEC.md"), "# spec\njob: dt-shapes\nARTIFACT: src/x.ts\n");
  const ledger2 = join(ok, "v.jsonl");
  writeFileSync(ledger2, JSON.stringify({ job: "dt-shapes", verdict: "PASS", evidence: `${HEAD.slice(0, 16)}|sandbox=bwrap|spec_bound:true` }) + "\n");
  const r3 = await verify({ jobDir: ok, headSha: HEAD, sessionId: "s-w3", ledgerPath: ledger2, ...stub });
  expect(r3.verdict).toBe("VERIFIED");
  expect(r3.reasons).toEqual([]);                     // a green case stays clean
  expect(r3.reasons.join("|")).not.toContain("LEDGER-NEEDLE:");
});
