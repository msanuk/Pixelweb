import { splitByTerms, type TermMatcher } from '@web/lib/terms';
import { refChip } from './prompt';

/** A run of reply text, cut into plain text, ⟦fN⟧ field tags and knowledge terms. */
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'ref'; ref: string; label?: string; chip: string }
  | { kind: 'term'; text: string; cardId: string };

export function segments(text: string, refs: Record<string, string>, matcher: TermMatcher | null): Segment[] {
  const out: Segment[] = [];
  const parts = text.split(/⟦(f\d+)⟧/);
  parts.forEach((s, i) => {
    if (i % 2 === 1) {
      out.push({ kind: 'ref', ref: s, label: refs[s], chip: refChip(s, refs[s], parts[i + 1] ?? '') });
      return;
    }
    if (!s) return;
    if (!matcher) {
      out.push({ kind: 'text', text: s });
      return;
    }
    for (const p of splitByTerms(s, matcher)) out.push(p.cardId ? { kind: 'term', text: p.text, cardId: p.cardId } : { kind: 'text', text: p.text });
  });
  return out;
}

/** The record of the capture a prompt carried: the one sent with the same fields under the same refs. */
export function sameRefs(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}
