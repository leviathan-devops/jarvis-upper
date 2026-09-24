// target-guard: verify the configured GitHub target against THIS tree's origin.
//
// FIXED (red-team audit W-01/W-02/W-04; ship-gate round: 2 HIGH + 2 MEDIUM):
//  - the substring match is replaced by a REAL remote parse (https + scp-like git@host:o/r)
//    so "/owner/repo-evil" and "?x=/owner/repo" can no longer fail-open;
//  - an unreadable remote / a NON-REPO is now FAIL-CLOSED (the header always said so; the
//    implementation collapsed every git failure to "no remote" -> ok:true, bypassing the guard
//    outside a checkout);
//  - owner/repo are validated non-empty and slash-free (the empty case made the needle "//",
//    which every https URL contains);
//  - the returned remote is USERINFO-REDACTED (a `https://user:TOKEN@host/...` must not reach
//    logs or status artifacts).
//
// FAIL-CLOSED: if the remote cannot be read we cannot verify the target, and an unverified
// target is exactly the wrong-target risk — refuse, naming the cause.

export interface TargetCheck {
  ok: boolean;
  remote: string;
  reason?: string;
}

/** The remote read, discriminated so "not a repo" is never confused with "no origin". */
export interface RemoteRead {
  /** the origin URL, or null when the repo has no origin */
  url: string | null;
  /** did git positively report a work tree? */
  isRepo: boolean;
  error?: string;
}

/** Parse a git remote into host + owner/repo. Handles https, ssh://, and scp-like git@host:o/r.
 *  FIXED (ship-gate MEDIUM x2): the host is captured (a lookalike host must not pass), and the
 *  path must be EXACTLY two segments — `.../extra/owner/repo` is NOT this repo. */
export function parseRemote(url: string): { host: string | null; owner: string; repo: string } | null {
  const u = url.trim();
  if (!u) return null;
  let path: string | null = null;
  let host: string | null = null;
  const scp = u.match(/^[^@/\s]+@([^:/\s]+):(.+)$/);   // git@github.com:owner/repo.git
  if (scp) { host = scp[1]; path = scp[2]; }
  else {
    try { const p = new URL(u); host = p.hostname; path = p.pathname; } catch { path = null; }
  }
  if (!path) return null;
  // FIXED (ship-gate LOW): a trailing slash left "r.git" as the repo (`.../r.git/`),
  // reporting TARGET-MISMATCH for a VALID remote. Strip slashes before stripping `.git`.
  const parts = path.replace(/\/+$/, "").replace(/\.git$/i, "").split("/").map((x) => x.trim()).filter(Boolean);
  if (parts.length !== 2) return null;      // exactly owner/repo
  return { host, owner: parts[0], repo: parts[1] };
}

/** Strip any userinfo (user:token@) before a remote is echoed into logs/status.
 *  FIXED (ship-gate LOW): a URL-parse redaction handles a password containing `@`
 *  (e.g. `https://user:p@ss@host/o/r`) which a single-regex strip leaked. */
export function redactRemote(url: string): string {
  try {
    const p = new URL(url);
    // build it by hand: URL.toString() percent-encodes "<redacted>" into %3C...%3E
    // FIXED (the W16 ship gate MEDIUM): search+hash could carry ?token= — strip them too.
    if (p.username || p.password) return `${p.protocol}//<redacted>@${p.host}${p.pathname}`;
    return url;
  } catch {
    // FIXED (ship gate LOW): the fallback required "//" and never matched an scp-like
    // `user:secret@host:o/r` (which has no scheme, so new URL threw). Redact the scp form too.
    // FIXED (the W14 ship gate LOW): redacting ANY scp user mangled the conventional
    // `git@github.com:o/r` into `<redacted>@github.com:o/r`. Redact only a `user:PASS@`
    // (a colon = a secret); keep a bare `user@`.
    return url
      .replace(/^([^@/\s:]+:[^\s]+)@/, "<redacted>@")     // scp: user:PASS@host: (greedy to the LAST @)
      .replace(/\/\/[^/@\s:]*:[^/@\s]*@/g, "//<redacted>@"); // https: //user:PASS@host
  }
}

