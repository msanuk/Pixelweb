import { describe, expect, it } from 'vitest';
import { parseCard, searchCards } from '../src/knowledge/store.js';
import { buildExplainPrompt } from '../src/knowledge/explain.js';

const raw = `---
id: webhook
title: Webhook
aliases: [web hook, 回调]
category: web
level: 1
summary: 服务端在事件发生时主动向你配置的 URL 发一个 HTTP 请求。
related: [sse, websocket]
appearsIn: [git.remote]
quiz:
  - q: Webhook 由谁发起请求？
    options: [客户端, 服务端, 浏览器, DNS]
    answer: 1
sources:
  - title: MDN
    url: https://developer.mozilla.org/
---
## 为什么重要
正文。
`;

describe('parseCard', () => {
  it('reads frontmatter and body', () => {
    const c = parseCard(raw, 'fallback');
    expect(c.id).toBe('webhook');
    expect(c.aliases).toEqual(['web hook', '回调']);
    expect(c.category).toBe('web');
    expect(c.quiz[0].answer).toBe(1);
    expect(c.sources[0].url).toContain('mozilla');
    expect(c.body.startsWith('## 为什么重要')).toBe(true);
  });
  it('falls back gracefully on missing fields', () => {
    const c = parseCard('---\ntitle: X\ncategory: nope\nlevel: 9\n---\nbody', 'x-id');
    expect(c.id).toBe('x-id');
    expect(c.category).toBe('general');
    expect(c.level).toBe(1);
    expect(c.quiz).toEqual([]);
  });
});

describe('searchCards', () => {
  const cards = [parseCard(raw, 'webhook'), parseCard('---\nid: sse\ntitle: Server-Sent Events\naliases: [SSE]\nsummary: 单向推流\n---\n', 'sse')];
  it('ranks exact alias matches highest', () => {
    expect(searchCards(cards, 'sse')[0].id).toBe('sse');
    expect(searchCards(cards, '回调')[0].id).toBe('webhook');
    expect(searchCards(cards, 'zzz')).toEqual([]);
  });
});

describe('buildExplainPrompt', () => {
  it('includes term, context and card grounding', () => {
    const p = buildExplainPrompt({ term: 'Webhook', context: 'tool call: webfetch' }, parseCard(raw, 'webhook'), '/proj');
    expect(p).toContain('Webhook');
    expect(p).toContain('tool call: webfetch');
    expect(p).toContain('/proj');
    expect(p).toContain('往深一层');
  });
});
