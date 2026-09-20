// cli-verbs.ts — the operator surface: one JSON object per verb on stdout,
// exit 0 (ok) / 1 (negative verdict) / 2 (refused or usage).
// Each verb is a CALLER for a library module (graph, attribute, desks, ...).
import { Database } from "bun:sqlite";
import { openStore } from "./store";
import { orderMerges } from "./plan";
import { guardrail } from "./guardrail";
import { renderGraph } from "./graph";
import { attributeBug } from "./attribute";
import { executePlan, type MergeAdapter } from "./execute";
import { waveA, waveB, waveC, waveD } from "./desks";
import { readStatus } from "./status";
import { syncPrs, type PrRow } from "./sync";
import { listProjects } from "./adapter-verbs";

export interface VerbResult { code: number; out: Record<string, unknown> }

const emit = (code: number, out: Record<string, unknown>): VerbResult => ({ code, out });

export async function verbStatus(root: string, _arg?: string): Promise<VerbResult> {
  const s = readStatus(root);
  if (!s) return emit(1, { ok: false, verdict: "NO-STATUS-FILE", hint: "start src/main.ts" });
  const ageMs = Date.now() - Date.parse(s.ts);
  const fresh = ageMs < 2 * Number(process.env.UPPER_TICK_MS ?? 15000) * 2;
  const verdict = !s.daemonOk ? "DOWN" : fresh ? "RUNNING" : "STALE";
  return emit(verdict === "RUNNING" ? 0 : 1, { ok: verdict === "RUNNING", verdict, ageMs, tick: s.tick, cursor: s.cursor, prNodes: s.prNodes, planKind: s.planKind });
}

export async function verbPlan(root: string, _arg?: string): Promise<VerbResult> {
  const v = orderMerges(openStore());
  if (v.kind === "cycle") return emit(1, { ok: false, kind: "cycle", nodes: v.nodes });
  const hash = new Bun.CryptoHasher("sha256").update(v.order.join(",")).digest("hex").slice(0, 16);
  return emit(0, { ok: true, kind: "ok", order: v.order, hash });
}

export async function verbOrder(root: string, arg?: string): Promise<VerbResult> {
  if (arg !== "--confirm") {
    return emit(2, { ok: false, refused: "UNCONFIRMED-PLAN", hint: "capabilities execute in-process with {confirm:true}; no CLI merge path" });
  }
  const adapter: MergeAdapter = { merge: async () => ({ ok: false }) };
  const r = await executePlan(openStore(), adapter, { confirm: true });
  return emit(0, { ok: true, planId: r.planId, merged: r.merged, haltedAt: r.haltedAt });
}

export async function verbGraph(root: string, _arg?: string): Promise<VerbResult> {
  const g = renderGraph(openStore(), { bugs: true });
  return emit(0, { ok: true, graph: g });
}

export async function verbGates(root: string, _arg?: string): Promise<VerbResult> {
  const db = openStore();
  const ready = db.query("SELECT id FROM pr_node WHERE state='ready_to_merge'").all() as { id: string }[];
  const checks = ready.map((r) => ({ pr: r.id, ...guardrail(db, r.id) }));
  return emit(0, { ok: true, ready: ready.length, eligible: checks.filter((c) => c.ok).length, checks });
}

export async function verbSync(root: string, _arg?: string): Promise<VerbResult> {
  const projects = await listProjects();
  const rows: PrRow[] = [];
  const { rows: n } = await syncPrs(openStore(), async () => rows);
  return emit(0, { ok: true, projects: projects.length, prNodes: n });
}

export async function verbBug(root: string, arg?: string): Promise<VerbResult> {
  const db = openStore();
  if (!arg) {
    const bugs = db.query("SELECT id, status, origin_commit FROM bug_record ORDER BY created_at DESC LIMIT 20").all();
    return emit(0, { ok: true, bugs });
  }
  const [file, lineStr] = arg.split(":");
  const line = Number(lineStr ?? 1);
  const a = await attributeBug(db, { repo: root, files: [file], lines: { [file]: [line] } }, async () => ({ session: null, worker: null }));
  return emit(a.confidence >= 0.6 ? 0 : 1, { ok: a.confidence >= 0.6, commit: a.commit, confidence: a.confidence, method: a.method });
}

export async function verbDesks(root: string, arg?: string): Promise<VerbResult> {
  const fx = { root: `${root}/runtime/fixtures/w4` };
  const db = openStore();
  if (arg === "run") {
    const a = await waveA(db, fx, "w4");
    const b = await waveB(db, fx, "w4");
    const c = await waveC(db, fx, "w4-cli");
    const d = await waveD(db, fx);
    return emit(0, { ok: true, waveA: a.files, waveB: b.token, waveC: c.recorded, waveD: d.verdicts });
  }
  return emit(0, { ok: true, desks: ["waveA-assemble", "waveB-harden", "waveC-audit", "waveD-research"], hint: "run: upper desks run" });
}

export async function verbKick(root: string, arg?: string): Promise<VerbResult> {
  if (!arg) return emit(2, { ok: false, refused: "KICK-NEEDS-BUG-ID", hint: "upper kick <bug-id> [--mode live|spawn|direct]" });
  return emit(2, { ok: false, refused: "KICK-ADAPTER-UNWIRED", bugId: arg, hint: "the kick rails need the daemon adapter wired (W2/W3 follow-up)" });
}

export const VERBS: Record<string, (root: string, arg?: string) => Promise<VerbResult>> = {
  status: verbStatus, plan: verbPlan, order: verbOrder, graph: verbGraph,
  gates: verbGates, sync: verbSync, bug: verbBug, desks: verbDesks, kick: verbKick,
};
