// adapter-verbs.ts — the adapter's read surface (a real caller for ao-client/client).
// Keeps REST-first: every call goes through the typed client, never the store.
import { call } from "../ao-client/client";

export interface ProjectRow { id: string; name: string }

export async function listProjects(): Promise<ProjectRow[]> {
  const res = await call<{ projects: ProjectRow[] }>("listProjects");
  return res.projects ?? [];
}
