import { useRef, useSyncExternalStore } from 'react';
import type {
  ArchGraph,
  CommitLink,
  GitSnapshot,
  KnowledgeIndexEntry,
  LearningState,
  ModelInfo,
  OcEvent,
  OcMessage,
  OcMessageWithParts,
  OcPart,
  OcPermission,
  OcSession,
  OcTodo,
} from '@pixelweb/shared';
import { api } from './api';
import { memoSelector, type Selector } from './select';

export { shallowEqual } from './select';
import { appendDelta } from './delta';
import { displayTitle } from './format';
import { normalizePermission, repliedPermissionID } from './permissions';

export type Tab = 'timeline' | 'git' | 'arch' | 'knowledge' | 'usage';

export interface FeedItem {
  at: number;
  type: string;
  sessionID?: string;
  summary: string;
}

export interface State {
  /** the server has --password set */
  authRequired: boolean;
  /** show the login screen instead of the app */
  needLogin: boolean;
  wsConnected: boolean;
  opencodeConnected: boolean;
  opencodeError?: string;
  server?: { version: string; opencodeUrl: string; projectRoot: string };
  sessions: OcSession[];
  sessionsError?: string;
  /** messages per session, in order */
  messages: Record<string, OcMessageWithParts[]>;
  loadingMessages: Record<string, boolean>;
  status: Record<string, 'idle' | 'busy' | 'retry'>;
  todos: Record<string, OcTodo[]>;
  permissions: OcPermission[];
  teachingSessions: Set<string>;
  git: GitSnapshot | null;
  /** commits the agent made, tied to the tool call that made them */
  commitLinks: CommitLink[];
  arch: ArchGraph | null;
  /** model token limits, for the context meter; null until OpenCode answers */
  modelInfo: ModelInfo | null;
  knowledge: KnowledgeIndexEntry[];
  terms: { term: string; cardId: string }[];
  learning: LearningState;
  feed: FeedItem[];
  // UI
  tab: Tab;
  selectedSession: string | null;
  openCard: string | null;
  /** context handed to "explain" — what the user was looking at */
  explainContext: string | null;
  toast: string | null;
  /** one-shot "jump here" requests between panels; the target panel consumes and clears them */
  archFocus: string | null;
  gitFocus: string | null;
  partFocus: string | null;
}

const initial: State = {
  authRequired: false,
  needLogin: false,
  wsConnected: false,
  opencodeConnected: false,
  sessions: [],
  messages: {},
  loadingMessages: {},
  status: {},
  todos: {},
  permissions: [],
  teachingSessions: new Set(),
  git: null,
  commitLinks: [],
  arch: null,
  modelInfo: null,
  knowledge: [],
  terms: [],
  learning: { records: {}, updatedAt: 0 },
  feed: [],
  tab: 'timeline',
  selectedSession: null,
  openCard: null,
  explainContext: null,
  toast: null,
  archFocus: null,
  gitFocus: null,
  partFocus: null,
};

let state: State = initial;
const listeners = new Set<() => void>();

