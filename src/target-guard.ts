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

/** Parse a git remote into owner/repo. Handles https, ssh://, and scp-like git@host:o/r. */
export function parseRemote(url: string): { owner: string; repo: string } | null {
  const u = url.trim();
  if (!u) return null;
  let path: string | null = null;
  const scp = u.match(/^[^@/\s]+@[^:/\s]+:(.+)$/);   // git@github.com:owner/repo.git
  if (scp) path = scp[1];
  else {
    try { path = new URL(u).pathname; } catch { path = null; }
  }
  if (!path) return null;
  const parts = path.replace(/\.git$/i, "").split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

/** Strip any userinfo (user:token@) before a remote is echoed into logs/status. */
export function redactRemote(url: string): string {
  return url.replace(/\/\/[^/@\s]*@/, "//<redacted>@");
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
  const ok = parsed.owner.toLowerCase() === opts.owner.toLowerCase()
    && parsed.repo.toLowerCase() === opts.repo.toLowerCase();
  return {
    ok,
    remote: redactRemote(res.url),
    reason: ok ? undefined : `TARGET-MISMATCH:${redactRemote(res.url)} != ${opts.owner}/${opts.repo}`,
  };
}
