import type { KnowledgeIndexEntry, OcSession } from '@pixelweb/shared';
import type { Tab } from './store';
import type { ThemeChoice } from './theme';
import { displayTitle, isTeachingTitle } from './format';

/*
 * The ⌘K command palette's data side: which items exist and how a query
 * ranks them. Pure (no DOM, no store) so it can be unit-tested; the component
 * maps each item's `action` onto the real effect.
 */

export type PaletteGroup = 'page' | 'session' | 'concept' | 'command';

export type PaletteAction =
  | { kind: 'tab'; tab: Tab }
  | { kind: 'session'; id: string }
  | { kind: 'card'; id: string }
  | { kind: 'theme'; theme: ThemeChoice }
  | { kind: 'settings' }
  | { kind: 'export' }
  | { kind: 'refresh' };

export interface PaletteItem {
  key: string;
  group: PaletteGroup;
  title: string;
  /** other names the item answers to: card aliases, English synonyms for commands */
  keywords: string[];
  /** secondary text (a card's one-line definition); matched with the lowest weight */
  summary?: string;
  /** sessions: last update, for "recent" and tie-breaks */
  updated?: number;
  teaching?: boolean;
  /** a sub-agent's session */
  child?: boolean;
  /** theme commands: the theme in use */
  current?: boolean;
  action: PaletteAction;
}

export interface PaletteSection {
  group: PaletteGroup;
  label: string;
  items: PaletteItem[];
}

export interface PaletteData {
  sessions: OcSession[];
  teaching: ReadonlySet<string>;
  knowledge: KnowledgeIndexEntry[];
  /** passed in rather than imported: lib/theme touches the document on import */
  themes: { id: ThemeChoice; label: string }[];
  theme: ThemeChoice;
  /** there are learning records to export */
  canExport: boolean;
}

const GROUP_ORDER: PaletteGroup[] = ['page', 'session', 'concept', 'command'];
const GROUP_LABEL: Record<PaletteGroup, string> = { page: '页面', session: '会话', concept: '概念', command: '命令' };
/** per-group cap while searching; pages and commands are few enough to show all */
const CAP: Partial<Record<PaletteGroup, number>> = { session: 6, concept: 8 };
const RECENT_SESSIONS = 5;

const PAGES: { tab: Tab; title: string; keywords: string[] }[] = [
  { tab: 'timeline', title: '时间线', keywords: ['timeline', '消息', 'messages'] },
  { tab: 'git', title: 'Git', keywords: ['提交', '分支', 'commit', 'branch'] },
  { tab: 'arch', title: '架构', keywords: ['architecture', 'arch', '依赖', '模块', 'graph'] },
  { tab: 'knowledge', title: '知识库', keywords: ['knowledge', '卡片', 'cards', '学习'] },
  { tab: 'usage', title: '用量', keywords: ['usage', 'tokens', '缓存', 'cache', '统计', '费用', 'cost'] },
];

const THEME_KEYWORDS: Record<ThemeChoice, string[]> = {
  system: ['auto', 'system', '系统', '自动'],
  paper: ['light', '浅色', '亮色'],
  graphite: ['dark', '深色', '暗色'],
};

