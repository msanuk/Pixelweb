import { describe, expect, it } from 'vitest';
import type { CardCategory, KnowledgeIndexEntry, LearningRecord } from '@pixelweb/shared';
import { cardFromHash, cardLink, facetCounts, filterCards, matchesQuery, stepSelection } from '../src/lib/knowledge';

const card = (id: string, category: CardCategory, extra: Partial<KnowledgeIndexEntry> = {}): KnowledgeIndexEntry => ({
  id,
  title: id,
  aliases: [],
  category,
  summary: `${id} 的定义`,
  level: 1,
  ...extra,
});
const rec = (cardId: string, mastery: LearningRecord['mastery']): LearningRecord => ({ cardId, mastery, seenCount: 1, lastSeen: 0, quizCorrect: 0, quizTotal: 0 });

const cards = [
  card('token', 'ai', { title: 'Token', aliases: ['词元'] }),
  card('llm', 'ai', { title: 'LLM', summary: '大语言模型' }),
  card('commit', 'git', { title: 'Commit' }),
  card('branch', 'git', { title: 'Branch' }),
];
const records = { token: rec('token', 'mastered'), commit: rec('commit', 'seen') };
const ids = (xs: KnowledgeIndexEntry[]) => xs.map((c) => c.id);

describe('matchesQuery', () => {
  it('matches title, aliases and summary, case-insensitively', () => {
    expect(matchesQuery(cards[0], 'TOK')).toBe(true);
    expect(matchesQuery(cards[0], '词元')).toBe(true);
    expect(matchesQuery(cards[1], '语言')).toBe(true);
    expect(matchesQuery(cards[1], 'git')).toBe(false);
    expect(matchesQuery(cards[1], '  ')).toBe(true);
  });
});

describe('filterCards', () => {
  it('combines category, mastery and search, keeping index order', () => {
    expect(ids(filterCards(cards, { cat: 'all', mastery: 'all', q: '' }, records))).toEqual(['token', 'llm', 'commit', 'branch']);
    expect(ids(filterCards(cards, { cat: 'git', mastery: 'all', q: '' }, records))).toEqual(['commit', 'branch']);
    expect(ids(filterCards(cards, { cat: 'all', mastery: 'unseen', q: '' }, records))).toEqual(['llm', 'branch']);
    expect(ids(filterCards(cards, { cat: 'git', mastery: 'seen', q: '' }, records))).toEqual(['commit']);
    expect(ids(filterCards(cards, { cat: 'all', mastery: 'all', q: 'b' }, records))).toEqual(['branch']);
  });

  it('keeps the open card through the mastery filter but not the others', () => {
    const f = { cat: 'all' as const, mastery: 'unseen' as const, q: '' };
    expect(ids(filterCards(cards, f, records, 'commit'))).toEqual(['llm', 'commit', 'branch']);
    expect(ids(filterCards(cards, { ...f, cat: 'ai' }, records, 'commit'))).toEqual(['llm']);
  });
});

describe('facetCounts', () => {
  it('counts each facet against the search and the other facet only', () => {
    const { cat, mastery } = facetCounts(cards, { cat: 'git', mastery: 'unseen', q: '' }, records);
    // categories respect mastery=unseen: llm (ai), branch (git)
    expect(cat).toEqual({ all: 2, ai: 1, git: 1, web: 0, tooling: 0, architecture: 0, cloud: 0, general: 0 });
    // mastery respects cat=git: commit (seen), branch (unseen)
    expect(mastery).toEqual({ all: 2, unseen: 1, seen: 1, learning: 0, mastered: 0 });
  });

  it('applies the search to both facets', () => {
    const { cat, mastery } = facetCounts(cards, { cat: 'all', mastery: 'all', q: 'o' }, records);
    expect(cat.all).toBe(2); // Token, Commit
    expect(mastery).toMatchObject({ mastered: 1, seen: 1, unseen: 0 });
  });
});

describe('stepSelection', () => {
  const list = ['a', 'b', 'c'];
  it('moves and clamps', () => {
    expect(stepSelection(list, 'a', 1)).toBe(1);
    expect(stepSelection(list, 'c', 1)).toBe(2);
    expect(stepSelection(list, 'a', -1)).toBe(0);
  });
  it('starts at an end when nothing in the list is selected', () => {
    expect(stepSelection(list, null, 1)).toBe(0);
    expect(stepSelection(list, 'zzz', -1)).toBe(2);
    expect(stepSelection([], null, 1)).toBe(-1);
  });
});

describe('card links', () => {
  it('round-trips a card id through the link the extension opens', () => {
    expect(cardLink('http://10.0.0.5:7420', 'tool-call')).toBe('http://10.0.0.5:7420/#card=tool-call');
    expect(cardFromHash(new URL(cardLink('http://h', '安全组')).hash)).toBe('安全组');
    expect(cardFromHash('#card=tool-call')).toBe('tool-call');
  });

  it('ignores other hashes', () => {
    expect(cardFromHash('')).toBeNull();
    expect(cardFromHash('#card=')).toBeNull();
    expect(cardFromHash('#card=a/b')).toBeNull();
    expect(cardFromHash('#other=x')).toBeNull();
    expect(cardFromHash('#card=%E0%A4%A')).toBeNull();
  });
});
