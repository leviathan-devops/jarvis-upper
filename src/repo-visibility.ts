// repo-visibility.ts — THE KERNEL OWNS THE REPO'S EXISTENCE + VISIBILITY (FR-13).
//
// THE OPERATOR'S STANDING ORDER (2026-10-02, verbatim): "make all repos public by default so i
// dont have to deal with any bs make the kernel auto convert them so i dont have to think about
// anything and just add into the kernel the ability to make repos private from public alter if we
// want to and it handles the 2fa so i dont have to deal with any bs. or just disable that -
// whatever you get the point handle it make it work dont leave any stupid bs for me to have to
// manage."
//
// WHAT THAT REPLACES: the pin's HARD STOPS listed "creating leviathan-devops/jev-fact-kernel" and
// "flipping plutus-vision public" as OPERATOR-OWNED clicks — the attach REFUSED with a remedy
// command for a human. The operator has now decided: the KERNEL performs them. The refusals stay
// (they are the honest fallback when the kernel CANNOT), but the DEFAULT is to act.
//
// THE 2FA: nothing to handle. A PAT (GH_TOKEN) is not subject to interactive 2FA — GitHub applies
// 2FA to password/browser flows, never to a bearer token. `GH_PROMPT_DISABLED=1` closes the last
// prompt path so a missing scope surfaces as a NAMED refusal instead of a HANG. gh never prompts.
//
// THE POLARITY (the fail-closed law): every failure here is a SHAPED refusal with the exact
// remedy command — never a throw, never a silent no-op, never a claimed success.

export type Visibility = "public" | "private";

/** The repo's existence + visibility as the API reports it. */
export interface RepoState {
  exists: boolean;
  visibility: Visibility | null;
  /** STRUCTURED absence (the audit gate LOW): absence is a FACT, never a substring of `detail` —
   *  the old `detail.includes("does not exist")` coupling would flip silently on a wording change. */
  absent: boolean;
  /** the probe's raw detail (the gh stderr on a failure path). */
  detail: string;
}

/** The provisioning verdict — `did` names every world-change performed, in order. */
export interface ProvisionVerdict {
  ok: boolean;
  refused?: string;
  remedy?: string;
  detail: string;
  did: string[];
}

/** The gh invocation seam — injectable so the tests never spawn a binary. */
export interface GhRunner {
  (args: string[], token: string, env: Record<string, string>): { code: number; out: string; err: string };
}

/** THE NON-INTERACTIVE ENV. `GH_PROMPT_DISABLED=1` is the guarantee: gh can NEVER block on a
 *  prompt (a hang is the worst failure — no evidence, no refusal, no remedy). The audit gate MED:
 *  `GITHUB_TOKEN`/`GH_ENTERPRISE_TOKEN` are DELETED so no stale token can shadow GH_TOKEN. */
export function ghEnv(token: string, extra: Record<string, string> = {}): Record<string, string> {
  const env = { ...process.env as Record<string, string> };
  delete env.GITHUB_TOKEN;
  delete env.GH_ENTERPRISE_TOKEN;
  return { ...env, GH_TOKEN: token, GH_PROMPT_DISABLED: "1", NO_COLOR: "1", CLICOLOR: "0", ...extra };
}

/** A GUARDED `gh` spawn — never throws; a spawn failure is a code -1 with the reason on stderr.
 *  THE CWD (the audit gate HIGH): `cwd: "/"` — gh must NEVER inherit the caller's process cwd, so
 *  a `gh repo create` can never pick up the invoking tree's git context by accident. */
export const ghRun: GhRunner = (args, token, env) => {
  try {
    const r = Bun.spawnSync(["gh", ...args], { cwd: "/", env: { ...ghEnv(token), ...env }, stderr: "pipe", stdout: "pipe" });
    return { code: r.exitCode ?? -1, out: (r.stdout?.toString() ?? "").trim(), err: (r.stderr?.toString() ?? "").trim() };
  } catch (e) {
    console.error(`repo-vis-gh-threw:${args[0] ?? "?"}:${String(e).slice(0, 60)}`);
    return { code: -1, out: "", err: `the gh spawn threw: ${String(e).slice(0, 80)}` };
  }
};

/** THE GIT RUNNER SEAM (the audit gate MED ×2 + LOW): ONE injectable runner for every git call in
 *  this module — the create-push, the visibility re-probe's tree ops, and pushIfAhead. The tests
 *  inject a fake; the production default spawns with `-C root` (never the process cwd). */
