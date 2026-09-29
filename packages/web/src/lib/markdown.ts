/** Block structure for the deliberately tiny renderer in components/Markdown.tsx. */

export type Align = 'left' | 'center' | 'right' | null;

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: number; text: string }
  /** `lang` is the fence's info word (```ts → "ts"); `closed` is false while a streaming reply hasn't closed the fence yet */
  | { kind: 'code'; text: string; lang: string; closed: boolean }
  | { kind: 'ul'; items: ListItem[] }
  /** `start`: the first item's number (`3.` → 3) */
  | { kind: 'ol'; start: number; items: ListItem[] }
  | { kind: 'table'; align: Align[]; head: string[]; rows: string[][] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'hr' };

/** A list item's own line (plus lazily wrapped lines), and whatever is indented under it: nested lists, code, paragraphs. */
export interface ListItem {
  text: string;
  children: Block[];
}

/**
 * A link target that is safe to put in `href`: http(s) or mailto only. Replies
 * are agent output, and this page can prompt the agent and approve commands,
 * so a `javascript:` or `data:` link must never become clickable.
 */
export function safeHref(href: string): string | null {
  const h = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}

const DELIM_CELL = /^\s*:?-+:?\s*$/;

/**
 * A GFM table row's cells: outer pipes optional, `\|` is a literal pipe, and a
 * pipe inside `code` doesn't split (models write `a | b` in code spans a lot).
 */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && line[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (c === '`') {
      inCode = !inCode;
      cur += c;
    } else if (c === '|' && !inCode) {
      cells.push(cur);
      cur = '';
    } else cur += c;
  }
  cells.push(cur);
  // leading/trailing pipes leave empty edge cells
  if (cells.length > 1 && !cells[0].trim()) cells.shift();
  if (cells.length > 1 && !cells[cells.length - 1].trim()) cells.pop();
  return cells.map((c) => c.trim());
}

/** The `|---|:--:|` line under a table's header, as column alignments; null if `line` isn't one. */
function delimiterRow(line: string): Align[] | null {
  if (!line.includes('-') || !/^[\s|:-]+$/.test(line)) return null;
  const cells = splitRow(line);
  if (!cells.every((c) => DELIM_CELL.test(c))) return null;
  return cells.map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : null));
}

/** Header + delimiter at `i` with the same number of columns. */
function tableAt(lines: string[], i: number): Align[] | null {
  if (!lines[i]?.includes('|') || i + 1 >= lines.length) return null;
  const align = delimiterRow(lines[i + 1]);
  return align && align.length === splitRow(lines[i]).length ? align : null;
}

const fit = (cells: string[], n: number) => (cells.length >= n ? cells.slice(0, n) : [...cells, ...Array<string>(n - cells.length).fill('')]);

/** Leading whitespace width, a tab counting as 4. */
function indentOf(line: string): number {
  let n = 0;
  for (const c of line) {
    if (c === ' ') n++;
    else if (c === '\t') n += 4 - (n % 4);
    else break;
  }
  return n;
}

const HR = /^ {0,3}([-*_])( *\1){2,} *$/;
const QUOTE = /^ {0,3}> ?/;

/** A list item's first line: its indent, whether it is numbered, the number, and the text after the marker. */
function listMarker(line: string): { indent: number; ordered: boolean; n: number; text: string } | null {
  if (HR.test(line)) return null;
  const m = /^(\s*)(?:([-*+])|(\d{1,9})[.)])[ \t]+(.*)$/.exec(line) ?? /^(\s*)(?:([-*+])|(\d{1,9})[.)])$/.exec(line);
  if (!m) return null;
  return { indent: indentOf(m[1]), ordered: !m[2], n: m[3] ? Number(m[3]) : 1, text: m[4] ?? '' };
}

