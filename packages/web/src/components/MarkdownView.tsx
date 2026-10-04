import React from 'react';
import { parseBlocks, parseInline, safeHref, type Block, type Inline, type ListItem } from '../lib/markdown';
import './markdown.css';

/** How the caller dresses up what the parser leaves as plain: runs of text, and closed fences with a language. */
export interface MarkdownRender {
  /** a run of plain text, e.g. with knowledge terms underlined; default: as is */
  text?: (text: string, key: number) => React.ReactNode;
  /** a closed ```lang fence, e.g. a mermaid diagram; null falls back to <pre> */
  fence?: (lang: string, code: string, key: number) => React.ReactNode | null;
}

/**
 * Deliberately tiny markdown renderer: headings, paragraphs, nested lists,
 * quotes, rules, tables, fenced code; inline code, bold, italic,
 * strikethrough, links. Parsing lives in lib/markdown.ts. Knows nothing about
 * the app's store, so the browser extension renders with it too; the app's
 * own version, with terms and diagrams, is Markdown.tsx.
 */
export function MarkdownView({ text, render = {} }: { text: string; render?: MarkdownRender }) {
  return <div className="md">{blocks(parseBlocks(text), render)}</div>;
}

function blocks(list: Block[], r: MarkdownRender): React.ReactNode[] {
  return list.map((b, i) => {
    switch (b.kind) {
      case 'code': {
        const custom = b.closed && b.lang && r.fence ? r.fence(b.lang, b.text, i) : null;
        if (custom) return custom;
        return (
          <pre key={i} className="md-code">
            <code>{b.text}</code>
          </pre>
        );
      }
      case 'h':
        return React.createElement(`h${Math.min(b.level + 2, 6)}`, { key: i, className: 'md-h' }, inline(b.text, r));
      case 'ul':
        return <ul key={i}>{items(b.items, r)}</ul>;
      case 'ol':
        return (
          <ol key={i} start={b.start === 1 ? undefined : b.start}>
            {items(b.items, r)}
          </ol>
        );
      case 'quote':
        return <blockquote key={i}>{blocks(b.blocks, r)}</blockquote>;
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
                      {inline(c, r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, k) => (
                  <tr key={k}>
                    {row.map((c, j) => (
                      <td key={j} style={{ textAlign: b.align[j] ?? undefined }}>
                        {inline(c, r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <p key={i}>{inline(b.text, r)}</p>;
    }
  });
}

function items(list: ListItem[], r: MarkdownRender): React.ReactNode[] {
  return list.map((it, j) => (
    <li key={j}>
      {inline(it.text, r)}
      {blocks(it.children, r)}
    </li>
  ));
}

function inline(text: string, r: MarkdownRender): React.ReactNode[] {
  return nodes(parseInline(text), r);
}

function nodes(list: Inline[], r: MarkdownRender): React.ReactNode[] {
  return list.map((n, i) => {
    switch (n.kind) {
      case 'code':
        return <code key={i}>{n.text}</code>;
      case 'strong':
        return <strong key={i}>{nodes(n.children, r)}</strong>;
      case 'em':
        return <em key={i}>{nodes(n.children, r)}</em>;
      case 'del':
        return <del key={i}>{nodes(n.children, r)}</del>;
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
        return r.text ? r.text(n.text, i) : <React.Fragment key={i}>{n.text}</React.Fragment>;
    }
  });
}
