import { describe, expect, it } from 'vitest';
import type { GuideStreamMessage, OcEvent, OcMessageWithParts } from '@pixelweb/shared';
import { applyStream, EMPTY, type Conversation } from '../src/lib/conversation';
import { sseParser } from '../src/lib/sse';

describe('sseParser', () => {
  it('yields each event data, across chunk boundaries and CRLF', () => {
    const out: string[] = [];
    const push = sseParser((d) => out.push(d));
    push('data: {"a":1}\n\n: ping\n\nda');
    push('ta: {"b":2}\r');
    push('\n\r\ndata: x\ndata: y\n\n');
    expect(out).toEqual(['{"a":1}', '{"b":2}', 'x\ny']);
  });
});

const user = (id: string, text: string): OcMessageWithParts => ({
  info: { id, sessionID: 's', role: 'user', time: { created: 1 } },
  parts: [{ id: `${id}-p`, sessionID: 's', messageID: id, type: 'text', text }],
});

const ev = (type: string, properties: Record<string, unknown>): GuideStreamMessage => ({ type: 'event', event: { type, properties } as OcEvent });

const run = (msgs: GuideStreamMessage[], from: Conversation = EMPTY) => msgs.reduce(applyStream, from);

describe('applyStream', () => {
  it('starts from the snapshot', () => {
    const c = run([
      {
        type: 'snapshot',
        messages: [user('m1', '问题')],
        busy: true,
        permissions: [{ id: 'per1', sessionID: 's', permission: 'bash', patterns: ['ls'], tool: { messageID: 'm2', callID: 'c' } }],
        model: { id: 'opencode/big-pickle', name: 'Big Pickle', image: false },
      },
    ]);
    expect(c.loaded).toBe(true);
    expect(c.model).toEqual({ id: 'opencode/big-pickle', name: 'Big Pickle', image: false });
    expect(c.busy).toBe(true);
    expect(c.messages).toHaveLength(1);
    expect(c.permissions[0]).toMatchObject({ id: 'per1', type: 'bash', pattern: ['ls'] });
  });

  it('streams a reply from message.part.delta, then takes the final part', () => {
    const part = { id: 'p1', sessionID: 's', messageID: 'm2', type: 'text', text: '' };
    let c = run([
      { type: 'snapshot', messages: [user('m1', '问题')], busy: true, permissions: [], model: null },
      ev('message.updated', { info: { id: 'm2', sessionID: 's', role: 'assistant', time: { created: 2 } } }),
      ev('message.part.updated', { part }),
      ev('message.part.delta', { sessionID: 's', messageID: 'm2', partID: 'p1', field: 'text', delta: '## 这页' }),
      ev('message.part.delta', { sessionID: 's', messageID: 'm2', partID: 'p1', field: 'text', delta: '在做什么' }),
    ]);
    expect((c.messages[1].parts[0] as { text: string }).text).toBe('## 这页在做什么');
    c = run([ev('message.part.updated', { part: { ...part, text: '## 这页在做什么\n建实例' } }), ev('session.status', { sessionID: 's', status: { type: 'idle' } })], c);
    expect((c.messages[1].parts[0] as { text: string }).text).toBe('## 这页在做什么\n建实例');
    expect(c.busy).toBe(false);
  });

  it('holds a part that arrives before its message', () => {
    const c = run([ev('message.part.updated', { part: { id: 'p1', sessionID: 's', messageID: 'm9', type: 'text', text: 'hi' } })]);
    expect(c.messages[0].info.id).toBe('m9');
    expect(c.messages[0].parts).toHaveLength(1);
  });

  it('tracks permission requests and their replies', () => {
    let c = run([ev('permission.asked', { id: 'per2', sessionID: 's', permission: 'bash', patterns: ['cat a'] })]);
    expect(c.permissions.map((p) => p.id)).toEqual(['per2']);
    c = run([ev('permission.replied', { sessionID: 's', requestID: 'per2', reply: 'once' })], c);
    expect(c.permissions).toEqual([]);
  });

  it('shows session errors but not a stopped reply', () => {
    expect(run([ev('session.error', { sessionID: 's', error: { name: 'ProviderAuthError', data: { message: 'bad key' } } })]).error).toBe('bad key');
    expect(run([ev('session.error', { sessionID: 's', error: { name: 'MessageAbortedError', data: {} } })]).error).toBeUndefined();
  });

  it('follows the OpenCode connection', () => {
    expect(run([{ type: 'opencode.status', connected: false }]).opencode).toBe(false);
  });
});
