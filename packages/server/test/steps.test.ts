import { describe, expect, it } from 'vitest';
import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { sessionTotals, stepsOf } from '@pixelweb/shared/steps';

const tk = (input: number, read = 0, write = 0, output = 10) => ({ input, output, reasoning: 0, cache: { read, write } });

function assistant(t: number, model: string, steps: ReturnType<typeof tk>[], msgTokens = steps.at(-1) ?? tk(0, 0, 0, 0)): OcMessageWithParts {
  const [providerID, modelID] = model.split('/');
  return {
    info: { id: `m${t}`, sessionID: 's', role: 'assistant', time: { created: t }, parentID: 'u', providerID, modelID, cost: 0.01 * steps.length, tokens: msgTokens },
    parts: steps.map((tokens, i) => ({ id: `p${t}-${i}`, sessionID: 's', messageID: `m${t}`, type: 'step-finish', reason: 'stop', cost: 0.01, tokens })),
  };
}

describe('stepsOf', () => {
  it('counts every step, not just the one the message keeps', () => {
    const steps = stepsOf([assistant(1, 'a/x', [tk(100, 1000), tk(50, 1100)])]);
    expect(steps).toHaveLength(2);
    expect(steps.reduce((n, s) => n + s.input, 0)).toBe(150);
    expect(steps.reduce((n, s) => n + s.cacheRead, 0)).toBe(2100);
  });
  it('falls back to the message tokens when there are no step-finish parts', () => {
    const m = assistant(1, 'a/x', [], tk(70, 30));
    expect(stepsOf([m])).toMatchObject([{ input: 70, cacheRead: 30, modelID: 'x' }]);
    expect(stepsOf([assistant(1, 'a/x', [], tk(0, 0, 0, 0))])).toEqual([]);
  });
  it('ignores user messages', () => {
    expect(stepsOf([{ info: { id: 'u', sessionID: 's', role: 'user', time: { created: 1 } }, parts: [] }])).toEqual([]);
  });
});

describe('sessionTotals', () => {
  const text = (id: string) => ({ id, sessionID: 's', messageID: 'x', type: 'text', text: 'hi' }) as OcPart;
  const user: OcMessageWithParts = { info: { id: 'u', sessionID: 's', role: 'user', time: { created: 0 } }, parts: [text('ut')] };

  it('sums every step of a multi-step turn, not just the one the message keeps', () => {
    const m = assistant(1, 'a/x', [tk(1000, 0, 0, 50), tk(1200, 0, 0, 80)]);
    m.parts.splice(1, 0, text('t'));
    expect(sessionTotals([user, m])).toMatchObject({ steps: 2, input: 2200, output: 130, cost: 0.02 });
  });
  it("uses the message's own tokens and cost when it has no step-finish parts", () => {
    const m = assistant(1, 'a/x', [], tk(500, 0, 0, 20));
    m.info = { ...m.info, cost: 0.25 } as typeof m.info;
    expect(sessionTotals([m])).toMatchObject({ steps: 1, input: 500, output: 20, cost: 0.25 });
  });
  it('adds up across messages, cache included', () => {
    expect(sessionTotals([user, assistant(1, 'a/x', [tk(100, 900, 50)]), assistant(2, 'b/y', [tk(10, 0, 500)])])).toEqual({
      steps: 2, input: 110, output: 20, reasoning: 0, cacheRead: 900, cacheWrite: 550, cost: 0.02,
    });
  });
});
