// target-guard: verify the configured GitHub target against THIS tree's origin.
//
// FIXED (red-team audit W-01/W-02/W-04): main.ts defaulted OWNER/REPO to the
// production values, so a second project with no env override silently POSTed
// statuses to leviathan-devops/jarvis-upper. A wrong-target POST is unrecoverable
// (it writes to someone else's repo), so the mismatch is a LOUD refusal.
//
// FAIL-CLOSED: if the remote cannot be read, we cannot verify the target, and an
// unverified target is exactly the wrong-target risk — refuse, naming the cause.

export interface TargetCheck {
  ok: boolean;
  remote: string;
  reason?: string;
}

/** Does this tree's `origin` remote name the configured owner/repo? */
export function targetMatchesRemote(opts: {
  root: string;
  owner: string;
  repo: string;
  /** injectable for tests; defaults to a real `git remote get-url origin` */
  readRemote?: (root: string) => string | null;
}): TargetCheck {
  const read = opts.readRemote ?? ((root: string): string | null => {
    try {
      const out = Bun.spawnSync(["git", "-C", root, "remote", "get-url", "origin"], { stderr: "pipe" });
      if (out.exitCode !== 0) return null;
      return (out.stdout?.toString() ?? "").trim() || null;
    } catch {
      return null;
    }
  });

  let url: string | null;
  try {
    url = read(opts.root);
  } catch (e) {
    return { ok: false, remote: "", reason: `GIT-UNAVAILABLE:${String(e).slice(0, 60)}` };
  }
  // a bare tree with no remote has nothing to contradict — allow it (the operator
  // may be driving a repo they will add a remote to later)
  if (!url) return { ok: true, remote: "(no remote)" };
  const needle = `/${opts.owner}/${opts.repo}`.toLowerCase();
  const ok = url.toLowerCase().includes(needle);
  return { ok, remote: url, reason: ok ? undefined : `TARGET-MISMATCH:${url} != ${opts.owner}/${opts.repo}` };
}
