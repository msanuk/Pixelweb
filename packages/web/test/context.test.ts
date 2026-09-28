import { describe, expect, it } from 'vitest';
import type { ModelInfo, OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { compactionThreshold, contextUsage } from '../src/lib/context';

const tokens = (input: number, output = 0, read = 0) => ({ input, output, reasoning: 0, cache: { read, write: 0 } });

function assistant(id: string, parts: OcPart[], extra: Record<string, unknown> = {}): OcMessageWithParts {
  return {
    info: { id, sessionID: 's', role: 'assistant', time: { created: 0 }, parentID: '', modelID: 'm', providerID: 'p', cost: 0, tokens: tokens(0), ...extra },
    parts,
  } as OcMessageWithParts;
}
const step = (id: string, t: ReturnType<typeof tokens>) => ({ id, sessionID: 's', messageID: 'x', type: 'step-finish', reason: 'stop', cost: 0, tokens: t }) as OcPart;
const info: ModelInfo = { limits: { 'p/m': { context: 200_000, output: 64_000 } }, compaction: { auto: true } };

describe('compactionThreshold', () => {
  it('leaves room for the reply, capped at 32k', () => {
    expect(compactionThreshold({ context: 200_000, output: 64_000 })).toBe(168_000);
    expect(compactionThreshold({ context: 128_000, output: 16_000 })).toBe(112_000);
  });

  it('uses a separate input cap minus the reserve when the model has one', () => {
    expect(compactionThreshold({ context: 400_000, input: 272_000, output: 128_000 })).toBe(252_000);
    expect(compactionThreshold({ context: 400_000, input: 272_000, output: 128_000 }, 50_000)).toBe(222_000);
  });
});

describe('contextUsage', () => {
  it('reads the last step of the latest assistant message, cache included', () => {
    const msgs = [assistant('a', [step('1', tokens(10_000, 500)), step('2', tokens(2_000, 800, 40_000))])];
    expect(contextUsage(msgs, info)).toMatchObject({ model: 'p/m', used: 42_800, limit: 200_000, threshold: 168_000, justCompacted: false });
  });

  it('skips a reply that has not finished a step yet', () => {
    const msgs = [assistant('a', [step('1', tokens(30_000, 1_000))]), assistant('b', [])];
    expect(contextUsage(msgs, info)?.used).toBe(31_000);
  });

  it('flags a fresh compaction summary instead of reporting its (huge) request', () => {
    const msgs = [assistant('a', [step('1', tokens(150_000))]), assistant('b', [step('2', tokens(160_000))], { summary: true })];
    expect(contextUsage(msgs, info)).toMatchObject({ justCompacted: true, used: 0 });
  });

  it('still reports usage for a model without known limits', () => {
    expect(contextUsage([assistant('a', [step('1', tokens(5_000))])], { limits: {}, compaction: { auto: true } })).toMatchObject({ used: 5_000, limit: 0 });
    expect(contextUsage([], info)).toBeNull();
  });
});
