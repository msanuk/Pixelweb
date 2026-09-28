import type { OcMessageWithParts, OcSession, UsageModelRow, UsageReport, UsageTotals } from '@pixelweb/shared';
import { addStep, emptyTotals, stepsOf, type UsageStep } from '@pixelweb/shared/steps';

/** "YYYY-MM-DD" in the viewer's zone; `tzOffset` is `Date#getTimezoneOffset()` (minutes, UTC − local). */
export function dayKey(t: number, tzOffset: number): string {
  return new Date(t - tzOffset * 60_000).toISOString().slice(0, 10);
}

/** Sums the steps that fall in [from, to), per model and per local day. */
export function aggregateUsage(
  sessions: { sessionID: string; steps: UsageStep[] }[],
  from: number,
  to: number,
  tzOffset: number,
  failed = 0,
): UsageReport {
  const total = emptyTotals();
  const models = new Map<string, UsageModelRow & { ids: Set<string> }>();
  const days = new Map<string, { day: string; total: UsageTotals; models: Record<string, UsageTotals> }>();
  const used = new Set<string>();
  for (const { sessionID, steps } of sessions) {
    for (const s of steps) {
      if (s.t < from || s.t >= to) continue;
      const key = `${s.providerID}/${s.modelID}`;
      used.add(sessionID);
      addStep(total, s);
      let row = models.get(key);
      if (!row) models.set(key, (row = { providerID: s.providerID, modelID: s.modelID, sessions: 0, ids: new Set(), ...emptyTotals() }));
      addStep(row, s);
      row.ids.add(sessionID);
      const dk = dayKey(s.t, tzOffset);
      let day = days.get(dk);
      if (!day) days.set(dk, (day = { day: dk, total: emptyTotals(), models: {} }));
      addStep(day.total, s);
      addStep((day.models[key] ??= emptyTotals()), s);
    }
  }
  const prompt = (t: UsageTotals) => t.input + t.cacheRead + t.cacheWrite;
  return {
    from,
    to,
    sessions: used.size,
    total,
    models: [...models.values()]
      .map(({ ids, ...row }) => ({ ...row, sessions: ids.size }))
      .sort((a, b) => prompt(b) - prompt(a) || b.output - a.output),
    days: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    failed,
  };
}

/**
 * Per-session step lists, reloaded only when a session's `time.updated` moves,
 * so widening the range or reopening the page doesn't refetch every message.
 */
export class UsageIndex {
  private cache = new Map<string, { updated: number; steps: UsageStep[] }>();

  constructor(private readonly load: (sessionID: string) => Promise<OcMessageWithParts[]>) {}

  async report(sessions: OcSession[], from: number, to: number, tzOffset: number): Promise<UsageReport> {
    // a session last touched before `from`, or created after `to`, has no steps in range
    const relevant = sessions.filter((s) => s.time.updated >= from && s.time.created < to);
    const out: { sessionID: string; steps: UsageStep[] }[] = [];
    let failed = 0;
    for (let i = 0; i < relevant.length; i += 6) {
      await Promise.all(
        relevant.slice(i, i + 6).map(async (s) => {
          let hit = this.cache.get(s.id);
          if (!hit || hit.updated !== s.time.updated) {
            try {
              hit = { updated: s.time.updated, steps: stepsOf(await this.load(s.id)) };
              this.cache.set(s.id, hit);
            } catch {
              failed++;
              return;
            }
          }
          out.push({ sessionID: s.id, steps: hit.steps });
        }),
      );
    }
    return aggregateUsage(out, from, to, tzOffset, failed);
  }
}
