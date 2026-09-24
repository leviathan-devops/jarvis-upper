// kick-adapter: the REAL KickDeps — the daemon transport that makes `kick()` live.
//
// FIXED (red-team audit R9/TH-2): `kick()` was fully implemented but had NO
// production caller and no adapter, so `verbKick` always answered
// KICK-ADAPTER-UNWIRED — a stub wearing a feature's shape. The deps are now bound
// to the AO daemon routes (spawnSession / sendSessionMessage / getSession) and to
// local git for the direct-branch mode. The dossier-hash gate inside kick() is
// unchanged and still refuses a tampered dossier before any transport runs.
import { call } from "../ao-client/client";
import type { KickDeps } from "./kick";

export function daemonKickDeps(opts: { cwd?: string } = {}): KickDeps {
  return {
    sessionAlive: async (sessionId: string): Promise<boolean> => {
      try {
        const r = await call<{ session?: unknown } | null>("getSession", { params: { sessionId } });
        return r != null;
      } catch { return false; }
    },
    send: async (sessionId: string, brief: string): Promise<{ ok: boolean }> => {
      try {
        await call("sendSessionMessage", { params: { sessionId }, body: { message: brief } });
        return { ok: true };
      } catch { return { ok: false }; }
    },
    spawn: async (input: { projectId: string; brief: string; attachments: string[] }): Promise<{ sessionId: string }> => {
      const r = await call<{ sessionId?: string; id?: string } | null>("spawnSession", {
        body: { projectId: input.projectId, message: input.brief, attachments: input.attachments },
      });
      const sessionId = r?.sessionId ?? r?.id;
      if (!sessionId) throw new Error("KICK-SPAWN-NO-SESSION");
      return { sessionId };
    },
    openBranch: async (bugId: string): Promise<{ ok: boolean }> => {
      try {
        const out = Bun.spawnSync(["git", "-C", opts.cwd ?? process.cwd(), "checkout", "-b", `fix/${bugId}`], { stderr: "pipe" });
        return { ok: out.exitCode === 0 };
      } catch { return { ok: false }; }
    },
    readFile: async (path: string): Promise<string> => await Bun.file(path).text(),
  };
}
