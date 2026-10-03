import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GuideStreamMessage, OcMessageWithParts, PageCapture } from '@pixelweb/shared';
import { MASK } from '@pixelweb/shared/capture';
import { registerAuth } from '../src/auth.js';
import type { PixelwebConfig } from '../src/config.js';
import type { OpencodeClient, PromptInput } from '../src/opencode/client.js';
import { ExtTokenStore } from '../src/ext/tokens.js';
import { GuideRegistry } from '../src/ext/guides.js';
import { GUIDE_PERMISSION, GUIDE_SYSTEM_PROMPT } from '../src/ext/prompt.js';
import { registerExtRoutes } from '../src/ext/routes.js';
import type { KnowledgeStore } from '../src/knowledge/store.js';

/** Just enough of OpencodeClient, recording what PixelWeb asks of it. */
class FakeOpencode extends EventEmitter {
  isConnected = true;
  calls: { op: string; id?: string; directory?: string; body?: unknown }[] = [];
  history: OcMessageWithParts[] = [];
  async createSession(body: unknown, directory?: string) {
    this.calls.push({ op: 'create', directory, body });
    return { id: 'ses_g1', title: (body as { title: string }).title };
  }
  async promptAsync(id: string, body: PromptInput, directory?: string) {
    this.calls.push({ op: 'prompt', id, directory, body });
  }
  async messages(id: string, directory?: string) {
    this.calls.push({ op: 'messages', id, directory });
    return this.history;
  }
  async sessionStatus() {
    return { ses_g1: { type: 'busy' } };
  }
  async listPermissions() {
    return [{ id: 'per_1', sessionID: 'ses_g1' }, { id: 'per_2', sessionID: 'ses_other' }];
  }
  async abortSession(id: string, directory?: string) {
    this.calls.push({ op: 'abort', id, directory });
  }
}

const capture: PageCapture = {
  url: 'https://ram.console.aliyun.com/users/new',
  title: '创建用户',
  vendor: 'aliyun',
  breadcrumbs: [],
  heading: '创建用户',
  fields: [{ ref: 'f1', label: 'AccessKey Secret', kind: 'text', value: 'q7Xk2Lp9Zr4Tw8Vn1Bm6Hc3Jd5Fg0Y' }],
  text: '',
  redactions: 0,
  capturedAt: 1,
};

let dir: string;
let app: FastifyInstance;
let oc: FakeOpencode;
let cfg: PixelwebConfig;
let auth: Record<string, string>;
let guides: GuideRegistry;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pixelweb-ext-routes-'));
  oc = new FakeOpencode();
  cfg = { projectRoot: '/srv/app', dataDir: dir } as PixelwebConfig;
  const tokens = new ExtTokenStore(dir);
  guides = new GuideRegistry(dir);
  const { token } = await tokens.create('Chrome');
  auth = { authorization: `Bearer ${token}`, origin: 'chrome-extension://abc', host: 'pixelweb.test' };
  app = Fastify();
  registerAuth(app, 'pw', tokens);
  const knowledge = { terms: () => [{ term: 'VPC', cardId: 'vpc' }] } as unknown as KnowledgeStore;
  registerExtRoutes(app, { version: 't', opencode: oc as unknown as OpencodeClient, cfg, tokens, guides, knowledge: () => knowledge });
  await app.ready();
});
afterEach(async () => {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
});

const post = (url: string, payload: unknown, headers = auth) => app.inject({ method: 'POST', url, headers, payload: payload as object });