/** Anything that ends a paragraph (a table header is checked separately: it needs the next line). */
function startsBlock(line: string): boolean {
  return /^(#{1,6}\s|```)/.test(line) || HR.test(line) || QUOTE.test(line) || !!listMarker(line);
}

/** `lines` shifted left by their smallest indent. */
function dedent(lines: string[]): string[] {
  const widths = lines.filter((l) => l.trim()).map(indentOf);
  const cut = widths.length ? Math.min(...widths) : 0;
  return lines.map((l) => {
    let n = 0;
    let k = 0;
    while (k < l.length && n < cut && (l[k] === ' ' || l[k] === '\t')) n += l[k++] === '\t' ? 4 - (n % 4) : 1;
    return l.slice(k);
  });
}

export function parseBlocks(text: string): Block[] {
  return parseLines(text.replace(/\r\n/g, '\n').split('\n'));
}

function parseLines(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim().split(/\s+/)[0].toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      const closed = i < lines.length;
      i++;
      out.push({ kind: 'code', text: buf.join('\n'), lang, closed });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      out.push({ kind: 'h', level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (HR.test(line)) {
      out.push({ kind: 'hr' });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) buf.push(lines[i++].replace(QUOTE, ''));
      out.push({ kind: 'quote', blocks: parseLines(buf) });
      continue;
    }
    const align = tableAt(lines, i);
    if (align) {
      const head = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      // GFM: the table runs until a blank line or another block starts
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) rows.push(fit(splitRow(lines[i++]), head.length));
      out.push({ kind: 'table', align, head, rows });
      continue;
    }
    const marker = listMarker(line);
    if (marker) {
      i = parseList(lines, i, marker, out);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i]) && !tableAt(lines, i)) buf.push(lines[i++].trim());
    out.push({ kind: 'p', text: joinLines(buf) });
  }
  return out;
}

/**
 * One list starting at `lines[i]`, pushed onto `out`; returns the index after it.
 * A line indented deeper than the item's marker belongs to that item (models
 * indent nested lists by 2, 3 or 4 spaces, so any deeper indent counts).
 * Blank lines between items keep the list going; a marker of the other kind
 * (bullet vs number) at the same depth starts a new list.
 */
function parseList(lines: string[], i: number, first: NonNullable<ReturnType<typeof listMarker>>, out: Block[]): number {
  const base = first.indent;
  const items: ListItem[] = [];
  while (i < lines.length) {
    if (!lines[i].trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const next = j < lines.length ? listMarker(lines[j]) : null;
      if (next && next.indent <= base && next.ordered === first.ordered) {
        i = j;
        continue;
      }
      break;
    }
    const m = listMarker(lines[i]);
    if (!m || m.indent > base || m.ordered !== first.ordered) break;
    const text = [m.text];
    const body: string[] = [];
    i++;
    // wrapped text right under the item joins its line, until something block-like or a blank line
    while (i < lines.length && lines[i].trim() && indentOf(lines[i]) > base && !startsBlock(lines[i].trimStart())) text.push(lines[i++].trim());
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && indentOf(lines[j]) > base) {
          body.push('');
          i++;
          continue;
        }
        break;
      }
      if (indentOf(l) <= base) break;
      body.push(l);
      i++;
    }
    items.push({ text: joinLines(text), children: body.length ? parseLines(dedent(body)) : [] });
  }
  out.push(first.ordered ? { kind: 'ol', start: first.n, items } : { kind: 'ul', items });
  return i;
}

/** Soft-wrapped lines of one paragraph: a space between them, except where both sides are CJK (Chinese doesn't put spaces between words). */
export function joinLines(lines: string[]): string {
  return lines.reduce((acc, l) => (!acc ? l : CJK_END.test(acc) && CJK_START.test(l) ? acc + l : `${acc} ${l}`), '');
}
const CJK_END = /[　-〿㐀-鿿豈-﫿＀-￯]$/;
const CJK_START = /^[　-〿㐀-鿿豈-﫿＀-￯]/;

// ---- Inline -------------------------------------------------------------------

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'del'; children: Inline[] }
  | { kind: 'link'; text: string; href: string };

/*
 * Emphasis needs a non-space right inside both delimiters, so "2 * 3 * 4" and
 * "*.ts, *.js" stay text; `_x_` also needs a non-word character outside, so
 * snake_case_names do too; `__word__` stays a (Python dunder) name.
 */
const INLINE_RE =
  /(`[^`]+`)|(\*\*(?=\S)(.+?)(?<=\S)\*\*|__(?=\S)(.+?)(?<=\S)__(?!\w))|(~~(?=\S)(.+?)(?<=\S)~~)|(\*(?=[^\s*])(.+?)(?<=[^\s*])\*|(?<![\w\\])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![\w]))|(\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\))/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1]) out.push({ kind: 'code', text: m[1].slice(1, -1) });
    // Python's __init__ / __name__ are names, not bold
    else if (m[4] !== undefined && /^\w+$/.test(m[4])) out.push({ kind: 'text', text: m[0] });
    else if (m[2]) out.push({ kind: 'strong', children: parseInline(m[3] ?? m[4]) });
    else if (m[5]) out.push({ kind: 'del', children: parseInline(m[6]) });
    else if (m[7]) out.push({ kind: 'em', children: parseInline(m[8] ?? m[9]) });
    else out.push({ kind: 'link', text: m[11], href: m[12] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}
