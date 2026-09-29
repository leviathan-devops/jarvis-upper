// publish_shape: frozen POST shape + polarity law + false-green guard.
import { test, expect } from "bun:test";
import { STATUS_CONTEXTS } from "../src/status-contract";
import { publishStatus, publishVerdict } from "../src/publish";

const OPTS = { owner: "o", repo: "r", sha: "abc123", token: "t", baseUrl: "https://x.test" };

interface PostedBody {
  context: string;
  state: string;
  description: string;
}

interface Capture {
  url?: string;
  init?: RequestInit;
}

function isPostedBody(v: unknown): v is PostedBody {
  if (!v || typeof v !== "object") return false;
  if (!("context" in v && "state" in v && "description" in v)) return false;
  return (
    typeof v.context === "string" &&
    typeof v.state === "string" &&
    typeof v.description === "string"
  );
}

function parseBody(init?: RequestInit): PostedBody {
  const raw = init?.body;
  const text = typeof raw === "string" ? raw : String(raw ?? "{}");
  const parsed: unknown = JSON.parse(text);
  if (!isPostedBody(parsed)) throw new Error("BAD-BODY");
  return parsed;
}

function readHeaders(init?: RequestInit): { authorization: string; accept: string } {
  const h = init?.headers;
  if (h instanceof Headers) {
    return {
      authorization: h.get("Authorization") ?? "",
      accept: h.get("Accept") ?? "",
    };
  }
  if (h && typeof h === "object" && "Authorization" in h && "Accept" in h) {
    const auth = h.Authorization;
    const acc = h.Accept;
    if (typeof auth === "string" && typeof acc === "string") {
      return { authorization: auth, accept: acc };
    }
  }
  throw new Error("MISSING-HEADERS");
}

// Test stub is behavior-identical to fetch for our call shape.
function stubFetch(capture: Capture, status = 201, ok = true): typeof fetch {
  const fn = async (url: string, init?: RequestInit): Promise<Response> => {
    capture.url = url;
    capture.init = init;
    return new Response(JSON.stringify({ ok }), { status });
  };
  const typed: typeof fetch = fn as unknown as typeof fetch;
  return typed;
}

test("publish: exact URL + body context/state/description", async () => {
  const cap: Capture = {};
  const r = await publishStatus(
    { ...OPTS, fetchImpl: stubFetch(cap) },
    { context: STATUS_CONTEXTS.fence2, state: "success", description: "fence2: pass" },
  );
  expect(cap.url).toBe("https://x.test/repos/o/r/statuses/abc123");
  const body = parseBody(cap.init);
  expect(body.context).toBe(STATUS_CONTEXTS.fence2);
  expect(body.context).toBe("factory/fence2");
  expect(body.state).toBe("success");
  expect(typeof body.description).toBe("string");
  expect(r.ok).toBe(true);
  expect(r.status).toBe(201);
});

test("publishVerdict: polarity success/failure", async () => {
  const calls: PostedBody[] = [];
  const rec = async (_u: string, init?: RequestInit): Promise<Response> => {
    calls.push(parseBody(init));
    return new Response("{}", { status: 201 });
  };
  const fetchRec: typeof fetch = rec as unknown as typeof fetch;
  await publishVerdict({ ...OPTS, fetchImpl: fetchRec }, { fence2Ok: true, verdictOk: false });
  const first = calls[0];
  const second = calls[1];
  if (!first || !second) throw new Error("MISSING-CALLS");
  expect(first.state).toBe("success");
  expect(second.state).toBe("failure");
});

test("publish: fetch throws -> state error, never success", async () => {
  const boom = async (): Promise<Response> => {
    throw new Error("rail down");
  };
  const fetchBoom: typeof fetch = boom as unknown as typeof fetch;
  const r = await publishStatus(
    { ...OPTS, fetchImpl: fetchBoom },
    { context: STATUS_CONTEXTS.fence2, state: "success", description: "x" },
  );
  expect(r.state).toBe("error");
  expect(r.ok).toBe(false);
  expect(r.status).toBeNull();
  expect(r.state).not.toBe("success");
});

test("publish: non-2xx -> state error, never success", async () => {
  const cap: Capture = {};
  const r = await publishStatus(
    { ...OPTS, fetchImpl: stubFetch(cap, 502, false) },
    { context: STATUS_CONTEXTS.fence2, state: "success", description: "x" },
  );
  expect(r.state).toBe("error");
  expect(r.ok).toBe(false);
  expect(r.status).toBe(502);
});

test("publish: 300-char description truncated to <=140", async () => {
  const cap: Capture = {};
  const long = "d".repeat(300);
  await publishStatus(
    { ...OPTS, fetchImpl: stubFetch(cap) },
    { context: STATUS_CONTEXTS.fence2, state: "success", description: long },
  );
  const body = parseBody(cap.init);
  expect(body.description.length).toBeLessThanOrEqual(140);
  expect(long.length).toBe(300);
});

test("publish: Authorization Bearer header present", async () => {
  const cap: Capture = {};
  await publishStatus(
    { ...OPTS, fetchImpl: stubFetch(cap) },
    { context: STATUS_CONTEXTS.fence2, state: "success", description: "x" },
  );
  const headers = readHeaders(cap.init);
  expect(headers.authorization.startsWith("Bearer ")).toBe(true);
  expect(headers.accept).toBe("application/vnd.github+json");
});
