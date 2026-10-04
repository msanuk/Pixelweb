import { Highlight } from './Highlight';
import { MermaidBlock } from './Mermaid';
import { MarkdownView, type MarkdownRender } from './MarkdownView';

const fence: MarkdownRender['fence'] = (lang, code, key) => (lang === 'mermaid' ? <MermaidBlock key={key} code={code} /> : null);
const withTerms: MarkdownRender = { fence, text: (text, key) => <Highlight key={key} text={text} /> };
const plain: MarkdownRender = { fence };

/**
 * Agent replies and card bodies in the app: MarkdownView, plus ```mermaid
 * diagrams and text passed through <Highlight/> so knowledge terms are
 * clickable.
 */
export function Markdown({ text, highlight = true }: { text: string; highlight?: boolean }) {
  return <MarkdownView text={text} render={highlight ? withTerms : plain} />;
}
