import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCard } from '../src/knowledge/store.js';

const dir = path.resolve(__dirname, '../../../knowledge');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');
// parse every card exactly once; both blocks below read from this list
const cards = files.map((f) => ({ file: f, id: f.replace(/\.md$/, ''), card: parseCard(fs.readFileSync(path.join(dir, f), 'utf8'), f.replace(/\.md$/, '')) }));

describe('bundled knowledge cards', () => {
  it('has a reasonable number of cards', () => {
    expect(cards.length).toBeGreaterThan(30);
  });

  for (const { file, id, card } of cards) {
    it(`${file} parses and is well-formed`, () => {
      expect(card.id).toBe(id);
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.summary.length).toBeGreaterThan(10);
      expect(card.body).toContain('## 为什么重要');
      expect(card.quiz.length).toBeGreaterThan(0);
      for (const q of card.quiz) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
      expect(card.sources.length).toBeGreaterThan(0);
    });
  }

  it('related ids all point at existing cards', () => {
    const ids = new Set(cards.map((c) => c.id));
    const missing = cards.flatMap(({ file, card }) => card.related.filter((r) => !ids.has(r)).map((r) => `${file} -> ${r}`));
    expect(missing).toEqual([]);
  });
});
