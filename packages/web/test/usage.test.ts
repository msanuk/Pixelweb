import { describe, expect, it } from 'vitest';
import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { sessionTokens } from '../src/lib/usage';

const tokens = (input: number, output: number) => ({ input, output, reasoning: 0, cache: { read: 0, write: 0 } });
const step = (id: string, t: ReturnType<typeof tokens>) => ({ id, sessionID: 's', messageID: 'x', type: 'step-finish', reason: 'stop', cost: 0, tokens: t }) as OcPart;
const text = (id: string) => ({ id, sessionID: 's', messageID: 'x', type: 'text', text: 'hi' }) as OcPart;

function assistant(id: string, parts: OcPart[], t: ReturnType<typeof tokens>, cost: number): OcMessageWithParts {
  return {
    info: { id, sessionID: 's', role: 'assistant', time: { created: 0 }, parentID: '', modelID: 'm', providerID: 'p', mode: 'build', cost, tokens: t },
    parts,
  } as OcMessageWithParts;
}
const user = (id: string) => ({ info: { id, sessionID: 's', role: 'user', time: { created: 0 } }, parts: [text(`${id}-t`)] }) as OcMessageWithParts;

describe('sessionTokens', () => {
  it('sums every step of a multi-step turn, not just the last one the message keeps', () => {
    const m = assistant('a1', [step('s1', tokens(1000, 50)), text('t'), step('s2', tokens(1200, 80))], tokens(1200, 80), 0.03);
    expect(sessionTokens([user('u1'), m])).toEqual({ input: 2200, output: 130, cost: 0.03 });
  });

  it("falls back to the message's own tokens when it has no step-finish parts", () => {
    const m = assistant('a1', [text('t')], tokens(500, 20), 0.01);
    expect(sessionTokens([m])).toEqual({ input: 500, output: 20, cost: 0.01 });
  });

  it('adds up across messages and ignores user messages', () => {
    const a = assistant('a1', [step('s1', tokens(100, 10))], tokens(100, 10), 0.5);
    const b = assistant('a2', [], tokens(300, 30), 0.25);
    expect(sessionTokens([user('u1'), a, user('u2'), b])).toEqual({ input: 400, output: 40, cost: 0.75 });
  });
});