export interface GitRunner {
  (args: string[], root: string): { code: number; out: string; err: string };
}
export const gitRun: GitRunner = (args, root) => {
  try {
    const r = Bun.spawnSync(["git", "-C", root, ...args], { stderr: "pipe", stdout: "pipe" });
    return { code: r.exitCode ?? -1, out: (r.stdout?.toString() ?? "").trim(), err: (r.stderr?.toString() ?? "").trim() };
  } catch (e) {
    console.error(`repo-vis-git-threw:${args[0] ?? "?"}:${String(e).slice(0, 60)}`);
    return { code: -1, out: "", err: `the git spawn threw: ${String(e).slice(0, 80)}` };
  }
};

/** PROBE — does the repo exist, and at which visibility? `gh repo view` is the read path (it
 *  resolves the host from gh's own config; our host is always github.com in practice). */
export function probeRepo(owner: string, repo: string, token: string, run: GhRunner = ghRun): RepoState {
  if (!owner || !repo) return { exists: false, visibility: null, absent: false, detail: "no owner/repo to probe" };
  const r = run(["repo", "view", `${owner}/${repo}`, "--json", "visibility,isPrivate"], token, {});
  if (r.code !== 0) {
    // 404 / "not found" is the ABSENT case; anything else is a read failure we must NOT mistake
    // for absence (the stale-substrate law: an empty result and a wrong-scope result differ).
    const absent = /not found|could not resolve|HTTP 404/i.test(r.err);
    return { exists: false, visibility: null, absent, detail: absent ? `the repo ${owner}/${repo} does not exist` : `the probe failed: ${r.err.slice(0, 120)}` };
  }
  let visibility: Visibility | null = null;
  try {
    const j = JSON.parse(r.out) as { visibility?: string; isPrivate?: boolean };
    visibility = (j.visibility ?? (j.isPrivate ? "private" : "public")).toLowerCase() === "private" ? "private" : "public";
  } catch (e) {
    console.error(`repo-vis-probe-parse:${owner}/${repo}:${String(e).slice(0, 50)}`);
    return { exists: false, visibility: null, absent: false, detail: `the probe's JSON did not parse: ${r.out.slice(0, 80)}` };
  }
  return { exists: true, visibility, absent: false, detail: `${owner}/${repo} exists · visibility=${visibility}` };
}

/** THE PROVISIONER — the ONE place the kernel creates a repo or flips its visibility.
 *  `create` gates only the ABSENT case; an existing repo is edited toward the wanted visibility.
 *  Both directions are supported (public→private is the operator's explicit "alter if we want"). */
