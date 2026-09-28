import type { OcSession } from '@pixelweb/shared';

/** OpenCode titles a subagent's session "<description> (@<agent> subagent)" and never renames it. */
const SUBAGENT = /^(.*?)\s*\(@([^()\s]+) subagent\)\s*$/;

export function subagentTitle(title: string): { title: string; agent: string } | null {
  const m = SUBAGENT.exec(title);
  return m ? { title: m[1] || title, agent: m[2] } : null;
}

export interface SessionTree {
  roots: OcSession[];
  /** subtasks per parent id, oldest first (the order they were started) */
  children: Map<string, OcSession[]>;
}

/**
 * Nest subtask sessions under their parent. A subtask whose parent isn't in
 * the list (e.g. deleted) is shown as a root rather than dropped.
 */
export function sessionTree(sessions: OcSession[]): SessionTree {
  const ids = new Set(sessions.map((s) => s.id));
  const roots: OcSession[] = [];
  const children = new Map<string, OcSession[]>();
  for (const s of sessions) {
    if (s.parentID && s.parentID !== s.id && ids.has(s.parentID)) {
      const list = children.get(s.parentID) ?? [];
      list.push(s);
      children.set(s.parentID, list);
    } else roots.push(s);
  }
  for (const list of children.values()) list.sort((a, b) => a.time.created - b.time.created);
  return { roots, children };
}

/** Every subtask below `id`, at any depth. */
export function descendants(tree: SessionTree, id: string): OcSession[] {
  const out: OcSession[] = [];
  const walk = (pid: string) => {
    for (const c of tree.children.get(pid) ?? []) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}
