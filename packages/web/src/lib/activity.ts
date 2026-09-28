import type { ArchNode, CommitLink, OcMessageWithParts, OcPart } from '@pixelweb/shared';

/** How a session touched a file; an edit outranks a read. */
export type Touch = 'edit' | 'read';

type ToolPart = Extract<OcPart, { type: 'tool' }>;

const EDIT_TOOLS = new Set(['edit', 'write', 'multiedit', 'patch']);
const READ_TOOLS = new Set(['read']);

/**
 * Project-relative, forward-slash path of a file the agent named, or null when
 * it lies outside the project. OpenCode passes absolute paths (C:\… on Windows).
 */
export function toProjectPath(file: string, root: string): string | null {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const f = norm(file);
  const r = norm(root);
  if (!/^([a-zA-Z]:)?\//.test(f)) return f.replace(/^\.\//, '') || null;
  const caseless = /^[a-zA-Z]:/.test(r); // Windows paths compare case-insensitively
  const fc = caseless ? f.toLowerCase() : f;
  const rc = caseless ? r.toLowerCase() : r;
  return fc.startsWith(rc + '/') ? f.slice(r.length + 1) : null;
}

/** Files one tool call touched, as the tool was given them. Only finished calls count. */
export function toolFiles(p: ToolPart): { path: string; touch: Touch }[] {
  if (p.state.status !== 'completed') return [];
  const tool = p.tool.toLowerCase();
  const touch: Touch | null = EDIT_TOOLS.has(tool) ? 'edit' : READ_TOOLS.has(tool) ? 'read' : null;
  if (!touch) return [];
  const input = p.state.input;
  if (typeof input.patchText === 'string') {
    return [...input.patchText.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map((m) => ({ path: m[1].trim(), touch }));
  }
  const f = input.filePath ?? input.path;
  return typeof f === 'string' && f ? [{ path: f, touch }] : [];
}

/** Every project file a session read or edited (edits from tool calls and from step patches). */
export function sessionFiles(messages: OcMessageWithParts[] | undefined, root: string): Map<string, Touch> {
  const out = new Map<string, Touch>();
  const add = (file: string, touch: Touch) => {
    const rel = toProjectPath(file, root);
    if (rel && out.get(rel) !== 'edit') out.set(rel, touch);
  };
  for (const m of messages ?? []) {
    for (const p of m.parts) {
      if (p.type === 'tool') for (const f of toolFiles(p as ToolPart)) add(f.path, f.touch);
      else if (p.type === 'patch') for (const f of (p as Extract<OcPart, { type: 'patch' }>).files) add(f, 'edit');
    }
  }
  return out;
}

/**
 * The graph node a project file belongs to: the file itself at file level, or
 * the deepest directory node containing it at dir level ('' = files at the root).
 */
export function nodeForPath<N extends Pick<ArchNode, 'id' | 'kind'>>(nodes: N[], rel: string): N | undefined {
  let best: N | undefined;
  for (const n of nodes) {
    if (n.kind === 'external') continue;
    const hit = n.id === rel || (n.kind === 'dir' && (n.id === '' ? !rel.includes('/') : rel.startsWith(n.id + '/')));
    if (hit && (!best || n.id.length > best.id.length)) best = n;
  }
  return best;
}

/** Agent commits whose (possibly short) hash names this commit. */
export function linksForCommit(links: CommitLink[], hash: string): CommitLink[] {
  return links.filter((l) => l.hash && hash.startsWith(l.hash));
}
