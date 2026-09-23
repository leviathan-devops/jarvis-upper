# W3 Desk Report — src/*.ts Hardening

**Desk:** W3SrcDesk
**Files owned:** 20 (src/*.ts)
**Status:** COMPLETE — 78 pass / 0 fail, tsc clean

---

## Per-Finding Verdicts

### src/attribute.ts (3 findings)

- **F1 [HIGH] line 29 — shell injection via `sh -c`** — **FIXED**
  Changed default `Proc` from `sh(c.join(" "), cwd)` to `Bun.spawn(cmd, cwd)` directly, eliminating shell interpretation of filenames/args. Removed unused `q()` helper.

- **F2 [MEDIUM] line 96 — unused `perFile` map** — **FIXED**
  Removed dead `perFile` computation (lines 96-99). Scoring uses `logHits`/`blameHits`/`scored` directly.

- **F3 [MEDIUM] line 104 — N+1 sequential `git log`** — **DEFERRED**
  Performance improvement, not a correctness defect. Changing async batching could affect scoring order determinism. Deferred to follow-up.

### src/dossier.ts (2 findings)

- **F4 [HIGH] line 14 — path traversal via `bugId`** — **FIXED**
  Added `BUGID_RE = /^[A-Za-z0-9_-]+$/` validation in `dossierDir()`. Rejects `../`, `/`, and shell metacharacters.

- **F5 [MEDIUM] line 23 — silent overwrite on re-run** — **DEFERRED**
  Initially added strict "refuse if exists" but this broke `ship_manifest` test which reuses bugIds across fixtures. Permissive `mkdir({recursive:true})` is the tested contract; strict idempotency is a follow-up design decision.

### src/desks.ts (4 findings)

- **F6 [HIGH] line 21 — path traversal via fixture files** — **FIXED**
  Added `startsWith()` prefix checks on both source (`fx.root/history/`) and dest (`dir/`) paths before read/write. Throws `PATH-TRAVERSAL` on escape.

- **F7 [HIGH] line 40 — sha16(before) instead of sha16(after)** — **FIXED**
  Added `const after = await Bun.file(path).text()` after the write and hash the post-write content.

- **F8 [MEDIUM] line 15 — unguarded JSON.parse** — **FIXED**
  Wrapped all 4 fixture JSON.parse calls (pr-set, defect, seeded-defect, research) with try/catch throwing named `FIXTURE-PARSE-ERROR:<filename>`.

- **F9 [LOW] line 14 — unused `db` param in waveA** — **DEFERRED**
  API contract parameter; removing would break callers. Noted as dead param.

### src/guardrail.ts (4 findings)

- **F10 [HIGH] line 65 — first-wins freezes stale status** — **FIXED**
  Changed `if (!(r.context in latest))` to unconditional `latest[r.context] = r.state` (last-wins). GitHub statuses API returns newest-first.

- **F11 [MEDIUM] line 29 — sha16 vs head_sha domain mismatch** — **DEFERRED**
  Tests pin identical values for `sha16` and `head_sha`. Domain-aware comparison would require schema changes to gate_pass table. Recorded as known limitation.

- **F12 [HIGH] line 55 — unvalidated URL segments (SSRF)** — **FIXED**
  Added `safeSeg` regex validation for owner/repo and path-traversal check for sha. Uses `encodeURIComponent()` on all segments.

- **F13 [MEDIUM] line 58 — no timeout on remote fetch** — **FIXED**
  Added `AbortSignal.timeout(10000)` to the status fetch call.

### src/kick.ts (5 findings)

- **F14 [HIGH] line 45 — unguarded JSON.parse** — **FIXED**
  Wrapped `JSON.parse(oj)` in try/catch throwing `DOSSIER-CORRUPT:origin.json`.

- **F15 [HIGH] line 50 — null-session crash** — **FIXED**
  Added explicit `if (!sessionId) throw new Error('KICK-NO-SESSION')` guard before `send()`. Removed non-null assertion `!`.

- **F16 [LOW] line 36 — dead `void 0`** — **FIXED**
  Removed the dead comment/statement.

- **F17 [HIGH] line 41 — split-brain dossier paths** — **FIXED**
  Added canonicalization: always uses `input.dossierPath` and throws `DOSSIER-PATH-MISMATCH` if DB path diverges.

- **F18 [MEDIUM] line 47 — sessionAlive rejection crashes kick** — **FIXED**
  Added `.catch(() => false)` to `sessionAlive()` call so rejection falls back to spawn mode.

### src/runtime.ts (5 findings)

- **F19 [HIGH] line 264 — overlapping ticks / unhandled rejection** — **FIXED**
  Added `inFlight` flag in state; `safeTick()` skips if a tick is already running. Added `.catch()` on tick promise.

- **F20 [MEDIUM] line 74 — Bun.write without await** — **FIXED**
  Added `await` before `Bun.write(wireCapturePath(...))`.

- **F21 [MEDIUM] line 23 — TICK_MS frozen at module load** — **FIXED**
  Added `tickMs?: number` to `RuntimeDeps`. `createRuntime` resolves `deps.tickMs ?? env ?? 15000` inside the function, not at module scope.

- **F22 [MEDIUM] line 224 — guardrail evaluated twice per PR** — **FIXED**
  Added `guardrailCache` Map inside the publish block. Each PR's guardrail result is cached for reuse.

- **F23 [MEDIUM] line 233 — sequential publish loop** — **FIXED**
  Changed to `Promise.allSettled` with `PUB_CONC = 4` bounded parallelism.

### src/verdict.ts (8 findings)

- **F24 [HIGH] line 100 — inline `require("node:fs")`** — **FIXED**
  Replaced both `require("node:fs").readFileSync(...)` calls with the already-imported `readFileSync` from top-level imports.

- **F25 [HIGH] line 32 — hardcoded absolute paths** — **FIXED**
  Made `FENCE_DEFAULT` and `LEDGER_DEFAULT` env-overridable via `FENCE2_BIN` and `FENCE2_LEDGER`.

- **F26 [HIGH] line 167 — ignores reviews payload** — **FIXED**
  Merged `payload.reviews` into `payload.runs` shape (mapping `status` -> `verdict`) before scanning for approving verdict.

- **F27 [MEDIUM] line 132 — invariant validated after use** — **FIXED**
  Moved `if (!invariant) throw` before the `runFence(argv)` call, preventing empty-invariant fence invocation.

- **F28 [MEDIUM] line 71 — substring jobNeedle match** — **FIXED**
  Added exact JSON `job` field comparison first, falling back to substring only when the row has no `job` field.

- **F29 [HIGH] line 94 — empty headSha bypasses binding** — **FIXED**
  Added upfront rejection: `if (!opts.headSha || opts.headSha.length < 40)` returns `HEAD-SHA-INVALID` reason immediately.

- **F30 [LOW] line 155 — FENCE-NOT-RUN pushed twice** — **FIXED**
  Added guard: `if (... && !fence.reason.startsWith('FENCE-NOT-RUN'))` on the second push.

- **F31 [MEDIUM] line 59 — hardcoded localhost:3001** — **FIXED**
  Uses `process.env.AO_DAEMON ?? 'http://localhost:3001'` for the reviews endpoint URL.

### src/cli-verbs.ts (4 findings)

- **F32 [MEDIUM] line 24 — freshness window 4x instead of 2x** — **FIXED**
  Removed extra `* 2`: `ageMs < 2 * Number(process.env.UPPER_TICK_MS ?? 15000)`.

- **F33 [MEDIUM] line 40 — DB handles leaked** — **FIXED**
  Added `try/finally { db.close() }` to all 7 verb functions (verbPlan, verbOrder, verbGraph, verbGates, verbSync, verbBug, verbDesks). Fixed verbSync double-open to use single DB.

- **F34 [MEDIUM] line 70 — NaN line from bad `file:line` split** — **FIXED**
  Changed `arg.split(":")` to `arg.lastIndexOf(":")` to support paths containing `:`. Added `Number.isFinite(line) && line >= 1` validation.

- **F35 [MEDIUM] line 82 — hardcoded bugId + no idempotency** — **FIXED**
  Changed to `w4-cli-${Date.now().toString(36)}` for unique IDs.

### src/cli.ts (3 findings)

- **F36 [MEDIUM] line 27 — unhandled rejection on verb dispatch** — **FIXED**
  Added `.catch((e) => { console.log(JSON.stringify({ok:false, error:...})); process.exit(1); })`.

- **F37 [MEDIUM] line 9 — extra args silently dropped** — **FIXED**
  Captured `...extras` from `Bun.argv.slice(2)`. Added guard: rejects extras with usage (exit 2) for non-init/cursor verbs.

- **F38 [MEDIUM] line 10 — early `order` guard makes verbOrder unreachable** — **FIXED**
  Removed early `if (verb === "order")` guard. `verbOrder` already handles unconfirmed plan refusal.

### src/adapter-verbs.ts (3 findings)

- **F39 [MEDIUM] line 9 — null-deref on falsy response** — **FIXED**
  Added `res && typeof res === 'object'` null guards on `listProjects`, `listSessions`, and `listPrsFromAo` responses.

- **F40 [LOW] line 8 — listProjects not injectable** — **FIXED**
  Added `opts: { callFn?: typeof call } = {}` parameter like the other verbs.

- **F41 [MEDIUM] line 32 — sequential listSessionPRs stalls entire sync** — **FIXED**
  Changed to `Promise.allSettled` with `CONC = 8` bounded parallelism. Per-session try/catch so one failure doesn't abort sync.

### src/sync.ts (3 findings)

- **F42 [MEDIUM] line 21 — ON CONFLICT misses fields** — **FIXED**
  Added `base_sha`, `source_branch`, `target_branch` to `DO UPDATE SET`.

- **F43 [MEDIUM] line 32 — returns total count, not synced count** — **FIXED**
  Changed to `return { rows: rows.length }`.

- **F44 [MEDIUM] line 31 — no transaction around upserts** — **FIXED**
  Wrapped loop in `db.transaction()`.

### src/plan.ts (3 findings)

- **F45 [MEDIUM] line 20 — duplicate edges double-increment indegree** — **FIXED**
  Added `seenEdges` Set to deduplicate `(from, to)` pairs before counting.

- **F46 [LOW] line 37 — O(n^2) cycle detection** — **FIXED**
  Changed `order.includes()` to `Set.has()` for cycle node filtering.

- **F47 [HIGH] line 21 — dropping edges for missing deps** — **PROBE-ERROR**
  **Not a defect.** The plan only orders `ready_to_merge` PRs. Non-ready deps can't appear in the order anyway. The guardrail independently checks deps at execution time (DEP-UNMERGED). Dropping the edge is correct: there's no ordering relationship to establish between ready and non-ready PRs.

### src/publish.ts (3 findings)

- **F48 [MEDIUM] line 46 — unencoded URL segments** — **FIXED**
  Added `encodeURIComponent()` to owner, repo, and sha in the POST URL.

- **F49 [HIGH] line 50 — no timeout on POST** — **FIXED**
  Added `AbortSignal.timeout(15000)` to the fetch call.

- **F50 [LOW] line 90 — sequential fence2/verdict POSTs** — **FIXED**
  Changed to `Promise.all()` for parallel publish.

### src/reducers.ts (1 finding)

- **F51 [HIGH] line 22 — raw state without allow-list** — **FIXED**
  Added `ALLOWED_PR_STATES` Record validation. Unknown states fall back to `"open"`.

### src/status-contract.ts (2 findings)

- **F52 [LOW] line 65 — context typed as string** — **FIXED**
  Changed `PublishPayload.context` from `string` to `StatusContext`.

- **F53 [MEDIUM] line 62 — StatusContext only covers factory/* contexts** — **FIXED**
  Changed `StatusContext` from `(typeof STATUS_CONTEXTS)[keyof typeof STATUS_CONTEXTS]` to `(typeof REQUIRED_CONTEXTS)[number]` — covers all 8 frozen contexts.

### src/status.ts (2 findings)

- **F54 [MEDIUM] line 35 — ticks.log append-only no rotation** — **FIXED**
  Added rotation: after append, if file exceeds 10000 lines, truncate to last 5000.

- **F55 [MEDIUM] line 27 — shared tmp path race** — **FIXED**
  Changed tmp to `${p}.${process.pid}.${Date.now()}.tmp` for unique per-write temp file.

### src/store.ts (1 finding)

- **F56 [MEDIUM] line 4 — STORE_PATH frozen at module load** — **FIXED**
  Changed `openStore(path?)` to resolve env inside the function when no path arg is given.

### src/graph.ts (1 finding)

- **F57 [MEDIUM] line 14 — `status != 'fixed'` filters NULL** — **FIXED**
  Changed to `COALESCE(status,'') != 'fixed'` to include NULL-status rows.

### src/execute.ts (2 findings)

- **F58 [MEDIUM] line 30 — plan:Date.now() collision** — **FIXED**
  Changed to `plan:${Date.now()}-${Math.random().toString(36).slice(2,8)}` for uniqueness.

- **F59 [MEDIUM] line 45 — sets merged_at at merge_ordered** — **FIXED**
  Removed `merged_at=strftime('%s','now')` from the merge_ordered UPDATE. merged_at stays NULL until actually merged.

### src/main.ts (2 findings)

- **F60 [MEDIUM] line 7 — tickMs parsed but never passed** — **FIXED**
  Passes `{ deps: { tickMs } }` to `createRuntime`.

- **F61 [MEDIUM] line 15 — stop() rejection unhandled** — **FIXED**
  Added `.catch((e) => { console.error(...); process.exit(1); })` to both signal handlers.

---

## Summary

| Metric | Value |
|---|---|
| Findings total | 61 |
| FIXED | 56 |
| PROBE-ERROR (false positive) | 1 (F47) |
| DEFERRED (performance/API) | 4 (F3, F5, F9, F11) |
| Files changed | 20 |

## Acceptance

- `bunx tsc --noEmit` — **exit 0**
- `bun test` — **78 pass / 0 fail**
- `grep -c 'gates/\|factory/' src/status-contract.ts` — **15** (unchanged)
- 8 context strings present and byte-identical
- `grep -rn 'catch {}' src/` — **zero**

## Concerns

1. **F11 (sha16 vs head_sha domain mismatch)** — Deferred because tests use identical values for both fields. Schema change needed to store commit-SHA alongside content-hash in gate_pass for proper domain comparison.
2. **F3 (N+1 git log)** — Deferred performance improvement. Would need bounded Promise.all with concurrency limiter.
3. **F5 (dossier idempotency)** — The strict "refuse if exists" broke the ship_manifest test which reuses bugIds. Permissive approach is the tested contract; strict idempotency is a design decision for the operator.
4. **F9 (unused db param in waveA)** — API contract; removing would break callers. Dead parameter noted.
