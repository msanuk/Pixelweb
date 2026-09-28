import type { Diff } from '../lib/diff';

/** Unified diff table: old/new line numbers, a +/- gutter and the line. */
export function DiffView({ diff, maxRows = 400 }: { diff: Diff; maxRows?: number }) {
  if (diff.rows.length === 0) return <p className="muted small">没有改动。</p>;
  const rows = diff.rows.slice(0, maxRows);
  return (
    <div className="diff">
      <table>
        <tbody>
          {rows.map((r, i) =>
            r.kind === 'hunk' || r.kind === 'meta' ? (
              <tr key={i} className={`diff-${r.kind}`}>
                <td colSpan={diff.fragment ? 2 : 4}>{r.text}</td>
              </tr>
            ) : (
              <tr key={i} className={`diff-${r.kind}`}>
                {!diff.fragment && (
                  <>
                    <td className="ln">{r.oldNo ?? ''}</td>
                    <td className="ln">{r.newNo ?? ''}</td>
                  </>
                )}
                <td className="sign">{r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ''}</td>
                <td className="code">{r.text}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {diff.fragment && <p className="muted small diff-note">这是 edit 替换的片段，不带文件行号。</p>}
      {diff.rows.length > maxRows && <p className="muted small">… 还有 {diff.rows.length - maxRows} 行未显示</p>}
    </div>
  );
}

export function DiffStat({ diff }: { diff: Diff }) {
  return (
    <span className="diffstat mono small">
      <span className="add">+{diff.additions}</span> <span className="del">−{diff.deletions}</span>
    </span>
  );
}