export function getState(): State {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)): void {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * Select a slice of the store.
 *
 * Snapshots are compared with Object.is, so a selector that builds a new array/object per call
 * (`s.items.filter(...)`) MUST pass an `isEqual` (usually `shallowEqual`): the hook then keeps the
 * previous reference while the derived value is unchanged, instead of re-rendering forever.
 */
export function useStore<T>(selector: Selector<State, T>, isEqual?: (a: T, b: T) => boolean): T {
  // always call the latest inline selector, but keep one memo per hook instance
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const isEqualRef = useRef(isEqual);
  isEqualRef.current = isEqual;
  const memoRef = useRef<Selector<State, T> | null>(null);
  if (isEqual && !memoRef.current) memoRef.current = memoSelector(() => selectorRef.current, (a, b) => isEqualRef.current!(a, b));
  const get = isEqual ? () => memoRef.current!(state) : () => selectorRef.current(state);
  return useSyncExternalStore(subscribe, get, get);
}

// ---- actions -----------------------------------------------------------------

export async function loadInitial(): Promise<void> {
  api.learning().then((learning) => setState({ learning })).catch(() => {});
  api.info().then((i) => setState({ teachingSessions: new Set(i.teachingSessions) })).catch(() => {});
  await loadProjectData();
}

/** Everything that depends on which project the server visualises (cards too: a project can bring its own). */
async function loadProjectData(): Promise<void> {
  const [knowledge, terms] = await Promise.all([api.knowledge().catch(() => []), api.terms().catch(() => [])]);
  setState({ knowledge, terms });
  await loadOpencodeData();
}

/** What OpenCode serves; reloaded whenever it (re)connects, since it may have restarted or be another server. */
export async function loadOpencodeData(): Promise<void> {
  const open = state.selectedSession;
  // events missed while disconnected: keep the open timeline on screen while it refetches, drop the other cached ones
  setState((s) => ({ messages: open && s.messages[open] ? { [open]: s.messages[open] } : {} }));
  if (open) void loadMessages(open, true);
  await refreshSessions();
  void loadModels();
  void loadPermissions();
}

/**
 * Every `hello` names the project the server visualises. When it differs from the last one
 * (switched from this tab or another, or the server restarted with another --project),
 * drop what belonged to the old project; the server pushes the new git snapshot and graph itself.
 * A new OpenCode address (changed in 设置) drops what came from OpenCode; it reloads once that server connects (ws.ts).
 */
export function setServer(server: NonNullable<State['server']>): void {
  const prev = state.server;
  setState({ server });
  if (!prev || state.needLogin) return;
  const fromOpencode: Partial<State> = {
    sessions: [],
    sessionsError: undefined,
    messages: {},
    loadingMessages: {},
    status: {},
    todos: {},
    permissions: [],
    commitLinks: [],
    modelInfo: null,
    feed: [],
    selectedSession: null,
    partFocus: null,
  };
  if (prev.projectRoot !== server.projectRoot) {
    setState({ ...fromOpencode, git: null, arch: null, archFocus: null, gitFocus: null });
    void loadProjectData();
  } else if (prev.opencodeUrl !== server.opencodeUrl) {
    setState(fromOpencode);
  }
}

export async function switchProject(dir: string): Promise<void> {
  const { projectRoot } = await api.switchProject(dir);
  const name = projectRoot.split(/[\\/]/).filter(Boolean).pop() ?? projectRoot;
  toast(`已切换到项目「${name}」`);
}

/** Requests already waiting when the page opened (events only bring new ones). */
export async function loadPermissions(): Promise<void> {
  try {
    const pending = (await api.permissions()).map(normalizePermission).filter((p): p is OcPermission => !!p);
    setState((s) => ({ permissions: [...s.permissions.filter((x) => !pending.some((p) => p.id === x.id)), ...pending] }));
  } catch {
    /* OpenCode not reachable: live events still arrive once it is */
  }
}

export async function loadModels(): Promise<void> {
  try {
    setState({ modelInfo: await api.models() });
  } catch {
    /* OpenCode not reachable yet: retried when it connects */
  }
}

export async function refreshSessions(): Promise<void> {
  const root = state.server?.projectRoot;
  try {
    const [sessions, running] = await Promise.all([api.sessions(), api.sessionStatus().catch(() => ({}))]);
    if (root && state.server?.projectRoot !== root) return; // answered for the project we just left
    setState((s) => ({
      sessions,
      status: Object.fromEntries(Object.entries(running).map(([id, st]) => [id, st.type])),
      sessionsError: undefined,
      selectedSession: s.selectedSession ?? sessions[0]?.id ?? null,
    }));
  } catch (e) {
    setState({ sessionsError: e instanceof Error ? e.message : String(e) });
  }
}

export async function selectSession(id: string): Promise<void> {
  setState({ selectedSession: id, tab: 'timeline' });
  await loadMessages(id);
}

export async function loadMessages(id: string, force = false): Promise<void> {
  if (!force && state.messages[id]) return;
  setState((s) => ({ loadingMessages: { ...s.loadingMessages, [id]: true } }));
  try {
    const msgs = await api.messages(id);
    setState((s) => ({ messages: { ...s.messages, [id]: msgs }, loadingMessages: { ...s.loadingMessages, [id]: false } }));
  } catch {
    setState((s) => ({ loadingMessages: { ...s.loadingMessages, [id]: false } }));
  }
}

/** Jump to the architecture graph with the node holding this project-relative file selected. */
export function showInArch(relPath: string): void {
  setState({ tab: 'arch', archFocus: relPath, openCard: null });
}

/** Jump to the git graph with this commit selected. */
export function showCommit(hash: string): void {
  setState({ tab: 'git', gitFocus: hash, openCard: null });
}

/** Open a session's timeline scrolled to one tool call. */
export async function showPart(sessionID: string, partID: string): Promise<void> {
  setState({ partFocus: partID, openCard: null });
  await selectSession(sessionID);
}

export function openCard(id: string | null, context?: string): void {
  setState({ openCard: id, explainContext: context ?? null });
  if (id) void api.seen(id).then((learning) => setState({ learning })).catch(() => {});
}

export function toast(msg: string): void {
  setState({ toast: msg });
  setTimeout(() => setState((s) => (s.toast === msg ? { toast: null } : {})), 3500);
}

export async function explain(term: string, context?: string, cardId?: string): Promise<void> {
  try {
    const res = await api.explain({ term, context, cardId });
    setState((s) => ({
      teachingSessions: new Set([...s.teachingSessions, res.sessionID]),
      selectedSession: res.sessionID,
      tab: 'timeline',
      openCard: null,
    }));
    toast(`已开启教学会话「${displayTitle(res.title)}」，回答会实时出现在时间线`);
    await refreshSessions();
    await loadMessages(res.sessionID, true);
  } catch (e) {
    toast(`无法开启教学会话：${e instanceof Error ? e.message : e}（OpenCode 是否在运行？）`);
  }
}

// ---- event reducer ------------------------------------------------------------

function summarise(ev: OcEvent): string {
  const p = ev.properties as Record<string, any>;
  switch (ev.type) {
    case 'message.part.updated': {
      const part = p.part as OcPart;
      if (part.type === 'tool') return `tool ${(part as any).tool} · ${(part as any).state?.status}`;
      return `part ${part.type}`;
    }
    case 'session.status':
      return `status ${p.status?.type}`;
    case 'file.edited':
      return `edited ${p.file}`;
    case 'permission.updated':
    case 'permission.asked':
      return `permission: ${normalizePermission(p)?.title ?? ''}`;
    case 'session.created':
    case 'session.updated':
      return p.info?.title ?? '';
    default:
      return '';
  }
}

export function applyEvent(ev: OcEvent, at: number): void {
  const p = ev.properties as Record<string, any>;
  // one event per streamed chunk: kept out of the feed, and no update when the part isn't loaded
  if (ev.type === 'message.part.delta') {
    const messages = appendDelta(state.messages, p.sessionID, p.messageID, p.partID, p.field, p.delta);
    if (messages !== state.messages) setState({ messages });
    return;
  }
  const sessionID: string | undefined = p.sessionID ?? p.info?.sessionID ?? p.part?.sessionID ?? p.info?.id;

  const feedItem: FeedItem = { at, type: ev.type, sessionID, summary: summarise(ev) };
  const patch: Partial<State> = { feed: [feedItem, ...state.feed].slice(0, 300) };

  switch (ev.type) {
    case 'session.created':
    case 'session.updated': {
      const info = p.info as OcSession;
      const rest = state.sessions.filter((s) => s.id !== info.id);
      patch.sessions = [info, ...rest].sort((a, b) => b.time.updated - a.time.updated);
      if (!state.selectedSession) patch.selectedSession = info.id;
      break;
    }
    case 'session.deleted': {
      const info = p.info as OcSession;
      patch.sessions = state.sessions.filter((s) => s.id !== info.id);
      break;
    }
    case 'session.status': {
      patch.status = { ...state.status, [p.sessionID]: p.status?.type ?? 'idle' };
      break;
    }
    case 'session.idle': {
      patch.status = { ...state.status, [p.sessionID]: 'idle' };
      break;
    }
    case 'message.updated': {
      const info = p.info as OcMessage;
      patch.messages = upsertMessage(state.messages, info);
      break;
    }
    case 'message.removed': {
      const list = state.messages[p.sessionID];
      if (list) patch.messages = { ...state.messages, [p.sessionID]: list.filter((m) => m.info.id !== p.messageID) };
      break;
    }
    case 'message.part.updated': {
      const part = p.part as OcPart;
      patch.messages = upsertPart(state.messages, part, p.delta as string | undefined);
      break;
    }
    case 'message.part.removed': {
      const list = state.messages[p.sessionID];
      if (list) {
        patch.messages = {
          ...state.messages,
          [p.sessionID]: list.map((m) => (m.info.id === p.messageID ? { ...m, parts: m.parts.filter((x) => x.id !== p.partID) } : m)),
        };
      }
      break;
    }
    case 'permission.updated':
    case 'permission.asked': {
      const perm = normalizePermission(p);
      if (perm) patch.permissions = [...state.permissions.filter((x) => x.id !== perm.id), perm];
      break;
    }
    case 'permission.replied': {
      const id = repliedPermissionID(p);
      patch.permissions = state.permissions.filter((x) => x.id !== id);
      break;
    }
    case 'todo.updated': {
      patch.todos = { ...state.todos, [p.sessionID]: p.todos as OcTodo[] };
      break;
    }
  }
  setState(patch);
}

function upsertMessage(all: State['messages'], info: OcMessage): State['messages'] {
  const list = all[info.sessionID] ?? [];
  const idx = list.findIndex((m) => m.info.id === info.id);
  const next = idx >= 0 ? list.map((m, i) => (i === idx ? { ...m, info } : m)) : [...list, { info, parts: [] }];
  return { ...all, [info.sessionID]: next };
}

function upsertPart(all: State['messages'], part: OcPart, delta?: string): State['messages'] {
  const list = all[part.sessionID];
  if (!list) return all; // session not loaded: ignore, we'll fetch when opened
  let found = false;
  const next = list.map((m) => {
    if (m.info.id !== part.messageID) return m;
    found = true;
    const idx = m.parts.findIndex((x) => x.id === part.id);
    if (idx < 0) return { ...m, parts: [...m.parts, part] };
    const prev = m.parts[idx];
    // streaming text before 1.18: opencode sends the full part; delta is informational. Prefer full text.
    // (1.18+ streams through message.part.delta instead, see appendDelta)
    const merged = delta && 'text' in part && !(part as any).text ? { ...part, text: ((prev as any).text ?? '') + delta } : part;
    return { ...m, parts: m.parts.map((x, i) => (i === idx ? merged : x)) };
  });
  if (!found) {
    // message.updated may arrive after the first part: create a stub
    return {
      ...all,
      [part.sessionID]: [
        ...list,
        {
          info: { id: part.messageID, sessionID: part.sessionID, role: 'assistant', time: { created: Date.now() }, parentID: '', modelID: '', providerID: '', cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } },
          parts: [part],
        },
      ],
    };
  }
  return { ...all, [part.sessionID]: next };
}
