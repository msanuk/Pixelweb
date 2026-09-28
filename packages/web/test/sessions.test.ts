import { describe, expect, it } from 'vitest';
import type { OcSession } from '@pixelweb/shared';
import { descendants, sessionTree, subagentTitle } from '../src/lib/sessions';

const s = (id: string, created: number, parentID?: string): OcSession => ({ id, parentID, title: id, time: { created, updated: created } });

describe('subagentTitle', () => {
  it('splits opencode subtask titles into description and agent', () => {
    expect(subagentTitle('搜索相关文件 (@explore subagent)')).toEqual({ title: '搜索相关文件', agent: 'explore' });
    expect(subagentTitle('Find auth code (@my-agent subagent)')).toEqual({ title: 'Find auth code', agent: 'my-agent' });
  });
  it('leaves other titles alone', () => {
    expect(subagentTitle('修复登录页 bug')).toBeNull();
    expect(subagentTitle('(@explore subagent) later')).toBeNull();
  });
});

describe('sessionTree', () => {
  it('nests subtasks under their parent, oldest first', () => {
    const t = sessionTree([s('a', 1), s('c2', 5, 'a'), s('c1', 3, 'a'), s('b', 2), s('g', 6, 'c1')]);
    expect(t.roots.map((x) => x.id)).toEqual(['a', 'b']);
    expect(t.children.get('a')?.map((x) => x.id)).toEqual(['c1', 'c2']);
    expect(descendants(t, 'a').map((x) => x.id)).toEqual(['c1', 'g', 'c2']);
  });
  it('shows a subtask whose parent is missing as a root', () => {
    expect(sessionTree([s('x', 1, 'gone')]).roots.map((x) => x.id)).toEqual(['x']);
  });
});
