import type {
  ArchGraph,
  ExplainRequest,
  ExplainResponse,
  GitSnapshot,
  KnowledgeCard,
  KnowledgeIndexEntry,
  LearningState,
  MasteryLevel,
  OcMessageWithParts,
  OcSession,
  PermissionResponse,
  ServerInfo,
} from '@pixelweb/shared';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
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
  info: () => req<ServerInfo>('/api/info'),
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
  search: (q: string) => req<KnowledgeIndexEntry[]>(`/api/knowledge/search?q=${encodeURIComponent(q)}`),
  learning: () => req<LearningState>('/api/learning'),
  seen: (cardId: string) => req<LearningState>('/api/learning/seen', { method: 'POST', body: JSON.stringify({ cardId }) }),
  quiz: (cardId: string, correct: boolean) =>
    req<LearningState>('/api/learning/quiz', { method: 'POST', body: JSON.stringify({ cardId, correct }) }),
  mastery: (cardId: string, mastery: MasteryLevel) =>
    req<LearningState>('/api/learning/mastery', { method: 'POST', body: JSON.stringify({ cardId, mastery }) }),
  explain: (body: ExplainRequest) => req<ExplainResponse>('/api/explain', { method: 'POST', body: JSON.stringify(body) }),
};
