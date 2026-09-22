// W2 gate: deterministic render incl. bug overlay; empty graph shape.
import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { openStore } from "../src/store";
import { renderGraph } from "../src/graph";

function mem(): Database {
  const db = openStore(":memory:");
  db.exec("DELETE FROM pr_node; DELETE FROM pr_edge; DELETE FROM bug_record;");
  return db;
}

test("graph_snapshot: diamond renders edges in order", () => {
  const db = mem();
  for (const id of ["a", "b", "c", "d"]) {
    db.query("INSERT INTO pr_node(id, project, pr_number, session_id, state, head_sha) VALUES (?, 'p', 1, 's', 'open', 'aa')").run(id);
  }
  for (const [f, t] of [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]]) {
    db.query("INSERT INTO pr_edge(id, from_pr, to_pr, kind, created_at) VALUES (?,?,?,'depends_on',0)").run(`${f}>${t}`, f, t);
  }
  const out = renderGraph(db);
  expect(out).toBe(
    "[a] #1 open aa\n[b] #1 open aa\n[c] #1 open aa\n[d] #1 open aa\n" +
    "  a --depends_on--> b\n  a --depends_on--> c\n" +
    "  b --depends_on--> d\n  c --depends_on--> d\n");
  db.close();
});

test("graph_snapshot: bug overlay marks only the owning node", () => {
  const db = mem();
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, state, head_sha) VALUES ('pr-alpha','p',1,'worker-11','open','cc')").run();
  db.query("INSERT INTO pr_node(id, project, pr_number, session_id, state, head_sha) VALUES ('pr-beta','p',2,'worker-22','open','dd')").run();
  db.query("INSERT INTO bug_record(id, found_by, origin_session, status) VALUES ('b1','thanatos','worker-22','open')").run();
  const out = renderGraph(db, { bugs: true });
  expect(out.includes("[pr-alpha] #1 open cc\n")).toBe(true);
  expect(out.includes("[pr-beta] #2 open dd <-- BUG")).toBe(true);
  expect(out.includes(" <-- BUG\n  ") || out.endsWith(" <-- BUG\n")).toBe(true);
  db.close();
});

test("graph_snapshot: empty graph shape", () => {
  const db = mem();
  expect(renderGraph(db)).toBe("(empty graph)\n");
  db.close();
});