const defaultReadRemote = (root: string): RemoteRead => {
  const run = (argv: string[]) => {
    const p = Bun.spawnSync(argv, { stderr: "pipe", stdout: "pipe" });
    return { code: p.exitCode ?? -1, out: (p.stdout?.toString() ?? "").trim(), err: (p.stderr?.toString() ?? "").trim() };
  };
  const inside = run(["git", "-C", root, "rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.out !== "true") return { url: null, isRepo: false };
  const url = run(["git", "-C", root, "remote", "get-url", "origin"]);
  // FIXED (the W14 ship gate HIGH): `url.out || null` mapped an EMPTY origin URL ("") to
  // null, and the caller treats a falsy `url` as "(no remote)" -> ok:true — a cleared/empty
  // origin FAIL-OPENED. An empty url is UNVERIFIABLE, never an allow.
  if (url.code === 0) {
    if (!url.out) return { url: null, isRepo: true, error: "origin-url-empty" };
    return { url: url.out, isRepo: true };
  }
  // FIXED (the final ship gate HIGH): a git FAILURE inside a REAL worktree (a permission
  // error, a corrupt config) collapsed to "(no remote)" -> ok:true, bypassing the guard.
  // `git remote get-url` exits 2 when the remote is ABSENT — that IS the exit code (no
  // text match, which a locale/wrapper could break).
  if (url.code === 2) return { url: null, isRepo: true };
  return { url: null, isRepo: true, error: `remote-read-failed:exit${url.code}:${url.err.slice(0, 80)}` };
};

/** Does this tree's `origin` remote name the configured owner/repo? */
export function targetMatchesRemote(opts: {
  root: string;
  owner: string;
  repo: string;
  /** the expected git host (FIXED ship-gate MEDIUM: a lookalike host must not pass) */
  host?: string;
  /** injectable for tests; defaults to a real `git rev-parse` + `git remote get-url origin` */
  readRemote?: (root: string) => RemoteRead;
}): TargetCheck {
  // FIXED (the W16 ship gate MEDIUM): a non-string config value threw instead of failing closed.
  if (typeof opts.owner !== "string" || typeof opts.repo !== "string" || !opts.owner || !opts.repo || opts.owner.includes("/") || opts.repo.includes("/")) {
    return { ok: false, remote: "", reason: `TARGET-UNSET:${opts.owner || "?"}/${opts.repo || "?"}` };
  }
  const read = opts.readRemote ?? defaultReadRemote;
  let res: RemoteRead;
  try {
    res = read(opts.root);
  } catch (e) {
    return { ok: false, remote: "", reason: `GIT-UNAVAILABLE:${String(e).slice(0, 60)}` };
  }
  if (res.error) return { ok: false, remote: "", reason: `GIT-UNAVAILABLE:${res.error}` };
  // FAIL-CLOSED: a tree that is NOT a git work tree cannot be verified — refuse.
  if (!res.isRepo) return { ok: false, remote: "", reason: "GIT-UNAVAILABLE:not-a-repo" };
  // FIXED (the W15 ship gate LOW): `!res.url` conflated null (no origin -> allow) with ""
  // (a cleared origin -> must refuse). Check for null EXPLICITLY.
  if (res.url === null) return { ok: true, remote: "(no remote)" };
  if (res.url === "") return { ok: false, remote: "", reason: "TARGET-EMPTY-URL" };
  // FIXED (the W14 ship gate LOW): redactRemote ran twice per branch — hoist it.
  const safe = redactRemote(res.url);
  const parsed = parseRemote(res.url);
  if (!parsed) return { ok: false, remote: safe, reason: `TARGET-UNPARSEABLE:${safe}` };
  const wantHost = (opts.host ?? "github.com").toLowerCase();
  // FIXED (ship-gate MEDIUM): the host check was SKIPPED when `parsed.host` was null
  // (fail-OPEN past the lookalike-host guard). Require a host, compare unconditionally.
  if (!parsed.host) {
    return { ok: false, remote: safe, reason: `TARGET-NO-HOST:${safe}` };
  }
  if (parsed.host.toLowerCase() !== wantHost) {
    return { ok: false, remote: safe, reason: `TARGET-HOST-MISMATCH:${parsed.host} != ${wantHost}` };
  }
  const ok = parsed.owner.toLowerCase() === opts.owner.toLowerCase()
    && parsed.repo.toLowerCase() === opts.repo.toLowerCase();
  return {
    ok,
    remote: safe,
    reason: ok ? undefined : `TARGET-MISMATCH:${safe} != ${opts.owner}/${opts.repo}`,
  };
}
