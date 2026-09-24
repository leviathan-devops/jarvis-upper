// main.ts — THE ENTRY POINT: boot the runtime, tick on a clock, stop on signals.
// Run:  UPPER_TICK_MS=2000 bun src/main.ts
import { fileURLToPath } from "node:url";
import { createRuntime } from "./runtime";
import { statusPath, ticksPath } from "./status";

// FIXED 2026-09-23 (ocr round-4 HIGH): new URL().pathname is not a filesystem
// path (wrong on Windows, and URL-encoded elsewhere) — fileURLToPath is the
// correct conversion.
// FIXED (run 4): `??` lets an EMPTY UPPER_ROOT through (root="") — `||`.
const root = process.env.UPPER_ROOT || fileURLToPath(new URL("..", import.meta.url));
// FIXED 2026-09-23 (ocr round-4 HIGH): Number("") === 0 and Number("abc")
// === NaN — an empty/invalid env var produced a 0/NaN interval (a runaway
// tick storm). The default now applies to a parsed-but-invalid value too.
const rawTickMs = Number(process.env.UPPER_TICK_MS ?? 15000);
const tickMs = Number.isFinite(rawTickMs) && rawTickMs > 0 ? rawTickMs : 15000;
// FIXED 2026-09-23 (the built-but-not-wired defect): main.ts NEVER passed
// publishOpts, so the PRODUCTION daemon could never POST the two factory/*
// contexts the ruleset waits on — the whole publisher (runtime.ts + verdict.ts
// + publish.ts) was unreachable from the entry point. It is wired here from env.
//
//   UPPER_OWNER / UPPER_REPO   the GitHub target (default leviathan-devops/jarvis-upper)
//   GH_TOKEN | GITHUB_TOKEN    the credential (OUT-OF-BAND; absent -> NO publish)
//   UPPER_WORKTREE_ROOT        where the per-session git worktrees live
//   FENCE2_LEDGER              the fence adjudication ledger path
// FIXED (red-team audit F-23, the operator's exact fear): the defaults were
// PRODUCTION values, so a second project with no env override silently POSTed
// statuses to leviathan-devops/jarvis-upper. The target is now verified against
// the git remote of the tree this daemon runs in: a MISMATCH is a loud refusal
// (a wrong-target POST is unrecoverable — it writes to someone else's repo).
const OWNER = process.env.UPPER_OWNER || "leviathan-devops";
const REPO = process.env.UPPER_REPO || "jarvis-upper";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const WORKTREE_ROOT = process.env.UPPER_WORKTREE_ROOT
  || `${process.env.HOME ?? "/home/leviathan"}/.ao/data/worktrees/${REPO}`;

// THE TARGET ASSERTION: if this tree's origin is a DIFFERENT repo than the
// configured target, refuse to arm the publisher. Prevents the silent
// wrong-target class entirely (fail-closed, named).
function targetMatchesRemote(): { ok: boolean; remote: string } {
  try {
    const out = Bun.spawnSync(["git", "-C", root, "remote", "get-url", "origin"], { stderr: "pipe" });
    const url = (out.stdout?.toString() ?? "").trim();
    if (!url) return { ok: true, remote: "(no remote)" }; // a bare tree: nothing to contradict
    return { ok: url.toLowerCase().includes(`/${OWNER.toLowerCase()}/${REPO.toLowerCase()}`), remote: url };
  } catch (e) {
    // FAIL-CLOSED: if we cannot read the remote we cannot verify the target, and an
    // unverified target is exactly the wrong-target risk. Refuse, naming the cause.
    return { ok: false, remote: `(git unavailable: ${String(e).slice(0, 60)})` };
  }
}
const tgt = targetMatchesRemote();
if (!tgt.ok) {
  console.error(`FATAL: TARGET-MISMATCH — this tree's origin is ${tgt.remote} but UPPER_OWNER/UPPER_REPO name ${OWNER}/${REPO}. Refusing to arm the publisher (a wrong-target POST is unrecoverable). Set UPPER_OWNER + UPPER_REPO explicitly.`);
  process.exit(1);
}
// the pr_node id is `pr:<session>:<num>` — the session names the worktree dir.
const jobDirFor = (prId: string): string => {
  const session = prId.split(":")[1] ?? "";
  return session ? `${WORKTREE_ROOT}/${session}` : "";
};
if (!TOKEN) {
  // FIXED (red-team audit W-03): an absent token silently disarmed publish AND
  // the merge poll, while the tick kept reporting errors=0 — a silent no-work.
  console.error("DISARMED:no-token — the publisher and the merge recorder are OFF (no GH_TOKEN/GITHUB_TOKEN). The daemon will read AO but NEVER POST a status.");
}
const publishOpts = TOKEN ? {
  owner: OWNER, repo: REPO, token: TOKEN, jobDir: "",
  jobDirFor,
  ledgerPath: process.env.FENCE2_LEDGER,
} : undefined;

const rt = createRuntime({ root, deps: { tickMs, publishOpts } });

// FIXED 2026-09-23 (ocr round-4 HIGH): SIGTERM and SIGINT can both arrive before
// stop() completes — a re-entrancy guard prevents two concurrent rt.stop() calls
// racing to process.exit().
let stopping = false;
async function stop(): Promise<void> {
  // FIXED 2026-09-23 (ocr final HIGH): the guard made a SECOND signal a silent
  // no-op — if the first stop() hung on a network call, the daemon was unkillable
  // by signals. A second signal now ESCALATES to a forced exit.
  if (stopping) { console.error(JSON.stringify({ forced: true, reason: "second-signal" })); process.exit(1); }
  stopping = true;
  const s = await rt.stop();
  console.log(JSON.stringify({ stopped: true, ticks: s.tick, daemonOk: s.daemonOk, status: statusPath(root), log: ticksPath(root) }));
  process.exit(0);
}
process.on("SIGTERM", () => void stop().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); }));
process.on("SIGINT", () => void stop().catch((e) => { console.error(JSON.stringify({ error: String(e) })); process.exit(1); }));

rt.start();
console.log(JSON.stringify({ started: true, root, tickMs, publisher: TOKEN ? `ARMED:${OWNER}/${REPO}` : "DISARMED:no-token", status: statusPath(root), log: ticksPath(root) }));
