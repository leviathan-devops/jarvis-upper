// tests/publish_false_green.test.ts — W5 gate: `bun test -t test_publish_false_green`
//
// THE LOAD-BEARING PROPERTY: a verdict that CANNOT RUN must never produce a
// green status. The ruleset waits on `factory/fence2` and `factory/verdict`;
// a false green there merges unverified work.
//
// ADVERSE FIRST: the cannot-run case runs BEFORE the happy path.
//
// OBSERVATION CHANNEL: the injected fetchImpl records every POST body. We
// assert on the RECORDED BODIES (what actually left the process), never on
// internal calls.
import { test, expect } from "bun:test";
import { publishVerdictForPr } from "../src/runtime";

interface Post { context: string; state: string; description: string }

function recorder() {
  const posts: Post[] = [];
  const fetchImpl = (async (_url: unknown, init: { body?: string } | undefined) => {
    posts.push(JSON.parse(String(init?.body ?? "{}")) as Post);
    return { ok: true, status: 201, json: async () => ({}) } as unknown as Response;
  }) as unknown as typeof fetch;
  return { posts, fetchImpl };
}

const base = { owner: "o", repo: "r", token: "t" };

test("test_publish_false_green", async () => {
  // ── CASE 1 (ADVERSARIAL FIRST): the fence UNREACHABLE -> never a green ──
  {
    const { posts, fetchImpl } = recorder();
    // ★ the CANNOT-RUN shape: fence.ran === false AND a FENCE- reason.
    // A missing jobDir alone does NOT produce this (verify returns ran:true
    // with FENCE-FAILED) — the branch must be supplied its exact trigger, or
    // the test asserts a property it never exercises (the mutation trap).
    await publishVerdictForPr({
      ...base, sha: "aaa111", jobDir: "/nonexistent/job/dir/xyz",
      verifyImpl: (async () => ({
        verdict: "UNVERIFIED",
        reasons: ["FENCE-NOT-RUN: the fence never executed"],
        sources: { fence: { ran: false, reason: "FENCE-NOT-RUN", verdict: null } },
      })) as never,
      fetchImpl,
    });
    const states = posts.map((p) => p.state);
    // THE CONTRACT: no success. An unreachable fence is UNKNOWN, not green.
    expect(states).not.toContain("success");
    // and both contexts are still posted (the ruleset needs both to resolve)
    expect(posts.map((p) => p.context).sort()).toEqual(["factory/fence2", "factory/verdict"]);
  }

  // ── CASE 2: a FAILED verdict -> at least one failure ──
  {
    const { posts, fetchImpl } = recorder();
    await publishVerdictForPr({
      ...base, sha: "bbb222", jobDir: "/nonexistent/job/dir/xyz",
      verifyImpl: (async () => ({
        verdict: "UNVERIFIED",
        reasons: ["FENCE-FAILED: exit 1"],
        sources: { fence: { ran: true, reason: "FENCE-FAILED", verdict: null } },
      })) as never,
      fetchImpl,
    });
    const states = posts.map((p) => p.state);
    expect(states).toContain("failure");
    expect(states).not.toContain("success");
  }

  // ── CASE 3 (THE HAPPY PATH, LAST): a PASSING verdict -> both success ──
  {
    const { posts, fetchImpl } = recorder();
    await publishVerdictForPr({
      ...base, sha: "ccc333", jobDir: "/nonexistent/job/dir/xyz",
      verifyImpl: (async () => ({
        verdict: "VERIFIED",
        reasons: [],
        sources: { fence: { ran: true, reason: "FENCE-GREEN", verdict: "pass" } },
      })) as never,
      fetchImpl,
    });
    const states = posts.map((p) => p.state);
    expect(states).toEqual(["success", "success"]);
    expect(posts.map((p) => p.context).sort()).toEqual(["factory/fence2", "factory/verdict"]);
  }

  // ── CASE 4: the 140-char truncation holds on a real POST ──
  {
    const { posts, fetchImpl } = recorder();
    await publishVerdictForPr({
      ...base, sha: "ddd444", jobDir: "/nonexistent/job/dir/xyz",
      verifyImpl: (async () => ({
        verdict: "UNVERIFIED",
        reasons: ["X".repeat(300)],
        sources: { fence: { ran: true, reason: "FENCE-FAILED", verdict: null } },
      })) as never,
      fetchImpl,
    });
    for (const p of posts) expect(p.description.length).toBeLessThanOrEqual(140);
  }
});
