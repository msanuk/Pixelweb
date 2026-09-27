import type { OcEvent } from '@pixelweb/shared';
import { alertFor, type Alert } from './alerts';
import { getSettings } from './settings';
import { getState, selectSession } from './store';

export type NotifySupport = 'ok' | 'insecure' | 'unsupported';

/** System notifications need a secure context: HTTPS or localhost, not http://<server-ip>. */
export function notifySupport(): NotifySupport {
  if (!window.isSecureContext) return 'insecure';
  return 'Notification' in window ? 'ok' : 'unsupported';
}

export function notifyPermission(): NotificationPermission | null {
  return notifySupport() === 'ok' ? Notification.permission : null;
}

/** Turns notifications on, asking the browser for permission (must run from a click). */
export async function enableNotifications(): Promise<NotificationPermission | null> {
  if (notifySupport() === 'ok' && Notification.permission === 'default') await Notification.requestPermission();
  return notifyPermission();
}

// ---- delivery: a system notification when allowed, plus an unread count in the tab title while away

const BASE_TITLE = document.title;
let unseen = 0;

function away(): boolean {
  return document.visibilityState === 'hidden' || !document.hasFocus();
}

function clearBadge(): void {
  if (!unseen) return;
  unseen = 0;
  document.title = BASE_TITLE;
}
window.addEventListener('focus', clearBadge);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && clearBadge());

export function deliver(a: Alert, onlyWhenHidden: boolean): void {
  if (onlyWhenHidden && !away()) return;
  if (away()) document.title = `(${++unseen}) ${BASE_TITLE}`;
  if (notifyPermission() !== 'granted') return;
  const n = new Notification(a.title, { body: a.body, tag: a.tag });
  n.onclick = () => {
    window.focus();
    if (a.sessionID) void selectSession(a.sessionID);
    n.close();
  };
}

/** Called for every OpenCode event, with the session's status from before the event was applied. */
export function onOpencodeEvent(ev: OcEvent, prevStatus: string | undefined): void {
  const prefs = getSettings().notify;
  if (!prefs.enabled) return;
  const sid = (ev.properties as { sessionID?: string }).sessionID;
  const session = sid ? getState().sessions.find((s) => s.id === sid) : undefined;
  const alert = alertFor(ev, prevStatus, session, prefs);
  if (alert) deliver(alert, prefs.onlyWhenHidden);
}
