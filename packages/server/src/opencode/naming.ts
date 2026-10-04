import type { OcSession } from '@pixelweb/shared';

/**
 * Session naming convention: "yyyymmdd-动词对象", Chinese, at most 25 characters.
 *
 * OpenCode titles a session once, from its first message, with its hidden
 * `title` agent — whose prompt can be replaced in opencode.json
 * (docs/opencode-title-prompt.txt asks for "动词对象" in Chinese). That agent
 * never sees today's date, so the date prefix is added here, from the
 * session's creation time, after OpenCode has written its title.
 */
export const TITLE_MAX = 25;

/** OpenCode's placeholder until the title agent has run (same test as OpenCode's own `isDefaultTitle`). */
const OPENCODE_DEFAULT = /^(New session - |Child session - )\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DATED = /^\d{8}-/;
/** PixelWeb's teaching ("📖 <term>") and cloud guide ("🧭 <page>") sessions keep their own titles. */
const TEACHING = /^(?:📖|🧭)/u;

/** Local "yyyymmdd". */
export function datePrefix(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** At most `n` characters, counting a CJK character or an emoji as one. */
function clip(s: string, n: number): string {
  const chars = Array.from(s);
  return chars.length > n ? chars.slice(0, n).join('').trimEnd() : s;
}

/** Drops wrapping quotes and trailing full stops a model tends to add, and folds whitespace. */
export function tidyTitle(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’「『《]+/, '')
    .replace(/["'“”‘’」』》。.!！?？,，;；:：\s]+$/, '');
}

/** `title` in the convention: the date of `created` in front, 25 characters in all. */
export function applyConvention(title: string, created: number): string {
  const body = tidyTitle(title.replace(DATED, '')) || '未命名';
  const prefix = `${DATED.exec(title)?.[0] ?? `${datePrefix(created)}-`}`;
  return clip(prefix + body, TITLE_MAX);
}

/**
 * The title PixelWeb should give this session, or null to leave it alone:
 * subtasks (OpenCode names them after the task, with the agent), sessions
 * still waiting for OpenCode's title, teaching and guide sessions, and titles that
 * already follow the convention.
 */
export function conventionalTitle(s: OcSession): string | null {
  if (s.parentID || OPENCODE_DEFAULT.test(s.title) || TEACHING.test(s.title) || !s.title.trim()) return null;
  const next = applyConvention(s.title, s.time.created);
  return next === s.title ? null : next;
}
