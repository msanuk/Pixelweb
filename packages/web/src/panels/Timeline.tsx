import { useEffect, useMemo, useRef, useState } from 'react';
import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { api } from '../lib/api';
import { explain, loadMessages, openCard, toast, useStore } from '../lib/store';
import { fmtDuration, fmtNum, fmtTime } from '../lib/format';
import { Markdown } from '../components/Markdown';
import { Highlight } from '../components/Highlight';

const TOOL_CARD: Record<string, string> = {
  bash: 'tool-bash',
  read: 'tool-read-edit',
  edit: 'tool-read-edit',
  write: 'tool-read-edit',
  multiedit: 'tool-read-edit',
  patch: 'tool-read-edit',
  grep: 'tool-search',
  glob: 'tool-search',
  list: 'tool-search',
  webfetch: 'tool-webfetch',
  task: 'tool-task',
  todowrite: 'tool-todo',
  todoread: 'tool-todo',
};

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

  useEffect(() => {
    if (sessionID) void loadMessages(sessionID);
  }, [sessionID]);

  useEffect(() => {
    if (follow) bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, follow]);

  const totals = useMemo(() => {
    let input = 0,
      output = 0,
      cost = 0,
      tools = 0;
    for (const m of messages ?? []) {
      if (m.info.role === 'assistant') {
        input += m.info.tokens?.input ?? 0;
        output += m.info.tokens?.output ?? 0;
        cost += m.info.cost ?? 0;
      }
      tools += m.parts.filter((p) => p.type === 'tool').length;
    }
    return { input, output, cost, tools };
  }, [messages]);

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
            {isTeaching && <span className="chip teach">教学</span>} {session?.title ?? sessionID}
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

      {permissions.length > 0 && (
        <div className="banner warn">
          <strong>
            等待
            <button className="term" onClick={() => openCard('permission', permissions.map((p) => p.title).join('\n'))}>
              权限确认
            </button>
          </strong>
          ：{permissions.map((p) => p.title).join('；')}（请在 OpenCode 里回复）
        </div>
      )}

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
        {messages?.map((m) => <Message key={m.info.id} m={m} sessionTitle={session?.title ?? ''} />)}
        <div ref={bottomRef} />
      </div>

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

function Message({ m, sessionTitle }: { m: OcMessageWithParts; sessionTitle: string }) {
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
          <Part key={p.id} p={p} sessionTitle={sessionTitle} />
        ))}
      </div>
    </article>
  );
}

function Part({ p, sessionTitle }: { p: OcPart; sessionTitle: string }) {
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
      return (
        <div className="part step">
          <button className="term" onClick={() => openCard('token', `step-finish: input ${s.tokens.input}, output ${s.tokens.output}, cache read ${s.tokens.cache.read}`)}>
            step
          </button>{' '}
          {s.reason} · in {fmtNum(s.tokens.input)} · out {fmtNum(s.tokens.output)} · cache {fmtNum(s.tokens.cache.read)} · ${s.cost.toFixed(4)}
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
    case 'patch': {
      const pp = p as Extract<OcPart, { type: 'patch' }>;
      return (
        <div className="part step">
          <button className="term" onClick={() => openCard('diff', `patch ${pp.hash}: ${pp.files.join(', ')}`)}>
            patch
          </button>{' '}
          {pp.files.join(', ')}
        </div>
      );
    }
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
  const cardId = TOOL_CARD[p.tool.toLowerCase()] ?? (p.tool.includes('_') ? 'mcp' : 'tool-call');
  const title = st.status === 'completed' || st.status === 'running' ? (st as any).title : undefined;
  const dur = st.status === 'completed' || st.status === 'error' ? fmtDuration(st.time.end - st.time.start) : null;
  const ctx = `会话「${sessionTitle}」中的工具调用 ${p.tool}\ninput: ${JSON.stringify(st.input).slice(0, 400)}`;
  return (
    <div className={`part tool status-${st.status}`}>
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
        {dur && <span className="muted">{dur}</span>}
        <button
          className="icon-btn"
          title="让 OpenCode 结合这次调用解释"
          onClick={(e) => {
            e.stopPropagation();
            void explain(`${p.tool} 工具在这一步做了什么`, ctx, cardId);
          }}
        >
          📖
        </button>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="tool-body">
          <h5>input</h5>
          <pre>{JSON.stringify(st.input, null, 2)}</pre>
          {st.status === 'completed' && (
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
        </div>
      )}
    </div>
  );
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
