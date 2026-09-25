import { useEffect, useState } from 'react';
import { CardDrawer } from './components/CardDrawer';
import { Timeline } from './panels/Timeline';
import { GitGraph } from './panels/GitGraph';
import { ArchGraph } from './panels/ArchGraph';
import { Knowledge } from './panels/Knowledge';
import { openCard, refreshSessions, selectSession, setState, useStore, type Tab } from './lib/store';
import { relTime } from './lib/format';
import { api } from './lib/api';

const TABS: { id: Tab; label: string }[] = [
  { id: 'timeline', label: '时间线' },
  { id: 'git', label: 'Git' },
  { id: 'arch', label: '架构' },
  { id: 'knowledge', label: '知识库' },
];

export function App() {
  const tab = useStore((s) => s.tab);
  const toast = useStore((s) => s.toast);
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <SessionList />
        <section className="content">
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setState({ tab: t.id })}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="panel">
            {tab === 'timeline' && <Timeline />}
            {tab === 'git' && <GitGraph />}
            {tab === 'arch' && <ArchGraph />}
            {tab === 'knowledge' && <Knowledge />}
          </div>
        </section>
        <CardDrawer />
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function TopBar() {
  const ws = useStore((s) => s.wsConnected);
  const oc = useStore((s) => s.opencodeConnected);
  const ocErr = useStore((s) => s.opencodeError);
  const server = useStore((s) => s.server);
  const git = useStore((s) => s.git);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!q.trim()) return setHits([]);
    const h = setTimeout(() => api.search(q).then(setHits).catch(() => setHits([])), 150);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">▦</span> PixelWeb
        <span className="muted"> · 在 coding agent 之上，边干活边学</span>
      </div>
      <div className="status">
        <span className={`pill ${ws ? 'ok' : 'bad'}`} title="PixelWeb 后端 WebSocket">
          <button className="term" onClick={() => openCard('websocket')}>WS</button> {ws ? '已连接' : '断开'}
        </span>
        <span className={`pill ${oc ? 'ok' : 'bad'}`} title={ocErr ?? server?.opencodeUrl}>
          <button className="term" onClick={() => openCard('coding-agent', `OpenCode @ ${server?.opencodeUrl}`)}>OpenCode</button>{' '}
          {oc ? '已连接' : '未连接'}
          {!oc && server && <span className="muted"> ({server.opencodeUrl})</span>}
        </span>
        {git && (
          <span className={`pill ${git.detached ? 'warn' : ''}`}>
            <button className="term" onClick={() => openCard(git.detached ? 'detached-head' : 'branch')}>
              {git.detached ? 'detached' : git.currentBranch}
            </button>
            {git.status.length > 0 && <span className="muted"> · {git.status.length} 变更</span>}
          </span>
        )}
        {server && (
          <span className="pill mono" title={server.projectRoot}>
            {server.projectRoot.split('/').filter(Boolean).slice(-1)[0]}
          </span>
        )}
      </div>
      <div className="search">
        <input placeholder="这是什么？搜索概念…" value={q} onChange={(e) => setQ(e.target.value)} />
        {hits.length > 0 && (
          <ul className="search-hits">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => {
                    openCard(h.id);
                    setQ('');
                  }}
                >
                  {h.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

function SessionList() {
  const sessions = useStore((s) => s.sessions);
  const err = useStore((s) => s.sessionsError);
  const selected = useStore((s) => s.selectedSession);
  const status = useStore((s) => s.status);
  const teaching = useStore((s) => s.teachingSessions);
  const [collapsed, setCollapsed] = useState(false);

  const roots = sessions.filter((s) => !s.parentID);
  const children = (id: string) => sessions.filter((s) => s.parentID === id);

  return (
    <aside className={`sessions ${collapsed ? 'collapsed' : ''}`}>
      <div className="sessions-head">
        <button className="icon-btn" onClick={() => setCollapsed(!collapsed)} title="折叠/展开">
          {collapsed ? '▸' : '▾'}
        </button>
        {!collapsed && (
          <>
            <button className="term strong" onClick={() => openCard('session')}>
              会话
            </button>
            <span className="muted">{sessions.length}</span>
            <button className="icon-btn" onClick={() => void refreshSessions()} title="刷新">
              ↻
            </button>
          </>
        )}
      </div>
      {!collapsed && (
        <ul className="session-list">
          {err && <li className="error">无法获取会话：{err}</li>}
          {roots.map((s) => (
            <SessionItem key={s.id} s={s} depth={0} />
          ))}
          {roots.length === 0 && !err && <li className="muted">还没有会话。在 OpenCode 里开始一段对话吧。</li>}
        </ul>
      )}
    </aside>
  );

  function SessionItem({ s, depth }: { s: (typeof sessions)[number]; depth: number }) {
    const isTeach = teaching.has(s.id) || s.title.startsWith('📖');
    return (
      <>
        <li className={`session-item ${selected === s.id ? 'selected' : ''} ${isTeach ? 'teach' : ''}`} style={{ paddingLeft: 10 + depth * 14 }} onClick={() => void selectSession(s.id)}>
          <span className={`dot ${status[s.id] === 'busy' ? 'busy' : ''}`} />
          <span className="title">{s.title || s.id}</span>
          <span className="muted small">
            {relTime(s.time.updated)}
            {s.summary && (s.summary.additions || s.summary.deletions) ? ` · +${s.summary.additions} −${s.summary.deletions}` : ''}
          </span>
        </li>
        {children(s.id).map((c) => (
          <SessionItem key={c.id} s={c} depth={depth + 1} />
        ))}
      </>
    );
  }
}
