import type { ProjectOption } from '@pixelweb/shared';

/** The subset of OpenCode's `GET /project` entries PixelWeb reads. */
export interface OcProject {
  id?: string;
  worktree?: string;
  name?: string;
  time?: { created?: number; updated?: number; initialized?: number };
}

/** Comparable form of a path: forward slashes, no trailing slash, drive letters case-folded (OpenCode may send `D:\...`). */
export function normPath(p: string): string {
  let s = p.replace(/\\/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return /^[a-z]:/i.test(s) ? s.toLowerCase() : s;
}

export function samePath(a: string, b: string): boolean {
  return normPath(a) === normPath(b);
}

/**
 * Whether an event OpenCode tagged with `directory` belongs to the project at `root`.
 * Nesting counts both ways: OpenCode may run in a subfolder of the project, or PixelWeb
 * may visualise a subfolder of the repo OpenCode runs in. Untagged events (and ones tagged
 * with something that isn't a path, like "global") are kept.
 */
export function belongsTo(directory: string | undefined, root: string): boolean {
  if (!directory || !/^([a-z]:)?[\\/]/i.test(directory)) return true;
  const d = normPath(directory);
  const r = normPath(root);
  return d === r || d.startsWith(r === '/' ? r : r + '/') || r.startsWith(d === '/' ? d : d + '/');
}

function baseName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
}

/**
 * Picker entries: the current project first, then OpenCode's known projects by recent activity.
 * OpenCode files sessions outside any git repo under a "global" project whose worktree is `/`; it isn't a project to visualise.
 */
export function toProjectOptions(projects: OcProject[], current: string): ProjectOption[] {
  const seen = new Set([normPath(current)]);
  const others: ProjectOption[] = [];
  for (const p of projects) {
    if (!p.worktree || normPath(p.worktree) === '/' || seen.has(normPath(p.worktree))) continue;
    seen.add(normPath(p.worktree));
    const updated = p.time?.updated ?? p.time?.initialized ?? p.time?.created;
    others.push({ dir: p.worktree, name: p.name || baseName(p.worktree), updated, current: false });
  }
  others.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  const cur = projects.find((p) => p.worktree && samePath(p.worktree, current));
  return [{ dir: current, name: cur?.name || baseName(current), updated: cur?.time?.updated, current: true }, ...others];
}
