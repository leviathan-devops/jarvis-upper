// kick-adapter.ts — the REAL KickDeps: the daemon transport that makes `kick()` live.
//
// LIVE-KICK-1: `kick()` was fully implemented but had NO production caller and no
// adapter, so `verbKick` always answered KICK-ADAPTER-UNWIRED — a stub wearing a
// feature's shape. The deps are now bound to the AO daemon routes (spawnSession /
// sendSessionMessage / getSession) and to local git for the direct-branch mode.
// The dossier-hash gate inside kick() is unchanged and still refuses a tampered
// dossier before any transport runs.
import { call } from "../ao-client/client";
import type { KickDeps } from "./kick";

export function daemonKickDeps(opts: { cwd?: string; callFn?: typeof call } = {}): KickDeps {
  const c = opts.callFn ?? call; // injectable (the codebase's test seam, as listSessions does)
  return {
    // getSession 200 = { session: ControllersSessionView } (openapi.yaml),
    // and a 404 THROWS. Check the field EXPLICITLY; a transport error is not "alive".
    sessionAlive: async (sessionId: string): Promise<boolean> => {
      try {
        const r = await c<{ session?: unknown } | null>("getSession", { params: { sessionId } });
        return r !== null && r !== undefined && r.session !== undefined && r.session !== null;
      } catch { return false; }
    },
    send: async (sessionId: string, brief: string): Promise<{ ok: boolean }> => {
      try {
        // SendSessionMessageRequest.message is required with maxLength 4096
        // (openapi.yaml:11008); an oversized brief 400s and collapses to a
        // generic failure. Cap it explicitly.
        const message = brief.length > 4096 ? brief.slice(0, 4080) + "\n[truncated]" : brief;
        await c("sendSessionMessage", { params: { sessionId }, body: { message } });
        return { ok: true };
      } catch { return { ok: false }; }
    },
    spawn: async (input: { projectId: string; brief: string; attachments: string[] }): Promise<{ sessionId: string }> => {
      // SpawnSessionRequest.prompt is maxLength 16384 (openapi.yaml:11860);
      // SpawnSessionResponse nests the id at session.id.
      const prompt = input.brief.length > 16384 ? input.brief.slice(0, 16368) + "\n[truncated]" : input.brief;
      const r = await c<{ session?: { id?: string } } | null>("spawnSession", {
        body: { projectId: input.projectId, prompt },
      });
      const sessionId = r?.session?.id;
      if (!sessionId) throw new Error("KICK-SPAWN-NO-SESSION");
      return { sessionId };
    },
    openBranch: async (bugId: string): Promise<{ ok: boolean }> => {
      // `checkout -b` FAILS when the branch exists, so a second direct kick for
      // the same bug always read KICK-BRANCH-FAILED. Idempotent: create if
      // absent, else check out the existing branch.
      const cwd = opts.cwd ?? process.cwd();
      const git = (args: string[]): boolean => {
        try { return Bun.spawnSync(["git", "-C", cwd, ...args], { stderr: "pipe" }).exitCode === 0; } catch { return false; }
      };
      if (git(["checkout", "-b", `fix/${bugId}`])) return { ok: true };
      return { ok: git(["checkout", `fix/${bugId}`]) };
    },
    readFile: async (path: string): Promise<string> => await Bun.file(path).text(),
  };
}