export function provisionRepo(
  t: { owner: string; repo: string; root: string },
  want: { visibility: Visibility; create: boolean; push?: boolean },
  token: string,
  run: GhRunner = ghRun,
  grit: GitRunner = gitRun,
): ProvisionVerdict {
  const did: string[] = [];
  const slug = `${t.owner}/${t.repo}`;
  if (!t.owner || !t.repo) {
    return { ok: false, refused: "REPO-NO-TARGET", remedy: "pass --owner <o> --repo <r>, or set origin to a GitHub remote", detail: "no owner/repo to provision", did };
  }
  if (!token) {
    // the fail-closed shape: a missing credential is NAMED, never a silent skip.
    return { ok: false, refused: `REPO-AUTH-MISSING`, remedy: `export GH_TOKEN=<a PAT with repo scope>   # gh runs non-interactively (GH_PROMPT_DISABLED=1); a PAT bypasses 2FA entirely`, detail: "no token — refusing before any call", did };
  }

  const state = probeRepo(t.owner, t.repo, token, run);
  if (!state.exists && !state.absent) {
    // the probe FAILED (not absent) — refuse rather than guess (never create over a read error).
    return { ok: false, refused: `REPO-PROBE-FAILED:${slug}`, remedy: `gh repo view ${slug}`, detail: state.detail, did };
  }

  // ── the ABSENT case: CREATE ─────────────────────────────────────────────────────────────
  if (!state.exists) {
    if (!want.create) {
      return { ok: false, refused: `REPO-ABSENT-NO-CREATE:${slug}`, remedy: `gh repo create ${slug} --${want.visibility}`, detail: `the repo ${slug} does not exist and create is disabled`, did };
    }
    // NO --source/--remote BY CONSTRUCTION (adjudicated: the audit gate re-raised this as a HIGH
    // twice — it is a PROBE-ERROR). The REMOTE ALREADY EXISTS: the attach DERIVED this target from
    // `git remote get-url origin` (a tree without one refuses earlier with ATTACH-NO-TARGET), so
    // the create makes the GitHub-side repo and the EXISTING origin is pushed below. Passing
    // --source/--remote here would (a) duplicate what the tree already has and (b) FAIL on gh's
    // "remote origin already exists". The invariant is ENFORCED below, not assumed.
    const c = run(["repo", "create", slug, `--${want.visibility}`], token, {});
    if (c.code !== 0) {
      return { ok: false, refused: `REPO-CREATE-FAILED:${slug}`, remedy: `gh repo create ${slug} --${want.visibility}   # check the token's scope (needs repo) and org permissions`, detail: c.err.slice(0, 160) || `exit ${c.code}`, did };
    }
    did.push(`created ${slug} (${want.visibility})`);
    // the push: the ruleset guards a repo that HAS commits — an empty repo is an inert rail.
    if (want.push !== false) {
      // THE INVARIANT, ENFORCED (not assumed): the origin must resolve before the push, or the
      // push fails with a git-native message instead of OUR named refusal.
      const origin = grit(["remote", "get-url", "origin"], t.root);
      if (origin.code !== 0 || !origin.out) {
        return { ok: false, refused: `REPO-NO-ORIGIN:${slug}`, remedy: `git -C ${JSON.stringify(t.root)} remote add origin https://github.com/${slug}.git   # then re-run`, detail: `the repo was created but ${t.root} has no origin remote to push to`, did };
      }
      const p = grit(["push", "-u", "origin", "HEAD"], t.root);
      if (p.code !== 0) {
        // the repo EXISTS now — the push failed. A NAMED refusal carrying both facts.
        return { ok: false, refused: `REPO-PUSH-FAILED:${slug}`, remedy: `git -C ${JSON.stringify(t.root)} push -u origin HEAD`, detail: `the repo was created but the push failed: ${(p.err || `exit ${p.code}`).slice(0, 160)}`, did };
      }
      did.push(`pushed HEAD → origin (${slug})`);
    }
    // THE RE-PROBE (the audit gate MED): a success is CONFIRMED against the API — the fail-closed
    // philosophy forbids a claimed success. A create that did not stick is NAMED.
    const after = probeRepo(t.owner, t.repo, token, run);
    // the re-probe checks BOTH facts (the audit gate MEDIUM): existence AND the visibility —
    // a provider-side override (an org policy forcing private) must never read as a success.
    if (!after.exists || after.visibility !== want.visibility) {
      return { ok: false, refused: `REPO-CREATE-UNCONFIRMED:${slug}`, remedy: `gh repo view ${slug} --json visibility,isPrivate`, detail: `created, then the re-probe read ${after.exists ? after.visibility : "(unreadable: " + after.detail.slice(0, 80) + ")"} — wanted ${want.visibility}`, did };
    }
    return { ok: true, detail: `provisioned ${slug} (${after.visibility}) — confirmed by re-probe`, did };
  }

  // ── the PRESENT case: EDIT toward the wanted visibility (both directions) ────────────────
  if (state.visibility === want.visibility) {
    return { ok: true, detail: `${slug} already ${want.visibility} (noop)`, did };
  }
  // `--accept-visibility-change-consequences` is what makes the flip NON-INTERACTIVE (gh otherwise
  // prompts for a public↔private change; with GH_PROMPT_DISABLED=1 a prompt would HANG).
  const e = run(["repo", "edit", slug, "--visibility", want.visibility, "--accept-visibility-change-consequences"], token, {});
  if (e.code !== 0) {
    return { ok: false, refused: `REPO-VISIBILITY-FAILED:${slug}`, remedy: `gh repo edit ${slug} --visibility ${want.visibility} --accept-visibility-change-consequences   # needs admin on the repo (repo scope)`, detail: e.err.slice(0, 160) || `exit ${e.code}`, did };
  }
  did.push(`${state.visibility} → ${want.visibility} (${slug})`);
  // THE RE-PROBE (the audit gate MED): confirm the flip against the API — never a claimed success.
  const after = probeRepo(t.owner, t.repo, token, run);
  if (!after.exists || after.visibility !== want.visibility) {
    return { ok: false, refused: `REPO-VISIBILITY-UNCONFIRMED:${slug}`, remedy: `gh repo view ${slug} --json visibility`, detail: `edited, then the re-probe read ${after.exists ? after.visibility : "(absent)"} — the flip did not stick`, did };
  }
  return { ok: true, detail: `flipped ${slug}: ${state.visibility} → ${after.visibility} (confirmed by re-probe)`, did };
}

/** Resolve a target's owner/repo/host from a path or a registry id — the verb's front door.
 *  Kept here (not in the verb) so both `attach` and `vis` resolve identically. */
