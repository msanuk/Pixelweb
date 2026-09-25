import { useMemo, useState } from 'react';
import type { GitCommit, GitSnapshot } from '@pixelweb/shared';
import { openCard, useStore } from '../lib/store';
import { send } from '../lib/ws';
import { fmtDate } from '../lib/format';
import { Highlight } from '../components/Highlight';

const LANE_W = 22;
const ROW_H = 30;
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#f97316'];

interface Laid {
  commit: GitCommit;
  row: number;
  lane: number;
  color: string;
}

/**
 * Classic "git log --graph" lane assignment: walk commits newest-first, keep a
 * list of open lanes (each waiting for a specific parent hash). A commit takes
 * the first lane waiting for it (or a new one), then its first parent inherits
 * that lane and further parents open new lanes.
 */
export function layoutCommits(commits: GitCommit[]): { rows: Laid[]; lanes: number; edges: { from: Laid; to: Laid }[] } {
  const rows: Laid[] = [];
  const byHash = new Map<string, Laid>();
  const lanes: (string | null)[] = []; // hash the lane is waiting for
  const laneColor = new Map<number, string>();
  let colorIdx = 0;
  const nextColor = () => COLORS[colorIdx++ % COLORS.length];

  commits.forEach((c, row) => {
    let lane = lanes.indexOf(c.hash);
    if (lane < 0) {
      lane = lanes.indexOf(null);
      if (lane < 0) lane = lanes.push(null) - 1;
      laneColor.set(lane, nextColor());
    }
    const laid: Laid = { commit: c, row, lane, color: laneColor.get(lane) ?? COLORS[0] };
    rows.push(laid);
    byHash.set(c.hash, laid);

    // free other lanes that were waiting for this same commit (merges converge)
    for (let i = 0; i < lanes.length; i++) if (i !== lane && lanes[i] === c.hash) lanes[i] = null;

    const [first, ...others] = c.parents;
    lanes[lane] = first ?? null;
    for (const p of others) {
      if (lanes.includes(p)) continue;
      let l = lanes.indexOf(null);
      if (l < 0) l = lanes.push(null) - 1;
      lanes[l] = p;
      laneColor.set(l, nextColor());
    }
    // trim trailing empty lanes
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
  });

  const edges: { from: Laid; to: Laid }[] = [];
  for (const r of rows) for (const p of r.commit.parents) {
    const to = byHash.get(p);
    if (to) edges.push({ from: r, to });
  }
  const laneCount = rows.reduce((m, r) => Math.max(m, r.lane + 1), 1);
  return { rows, lanes: laneCount, edges };
}

