import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { CardCategory, KnowledgeCard, KnowledgeIndexEntry, QuizItem } from '@pixelweb/shared';

const CATEGORIES: CardCategory[] = ['ai', 'git', 'web', 'tooling', 'architecture', 'general'];

export function parseCard(raw: string, fallbackId: string): KnowledgeCard {
  const { data, content } = matter(raw);
  const id = String(data.id ?? fallbackId);
  const category = CATEGORIES.includes(data.category) ? (data.category as CardCategory) : 'general';
  const level = [1, 2, 3].includes(Number(data.level)) ? (Number(data.level) as 1 | 2 | 3) : 1;
  return {
    id,
    title: String(data.title ?? id),
    aliases: toStringArray(data.aliases),
    category,
    summary: String(data.summary ?? '').trim(),
    body: content.trim(),
    related: toStringArray(data.related),
    appearsIn: toStringArray(data.appearsIn),
    quiz: toQuiz(data.quiz),
    sources: Array.isArray(data.sources)
      ? data.sources
          .filter((s: unknown) => s && typeof s === 'object')
          .map((s: { title?: unknown; url?: unknown }) => ({ title: String(s.title ?? s.url ?? ''), url: String(s.url ?? '') }))
      : [],
    level,
  };
}

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function toQuiz(v: unknown): QuizItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((q) => q && typeof q === 'object' && Array.isArray(q.options))
    .map((q) => ({
      q: String(q.q ?? ''),
      options: q.options.map(String),
      answer: Number(q.answer ?? 0),
      why: q.why ? String(q.why) : undefined,
    }));
}

/** Simple scoring search across title, aliases and summary. */
export function searchCards(cards: KnowledgeCard[], query: string, limit = 10): KnowledgeIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = cards
    .map((c) => {
      let score = 0;
      const title = c.title.toLowerCase();
      if (title === q || c.id === q) score += 100;
      else if (title.includes(q)) score += 40;
      for (const a of c.aliases) {
        const al = a.toLowerCase();
        if (al === q) score += 90;
        else if (al.includes(q) || q.includes(al)) score += 30;
      }
      if (c.summary.toLowerCase().includes(q)) score += 10;
      if (c.body.toLowerCase().includes(q)) score += 3;
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ c }) => toIndexEntry(c));
}

export function toIndexEntry(c: KnowledgeCard): KnowledgeIndexEntry {
  return { id: c.id, title: c.title, aliases: c.aliases, category: c.category, summary: c.summary, level: c.level };
}

export class KnowledgeStore {
  private cards = new Map<string, KnowledgeCard>();
  /** Cards that failed to parse on the last load, for /api/knowledge/reload and logs. */
  errors: { file: string; message: string }[] = [];

  constructor(private readonly dirs: string[]) {}

  async load(): Promise<void> {
    const next = new Map<string, KnowledgeCard>();
    this.errors = [];
    for (const dir of this.dirs) {
      let entries: string[];
      try {
        entries = await fs.readdir(dir);
      } catch {
        continue;
      }
      for (const name of entries) {
        if (!name.endsWith('.md') || name.toLowerCase() === 'readme.md') continue;
        const file = path.join(dir, name);
        try {
          const raw = await fs.readFile(file, 'utf8');
          const card = parseCard(raw, name.replace(/\.md$/, ''));
          next.set(card.id, card); // later dirs (user overrides) win
        } catch (e) {
          // one malformed card must never take the whole workbench down
          this.errors.push({ file, message: e instanceof Error ? e.message.split('\n')[0] : String(e) });
          console.warn(`[pixelweb] skipping knowledge card ${file}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
        }
      }
    }
    this.cards = next;
  }

  all(): KnowledgeCard[] {
    return [...this.cards.values()].sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
  }

  index(): KnowledgeIndexEntry[] {
    return this.all().map(toIndexEntry);
  }

  get(id: string): KnowledgeCard | undefined {
    return this.cards.get(id);
  }

  /** Finds a card by id, title or alias (case-insensitive). */
  find(term: string): KnowledgeCard | undefined {
    const t = term.trim().toLowerCase();
    return (
      this.cards.get(t) ??
      this.all().find((c) => c.title.toLowerCase() === t || c.aliases.some((a) => a.toLowerCase() === t))
    );
  }

  search(q: string, limit?: number): KnowledgeIndexEntry[] {
    return searchCards(this.all(), q, limit);
  }

  /** Terms for client-side highlighting: every title + alias mapped to card id. */
  terms(): { term: string; cardId: string }[] {
    const out: { term: string; cardId: string }[] = [];
    for (const c of this.cards.values()) {
      out.push({ term: c.title, cardId: c.id });
      for (const a of c.aliases) out.push({ term: a, cardId: c.id });
    }
    return out.filter((t) => t.term.length >= 2);
  }

  /** Tool → card mapping, so the timeline can attach "what is this tool" to each call. */
  forTool(toolName: string): KnowledgeCard | undefined {
    const key = `timeline.tool.${toolName.toLowerCase()}`;
    return this.all().find((c) => c.appearsIn.includes(key)) ?? this.find(toolName);
  }
}
