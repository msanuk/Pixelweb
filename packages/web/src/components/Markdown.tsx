import React from 'react';
import { Highlight } from './Highlight';
import { parseBlocks } from '../lib/markdown';
import { MermaidBlock } from './Mermaid';

/**
 * Deliberately tiny markdown renderer: headings, paragraphs, lists, tables,
 * inline code, bold, links, fenced code, ```mermaid diagrams. Text nodes pass
 * through <Highlight/> so knowledge terms are clickable inside agent replies
 * and card bodies.
 */
export function Markdown({ text, highlight = true }: { text: string; highlight?: boolean }) {
  const blocks = parseBlocks(text);
  return (
    <div className="md">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'code':
            if (b.lang === 'mermaid' && b.closed) return <MermaidBlock key={i} code={b.text} />;
            return (
              <pre key={i} className="md-code">
                <code>{b.text}</code>
              </pre>
            );
          case 'h':
            return React.createElement(`h${Math.min(b.level + 2, 6)}`, { key: i, className: 'md-h' }, inline(b.text, highlight));
          case 'ul':
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, highlight)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, highlight)}</li>
                ))}
              </ol>
            );
          case 'table':
            return (
              <div key={i} className="md-table">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} style={{ textAlign: b.align[j] ?? undefined }}>
                          {inline(c, highlight)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, k) => (
                      <tr key={k}>
                        {r.map((c, j) => (
                          <td key={j} style={{ textAlign: b.align[j] ?? undefined }}>
                            {inline(c, highlight)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={i}>{inline(b.text, highlight)}</p>;
        }
      })}
    </div>
  );
}

const INLINE_RE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function inline(text: string, highlight: boolean): React.ReactNode[] {
  const parts = text.split(INLINE_RE);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.startsWith('**')) return <strong key={i}>{highlight ? <Highlight text={p.slice(2, -2)} /> : p.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
    if (link)
      return (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    return highlight ? <Highlight key={i} text={p} /> : <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
