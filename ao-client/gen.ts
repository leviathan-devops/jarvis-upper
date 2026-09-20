// Bindings generator: openapi.yaml (pinned) -> gen/routes.ts
// Re-run = explicit step. Parity gate: tests/bindings_parity.test.ts
import { parse } from "yaml";

const SPEC = new URL("./openapi.yaml", import.meta.url);
const raw = await Bun.file(SPEC).text();
const spec = parse(raw) as any;

const sha = new Bun.CryptoHasher("sha256").update(raw).digest("hex");
const paths = spec.paths as Record<string, any>;
const ops: { method: string; path: string; id: string }[] = [];
for (const [p, item] of Object.entries(paths)) {
  for (const [m, op] of Object.entries(item as any)) {
    if (op && typeof op === "object" && "operationId" in (op as any)) {
      ops.push({ method: m.toUpperCase(), path: p, id: (op as any).operationId });
    }
  }
}
ops.sort((a, b) => a.id.localeCompare(b.id));
const schemaCount = Object.keys(spec.components?.schemas ?? {}).length;

const pin = { sha256: sha, paths: Object.keys(paths).length, ops: ops.length, schemas: schemaCount };
await Bun.write(new URL("./pin.json", import.meta.url), JSON.stringify(pin, null, 2) + "\n");

const lines: string[] = [
  "// GENERATED from openapi.yaml — do not edit. Regenerate: bun ao-client/gen.ts",
  `// spec sha256: ${sha}`,
  "",
  "export interface Route { method: string; path: string; id: string }",
  "",
  "export const ROUTES: Route[] = [",
  ...ops.map((o) => `  { method: ${JSON.stringify(o.method)}, path: ${JSON.stringify(o.path)}, id: ${JSON.stringify(o.id)} },`),
  "];",
  "",
  "export const routeById = (id: string): Route | undefined => ROUTES.find((r) => r.id === id);",
  "",
];
await Bun.write(new URL("./gen/routes.ts", import.meta.url), lines.join("\n"));
console.log(`gen: ${ops.length} ops, ${Object.keys(paths).length} paths, ${schemaCount} schemas, sha ${sha.slice(0, 16)}`);
