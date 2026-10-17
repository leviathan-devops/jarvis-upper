// watchdog.ts — health verdict over a runtime status.
// ready 0 together with errors, and an IDLE or empty plan, are UNHEALTHY.
import { digestPlan, type RuntimeStatus } from "./status";

export interface WatchdogReport {
  verdict: "OK" | "UNHEALTHY";
  reasons: string[];
}

const EMPTY_PLAN_HASH = digestPlan("");

function idleOrEmpty(kind: RuntimeStatus["planKind"], planHash: string): boolean {
  switch (kind) {
    case "none":
      return true;
    case "ok":
      return planHash === EMPTY_PLAN_HASH;
    case "cycle":
      return false;
    default: {
      const unreachable: never = kind;
      throw new Error(`PLAN-KIND:${String(unreachable)}`);
    }
  }
}

export function classifyWatchdog(
  s: Pick<RuntimeStatus, "ready" | "errors" | "planKind" | "planHash">,
): WatchdogReport {
  const reasons: string[] = [];
  if (s.ready === 0 && s.errors.length > 0) reasons.push("READY-0-WITH-ERRORS");
  if (idleOrEmpty(s.planKind, s.planHash)) reasons.push("IDLE-OR-EMPTY-PLAN");
  const verdict: WatchdogReport["verdict"] = reasons.length > 0 ? "UNHEALTHY" : "OK";
  return { verdict, reasons };
}
