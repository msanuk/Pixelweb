import { describe, expect, it } from 'vitest';
import { buildMatcher } from '@web/lib/terms';
import { sameRefs, segments } from '../src/lib/segments';

describe('segments', () => {
  const matcher = buildMatcher([
    { term: '安全组', cardId: 'security-group' },
    { term: 'SSH', cardId: 'ssh' },
  ]);

  it('cuts reply text into field tags, terms and plain text', () => {
    expect(segments('⟦f9⟧ 安全组规则只开 SSH 22', { f9: '安全组规则 · SSH 22' }, matcher)).toEqual([
      { kind: 'ref', ref: 'f9', label: '安全组规则 · SSH 22', chip: 'f9' },
      { kind: 'text', text: ' ' },
      { kind: 'term', text: '安全组', cardId: 'security-group' },
      { kind: 'text', text: '规则只开 ' },
      { kind: 'term', text: 'SSH', cardId: 'ssh' },
      { kind: 'text', text: ' 22' },
    ]);
  });

  it('works without terms, and labels a bare tag', () => {
    expect(segments('选 ⟦f2⟧', { f2: '地域' }, null)).toEqual([
      { kind: 'text', text: '选 ' },
      { kind: 'ref', ref: 'f2', label: '地域', chip: 'f2 地域' },
    ]);
  });
});

describe('sameRefs', () => {
  it('matches a capture record to its prompt by refs and labels', () => {
    expect(sameRefs({ f1: '地域', f2: '镜像' }, { f2: '镜像', f1: '地域' })).toBe(true);
    expect(sameRefs({ f1: '地域' }, { f1: '地域', f2: '镜像' })).toBe(false);
    expect(sameRefs({ f1: '地域' }, { f1: '镜像' })).toBe(false);
  });
});
