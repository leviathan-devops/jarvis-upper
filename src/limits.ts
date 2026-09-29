// limits.ts — THE SHARED NUMERIC LIMITS. A tiny dependency-free module so lightweight callers
// (projects.ts, guardrail.ts) do not pull runtime.ts's heavy graph (bun:sqlite, store, adapters,
// the daemon client) just for a constant — and so the floors live in ONE place (they had drifted).

/** The tickMs floor. ONE authority for parseTickMs, checkProject, and main()'s per-project check. */
export const MIN_TICK_MS = 1000;
export function isValidTickMs(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= MIN_TICK_MS;
}

/** The max length of a URL path segment (owner/repo/sha). ONE cap, no drift. */
export const MAX_SEG_LEN = 100;
