import type { UsageReport, UsageTotals } from '@pixelweb/shared';

export type RangePreset = 'today' | '7d' | '30d' | 'all' | 'custom';

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'today', label: '今天' },
  { id: '7d', label: '7 天' },
  { id: '30d', label: '30 天' },
  { id: 'all', label: '全部' },
  { id: 'custom', label: '自定义' },
];

const DAY = 86_400_000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "YYYY-MM-DD" (local) → local midnight; NaN when malformed. */
export function parseDay(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : NaN;
}

/** Local "YYYY-MM-DD", matching the server's day keys when it gets our timezone offset. */
export function dayOf(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** [from, to) in ms for a preset; custom days are inclusive on both ends. */
export function rangeFor(preset: RangePreset, now: number, custom?: { from: string; to: string }): { from: number; to: number } | null {
  const today = startOfDay(now);
  const tomorrow = startOfDay(today + DAY + 3_600_000); // + 1h: a DST day can be 23h long
  switch (preset) {
    case 'today':
      return { from: today, to: tomorrow };
    case '7d':
      return { from: startOfDay(today - 6 * DAY + 3_600_000), to: tomorrow };
    case '30d':
      return { from: startOfDay(today - 29 * DAY + 3_600_000), to: tomorrow };
    case 'all':
      return { from: 0, to: tomorrow };
    case 'custom': {
      const from = parseDay(custom?.from ?? '');
      const last = parseDay(custom?.to ?? '');
      if (Number.isNaN(from) || Number.isNaN(last) || last < from) return null;
      return { from, to: startOfDay(last + DAY + 3_600_000) };
    }
  }
}

/** Share of the prompt served from cache; null when the provider reported no cache use at all. */
export function hitRate(t: UsageTotals): number | null {
  if (t.cacheRead + t.cacheWrite === 0) return null;
  return t.cacheRead / (t.input + t.cacheRead + t.cacheWrite);
}

export const promptTokens = (t: UsageTotals) => t.input + t.cacheRead + t.cacheWrite;

export interface DayBar {
  day: string;
  totals: UsageTotals | null;
}

/**
 * One bar per day from the range's first day (or the first day with data, for
 * open-ended ranges) to its last, empty days included so gaps read as gaps.
 * `model` narrows each day to one "providerID/modelID".
 */
export function dayBars(report: UsageReport, model: string | null, now: number): DayBar[] {
  const byDay = new Map(report.days.map((d) => [d.day, model ? d.models[model] : d.total]));
  const first = report.from > 0 ? report.from : report.days.length ? parseDay(report.days[0].day) : NaN;
  const last = Math.min(report.to - 1, now);
  if (Number.isNaN(first) || first > last) return [];
  const out: DayBar[] = [];
  for (let t = startOfDay(first); t <= last && out.length < 400; t = startOfDay(t + DAY + 3_600_000)) {
    const day = dayOf(t);
    out.push({ day, totals: byDay.get(day) ?? null });
  }
  return out;
}

/** A round axis maximum ≥ n, snug enough that the tallest bar fills most of the plot. */
export function niceMax(n: number): number {
  if (n <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 1.5, 2, 3, 4, 5, 6, 8, 10]) if (m * p >= n) return m * p;
  return 10 * p;
}
