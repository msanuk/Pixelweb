import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ExtHello, GuideResponse, GuideStreamMessage } from '@pixelweb/shared';
import { redactCapture } from '@pixelweb/shared/capture';
import type { PixelwebConfig } from '../config.js';
import type { GlobalEvent, OpencodeClient } from '../opencode/client.js';
import { followUpSettings } from '../opencode/followup.js';
import type { KnowledgeStore } from '../knowledge/store.js';
import type { ExtTokenStore } from './tokens.js';
import type { GuideRegistry } from './guides.js';
import { GUIDE_PERMISSION, GUIDE_SYSTEM_PROMPT, buildGuidePrompt, guideTitle, parseGuideRequest, sessionOfEvent } from './prompt.js';

export interface ExtDeps {
  version: string;
  opencode: OpencodeClient;
  /** read at request time: the project can change while PixelWeb runs */
  cfg: PixelwebConfig;
  tokens: ExtTokenStore;
  guides: GuideRegistry;
  knowledge: () => KnowledgeStore;
}

const NOT_A_GUIDE = '不是指导会话';
const errorText = (e: unknown) => String(e instanceof Error ? e.message : e);
const badGateway = (reply: FastifyReply, e: unknown) => reply.code(502).send({ error: errorText(e) });

/**
 * The browser extension's API (docs/cloud-guide.md). Two halves with different auth:
 * `/api/ext-tokens` is PixelWeb's own UI pairing a browser (cookie and Origin, like every other
 * route), `/api/ext/*` is the paired extension (Bearer token, see auth.ts). The token half only
 * reaches guide sessions: start one, ask it more, watch it, stop it. Approving its shell commands
 * stays in PixelWeb, so a leaked token can't run anything on this machine.
 */
