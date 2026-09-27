import type { OcEvent, OcSession } from '@pixelweb/shared';
import { displayTitle } from './format';
import { normalizePermission } from './permissions';
import type { Settings } from './settings';

export interface Alert {
  /** same tag = same notification: repeats replace instead of stacking (also across tabs) */
  tag: string;
  title: string;
  body: string;
  sessionID?: string;
}

/**
 * Whether an OpenCode event deserves a notification. Subtask sessions stay
 * quiet (their parent reports), and a user-pressed stop is not an error.
 */
export function alertFor(ev: OcEvent, prevStatus: string | undefined, session: OcSession | undefined, prefs: Settings['notify']): Alert | null {
  if (!prefs.enabled || session?.parentID) return null;
  const p = ev.properties as Record<string, any>;
  const sid: string | undefined = p.sessionID;
  const name = session ? displayTitle(session.title) || session.id : sid ?? '';
  switch (ev.type) {
    case 'session.status':
    case 'session.idle': {
      const now = ev.type === 'session.idle' ? 'idle' : p.status?.type;
      if (!prefs.done || !sid || now !== 'idle' || prevStatus !== 'busy') return null;
      return { tag: `done:${sid}`, title: 'agent 完成了', body: name, sessionID: sid };
    }
    case 'permission.asked':
    case 'permission.updated': {
      const perm = normalizePermission(p);
      if (!prefs.permission || !perm) return null;
      return { tag: `perm:${perm.id}`, title: '需要你批准', body: `${name}：${perm.title}`, sessionID: perm.sessionID };
    }
    case 'session.error': {
      const err = p.error as { name?: string; data?: { message?: string } } | undefined;
      if (!prefs.error || err?.name === 'MessageAbortedError') return null;
      return { tag: `err:${sid ?? 'global'}`, title: 'agent 出错了', body: `${name ? name + '：' : ''}${err?.data?.message ?? err?.name ?? '未知错误'}`, sessionID: sid };
    }
    default:
      return null;
  }
}
