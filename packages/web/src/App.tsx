import { useEffect, useRef, useState } from 'react';
import { CardDrawer } from './components/CardDrawer';
import { Icon, type IconName } from './components/Icon';
import { Timeline } from './panels/Timeline';
import { GitGraph } from './panels/GitGraph';
import { ArchGraph } from './panels/ArchGraph';
import { Knowledge } from './panels/Knowledge';
import { openCard, refreshSessions, selectSession, setState, useStore, type Tab } from './lib/store';
import { displayTitle, isTeachingTitle, relTime } from './lib/format';
import { api } from './lib/api';
import { THEMES, setTheme, useTheme } from './lib/theme';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'timeline', label: '时间线', icon: 'timeline' },
  { id: 'git', label: 'Git', icon: 'git' },
  { id: 'arch', label: '架构', icon: 'arch' },
  { id: 'knowledge', label: '知识库', icon: 'book' },
];

/*
 * Layout: [nav rail] [sessions — timeline only] [page] [inspector].
 * The inspector (concept card) shares the right-hand slot with a page's own
 * detail pane: pages hide their side pane while a card is open, so there is
 * never more than one right column.
 */
export function App() {
  const tab = useStore((s) => s.tab);
  const toast = useStore((s) => s.toast);
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <NavRail />
        {tab === 'timeline' && <SessionList />}
        <section className="content">
          {tab === 'timeline' && <Timeline />}
          {tab === 'git' && <GitGraph />}
          {tab === 'arch' && <ArchGraph />}
          {tab === 'knowledge' && <Knowledge />}
        </section>
        <CardDrawer />
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function NavRail() {
  const tab = useStore((s) => s.tab);
  return (
    <nav className="rail" aria-label="页面">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setState({ tab: t.id })}>
          <Icon name={t.icon} size={18} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

function TopBar() {
  const git = useStore((s) => s.git);
  const server = useStore((s) => s.server);
  const project = server?.projectRoot.split('/').filter(Boolean).slice(-1)[0];

  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="当前项目">
        <span className="brand">
          <span className="logo">▦</span> PixelWeb
        </span>
        {project && (
          <>
            <span className="sep">/</span>
            <span className="mono" title={server?.projectRoot}>
              {project}
            </span>
          </>
        )}
        {git && (
          <>
            <span className="sep">/</span>
            <button className={`term mono ${git.detached ? 'warn-text' : ''}`} onClick={() => openCard(git.detached ? 'detached-head' : 'branch')}>
              {git.detached ? `detached @ ${git.head?.slice(0, 7)}` : git.currentBranch}
            </button>
            {git.status.length > 0 && (
              <button className="link-btn muted" onClick={() => setState({ tab: 'git' })} title="查看工作区变更">
                {git.status.length} 处变更
              </button>
            )}
          </>
        )}
      </nav>
      <ConnectionStatus />
      <ThemeSwitch />
      <ConceptSearch />
    </header>
  );
}

/** Quiet when everything is connected; spells out what's wrong when it isn't. */
function ConnectionStatus() {
  const ws = useStore((s) => s.wsConnected);
  const oc = useStore((s) => s.opencodeConnected);
  const ocErr = useStore((s) => s.opencodeError);
  const server = useStore((s) => s.server);
  const ok = ws && oc;
  return (
    <span className={`conn ${ok ? 'ok' : 'bad'}`} title={`PixelWeb 后端：${ws ? '已连接' : '断开'}\nOpenCode：${oc ? '已连接' : '未连接'} ${server?.opencodeUrl ?? ''}${ocErr ? `\n${ocErr}` : ''}`}>
      <span className="dot" />
      {!ws ? (
        <>
          后端
          <button className="term" onClick={() => openCard('websocket')}>
            WebSocket
          </button>
          断开
        </>
      ) : (
        <>
          <button className="term" onClick={() => openCard('coding-agent', `OpenCode @ ${server?.opencodeUrl}`)}>
            OpenCode
          </button>
          {oc ? '' : ` 未连接${server ? `（${server.opencodeUrl}）` : ''}`}
        </>
      )}
    </span>
  );
}

function ThemeSwitch() {
  const theme = useTheme();
  return (
    <div className="seg" role="radiogroup" aria-label="主题">
      {THEMES.map((t) => (
        <button key={t.id} role="radio" aria-checked={theme === t.id} className={theme === t.id ? 'on' : ''} onClick={() => setTheme(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ConceptSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ id: string; title: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!q.trim()) return setHits([]);
    const h = setTimeout(() => api.search(q).then(setHits).catch(() => setHits([])), 150);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pick = (id: string) => {
    openCard(id);
    setQ('');
    inputRef.current?.blur();
  };

  return (
    <div className="search">
      <Icon name="search" size={14} />
      <input
        ref={inputRef}
        placeholder="搜索概念…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) pick(hits[0].id);
          if (e.key === 'Escape') setQ('');
        }}
      />
      <kbd>⌘K</kbd>
      {hits.length > 0 && (
        <ul className="search-hits">
          {hits.map((h) => (
            <li key={h.id}>
              <button onClick={() => pick(h.id)}>{h.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
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

  if (collapsed) {
    return (
      <aside className="sessions collapsed">
        <button className="icon-btn" onClick={() => setCollapsed(false)} title="展开会话列表" aria-label="展开会话列表">
          <Icon name="expand" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sessions">
      <div className="sessions-head">
        <button className="term strong" onClick={() => openCard('session')}>
          会话
        </button>
        <span className="muted">{sessions.length}</span>
        <span className="spacer" />
        <button className="icon-btn" onClick={() => void refreshSessions()} title="刷新" aria-label="刷新会话">
          <Icon name="refresh" size={14} />
        </button>
        <button className="icon-btn" onClick={() => setCollapsed(true)} title="收起" aria-label="收起会话列表">
          <Icon name="collapse" size={14} />
        </button>
      </div>
      <ul className="session-list">
        {err && <li className="error">无法获取会话：{err}</li>}
        {roots.map((s) => (
          <SessionItem key={s.id} s={s} depth={0} />
        ))}
        {roots.length === 0 && !err && <li className="muted empty-hint">还没有会话。在 OpenCode 里开始一段对话吧。</li>}
      </ul>
    </aside>
  );

  function SessionItem({ s, depth }: { s: (typeof sessions)[number]; depth: number }) {
    const isTeach = teaching.has(s.id) || isTeachingTitle(s.title);
    return (
      <>
        <li className={`session-item ${selected === s.id ? 'selected' : ''}`} style={{ paddingLeft: 12 + depth * 14 }} onClick={() => void selectSession(s.id)}>
          <span className={`dot ${status[s.id] === 'busy' ? 'busy' : ''}`} />
          <span className="title">
            {isTeach && (
              <span className="teach-mark" title="教学会话（只读）">
                <Icon name="book" size={12} />
              </span>
            )}
            {displayTitle(s.title) || s.id}
          </span>
          <span className="muted small">
            {isTeach ? '教学 · ' : depth > 0 ? '子任务 · ' : ''}
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
