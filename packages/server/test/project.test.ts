import { describe, expect, it } from 'vitest';
import { belongsTo, normPath, samePath, toProjectOptions } from '../src/project.js';

describe('normPath / samePath', () => {
  it('ignores trailing slashes and separator style', () => {
    expect(samePath('/home/me/app/', '/home/me/app')).toBe(true);
    expect(samePath('D:\\work\\app', 'd:/work/app/')).toBe(true);
    expect(samePath('/home/me/app', '/home/me/App')).toBe(false);
    expect(normPath('/')).toBe('/');
  });
});

describe('belongsTo', () => {
  it('keeps untagged events and events from the project or a subfolder', () => {
    expect(belongsTo(undefined, '/p/app')).toBe(true);
    expect(belongsTo('global', '/p/app')).toBe(true);
    expect(belongsTo('/p/app', '/p/app')).toBe(true);
    expect(belongsTo('/p/app/packages/web', '/p/app')).toBe(true);
  });

  it('keeps events from the repo that contains the visualised subfolder', () => {
    expect(belongsTo('/p/app', '/p/app/packages/web')).toBe(true);
  });

  it('drops events from other projects, including name-prefix siblings', () => {
    expect(belongsTo('/p/other', '/p/app')).toBe(false);
    expect(belongsTo('/p/app2', '/p/app')).toBe(false);
    expect(belongsTo('C:\\p\\app2', 'c:/p/app')).toBe(false);
  });
});

describe('toProjectOptions', () => {
  it('puts the current project first, then others by recent activity, skipping the global project and duplicates', () => {
    const opts = toProjectOptions(
      [
        { id: 'global', worktree: '/', time: { created: 1 } },
        { id: 'a', worktree: '/p/old', time: { created: 1, updated: 10 } },
        { id: 'b', worktree: '/p/new', time: { created: 1, updated: 30 } },
        { id: 'c', worktree: '/p/app', name: 'My App', time: { created: 1, updated: 20 } },
        { id: 'd', worktree: '/p/new/' },
      ],
      '/p/app',
    );
    expect(opts.map((o) => [o.dir, o.name, o.current])).toEqual([
      ['/p/app', 'My App', true],
      ['/p/new', 'new', false],
      ['/p/old', 'old', false],
    ]);
  });

  it('lists the current project even when OpenCode does not know it', () => {
    expect(toProjectOptions([], 'D:\\work\\site')).toEqual([{ dir: 'D:\\work\\site', name: 'site', updated: undefined, current: true }]);
  });
});
