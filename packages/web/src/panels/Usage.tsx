import { useEffect, useMemo, useState } from 'react';
import type { UsageReport, UsageTotals } from '@pixelweb/shared';
import { api } from '../lib/api';
import { openCard, useStore } from '../lib/store';
import { fmtNum } from '../lib/format';
import { RANGE_PRESETS, dayBars, dayOf, hitRate, niceMax, promptTokens, rangeFor, type DayBar, type RangePreset } from '../lib/usage';

const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`);
const money = (n: number) => (n > 0 ? `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}` : '—');

/**
 * Tokens and prompt-cache hits across every session of the current project
 * (subtasks included), per model, over a chosen span of days.
 */
export function Usage() {
  const root = useStore((s) => s.server?.projectRoot);
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [custom, setCustom] = useState(() => {
    const today = dayOf(Date.now());
    return { from: today, to: today };
  });
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const range = useMemo(() => rangeFor(preset, Date.now(), custom), [preset, custom, nonce]);

  useEffect(() => {
    if (!range) return;
    let live = true;
    setLoading(true);
    setError(null);
    api
      .usage(range.from, range.to)
      .then((r) => live && setReport(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [range, root]);

  // a model that isn't in the new range can't stay selected
  useEffect(() => {
    if (model && report && !report.models.some((m) => `${m.providerID}/${m.modelID}` === model)) setModel(null);
  }, [report, model]);

  const t = report?.total;
  return (
    <div className="usage">
      <header className="panel-head">
        <div className="usage-title">
          <h3>用量</h3>
          <span className="muted small">
            当前项目的全部会话（含子任务），按模型统计
            {report && ` · ${report.sessions} 个会话`}
          </span>
        </div>
        <div className="usage-filters">
          <div className="seg" role="radiogroup" aria-label="时间范围">
            {RANGE_PRESETS.map((p) => (
              <button key={p.id} role="radio" aria-checked={preset === p.id} className={preset === p.id ? 'on' : ''} onClick={() => setPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <span className="usage-dates">
              <input type="date" aria-label="开始日期" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <span className="muted">至</span>
              <input type="date" aria-label="结束日期" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </span>
          )}
          <button onClick={() => setNonce((n) => n + 1)} disabled={loading}>
            {loading ? '统计中…' : '刷新'}
          </button>
        </div>
      </header>

      <div className="usage-body">
        {!range && <p className="error small">结束日期不能早于开始日期。</p>}
        {error && <p className="error small">统计失败：{error}</p>}
        {report && report.failed > 0 && <p className="warn-text small">有 {report.failed} 个会话的消息没拉下来，没算进去。</p>}
        {!report && loading && <p className="muted">正在拉取会话消息…第一次统计较慢，之后只重新拉有变化的会话。</p>}

        {t && (
          <>
            <div className="usage-tiles">
              <Tile label="请求" value={fmtNum(t.steps)} hint="模型请求次数（OpenCode 的 step）" />
              <Tile label="输入（未缓存）" value={fmtNum(t.input)} />
              <Tile label="缓存读" value={fmtNum(t.cacheRead)} />
              <Tile label="缓存写" value={fmtNum(t.cacheWrite)} />
              <Tile label="输出" value={fmtNum(t.output)} hint={t.reasoning ? `其中推理 ${fmtNum(t.reasoning)}` : undefined} />
              <Tile label="缓存命中率" value={pct(hitRate(t))} hint="缓存读 ÷（输入 + 缓存读 + 缓存写）" onTerm={() => openCard('prompt-cache', usageContext(report!))} />
              <Tile label="费用" value={money(t.cost)} />
            </div>

            {report!.models.length === 0 ? (
              <p className="muted">这段时间里没有模型请求。</p>
            ) : (
              <>
                <ModelTable report={report!} selected={model} onSelect={setModel} />
                <DailyChart report={report!} model={model} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function usageContext(r: UsageReport): string {
  return (
    `用量页：${r.sessions} 个会话，${r.total.steps} 次请求，未缓存输入 ${r.total.input}、缓存读 ${r.total.cacheRead}、缓存写 ${r.total.cacheWrite} tokens。` +
    r.models.map((m) => `${m.providerID}/${m.modelID} 命中率 ${pct(hitRate(m))}`).join('；')
  );
}

function Tile({ label, value, hint, onTerm }: { label: string; value: string; hint?: string; onTerm?: () => void }) {
  return (
    <div className="usage-tile" title={hint}>
      <span className="muted small">
        {onTerm ? (
          <button className="term" onClick={onTerm}>
            {label}
          </button>
        ) : (
          label
        )}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function ModelTable({ report, selected, onSelect }: { report: UsageReport; selected: string | null; onSelect: (m: string | null) => void }) {
  return (
    <section className="usage-section">
      <h4>
        按模型 <span className="muted small">点一行，下面的图只看这个模型</span>
      </h4>
      <div className="usage-table-wrap">
        <table className="usage-table">
          <thead>
            <tr>
              <th>模型</th>
              <th>会话</th>
              <th>请求</th>
              <th>输入（未缓存）</th>
              <th>缓存读</th>
              <th>缓存写</th>
              <th>输出</th>
              <th>命中率</th>
              <th>费用</th>
            </tr>
          </thead>
          <tbody>
            {report.models.map((m) => {
              const key = `${m.providerID}/${m.modelID}`;
              const r = hitRate(m);
              return (
                <tr
                  key={key}
                  className={selected === key ? 'selected' : ''}
                  onClick={() => onSelect(selected === key ? null : key)}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(selected === key ? null : key))}
                  aria-selected={selected === key}
                >
                  <td className="mono model">
                    <span className="muted">{m.providerID}/</span>
                    {m.modelID}
                  </td>
                  <td>{m.sessions}</td>
                  <td>{fmtNum(m.steps)}</td>
                  <td>{fmtNum(m.input)}</td>
                  <td>{fmtNum(m.cacheRead)}</td>
                  <td>{fmtNum(m.cacheWrite)}</td>
                  <td>{fmtNum(m.output)}</td>
                  <td className="hit">
                    {r == null ? (
                      <span className="muted" title="这个服务商没有回报缓存用量">未回报</span>
                    ) : (
                      <>
                        <span className="ctx-bar" aria-hidden>
                          <i style={{ width: `${r * 100}%` }} />
                        </span>
                        {pct(r)}
                      </>
                    )}
                  </td>
                  <td>{money(m.cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Prompt tokens per day, split into what the cache served and what it didn't. */
function DailyChart({ report, model }: { report: UsageReport; model: string | null }) {
  const bars = useMemo(() => dayBars(report, model, Date.now()), [report, model]);
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...bars.map((b) => (b.totals ? promptTokens(b.totals) : 0))));
  if (bars.length < 2) return null; // a single day is already the tiles above
  const h = (n: number) => `${(n / max) * 100}%`;
  const labelEvery = Math.ceil(bars.length / 10);
  const tip = hover != null ? bars[hover] : null;
  return (
    <section className="usage-section">
      <h4>
        每天的提示 tokens <span className="muted small">{model ?? '全部模型'}</span>
      </h4>
      <div className="usage-legend small muted">
        <span>
          <i className="sw hit" /> 缓存读（命中）
        </span>
        <span>
          <i className="sw miss" /> 未命中（输入 + 缓存写）
        </span>
      </div>
      <div className="usage-chart" onMouseLeave={() => setHover(null)}>
        <div className="usage-y small muted" aria-hidden>
          <span>{fmtNum(max)}</span>
          <span>{fmtNum(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="usage-plot">
          <div className="grid" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          {bars.map((b, i) => (
            <div
              key={b.day}
              className={`col ${hover === i ? 'on' : ''}`}
              onMouseEnter={() => setHover(i)}
              aria-label={barLabel(b)}
              role="img"
            >
              {b.totals && (
                <div className="stack" style={{ height: h(promptTokens(b.totals)) }}>
                  {b.totals.input + b.totals.cacheWrite > 0 && <span className="miss" style={{ flexGrow: b.totals.input + b.totals.cacheWrite }} />}
                  {b.totals.cacheRead > 0 && <span className="hit" style={{ flexGrow: b.totals.cacheRead }} />}
                </div>
              )}
              {i % labelEvery === 0 && <span className="x small muted">{b.day.slice(5)}</span>}
            </div>
          ))}
          {tip && (
            <div className="usage-tip" style={tipPosition(hover!, bars.length)}>
              <strong>{tip.day}</strong>
              {tip.totals ? <DayDetail t={tip.totals} /> : <span className="muted">没有请求</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Centred over its bar, but kept inside the plot at either end. */
function tipPosition(i: number, n: number): React.CSSProperties {
  const x = (i + 0.5) / n;
  return { left: `${x * 100}%`, transform: `translateX(${x < 0.2 ? -10 : x > 0.8 ? -90 : -50}%)` };
}

function DayDetail({ t }: { t: UsageTotals }) {
  return (
    <>
      <span>
        {t.steps} 次请求 · 命中率 {pct(hitRate(t))}
      </span>
      <span>
        缓存读 {fmtNum(t.cacheRead)} · 输入 {fmtNum(t.input)} · 缓存写 {fmtNum(t.cacheWrite)}
      </span>
      <span>
        输出 {fmtNum(t.output)}
        {t.cost > 0 && ` · ${money(t.cost)}`}
      </span>
    </>
  );
}

function barLabel(b: DayBar): string {
  if (!b.totals) return `${b.day}：没有请求`;
  return `${b.day}：${b.totals.steps} 次请求，缓存读 ${b.totals.cacheRead}，未缓存输入 ${b.totals.input}，缓存写 ${b.totals.cacheWrite}`;
}
