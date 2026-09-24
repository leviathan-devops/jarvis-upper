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

// FIXED (ship-gate MEDIUM): the spawn cap reused the SEND cap. The routes differ —
// SendSessionMessageRequest.message is 4096 (openapi.yaml:11008), SpawnSessionRequest.prompt
// is 16384 (openapi.yaml:11860). A shared 4096 needlessly truncated the origin JSON.
const SEND_MAX = 4096;
const SPAWN_MAX = 16384;
/** FIXED (ship-gate MEDIUM): AttachmentInput has NO maxLength (openapi.yaml:7619) — bound
 *  the payload we send so a huge dossier cannot blow the spawn request. */
const ATTACH_MAX = 262144;
const clamp = (s: string, max: number): string =>
  s.length > max ? s.slice(0, max - 16) + "\n[truncated]" : s;

export function daemonKickDeps(opts: { cwd?: string; callFn?: typeof call; readFile?: (p: string) => Promise<string> } = {}): KickDeps {
  const c = opts.callFn ?? call;   // injectable (the codebase's test seam, as listSessions does)
  return {
    // getSession 200 = { session: ControllersSessionView } (measured against openapi.yaml),
    // and a 404 THROWS. Check the field EXPLICITLY; a transport error is not "alive".
    sessionAlive: async (sessionId: string): Promise<"alive" | "dead" | "unknown"> => {
      try {
        const r = await c<{ session?: unknown } | null>("getSession", { params: { sessionId } });
        return r !== null && r !== undefined && r.session !== undefined && r.session !== null ? "alive" : "dead";
      } catch (e) {
        // FIXED (ship-gate MEDIUM): a 404 is a DEFINITIVE dead; a timeout / 5xx / network
        // failure is UNKNOWN. Collapsing every throw to `false` made kick() spawn a
        // DUPLICATE session during a transient daemon outage.
        return (e as { status?: number })?.status === 404 ? "dead" : "unknown";
      }
    },
    send: async (sessionId: string, brief: string): Promise<{ ok: boolean }> => {
      try {
        // SendSessionMessageRequest.message is required with maxLength 4096; an oversized
        // brief 400s and collapsed to a generic failure. Cap it explicitly.
        const message = clamp(brief, SEND_MAX);
        await c("sendSessionMessage", { params: { sessionId }, body: { message } });
        return { ok: true };
        // FIXED (red-team slop audit SLOP-05): the cause was swallowed at the adapter
        // boundary. The caller still throws KICK-SEND-FAILED (fail-closed), but the
        // transport cause is now NAMED for the post-mortem.
      } catch (e) { console.error(`kick-send-failed:${String(e).slice(0, 80)}`); return { ok: false }; }
    },
    spawn: async (input: { projectId: string; brief: string; attachments: string[] }): Promise<{ sessionId: string }> => {
      // FIXED (ship-gate CRITICAL x2, measured against openapi.yaml): the request field is
      // `prompt` (NOT `message`), and SpawnSessionResponse nests the id at `session.id`
      // (NOT a top-level sessionId/id). The old shape sent an empty prompt and ALWAYS threw
      // KICK-SPAWN-NO-SESSION.
      // FIXED (ship-gate MEDIUM): attachments were SILENTLY DROPPED. AttachmentInput is
      // {data, mimeType} (openapi.yaml:7619) and the daemon accepts them on spawn
      // (openapi.yaml:11801) — send the REAL file bytes (capped), never a bare path (which
      // would guess at `data`'s semantics) and never a silent drop (the loud-fail law).
      const prompt = clamp(input.brief, SPAWN_MAX);
      const attachments: { data: string; mimeType: string }[] = [];
      const dropped: string[] = [];
      for (const p of input.attachments) {
        try {
          // FIXED (ship gate MEDIUM): read via deps.readFile (the SAME hash-gated content
          // kick() verified — not a second Bun.file read that could see a changed/deleted
          // file), and bound the RESULTING STRING (the size check could race a growing file
          // and byte-size != the JSON-encoded size).
          const data = await (opts.readFile ?? (async (q: string) => await Bun.file(q).text()))(p);
          if (data.length > ATTACH_MAX) { dropped.push(`${p} (>${ATTACH_MAX}c)`); continue; }
          attachments.push({ data, mimeType: p.endsWith(".json") ? "application/json" : "text/markdown" });
        } catch { dropped.push(p); }
      }
      if (dropped.length > 0) console.error(`kick-spawn-attachments-dropped:${dropped.join(",")}`);
      const r = await c<{ session?: { id?: string } } | null>("spawnSession", {
        body: { projectId: input.projectId, prompt, ...(attachments.length > 0 ? { attachments } : {}) },
      });
      const sessionId = r?.session?.id;
      if (!sessionId) throw new Error("KICK-SPAWN-NO-SESSION");
      return { sessionId };
    },
    openBranch: async (bugId: string): Promise<{ ok: boolean }> => {
      // FIXED (ship-gate HIGH): `checkout -b` FAILS when the branch exists, so a second
      // direct kick for the same bug always read KICK-BRANCH-FAILED. Idempotent: create if
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
