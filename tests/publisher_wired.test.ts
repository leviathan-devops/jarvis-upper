// publisher_wired.test.ts — the pin for the BUILT-BUT-NOT-WIRED defect: the
// production entry point (main.ts) must arm the publisher, and an eligible PR's
// tick must POST BOTH factory/* contexts. Goes RED if the wiring is removed.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRuntime } from "../src/runtime";
import { openStore } from "../src/store";

test("publisher_wired: main.ts arms publishOpts (the entry point is wired)", () => {
  const src = readFileSync(join(import.meta.dir, "..", "src", "main.ts"), "utf8");
  expect(src).toContain("publishOpts");
  expect(src).toContain("publisher");          // the boot line names ARMED|DISARMED
});

test("publisher_wired: an eligible PR POSTs factory/fence2 + factory/verdict", async () => {
  const db = openStore(":memory:");
  db.query("INSERT INTO pr_node(id,project,pr_number,session_id,head_sha,state) VALUES ('pr:s1:7','p',7,'s1','abc1234','ready_to_merge')").run();
  for (const g of ["ci_green", "audit", "hardened", "fence2"]) {
    db.query("INSERT INTO gate_pass(id,pr_node,gate,verdict,head_sha,at) VALUES (?,?,?,?,?,0)").run(`pr:s1:7:${g}`, "pr:s1:7", g, "pass", "abc1234");
  }
  const posted: string[] = [];
  const rt = createRuntime({
    root: "/tmp/rt-pin", db,
    deps: {
      probe: async () => true, listPrs: async () => [],
      rails: async () => ({ frames: 1, bytes: 10, lastSeq: 1 }),
      publishOpts: {
        owner: "o", repo: "r", token: "t", jobDir: "", jobDirFor: () => "/tmp/x",
        fetchImpl: (async (url: any, init: any) => {
          const u = String(url);
          if (u.includes("/statuses/")) { posted.push(JSON.parse(init.body).context); return new Response("{}", { status: 201 }); }
          if (u.includes("/commits/")) return new Response(JSON.stringify([{ context: "factory/fence2", state: "success" }, { context: "factory/verdict", state: "success" }]), { status: 200 });
          return new Response("{}", { status: 200 });
        }) as any,
        verifyImpl: async () => ({ verdict: "VERIFIED", reasons: [], sources: { fence: { ran: true, exitCode: 0, sha: "abc1234", ledgerVerdict: "PASS", reason: "FENCE-GREEN" }, review: { ran: true, verdict: "approved", targetSha: "abc1234", harness: "muse", reason: "REVIEW-GREEN" } } }) as any,
      },
    },
  });
  await rt.tick();
  expect(posted).toContain("factory/fence2");
  expect(posted).toContain("factory/verdict");
  db.close();
});

test("rail-idle: an IDLE SSE stream is a CLEAN capture, never rail-failed", async () => {
  const { defaultRails } = await import("../src/runtime");
  const { openStore } = await import("../src/store");
  const db = openStore(":memory:");
  // serve an SSE stream that stays OPEN and idle (a healthy daemon with no events)
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => {
    const stream = new ReadableStream({
      start(c) { /* never enqueue, never close — an IDLE stream */ },
      cancel() { /* the reader's cancel */ },
    });
    return new Response(stream, { status: 200 });
  }) as never;
  try {
    const t0 = Date.now();
    const cap = await defaultRails(db, "/tmp");
    const ms = Date.now() - t0;
    expect(cap.failed).toBeUndefined();      // NOT a failure
    expect(cap.frames).toBe(0);              // no events, cleanly
    expect(ms).toBeLessThan(6000);           // bounded (the deadline, not the 5s abort)
  } finally { globalThis.fetch = orig; }
  db.close();
});

test("rail-idle: a transport error IS reported (the failure travels)", async () => {
  const { defaultRails } = await import("../src/runtime");
  const { openStore } = await import("../src/store");
  const db = openStore(":memory:");
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as never;
  try {
    const cap = await defaultRails(db, "/tmp");
    expect(cap.failed).toContain("ECONNREFUSED");
  } finally { globalThis.fetch = orig; }
  db.close();
});