export function buildItems(d: PaletteData): PaletteItem[] {
  const items: PaletteItem[] = PAGES.map((p) => ({
    key: `page:${p.tab}`,
    group: 'page',
    title: p.title,
    keywords: p.keywords,
    action: { kind: 'tab', tab: p.tab },
  }));

  for (const s of d.sessions) {
    items.push({
      key: `session:${s.id}`,
      group: 'session',
      title: displayTitle(s.title) || s.id,
      keywords: [],
      updated: s.time.updated,
      teaching: d.teaching.has(s.id) || isTeachingTitle(s.title),
      child: !!s.parentID,
      action: { kind: 'session', id: s.id },
    });
  }

  for (const c of d.knowledge) {
    items.push({
      key: `concept:${c.id}`,
      group: 'concept',
      title: c.title,
      keywords: [...c.aliases, ...(c.keywords ?? []), c.id],
      summary: c.summary,
      action: { kind: 'card', id: c.id },
    });
  }

  for (const t of d.themes) {
    items.push({
      key: `command:theme:${t.id}`,
      group: 'command',
      title: `切换主题：${t.label}`,
      keywords: ['主题', 'theme', ...THEME_KEYWORDS[t.id]],
      current: t.id === d.theme,
      action: { kind: 'theme', theme: t.id },
    });
  }
  items.push({ key: 'command:settings', group: 'command', title: '打开设置', keywords: ['settings', 'preferences', '偏好'], action: { kind: 'settings' } });
  if (d.canExport) {
    items.push({ key: 'command:export', group: 'command', title: '导出学习笔记', keywords: ['export', 'notes', 'markdown', '下载'], action: { kind: 'export' } });
  }
  items.push({ key: 'command:refresh', group: 'command', title: '刷新会话', keywords: ['refresh', 'reload', 'sessions'], action: { kind: 'refresh' } });
  return items;
}

/** Case-, width- and whitespace-insensitive form used for matching ("Ｇｉｔ 提交" ≈ "git提交"). */
export function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function fieldScore(q: string, text: string, exact: number, prefix: number, sub: number): number {
  const t = norm(text);
  if (!t) return 0;
  if (t === q) return exact;
  if (t.startsWith(q)) return prefix;
  return t.includes(q) ? sub : 0;
}

/** Title exact > title prefix > title substring > alias > summary; 0 = no match. `q` must be normalised. */
function scoreNorm(q: string, item: PaletteItem): number {
  let best = fieldScore(q, item.title, 100, 80, 60);
  for (const k of item.keywords) best = Math.max(best, fieldScore(q, k, 50, 45, 40));
  if (item.summary && best === 0) best = fieldScore(q, item.summary, 20, 20, 20);
  return best;
}

/**
 * How well `query` matches `item`. The whole query is tried first (spaces
 * ignored, so CJK and "git commit" both work as one string); failing that,
 * every whitespace-separated word must match somewhere, in any order.
 */
export function score(query: string, item: PaletteItem): number {
  const q = norm(query);
  if (!q) return 0;
  const whole = scoreNorm(q, item);
  if (whole) return whole;
  const words = query.trim().split(/\s+/).map(norm).filter(Boolean);
  if (words.length < 2) return 0;
  let min = Infinity;
  for (const w of words) {
    const s = scoreNorm(w, item);
    if (!s) return 0;
    min = Math.min(min, s);
  }
  return min * 0.9;
}

/**
 * The sections to show for `query`. Empty query: pages, the most recent
 * sessions and commands (no concepts — there are too many). Otherwise the
 * matches, each group ranked and capped, groups ordered by their best match.
 */
export function filterItems(items: PaletteItem[], query: string): PaletteSection[] {
  const byGroup = (g: PaletteGroup) => items.filter((i) => i.group === g);

  if (!norm(query)) {
    const recent = byGroup('session')
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
      .slice(0, RECENT_SESSIONS);
    return [
      { group: 'page' as const, label: GROUP_LABEL.page, items: byGroup('page') },
      { group: 'session' as const, label: '最近会话', items: recent },
      { group: 'command' as const, label: GROUP_LABEL.command, items: byGroup('command') },
    ].filter((s) => s.items.length > 0);
  }

  const sections: (PaletteSection & { best: number; order: number })[] = [];
  GROUP_ORDER.forEach((group, order) => {
    const hits = byGroup(group)
      .map((item, i) => ({ item, i, s: score(query, item) }))
      .filter((h) => h.s > 0)
      .sort((a, b) => b.s - a.s || (b.item.updated ?? 0) - (a.item.updated ?? 0) || a.i - b.i);
    if (!hits.length) return;
    const cap = CAP[group] ?? hits.length;
    sections.push({ group, label: GROUP_LABEL[group], items: hits.slice(0, cap).map((h) => h.item), best: hits[0].s, order });
  });
  return sections.sort((a, b) => b.best - a.best || a.order - b.order).map(({ group, label, items }) => ({ group, label, items }));
}
