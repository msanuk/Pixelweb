import { describe, expect, it } from 'vitest';
import type { OcSession } from '@pixelweb/shared';
import { alertFor } from '../src/lib/alerts';
import { normalizePermission, repliedPermissionID } from '../src/lib/permissions';
import { DEFAULTS, parseSettings } from '../src/lib/settings';

const on = { ...DEFAULTS.notify, enabled: true };
const session = { id: 'ses_1', title: '修复登录页', time: { created: 0, updated: 0 } } as OcSession;
const ev = (type: string, properties: Record<string, unknown>) => ({ type, properties });

describe('alertFor', () => {
  it('announces a session going from busy to idle, once', () => {
    const idle = ev('session.status', { sessionID: 'ses_1', status: { type: 'idle' } });
    expect(alertFor(idle, 'busy', session, on)).toMatchObject({ title: 'agent 完成了', body: '修复登录页', sessionID: 'ses_1' });
    // the session.idle that follows sees the status already idle
    expect(alertFor(ev('session.idle', { sessionID: 'ses_1' }), 'idle', session, on)).toBeNull();
  });

  it('announces permission requests in both OpenCode formats', () => {
    const asked = ev('permission.asked', { id: 'per_1', sessionID: 'ses_1', permission: 'bash', patterns: ['npm test'], metadata: {}, always: [] });
    expect(alertFor(asked, 'busy', session, on)).toMatchObject({ tag: 'perm:per_1', body: '修复登录页：bash npm test' });
    const legacy = ev('permission.updated', { id: 'per_2', sessionID: 'ses_1', type: 'bash', pattern: 'rm -rf dist', title: 'rm -rf dist', messageID: 'm', metadata: {}, time: { created: 0 } });
    expect(alertFor(legacy, 'busy', session, on)?.body).toBe('修复登录页：rm -rf dist');
  });

  it('reports errors but not a user-pressed stop', () => {
    const err = (name: string) => ev('session.error', { sessionID: 'ses_1', error: { name, data: { message: 'rate limited' } } });
    expect(alertFor(err('APIError'), 'busy', session, on)?.body).toBe('修复登录页：rate limited');
    expect(alertFor(err('MessageAbortedError'), 'busy', session, on)).toBeNull();
  });

  it('stays quiet when disabled, per kind, and for subtasks', () => {
    const idle = ev('session.status', { sessionID: 'ses_1', status: { type: 'idle' } });
    expect(alertFor(idle, 'busy', session, DEFAULTS.notify)).toBeNull();
    expect(alertFor(idle, 'busy', session, { ...on, done: false })).toBeNull();
    expect(alertFor(idle, 'busy', { ...session, parentID: 'ses_0' }, on)).toBeNull();
  });
});

describe('normalizePermission', () => {
  it('maps the 1.x request shape onto the legacy one', () => {
    const p = normalizePermission({ id: 'per_1', sessionID: 's', permission: 'edit', patterns: ['src/a.ts'], metadata: {}, always: [], tool: { messageID: 'm', callID: 'c' } });
    expect(p).toMatchObject({ id: 'per_1', type: 'edit', pattern: ['src/a.ts'], messageID: 'm', callID: 'c', title: 'edit src/a.ts' });
    expect(normalizePermission({ sessionID: 's' })).toBeNull();
  });

  it('reads the replied id from either field', () => {
    expect(repliedPermissionID({ requestID: 'per_1' })).toBe('per_1');
    expect(repliedPermissionID({ permissionID: 'per_2' })).toBe('per_2');
  });
});

describe('parseSettings', () => {
  it('fills gaps with defaults and rejects junk', () => {
    expect(parseSettings(null)).toEqual(DEFAULTS);
    expect(parseSettings('{not json')).toEqual(DEFAULTS);
    const s = parseSettings(JSON.stringify({ scale: 110, density: 'compact', notify: { enabled: true, error: 'yes' } }));
    expect(s).toMatchObject({ scale: 110, density: 'compact', highlightTerms: true });
    expect(s.notify).toEqual({ ...DEFAULTS.notify, enabled: true });
    expect(parseSettings(JSON.stringify({ scale: 300 })).scale).toBe(100);
  });
});
