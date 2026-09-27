// Minimal stand-in for `opencode serve`, for developing the UI without a real agent.
// Usage: npm run dev:mock   (serves on 4096; PORT / DIR env override)
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const PORT = Number(process.env.PORT ?? 4096);
const dir = process.env.DIR ?? process.cwd();
const now = () => Date.now();
const sessions = [
  { id: 'ses_1', projectID: 'p', directory: dir, title: '修复登录页 bug', version: '1', time: { created: now() - 60000, updated: now() - 1000 }, summary: { additions: 12, deletions: 3, files: 2 } },
  { id: 'ses_2', projectID: 'p', directory: dir, parentID: 'ses_1', title: '子任务：搜索相关文件', version: '1', time: { created: now() - 50000, updated: now() - 20000 } },
];
const messages = {
  ses_1: [
    { info: { id: 'm1', sessionID: 'ses_1', role: 'user', time: { created: now() - 60000 }, agent: 'build', model: { providerID: 'anthropic', modelID: 'claude' } },
      parts: [{ id: 'p1', sessionID: 'ses_1', messageID: 'm1', type: 'text', text: '请修复登录页在 token 过期时不跳转的问题，并跑测试。' }] },
    { info: { id: 'm2', sessionID: 'ses_1', role: 'assistant', time: { created: now() - 59000, completed: now() - 30000 }, parentID: 'm1', modelID: 'claude-sonnet-4', providerID: 'anthropic', mode: 'build', cost: 0.0123, tokens: { input: 12400, output: 820, reasoning: 0, cache: { read: 131000, write: 0 } } },
      parts: [
        { id: 'p2', sessionID: 'ses_1', messageID: 'm2', type: 'step-start' },
        { id: 'p3', sessionID: 'ses_1', messageID: 'm2', type: 'reasoning', text: '先用 grep 找到处理 token 过期的地方，再看 webhook 回调。', time: { start: 1, end: 2 } },
        { id: 'p4', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c1', tool: 'grep', state: { status: 'completed', input: { pattern: 'tokenExpired', path: 'src' }, output: 'src/auth.ts:42: if (tokenExpired) {', title: 'grep tokenExpired', metadata: {}, time: { start: now() - 58000, end: now() - 57000 } } },
        { id: 'p5', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c2', tool: 'edit', state: { status: 'completed', input: { filePath: 'src/auth.ts', oldString: 'if (tokenExpired) {', newString: 'if (tokenExpired) { router.push("/login");' }, output: 'ok', title: 'edit src/auth.ts', metadata: {}, time: { start: now() - 56000, end: now() - 55000 } } },
        { id: 'p5b', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c2b', tool: 'edit', state: { status: 'completed', input: { filePath: 'src/router.ts', oldString: '', newString: '' }, output: 'ok', title: 'edit src/router.ts', metadata: { diff: 'Index: src/router.ts\n===================================================================\n--- src/router.ts\n+++ src/router.ts\n@@ -10,7 +10,9 @@\n export function guard(to: Route) {\n-  if (!session.valid) return;\n+  if (!session.valid) {\n+    return redirect(\'/login\');\n+  }\n   return next(to);\n }\n' }, time: { start: now() - 55500, end: now() - 55200 } } },
        { id: 'p6', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c3', tool: 'bash', state: { status: 'error', input: { command: 'npm test' }, error: 'FAIL src/auth.test.ts', time: { start: now() - 54000, end: now() - 50000 } } },
        { id: 'p7', sessionID: 'ses_1', messageID: 'm2', type: 'text', text: '我通过 **grep** 定位到 `src/auth.ts`，用 edit 加了跳转。测试失败，是因为 SSE 连接的 mock 没更新，这涉及 context window 之外的信息，需要再看一次 commit 历史。' },
        { id: 'p8', sessionID: 'ses_1', messageID: 'm2', type: 'step-finish', reason: 'tool-calls', cost: 0.0123, tokens: { input: 12400, output: 820, reasoning: 0, cache: { read: 131000, write: 0 } } },
      ] },
  ],
  ses_2: [],
};

// A session that read and edited real files of this repo and committed them, so the
// architecture-graph highlight and the git ↔ session links have something to show.
try {
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  const top = git('rev-parse', '--show-toplevel');
  const [short, subject, at] = git('log', '-1', '--format=%h%x1f%s%x1f%at').split('\u001f');
  const t = Number(at) * 1000;
  const f = (rel) => path.join(top, rel);
  const tool = (id, name, input, output, start, end = start + 800) => ({ id, sessionID: 'ses_3', messageID: 'm32', type: 'tool', callID: id, tool: name, state: { status: 'completed', input, output, title: name, metadata: {}, time: { start, end } } });
  sessions.push({ id: 'ses_3', projectID: 'p', directory: dir, title: '提交最近的改动', version: '1', time: { created: t - 60000, updated: t + 2000 } });
  messages.ses_3 = [
    { info: { id: 'm31', sessionID: 'ses_3', role: 'user', time: { created: t - 60000 }, agent: 'build', model: { providerID: 'anthropic', modelID: 'claude' } },
      parts: [{ id: 'p31', sessionID: 'ses_3', messageID: 'm31', type: 'text', text: '把刚才的改动整理一下提交。' }] },
    { info: { id: 'm32', sessionID: 'ses_3', role: 'assistant', time: { created: t - 59000, completed: t + 2000 }, parentID: 'm31', modelID: 'claude-sonnet-4', providerID: 'anthropic', mode: 'build', cost: 0.004, tokens: { input: 2100, output: 300, reasoning: 0, cache: { read: 0, write: 0 } } },
      parts: [
        tool('p32', 'read', { filePath: f('packages/server/src/index.ts') }, '…', t - 50000),
        tool('p33', 'read', { filePath: f('packages/web/src/panels/ArchGraph.tsx') }, '…', t - 45000),
        tool('p34', 'edit', { filePath: f('packages/web/src/lib/api.ts'), oldString: 'a', newString: 'b' }, 'ok', t - 40000),
        tool('p35', 'bash', { command: `git add -A && git commit -m "${subject.replace(/"/g, "'")}"` }, `[main ${short}] ${subject}\n 3 files changed`, t - 500, t + 500),
        { id: 'p36', sessionID: 'ses_3', messageID: 'm32', type: 'text', text: `已提交 ${short}。` },
      ] },
  ];
} catch { /* not a git checkout: skip the sample */ }
const clients = new Set();
const emit = (payload) => { const data = `data: ${JSON.stringify({ directory: dir, payload })}\n\n`; for (const c of clients) c.write(data); };
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
let counter = 10;
const pendingPermissions = new Map(); // requestID -> { request, resume(reply) }
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(JSON.parse(b || '{}'))); });
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (p === '/global/event' || p === '/event') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ directory: dir, payload: { type: 'server.connected', properties: {} } })}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (p === '/global/health') return json(res, 200, { healthy: true, version: 'mock' });
  if (p === '/path') return json(res, 200, { state: '', config: '', worktree: dir, directory: dir });
  if (p === '/config/providers') return json(res, 200, { default: { anthropic: 'claude-sonnet-4' }, providers: [{ id: 'anthropic', name: 'Anthropic', models: { 'claude-sonnet-4': { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', limit: { context: 200000, output: 64000 } } } }] });
  if (p === '/config') return json(res, 200, { compaction: { auto: true } });
  if (p === '/session' && req.method === 'GET') return json(res, 200, sessions);
  if (p === '/session' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      const b = JSON.parse(body || '{}'); const s = { id: 'ses_' + counter++, projectID: 'p', directory: dir, title: b.title ?? 'new', version: '1', time: { created: now(), updated: now() } };
      sessions.unshift(s); messages[s.id] = []; emit({ type: 'session.created', properties: { info: s } }); json(res, 200, s); }); return;
  }
  // permissions, OpenCode 1.x style: GET /permission, POST /permission/:id/reply { reply }; plus the deprecated per-session route
  if (p === '/permission' && req.method === 'GET') return json(res, 200, [...pendingPermissions.values()].map((x) => x.request));
  const pm = /^\/permission\/([^/]+)\/reply$/.exec(p) ?? /^\/session\/[^/]+\/permissions\/([^/]+)$/.exec(p);
  if (pm && req.method === 'POST') {
    const [, requestID] = pm;
    readBody(req).then((b) => {
      const pending = pendingPermissions.get(requestID);
      if (!pending) return json(res, 404, { error: 'no such permission' });
      const reply = b.reply ?? b.response;
      pendingPermissions.delete(requestID);
      emit({ type: 'permission.replied', properties: { sessionID: pending.request.sessionID, requestID, reply } });
      pending.resume(reply);
      json(res, 200, true);
    });
    return;
  }
  const m = /^\/session\/([^/]+)\/(message|prompt_async|abort)$/.exec(p);
  if (m) {
    const [, id, op] = m;
    if (op === 'message' && req.method === 'GET') return json(res, 200, messages[id] ?? []);
    if (op === 'abort') return json(res, 200, true);
    if (op === 'prompt_async' || op === 'message') {
      let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
        const b = JSON.parse(body || '{}'); const text = b.parts?.[0]?.text ?? '';
        const um = { id: 'm' + counter++, sessionID: id, role: 'user', time: { created: now() } };
        messages[id].push({ info: um, parts: [{ id: 'p' + counter++, sessionID: id, messageID: um.id, type: 'text', text }] });
        emit({ type: 'message.updated', properties: { info: um } });
        emit({ type: 'message.part.updated', properties: { part: messages[id].at(-1).parts[0] } });
        emit({ type: 'session.status', properties: { sessionID: id, status: { type: 'busy' } } });
        const am = { id: 'm' + counter++, sessionID: id, role: 'assistant', time: { created: now() }, parentID: um.id, modelID: 'mock-model', providerID: 'mock', cost: 0, tokens: { input: 100, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } };
        messages[id].push({ info: am, parts: [] });
        setTimeout(() => emit({ type: 'message.updated', properties: { info: am } }), 200);
        const stream = (reply) => {
        const tp = { id: 'p' + counter++, sessionID: id, messageID: am.id, type: 'text', text: '' };
        messages[id].at(-1).parts.push(tp);
        let i = 0; const iv = setInterval(() => {
          i += 8; tp.text = reply.slice(0, i);
          emit({ type: 'message.part.updated', properties: { part: { ...tp } } });
          if (i >= reply.length) { clearInterval(iv); am.time.completed = now(); am.tokens.output = 50; emit({ type: 'message.updated', properties: { info: am } }); emit({ type: 'session.status', properties: { sessionID: id, status: { type: 'idle' } } }); emit({ type: 'session.idle', properties: { sessionID: id } }); }
        }, 60);
        };
        if (b.system) {
          stream(`**Webhook**（网络钩子）：服务端在事件发生时主动向你登记的 URL 发 HTTP 请求。\n\n在这个项目里，PixelWeb 用的是 SSE 而非 webhook。\n\n检索练习：Webhook 与 SSE 谁先建立连接？`);
        } else {
          // normal prompts ask for permission to run a command first, like opencode's bash tool does
          const requestID = 'per_' + counter++;
          const request = { id: requestID, sessionID: id, permission: 'bash', patterns: ['npm test'], metadata: {}, always: ['npm *'], tool: { messageID: am.id, callID: 'call_' + requestID } };
          pendingPermissions.set(requestID, {
            request,
            resume: (reply) => stream(reply === 'reject' ? `好的，不运行 \`npm test\`。收到：${text}` : `已运行 \`npm test\`（${reply === 'always' ? '已记住，以后不再询问' : '仅这一次'}）。收到：${text}`),
          });
          setTimeout(() => emit({ type: 'permission.asked', properties: request }), 400);
        }
        json(res, 200, op === 'prompt_async' ? {} : { info: am, parts: [] });
      }); return;
    }
  }
  json(res, 404, { error: 'not found ' + p });
}).listen(PORT, '127.0.0.1', () => console.log('mock opencode on', PORT));
