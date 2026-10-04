import type { GuideModel, GuideStreamMessage, OcMessage, OcMessageWithParts, OcPart, OcPermission } from '@pixelweb/shared';
import { normalizePermission, repliedPermissionID } from '@web/lib/permissions';

/** One guide session as the side panel shows it, rebuilt from the server's SSE stream. */
export interface Conversation {
  /** false until the first snapshot */
  loaded: boolean;
  messages: OcMessageWithParts[];
  busy: boolean;
  /** shell commands waiting for approval in PixelWeb (the extension can't approve them) */
  permissions: OcPermission[];
  /** whether PixelWeb can reach OpenCode */
  opencode: boolean;
  /** the session's last error, e.g. the provider refusing the request */
  error?: string;
  /** the model the session runs on; undefined until the snapshot, null if PixelWeb couldn't tell */
  model?: GuideModel | null;
}

export const EMPTY: Conversation = { loaded: false, messages: [], busy: false, permissions: [], opencode: true };

export function applyStream(c: Conversation, m: GuideStreamMessage): Conversation {
  switch (m.type) {
    case 'snapshot':
      return {
        ...c,
        loaded: true,
        messages: m.messages,
        busy: m.busy,
        permissions: m.permissions.map((p) => normalizePermission(p as Record<string, unknown>)).filter((p): p is OcPermission => !!p),
        error: undefined,
        model: m.model ?? null,
      };
    case 'opencode.status':
      return { ...c, opencode: m.connected };
    case 'error':
      return { ...c, error: m.error };
    case 'event':
      return applyEvent(c, m.event.type, m.event.properties as Record<string, any>);
  }
}

function applyEvent(c: Conversation, type: string, p: Record<string, any>): Conversation {
  switch (type) {
    case 'session.status':
      return { ...c, busy: (p.status?.type ?? 'idle') !== 'idle', ...(p.status?.type === 'busy' ? { error: undefined } : {}) };
    case 'session.idle':
      return { ...c, busy: false };
    case 'session.error': {
      const e = p.error as { name?: string; data?: { message?: string } } | undefined;
      // stopping a reply is not an error worth a red box
      if (!e || e.name === 'MessageAbortedError') return c;
      return { ...c, error: e.data?.message || e.name };
    }
    case 'message.updated':
      return { ...c, messages: upsertMessage(c.messages, p.info as OcMessage) };
    case 'message.removed':
      return { ...c, messages: c.messages.filter((m) => m.info.id !== p.messageID) };
    case 'message.part.updated':
      return { ...c, messages: upsertPart(c.messages, p.part as OcPart) };
    case 'message.part.delta':
      return { ...c, messages: appendDelta(c.messages, p.messageID, p.partID, p.field, p.delta) };
    case 'message.part.removed':
      return {
        ...c,
        messages: c.messages.map((m) => (m.info.id === p.messageID ? { ...m, parts: m.parts.filter((x) => x.id !== p.partID) } : m)),
      };
    case 'permission.updated':
    case 'permission.asked': {
      const perm = normalizePermission(p);
      return perm ? { ...c, permissions: [...c.permissions.filter((x) => x.id !== perm.id), perm] } : c;
    }
    case 'permission.replied': {
      const id = repliedPermissionID(p);
      return { ...c, permissions: c.permissions.filter((x) => x.id !== id) };
    }
    default:
      return c;
  }
}

function upsertMessage(list: OcMessageWithParts[], info: OcMessage): OcMessageWithParts[] {
  const idx = list.findIndex((m) => m.info.id === info.id);
  if (idx < 0) return [...list, { info, parts: [] }];
  return list.map((m, i) => (i === idx ? { ...m, info } : m));
}

function upsertPart(list: OcMessageWithParts[], part: OcPart): OcMessageWithParts[] {
  const idx = list.findIndex((m) => m.info.id === part.messageID);
  if (idx < 0) {
    // the part can arrive before its message.updated: hold it under a stub until the info comes
    const stub = { id: part.messageID, sessionID: part.sessionID, role: 'assistant', time: { created: Date.now() } } as OcMessage;
    return [...list, { info: stub, parts: [part] }];
  }
  return list.map((m, i) => {
    if (i !== idx) return m;
    const at = m.parts.findIndex((x) => x.id === part.id);
    return { ...m, parts: at < 0 ? [...m.parts, part] : m.parts.map((x, j) => (j === at ? part : x)) };
  });
}

/** OpenCode ≥ 1.18 streams text as `message.part.delta` and sends the whole part only at its start and end. */
function appendDelta(list: OcMessageWithParts[], messageID: string, partID: string, field: string, delta: unknown): OcMessageWithParts[] {
  if (typeof delta !== 'string' || typeof field !== 'string') return list;
  return list.map((m) => {
    if (m.info.id !== messageID) return m;
    return {
      ...m,
      parts: m.parts.map((x) => {
        if (x.id !== partID) return x;
        const prev = (x as unknown as Record<string, unknown>)[field];
        return { ...x, [field]: (typeof prev === 'string' ? prev : '') + delta } as OcPart;
      }),
    };
  });
}
