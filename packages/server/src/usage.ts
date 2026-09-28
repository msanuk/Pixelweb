import type { OcMessageWithParts, OcPart, OcSession, OcTokens, UsageModelRow, UsageReport, UsageTotals } from '@pixelweb/shared';

/** One model request: an OpenCode step, timed by the assistant message it belongs to. */
export interface UsageStep {
  t: number;
  providerID: string;
  modelID: string;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

const tokenFields = (t: OcTokens | undefined) => ({
  input: t?.input ?? 0,
  output: t?.output ?? 0,
  reasoning: t?.reasoning ?? 0,
  cacheRead: t?.cache?.read ?? 0,
  cacheWrite: t?.cache?.write ?? 0,
});

/**
 * Every request a session made. Counted from step-finish parts: an assistant
 * message's own `tokens` only hold its last step (OpenCode overwrites them per
 * step), so summing messages would undercount multi-step turns. A message with
 * no step-finish (older OpenCode, or it failed mid-step) counts as one step.
 */
export function stepsOf(messages: OcMessageWithParts[]): UsageStep[] {
  const out: UsageStep[] = [];
  for (const m of messages) {
    const info = m.info;
    if (info.role !== 'assistant') continue;
    const base = { t: info.time.created, providerID: info.providerID, modelID: info.modelID };
    const finishes = m.parts.filter((p): p is Extract<OcPart, { type: 'step-finish' }> => p.type === 'step-finish');
    if (finishes.length) {
      for (const f of finishes) out.push({ ...base, ...tokenFields(f.tokens), cost: f.cost ?? 0 });
    } else {
      const f = tokenFields(info.tokens);
      if (f.input + f.output + f.cacheRead + f.cacheWrite > 0) out.push({ ...base, ...f, cost: info.cost ?? 0 });
    }
  }
  return out;
}

export const emptyTotals = (): UsageTotals => ({ steps: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });

function add(t: UsageTotals, s: UsageStep): void {
  t.steps++;
  t.input += s.input;
  t.output += s.output;
  t.reasoning += s.reasoning;
  t.cacheRead += s.cacheRead;
  t.cacheWrite += s.cacheWrite;
  t.cost += s.cost;
}

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
      add(total, s);
      let row = models.get(key);
      if (!row) models.set(key, (row = { providerID: s.providerID, modelID: s.modelID, sessions: 0, ids: new Set(), ...emptyTotals() }));
      add(row, s);
      row.ids.add(sessionID);
      const dk = dayKey(s.t, tzOffset);
      let day = days.get(dk);
      if (!day) days.set(dk, (day = { day: dk, total: emptyTotals(), models: {} }));
      add(day.total, s);
      add((day.models[key] ??= emptyTotals()), s);
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
