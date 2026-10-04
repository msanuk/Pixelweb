import { describe, expect, it } from 'vitest';
import { vendorOf } from '@pixelweb/shared/capture';
import { CONSOLE_HOSTS, manifest } from '../src/manifest';

describe('manifest', () => {
  it('only asks for what the side panel uses', () => {
    const m = manifest('1.2.3');
    expect(m.version).toBe('1.2.3');
    expect(m.permissions).toEqual(['sidePanel', 'scripting', 'storage', 'contextMenus', 'activeTab']);
    expect(m.host_permissions).toEqual(CONSOLE_HOSTS);
    expect(m.host_permissions.some((h) => h.includes('127.0.0.1') || h.includes('localhost'))).toBe(false);
  });

  it('adds loopback only to the e2e build', () => {
    expect(manifest('1.0.0', { e2e: true }).host_permissions).toContain('http://127.0.0.1/*');
  });

  it('can read every console the guide knows a vendor for', () => {
    for (const pattern of CONSOLE_HOSTS) {
      const host = pattern.replace(/^https:\/\/(\*\.)?/, '').replace(/\/\*$/, '');
      expect(vendorOf(host), pattern).not.toBeNull();
    }
  });
});
