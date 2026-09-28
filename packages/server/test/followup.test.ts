import { describe, expect, it } from 'vitest';
import type { OcMessageWithParts } from '@pixelweb/shared';
import { followUpSettings } from '../src/opencode/followup.js';

const user = (id: string, info: object): OcMessageWithParts =>
  ({ info: { id, sessionID: 's', role: 'user', time: { created: 0 }, ...info }, parts: [] }) as OcMessageWithParts;
const assistant = (id: string): OcMessageWithParts =>
  ({
    info: { id, sessionID: 's', role: 'assistant', time: { created: 0 }, parentID: '', modelID: 'm', providerID: 'p', cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } },
    parts: [],
  }) as OcMessageWithParts;

describe('followUpSettings', () => {
  it('repeats the last user turn: agent, model, variant, system and tools', () => {
    const messages = [
      user('u1', { agent: 'build', model: { providerID: 'anthropic', modelID: 'a' } }),
      assistant('a1'),
      user('u2', { agent: 'plan', model: { providerID: 'openai', modelID: 'b', variant: 'high' }, system: 'teach', tools: { bash: false } }),
      assistant('a2'),
      assistant('a3'),
    ];
    expect(followUpSettings(messages)).toEqual({
      agent: 'plan',
      model: { providerID: 'openai', modelID: 'b' },
      variant: 'high',
      system: 'teach',
      tools: { bash: false },
    });
  });

  it('leaves out what the turn did not set', () => {
    expect(followUpSettings([user('u1', { agent: 'build', tools: {} })])).toEqual({ agent: 'build' });
    expect(followUpSettings([user('u1', {})])).toEqual({});
  });

  it('is empty for a session without user messages', () => {
    expect(followUpSettings([])).toEqual({});
    expect(followUpSettings([assistant('a1')])).toEqual({});
  });
});
