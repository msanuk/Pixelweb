import { describe, expect, it } from 'vitest';
import type { GitCommit, OcPart } from '@pixelweb/shared';
import { CommitIndex, commitLinkFromPart, resolveLinks } from '../src/activity/commits.js';

function bash(command: string, output: string, id = 'prt_1', status: 'completed' | 'running' = 'completed'): OcPart {
  const state =
    status === 'completed'
      ? { status, input: { command }, output, title: command, metadata: {}, time: { start: 10_000, end: 11_000 } }
      : { status, input: { command }, time: { start: 10_000 } };
  return { id, sessionID: 'ses_1', messageID: 'msg_1', type: 'tool', callID: 'c', tool: 'bash', state } as OcPart;
}

function commit(hash: string, dateSec: number): GitCommit {
  return { hash, shortHash: hash.slice(0, 7), parents: [], author: 'a', date: dateSec, subject: 's', refs: [] };
}

describe('commitLinkFromPart', () => {
  it('reads the hash from git commit output', () => {
    const l = commitLinkFromPart(bash('git add -A && git commit -m "fix: x"', '[main 1a2b3c4] fix: x\n 1 file changed'));
    expect(l).toMatchObject({ sessionID: 'ses_1', partID: 'prt_1', hash: '1a2b3c4', start: 10_000, end: 11_000 });
  });

  it('handles root commits and global options', () => {
    expect(commitLinkFromPart(bash('git -c user.name=bot commit -m init', '[main (root-commit) abcdef0] init'))?.hash).toBe('abcdef0');
    expect(commitLinkFromPart(bash('git -C packages/web commit -qm x', ''))).toMatchObject({ hash: undefined });
  });

  it('ignores other commands, failed commits and unfinished calls', () => {
    expect(commitLinkFromPart(bash('git status', '[main 1a2b3c4] looks like output'))).toBeNull();
    expect(commitLinkFromPart(bash('echo git committee', ''))).toBeNull();
    expect(commitLinkFromPart(bash('git commit -m x', 'On branch main\nnothing to commit, working tree clean'))).toBeNull();
    expect(commitLinkFromPart(bash('git commit -m x', '', 'prt_2', 'running'))).toBeNull();
  });
});

describe('resolveLinks', () => {
  const log = [commit('1a2b3c4d5e6f', 100), commit('ffff000011112222', 10)];

  it('expands a short hash to the full one', () => {
    const [l] = resolveLinks([commitLinkFromPart(bash('git commit -m x', '[main 1a2b3c4] x'))!], log);
    expect(l.hash).toBe('1a2b3c4d5e6f');
  });

  it('falls back to the commit made while the command ran', () => {
    const [l] = resolveLinks([commitLinkFromPart(bash('git commit -qm x', ''))!], log);
    expect(l.hash).toBe('ffff000011112222'); // date 10s, command ran 10–11s
  });

  it('leaves links it cannot pin down alone', () => {
    const quiet = { ...commitLinkFromPart(bash('git commit -qm x', ''))!, start: 500_000, end: 501_000 };
    expect(resolveLinks([quiet], log)[0].hash).toBeUndefined();
  });
});

describe('CommitIndex', () => {
  it('reports a change only when a part adds or updates a link', () => {
    const idx = new CommitIndex();
    expect(idx.addPart(bash('git commit -m x', '', 'prt_9', 'running'))).toBe(false);
    expect(idx.addPart(bash('git commit -m x', '[main 1a2b3c4] x', 'prt_9'))).toBe(true);
    expect(idx.addPart(bash('git commit -m x', '[main 1a2b3c4] x', 'prt_9'))).toBe(false);
    expect(idx.list()).toHaveLength(1);
  });
});
