import { useSyncExternalStore } from 'react';
import type {
  ArchGraph,
  GitSnapshot,
  KnowledgeIndexEntry,
  LearningState,
  OcEvent,
  OcMessage,
  OcMessageWithParts,
  OcPart,
  OcPermission,
  OcSession,
  OcTodo,
} from '@pixelweb/shared';
import { api } from './api';
import { displayTitle } from './format';

export type Tab = 'timeline' | 'git' | 'arch' | 'knowledge';

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
  arch: ArchGraph | null;
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
  arch: null,
  knowledge: [],
  terms: [],
  learning: { records: {}, updatedAt: 0 },
  feed: [],
  tab: 'timeline',
  selectedSession: null,
  openCard: null,
  explainContext: null,
  toast: null,
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

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
    () => selector(state),
  );
}

// ---- actions -----------------------------------------------------------------

export async function loadInitial(): Promise<void> {
  const [knowledge, terms, learning] = await Promise.all([
    api.knowledge().catch(() => []),
    api.terms().catch(() => []),
    api.learning().catch(() => initial.learning),
  ]);
  setState({ knowledge, terms, learning });
  await refreshSessions();
  api.info().then((i) => setState({ teachingSessions: new Set(i.teachingSessions) })).catch(() => {});
}

export async function refreshSessions(): Promise<void> {
  try {
    const sessions = await api.sessions();
    setState((s) => ({
      sessions,
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
      return `permission: ${p.title}`;
    case 'session.created':
    case 'session.updated':
      return p.info?.title ?? '';
    default:
      return '';
  }
}

export function applyEvent(ev: OcEvent, at: number): void {
  const p = ev.properties as Record<string, any>;
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
    case 'permission.updated': {
      const perm = p as unknown as OcPermission;
      patch.permissions = [...state.permissions.filter((x) => x.id !== perm.id), perm];
      break;
    }
    case 'permission.replied': {
      patch.permissions = state.permissions.filter((x) => x.id !== p.permissionID);
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
    // streaming text: opencode sends the full part; delta is informational. Prefer full text.
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
