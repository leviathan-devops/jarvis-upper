// target-guard.ts — each registry project root's git origin must match
// the registry entry. PLUTUS_VISION is skipped (owner rule). The guard
// never rewrites an entry; jev-fact-kernel is an owner decision.
export interface RegistryEntry {
  id: string;
  root: string;
  origin: string;
}

export interface TargetGuardSkip {
  id: string;
  note: string;
}

export interface TargetGuardMismatch {
  id: string;
  root: string;
  registryOrigin: string;
  actualOrigin: string | null;
}

export interface TargetGuardResult {
  ok: boolean;
  checked: string[];
  skipped: TargetGuardSkip[];
  mismatches: TargetGuardMismatch[];
}

const PLUTUS_VISION = "PLUTUS_VISION";

// Drop transport credentials. A url.insteadOf rewrite can inject them into
// `git remote get-url`, and they are not part of the repository identity.
export function canonicalOrigin(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    const credentialed = u.password !== "" || u.username === "x-access-token" || u.username.includes("token");
    if (credentialed) {
      u.username = "";
      u.password = "";
    }
    const out = u.toString();
    return out.endsWith("/") && u.pathname !== "/" ? out.slice(0, -1) : out;
  } catch {
    return trimmed;
  }
}

export function checkTargets(
  entries: readonly RegistryEntry[],
  readOrigin: (root: string) => string | null,
): TargetGuardResult {
  const checked: string[] = [];
  const skipped: TargetGuardSkip[] = [];
  const mismatches: TargetGuardMismatch[] = [];
  for (const entry of entries) {
    if (entry.id === PLUTUS_VISION) {
      skipped.push({
        id: entry.id,
        note: "SKIP PLUTUS_VISION: owner rule — not touched, edited, or tested",
      });
      continue;
    }
    checked.push(entry.id);
    const raw = readOrigin(entry.root);
    const actualOrigin = raw === null ? null : canonicalOrigin(raw);
    const registryOrigin = canonicalOrigin(entry.origin);
    if (actualOrigin !== registryOrigin) {
      mismatches.push({
        id: entry.id,
        root: entry.root,
        registryOrigin,
        actualOrigin,
      });
    }
  }
  return { ok: mismatches.length === 0, checked, skipped, mismatches };
}

export function gitOrigin(root: string): string | null {
  const r = Bun.spawnSync(["git", "-C", root, "remote", "get-url", "origin"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (r.exitCode !== 0) return null;
  const text = r.stdout.toString().trim();
  return text.length > 0 ? canonicalOrigin(text) : null;
}
