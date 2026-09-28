import { describe, expect, it } from 'vitest';
import type { UsageReport, UsageTotals } from '@pixelweb/shared';
import { dayBars, dayOf, hitRate, niceMax, parseDay, rangeFor } from '../src/lib/usage';

const T = (p: Partial<UsageTotals> = {}): UsageTotals => ({ steps: 1, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0, ...p });
const noon = (s: string) => parseDay(s) + 12 * 3_600_000;

describe('rangeFor', () => {
  const now = noon('2026-09-28');
  it('covers whole local days, today included', () => {
    const r = rangeFor('7d', now)!;
    expect(dayOf(r.from)).toBe('2026-09-22');
    expect(r.to).toBe(parseDay('2026-09-29'));
    expect(rangeFor('today', now)).toEqual({ from: parseDay('2026-09-28'), to: parseDay('2026-09-29') });
    expect(rangeFor('all', now)!.from).toBe(0);
  });
  it('makes custom ranges inclusive and rejects backwards ones', () => {
    expect(rangeFor('custom', now, { from: '2026-09-01', to: '2026-09-03' })).toEqual({ from: parseDay('2026-09-01'), to: parseDay('2026-09-04') });
    expect(rangeFor('custom', now, { from: '2026-09-03', to: '2026-09-01' })).toBeNull();
    expect(rangeFor('custom', now, { from: '', to: '2026-09-01' })).toBeNull();
  });
});

describe('hitRate', () => {
  it('is read over the whole prompt, or null when nothing was cached', () => {
    expect(hitRate(T({ input: 100, cacheRead: 300 }))).toBe(0.75);
    expect(hitRate(T({ input: 100 }))).toBeNull();
  });
});

describe('dayBars', () => {
  const report = (from: number, to: number): UsageReport => ({
    from,
    to,
    sessions: 1,
    total: T(),
    models: [],
    failed: 0,
    days: [
      { day: '2026-09-25', total: T({ input: 5 }), models: { 'a/x': T({ input: 5 }) } },
      { day: '2026-09-27', total: T({ input: 7 }), models: { 'b/y': T({ input: 7 }) } },
    ],
  });
  const now = noon('2026-09-28');

  it('fills empty days across the range, up to today', () => {
    const bars = dayBars(report(parseDay('2026-09-24'), parseDay('2026-09-29')), null, now);
    expect(bars.map((b) => [b.day, b.totals?.input ?? null])).toEqual([
      ['2026-09-24', null],
      ['2026-09-25', 5],
      ['2026-09-26', null],
      ['2026-09-27', 7],
      ['2026-09-28', null],
    ]);
  });
  it('starts an open range at the first day with data, and narrows to one model', () => {
    const bars = dayBars(report(0, parseDay('2026-09-29')), 'a/x', now);
    expect(bars[0].day).toBe('2026-09-25');
    expect(bars.filter((b) => b.totals).map((b) => b.day)).toEqual(['2026-09-25']);
  });
});

describe('niceMax', () => {
  it('rounds up to a round number', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(130)).toBe(150);
    expect(niceMax(280_000)).toBe(300_000);
    expect(niceMax(4_100_000)).toBe(5_000_000);
    expect(niceMax(610)).toBe(800);
  });
});
