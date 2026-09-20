// EventRail: SSE consumption with persisted cursor + idempotent dispatch.
// Gap law: a sequence jump records the gap and fires onResync (caller
// refetches facts); events are hints, API rows are truth.
import { Database } from "bun:sqlite";

export interface RailEvent {
  seq: number;
  type: string;
  data: any;
}

export function parseSse(text: string): RailEvent[] {
  const events: RailEvent[] = [];
  let id: string | undefined;
  let ev: string | undefined;
  let dataLines: string[] = [];
  const flush = () => {
    if (id === undefined && ev === undefined && dataLines.length === 0) return;
    const raw = dataLines.join("\n");
    let data: any = raw;
    try { data = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }
    const seq = Number(id ?? (data && typeof data === "object" ? (data as any).seq : NaN));
    if (!Number.isFinite(seq)) { id = undefined; ev = undefined; dataLines = []; return; }
    const type = ev ?? (data && typeof data === "object" && typeof (data as any).type === "string"
      ? (data as any).type : "message");
    events.push({ seq, type, data });
    id = undefined; ev = undefined; dataLines = [];
  };
  for (const line of text.split("\n")) {
    if (line === "") { flush(); continue; }
    if (line.startsWith(":")) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim();
    const value = line.slice(i + 1).trimStart();
    if (field === "id") id = value;
    else if (field === "event") ev = value;
    else if (field === "data") dataLines.push(value);
  }
  flush();
  return events;
}

export interface RailStats {
  frames: number;
  processed: number;
  dupes: number;
  gaps: number;
  resyncs: number;
  cursor: number;
}

export class EventRail {
  constructor(
    private db: Database,
    private source: string = "ao-events",
    private onResync?: () => void | Promise<void>,
  ) {}

  getCursor(): number {
    const row = this.db
      .query("SELECT last_seq FROM rail_seq WHERE source = ?")
      .get(this.source) as { last_seq: number } | null;
    return row?.last_seq ?? 0;
  }

  private setCursor(seq: number): void {
    this.db
      .query(`INSERT INTO rail_seq(source, last_seq, updated_at)
              VALUES (?, ?, strftime('%s','now'))
              ON CONFLICT(source) DO UPDATE SET last_seq=excluded.last_seq,
              updated_at=excluded.updated_at`)
      .run(this.source, seq);
  }

  async attach(
    chunks: AsyncIterable<string> | string[],
    reduce: (ev: RailEvent) => void | Promise<void>,
  ): Promise<RailStats> {
    let cursor = this.getCursor();
    const stats: RailStats = { frames: 0, processed: 0, dupes: 0, gaps: 0, resyncs: 0, cursor };
    const handle = async (ev: RailEvent) => {
      stats.frames++;
      if (ev.seq <= cursor) { stats.dupes++; return; }
      if (ev.seq > cursor + 1) {
        stats.gaps += ev.seq - cursor - 1;
        stats.resyncs++;
        if (this.onResync) await this.onResync();
      }
      await reduce(ev);
      cursor = ev.seq;
      this.setCursor(cursor);
      stats.processed++;
    };
    if (Symbol.asyncIterator in Object(chunks)) {
      let buf = "";
      for await (const chunk of chunks as AsyncIterable<string>) {
        buf += chunk;
        const cut = buf.lastIndexOf("\n\n");
        if (cut < 0) continue;
        for (const ev of parseSse(buf.slice(0, cut + 2))) await handle(ev);
        buf = buf.slice(cut + 2);
      }
      for (const ev of parseSse(buf)) await handle(ev);
    } else {
      for (const chunk of chunks as string[]) {
        for (const ev of parseSse(chunk)) await handle(ev);
      }
    }
    stats.cursor = cursor;
    return stats;
  }
}
