import { describe, expect, it } from 'vitest';
import type { KnowledgeIndexEntry, OcSession } from '@pixelweb/shared';
import { buildItems, filterItems, score, type PaletteData } from '../src/lib/palette';

const card = (id: string, title: string, aliases: string[] = [], summary = `${title} 的定义`): KnowledgeIndexEntry => ({ id, title, aliases, category: 'ai', summary, level: 1 });
const session = (id: string, title: string, updated: number, parentID?: string): OcSession => ({ id, title, parentID, time: { created: updated, updated } });

const THEMES: PaletteData['themes'] = [
  { id: 'system', label: '跟随系统' },
  { id: 'paper', label: '浅色' },
  { id: 'graphite', label: '深色' },
];
const PALETTES: PaletteData['palettes'] = [
  { id: 'ink', label: '纸墨' },
  { id: 'clay', label: '陶土' },
];

function data(extra: Partial<PaletteData> = {}): PaletteData {
  return {
    sessions: [session('s1', '修复登录', 1000), session('s2', '📖 SSE', 3000), session('s3', '写测试', 2000, 's1')],
    teaching: new Set(),
    knowledge: [
      card('token', 'Token', ['词元']),
      card('context-window', '上下文窗口', ['context window']),
      card('tokenizer', 'Tokenizer'),
      card('sse', 'SSE', ['Server-Sent Events'], '服务器单向推送，基于 token 流'),
      card('my-token-cache', 'Prompt 缓存', [], '缓存前缀'),
    ],
    themes: THEMES,
    theme: 'paper',
    palettes: PALETTES,
    palette: 'clay',
    canExport: true,
    ...extra,
  };
}

const titles = (sections: ReturnType<typeof filterItems>, group?: string) =>
  sections.filter((s) => !group || s.group === group).flatMap((s) => s.items.map((i) => i.title));

describe('buildItems', () => {
  it('maps sessions with display titles, teaching and sub-agent flags', () => {
    const items = buildItems(data({ teaching: new Set(['s1']) }));
    const s = items.filter((i) => i.group === 'session');
    expect(s.map((i) => [i.title, i.teaching, i.child])).toEqual([
      ['修复登录', true, false],
      ['SSE', true, false],
      ['写测试', false, true],
    ]);
    expect(s[0].action).toEqual({ kind: 'session', id: 's1' });
  });

  it('adds one theme command per theme and marks the current one', () => {
    const themes = buildItems(data()).filter((i) => i.action.kind === 'theme');
    expect(themes.map((i) => [i.title, !!i.current])).toEqual([
      ['切换明暗：跟随系统', false],
      ['切换明暗：浅色', true],
      ['切换明暗：深色', false],
    ]);
  });

  it('adds one palette command per palette, found by its old and English names too', () => {
    const items = buildItems(data());
    expect(items.filter((i) => i.action.kind === 'palette').map((i) => [i.title, !!i.current])).toEqual([
      ['切换配色：纸墨', false],
      ['切换配色：陶土', true],
    ]);
    expect(titles(filterItems(items, 'anthropic'), 'command')).toEqual(['切换配色：陶土']);
    expect(titles(filterItems(items, '石墨'), 'command')).toEqual(['切换明暗：深色']);
  });

  it('hides the export command without learning records', () => {
    expect(buildItems(data()).some((i) => i.action.kind === 'export')).toBe(true);
    expect(buildItems(data({ canExport: false })).some((i) => i.action.kind === 'export')).toBe(false);
  });
});

describe('filterItems', () => {
  it('shows pages, recent sessions and commands for an empty query — no concepts', () => {
    const many = Array.from({ length: 8 }, (_, i) => session(`x${i}`, `会话 ${i}`, i * 10));
    const sections = filterItems(buildItems(data({ sessions: many })), '  ');
    expect(sections.map((s) => s.label)).toEqual(['页面', '最近会话', '命令']);
    expect(titles(sections, 'page')).toEqual(['时间线', 'Git', '架构', '知识库', '用量']);
    expect(titles(sections, 'session')).toEqual(['会话 7', '会话 6', '会话 5', '会话 4', '会话 3']);
  });

  it('ranks exact title > prefix > substring > alias > summary', () => {
    const got = titles(filterItems(buildItems(data()), 'token'), 'concept');
    // Token (exact), Tokenizer (prefix), SSE (summary only); "Prompt 缓存" matches only through its id
    expect(got).toEqual(['Token', 'Tokenizer', 'Prompt 缓存', 'SSE']);
  });

  it('prefers a title substring over an alias', () => {
    const items = buildItems(data({ knowledge: [card('a', 'Alpha', ['window']), card('b', 'Big window')] }));
    expect(titles(filterItems(items, 'window'), 'concept')).toEqual(['Big window', 'Alpha']);
  });

  it('matches CJK substrings and aliases, ignoring case, width and spaces', () => {
    const items = buildItems(data());
    expect(titles(filterItems(items, '窗口'), 'concept')).toEqual(['上下文窗口']);
    expect(titles(filterItems(items, '词元'), 'concept')).toEqual(['Token']);
    expect(titles(filterItems(items, 'CONTEXTWINDOW'), 'concept')).toEqual(['上下文窗口']);
    expect(titles(filterItems(items, 'ｓｓｅ'), 'concept')).toEqual(['SSE']);
  });

  it('accepts words in any order', () => {
    expect(titles(filterItems(buildItems(data()), 'events server'), 'concept')).toEqual(['SSE']);
  });

  it('finds sessions, commands and pages by keyword', () => {
    const items = buildItems(data());
    expect(titles(filterItems(items, '登录'))).toEqual(['修复登录']);
    expect(titles(filterItems(items, 'dark'))).toEqual(['切换明暗：深色']);
    expect(titles(filterItems(items, '主题'), 'command')).toHaveLength(5);
    expect(titles(filterItems(items, 'architecture'))).toEqual(['架构']);
  });

  it('orders groups by their best match, ties in the default order', () => {
    const items = buildItems(data());
    expect(filterItems(items, 'sse').map((s) => s.group)).toEqual(['session', 'concept']);
    // "Git" is an exact page title; the concept only mentions it in the summary
    const withGit = buildItems(data({ knowledge: [card('branch', '分支', [], 'Git 的一条开发线')] }));
    expect(filterItems(withGit, 'git').map((s) => s.group)).toEqual(['page', 'concept']);
  });

  it('caps concepts and sessions while searching', () => {
    const knowledge = Array.from({ length: 20 }, (_, i) => card(`c${i}`, `概念 ${i}`));
    const sessions = Array.from({ length: 20 }, (_, i) => session(`s${i}`, `概念讨论 ${i}`, i));
    const sections = filterItems(buildItems(data({ knowledge, sessions })), '概念');
    expect(titles(sections, 'concept')).toHaveLength(8);
    expect(titles(sections, 'session')).toHaveLength(6);
    expect(titles(sections, 'session')[0]).toBe('概念讨论 19'); // equal scores: most recent first
  });

  it('returns nothing when nothing matches', () => {
    expect(filterItems(buildItems(data()), 'zzz-nope')).toEqual([]);
    expect(score('', buildItems(data())[0])).toBe(0);
  });
});