export function resolveTargetForVis(
  arg: string,
  reg: { projects: { id: string; root: string; owner: string; repo: string; host?: string }[] },
): { owner: string; repo: string; root: string; host: string } | { error: string } {
  const byId = reg.projects.find((p) => p.id === arg);
  if (byId) return { owner: byId.owner, repo: byId.repo, root: byId.root, host: byId.host ?? "github.com" };
  // the audit gate LOW: with NESTED roots the first match could be the SHALLOWER one — the
  // LONGEST matching root owns a path.
  const byPath = reg.projects
    .filter((p) => p.root === arg || arg.startsWith(`${p.root}/`))
    .sort((a, b) => b.root.length - a.root.length)[0];
  if (byPath) return { owner: byPath.owner, repo: byPath.repo, root: byPath.root, host: byPath.host ?? "github.com" };
  return { error: `no project matches "${arg}" (known: ${reg.projects.map((p) => p.id).join(", ") || "none"})` };
}

/** PUSH THE LOCAL BRANCH WHEN IT IS AHEAD — the last manual act the operator banned ("dont leave
 *  any stupid bs for me to have to manage"). The attach writes the wiring + hooks locally; without
 *  the push the REMOTE has none of it and the ruleset guards nothing. Idempotent: an up-to-date
 *  branch is a noop. A missing upstream ref = push with `-u`. Every failure is a NAMED refusal. */
export function pushIfAhead(root: string, grit: GitRunner = gitRun): { ok: boolean; pushed: boolean; detail: string; refused?: string; remedy?: string; /** the remote requires a PR (branch protection) — an EXPECTED state, the attach still landed */ needsPr?: boolean } {
  const g = (args: string[]): { code: number; out: string; err: string } => grit(args, root);
  // FIXED (measured): `rev-parse --abbrev-ref HEAD` EXITS 128 on a repo with no commits
  // ("unknown revision") — so the empty-repo case was misread as a detached HEAD. `symbolic-ref
  // --short HEAD` resolves the branch from HEAD's symref and works on an empty repo; it fails
  // exactly when there IS no branch (a truly detached HEAD).
  const br = g(["symbolic-ref", "--short", "HEAD"]);
  if (br.code !== 0 || !br.out) {
    return { ok: false, pushed: false, detail: "the branch could not be resolved (a detached HEAD?)", refused: `REPO-PUSH-NO-BRANCH:${root}`, remedy: `git -C ${JSON.stringify(root)} switch -c main` };
  }
  const branch = br.out;
  // A TREE WITH ZERO COMMITS CANNOT PUSH, and that is NOT a failure — it is a legitimate empty
  // repo (measured: two attach tests init a bare-creating fixture with no commit; the push failed
  // the WHOLE attach for a state that is perfectly valid). The first commit pushes later.
  const head = g(["rev-parse", "--verify", "HEAD"]);
  if (head.code !== 0) {
    return { ok: true, pushed: false, detail: "no commits yet — nothing to push (the first commit will carry it)" };
  }
  const ahead = g(["rev-list", "--count", `origin/${branch}..HEAD`]);
  if (ahead.code === 0 && ahead.out === "0") {
    return { ok: true, pushed: false, detail: `origin/${branch} is up to date (noop)` };
  }
  // the remote ref may not exist yet — the count failed for that reason, not for a real error.
  const push = g(["push", "-u", "origin", `HEAD:refs/heads/${branch}`]);
  if (push.code !== 0) {
    // FIRING 012 / FIXED (measured LIVE, op9b — PLUTUS_VISION): "REJECT: direct pushes to main are
    // not permitted; open a PR." That is the repo's OWN branch protection WORKING — the exact
    // enforcement the kernel exists to install. It is an EXPECTED state, never a failure of the
    // attach: the wiring + hooks + registry DID land; what the remote demands is the PR flow.
    // Reported as `needsPr` (ok:true for the attach, the push state NAMED — never silent).
    if (/pull request|protected branch|not permitted|GH006|required status/i.test(push.err)) {
      return { ok: true, pushed: false, needsPr: true, detail: `the remote requires a PR for ${branch} — the branch protection is working as designed (the attach landed locally)`, remedy: `git -C ${JSON.stringify(root)} push origin HEAD:refs/heads/attach/${branch} && gh pr create --fill --base ${branch} --head attach/${branch}` };
    }
    return { ok: false, pushed: false, detail: push.err.slice(0, 200) || `exit ${push.code}`, refused: `REPO-PUSH-FAILED:${branch}`, remedy: `git -C ${JSON.stringify(root)} push -u origin HEAD` };
  }
  const n = ahead.code === 0 ? ahead.out : "?";
  return { ok: true, pushed: true, detail: `pushed ${n} commit(s) → origin/${branch}` };
}

