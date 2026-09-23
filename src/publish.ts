// publish.ts — STATUS PUBLISHER: the factory's only new output.
//
// POSTs the two contexts the ruleset requires. All context strings come
// from the frozen contract; this file defines no context string of its own.
//
// LOUD-FAIL LAW at the publish boundary: a publish that cannot confirm
// must not claim green. Unreachable rail (fetch throws) or a non-2xx
// answer yields state error, never success.
import { STATUS_CONTEXTS } from "./status-contract";
import type { PublishPayload, PublishState } from "./status-contract";

export interface PublishResult {
  context: string;
  state: PublishState;
  status: number | null;
  ok: boolean;
  reason: string;
}

export interface PublishOpts {
  owner: string;
  repo: string;
  sha: string;
  token?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface VerdictInput {
  fence2Ok: boolean;
  verdictOk: boolean;
  description?: string;
}

const DEFAULT_BASE_URL = "https://api.github.com";
const MAX_DESCRIPTION = 140;

export async function publishStatus(
  opts: PublishOpts,
  payload: PublishPayload,
): Promise<PublishResult> {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  // FIXED 2026-09-23 (qwen-code-audit high): `??` lets an EMPTY STRING through,
  // so a blank opts.token produced `Authorization: Bearer ` (invalid). `||`
  // falls through on "" too.
  const token = opts.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
  const fetchFn = opts.fetchImpl ?? fetch;
  const description = payload.description.slice(0, MAX_DESCRIPTION);
  const url = `${baseUrl}/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}/statuses/${encodeURIComponent(opts.sha)}`;
  const body = { context: payload.context, state: payload.state, description };
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      context: payload.context,
      state: "error",
      status: null,
      ok: false,
      reason: e instanceof Error ? `FETCH-THREW:${e.message}` : `FETCH-THREW:${String(e)}`,
    };
  }
  if (!res.ok) {
    return {
      context: payload.context,
      state: "error",
      status: res.status,
      ok: false,
      reason: `HTTP-${res.status}`,
    };
  }
  return {
    context: payload.context,
    state: payload.state,
    status: res.status,
    ok: true,
    reason: "posted",
  };
}

export async function publishVerdict(
  opts: PublishOpts,
  v: VerdictInput,
): Promise<PublishResult[]> {
  const [fence2, verdict] = await Promise.all([
    publishStatus(opts, {
      context: STATUS_CONTEXTS.fence2,
      state: v.fence2Ok ? "success" : "failure",
      description: v.description ?? (v.fence2Ok ? "fence2: pass" : "fence2: fail"),
    }),
    publishStatus(opts, {
      context: STATUS_CONTEXTS.verdict,
      state: v.verdictOk ? "success" : "failure",
      description: v.description ?? (v.verdictOk ? "verdict: approved" : "verdict: not approved"),
    }),
  ]);
  return [fence2, verdict];
}