export function registerExtRoutes(app: FastifyInstance, deps: ExtDeps): void {
  const { opencode, cfg, tokens, guides } = deps;

  // -- pairing, from 设置
  app.get('/api/ext-tokens', async () => tokens.list());
  app.post<{ Body: { name?: string } }>('/api/ext-tokens', async (req, reply) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (name.length > 40) return reply.code(400).send({ error: '名称太长（上限 40 字）' });
    return tokens.create(name || '浏览器插件');
  });
  app.delete<{ Params: { id: string } }>('/api/ext-tokens/:id', async (req, reply) => {
    if (!(await tokens.revoke(req.params.id))) return reply.code(404).send({ error: 'no such token' });
    return { ok: true };
  });

  // -- the extension
  app.get('/api/ext/hello', async (req): Promise<ExtHello> => ({
    version: deps.version,
    projectRoot: cfg.projectRoot,
    opencodeConnected: opencode.isConnected,
    device: req.extToken?.name ?? '',
  }));
  app.get('/api/ext/terms', async () => deps.knowledge().terms());

  app.post('/api/ext/guide', async (req, reply) => {
    const parsed = parseGuideRequest(req.body);
    if ('error' in parsed) return reply.code(400).send(parsed);
    if (!parsed.capture) return reply.code(400).send({ error: 'capture required' });
    const capture = redactCapture(parsed.capture);
    const directory = cfg.projectRoot; // a project switch mid-request must not split the session from its prompt
    try {
      const session = await opencode.createSession({ title: guideTitle(capture), permission: GUIDE_PERMISSION }, directory);
      await guides.add(session.id, directory);
      await opencode.promptAsync(
        session.id,
        {
          parts: [{ type: 'text', text: buildGuidePrompt({ ...parsed, capture }, { first: true, projectRoot: directory }) }],
          system: GUIDE_SYSTEM_PROMPT,
        },
        directory,
      );
      const res: GuideResponse = { sessionID: session.id, title: session.title };
      return res;
    } catch (e) {
      return badGateway(reply, e);
    }
  });

  app.post<{ Params: { id: string } }>('/api/ext/guide/:id/prompt', async (req, reply) => {
    const guide = guides.get(req.params.id);
    if (!guide) return reply.code(404).send({ error: NOT_A_GUIDE });
    const parsed = parseGuideRequest(req.body);
    if ('error' in parsed) return reply.code(400).send(parsed);
    if (!parsed.capture && !parsed.question) return reply.code(400).send({ error: 'capture or question required' });
    const capture = parsed.capture && redactCapture(parsed.capture);
    try {
      // same agent, model and prompt as before, so the provider's prompt cache still matches
      const inherited = await opencode
        .messages(req.params.id, guide.directory)
        .then(followUpSettings)
        .catch(() => ({}));
      const text = buildGuidePrompt({ ...parsed, capture }, { first: false });
      await opencode.promptAsync(req.params.id, { ...inherited, parts: [{ type: 'text', text }], system: GUIDE_SYSTEM_PROMPT }, guide.directory);
      return { ok: true };
    } catch (e) {
      return badGateway(reply, e);
    }
  });

  app.post<{ Params: { id: string } }>('/api/ext/guide/:id/abort', async (req, reply) => {
    const guide = guides.get(req.params.id);
    if (!guide) return reply.code(404).send({ error: NOT_A_GUIDE });
    try {
      await opencode.abortSession(req.params.id, guide.directory);
      return { ok: true };
    } catch (e) {
      return badGateway(reply, e);
    }
  });

  // -- one guide's events as SSE. The extension reads it with fetch (EventSource can't send the
  // token), so this is plain `data:` lines: a snapshot first, then that session's events live.
  const watchers = new Map<string, Set<(m: GuideStreamMessage) => void>>();
  opencode.on('event', (ev: GlobalEvent) => {
    const id = sessionOfEvent(ev.payload);
    const set = id ? watchers.get(id) : undefined;
    if (set) for (const send of set) send({ type: 'event', event: ev.payload });
  });
  opencode.on('status', (s: { connected: boolean }) => {
    for (const set of watchers.values()) for (const send of set) send({ type: 'opencode.status', connected: s.connected });
  });

  app.get<{ Params: { id: string } }>('/api/ext/guide/:id/events', async (req, reply) => {
    const id = req.params.id;
    const guide = guides.get(id);
    if (!guide) return reply.code(404).send({ error: NOT_A_GUIDE });
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no', // nginx in front must not hold the stream back
    });
    const write = (m: GuideStreamMessage) => {
      if (!res.destroyed && !res.writableEnded) res.write(`data: ${JSON.stringify(m)}\n\n`);
    };
    // events that land while the snapshot loads wait for it; replaying one the snapshot already
    // has is harmless, OpenCode's events carry whole messages and parts
    const early: GuideStreamMessage[] = [];
    let live = false;
    const send = (m: GuideStreamMessage) => (live ? write(m) : early.push(m));
    const set = watchers.get(id) ?? new Set();
    set.add(send);
    watchers.set(id, set);
    const ping = setInterval(() => !res.destroyed && res.write(': ping\n\n'), 20_000);
    req.raw.on('close', () => {
      clearInterval(ping);
      set.delete(send);
      if (!set.size) watchers.delete(id);
    });

    try {
      const [messages, status, permissions] = await Promise.all([
        opencode.messages(id, guide.directory),
        opencode.sessionStatus(guide.directory).catch(() => ({}) as Record<string, { type: string }>),
        opencode.listPermissions(guide.directory).catch(() => [] as unknown[]),
      ]);
      const state = status[id]?.type;
      write({
        type: 'snapshot',
        messages,
        busy: !!state && state !== 'idle',
        permissions: permissions.filter((p) => (p as { sessionID?: string })?.sessionID === id),
      });
      write({ type: 'opencode.status', connected: opencode.isConnected });
      live = true;
      for (const m of early.splice(0)) write(m);
    } catch (e) {
      write({ type: 'error', error: errorText(e) });
      res.end();
    }
  });
}
