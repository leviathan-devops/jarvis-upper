// TASK repo_visibility — FR-13's provisioner: EVERY branch, both halves.
// The operator's order: repos are PUBLIC by default, the kernel auto-converts, the mirror cases
// (public→private) work, a missing credential is NAMED, and a probe FAILURE is never mistaken
// for absence (the stale-substrate law: an empty result and a wrong-scope result differ bytes).
import { test, expect } from "bun:test";
import { provisionRepo, probeRepo, ghEnv, resolveTargetForVis, type GhRunner } from "../src/repo-visibility";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOKEN = "ghp_test_token";

/** A scripted runner: keyed by the args' first two words, recording every call. */
function scripted(table: Record<string, { code: number; out?: string; err?: string }>, calls: string[] = []): GhRunner {
  return (args) => {
    const key = args.slice(0, 2).join(" ");
    calls.push([...args, `tok=${args.includes(TOKEN) ? 0 : 1}`].join(" "));
    const hit = table[key] ?? { code: 1, err: `no script for "${key}"` };
    return { code: hit.code, out: hit.out ?? "", err: hit.err ?? "" };
  };
}
const noop = (): void => {};

test("test_provision_creates_an_absent_repo_public", () => {
  const calls: string[] = [];
  const run = scripted({
    "repo view": { code: 1, err: "HTTP 404: Not Found" },
    "repo create": { code: 0, out: "created" },
  }, calls);
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "public", create: true, push: false }, TOKEN, run);
  expect(r.ok).toBe(true);
  expect(r.did.some((d) => d.includes("created o/r (public)"))).toBe(true);
  expect(calls.some((c) => c.startsWith("repo create o/r --public"))).toBe(true);
});

test("test_provision_refuses_absent_when_create_disabled", () => {
  const run = scripted({ "repo view": { code: 1, err: "not found" } });
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "public", create: false }, TOKEN, run);
  expect(r.ok).toBe(false);
  expect(r.refused).toBe("REPO-ABSENT-NO-CREATE:o/r");
  expect(r.remedy).toContain("gh repo create o/r --public");
});

test("test_provision_flips_private_to_public_the_operator_default", () => {
  const calls: string[] = [];
  const run = scripted({
    "repo view": { code: 0, out: JSON.stringify({ visibility: "private", isPrivate: true }) },
    "repo edit": { code: 0 },
  }, calls);
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "public", create: true }, TOKEN, run);
  expect(r.ok).toBe(true);
  expect(r.did.some((d) => d.includes("private → public"))).toBe(true);
  // the NON-INTERACTIVE acceptance flag MUST be present (without it gh prompts → a hang).
  expect(calls.some((c) => c.includes("--accept-visibility-change-consequences"))).toBe(true);
});

test("test_provision_flips_public_to_private_the_mirror_case", () => {
  const calls: string[] = [];
  const run = scripted({
    "repo view": { code: 0, out: JSON.stringify({ visibility: "public", isPrivate: false }) },
    "repo edit": { code: 0 },
  }, calls);
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "private", create: false }, TOKEN, run);
  expect(r.ok).toBe(true);
  expect(r.did.some((d) => d.includes("public → private"))).toBe(true);
  expect(calls.some((c) => c.includes("--visibility private"))).toBe(true);
});

test("test_provision_is_a_noop_when_visibility_matches", () => {
  const calls: string[] = [];
  const run = scripted({ "repo view": { code: 0, out: JSON.stringify({ visibility: "public" }) } }, calls);
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "public", create: true }, TOKEN, run);
  expect(r.ok).toBe(true);
  expect(r.did.length).toBe(0);
  expect(calls.length).toBe(1);   // the probe only — NO edit
});

test("test_provision_refuses_without_a_token_fail_closed", () => {
  const run = scripted({});
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "public", create: true }, "", run);
  expect(r.ok).toBe(false);
  expect(r.refused).toBe("REPO-AUTH-MISSING");
  expect(r.remedy).toContain("GH_TOKEN");
});

test("test_provision_never_creates_over_a_probe_FAILURE", () => {
  // a 5xx / an auth error is NOT absence — creating here would race the truth.
  const calls: string[] = [];
  const run = scripted({ "repo view": { code: 1, err: "HTTP 502: Bad Gateway" } }, calls);
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "public", create: true }, TOKEN, run);
  expect(r.ok).toBe(false);
  expect(r.refused).toBe("REPO-PROBE-FAILED:o/r");
  expect(calls.some((c) => c.startsWith("repo create"))).toBe(false);
});

