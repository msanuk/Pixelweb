import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCard } from '../src/knowledge/store.js';

const dir = path.resolve(__dirname, '../../../knowledge');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');

describe('bundled knowledge cards', () => {
  it('has a reasonable number of cards', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  for (const f of files) {
    it(`${f} parses and is well-formed`, () => {
      const card = parseCard(fs.readFileSync(path.join(dir, f), 'utf8'), f.replace(/\.md$/, ''));
      expect(card.id).toBe(f.replace(/\.md$/, ''));
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
    const ids = new Set(files.map((f) => f.replace(/\.md$/, '')));
    const missing: string[] = [];
    for (const f of files) {
      const card = parseCard(fs.readFileSync(path.join(dir, f), 'utf8'), f);
      for (const r of card.related) if (!ids.has(r)) missing.push(`${f} -> ${r}`);
    }
    expect(missing).toEqual([]);
  });

  it('no highlighted term points at two different cards', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const f of files) {
      const card = parseCard(fs.readFileSync(path.join(dir, f), 'utf8'), f.replace(/\.md$/, ''));
      for (const t of [card.title, ...card.aliases]) {
        const k = t.toLowerCase();
        const prev = owner.get(k);
        if (prev && prev !== card.id) clashes.push(`${t}: ${prev} / ${card.id}`);
        owner.set(k, card.id);
      }
    }
    expect(clashes).toEqual([]);
  });
});
