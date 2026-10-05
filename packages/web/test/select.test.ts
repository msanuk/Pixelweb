import { describe, expect, it } from 'vitest';
import { memoSelector, shallowEqual } from '../src/lib/select';

describe('shallowEqual', () => {
  it('compares arrays and plain objects one level deep', () => {
    const a = { id: 1 };
    expect(shallowEqual([a, 2], [a, 2])).toBe(true);
    expect(shallowEqual([a], [{ id: 1 }])).toBe(false);
    expect(shallowEqual({ x: a, y: 2 }, { x: a, y: 2 })).toBe(true);
    expect(shallowEqual({ x: a }, { x: a, y: 1 })).toBe(false);
    expect(shallowEqual([1], [1, 2])).toBe(false);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, [])).toBe(false);
    expect(shallowEqual('a', 'a')).toBe(true);
  });
  it('never calls two different Set, Map or Date instances equal (their keys are not enumerable)', () => {
    const set = new Set(['a']);
    expect(shallowEqual(set, set)).toBe(true);
    expect(shallowEqual(new Set(['a']), new Set(['a']))).toBe(false);
    expect(shallowEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(false);
    expect(shallowEqual(new Date(0), new Date(0))).toBe(false);
    expect(shallowEqual(new Set(), {})).toBe(false);
  });
});

describe('memoSelector', () => {
  interface S { items: { id: number; sid: string }[]; sid: string }
  const s1: S = { items: [{ id: 1, sid: 'a' }, { id: 2, sid: 'b' }], sid: 'a' };

  it('returns the previous reference while the derived value is shallow-equal', () => {
    const select = memoSelector(() => (s: S) => s.items.filter((i) => i.sid === s.sid), shallowEqual);
    const first = select(s1);
    expect(first).toEqual([{ id: 1, sid: 'a' }]);
    // a new state object with an unrelated change: same filtered items → same reference, so
    // useSyncExternalStore sees a stable snapshot and does not re-render in a loop
    const s2: S = { ...s1, items: s1.items };
    expect(select(s2)).toBe(first);
    expect(select({ ...s1 })).toBe(first);
  });

  it('returns a fresh value when the derived value actually changes', () => {
    const select = memoSelector(() => (s: S) => s.items.filter((i) => i.sid === s.sid), shallowEqual);
    const first = select(s1);
    const second = select({ ...s1, sid: 'b' });
    expect(second).not.toBe(first);
    expect(second).toEqual([{ id: 2, sid: 'b' }]);
    const third = select({ ...s1, sid: 'b' });
    expect(third).toBe(second);
  });

  it('works for selectors that ignore their argument', () => {
    const select = memoSelector(() => () => [1, 2], shallowEqual);
    const first = select(s1);
    expect(first).toEqual([1, 2]);
    expect(select(s1)).toBe(first);
  });

  it('uses the latest selector when one is supplied through a getter', () => {
    let sid = 'a';
    const select = memoSelector(() => (s: S) => s.items.filter((i) => i.sid === sid), shallowEqual);
    expect(select(s1)).toEqual([{ id: 1, sid: 'a' }]);
    sid = 'b';
    expect(select(s1)).toEqual([{ id: 2, sid: 'b' }]);
  });
});
