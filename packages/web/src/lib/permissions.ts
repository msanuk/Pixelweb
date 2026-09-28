import type { OcPermission } from '@pixelweb/shared';

/**
 * One shape for permission requests from both OpenCode generations:
 * `permission.updated` ({ type, pattern, title, messageID, … }) and, since the
 * 1.x permission rework, `permission.asked` / `GET /permission`
 * ({ permission, patterns, always, tool: { messageID, callID } }).
 */
export function normalizePermission(raw: Record<string, any>): OcPermission | null {
  if (typeof raw?.id !== 'string' || typeof raw.sessionID !== 'string') return null;
  const type: string = raw.type ?? raw.permission ?? 'permission';
  const pattern: string | string[] | undefined = raw.pattern ?? (Array.isArray(raw.patterns) && raw.patterns.length ? raw.patterns : undefined);
  const what = Array.isArray(pattern) ? pattern.join(' ') : pattern;
  return {
    id: raw.id,
    type,
    pattern,
    sessionID: raw.sessionID,
    messageID: raw.messageID ?? raw.tool?.messageID ?? '',
    callID: raw.callID ?? raw.tool?.callID,
    title: raw.title ?? (what ? `${type} ${what}` : type),
    metadata: raw.metadata ?? {},
    time: raw.time ?? { created: Date.now() },
  };
}

/** The request a `permission.replied` event answers (`requestID` now, `permissionID` before). */
export function repliedPermissionID(props: Record<string, any>): string | undefined {
  return props?.requestID ?? props?.permissionID;
}
