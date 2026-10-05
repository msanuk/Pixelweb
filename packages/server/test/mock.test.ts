import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
// @ts-expect-error plain ESM script without types
import { createMockServer } from '../scripts/mock-opencode.mjs';

let base = '';
let server: import('node:http').Server;

beforeAll(async () => {
  server = createMockServer({ dir: '/tmp/mock-project' });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

const post = (p: string, body?: string) =>
  fetch(base + p, { method: 'POST', body, headers: { 'content-type': 'application/json' } });

/** Collect SSE payloads until `stop` is called. */
async function listen(): Promise<{ events: { type: string; properties: any; at: number }[]; stop: () => void }> {
  const ctl = new AbortController();
  const events: { type: string; properties: any; at: number }[] = [];
  const res = await fetch(base + '/global/event', { signal: ctl.signal });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const { payload } = JSON.parse(line.slice(5));
            events.push({ ...payload, at: Date.now() });
          }
        }
      }
    } catch {
      /* aborted */
    }
  })();
  return { events, stop: () => ctl.abort() };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('mock opencode server', () => {
  it('serves the seeded sessions', async () => {
    const res = await fetch(base + '/session');
    expect(res.status).toBe(200);
    const list = (await res.json()) as { id: string }[];
    expect(list.map((s) => s.id)).toContain('ses_1');
  });

  it('answers 404 for a prompt to an unknown session and stays alive', async () => {
    const res = await post('/session/ses_does_not_exist/prompt_async', JSON.stringify({ parts: [{ type: 'text', text: 'hi' }] }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
    // still alive
    expect((await fetch(base + '/global/health')).status).toBe(200);
  });

  it('answers 400 for a malformed JSON body and stays alive', async () => {
    const res = await post('/session/ses_1/prompt_async', '{not json');
    expect(res.status).toBe(400);
    expect((await fetch(base + '/global/health')).status).toBe(200);
  });

  it('stops streaming parts once a session is aborted', async () => {
    const { events, stop } = await listen();
    await sleep(50);
    const created = await post('/session', JSON.stringify({ title: 'abort me' }));
    const { id } = (await created.json()) as { id: string };
    await post(`/session/${id}/prompt_async`, JSON.stringify({ parts: [{ type: 'text', text: 'long '.repeat(40) }], system: '教学' }));
    await sleep(150); // some chunks have streamed
    const beforeAbort = events.filter((e) => e.type === 'message.part.updated' && e.properties.part?.sessionID === id).length;
    expect(beforeAbort).toBeGreaterThan(0);
    const abort = await post(`/session/${id}/abort`);
    expect(abort.status).toBe(200);
    await sleep(100); // let anything already in flight land
    const mark = Date.now();
    await sleep(400);
    stop();
    const late = events.filter((e) => e.at > mark && e.type === 'message.part.updated' && e.properties.part?.sessionID === id);
    expect(late).toEqual([]);
    // the session must end up idle, like real opencode after an abort
    expect(events.some((e) => e.type === 'session.idle' && e.properties.sessionID === id)).toBe(true);
    // and the stored assistant message is marked completed
    const msgs = (await (await fetch(`${base}/session/${id}/message`)).json()) as { info: { role: string; time: { completed?: number } } }[];
    expect(msgs.at(-1)?.info.time.completed).toBeTypeOf('number');
  });
});
