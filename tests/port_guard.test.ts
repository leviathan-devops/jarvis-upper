// Port guard: sources never connect to the judge ports, and a mock binds port 0.
// The forbidden ports are assembled at runtime so this file does not contain them.
import { test, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { forbiddenPortHits } from "../src/port-guard";

const REPO = fileURLToPath(new URL("..", import.meta.url));

test("port-guard: a planted judge-port connect is a hit, and port 0 is clean", () => {
  const judge = String(8_000 + 90);
  const other = String(18_000 + 90);
  const planted = [
    `fetch("http://127.0.0.1:${judge}/health")`,
    "server." + "listen(" + other + ")",
    "Bun.serve({ port" + ": " + "3001 })",
  ].join("\n");
  expect(forbiddenPortHits(planted).length).toBeGreaterThan(0);
  expect(forbiddenPortHits("Bun.serve({ port: 0 })\nserver.listen(0)\n")).toEqual([]);
});

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".git" || name === "dist") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|js|sh|py)$/.test(name)) out.push(path);
    }
  };
  walk(root);
  return out;
}

test("port-guard: repo sources do not name the judge ports or bind a fixed mock port", () => {
  const hits: string[] = [];
  for (const path of sourceFiles(REPO)) {
    const text = readFileSync(path, "utf8");
    for (const hit of forbiddenPortHits(text)) hits.push(`${path}:${hit}`);
  }
  expect(hits).toEqual([]);
});
