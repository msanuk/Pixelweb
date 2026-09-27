/** Builds a matcher that finds knowledge terms inside free text for click-to-explain highlighting. */
export interface TermMatcher {
  regex: RegExp | null;
  lookup: Map<string, string>;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ASCII_BEFORE = '(?<![\\w./\\\\-])';
const ASCII_AFTER = '(?![\\w/\\\\-]|\\.\\w)';

export function buildMatcher(terms: { term: string; cardId: string }[]): TermMatcher {
  const lookup = new Map<string, string>();
  const parts: string[] = [];
  // longest first so "context window" wins over "context"
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);
  for (const { term, cardId } of sorted) {
    const key = term.toLowerCase();
    if (lookup.has(key)) continue;
    lookup.set(key, cardId);
    const ascii = /^[\x00-\x7f]+$/.test(term);
    // ASCII terms need a boundary (CJK has no spaces), and one stricter than \b:
    // not inside a path, file name, URL or identifier — "ts" in auth.ts, "bash" in tool-bash
    parts.push(ascii ? `${ASCII_BEFORE}${escapeRe(term)}${ASCII_AFTER}` : escapeRe(term));
  }
  if (parts.length === 0) return { regex: null, lookup };
  return { regex: new RegExp(`(${parts.join('|')})`, 'gi'), lookup };
}

export function splitByTerms(text: string, m: TermMatcher): { text: string; cardId?: string }[] {
  if (!m.regex) return [{ text }];
  const out: { text: string; cardId?: string }[] = [];
  let last = 0;
  m.regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = m.regex.exec(text)) && count < 200) {
    count++;
    if (match.index > last) out.push({ text: text.slice(last, match.index) });
    out.push({ text: match[0], cardId: m.lookup.get(match[0].toLowerCase()) });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