describe('/api/ext', () => {
  it('says hello to a paired extension', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ext/hello', headers: auth });
    expect(res.json()).toEqual({ version: 't', projectRoot: '/srv/app', opencodeConnected: true, device: 'Chrome' });
    expect((await app.inject({ method: 'GET', url: '/api/ext/terms', headers: auth })).json()).toEqual([{ term: 'VPC', cardId: 'vpc' }]);
  });

  it('starts a read-only guide session in the current project, with the page redacted', async () => {
    const res = await post('/api/ext/guide', { capture, question: '怎么填' });
    expect(res.json()).toEqual({ sessionID: 'ses_g1', title: '🧭 阿里云 创建用户' });
    const [create, prompt] = oc.calls;
    expect(create).toMatchObject({ op: 'create', directory: '/srv/app', body: { permission: GUIDE_PERMISSION } });
    expect(prompt).toMatchObject({ op: 'prompt', id: 'ses_g1', directory: '/srv/app', body: { system: GUIDE_SYSTEM_PROMPT } });
    const text = (prompt.body as PromptInput).parts[0].text;
    expect(text).toContain(`AccessKey Secret（文本）当前值：${MASK}`);
    expect(text).not.toContain('q7Xk2Lp9');
    expect(guides.get('ses_g1')?.directory).toBe('/srv/app');
  });

  it('needs a capture to start, and a capture or question to continue', async () => {
    expect((await post('/api/ext/guide', { question: 'hi' })).statusCode).toBe(400);
    await post('/api/ext/guide', { capture });
    expect((await post('/api/ext/guide/ses_g1/prompt', {})).statusCode).toBe(400);
  });

  it("continues a guide in its own project, repeating the last turn's settings", async () => {
    await post('/api/ext/guide', { capture });
    cfg.projectRoot = '/srv/other'; // the UI switched projects since
    oc.history = [
      { info: { id: 'm1', sessionID: 'ses_g1', role: 'user', time: { created: 1 }, agent: 'build', model: { providerID: 'p', modelID: 'm' } }, parts: [] },
    ] as OcMessageWithParts[];
    oc.calls = [];
    expect((await post('/api/ext/guide/ses_g1/prompt', { question: '那带宽呢？' })).json()).toEqual({ ok: true });
    const prompt = oc.calls.find((c) => c.op === 'prompt')!;
    expect(prompt.directory).toBe('/srv/app');
    expect(prompt.body).toEqual({ agent: 'build', model: { providerID: 'p', modelID: 'm' }, parts: [{ type: 'text', text: '那带宽呢？' }], system: GUIDE_SYSTEM_PROMPT });
    expect((await post('/api/ext/guide/ses_g1/abort', {})).json()).toEqual({ ok: true });
    expect(oc.calls.at(-1)).toEqual({ op: 'abort', id: 'ses_g1', directory: '/srv/app' });
  });

  it("won't touch sessions it didn't start", async () => {
    expect((await post('/api/ext/guide/ses_coding/prompt', { question: 'rm -rf' })).statusCode).toBe(404);
    expect((await post('/api/ext/guide/ses_coding/abort', {})).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/ext/guide/ses_coding/events', headers: auth })).statusCode).toBe(404);
    expect(oc.calls).toEqual([]);
  });

  it('pairs and unpairs from PixelWeb itself, not with a token', async () => {
    const own = { host: 'pixelweb.test', origin: 'http://pixelweb.test' };
    expect((await post('/api/ext-tokens', { name: 'x' }, auth)).statusCode).toBe(403);
    expect((await post('/api/ext-tokens', { name: 'x' }, own)).statusCode).toBe(401); // --password set, no login cookie
  });
});

describe('guide event stream', () => {
  it('sends a snapshot, then only this session’s events', async () => {
    await post('/api/ext/guide', { capture });
    oc.history = [{ info: { id: 'm1', sessionID: 'ses_g1', role: 'user', time: { created: 1 } }, parts: [] }] as OcMessageWithParts[];
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as { port: number };
    const abort = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/ext/guide/ses_g1/events`, { headers: { authorization: auth.authorization }, signal: abort.signal });
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const got: GuideStreamMessage[] = [];
    let buf = '';
    const next = async () => {
      while (!buf.includes('\n\n')) buf += new TextDecoder().decode((await reader.read()).value);
      const i = buf.indexOf('\n\n');
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      got.push(JSON.parse(frame.replace(/^data: /, '')));
    };
    await next();
    await next();
    expect(got[0]).toEqual({ type: 'snapshot', messages: oc.history, busy: true, permissions: [{ id: 'per_1', sessionID: 'ses_g1' }] });
    expect(got[1]).toEqual({ type: 'opencode.status', connected: true });

    const mine = { type: 'message.part.updated', properties: { part: { id: 'p1', sessionID: 'ses_g1', type: 'text', text: '这页' } } };
    oc.emit('event', { directory: '/srv/app', payload: { type: 'session.status', properties: { sessionID: 'ses_other', status: { type: 'busy' } } } });
    oc.emit('event', { directory: '/srv/app', payload: mine });
    await next();
    expect(got[2]).toEqual({ type: 'event', event: mine });
    abort.abort();
  });
});
