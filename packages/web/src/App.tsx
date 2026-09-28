import { useEffect, useMemo, useState } from 'react';
import { CardDrawer } from './components/CardDrawer';
import { SettingsDialog } from './components/Settings';
import { CommandPalette, PaletteTrigger } from './components/CommandPalette';
import { ProjectPicker } from './components/ProjectPicker';
import { Icon, type IconName } from './components/Icon';
import { Timeline } from './panels/Timeline';
import { GitGraph } from './panels/GitGraph';
import { ArchGraph } from './panels/ArchGraph';
import { Knowledge } from './panels/Knowledge';
import { openCard, refreshSessions, selectSession, setState, useStore, type Tab } from './lib/store';
import { displayTitle, isTeachingTitle, relTime } from './lib/format';
import { api } from './lib/api';
import { descendants, sessionTree, subagentTitle } from './lib/sessions';
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
  const needLogin = useStore((s) => s.needLogin);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // the two dialogs never stack: opening one closes the other
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key === ',') {
        e.preventDefault();
        setPaletteOpen(false);
        setSettingsOpen((o) => !o);
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSettingsOpen(false);
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (needLogin) return <Login />;
  return (
    <div className="app">
      <TopBar onOpenPalette={() => setPaletteOpen(true)} />
      <div className="main">
        <NavRail onSettings={() => setSettingsOpen(true)} />
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
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onOpenSettings={() => setSettingsOpen(true)} />}
    </div>
  );
}

function NavRail({ onSettings }: { onSettings: () => void }) {
  const tab = useStore((s) => s.tab);
  const authRequired = useStore((s) => s.authRequired);
  return (
    <nav className="rail" aria-label="页面">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setState({ tab: t.id })}>
          <Icon name={t.icon} size={18} />
          <span>{t.label}</span>
        </button>
      ))}
      <button className="rail-bottom" title="设置（⌘,）" onClick={onSettings}>
        <Icon name="settings" size={18} />
        <span>设置</span>
      </button>
      {authRequired && (
        <button
          title="退出登录"
          onClick={() => void api.logout().finally(() => location.reload())}
        >
          <Icon name="logout" size={18} />
          <span>退出</span>
        </button>
      )}
    </nav>
  );
}

function Login() {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!password) return setErr('请输入密码');
    setBusy(true);
    setErr(null);
    try {
      await api.login(password);
      location.reload(); // start fresh: open the WebSocket and load data with the new session
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <main className="login">
      <form
        className="login-box"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1 className="brand">
          <span className="logo">▦</span> PixelWeb
        </h1>
        <p className="muted small">这个 PixelWeb 设置了访问密码。</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="密码"
          value={password}
          onChange={(e) => (setPassword(e.target.value), setErr(null))}
          aria-invalid={!!err}
          aria-describedby={err ? 'login-err' : undefined}
        />
        {err && (
          <p id="login-err" className="error small">
            {err}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </main>
  );
}

function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const git = useStore((s) => s.git);
  const server = useStore((s) => s.server);

  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="当前项目">
        <span className="brand">
          <span className="logo">▦</span> PixelWeb
        </span>
        {server && (
          <>
            <span className="sep">/</span>
            <ProjectPicker />
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
      <PaletteTrigger onOpen={onOpenPalette} />
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

function SessionList() {
  const sessions = useStore((s) => s.sessions);
  const err = useStore((s) => s.sessionsError);
  const selected = useStore((s) => s.selectedSession);
  const status = useStore((s) => s.status);
  const teaching = useStore((s) => s.teachingSessions);
  const [collapsed, setCollapsed] = useState(false);
  // explicit open/closed per parent; unset means "open while it matters" (see SessionItem)
  const [expanded, setExpanded] = useState<Map<string, boolean>>(new Map());

  const tree = useMemo(() => sessionTree(sessions), [sessions]);
  const roots = tree.roots;

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
        <span className="muted" title={`${roots.length} 个会话，${sessions.length - roots.length} 个子任务`}>
          {roots.length}
          {sessions.length > roots.length && ` + ${sessions.length - roots.length} 子任务`}
        </span>
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
    const sub = depth > 0 ? subagentTitle(s.title) : null;
    const kids = tree.children.get(s.id) ?? [];
    const below = kids.length ? descendants(tree, s.id) : [];
    const busyBelow = below.filter((c) => status[c.id] === 'busy').length;
    const open = expanded.get(s.id) ?? (selected === s.id || busyBelow > 0 || below.some((c) => c.id === selected));
    const toggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((m) => new Map(m).set(s.id, !open));
    };
    return (
      <li className={depth > 0 ? 'subtask' : 'root'}>
        <div
          className={`session-item ${depth > 0 ? 'sub' : ''} ${selected === s.id ? 'selected' : ''}`}
          onClick={() => void selectSession(s.id)}
          title={depth > 0 ? `子任务${sub ? `（@${sub.agent}）` : ''}：${s.title}` : undefined}
        >
          <span className={`dot ${status[s.id] === 'busy' ? 'busy' : ''}`} />
          <span className="title">
            {isTeach && (
              <span className="teach-mark" title="教学会话（只读）">
                <Icon name="book" size={12} />
              </span>
            )}
            <span className="title-text">{(sub?.title ?? displayTitle(s.title)) || s.id}</span>
          </span>
          <span className="muted small meta-line">
            {sub && <span className="agent-chip mono">@{sub.agent}</span>}
            {isTeach ? '教学 · ' : ''}
            {relTime(s.time.updated)}
            {s.summary && (s.summary.additions || s.summary.deletions) ? ` · +${s.summary.additions} −${s.summary.deletions}` : ''}
            {kids.length > 0 && (
              <button className="subtask-toggle" onClick={toggle} aria-expanded={open} title={open ? '收起子任务' : '展开子任务'}>
                <Icon name={open ? 'down' : 'expand'} size={11} />
                {below.length} 个子任务{busyBelow > 0 && !open ? ` · ${busyBelow} 个运行中` : ''}
              </button>
            )}
          </span>
        </div>
        {open && kids.length > 0 && (
          <ul className="subtasks">
            {kids.map((c) => (
              <SessionItem key={c.id} s={c} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }
}