export function GitGraph() {
  const git = useStore((s) => s.git);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const laid = useMemo(() => (git ? layoutCommits(git.commits) : null), [git]);

  if (!git) {
    return (
      <div className="empty">
        <h3>没有 Git 仓库</h3>
        <p>
          当前项目目录不是一个 git <Highlight text="仓库" />，或者还没有任何 <Highlight text="commit" />。
        </p>
      </div>
    );
  }
  const sel = git.commits.find((c) => c.hash === selected) ?? null;
  const q = filter.trim().toLowerCase();

  return (
    <div className="git">
      <header className="panel-head">
        <div>
          <strong>
            <button className="term" onClick={() => openCard('head', `HEAD = ${git.head}`)}>
              HEAD
            </button>
          </strong>{' '}
          →{' '}
          {git.detached ? (
            <button className="chip warn" onClick={() => openCard('detached-head', `HEAD 直接指向 ${git.head}`)}>
              detached @ {git.head?.slice(0, 7)}
            </button>
          ) : (
            <button className="term strong" onClick={() => openCard('branch', `当前分支 ${git.currentBranch}`)}>
              {git.currentBranch}
            </button>
          )}
          {' · '}
          {git.commits.length} 个提交 · {git.branches.filter((b) => !b.remote).length} 本地分支 · {git.branches.filter((b) => b.remote).length}{' '}
          <button className="term" onClick={() => openCard('remote')}>
            远程
          </button>
          {git.stashCount > 0 && (
            <>
              {' · '}
              <button className="term" onClick={() => openCard('stash')}>
                stash
              </button>{' '}
              ×{git.stashCount}
            </>
          )}
        </div>
        <div className="actions">
          <input placeholder="过滤提交信息 / 作者" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button onClick={() => send({ type: 'git.refresh' })}>刷新</button>
        </div>
      </header>

      <div className="git-body">
        <div className="git-graph">
          <svg width={(laid!.lanes + 1) * LANE_W + 8} height={git.commits.length * ROW_H + 10} className="graph-svg">
            {laid!.edges.map((e, i) => {
              const x1 = e.from.lane * LANE_W + LANE_W;
              const y1 = e.from.row * ROW_H + ROW_H / 2;
              const x2 = e.to.lane * LANE_W + LANE_W;
              const y2 = e.to.row * ROW_H + ROW_H / 2;
              const d = x1 === x2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1},${y1 + ROW_H * 0.6} ${x2},${y2 - ROW_H * 0.6} ${x2},${y2}`;
              return <path key={i} d={d} stroke={e.from.commit.parents[0] === e.to.commit.hash ? e.from.color : e.to.color} fill="none" strokeWidth={2} />;
            })}
            {laid!.rows.map((r) => (
              <circle
                key={r.commit.hash}
                cx={r.lane * LANE_W + LANE_W}
                cy={r.row * ROW_H + ROW_H / 2}
                r={r.commit.parents.length > 1 ? 6 : 5}
                fill={r.commit.hash === git.head ? '#fff' : r.color}
                stroke={r.color}
                strokeWidth={r.commit.parents.length > 1 ? 3 : 2}
                className="commit-dot"
                onClick={() => setSelected(r.commit.hash)}
              />
            ))}
          </svg>
          <ol className="commit-list" style={{ ['--row-h' as string]: `${ROW_H}px` }}>
            {laid!.rows.map((r) => {
              const c = r.commit;
              const hit = !q || c.subject.toLowerCase().includes(q) || c.author.toLowerCase().includes(q) || c.refs.join(' ').toLowerCase().includes(q);
              return (
                <li key={c.hash} className={`commit-row ${selected === c.hash ? 'selected' : ''} ${hit ? '' : 'dim'}`} onClick={() => setSelected(c.hash)}>
                  {c.refs.map((ref) => (
                    <RefChip key={ref} refName={ref} />
                  ))}
                  <span className="subject">{c.subject}</span>
                  <span className="muted mono">{c.shortHash}</span>
                  <span className="muted">{c.author}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="git-side">
          {sel ? <CommitDetail c={sel} git={git} /> : <p className="muted">点击一个提交查看详情。</p>}
          <section>
            <h4>
              <button className="term" onClick={() => openCard('staging-area', git.status.map((s) => `${s.code} ${s.path}`).join('\n'))}>
                工作区状态
              </button>{' '}
              ({git.status.length})
            </h4>
            {git.status.length === 0 ? (
              <p className="muted">干净。</p>
            ) : (
              <ul className="status-list">
                {git.status.slice(0, 60).map((s) => (
                  <li key={s.path}>
                    <code className={`code-${s.code.trim() || 'x'}`}>{s.code}</code> {s.path}
                  </li>
                ))}
                {git.status.length > 60 && <li className="muted">… 还有 {git.status.length - 60} 项</li>}
              </ul>
            )}
          </section>
          <section>
            <h4>
              <button className="term" onClick={() => openCard('branch')}>
                分支
              </button>
            </h4>
            <ul className="branch-list">
              {git.branches.map((b) => (
                <li key={b.name} className={b.current ? 'current' : b.remote ? 'remote' : ''}>
                  <span className="mono">{b.name}</span>
                  {b.upstream && <span className="muted"> → {b.upstream}</span>}
                  {(b.ahead || b.behind) && (
                    <span className="muted">
                      {' '}
                      {b.ahead ? `↑${b.ahead}` : ''}
                      {b.behind ? `↓${b.behind}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function RefChip({ refName }: { refName: string }) {
  const isHead = refName.startsWith('HEAD');
  const isTag = refName.startsWith('tag:');
  const isRemote = /^(origin|upstream)\//.test(refName.replace(/^HEAD -> /, ''));
  const card = isTag ? 'commit' : isRemote ? 'remote' : isHead ? 'head' : 'branch';
  return (
    <button className={`chip ref ${isHead ? 'head' : isTag ? 'tag' : isRemote ? 'remote' : 'local'}`} onClick={(e) => (e.stopPropagation(), openCard(card, refName))}>
      {refName}
    </button>
  );
}

function CommitDetail({ c, git }: { c: GitCommit; git: GitSnapshot }) {
  const isMerge = c.parents.length > 1;
  return (
    <section className="commit-detail">
      <h4>
        <button className="term" onClick={() => openCard(isMerge ? 'merge' : 'commit', `${c.shortHash} ${c.subject}\nparents: ${c.parents.join(', ')}`)}>
          {isMerge ? 'Merge commit' : 'Commit'}
        </button>
      </h4>
      <p className="subject">
        <Highlight text={c.subject} context={`commit ${c.shortHash}: ${c.subject}`} />
      </p>
      <dl>
        <dt>hash</dt>
        <dd className="mono">{c.hash}</dd>
        <dt>作者</dt>
        <dd>{c.author}</dd>
        <dt>时间</dt>
        <dd>{fmtDate(c.date)}</dd>
        <dt>父提交</dt>
        <dd className="mono">{c.parents.map((p) => p.slice(0, 7)).join(', ') || '（根提交）'}</dd>
        {c.hash === git.head && (
          <>
            <dt>HEAD</dt>
            <dd>就是这里</dd>
          </>
        )}
      </dl>
    </section>
  );
}
