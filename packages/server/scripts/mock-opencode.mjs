// Minimal stand-in for `opencode serve`, for developing the UI without a real agent.
// Usage: npm run dev:mock   (serves on 4096; PORT / DIR env override; PROJECTS=dir1:dir2 lists extra projects, with no sessions)
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const PORT = Number(process.env.PORT ?? 4096);
const dir = process.env.DIR ?? process.cwd();
const now = () => Date.now();
const extraProjects = (process.env.PROJECTS ?? '').split(path.delimiter).filter(Boolean).map((p) => path.resolve(p));
// like opencode, `?directory=` scopes a request to one project; the sample sessions all live in `dir`
const nested = (a, b) => a === b || a.startsWith(b + path.sep);
const inDir = (d) => !d || nested(path.resolve(d), dir) || nested(dir, path.resolve(d));
const sessions = [
  { id: 'ses_1', projectID: 'p', directory: dir, title: '修复登录页 bug', version: '1', time: { created: now() - 60000, updated: now() - 1000 }, summary: { additions: 12, deletions: 3, files: 2 } },
  // subtasks started by ses_1's task calls, titled the way opencode titles them
  { id: 'ses_2', projectID: 'p', directory: dir, parentID: 'ses_1', title: '搜索处理 token 过期的代码 (@explore subagent)', version: '1', time: { created: now() - 58500, updated: now() - 57200 } },
  { id: 'ses_new', projectID: 'p', directory: dir, title: `New session - ${new Date(now() - 30000).toISOString()}`, version: '1', time: { created: now() - 30000, updated: now() - 30000 } },
  { id: 'ses_2b', projectID: 'p', directory: dir, parentID: 'ses_1', title: '检查路由守卫的调用方 (@general subagent)', version: '1', time: { created: now() - 57000, updated: now() - 56200 } },
];
const messages = {
  ses_1: [
    { info: { id: 'm1', sessionID: 'ses_1', role: 'user', time: { created: now() - 60000 }, agent: 'build', model: { providerID: 'anthropic', modelID: 'claude' } },
      parts: [{ id: 'p1', sessionID: 'ses_1', messageID: 'm1', type: 'text', text: '请修复登录页在 token 过期时不跳转的问题，并跑测试。' }] },
    { info: { id: 'm2', sessionID: 'ses_1', role: 'assistant', time: { created: now() - 59000, completed: now() - 30000 }, parentID: 'm1', modelID: 'claude-sonnet-4', providerID: 'anthropic', mode: 'build', cost: 0.0123, tokens: { input: 12400, output: 820, reasoning: 0, cache: { read: 131000, write: 0 } } },
      parts: [
        { id: 'p2', sessionID: 'ses_1', messageID: 'm2', type: 'step-start' },
        { id: 'p3', sessionID: 'ses_1', messageID: 'm2', type: 'reasoning', text: '先用 grep 找到处理 token 过期的地方，再看 webhook 回调。', time: { start: 1, end: 2 } },
        { id: 'p3a', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c0', tool: 'task', state: { status: 'completed', input: { description: '搜索处理 token 过期的代码', prompt: '找出所有处理 token 过期的地方', subagent_type: 'explore' }, output: 'src/auth.ts:42', title: '搜索处理 token 过期的代码', metadata: { parentSessionId: 'ses_1', sessionId: 'ses_2', model: { providerID: 'anthropic', modelID: 'claude-sonnet-4' } }, time: { start: now() - 58500, end: now() - 57200 } } },
        { id: 'p3b', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c0b', tool: 'task', state: { status: 'completed', input: { description: '检查路由守卫的调用方', prompt: '看看 guard() 被谁调用', subagent_type: 'general' }, output: 'src/router.ts', title: '检查路由守卫的调用方', metadata: { parentSessionId: 'ses_1', sessionId: 'ses_2b', model: { providerID: 'anthropic', modelID: 'claude-sonnet-4' } }, time: { start: now() - 57000, end: now() - 56200 } } },
        { id: 'p4', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c1', tool: 'grep', state: { status: 'completed', input: { pattern: 'tokenExpired', path: 'src' }, output: 'src/auth.ts:42: if (tokenExpired) {', title: 'grep tokenExpired', metadata: {}, time: { start: now() - 58000, end: now() - 57000 } } },
        { id: 'p5', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c2', tool: 'edit', state: { status: 'completed', input: { filePath: 'src/auth.ts', oldString: 'if (tokenExpired) {', newString: 'if (tokenExpired) { router.push("/login");' }, output: 'ok', title: 'edit src/auth.ts', metadata: {}, time: { start: now() - 56000, end: now() - 55000 } } },
        { id: 'p5b', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c2b', tool: 'edit', state: { status: 'completed', input: { filePath: 'src/router.ts', oldString: '', newString: '' }, output: 'ok', title: 'edit src/router.ts', metadata: { diff: 'Index: src/router.ts\n===================================================================\n--- src/router.ts\n+++ src/router.ts\n@@ -10,7 +10,9 @@\n export function guard(to: Route) {\n-  if (!session.valid) return;\n+  if (!session.valid) {\n+    return redirect(\'/login\');\n+  }\n   return next(to);\n }\n' }, time: { start: now() - 55500, end: now() - 55200 } } },
        { id: 'p6', sessionID: 'ses_1', messageID: 'm2', type: 'tool', callID: 'c3', tool: 'bash', state: { status: 'error', input: { command: 'npm test' }, error: 'FAIL src/auth.test.ts', time: { start: now() - 54000, end: now() - 50000 } } },
        { id: 'p7', sessionID: 'ses_1', messageID: 'm2', type: 'text', text: '我通过 **grep** 定位到 `src/auth.ts`，用 edit 加了跳转。测试失败，是因为 SSE 连接的 mock 没更新，这涉及 context window 之外的信息，需要再看一次 commit 历史。' },
        { id: 'p8', sessionID: 'ses_1', messageID: 'm2', type: 'step-finish', reason: 'tool-calls', cost: 0.0123, tokens: { input: 12400, output: 820, reasoning: 0, cache: { read: 131000, write: 0 } } },
      ] },
  ],
  ses_2: [],
  ses_2b: [],
  ses_new: [],
};

// Two weeks of older sessions on a few models, for the 用量 page. opencodego reports no cache use, like an
// openai-compatible provider that doesn't return cached-token counts.
{
  const day = 86_400_000;
  const plan = [
    [13, 'anthropic', 'claude-sonnet-4', 3], [12, 'anthropic', 'claude-sonnet-4', 5], [10, 'opencodego', 'deepseek-v4-pro', 4],
    [9, 'anthropic', 'claude-haiku-4-5', 2], [7, 'anthropic', 'claude-sonnet-4', 6], [6, 'opencodego', 'deepseek-v4-pro', 3],
    [4, 'anthropic', 'claude-sonnet-4', 4], [3, 'anthropic', 'claude-haiku-4-5', 3], [2, 'opencodego', 'glm-5.2', 5], [1, 'anthropic', 'claude-sonnet-4', 7],
  ];
  plan.forEach(([ago, providerID, modelID, steps], n) => {
    const id = `ses_h${n}`;
    const T = now() - ago * day + (n % 3) * 3_600_000;
    const cached = providerID === 'anthropic';
    const parts = [];
    for (let i = 0; i < steps; i++) {
      const prompt = 9000 + i * 2500 + n * 300;
      const read = cached ? (i === 0 ? 0 : Math.round(prompt * 0.85)) : 0;
      const write = cached ? (i === 0 ? prompt - 1200 : prompt - read - 600) : 0;
      const tokens = { input: prompt - read - write, output: 400 + 90 * i, reasoning: modelID.startsWith('deepseek') ? 200 : 0, cache: { read, write } };
      parts.push({ id: `${id}_s${i}`, sessionID: id, messageID: `${id}_a`, type: 'step-finish', reason: i === steps - 1 ? 'stop' : 'tool-calls', cost: cached ? 0.01 + i * 0.004 : 0, tokens });
    }
    const last = parts.at(-1);
    sessions.push({ id, projectID: 'p', directory: dir, title: `历史会话 ${n + 1}`, version: '1', time: { created: T, updated: T + 5 * 60000 } });
    messages[id] = [
      { info: { id: `${id}_u`, sessionID: id, role: 'user', time: { created: T }, agent: 'build', model: { providerID, modelID } },
        parts: [{ id: `${id}_t`, sessionID: id, messageID: `${id}_u`, type: 'text', text: '示例' }] },
      // like opencode, the message keeps only the last step's tokens, but the summed cost
      { info: { id: `${id}_a`, sessionID: id, role: 'assistant', time: { created: T + 1000, completed: T + 5 * 60000 }, parentID: `${id}_u`, modelID, providerID, mode: 'build', cost: parts.reduce((c, p) => c + p.cost, 0), tokens: last.tokens },
        parts },
    ];
  });
}

// A session whose prompt cache hits, then breaks twice: after an idle gap and after switching agent.
{
  const T = now() - 20 * 60000;
  const id = 'ses_4';
  const tk = (input, read, write) => ({ input, output: 300, reasoning: 0, cache: { read, write } });
  const step = (pid, mid, tokens) => ({ id: pid, sessionID: id, messageID: mid, type: 'step-finish', reason: 'tool-calls', cost: 0.01, tokens });
  const read = (pid, mid, file, at) => ({ id: pid, sessionID: id, messageID: mid, type: 'tool', callID: pid, tool: 'read', state: { status: 'completed', input: { filePath: file }, output: '…', title: file, metadata: {}, time: { start: at, end: at + 500 } } });
  const text = (pid, mid, t) => ({ id: pid, sessionID: id, messageID: mid, type: 'text', text: t });
  const u = (mid, at, agent, t) => ({ info: { id: mid, sessionID: id, role: 'user', time: { created: at }, agent, model: { providerID: 'anthropic', modelID: 'claude-sonnet-4' } }, parts: [text(mid + 't', mid, t)] });
  const a = (mid, at, mode, parts) => ({ info: { id: mid, sessionID: id, role: 'assistant', time: { created: at, completed: at + 30000 }, parentID: '', modelID: 'claude-sonnet-4', providerID: 'anthropic', mode, cost: 0.03, tokens: tk(0, 0, 0) }, parts });
  sessions.push({ id, projectID: 'p', directory: dir, title: '重构配置加载（缓存示例）', version: '1', time: { created: T, updated: T + 12 * 60000 } });
  messages[id] = [
    u('m41', T, 'build', '把配置加载改成先读环境变量再读命令行参数。'),
    a('m42', T + 1000, 'build', [
      read('p41', 'm42', 'packages/server/src/config.ts', T + 5000), step('p42', 'm42', tk(420, 0, 18200)),
      read('p43', 'm42', 'packages/server/src/index.ts', T + 12000), step('p44', 'm42', tk(380, 18620, 2600)),
      text('p45', 'm42', '看完了，config.ts 里命令行参数优先。要改顺序吗？'), step('p46', 'm42', tk(300, 21600, 900)),
    ]),
    u('m43', T + 9 * 60000, 'build', '要，改吧。'),
    a('m44', T + 9 * 60000 + 1000, 'build', [text('p47', 'm44', '（闲置 9 分钟后，缓存已过期，整段历史重新写入缓存。）'), step('p48', 'm44', tk(520, 0, 23100))]),
    u('m45', T + 10 * 60000, 'plan', '先别动手，出个方案。'),
    a('m46', T + 10 * 60000 + 1000, 'plan', [text('p49', 'm46', '（换成 plan agent：系统提示和工具都变了。）'), step('p50', 'm46', tk(640, 0, 24400))]),
    u('m47', T + 11 * 60000, 'plan', '方案里再加上测试。'),
    a('m48', T + 11 * 60000 + 1000, 'plan', [text('p51', 'm48', '好的，方案如下……'), step('p52', 'm48', tk(410, 25040, 700))]),
  ];
}

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
    { info: { id: 'm31', sessionID: 'ses_3', role: 'user', time: { created: t - 60000 }, agent: 'build', model: { providerID: 'anthropic', modelID: 'claude', variant: 'high' } },
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

// A session that loads a skill, then runs the same failing command three times, so opencode
// is waiting on a doom_loop permission.
{
  const T = now() - 5 * 60000;
  const id = 'ses_5';
  const call = (pid, tool, input, output, title, at) => ({ id: pid, sessionID: id, messageID: 'm52', type: 'tool', callID: pid, tool, state: { status: 'completed', input, output, title, metadata: {}, time: { start: at, end: at + 4000 } } });
  const test = (pid, at) => call(pid, 'bash', { command: 'npm test -w server', description: 'Run server tests' }, 'FAIL test/db.test.ts\n  connect ECONNREFUSED 127.0.0.1:5432\nTests: 1 failed, 102 passed', 'Run server tests', at);
  const am = { id: 'm52', sessionID: id, role: 'assistant', time: { created: T + 1000 }, parentID: 'm51', modelID: 'claude-sonnet-4', providerID: 'anthropic', mode: 'build', cost: 0.02, tokens: { input: 900, output: 200, reasoning: 0, cache: { read: 0, write: 0 } } };
  sessions.push({ id, projectID: 'p', directory: dir, title: '修好失败的测试（打转示例）', version: '1', time: { created: T, updated: T + 60000 } });
  messages[id] = [
    { info: { id: 'm51', sessionID: id, role: 'user', time: { created: T }, agent: 'build', model: { providerID: 'anthropic', modelID: 'claude-sonnet-4' } },
      parts: [{ id: 'p51', sessionID: id, messageID: 'm51', type: 'text', text: '服务端测试挂了一个，帮我修好。' }] },
    { info: am, parts: [
      call('p52', 'skill', { name: 'debug-tests' }, '<skill_content name="debug-tests">\n# Skill: debug-tests\n\n先单独重跑失败的用例，读完整报错再改代码……\n</skill_content>', 'Loaded skill: debug-tests', T + 3000),
      test('p53', T + 10000), test('p54', T + 20000), test('p55', T + 30000),
    ] },
  ];
  pendingPermissions.set('per_doom', {
    request: { id: 'per_doom', sessionID: id, permission: 'doom_loop', patterns: ['bash'], metadata: { tool: 'bash', input: { command: 'npm test -w server' } }, always: ['bash'], tool: { messageID: 'm52', callID: 'p55' } },
    resume: (reply) => {
      const part = { id: 'p56', sessionID: id, messageID: 'm52', type: 'text', text: reply === 'reject' ? '好，不再重跑。数据库没启动（5432 连不上），先把它起起来再测。' : '再跑一次 npm test -w server……' };
      messages[id][1].parts.push(part);
      am.time.completed = now();
      emit({ type: 'message.part.updated', properties: { part } });
      emit({ type: 'message.updated', properties: { info: am } });
    },
  });
}
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
  if (p === '/project') return json(res, 200, [dir, ...extraProjects].map((w, i) => ({ id: 'prj_' + i, worktree: w, vcs: 'git', time: { created: now() - 86400000, updated: now() - i * 3600000 } })));
  if (p === '/session' && req.method === 'GET') return json(res, 200, inDir(u.searchParams.get('directory')) ? sessions : []);
  const one = /^\/session\/([^/]+)$/.exec(p);
  if (one) {
    const s = sessions.find((x) => x.id === one[1]);
    if (!s) return json(res, 404, { error: 'no such session' });
    if (req.method === 'GET') return json(res, 200, s);
    if (req.method === 'PATCH') {
      readBody(req).then((b) => {
        if (typeof b.title === 'string') s.title = b.title;
        s.time.updated = now();
        emit({ type: 'session.updated', properties: { sessionID: s.id, info: s } });
        json(res, 200, s);
      });
      return;
    }
  }
  if (p === '/session' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      const b = JSON.parse(body || '{}'); const s = { id: 'ses_' + counter++, projectID: 'p', directory: dir, title: b.title ?? `New session - ${new Date().toISOString()}`, version: '1', time: { created: now(), updated: now() } };
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
        // like opencode: no agent means the default one; the model falls back to the last user message's
        const lastModel = messages[id].findLast((x) => x.info.role === 'user' && x.info.model)?.info.model;
        const um = { id: 'm' + counter++, sessionID: id, role: 'user', time: { created: now() }, agent: b.agent ?? 'build', model: { ...(b.model ?? lastModel ?? { providerID: 'anthropic', modelID: 'claude-sonnet-4' }), ...(b.variant ? { variant: b.variant } : {}) }, ...(b.system ? { system: b.system } : {}), ...(b.tools ? { tools: b.tools } : {}) };
        console.log('[mock] prompt', id, JSON.stringify({ agent: b.agent, model: b.model, variant: b.variant, system: !!b.system, tools: b.tools }));
        messages[id].push({ info: um, parts: [{ id: 'p' + counter++, sessionID: id, messageID: um.id, type: 'text', text }] });
        // like opencode's title agent: the first prompt names a still-untitled session (Chinese, 动词对象)
        const ses = sessions.find((x) => x.id === id);
        if (ses && /^New session - /.test(ses.title)) {
          setTimeout(() => {
            ses.title = '“' + (text.replace(/^请/, '').slice(0, 12) || '闲聊') + '”';
            ses.time.updated = now();
            emit({ type: 'session.updated', properties: { sessionID: id, info: ses } });
          }, 600);
        }
        emit({ type: 'message.updated', properties: { info: um } });
        emit({ type: 'message.part.updated', properties: { part: messages[id].at(-1).parts[0] } });
        emit({ type: 'session.status', properties: { sessionID: id, status: { type: 'busy' } } });
        const am = { id: 'm' + counter++, sessionID: id, role: 'assistant', time: { created: now() }, parentID: um.id, modelID: 'claude-sonnet-4', providerID: 'anthropic', cost: 0, tokens: { input: 100, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } };
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
