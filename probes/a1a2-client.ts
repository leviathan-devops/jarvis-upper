// A1/A2 ADVERSARIAL: is there a runtime entry? does the orphaned client work?
import { health, call } from "../ao-client/client.ts";
console.log("A2a health() ->");
try { console.log("  ", JSON.stringify(await health()).slice(0, 100)); }
catch (e) { console.log("   THREW:", String(e).slice(0, 140)); }
console.log("A2b call('listProjects') ->");
try { console.log("  ", JSON.stringify(await call("listProjects")).slice(0, 100)); }
catch (e) { console.log("   THREW:", String(e).slice(0, 140)); }
