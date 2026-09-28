import type {
  ArchGraph,
  ExplainRequest,
  ExplainResponse,
  GitSnapshot,
  KnowledgeCard,
  KnowledgeIndexEntry,
  LearningState,
  MasteryLevel,
  ModelInfo,
  OcMessageWithParts,
  OcSession,
  PermissionResponse,
  ProjectOption,
  ServerInfo,
} from '@pixelweb/shared';

let onUnauthorized = () => {};
/** Called when any API call answers 401 (session expired, server restarted): the app shows the login screen. */
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  // only declare JSON when there is a body: Fastify rejects an empty body sent as application/json
  const headers = init?.body ? { 'content-type': 'application/json', ...(init.headers ?? {}) } : init?.headers;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && url !== '/api/login') onUnauthorized();
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: () => req<{ required: boolean; authenticated: boolean }>('/api/auth'),
  login: (password: string) => req<{ ok: boolean }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: boolean }>('/api/logout', { method: 'POST' }),
  info: () => req<ServerInfo>('/api/info'),
  projects: () => req<ProjectOption[]>('/api/projects'),
  switchProject: (dir: string) => req<{ projectRoot: string }>('/api/project', { method: 'POST', body: JSON.stringify({ dir }) }),
  models: () => req<ModelInfo>('/api/models'),
  permissions: () => req<Record<string, unknown>[]>('/api/permissions'),
  sessions: () => req<OcSession[]>('/api/sessions'),
  messages: (id: string) => req<OcMessageWithParts[]>(`/api/sessions/${encodeURIComponent(id)}/messages`),
  abort: (id: string) => req(`/api/sessions/${encodeURIComponent(id)}/abort`, { method: 'POST' }),
  prompt: (id: string, text: string) =>
    req(`/api/sessions/${encodeURIComponent(id)}/prompt`, { method: 'POST', body: JSON.stringify({ text }) }),
  replyPermission: (sessionID: string, permissionID: string, response: PermissionResponse) =>
    req<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(sessionID)}/permissions/${encodeURIComponent(permissionID)}`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    }),
  git: () => req<GitSnapshot | null>('/api/git'),
  gitDiff: (path: string) => req<{ path: string; diff: string }>(`/api/git/diff?path=${encodeURIComponent(path)}`),
  arch: (level: 'file' | 'dir', refresh = false) => req<ArchGraph>(`/api/arch?level=${level}${refresh ? '&refresh=1' : ''}`),
  knowledge: () => req<KnowledgeIndexEntry[]>('/api/knowledge'),
  terms: () => req<{ term: string; cardId: string }[]>('/api/knowledge/terms'),
  card: (id: string) => req<KnowledgeCard>(`/api/knowledge/${encodeURIComponent(id)}`),
  toolCard: (tool: string) => req<KnowledgeCard>(`/api/knowledge/tool/${encodeURIComponent(tool)}`),
  learning: () => req<LearningState>('/api/learning'),
  seen: (cardId: string) => req<LearningState>('/api/learning/seen', { method: 'POST', body: JSON.stringify({ cardId }) }),
  quiz: (cardId: string, correct: boolean) =>
    req<LearningState>('/api/learning/quiz', { method: 'POST', body: JSON.stringify({ cardId, correct }) }),
  notes: (cardId: string, notes: string) =>
    req<LearningState>('/api/learning/notes', { method: 'POST', body: JSON.stringify({ cardId, notes }) }),
  mastery: (cardId: string, mastery: MasteryLevel) =>
    req<LearningState>('/api/learning/mastery', { method: 'POST', body: JSON.stringify({ cardId, mastery }) }),
  explain: (body: ExplainRequest) => req<ExplainResponse>('/api/explain', { method: 'POST', body: JSON.stringify(body) }),
};
