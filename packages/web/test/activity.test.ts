import { describe, expect, it } from 'vitest';
import type { OcMessageWithParts, OcPart } from '@pixelweb/shared';
import { linksForCommit, nodeForPath, sessionFiles, toProjectPath } from '../src/lib/activity';

function tool(tool: string, input: Record<string, unknown>, status: 'completed' | 'error' = 'completed'): OcPart {
  const state =
    status === 'completed'
      ? { status, input, output: '', title: '', metadata: {}, time: { start: 0, end: 1 } }
      : { status, input, error: 'boom', time: { start: 0, end: 1 } };
  return { id: Math.random().toString(36), sessionID: 's', messageID: 'm', type: 'tool', callID: 'c', tool, state } as OcPart;
}

const msg = (parts: OcPart[]) => [{ info: {} as OcMessageWithParts['info'], parts }] as OcMessageWithParts[];

describe('toProjectPath', () => {
  it('makes absolute paths inside the project relative', () => {
    expect(toProjectPath('/repo/src/a.ts', '/repo')).toBe('src/a.ts');
    expect(toProjectPath('/repo/src/a.ts', '/repo/')).toBe('src/a.ts');
    expect(toProjectPath('./src/a.ts', '/repo')).toBe('src/a.ts');
  });

  it('handles Windows paths case-insensitively', () => {
    expect(toProjectPath('d:\\Work\\App\\src\\a.ts', 'D:\\work\\app')).toBe('src/a.ts');
  });

  it('rejects files outside the project, including sibling prefixes', () => {
    expect(toProjectPath('/etc/passwd', '/repo')).toBeNull();
    expect(toProjectPath('/repo-other/a.ts', '/repo')).toBeNull();
  });
});

describe('sessionFiles', () => {
  it('collects reads and edits, edits winning, failed calls ignored', () => {
    const files = sessionFiles(
      msg([
        tool('read', { filePath: '/repo/src/a.ts' }),
        tool('edit', { filePath: '/repo/src/a.ts' }),
        tool('read', { filePath: '/repo/src/b.ts' }),
        tool('write', { filePath: '/repo/src/c.ts' }, 'error'),
        tool('bash', { command: 'ls' }),
        tool('patch', { patchText: '*** Begin Patch\n*** Update File: src/d.ts\n@@\n*** Add File: src/e.ts\n*** End Patch' }),
        { id: 'p', sessionID: 's', messageID: 'm', type: 'patch', hash: 'h', files: ['/repo/src/f.ts'] },
      ]),
      '/repo',
    );
    expect(Object.fromEntries(files)).toEqual({ 'src/a.ts': 'edit', 'src/b.ts': 'read', 'src/d.ts': 'edit', 'src/e.ts': 'edit', 'src/f.ts': 'edit' });
  });
});

describe('nodeForPath', () => {
  const dirs = [
    { id: '', kind: 'dir' as const },
    { id: 'packages/web/src', kind: 'dir' as const },
    { id: 'packages/web/src/panels', kind: 'dir' as const },
    { id: 'ext:react', kind: 'external' as const },
  ];

  it('picks the deepest directory that contains the file', () => {
    expect(nodeForPath(dirs, 'packages/web/src/panels/Timeline.tsx')?.id).toBe('packages/web/src/panels');
    expect(nodeForPath(dirs, 'packages/web/src/main.tsx')?.id).toBe('packages/web/src');
  });

  it('maps only top-level files to the root node', () => {
    expect(nodeForPath(dirs, 'vite.config.ts')?.id).toBe('');
    expect(nodeForPath(dirs, 'docs/guide.md')).toBeUndefined();
  });

  it('matches files exactly at file level', () => {
    const files = [{ id: 'src/a.ts', kind: 'file' as const }];
    expect(nodeForPath(files, 'src/a.ts')?.id).toBe('src/a.ts');
    expect(nodeForPath(files, 'src/a.tsx')).toBeUndefined();
  });
});

describe('linksForCommit', () => {
  it('matches short and full hashes', () => {
    const base = { sessionID: 's', messageID: 'm', partID: 'p', start: 0, end: 1 };
    const links = [{ ...base, hash: '1a2b3c4' }, { ...base, partID: 'q' }];
    expect(linksForCommit(links, '1a2b3c4d5e6f')).toHaveLength(1);
    expect(linksForCommit(links, 'ffff')).toHaveLength(0);
  });
});
