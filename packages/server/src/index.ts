#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import os from 'node:os';
import type { ClientMessage, CommitLink, ExplainRequest, ExplainResponse, ModelInfo, OcPart, PermissionResponse, ProjectOption, ServerInfo, ServerMessage } from '@pixelweb/shared';
import { loadConfig, printUsage } from './config.js';
import { OpencodeClient, type GlobalEvent } from './opencode/client.js';
import { toModelInfo } from './opencode/models.js';
import { followUpSettings } from './opencode/followup.js';
import { Hub } from './ws.js';
import { registerAuth } from './auth.js';
import { GitService } from './git/service.js';
import { CommitIndex, resolveLinks } from './activity/commits.js';
import { analyseProject } from './analysis/deps.js';
import { KnowledgeStore } from './knowledge/store.js';
import { LearningStore } from './knowledge/learning.js';
import { belongsTo, samePath, toProjectOptions } from './project.js';
import { TEACHING_SYSTEM_PROMPT, TEACHING_TOOLS, buildExplainPrompt, teachingSessionTitle } from './knowledge/explain.js';

const VERSION = '0.1.0';
const here = path.dirname(fileURLToPath(import.meta.url));
// dist/index.js → package root is one up; src/index.ts (tsx) → also one up.
const PKG_ROOT = path.resolve(here, '..');
const REPO_ROOT = path.resolve(PKG_ROOT, '..', '..');

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }
  const cfg = loadConfig();

  // ---- services --------------------------------------------------------------
  const hub = new Hub();
  const opencode = new OpencodeClient({
    baseUrl: cfg.opencodeUrl,
    username: cfg.opencodeUsername,
    password: cfg.opencodePassword,
    directory: cfg.projectRoot,
    verbose: cfg.verbose,
  });
  // Everything scoped to the project is `let`: the UI can switch projects at runtime (switchProject below).
  let gitSvc = new GitService(cfg.projectRoot);
  const knowledgeDirs = (root: string) => [
    path.join(REPO_ROOT, 'knowledge'),
    path.join(cfg.dataDir, 'knowledge'), // user-authored overrides
    path.join(root, '.pixelweb', 'knowledge'), // project-specific cards
  ];
  let knowledge = new KnowledgeStore(knowledgeDirs(cfg.projectRoot));
  const learning = new LearningStore(cfg.dataDir);
  const teachingSessions = new Set<string>();
  let archCache: Awaited<ReturnType<typeof analyseProject>> | null = null;
  let archLevel: 'file' | 'dir' = 'dir';

  let commitIndex = new CommitIndex();
  let commitLinks: CommitLink[] = [];

  await Promise.all([knowledge.load(), learning.load()]);

  /** Re-resolves agent commits against the current log; broadcasts only when something changed. */
  const publishCommits = () => {
    const next = resolveLinks(commitIndex.list(), gitSvc.current?.commits ?? []);
    if (JSON.stringify(next) === JSON.stringify(commitLinks)) return;
    commitLinks = next;
    hub.broadcast({ type: 'activity.commits', links: commitLinks });
  };
  /** Commits made before PixelWeb started: scan the most recent sessions once OpenCode is reachable. */
  const backfillCommits = async () => {
    const index = commitIndex;
    const sessions = (await opencode.listSessions()).sort((a, b) => b.time.updated - a.time.updated).slice(0, 40);
    for (let i = 0; i < sessions.length; i += 4) {
      const batch = await Promise.all(sessions.slice(i, i + 4).map((s) => opencode.messages(s.id).catch(() => [])));
      for (const msgs of batch) index.addMessages(msgs);
    }
    if (index === commitIndex) publishCommits(); // else the project changed mid-scan
  };

  const refreshArch = async (level = archLevel) => {
    archLevel = level;
    const root = cfg.projectRoot;
    const graph = await analyseProject(root, { level });
    if (root !== cfg.projectRoot) return graph; // the project changed mid-scan: don't show the old one
    archCache = graph;
    hub.broadcast({ type: 'arch.graph', graph });
    return graph;
  };

  const startGit = (svc: GitService) => {
    svc.on('snapshot', (snapshot) => {
      hub.broadcast({ type: 'git.snapshot', snapshot });
      publishCommits(); // a new commit may pin a link that had no hash yet
    });
    svc.on('error', (e) => console.warn('[pixelweb] git:', e instanceof Error ? e.message : e));
    void svc.refresh().then(() => svc.watch()).catch((e) => console.warn('[pixelweb] git init:', e?.message ?? e));
  };

  const hello = (): ServerMessage => ({ type: 'hello', server: { version: VERSION, opencodeUrl: cfg.opencodeUrl, projectRoot: cfg.projectRoot } });
  // model limits can come from a project's opencode.json, so they're cached per project
  let modelsCache: { at: number; info: ModelInfo } | null = null;

  /** Points every project-scoped service at `dir`; the UI sees a `hello` with the new root and reloads. */
  const switchProject = async (dir: string) => {
    gitSvc.removeAllListeners();
    await gitSvc.close();
    cfg.projectRoot = dir;
    visited.add(dir);
    opencode.setDirectory(dir);
    modelsCache = null;
    archCache = null;
    commitIndex = new CommitIndex();
    commitLinks = [];
    const next = new KnowledgeStore(knowledgeDirs(dir));
    await next.load();
    knowledge = next;
    gitSvc = new GitService(dir);
    hub.broadcast(hello());
    hub.broadcast({ type: 'activity.commits', links: commitLinks });
    startGit(gitSvc);
    void refreshArch().catch((e) => console.warn('[pixelweb] arch:', e?.message ?? e));
    if (opencode.isConnected) void backfillCommits().catch((e) => console.warn('[pixelweb] commit backfill:', e?.message ?? e));
    console.log(`[pixelweb] project: ${dir}`);
  };
  let switching: Promise<void> = Promise.resolve();
  /** Projects shown this run, so the startup one stays in the picker even if OpenCode never opened it. */
  const visited = new Set([cfg.projectRoot]);

  // ---- wiring ----------------------------------------------------------------
  let wasConnected = false;
  opencode.on('status', (s: { connected: boolean; error?: string }) => {
    hub.broadcast({ type: 'opencode.status', ...s });
    if (s.connected && !wasConnected) void backfillCommits().catch((e) => console.warn('[pixelweb] commit backfill:', e?.message ?? e));
    wasConnected = s.connected;
    if (s.connected) console.log(`[pixelweb] connected to opencode at ${cfg.opencodeUrl}`);
    else if (s.error) console.log(`[pixelweb] opencode unreachable (${s.error}); retrying…`);
  });
  opencode.on('event', (ev: GlobalEvent) => {
    // /global/event carries every project OpenCode has open; only the visualised one is ours
    if (!belongsTo(ev.directory, cfg.projectRoot)) return;
    hub.broadcast({ type: 'opencode.event', event: ev.payload, directory: ev.directory, receivedAt: Date.now() });
    const t = ev.payload.type;
    if (t === 'message.part.updated' && commitIndex.addPart((ev.payload.properties as { part: OcPart }).part)) publishCommits();
    if (t === 'file.edited' || t === 'file.watcher.updated' || t === 'session.idle' || t === 'vcs.branch.updated') {
      gitSvc.scheduleRefresh(400);
    }
    if (t === 'session.idle' || t === 'file.edited') {
      clearTimeout(archTimer);
      archTimer = setTimeout(() => void refreshArch().catch(() => {}), 1500);
    }
  });
  let archTimer: NodeJS.Timeout | undefined;

  // ---- http -------------------------------------------------------------------
  const app = Fastify({ logger: false });
  // No CORS: the UI is same-origin (vite proxies in dev), and allowing other origins would let any website drive the agent.
  registerAuth(app, cfg.password);
  await app.register(websocket);

  const publicDir = path.join(PKG_ROOT, 'public');
  const hasUi = fs.existsSync(path.join(publicDir, 'index.html'));
  if (hasUi) {
    await app.register(fastifyStatic, { root: publicDir, prefix: '/' }); // wildcard: files resolved per request, so a rebuild needs no restart
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api') || req.raw.url?.startsWith('/ws')) return reply.code(404).send({ error: 'not found' });
      return reply.sendFile('index.html');
    });
  }

  app.get('/ws', { websocket: true }, (socket) => {
    hub.add(socket, (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.type === 'git.refresh') void gitSvc.refresh().catch(() => {});
      if (msg.type === 'arch.refresh') void refreshArch(msg.level ?? archLevel).catch(() => {});
    });
    const send = (m: ServerMessage) => hub.send(socket, m);
    send(hello());
    send({ type: 'opencode.status', connected: opencode.isConnected });
    if (gitSvc.current) send({ type: 'git.snapshot', snapshot: gitSvc.current });
    if (archCache) send({ type: 'arch.graph', graph: archCache });
    send({ type: 'learning.state', state: learning.get() });
    send({ type: 'activity.commits', links: commitLinks });
  });

  app.get('/api/info', async (): Promise<ServerInfo> => ({
    version: VERSION,
    opencodeUrl: cfg.opencodeUrl,
    projectRoot: cfg.projectRoot,
    opencodeConnected: opencode.isConnected,
    teachingSessions: [...teachingSessions],
  }));

  // -- opencode proxy (the UI never talks to opencode directly: one origin, one auth)
  app.get('/api/sessions', async (_req, reply) => {
    try {
      const sessions = await opencode.listSessions();
      return sessions.sort((a, b) => b.time.updated - a.time.updated);
    } catch (e) {
      return reply.code(502).send({ error: String(e instanceof Error ? e.message : e) });
    }
  });
  app.get<{ Params: { id: string } }>('/api/sessions/:id/messages', async (req, reply) => {
    try {
      return await opencode.messages(req.params.id);
    } catch (e) {
      return reply.code(502).send({ error: String(e instanceof Error ? e.message : e) });
    }
  });
  // model token limits for the context meter; they rarely change, so cache briefly
  app.get('/api/models', async (_req, reply) => {
    if (modelsCache && Date.now() - modelsCache.at < 5 * 60_000) return modelsCache.info;
    try {
      const [providers, config] = await Promise.all([opencode.providers(), opencode.config().catch(() => ({}))]);
      modelsCache = { at: Date.now(), info: toModelInfo(providers, config) };
      return modelsCache.info;
    } catch (e) {
      return reply.code(502).send({ error: String(e instanceof Error ? e.message : e) });
    }
  });
  app.post<{ Params: { id: string } }>('/api/sessions/:id/abort', async (req, reply) => {
    try {
      return await opencode.abortSession(req.params.id);
    } catch (e) {
      return reply.code(502).send({ error: String(e instanceof Error ? e.message : e) });
    }
  });
  app.get('/api/permissions', async (_req, reply) => {
    try {
      return await opencode.listPermissions();
    } catch (e) {
      return reply.code(502).send({ error: String(e instanceof Error ? e.message : e) });
    }
  });
  app.post<{ Params: { id: string; permissionID: string }; Body: { response: PermissionResponse } }>(
    '/api/sessions/:id/permissions/:permissionID',
    async (req, reply) => {
      const response = req.body?.response;
      if (response !== 'once' && response !== 'always' && response !== 'reject') {
        return reply.code(400).send({ error: 'response must be once | always | reject' });
      }
      try {
        return { ok: await opencode.replyPermission(req.params.id, req.params.permissionID, response) };
      } catch (e) {
        return reply.code(502).send({ error: String(e instanceof Error ? e.message : e) });
      }
    },
  );
  app.post<{ Params: { id: string }; Body: { text: string } }>('/api/sessions/:id/prompt', async (req, reply) => {
    const text = req.body?.text?.trim();
    if (!text) return reply.code(400).send({ error: 'text required' });
    try {
      // keep the session's agent, model and prompt so the provider's prompt cache still matches
      const inherited = await opencode
        .messages(req.params.id)
        .then(followUpSettings)
        .catch(() => ({}));
      await opencode.promptAsync(req.params.id, {
        ...inherited,
        parts: [{ type: 'text', text }],
        ...(teachingSessions.has(req.params.id) ? { system: TEACHING_SYSTEM_PROMPT, tools: TEACHING_TOOLS } : {}),
      });
      return { ok: true };
    } catch (e) {
      return reply.code(502).send({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // -- projects: OpenCode serves many; PixelWeb visualises one at a time
  app.get('/api/projects', async (): Promise<ProjectOption[]> => {
    const projects = await opencode.listProjects().catch(() => []);
    return toProjectOptions([...projects, ...[...visited].map((worktree) => ({ worktree }))], cfg.projectRoot);
  });
  app.post<{ Body: { dir?: string } }>('/api/project', async (req, reply) => {
    const raw = typeof req.body?.dir === 'string' ? req.body.dir.trim() : '';
    if (!raw) return reply.code(400).send({ error: 'dir required' });
    const dir = path.resolve(raw.replace(/^~(?=$|[\\/])/, os.homedir()));
    const stat = await fs.promises.stat(dir).catch(() => null);
    if (!stat?.isDirectory()) return reply.code(400).send({ error: `找不到这个目录：${dir}` });
    // serialised, so two quick clicks can't interleave their teardown and setup
    switching = switching.catch(() => {}).then(() => (samePath(dir, cfg.projectRoot) ? undefined : switchProject(dir)));
    await switching;
    return { projectRoot: cfg.projectRoot };
  });

  // -- git / architecture
  app.get('/api/git', async () => gitSvc.current ?? (await gitSvc.refresh()));
  app.get<{ Querystring: { path?: string } }>('/api/git/diff', async (req, reply) => {
    if (!req.query.path) return reply.code(400).send({ error: 'path required' });
    try {
      const diff = await gitSvc.diff(req.query.path);
      if (diff === null) return reply.code(404).send({ error: 'not a changed file' });
      return { path: req.query.path, diff };
    } catch (e) {
      return reply.code(500).send({ error: String(e instanceof Error ? e.message : e) });
    }
  });
  app.get<{ Querystring: { level?: 'file' | 'dir'; refresh?: string } }>('/api/arch', async (req) => {
    const level = req.query.level ?? archLevel;
    if (archCache && level === archLevel && !req.query.refresh) return archCache;
    return refreshArch(level);
  });

  // -- knowledge
  app.get('/api/knowledge', async () => knowledge.index());
  app.get('/api/knowledge/terms', async () => knowledge.terms());
  app.get<{ Querystring: { q?: string } }>('/api/knowledge/search', async (req) => knowledge.search(req.query.q ?? ''));
  app.get<{ Params: { id: string } }>('/api/knowledge/:id', async (req, reply) => {
    const card = knowledge.get(req.params.id) ?? knowledge.find(req.params.id);
    if (!card) return reply.code(404).send({ error: 'no such card' });
    return card;
  });
  app.get<{ Params: { tool: string } }>('/api/knowledge/tool/:tool', async (req, reply) => {
    const card = knowledge.forTool(req.params.tool);
    if (!card) return reply.code(404).send({ error: 'no card for tool' });
    return card;
  });
  app.post('/api/knowledge/reload', async () => {
    await knowledge.load();
    return { count: knowledge.all().length, errors: knowledge.errors };
  });

  // -- learning records
  const broadcastLearning = (state: ReturnType<typeof learning.get>) => {
    hub.broadcast({ type: 'learning.state', state });
    return state;
  };
  app.get('/api/learning', async () => learning.get());
  app.post<{ Body: { cardId: string } }>('/api/learning/seen', async (req) => broadcastLearning(await learning.markSeen(req.body.cardId)));
  app.post<{ Body: { cardId: string; correct: boolean } }>('/api/learning/quiz', async (req) =>
    broadcastLearning(await learning.recordQuiz(req.body.cardId, !!req.body.correct)),
  );
  app.post<{ Body: { cardId: string; mastery: 'seen' | 'learning' | 'mastered' } }>('/api/learning/mastery', async (req) =>
    broadcastLearning(await learning.setMastery(req.body.cardId, req.body.mastery)),
  );
  app.post<{ Body: { cardId: string; notes: string } }>('/api/learning/notes', async (req, reply) => {
    const { cardId, notes } = req.body ?? {};
    if (typeof cardId !== 'string' || !cardId || typeof notes !== 'string') return reply.code(400).send({ error: 'cardId and notes required' });
    if (notes.length > 20_000) return reply.code(413).send({ error: '笔记太长（上限 2 万字）' });
    return broadcastLearning(await learning.setNotes(cardId, notes));
  });

  // -- explain via a fresh opencode session
  app.post<{ Body: ExplainRequest }>('/api/explain', async (req, reply) => {
    const body = req.body ?? ({} as ExplainRequest);
    if (!body.term?.trim()) return reply.code(400).send({ error: 'term required' });
    const card = body.cardId ? knowledge.get(body.cardId) : knowledge.find(body.term);
    try {
      const session = await opencode.createSession({ title: teachingSessionTitle(body.term) });
      teachingSessions.add(session.id);
      await opencode.promptAsync(session.id, {
        parts: [{ type: 'text', text: buildExplainPrompt(body, card, cfg.projectRoot) }],
        system: TEACHING_SYSTEM_PROMPT,
        tools: TEACHING_TOOLS,
        ...(body.model ? { model: body.model } : {}),
      });
      if (card) void learning.markSeen(card.id).then(broadcastLearning);
      const res: ExplainResponse = { sessionID: session.id, title: session.title };
      return res;
    } catch (e) {
      return reply.code(502).send({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // ---- start -------------------------------------------------------------------
  await app.listen({ port: cfg.port, host: cfg.host });
  console.log(`[pixelweb] v${VERSION} listening on http://${cfg.host}:${cfg.port}${hasUi ? '' : '  (UI not built; run `npm run dev:web` or `npm run build`)'}`);
  console.log(`[pixelweb] project: ${cfg.projectRoot}`);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(cfg.host);
  if (cfg.password) console.log('[pixelweb] login required (--password)');
  if (!loopback && !cfg.password) {
    console.warn(`[pixelweb] WARNING: listening on ${cfg.host} without --password — anyone who can reach this port can prompt the agent and approve its shell commands.`);
  }
  if (!loopback && cfg.password) {
    console.log('[pixelweb] note: plain HTTP sends the password and session cookie unencrypted; put PixelWeb behind HTTPS or an SSH tunnel on untrusted networks.');
  }
  console.log(`[pixelweb] knowledge cards: ${knowledge.all().length}`);

  opencode.start();
  startGit(gitSvc);
  void refreshArch().catch((e) => console.warn('[pixelweb] arch init:', e?.message ?? e));

  const shutdown = async () => {
    opencode.stop();
    await gitSvc.close();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
