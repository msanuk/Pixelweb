import { describe, expect, it } from 'vitest';
import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { summarizeSession } from '../src/lib/summary';
import { buildMatcher } from '../src/lib/terms';

const matcher = buildMatcher([
  { term: 'SSE', cardId: 'sse' },
  { term: 'token', cardId: 'token' },
  { term: 'commit', cardId: 'commit' },
]);
const text = (t: string, synthetic = false) => ({ id: t, sessionID: 's', messageID: 'm', type: 'text', text: t, synthetic }) as OcPart;
const tool = (name: string, input: Record<string, unknown>, status: 'completed' | 'error' = 'completed') =>
  ({
    id: name + Math.random(),
    sessionID: 's',
    messageID: 'm',
    type: 'tool',
    callID: 'c',
    tool: name,
    state: status === 'completed' ? { status, input, output: '', title: '', metadata: {}, time: { start: 0, end: 1 } } : { status, input, error: 'x', time: { start: 0, end: 1 } },
  }) as OcPart;
const msg = (role: 'user' | 'assistant', parts: OcPart[], cost = 0) => ({ info: { role, cost } as OcMessageWithParts['info'], parts }) as OcMessageWithParts;

describe('summarizeSession', () => {
  const messages = [
    msg('user', [text('token 过期时不跳转')]),
    msg(
      'assistant',
      [
        text('用 SSE 推送；token 过期后跳转。'),
        text('SSE should not count here', true),
        tool('bash', { command: 'npm test' }, 'error'),
        tool('edit', { filePath: '/repo/src/auth.ts' }),
        tool('read', { filePath: '/repo/src/router.ts' }),
      ],
      0.01,
    ),
    msg('user', [text('提交吧')]),
    msg('assistant', [tool('bash', { command: 'git commit -m x' }), text('已 commit。')], 0.002),
  ];

  it('counts turns, tool calls, failures, edited files and cost', () => {
    const s = summarizeSession(messages, matcher, '/repo');
    expect(s).toMatchObject({ turns: 2, toolCalls: 4, toolErrors: 1, edited: ['src/auth.ts'] });
    expect(s.cost).toBeCloseTo(0.012);
  });

  it('collects concepts from the text and from the tools used, most frequent first', () => {
    const s = summarizeSession(messages, matcher, '/repo');
    expect(s.concepts).toEqual([
      { cardId: 'token', count: 2 },
      { cardId: 'tool-bash', count: 2 },
      { cardId: 'tool-read-edit', count: 2 },
      { cardId: 'commit', count: 1 },
      { cardId: 'sse', count: 1 },
    ]);
  });
});
