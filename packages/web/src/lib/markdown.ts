/** Block structure for the deliberately tiny renderer in components/Markdown.tsx. */

export type Align = 'left' | 'center' | 'right' | null;

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: number; text: string }
  /** `lang` is the fence's info word (```ts → "ts"); `closed` is false while a streaming reply hasn't closed the fence yet */
  | { kind: 'code'; text: string; lang: string; closed: boolean }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; align: Align[]; head: string[]; rows: string[][] };

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

const BLOCK_START = /^(#{1,6}\s|```|\s*[-*]\s+|\s*\d+[.)]\s+)/;

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
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
    const align = tableAt(lines, i);
    if (align) {
      const head = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      // GFM: the table runs until a blank line or another block starts
      while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) rows.push(fit(splitRow(lines[i++]), head.length));
      out.push({ kind: 'table', align, head, rows });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      out.push({ kind: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      out.push({ kind: 'ol', items });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i]) && !tableAt(lines, i)) buf.push(lines[i++]);
    out.push({ kind: 'p', text: buf.join(' ') });
  }
  return out;
}
