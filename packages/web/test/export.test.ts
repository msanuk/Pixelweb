import { describe, expect, it } from 'vitest';
import type { KnowledgeIndexEntry, LearningRecord } from '@pixelweb/shared';
import { exportFilename, learningMarkdown } from '../src/lib/export';

const card = (id: string, title: string): KnowledgeIndexEntry => ({ id, title, aliases: [], category: 'ai', summary: `${title} 的定义`, level: 1 });
const rec = (cardId: string, mastery: LearningRecord['mastery'], extra: Partial<LearningRecord> = {}): LearningRecord => ({
  cardId,
  mastery,
  seenCount: 1,
  lastSeen: Date.UTC(2026, 8, 20, 12),
  quizCorrect: 0,
  quizTotal: 0,
  ...extra,
});
const now = Date.UTC(2026, 8, 27, 12);
const cards = [card('sse', 'SSE'), card('token', 'Token'), card('commit', 'Commit')];

describe('learningMarkdown', () => {
  const md = learningMarkdown(
    cards,
    {
      updatedAt: now,
      records: {
        sse: rec('sse', 'mastered'),
        token: rec('token', 'learning', { notes: '# 我的理解\n按 token 计费', quizCorrect: 1, quizTotal: 2, seenCount: 3 }),
        commit: rec('commit', 'learning'),
      },
    },
    { project: 'octool', now },
  );

  it('opens with totals and groups cards by mastery, still-learning first', () => {
    expect(md).toContain('导出于 2026-09-27 · 项目 octool');
    expect(md).toContain('看过 3 / 3 张卡片 · 学习中 2 · 已掌握 1 · 练习正确 1/2');
    expect(md.indexOf('## 学习中（2）')).toBeLessThan(md.indexOf('## 已掌握（1）'));
    expect(md).not.toContain('## 看过');
  });

  it('puts cards with notes first and keeps the notes under the card heading', () => {
    expect(md.indexOf('### Token')).toBeLessThan(md.indexOf('### Commit'));
    expect(md).toContain('> Token 的定义');
    expect(md).toContain('AI · L1 · 看过 3 次 · 最近 2026-09-20 · 练习 1/2');
    expect(md).toContain('**我的笔记**\n\n#### 我的理解\n按 token 计费');
  });

  it('says so when there is nothing to export', () => {
    expect(learningMarkdown(cards, { records: {}, updatedAt: 0 }, { now })).toContain('还没有学习记录');
  });

  it('names the file by date', () => {
    expect(exportFilename(now)).toBe('pixelweb-notes-2026-09-27.md');
  });
});
