import { describe, expect, it } from 'vitest';
import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { CACHE_TTL_MS, analyzeCache, breakReasons } from '../src/lib/cache';

const tokens = (input: number, read = 0, write = 0) => ({ input, output: 100, reasoning: 0, cache: { read, write } });
const step = (id: string, t: ReturnType<typeof tokens>) => ({ id, sessionID: 's', messageID: 'x', type: 'step-finish', reason: 'stop', cost: 0, tokens: t }) as OcPart;
const tool = (id: string, name: string, input: Record<string, unknown>, end: number) =>
  ({ id, sessionID: 's', messageID: 'x', type: 'tool', callID: id, tool: name, state: { status: 'completed', input, output: '', title: '', metadata: {}, time: { start: end - 100, end } } }) as OcPart;

function user(id: string, created: number, extra: Record<string, unknown> = {}, parts: OcPart[] = []): OcMessageWithParts {
  return { info: { id, sessionID: 's', role: 'user', time: { created }, ...extra }, parts } as OcMessageWithParts;
}
function assistant(id: string, created: number, parts: OcPart[], extra: Record<string, unknown> = {}): OcMessageWithParts {
  return {
    info: { id, sessionID: 's', role: 'assistant', time: { created }, parentID: '', modelID: 'm', providerID: 'p', mode: 'build', cost: 0, tokens: tokens(0), ...extra },
    parts,
  } as OcMessageWithParts;
}

describe('analyzeCache', () => {
  it('computes hit rates per step and for the session', () => {
    const c = analyzeCache([
      user('u', 0),
      assistant('a', 0, [tool('t', 'read', {}, 1_000), step('1', tokens(1_000, 0, 9_000)), step('2', tokens(500, 10_000, 500))]),
    ]);
    expect(c.steps.get('1')).toMatchObject({ prompt: 10_000, read: 0, write: 9_000, hitRate: 0 });
    expect(c.steps.get('2')).toMatchObject({ prompt: 11_000, read: 10_000, hitRate: 10_000 / 11_000 });
    expect(c.steps.get('2')?.broken).toBeUndefined();
    expect(c).toMatchObject({ prompt: 21_000, read: 10_000, write: 9_500, breaks: 0, reported: true });
    expect(c.hitRate).toBeCloseTo(10_000 / 21_000);
  });

  it('flags a request that re-reads far less than the previous prompt, with the idle gap as cause', () => {
    const c = analyzeCache([
      user('u1', 0),
      assistant('a1', 0, [step('1', tokens(100, 20_000))]),
      user('u2', CACHE_TTL_MS + 60_000),
      assistant('a2', CACHE_TTL_MS + 60_000, [step('2', tokens(100, 0, 20_100))]),
    ]);
    const b = c.steps.get('2')?.broken;
    expect(b).toMatchObject({ expected: 20_100, causes: ['idle'], idleMs: CACHE_TTL_MS + 60_000 });
    expect(c.breaks).toBe(1);
    expect(breakReasons(b!)).toContain('6m0s');
  });

  it('measures the gap inside a message from when the previous step’s tools finished', () => {
    const c = analyzeCache([
      user('u', 0),
      assistant('a', 0, [tool('t', 'bash', {}, 10 * 60_000), step('1', tokens(100, 20_000)), step('2', tokens(20_000, 0))]),
    ]);
    // the long bash call of step 1 (say a permission wait) ran before request 2, which was sent right after it
    expect(c.steps.get('2')?.broken).toMatchObject({ causes: ['idle'], idleMs: 10 * 60_000 });
  });

  it('names model, agent, settings, instruction-file and compaction changes', () => {
    const c = analyzeCache([
      user('u1', 0, { agent: 'build', model: { providerID: 'p', modelID: 'm', variant: 'high' } }),
      assistant('a1', 0, [tool('t', 'edit', { filePath: 'D:\\repo\\AGENTS.md' }, 1), step('1', tokens(100, 20_000)), step('2', tokens(21_000, 0))]),
      user('u2', 2, { agent: 'plan', model: { providerID: 'p', modelID: 'm' } }),
      assistant('a2', 2, [step('3', tokens(30_000, 0))], { mode: 'plan', modelID: 'other' }),
      user('u3', 3, {}, [{ id: 'c', sessionID: 's', messageID: 'u3', type: 'compaction', auto: true } as OcPart]),
      assistant('a3', 3, [step('4', tokens(30_000, 0))], { mode: 'compaction', modelID: 'other', summary: true }),
      assistant('a4', 4, [step('5', tokens(3_000, 0))], { mode: 'compaction', modelID: 'other' }),
    ]);
    expect(c.steps.get('2')?.broken?.causes).toEqual(['instructions']);
    expect(c.steps.get('3')?.broken?.causes).toEqual(['model', 'agent', 'settings']);
    expect(c.steps.get('4')?.broken?.causes).toEqual(['compaction', 'agent']);
    // the request after the summary starts from it, not from the history before
    expect(c.steps.get('5')?.broken?.causes).toEqual(['compaction']);
  });

  it('ignores small prompts and reports nothing when the provider never sends cache usage', () => {
    expect(analyzeCache([assistant('a', 0, [step('1', tokens(500)), step('2', tokens(600))])]).breaks).toBe(0);
    const c = analyzeCache([assistant('a', 0, [step('1', tokens(20_000)), step('2', tokens(21_000))])]);
    expect(c).toMatchObject({ reported: false, breaks: 0, hitRate: 0 });
  });

  it('explains a break it cannot attribute', () => {
    expect(breakReasons({ expected: 1, causes: [], idleMs: 0 })).toContain('原因不明');
  });
});
