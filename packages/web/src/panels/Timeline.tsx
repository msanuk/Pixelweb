import { useEffect, useMemo, useRef, useState } from 'react';
import type { OcMessageWithParts, OcPart, OcPermission, PermissionResponse } from '@pixelweb/shared';
import { api } from '../lib/api';
import { explain, getState, loadMessages, openCard, setState, showCommit, showInArch, toast, useStore } from '../lib/store';
import { displayTitle, fmtDuration, fmtNum, fmtTime } from '../lib/format';
import { Markdown } from '../components/Markdown';
import { Highlight } from '../components/Highlight';
import { DiffStat, DiffView } from '../components/DiffView';
import { lineDiff, parseUnified, type Diff } from '../lib/diff';
import { toProjectPath, toolFiles } from '../lib/activity';
import { contextUsage } from '../lib/context';
import { analyzeCache, breakReasons, type SessionCache, type StepCache } from '../lib/cache';
import { cardForTool } from '../lib/tools';
import { summarizeSession } from '../lib/summary';
import { sessionTokens } from '../lib/usage';
import { buildMatcher } from '../lib/terms';


export function Timeline() {
  const sessionID = useStore((s) => s.selectedSession);
  const session = useStore((s) => s.sessions.find((x) => x.id === sessionID));
  const messages = useStore((s) => (sessionID ? s.messages[sessionID] : undefined));
  const loading = useStore((s) => (sessionID ? s.loadingMessages[sessionID] : false));
  const status = useStore((s) => (sessionID ? s.status[sessionID] : undefined));
  const todos = useStore((s) => (sessionID ? s.todos[sessionID] : undefined));
  const allPermissions = useStore((s) => s.permissions);
  // selectors must return stable references (useSyncExternalStore); derive filtered lists with useMemo
  const permissions = useMemo(() => allPermissions.filter((p) => p.sessionID === sessionID), [allPermissions, sessionID]);
  const isTeaching = useStore((s) => (sessionID ? s.teachingSessions.has(sessionID) : false));
  const bottomRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [text, setText] = useState('');
  const partFocus = useStore((s) => s.partFocus);

  useEffect(() => {
    if (sessionID) void loadMessages(sessionID);
  }, [sessionID]);

  // arriving from another panel to look at one tool call: stop pinning the view to the bottom
  useEffect(() => {
    if (partFocus) setFollow(false);
  }, [partFocus]);

  useEffect(() => {
    if (follow && !getState().partFocus) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, follow]);

  const totals = useMemo(() => {
    let tools = 0;
    for (const m of messages ?? []) tools += m.parts.filter((p) => p.type === 'tool').length;
    return { ...sessionTokens(messages ?? []), tools };
  }, [messages]);
  const cache = useMemo(() => analyzeCache(messages ?? []), [messages]);

  if (!sessionID) {
    return (
      <div className="empty">
        <h3>没有选中的会话</h3>
        <p>
          在左侧选择一个 OpenCode <Highlight text="session" />，或在 OpenCode 里开始一段对话——事件会通过{' '}
          <Highlight text="SSE" /> 实时出现在这里。
        </p>
      </div>
    );
  }

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      await api.prompt(sessionID, t);
    } catch (e) {
      toast(`发送失败：${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div className="timeline">
      <header className="timeline-head">
        <div>
          <h3>
            {isTeaching && <span className="chip teach">教学</span>} {session ? displayTitle(session.title) : sessionID}
          </h3>
          <div className="meta">
            <span className={`dot ${status === 'busy' ? 'busy' : status === 'retry' ? 'retry' : ''}`} />
            {status === 'busy' ? '运行中' : status === 'retry' ? '重试中' : '空闲'} · {messages?.length ?? 0} 条消息 · {totals.tools} 次
            <button className="term" onClick={() => openCard('tool-call', `会话 ${session?.title}`)}>
              工具调用
            </button>{' '}
            ·{' '}
            <button className="term" onClick={() => openCard('token', `会话 ${session?.title}：input ${totals.input}, output ${totals.output}`)}>
              tokens
            </button>{' '}
            {fmtNum(totals.input)} / {fmtNum(totals.output)} · ${totals.cost.toFixed(4)}
          </div>
          <ContextMeter messages={messages} sessionTitle={session?.title ?? ''} />
          <CacheMeter cache={cache} sessionTitle={session?.title ?? ''} />
        </div>
        <div className="actions">
          <label className="follow">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> 跟随
          </label>
          <button onClick={() => void loadMessages(sessionID, true)}>刷新</button>
          {status === 'busy' && (
            <button className="danger" onClick={() => void api.abort(sessionID).catch((e) => toast(String(e)))}>
              停止
            </button>
          )}
        </div>
      </header>

      {todos && todos.length > 0 && (
        <details className="todos" open>
          <summary>
            <button className="term" onClick={(e) => (e.preventDefault(), openCard('tool-todo'))}>
              任务清单
            </button>{' '}
            {todos.filter((t) => t.status === 'completed').length}/{todos.length}
          </summary>
          <ul>
            {todos.map((t) => (
              <li key={t.id} className={`todo-${t.status}`}>
                {t.status === 'completed' ? '☑' : t.status === 'in_progress' ? '◐' : '☐'} {t.content}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="messages" onScroll={(e) => {
        const el = e.currentTarget;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        if (!atBottom && follow) setFollow(false);
      }}>
        {loading && !messages && <p className="muted">加载消息…</p>}
        {messages?.map((m) => (
          // without cache figures from the provider, per-step hit rates would all read 0%
          <Message key={m.info.id} m={m} sessionTitle={session?.title ?? ''} steps={cache.reported ? cache.steps : undefined} />
        ))}
        {status !== 'busy' && messages?.some((m) => m.info.role === 'assistant') && (
          <SessionRecap messages={messages} sessionID={sessionID} sessionTitle={session ? displayTitle(session.title) : sessionID} />
        )}
        <div ref={bottomRef} />
      </div>

      {permissions.length > 0 && <PermissionRequests permissions={permissions} />}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isTeaching ? '继续追问导师…' : '向这个会话发送一条 prompt（异步，回复走事件流）'}
        />
        <button type="submit" className="primary" disabled={!text.trim()}>
          发送
        </button>
      </form>
    </div>
  );
}

/**
 * Recap under an idle session: what happened, and which concepts came up —
 * the ones you haven't mastered first, each opening its card.
 */
function SessionRecap({ messages, sessionID, sessionTitle }: { messages: OcMessageWithParts[]; sessionID: string; sessionTitle: string }) {
  const terms = useStore((s) => s.terms);
  const knowledge = useStore((s) => s.knowledge);
  const records = useStore((s) => s.learning.records);
  const root = useStore((s) => s.server?.projectRoot ?? s.arch?.root ?? '');
  const commits = useStore((s) => s.commitLinks);
  const isTeaching = useStore((s) => s.teachingSessions.has(sessionID));
  const matcher = useMemo(() => buildMatcher(terms), [terms]);
  const sum = useMemo(() => summarizeSession(messages, matcher, root), [messages, matcher, root]);
  const commitCount = useMemo(() => commits.filter((l) => l.sessionID === sessionID).length, [commits, sessionID]);

  const titleOf = (id: string) => knowledge.find((k) => k.id === id)?.title ?? id;
  const open = sum.concepts.filter((c) => records[c.cardId]?.mastery !== 'mastered');
  const done = sum.concepts.filter((c) => records[c.cardId]?.mastery === 'mastered');
  const ctx = (c: { cardId: string; count: number }) => `在会话「${sessionTitle}」里出现了 ${c.count} 次`;

  return (
    <details className="recap" open>
      <summary>
        <span className="strong">会话小结</span>
        <span className="muted">
          {sum.turns} 轮 · {sum.toolCalls} 次工具调用{sum.toolErrors ? `（失败 ${sum.toolErrors}）` : ''}
          {sum.edited.length > 0 && ` · 改了 ${sum.edited.length} 个文件`}
          {commitCount > 0 && ` · ${commitCount} 次提交`}
          {sum.cost > 0 && ` · $${sum.cost.toFixed(4)}`}
        </span>
      </summary>
      {sum.edited.length > 0 && (
        <p className="recap-files">
          {sum.edited.slice(0, 8).map((f) => (
            <button key={f} className="chip mono link" onClick={() => showInArch(f)} title="在架构图中定位">
              {f.split('/').pop()}
            </button>
          ))}
          {sum.edited.length > 8 && <span className="muted small">等 {sum.edited.length} 个</span>}
        </p>
      )}
      {sum.concepts.length > 0 ? (
        <>
          <h5>{open.length > 0 ? `碰到的概念 · ${open.length} 个还没掌握` : '碰到的概念都已掌握'}</h5>
          <p className="recap-concepts">
            {open.map((c) => (
              <button key={c.cardId} className={`chip link ${records[c.cardId] ? '' : 'new'}`} onClick={() => openCard(c.cardId, ctx(c))} title={records[c.cardId] ? '看过，还没掌握' : '还没看过'}>
                {titleOf(c.cardId)}
                {c.count > 1 && <span className="muted"> ×{c.count}</span>}
              </button>
            ))}
          </p>
          {done.length > 0 && (
            <details className="recap-done">
              <summary className="muted small">已掌握 {done.length} 个</summary>
              <p className="recap-concepts">
                {done.map((c) => (
                  <button key={c.cardId} className="chip link" onClick={() => openCard(c.cardId, ctx(c))}>
                    {titleOf(c.cardId)}
                  </button>
                ))}
              </p>
            </details>
          )}
          {open.length > 0 && !isTeaching && (
            <button
              className="link-btn"
              onClick={() =>
                void explain(
                  `${sessionTitle} · ${Math.min(open.length, 6)} 个概念`,
                  `请结合会话「${sessionTitle}」实际做的事，依次讲这些概念：${open.slice(0, 6).map((c) => titleOf(c.cardId)).join('、')}。\n` +
                    `这次会话：${sum.turns} 轮，${sum.toolCalls} 次工具调用，改了 ${sum.edited.slice(0, 10).join(', ') || '（没有文件）'}。`,
                )
              }
              title="开一个只读的教学会话，拿这次会话当例子讲"
            >
              让 OpenCode 结合这次会话讲讲 →
            </button>
          )}
        </>
      ) : (
        <p className="muted small">这次会话里没有出现知识库里的概念。</p>
      )}
    </details>
  );
}

/** How full the context window is after the latest request, and how far that is from OpenCode compacting on its own. */
function ContextMeter({ messages, sessionTitle }: { messages: OcMessageWithParts[] | undefined; sessionTitle: string }) {
  const info = useStore((s) => s.modelInfo);
  const u = useMemo(() => contextUsage(messages, info), [messages, info]);
  if (!u) return null;
  const ctx =
    `会话「${sessionTitle}」使用 ${u.model}` +
    (u.limit ? `：上下文窗口 ${u.limit} tokens，最近一次请求用了 ${u.used}，OpenCode 约在 ${u.threshold} 时自动压缩` : `：最近一次请求用了 ${u.used} tokens`);
  if (u.justCompacted) {
    return (
      <div className="ctx-meter">
        <button className="term" onClick={() => openCard('compaction', ctx)}>
          上下文
        </button>
        <span className="muted">刚压缩过，下一次请求后更新</span>
      </div>
    );
  }
  const pct = u.limit ? Math.min(1, u.used / u.limit) : 0;
  const left = u.threshold - u.used;
  const near = u.autoCompact && u.threshold > 0 && u.used >= u.threshold * 0.85;
  return (
    <div className={`ctx-meter ${near ? 'near' : ''}`}>
      <button className="term" onClick={() => openCard('context-window', ctx)}>
        上下文
      </button>
      {u.limit > 0 && (
        <span className="ctx-bar" role="meter" aria-valuemin={0} aria-valuemax={u.limit} aria-valuenow={u.used} aria-label="上下文用量">
          <i style={{ width: `${pct * 100}%` }} />
          {u.autoCompact && u.threshold > 0 && <b style={{ left: `${(u.threshold / u.limit) * 100}%` }} title="OpenCode 在这里自动压缩" />}
        </span>
      )}
      <span className="mono">
        {fmtNum(u.used)}
        {u.limit > 0 && ` / ${fmtNum(u.limit)} · ${Math.round(pct * 100)}%`}
      </span>
      {u.limit > 0 &&
        (u.autoCompact ? (
          <button className="term" onClick={() => openCard('compaction', ctx)}>
            {left > 0 ? `距自动压缩约 ${fmtNum(left)}` : '下一步会自动压缩'}
          </button>
        ) : (
          <span>自动压缩已关闭</span>
        ))}
    </div>
  );
}

/** How much of the session's prompts the provider served from its prompt cache, and how often that cache broke. */
function CacheMeter({ cache, sessionTitle }: { cache: SessionCache; sessionTitle: string }) {
  const next = useRef(0);
  if (!cache.steps.size) return null;
  const ctx =
    `会话「${sessionTitle}」共 ${cache.steps.size} 次模型请求，提示合计 ${cache.prompt} tokens` +
    (cache.reported ? `，其中缓存读取 ${cache.read}、缓存写入 ${cache.write}，缓存中断 ${cache.breaks} 次` : '，服务商没有回报缓存用量');
  const open = () => openCard('prompt-cache', ctx);
  if (!cache.reported) {
    return (
      <div className="ctx-meter">
        <button className="term" onClick={open}>
          缓存
        </button>
        <span>服务商没有回报缓存用量</span>
      </div>
    );
  }
  const pct = cache.hitRate ?? 0;
  // each click scrolls to the next break, wrapping around
  const jump = () => {
    const els = document.querySelectorAll('.part.step.broken');
    if (!els.length) return;
    els[next.current++ % els.length].scrollIntoView({ block: 'center' });
  };
  return (
    <div className="ctx-meter">
      <button className="term" onClick={open}>
        缓存命中
      </button>
      <span className="ctx-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="缓存命中率">
        <i style={{ width: `${pct * 100}%` }} />
      </span>
      <span className="mono">
        {Math.round(pct * 100)}% · 读 {fmtNum(cache.read)} · 写 {fmtNum(cache.write)}
      </span>
      {cache.breaks > 0 && (
        <button className="link-btn warn-text" onClick={jump} title="跳到下一次缓存中断">
          {cache.breaks} 次中断
        </button>
      )}
    </div>
  );
}

/** Pending permission requests, answered in place instead of switching to the OpenCode terminal. */
function PermissionRequests({ permissions }: { permissions: OcPermission[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const reply = async (p: OcPermission, response: PermissionResponse) => {
    setBusy(p.id);
    try {
      await api.replyPermission(p.sessionID, p.id, response);
      // opencode also sends permission.replied; drop it now so the bar doesn't linger
      setState((s) => ({ permissions: s.permissions.filter((x) => x.id !== p.id) }));
    } catch (e) {
      toast(`回复权限失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="permissions" role="alert">
      {permissions.map((p) => {
        const what = Array.isArray(p.pattern) ? p.pattern.join(' ') : p.pattern || p.title;
        return (
          <div key={p.id} className="perm">
            <span className="perm-what">
              <button className="term strong" onClick={() => openCard(p.type === 'doom_loop' ? 'doom-loop' : 'permission', `${p.type}: ${what}`)}>
                需要权限
              </button>
              <span className="chip">{p.type}</span>
              <code title={p.title}>{what}</code>
            </span>
            <span className="actions">
              <button className="primary" disabled={busy === p.id} onClick={() => void reply(p, 'once')}>
                允许一次
              </button>
              <button disabled={busy === p.id} onClick={() => void reply(p, 'always')} title="同类请求以后自动允许">
                总是允许
              </button>
              <button className="danger" disabled={busy === p.id} onClick={() => void reply(p, 'reject')}>
                拒绝
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Message({ m, sessionTitle, steps }: { m: OcMessageWithParts; sessionTitle: string; steps?: Map<string, StepCache> }) {
  const info = m.info;
  const isUser = info.role === 'user';
  return (
    <article className={`msg ${isUser ? 'user' : 'assistant'}`}>
      <header>
        <span className="role">{isUser ? '你' : 'agent'}</span>
        {!isUser && (
          <button className="term mono" onClick={() => openCard('llm', `模型 ${info.providerID}/${info.modelID}`)}>
            {info.providerID}/{info.modelID}
          </button>
        )}
        <span className="muted">{fmtTime(info.time.created)}</span>
        {!isUser && info.error && <span className="chip err">{info.error.name}</span>}
      </header>
      <div className="parts">
        {m.parts.map((p) => (
          <Part key={p.id} p={p} sessionTitle={sessionTitle} cache={steps?.get(p.id)} />
        ))}
      </div>
    </article>
  );
}

/** The files one step changed; OpenCode lists them as absolute paths. */
function PatchPart({ p }: { p: Extract<OcPart, { type: 'patch' }> }) {
  const root = useStore((s) => s.server?.projectRoot ?? s.arch?.root ?? '');
  const files = p.files.map((f) => toProjectPath(f, root) ?? f).join(', ');
  return (
    <div className="part step">
      <button className="term" onClick={() => openCard('diff', `patch ${p.hash}: ${files}`)}>
        patch
      </button>{' '}
      {files}
    </div>
  );
}

function Part({ p, sessionTitle, cache }: { p: OcPart; sessionTitle: string; cache?: StepCache }) {
  switch (p.type) {
    case 'text': {
      const t = p as Extract<OcPart, { type: 'text' }>;
      if (!t.text?.trim()) return null;
      return (
        <div className="part text">
          <Markdown text={t.text} />
        </div>
      );
    }
    case 'reasoning': {
      const r = p as Extract<OcPart, { type: 'reasoning' }>;
      if (!r.text?.trim()) return null;
      return (
        <details className="part reasoning">
          <summary>
            <button className="term" onClick={(e) => (e.preventDefault(), openCard('reasoning', r.text.slice(0, 300)))}>
              思考过程
            </button>
          </summary>
          <Markdown text={r.text} highlight={false} />
        </details>
      );
    }
    case 'tool':
      return <ToolPart p={p as Extract<OcPart, { type: 'tool' }>} sessionTitle={sessionTitle} />;
    case 'step-finish': {
      const s = p as Extract<OcPart, { type: 'step-finish' }>;
      const b = cache?.broken;
      return (
        <div className={`part step ${b ? 'broken' : ''}`}>
          <button className="term" onClick={() => openCard('token', `step-finish: input ${s.tokens.input}, output ${s.tokens.output}, cache read ${s.tokens.cache.read}`)}>
            step
          </button>{' '}
          {s.reason} · in {fmtNum(s.tokens.input)} · out {fmtNum(s.tokens.output)} · cache {fmtNum(s.tokens.cache.read)}
          {cache?.hitRate != null && ` (${Math.round(cache.hitRate * 100)}%)`}
          {cache && cache.write > 0 && ` · 写 ${fmtNum(cache.write)}`} · ${s.cost.toFixed(4)}
          {b && (
            <div className="cache-break">
              <button
                className="term"
                onClick={() => openCard('prompt-cache', `这一步只从缓存读了 ${cache.read} tokens，而上一步的提示有 ${b.expected} tokens。${breakReasons(b)}`)}
              >
                缓存中断
              </button>{' '}
              复用 {fmtNum(cache.read)} / 上一步 {fmtNum(b.expected)} · {breakReasons(b)}
            </div>
          )}
        </div>
      );
    }
    case 'compaction':
      return (
        <div className="part divider">
          <button className="term" onClick={() => openCard('compaction', `会话 ${sessionTitle} 发生了 compaction`)}>
            上下文压缩
          </button>{' '}
          {(p as any).auto ? '（自动）' : ''}
        </div>
      );
    case 'patch':
      return <PatchPart p={p as Extract<OcPart, { type: 'patch' }>} />;
    case 'subtask': {
      const s = p as Extract<OcPart, { type: 'subtask' }>;
      return (
        <div className="part tool">
          <div className="tool-head">
            <button className="term" onClick={() => openCard('tool-task', s.prompt.slice(0, 300))}>
              子任务
            </button>
            <span className="muted">{s.agent}</span>
          </div>
          <p>{s.description}</p>
        </div>
      );
    }
    case 'step-start':
    case 'snapshot':
    case 'agent':
      return null;
    default:
      return (
        <div className="part step muted">
          {p.type}
        </div>
      );
  }
}

function ToolPart({ p, sessionTitle }: { p: Extract<OcPart, { type: 'tool' }>; sessionTitle: string }) {
  const [open, setOpen] = useState(false);
  const st = p.state;
  const cardId = cardForTool(p.tool);
  const title = st.status === 'completed' || st.status === 'running' ? (st as any).title : undefined;
  const dur = st.status === 'completed' || st.status === 'error' ? fmtDuration(st.time.end - st.time.start) : null;
  const ctx = `会话「${sessionTitle}」中的工具调用 ${p.tool}\ninput: ${JSON.stringify(st.input).slice(0, 400)}`;
  const diff = useMemo(() => toolDiff(p), [p]);
  const root = useStore((s) => s.server?.projectRoot ?? s.arch?.root ?? '');
  const files = useMemo(
    () => [...new Set(toolFiles(p).map((f) => toProjectPath(f.path, root)).filter((f): f is string => !!f))],
    [p, root],
  );
  const commit = useStore((s) => s.commitLinks.find((l) => l.partID === p.id));
  const focused = useStore((s) => s.partFocus === p.id);
  const ref = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!focused) return;
    setOpen(true);
    setFlash(true);
    ref.current?.scrollIntoView({ block: 'center' });
    // cleared a moment later so the timeline's follow-to-bottom effect in this same render still sees it
    const t = setTimeout(() => setState({ partFocus: null }), 300);
    return () => clearTimeout(t);
  }, [focused]);

  return (
    <div ref={ref} className={`part tool status-${st.status} ${open ? 'open' : ''} ${flash ? 'flash' : ''}`}>
      <div className="tool-head" onClick={() => setOpen(!open)}>
        <span className={`dot ${st.status}`} />
        <button
          className="term mono strong"
          onClick={(e) => {
            e.stopPropagation();
            openCard(cardId, ctx);
          }}
          title="这个工具是什么？"
        >
          {p.tool}
        </button>
        <span className="tool-title">{title ?? summariseInput(p.tool, st.input)}</span>
        {diff && (diff.additions > 0 || diff.deletions > 0) && <DiffStat diff={diff} />}
        {commit?.hash && (
          <button
            className="chip mono"
            onClick={(e) => {
              e.stopPropagation();
              showCommit(commit.hash!);
            }}
            title="在 Git 图中查看这次提交"
          >
            {commit.hash.slice(0, 7)}
          </button>
        )}
        {st.status === 'error' && <span className="status-label">失败</span>}
        {dur && <span className="muted mono small">{dur}</span>}
        <span className="muted caret">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="tool-body">
          {diff ? (
            <>
              <h5>
                <button className="term" onClick={() => openCard('diff', ctx)}>
                  diff
                </button>
              </h5>
              <DiffView diff={diff} />
            </>
          ) : (
            <>
              <h5>input</h5>
              <pre>{JSON.stringify(st.input, null, 2)}</pre>
            </>
          )}
          {st.status === 'completed' && !diff && (
            <>
              <h5>output</h5>
              <pre>{truncate(st.output, 4000)}</pre>
            </>
          )}
          {st.status === 'error' && (
            <>
              <h5>error</h5>
              <pre className="error">{st.error}</pre>
            </>
          )}
          <div className="tool-links">
            {files.slice(0, 3).map((f) => (
              <button key={f} className="link-btn" onClick={() => showInArch(f)} title="在架构图里选中这个文件所在的模块">
                在架构图中定位 <span className="mono">{f.split('/').pop()}</span>
              </button>
            ))}
            {commit?.hash && (
              <button className="link-btn" onClick={() => showCommit(commit.hash!)}>
                在 Git 图中查看提交 <span className="mono">{commit.hash.slice(0, 7)}</span>
              </button>
            )}
            <button className="link-btn" onClick={() => void explain(`${p.tool} 工具在这一步做了什么`, ctx, cardId)} title="开一个只读的教学会话，结合这次调用讲解">
              让 OpenCode 解释这一步 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** File-changing tools get a diff: opencode's own unified diff when present, else one computed from the input. */
function toolDiff(p: Extract<OcPart, { type: 'tool' }>): Diff | null {
  const tool = p.tool.toLowerCase();
  if (!['edit', 'write', 'multiedit', 'patch'].includes(tool)) return null;
  const st = p.state;
  const meta = st.status === 'completed' ? st.metadata : undefined;
  if (typeof meta?.diff === 'string' && meta.diff.trim()) return parseUnified(meta.diff);
  const input = st.input;
  if (tool === 'edit' && typeof input.oldString === 'string' && typeof input.newString === 'string') {
    if (!input.oldString && !input.newString) return null;
    return { ...lineDiff(input.oldString, input.newString), fragment: true };
  }
  if (tool === 'write' && typeof input.content === 'string') return lineDiff('', input.content);
  return null;
}

function summariseInput(tool: string, input: Record<string, unknown>): string {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '');
  switch (tool.toLowerCase()) {
    case 'bash':
      return s('command') || s('description');
    case 'read':
    case 'edit':
    case 'write':
      return s('filePath') || s('path');
    case 'grep':
      return `${s('pattern')} ${s('path') ? 'in ' + s('path') : ''}`;
    case 'glob':
      return s('pattern');
    case 'webfetch':
      return s('url');
    case 'task':
      return s('description');
    default: {
      const first = Object.values(input).find((v) => typeof v === 'string') as string | undefined;
      return first ? first.slice(0, 120) : '';
    }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + `\n… (${s.length - n} more chars)` : s;
}
