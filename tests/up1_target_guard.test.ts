// UP-1: each project root's git origin must match its registry entry.
// A mismatch fails. PLUTUS_VISION is skipped and never read.
// jev-fact-kernel is reported, never repointed.
import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { canonicalOrigin, checkTargets, gitOrigin, projectsJsonOverlap, type RegistryEntry } from "../src/target-guard";

function repoWithOrigin(origin: string): string {
  const root = mkdtempSync(join(tmpdir(), "up1-"));
  const git = (args: string[]) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout || "git failed");
  };
  git(["init", "-q"]);
  git(["remote", "add", "origin", origin]);
  return root;
}

test("UP-1: matching origins pass and each checked root is named", () => {
  const alpha = repoWithOrigin("https://github.com/leviathan-devops/alpha.git");
  const kernel = repoWithOrigin("https://github.com/leviathan-devops/jev-fact-kernel.git");
  const entries: RegistryEntry[] = [
    { id: "alpha", root: alpha, origin: "https://github.com/leviathan-devops/alpha.git" },
    { id: "jev-fact-kernel", root: kernel, origin: "https://github.com/leviathan-devops/jev-fact-kernel.git" },
  ];
  try {
    const result = checkTargets(entries, gitOrigin);
    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(result.checked).toContain("alpha");
    expect(result.checked).toContain("jev-fact-kernel");
  } finally {
    rmSync(alpha, { recursive: true, force: true });
    rmSync(kernel, { recursive: true, force: true });
  }
});

test("UP-1: a mismatched origin fails", () => {
  const root = repoWithOrigin("https://github.com/leviathan-devops/actual.git");
  const entries: RegistryEntry[] = [
    { id: "widget", root, origin: "https://github.com/leviathan-devops/expected.git" },
  ];
  try {
    const result = checkTargets(entries, gitOrigin);
    expect(result.ok).toBe(false);
    expect(result.mismatches).toEqual([
      {
        id: "widget",
        root,
        registryOrigin: "https://github.com/leviathan-devops/expected.git",
        actualOrigin: "https://github.com/leviathan-devops/actual.git",
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("UP-1: PLUTUS_VISION is skipped, not tested, and the skip is noted", () => {
  const root = repoWithOrigin("https://github.com/leviathan-devops/jarvis-upper.git");
  const entries: RegistryEntry[] = [
    { id: "jarvis-upper", root, origin: "https://github.com/leviathan-devops/jarvis-upper.git" },
    { id: "PLUTUS_VISION", root: "PLUTUS_VISION_ROOT", origin: "https://github.com/leviathan-devops/plutus-vision.git" },
  ];
  const readOrigin = (projectRoot: string): string | null => {
    if (projectRoot.includes("PLUTUS")) throw new Error("PLUTUS_VISION was tested");
    return gitOrigin(projectRoot);
  };
  try {
    const result = checkTargets(entries, readOrigin);
    expect(result.ok).toBe(true);
    expect(result.checked).toEqual(["jarvis-upper"]);
    expect(result.checked).not.toContain("PLUTUS_VISION");
    expect(result.skipped.map((s) => s.id)).toEqual(["PLUTUS_VISION"]);
    expect(result.skipped[0]?.note).toContain("SKIP");
    expect(result.skipped[0]?.note).toContain("PLUTUS_VISION");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("UP-1: a jev-fact-kernel mismatch is reported and the registry entry is not repointed", () => {
  const root = repoWithOrigin("https://github.com/leviathan-devops/jev-fact-kernel.git");
  const entries: RegistryEntry[] = [
    {
      id: "jev-fact-kernel",
      root,
      origin: "https://github.com/leviathan-devops/jev-manager-tool.git",
    },
  ];
  const before = JSON.stringify(entries);
  try {
    const result = checkTargets(entries, gitOrigin);
    expect(JSON.stringify(entries)).toBe(before);
    expect(entries[0]?.origin).toBe("https://github.com/leviathan-devops/jev-manager-tool.git");
    expect(result.ok).toBe(false);
    expect(result.mismatches[0]?.id).toBe("jev-fact-kernel");
    expect(result.mismatches[0]?.registryOrigin).toBe("https://github.com/leviathan-devops/jev-manager-tool.git");
    expect(result.mismatches[0]?.actualOrigin).toBe("https://github.com/leviathan-devops/jev-fact-kernel.git");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("UP-1: a credential in the remote URL is not part of the origin", () => {
  expect(canonicalOrigin("https://x-access-token:not-a-real-secret@github.com/acme/widget.git"))
    .toBe("https://github.com/acme/widget.git");
  expect(canonicalOrigin("https://github.com/acme/widget.git"))
    .toBe("https://github.com/acme/widget.git");
});

test("UP-1: an empty root reports that projects.json is absent there", () => {
  const root = mkdtempSync(join(tmpdir(), "up1-reg-"));
  try {
    const overlap = projectsJsonOverlap(root);
    expect(existsSync(join(root, "projects.json"))).toBe(false);
    expect(overlap.staleBase).toBe(false);
    expect(overlap.note).toBe("projects.json is absent at this root");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("UP-1: synced projects.json is on this head and omits PLUTUS_VISION", () => {
  const root = join(import.meta.dir, "..");
  const path = join(root, "projects.json");
  expect(existsSync(path)).toBe(true);
  const overlap = projectsJsonOverlap(root);
  expect(overlap.staleBase).toBe(false);
  expect(overlap.note).toBe(
    "projects.json is synced from 01e314e, which contains 050ff69. It is on this head and is not repointed",
  );
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    projects: { id: string; repo: string }[];
  };
  const ids = parsed.projects.map((p) => p.id);
  expect(ids).not.toContain("PLUTUS_VISION");
  const repo = (id: string) => parsed.projects.find((p) => p.id === id)?.repo;
  expect(repo("jev-fact-kernel")).toBe("jev-manager-tool");
  expect(repo("JevManager")).toBe("jev-manager-tool");
});
