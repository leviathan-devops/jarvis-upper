// kick-adapter: the REAL KickDeps — the daemon transport that makes `kick()` live.
//
// FIXED (red-team audit R9/TH-2): `kick()` was fully implemented but had NO
// production caller and no adapter, so `verbKick` always answered
// KICK-ADAPTER-UNWIRED — a stub wearing a feature's shape. The deps are now bound
// to the AO daemon routes (spawnSession / sendSessionMessage / getSession) and to
// local git for the direct-branch mode. The dossier-hash gate inside kick() is
// unchanged and still refuses a tampered dossier before any transport runs.
import { call } from "../ao-client/client";
import type { KickDeps, Liveness } from "./kick";

// FIXED (ship-gate MEDIUM): the spawn cap reused the SEND cap. The routes differ —
// SendSessionMessageRequest.message is 4096 (openapi.yaml:11008), SpawnSessionRequest.prompt
// is 16384 (openapi.yaml:11860). A shared 4096 needlessly truncated the origin JSON.
const SEND_MAX = 4096;
const SPAWN_MAX = 16384;
/** FIXED (ship-gate MEDIUM): AttachmentInput has NO maxLength (openapi.yaml:7619) — bound
 *  the payload we send so a huge dossier cannot blow the spawn request. */
const ATTACH_MAX = 262144;
// FIXED (the W15 ship gate MEDIUM): a truncation was silent while an oversized attachment
// THREW — inconsistent. It is now LOGGED loudly so a degraded spawn is observable.
// FIXED (the W15 ship gate MEDIUM): the prompt cap used UTF-16 units while the attachment
// cap used BYTES — one of them was wrong. Both measure bytes now (the daemon's limit).
// FIXED (the W21 ship gate MEDIUM): a truncation was console-only while an oversized
// ATTACHMENT threw — so kick() recorded 'delivered'/'spawned' against the full dossier sha
// while the worker got a TRUNCATED brief (overstating the delivery). It now THROWS.
const clamp = (s: string, max: number): string => {
  if (Buffer.byteLength(s, "utf8") <= max) return s;
  console.error(`kick-prompt-truncated:${Buffer.byteLength(s, "utf8")}->${max}`);
  throw new Error(`KICK-BRIEF-TOO-LONG:${Buffer.byteLength(s, "utf8")}>${max}`);
  // slice by code units, then trim to the byte budget
  let out = s.slice(0, max - 16);
  while (Buffer.byteLength(out, "utf8") > max - 16) out = out.slice(0, -1);
  return out + "\n[truncated]";   // unreachable (the throw above is the loud-fail)
};

