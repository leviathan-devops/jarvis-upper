// AoClient: typed REST wrapper over the AO daemon loopback API.
// AoClient: HTTP calls only; the daemon owns all state.
import { routeById } from "./gen/routes";

export const DAEMON = process.env.AO_DAEMON ?? "http://localhost:3001";

export class ApiError extends Error {
  code: string;
  status: number;
  requestId?: string;
  constructor(status: number, body: any) {
    super(typeof body === "object" && body?.message ? body.message : `HTTP ${status}`);
    this.status = status;
    this.code = typeof body === "object" && body?.code ? body.code : "UNKNOWN";
    this.requestId = typeof body === "object" ? body?.requestId : undefined;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The per-attempt ceiling for an AO HTTP call. A hung daemon must not block the
 *  tick forever (red-team audit W-05). */
// FIXED (ship-gate round MEDIUM): Number("")===0 / Number("abc")===NaN -> AbortSignal.timeout(0)
// aborts every call instantly (a self-DoS via env). Validate and fall back to 8000.
export const AO_CALL_TIMEOUT_MS = ((): number => {
  // FIXED (the W17 ship gate MEDIUM): a fractional value (<1ms) truncated to 0 in
  // AbortSignal.timeout -> an instant abort. Require an integer >= 1.
  const n = Math.floor(Number(process.env.AO_CALL_TIMEOUT_MS ?? 8000));
  return Number.isFinite(n) && n > 0 ? n : 8000;
})();

export async function call<T = any>(operationId: string, opts: {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  methodOverride?: string;
  retries?: number;
} = {}): Promise<T> {
  const route = routeById(operationId);
  if (!route) throw new Error(`unknown operation ${operationId}`);
  let path = route.path;
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    path = path.replace(`{${k}}`, encodeURIComponent(String(v)));
  }
  const qs = Object.entries(opts.query ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  const url = DAEMON + path + (qs ? `?${qs}` : "");
  const method = opts.methodOverride ?? route.method;
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      // FIXED (red-team audit W-05/R8): this fetch had NO timeout — a hung AO
      // daemon blocked the caller forever (the tick reported TICK-IN-FLIGHT while
      // daemonOk stayed true). Bounded + named. The timeout is per-attempt, so the
      // retry budget stays meaningful.
      res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(AO_CALL_TIMEOUT_MS),
      });
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(200 * (attempt + 1));   // FIXED: no final-attempt sleep
      continue;
    }
    if (res.status >= 500 && attempt < retries) {
      await sleep(300 * (attempt + 1));
      continue;
    }
    // FIXED (ship-gate MEDIUM): the body read sat OUTSIDE the try, so a timeout that
    // aborted the BODY stream (not just the headers) rejected with AbortError and escaped
    // the retry loop entirely. Read it inside the guarded attempt like the fetch.
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      lastErr = e;
      await sleep(200 * (attempt + 1));
      continue;
    }
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* raw */ }
    if (!res.ok) throw new ApiError(res.status, body);
    return body as T;
  }
  throw lastErr;
}

// EN-001 fix: `/healthz` is the daemon's own liveness route and is NOT in the
// generated operation table (the API spec covers /api/v1/*). Calling it through
// `call()` threw "unknown operation"; it is fetched directly instead.
export async function health(): Promise<{ status: string; pid?: number }> {
  const res = await fetch(`${DAEMON}/healthz`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as { status: string; pid?: number };
}
