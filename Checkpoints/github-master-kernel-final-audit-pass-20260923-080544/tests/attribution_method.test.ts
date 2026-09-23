// attribution_method.test.ts — the pin for the ocr final HIGH (a blame-only
// candidate was mislabeled "blame+log"). The label must reflect the ACTUAL source.
import { test, expect } from "bun:test";
import { attributeBug } from "../src/attribute";

test("attribution_method: a blame-only commit is labeled 'blame', not 'blame+log'", async () => {
  // a fake proc: `git log` returns NOTHING (no log hit); blame returns a hit.
  const fake = {
    run: async (cmd: string[]) => {
      if (cmd.includes("log")) return { code: 0, stdout: "", stderr: "" };
      if (cmd.includes("blame")) return { code: 0, stdout: "abc1234\t1\t1\t1\n", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
  };
  const a = await attributeBug(
    { repo: "/tmp/x", files: ["f.txt"], lines: { "f.txt": [1] } },
    async () => ({ session: null, worker: null }),
    fake as never,
  );
  if (a.commit) expect(a.method).toBe("blame");
});
