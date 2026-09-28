import { describe, expect, it, vi } from 'vitest';
import type { OcMessageWithParts, OcSession } from '@pixelweb/shared';
import { stepsOf } from '@pixelweb/shared/steps';
import { UsageIndex, aggregateUsage, dayKey } from '../src/usage.js';

const tk = (input: number, read = 0, write = 0, output = 10) => ({ input, output, reasoning: 0, cache: { read, write } });

function assistant(t: number, model: string, steps: ReturnType<typeof tk>[], msgTokens = steps.at(-1) ?? tk(0, 0, 0, 0)): OcMessageWithParts {
  const [providerID, modelID] = model.split('/');
  return {
    info: { id: `m${t}`, sessionID: 's', role: 'assistant', time: { created: t }, parentID: 'u', providerID, modelID, cost: 0.01 * steps.length, tokens: msgTokens },
    parts: steps.map((tokens, i) => ({ id: `p${t}-${i}`, sessionID: 's', messageID: `m${t}`, type: 'step-finish', reason: 'stop', cost: 0.01, tokens })),
  };
}

describe('aggregateUsage', () => {
  const day = 86_400_000;
  const a = stepsOf([assistant(day, 'a/x', [tk(100, 900)]), assistant(2 * day, 'b/y', [tk(10, 0, 500)])]);
  const b = stepsOf([assistant(2 * day + 5, 'a/x', [tk(200, 800)])]);

  it('groups by model, most prompt tokens first, counting sessions per model', () => {
    const r = aggregateUsage([{ sessionID: 's1', steps: a }, { sessionID: 's2', steps: b }], 0, 10 * day, 0);
    expect(r.sessions).toBe(2);
    expect(r.models.map((m) => [m.modelID, m.sessions, m.input, m.cacheRead])).toEqual([
      ['x', 2, 300, 1700],
      ['y', 1, 10, 0],
    ]);
    expect(r.total.steps).toBe(3);
    expect(r.days.map((d) => d.day)).toEqual(['1970-01-02', '1970-01-03']);
    expect(r.days[1].models['a/x'].input).toBe(200);
  });
  it('keeps only steps inside [from, to)', () => {
    const r = aggregateUsage([{ sessionID: 's1', steps: a }, { sessionID: 's2', steps: b }], 2 * day, 3 * day, 0);
    expect(r.total.steps).toBe(2);
    expect(r.models.find((m) => m.modelID === 'x')?.sessions).toBe(1);
  });
});

describe('dayKey', () => {
  it('uses the viewer’s zone', () => {
    // 2026-09-27 20:00 UTC is already the 28th in UTC+8 (offset −480)
    expect(dayKey(Date.UTC(2026, 8, 27, 20), -480)).toBe('2026-09-28');
    expect(dayKey(Date.UTC(2026, 8, 27, 20), 0)).toBe('2026-09-27');
  });
});

describe('UsageIndex', () => {
  const ses = (id: string, created: number, updated: number): OcSession => ({ id, title: id, time: { created, updated } });

  it('reloads a session only when it was updated, and skips sessions outside the range', async () => {
    const load = vi.fn(async () => [assistant(5, 'a/x', [tk(10)])]);
    const idx = new UsageIndex(load);
    await idx.report([ses('s1', 1, 6), ses('old', 0, 2)], 3, 100, 0);
    expect(load).toHaveBeenCalledTimes(1);
    await idx.report([ses('s1', 1, 6)], 0, 100, 0);
    expect(load).toHaveBeenCalledTimes(1);
    const r = await idx.report([ses('s1', 1, 7)], 0, 100, 0);
    expect(load).toHaveBeenCalledTimes(2);
    expect(r.total.input).toBe(10);
  });
  it('reports sessions it could not load instead of failing', async () => {
    const idx = new UsageIndex(async () => {
      throw new Error('boom');
    });
    const r = await idx.report([ses('s1', 1, 6)], 0, 100, 0);
    expect(r.failed).toBe(1);
    expect(r.models).toEqual([]);
  });
});
