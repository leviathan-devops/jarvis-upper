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
      res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      lastErr = e;
      await sleep(200 * (attempt + 1));
      continue;
    }
    if (res.status >= 500 && attempt < retries) {
      await sleep(300 * (attempt + 1));
      continue;
    }
    const text = await res.text();
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
