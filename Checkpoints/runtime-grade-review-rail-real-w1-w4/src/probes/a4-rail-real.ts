// A4 ADVERSARIAL: does the rail parse REAL SSE bytes from the daemon?
import { parseSse } from "../ao-client/rail.ts";
const raw = await Bun.file("/tmp/real-sse.txt").text();
const evs = parseSse(raw);
console.log("A4 frames parsed from REAL daemon bytes:", evs.length);
for (const e of evs.slice(0, 3)) console.log("   seq:", e.seq, "type:", e.type);
