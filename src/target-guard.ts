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
    if (p.username || p.password) return `${p.protocol}//<redacted>@${p.host}${p.pathname}${p.search}${p.hash}`;
    return url;
  } catch {
    return url.replace(/\/\/[^/@\s]*@/g, "//<redacted>@");
  }
}

const defaultReadRemote = (root: string): RemoteRead => {
  const run = (argv: string[]) => {
    const p = Bun.spawnSync(argv, { stderr: "pipe", stdout: "pipe" });
    return { code: p.exitCode ?? -1, out: (p.stdout?.toString() ?? "").trim() };
  };
  const inside = run(["git", "-C", root, "rev-parse", "--is-inside-work-tree"]);
  if (inside.code !== 0 || inside.out !== "true") return { url: null, isRepo: false };
  const url = run(["git", "-C", root, "remote", "get-url", "origin"]);
  return { url: url.code === 0 && url.out ? url.out : null, isRepo: true };
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
  if (!opts.owner || !opts.repo || opts.owner.includes("/") || opts.repo.includes("/")) {
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
  // a real work tree with no origin has nothing to contradict — allow it.
  if (!res.url) return { ok: true, remote: "(no remote)" };
  const parsed = parseRemote(res.url);
  if (!parsed) return { ok: false, remote: redactRemote(res.url), reason: `TARGET-UNPARSEABLE:${redactRemote(res.url)}` };
  const wantHost = (opts.host ?? "github.com").toLowerCase();
  // FIXED (ship-gate MEDIUM): the host check was SKIPPED when `parsed.host` was null
  // (fail-OPEN past the lookalike-host guard). Require a host, compare unconditionally.
  if (!parsed.host) {
    return { ok: false, remote: redactRemote(res.url), reason: `TARGET-NO-HOST:${redactRemote(res.url)}` };
  }
  if (parsed.host.toLowerCase() !== wantHost) {
    return { ok: false, remote: redactRemote(res.url), reason: `TARGET-HOST-MISMATCH:${parsed.host} != ${wantHost}` };
  }
  const ok = parsed.owner.toLowerCase() === opts.owner.toLowerCase()
    && parsed.repo.toLowerCase() === opts.repo.toLowerCase();
  return {
    ok,
    remote: redactRemote(res.url),
    reason: ok ? undefined : `TARGET-MISMATCH:${redactRemote(res.url)} != ${opts.owner}/${opts.repo}`,
  };
}
