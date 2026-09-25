import { useEffect, useMemo, useRef, useState } from 'react';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { ArchGraph as Graph, ArchNode } from '@pixelweb/shared';
import { explain, openCard, useStore } from '../lib/store';
import { send } from '../lib/ws';
import { Highlight } from '../components/Highlight';

interface SimNode extends SimulationNodeDatum {
  id: string;
  node: ArchNode;
  r: number;
  inDeg: number;
  outDeg: number;
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
  cyclic: boolean;
}

const LANG_COLOR: Record<string, string> = { ts: '#3b82f6', js: '#eab308', py: '#22c55e', other: '#94a3b8' };

export function ArchGraph() {
  const graph = useStore((s) => s.arch);
  const [level, setLevel] = useState<'file' | 'dir'>('dir');
  const [selected, setSelected] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [tick, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const size = useSize(svgRef);

  useEffect(() => {
    if (graph && graph.level !== level) send({ type: 'arch.refresh', level });
  }, [level, graph]);

  const sim = useMemo(() => {
    if (!graph) return null;
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    for (const e of graph.edges) {
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + e.weight);
      outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + e.weight);
    }
    const pairs = new Set(graph.edges.map((e) => e.source + '>' + e.target));
    const maxLoc = Math.max(1, ...graph.nodes.map((n) => n.loc));
    const nodes: SimNode[] = graph.nodes.map((n) => ({
      id: n.id,
      node: n,
      r: n.kind === 'external' ? 7 : 8 + Math.sqrt(n.loc / maxLoc) * 22,
      inDeg: inDeg.get(n.id) ?? 0,
      outDeg: outDeg.get(n.id) ?? 0,
    }));
    const links: SimLink[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      cyclic: pairs.has(e.target + '>' + e.source),
    }));
    return { nodes, links };
  }, [graph]);

  useEffect(() => {
    if (!sim || !size.w) return;
    const simulation = forceSimulation(sim.nodes)
      .force('link', forceLink<SimNode, SimLink>(sim.links).id((d) => d.id).distance((l) => 60 + 20 / Math.sqrt(l.weight)).strength(0.4))
      .force('charge', forceManyBody().strength(-220))
      .force('collide', forceCollide<SimNode>().radius((d) => d.r + 14))
      .force('center', forceCenter(size.w / 2, size.h / 2))
      .alphaDecay(0.05);
    simulation.on('tick', () => {
      const m = new Map<string, { x: number; y: number }>();
      for (const n of sim.nodes) m.set(n.id, { x: clamp(n.x ?? 0, 20, size.w - 20), y: clamp(n.y ?? 0, 20, size.h - 20) });
      setPositions(m);
      setTick((t) => t + 1);
    });
    return () => void simulation.stop();
  }, [sim, size.w, size.h]);

  if (!graph) {
    return (
      <div className="empty">
        <h3>架构图尚未生成</h3>
        <p>
          正在扫描项目里的 <Highlight text="import" /> 语句构建 <Highlight text="依赖图" />…
        </p>
      </div>
    );
  }
  const selNode = sim?.nodes.find((n) => n.id === selected);
  const neighbours = new Set<string>();
  if (selected) for (const l of sim!.links) {
    const s = typeof l.source === 'object' ? l.source.id : (l.source as string);
    const t = typeof l.target === 'object' ? l.target.id : (l.target as string);
    if (s === selected) neighbours.add(t);
    if (t === selected) neighbours.add(s);
  }
  const cyclicCount = sim ? sim.links.filter((l) => l.cyclic).length / 2 : 0;

  return (
    <div className="arch">
      <header className="panel-head">
        <div>
          <button className="term strong" onClick={() => openCard('dependency-graph', `项目 ${graph.root}：${graph.stats.files} 个文件，${graph.stats.imports} 条 import`)}>
            依赖图
          </button>{' '}
          · {graph.stats.files} 文件 · {graph.stats.imports} import · {graph.nodes.length} 节点 · {graph.edges.length} 边
          {cyclicCount > 0 && (
            <>
              {' · '}
              <button className="chip warn" onClick={() => openCard('coupling', `发现 ${cyclicCount} 组双向依赖`)}>
                {cyclicCount} 组循环依赖
              </button>
            </>
          )}
          {graph.stats.skipped > 0 && <span className="muted"> · 已跳过 {graph.stats.skipped} 个生成或超限文件</span>}
        </div>
        <div className="actions">
          <label>
            粒度{' '}
            <select value={level} onChange={(e) => setLevel(e.target.value as 'file' | 'dir')}>
              <option value="dir">目录</option>
              <option value="file">文件</option>
            </select>
          </label>
          <button onClick={() => send({ type: 'arch.refresh', level })}>重新扫描</button>
        </div>
      </header>
      <div className="arch-body">
        <svg ref={svgRef} className="arch-svg" data-tick={tick}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edge)" />
            </marker>
          </defs>
          {sim?.links.map((l, i) => {
            const s = typeof l.source === 'object' ? (l.source as SimNode) : null;
            const t = typeof l.target === 'object' ? (l.target as SimNode) : null;
            if (!s || !t) return null;
            const ps = positions.get(s.id);
            const pt = positions.get(t.id);
            if (!ps || !pt) return null;
            const dx = pt.x - ps.x, dy = pt.y - ps.y;
            const len = Math.hypot(dx, dy) || 1;
            const ex = pt.x - (dx / len) * (t.r + 2);
            const ey = pt.y - (dy / len) * (t.r + 2);
            const dim = selected && s.id !== selected && t.id !== selected;
            return (
              <line
                key={i}
                x1={ps.x}
                y1={ps.y}
                x2={ex}
                y2={ey}
                className={`edge ${l.cyclic ? 'cyclic' : ''} ${dim ? 'dim' : ''}`}
                strokeWidth={Math.min(1 + Math.log2(l.weight), 5)}
                markerEnd="url(#arrow)"
              />
            );
          })}
          {sim?.nodes.map((n) => {
            const p = positions.get(n.id);
            if (!p) return null;
            const dim = selected && selected !== n.id && !neighbours.has(n.id);
            const color = n.node.kind === 'external' ? '#94a3b8' : n.node.kind === 'file' ? LANG_COLOR[n.node.language ?? 'other'] : '#8b5cf6';
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} className={`node ${dim ? 'dim' : ''} ${selected === n.id ? 'selected' : ''}`} onClick={() => setSelected(n.id === selected ? null : n.id)}>
                <circle r={n.r} fill={color} fillOpacity={n.node.kind === 'external' ? 0.35 : 0.85} stroke={color} strokeDasharray={n.node.kind === 'external' ? '3 2' : undefined} />
                <text dy={n.r + 12} textAnchor="middle" className="node-label">
                  {n.node.label}
                </text>
              </g>
            );
          })}
        </svg>
        <aside className="arch-side">
          {selNode ? (
            <section>
              <h4 className="mono">{selNode.node.id || '(root)'}</h4>
              <dl>
                <dt>类型</dt>
                <dd>
                  <button className="term" onClick={() => openCard(selNode.node.kind === 'external' ? 'sdk' : 'module', `节点 ${selNode.node.id}`)}>
                    {selNode.node.kind === 'external' ? '外部依赖' : selNode.node.kind === 'dir' ? '目录' : '文件'}
                  </button>
                </dd>
                {selNode.node.kind !== 'external' && (
                  <>
                    <dt>代码行</dt>
                    <dd>{selNode.node.loc}{selNode.node.fileCount ? ` · ${selNode.node.fileCount} 文件` : ''}</dd>
                  </>
                )}
                <dt>被依赖（入边）</dt>
                <dd>{selNode.inDeg}</dd>
                <dt>依赖他人（出边）</dt>
                <dd>{selNode.outDeg}</dd>
              </dl>
              <h5>相邻节点</h5>
              <ul className="neighbour-list">
                {[...neighbours].map((id) => (
                  <li key={id} className="mono" onClick={() => setSelected(id)}>
                    {id}
                  </li>
                ))}
              </ul>
              <button
                className="primary"
                onClick={() =>
                  void explain(
                    `模块 ${selNode.node.id || '(root)'} 在这个项目里的职责`,
                    `依赖图节点 ${selNode.node.id}\n入边 ${selNode.inDeg}，出边 ${selNode.outDeg}\n相邻: ${[...neighbours].join(', ')}`,
                    'module',
                  )
                }
              >
                📖 让 OpenCode 解释这个模块
              </button>
            </section>
          ) : (
            <section>
              <p className="muted">点击节点查看依赖关系。</p>
              <p className="muted">
                节点大小 = 代码行数；边越粗，<Highlight text="import" /> 越多；红色边表示{' '}
                <button className="term" onClick={() => openCard('coupling')}>
                  循环依赖
                </button>
                ；虚线为<button className="term" onClick={() => openCard('sdk')}>外部包</button>。
              </p>
              <h5>图例</h5>
              <ul className="legend">
                <li><i style={{ background: '#8b5cf6' }} /> 目录</li>
                <li><i style={{ background: LANG_COLOR.ts }} /> TypeScript</li>
                <li><i style={{ background: LANG_COLOR.js }} /> JavaScript</li>
                <li><i style={{ background: LANG_COLOR.py }} /> Python</li>
                <li><i style={{ background: '#94a3b8' }} /> 外部依赖</li>
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function useSize(ref: React.RefObject<SVGSVGElement>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