test("test_provision_refuses_when_create_fails", () => {
  const run = scripted({
    "repo view": { code: 1, err: "Could not resolve to a Repository" },
    "repo create": { code: 1, err: "HTTP 403: the token lacks the repo scope" },
  });
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "public", create: true }, TOKEN, run);
  expect(r.ok).toBe(false);
  expect(r.refused).toBe("REPO-CREATE-FAILED:o/r");
  expect(r.detail).toContain("403");
});

test("test_provision_refuses_when_the_flip_fails", () => {
  const run = scripted({
    "repo view": { code: 0, out: JSON.stringify({ visibility: "private" }) },
    "repo edit": { code: 1, err: "HTTP 403: must be an admin" },
  });
  const r = provisionRepo({ owner: "o", repo: "r", root: "/tmp" }, { visibility: "public", create: true }, TOKEN, run);
  expect(r.ok).toBe(false);
  expect(r.refused).toBe("REPO-VISIBILITY-FAILED:o/r");
  expect(r.remedy).toContain("--accept-visibility-change-consequences");
});

test("test_provision_refuses_with_no_owner_repo", () => {
  const r = provisionRepo({ owner: "", repo: "", root: "/tmp" }, { visibility: "public", create: true }, TOKEN);
  expect(r.ok).toBe(false);
  expect(r.refused).toBe("REPO-NO-TARGET");
});

test("test_probe_reports_absent_only_on_a_not_found", () => {
  const absent = probeRepo("o", "r", TOKEN, scripted({ "repo view": { code: 1, err: "HTTP 404: Not Found" } }));
  expect(absent.exists).toBe(false);
  expect(absent.detail).toContain("does not exist");
  const failed = probeRepo("o", "r", TOKEN, scripted({ "repo view": { code: 1, err: "HTTP 500" } }));
  expect(failed.exists).toBe(false);
  expect(failed.detail).toContain("probe failed");
});

test("test_probe_tolerates_the_isPrivate_only_shape", () => {
  const s = probeRepo("o", "r", TOKEN, scripted({ "repo view": { code: 0, out: JSON.stringify({ isPrivate: true }) } }));
  expect(s.exists).toBe(true);
  expect(s.visibility).toBe("private");
});

test("test_gh_env_guarantees_no_prompt_the_no_hang_law", () => {
  const e = ghEnv(TOKEN);
  expect(e.GH_PROMPT_DISABLED).toBe("1");
  expect(e.GH_TOKEN).toBe(TOKEN);
});

test("test_resolveTargetForVis_by_id_and_by_path_and_miss", () => {
  const reg = { projects: [{ id: "alpha", root: "/w/alpha", owner: "org", repo: "alpha-repo" }] };
  const byId = resolveTargetForVis("alpha", reg);
  expect("error" in byId ? "" : byId.repo).toBe("alpha-repo");
  const byPath = resolveTargetForVis("/w/alpha/sub", reg);
  expect("error" in byPath ? "" : byPath.repo).toBe("alpha-repo");
  const miss = resolveTargetForVis("/elsewhere", reg);
  expect("error" in miss).toBe(true);
});

test("test_provision_push_path_against_a_REAL_local_bare_remote", () => {
  // the push runs for real (no GitHub): a bare repo IS a valid origin. Proves the push wiring.
  const root = mkdtempSync(join(tmpdir(), "push-src-"));
  const bare = mkdtempSync(join(tmpdir(), "push-bare-"));
  const g = (args: string[], cwd: string) => Bun.spawnSync(["git", "-C", cwd, ...args], { stderr: "pipe", stdout: "pipe" });
  g(["init", "-q", "--bare", "-b", "main"], bare);
  g(["init", "-q", "-b", "main"], root);
  writeFileSync(join(root, "f.txt"), "x\n");
  g(["add", "-A"], root);
  g(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init"], root);
  g(["remote", "add", "origin", bare], root);

  const run = scripted({
    "repo view": { code: 1, err: "not found" },
    "repo create": { code: 0, out: "created" },
  });
  const r = provisionRepo({ owner: "o", repo: "r", root }, { visibility: "public", create: true, push: true }, TOKEN, run);
  expect(r.ok).toBe(true);
  expect(r.did.some((d) => d.startsWith("pushed HEAD → origin"))).toBe(true);
  const log = g(["log", "--oneline"], bare);
  expect(log.exitCode).toBe(0);
  expect(log.stdout.toString()).toContain("init");
});

noop();