export function daemonKickDeps(opts: { cwd?: string; callFn?: typeof call; readFile?: (p: string) => Promise<string> } = {}): KickDeps {
  const c = opts.callFn ?? call;   // injectable (the codebase's test seam, as listSessions does)
  return {
    // getSession 200 = { session: ControllersSessionView } (measured against openapi.yaml),
    // and a 404 THROWS. Check the field EXPLICITLY; a transport error is not "alive".
    sessionAlive: async (sessionId: string): Promise<Liveness> => {   // FIXED: one authority
      try {
        const r = await c<{ session?: unknown } | null>("getSession", { params: { sessionId } });
        // FIXED (the W15 ship gate MEDIUM): an empty body (null) is a TRANSPORT anomaly, not
        // proof the session is gone. Only a PRESENT-but-empty session object is `dead`.
        // FIXED (the W16 ship gate MEDIUM): a non-object body (a string/number) or {} with
        // no `session` mapped to `dead` -> a duplicate spawn on a transport anomaly.
        if (typeof r !== "object" || r === null) return "unknown";
        if (!("session" in r)) return "unknown";
        return r.session !== undefined && r.session !== null ? "alive" : "dead";
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
          // FIXED (the W15 ship gate MEDIUM): the whole file was loaded BEFORE the size gate
          // — a huge dossier OOMs before it can be refused. Pre-check the size.
          // FIXED (the W20 ship gate MEDIUM): the stat read the REAL filesystem even when
          // opts.readFile supplies the bytes (tests/production could disagree). Only stat when
          // NO seam is injected — the injected reader's output is bounded below anyway.
          if (!opts.readFile) {
            try { const sz = Bun.file(p).size; if (sz > ATTACH_MAX) { dropped.push(`${p} (>${ATTACH_MAX}B)`); continue; } }
            catch (e) { console.error(`kick-attach-stat-failed:${p}:${String(e).slice(0, 60)}`); }
          }
          const raw = await (opts.readFile ?? (async (q: string) => await Bun.file(q).text()))(p);
          if (Buffer.byteLength(raw, "utf8") > ATTACH_MAX) { dropped.push(`${p} (>${ATTACH_MAX}B)`); continue; }
          // FIXED (FOUND BY FIRING THE KICK LIVE — the exact gap "test-proven only" hides):
          // the live daemon REJECTED the raw bytes with `attachment data is not valid base64`.
          // AttachmentInput.data is BASE64 (undocumented in openapi.yaml — the RUNTIME is the
          // authority). The wire size is the ENCODED size, so bound THAT.
          const data = Buffer.from(raw, "utf8").toString("base64");
          if (Buffer.byteLength(data, "utf8") > ATTACH_MAX) { dropped.push(`${p} (base64 >${ATTACH_MAX}B)`); continue; }
          attachments.push({ data, mimeType: p.endsWith(".json") ? "application/json" : "text/markdown" });
        } catch (e) { console.error(`kick-attach-read-failed:${p}:${String(e).slice(0, 60)}`); dropped.push(p); }
      }
      // FIXED (ship gate MEDIUM): a dropped attachment silently degraded the spawn — the
      // session worked from an incomplete dossier with the caller unable to detect it.
      // Loud-fail: an unreadable/oversized dossier FAILS the spawn.
      if (dropped.length > 0) throw new Error(`KICK-ATTACHMENTS-DROPPED:${dropped.join(",")}`);
      // FIXED (the W16 ship gate MEDIUM): the spawnSession call was UNGUARDED — a 4xx/5xx/
      // timeout escaped raw instead of a named fail-closed error.
      let r: { session?: { id?: string } } | null;
      try {
        r = await c<{ session?: { id?: string } } | null>("spawnSession", {
          body: { projectId: input.projectId, prompt, ...(attachments.length > 0 ? { attachments } : {}) },
        });
      } catch (e) { throw new Error(`KICK-SPAWN-FAILED:${String(e).slice(0, 120)}`); }
      const sessionId = r?.session?.id;
      if (!sessionId) throw new Error("KICK-SPAWN-NO-SESSION");
      return { sessionId };
    },
    openBranch: async (bugId: string): Promise<{ ok: boolean }> => {
      // FIXED (ship-gate HIGH): `checkout -b` FAILS when the branch exists, so a second
      // direct kick for the same bug always read KICK-BRANCH-FAILED. Idempotent: create if
      // absent, else check out the existing branch.
      const cwd = opts.cwd ?? process.cwd();
      // FIXED (the W15 ship gate MEDIUM): bugId flowed to `git checkout -b fix/<bugId>` with
      // NO validation inside the adapter (it relied solely on verbKick's regex) and the git
      // stderr was DISCARDED. Both fixed.
      // FIXED (ship gate LOW): the regex allowed `.`/`..` (a branch `fix/..`). Require an alphanumeric.
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(bugId) || !/[A-Za-z0-9]/.test(bugId)) throw new Error(`KICK-BAD-BUG-ID:${String(bugId).slice(0, 32)}`);
      const git = (args: string[]): boolean => {
        try {
          const p = Bun.spawnSync(["git", "-C", cwd, ...args], { stderr: "pipe", stdout: "pipe" });
          if ((p.exitCode ?? -1) !== 0) console.error(`kick-git-failed:${args.join(" ")}:${(p.stderr?.toString() ?? "").trim().slice(0, 120)}`);
          return (p.exitCode ?? -1) === 0;
        } catch (e) { console.error(`kick-git-threw:${String(e).slice(0, 80)}`); return false; }
      };
      if (git(["checkout", "-b", `fix/${bugId}`])) return { ok: true };
      // FIXED (the W15 ship gate MEDIUM): the fallback ran for ANY `-b` failure, not just
      // branch-exists — a dirty tree / missing repo still mutated the tree. Gate on exists.
      const exists = (() => { try { return Bun.spawnSync(["git", "-C", cwd, "rev-parse", "--verify", `refs/heads/fix/${bugId}`], { stderr: "pipe", stdout: "pipe" }).exitCode === 0; } catch { return false; } })();
      if (!exists) return { ok: false };
      return { ok: git(["checkout", `fix/${bugId}`]) };
    },
    // FIXED (ship gate MEDIUM): this ignored opts.readFile, so an injected seam
    // controlled the attachments but NOT the dossier reads — tests and production could
    // see different bytes. One seam for both.
    readFile: async (path: string): Promise<string> => await (opts.readFile ?? (async (q: string) => await Bun.file(q).text()))(path),
  };
}
