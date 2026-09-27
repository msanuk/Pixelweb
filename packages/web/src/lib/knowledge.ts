import type { CardCategory, KnowledgeIndexEntry, LearningRecord, MasteryLevel } from '@pixelweb/shared';

export type CategoryFilter = CardCategory | 'all';
/** 'unseen' = no learning record yet. */
export type MasteryFilter = MasteryLevel | 'unseen' | 'all';

export interface KnowledgeFilter {
  cat: CategoryFilter;
  mastery: MasteryFilter;
  q: string;
}

export const CATEGORIES: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'ai', label: 'AI' },
  { id: 'git', label: 'Git' },
  { id: 'web', label: 'Web' },
  { id: 'tooling', label: '工具链' },
  { id: 'architecture', label: '架构' },
  { id: 'general', label: '通用' },
];

export const MASTERY_FILTERS: { id: MasteryFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'unseen', label: '没看过' },
  { id: 'seen', label: '看过' },
  { id: 'learning', label: '学习中' },
  { id: 'mastered', label: '已掌握' },
];

export function categoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
}

export function masteryOf(records: Record<string, LearningRecord>, id: string): MasteryLevel | 'unseen' {
  return records[id]?.mastery ?? 'unseen';
}

/** Case-insensitive substring match on title, aliases, search-only keywords and summary. */
export function matchesQuery(card: KnowledgeIndexEntry, q: string): boolean {
  const ql = q.trim().toLowerCase();
  if (!ql) return true;
  return card.title.toLowerCase().includes(ql) || [...card.aliases, ...(card.keywords ?? [])].some((a) => a.toLowerCase().includes(ql)) || card.summary.toLowerCase().includes(ql);
}

function passes(card: KnowledgeIndexEntry, f: KnowledgeFilter, records: Record<string, LearningRecord>, skip?: 'cat' | 'mastery'): boolean {
  if (skip !== 'cat' && f.cat !== 'all' && card.category !== f.cat) return false;
  if (skip !== 'mastery' && f.mastery !== 'all' && masteryOf(records, card.id) !== f.mastery) return false;
  return matchesQuery(card, f.q);
}

/**
 * Cards matching every filter, in index order. `keep` (the open card) skips
 * the mastery filter: opening a card marks it 看过 and quizzing moves it on,
 * which would otherwise yank the row out from under the learner mid-read.
 */
export function filterCards(cards: KnowledgeIndexEntry[], f: KnowledgeFilter, records: Record<string, LearningRecord>, keep?: string | null): KnowledgeIndexEntry[] {
  return cards.filter((c) => passes(c, f, records, c.id === keep ? 'mastery' : undefined));
}

/**
 * Faceted counts: each facet's numbers respect the search and the *other*
 * facet but not its own selection, so every entry shows how many rows
 * clicking it would give (and 全部 is the sum of its siblings).
 */
export function facetCounts(
  cards: KnowledgeIndexEntry[],
  f: KnowledgeFilter,
  records: Record<string, LearningRecord>,
): { cat: Record<CategoryFilter, number>; mastery: Record<MasteryFilter, number> } {
  const cat = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryFilter, number>;
  const mastery = Object.fromEntries(MASTERY_FILTERS.map((m) => [m.id, 0])) as Record<MasteryFilter, number>;
  for (const c of cards) {
    if (passes(c, f, records, 'cat')) {
      cat.all++;
      cat[c.category]++;
    }
    if (passes(c, f, records, 'mastery')) {
      mastery.all++;
      mastery[masteryOf(records, c.id)]++;
    }
  }
  return { cat, mastery };
}

/** Index of the row ↑/↓ should move to; starts at the first/last row when nothing in the list is selected. */
export function stepSelection(ids: string[], current: string | null, dir: 1 | -1): number {
  if (ids.length === 0) return -1;
  const i = current ? ids.indexOf(current) : -1;
  if (i < 0) return dir === 1 ? 0 : ids.length - 1;
  return Math.min(ids.length - 1, Math.max(0, i + dir));
}
