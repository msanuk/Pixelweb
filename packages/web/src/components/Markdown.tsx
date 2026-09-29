import React from 'react';
import { Highlight } from './Highlight';
import { parseBlocks, parseInline, safeHref, type Block, type Inline, type ListItem } from '../lib/markdown';
import { MermaidBlock } from './Mermaid';

/**
 * Deliberately tiny markdown renderer: headings, paragraphs, nested lists,
 * quotes, rules, tables, fenced code, ```mermaid diagrams; inline code, bold,
 * italic, strikethrough, links. Parsing lives in lib/markdown.ts. Text nodes
 * pass through <Highlight/> so knowledge terms are clickable inside agent
 * replies and card bodies.
 */
export function Markdown({ text, highlight = true }: { text: string; highlight?: boolean }) {
  return <div className="md">{blocks(parseBlocks(text), highlight)}</div>;
}

function blocks(list: Block[], hl: boolean): React.ReactNode[] {
  return list.map((b, i) => {
    switch (b.kind) {
      case 'code':
        if (b.lang === 'mermaid' && b.closed) return <MermaidBlock key={i} code={b.text} />;
        return (
          <pre key={i} className="md-code">
            <code>{b.text}</code>
          </pre>
        );
      case 'h':
        return React.createElement(`h${Math.min(b.level + 2, 6)}`, { key: i, className: 'md-h' }, inline(b.text, hl));
      case 'ul':
        return <ul key={i}>{items(b.items, hl)}</ul>;
      case 'ol':
        return (
          <ol key={i} start={b.start === 1 ? undefined : b.start}>
            {items(b.items, hl)}
          </ol>
        );
      case 'quote':
        return <blockquote key={i}>{blocks(b.blocks, hl)}</blockquote>;
      case 'hr':
        return <hr key={i} />;
      case 'table':
        return (
          <div key={i} className="md-table">
            <table>
              <thead>
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j} style={{ textAlign: b.align[j] ?? undefined }}>
                      {inline(c, hl)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, k) => (
                  <tr key={k}>
                    {r.map((c, j) => (
                      <td key={j} style={{ textAlign: b.align[j] ?? undefined }}>
                        {inline(c, hl)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <p key={i}>{inline(b.text, hl)}</p>;
    }
  });
}

function items(list: ListItem[], hl: boolean): React.ReactNode[] {
  return list.map((it, j) => (
    <li key={j}>
      {inline(it.text, hl)}
      {blocks(it.children, hl)}
    </li>
  ));
}

function inline(text: string, hl: boolean): React.ReactNode[] {
  return nodes(parseInline(text), hl);
}

function nodes(list: Inline[], hl: boolean): React.ReactNode[] {
  return list.map((n, i) => {
    switch (n.kind) {
      case 'code':
        return <code key={i}>{n.text}</code>;
      case 'strong':
        return <strong key={i}>{nodes(n.children, hl)}</strong>;
      case 'em':
        return <em key={i}>{nodes(n.children, hl)}</em>;
      case 'del':
        return <del key={i}>{nodes(n.children, hl)}</del>;
      case 'link': {
        // the text is agent output: only follow web and mail links, never javascript: or data: URLs
        const href = safeHref(n.href);
        if (!href)
          return (
            <span key={i} title={n.href}>
              {n.text}
            </span>
          );
        return (
          <a key={i} href={href} target="_blank" rel="noreferrer">
            {n.text}
          </a>
        );
      }
      default:
        return hl ? <Highlight key={i} text={n.text} /> : <React.Fragment key={i}>{n.text}</React.Fragment>;
    }
  });
}
