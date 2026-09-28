/** One rendered line of a diff. `hunk` rows are the "@@ … @@" separators. */
export interface DiffRow {
  kind: 'hunk' | 'add' | 'del' | 'ctx' | 'meta';
  text: string;
  oldNo?: number;
  newNo?: number;
}

export interface Diff {
  rows: DiffRow[];
  additions: number;
  deletions: number;
  /** built from a snippet (e.g. an edit's old/new strings): line numbers don't match the file */
  fragment?: boolean;
}

function withStats(rows: DiffRow[]): Diff {
  let additions = 0,
    deletions = 0;
  for (const r of rows) {
    if (r.kind === 'add') additions++;
    else if (r.kind === 'del') deletions++;
  }
  return { rows, additions, deletions };
}

/** Parses a single-file unified diff (git diff, opencode edit metadata). File headers are dropped. */
export function parseUnified(text: string): Diff {
  const rows: DiffRow[] = [];
  let inHunk = false;
  let oldNo = 0,
    newNo = 0;
  for (const line of text.split('\n')) {
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
    if (h) {
      inHunk = true;
      oldNo = Number(h[1]);
      newNo = Number(h[2]);
      rows.push({ kind: 'hunk', text: line });
      continue;
    }
    if (line.startsWith('diff --git')) {
      inHunk = false;
      continue;
    }
    if (!inHunk) {
      if (line.startsWith('Binary files')) rows.push({ kind: 'meta', text: line });
      continue;
    }
    if (line.startsWith('+')) rows.push({ kind: 'add', text: line.slice(1), newNo: newNo++ });
    else if (line.startsWith('-')) rows.push({ kind: 'del', text: line.slice(1), oldNo: oldNo++ });
    else if (line.startsWith(' ')) rows.push({ kind: 'ctx', text: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
    else if (line.startsWith('\\')) rows.push({ kind: 'meta', text: line });
  }
  return withStats(rows);
}

const MAX_CELLS = 4_000_000;

/**
 * Line diff of two texts (LCS after trimming the common prefix/suffix), with
 * unchanged runs collapsed to `context` lines around each change.
 */
export function lineDiff(before: string, after: string, context = 3): Diff {
  const a = before === '' ? [] : before.split('\n');
  const b = after === '' ? [] : after.split('\n');
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const am = a.slice(pre, a.length - suf);
  const bm = b.slice(pre, b.length - suf);

  const middle: DiffRow[] = [];
  if (am.length * bm.length > MAX_CELLS) {
    // too big for a table: show it as a full replacement rather than hang the tab
    am.forEach((t) => middle.push({ kind: 'del', text: t }));
    bm.forEach((t) => middle.push({ kind: 'add', text: t }));
  } else {
    // lcs[i][j] = LCS length of am[i..] and bm[j..]
    const lcs = Array.from({ length: am.length + 1 }, () => new Uint32Array(bm.length + 1));
    for (let i = am.length - 1; i >= 0; i--)
      for (let j = bm.length - 1; j >= 0; j--) lcs[i][j] = am[i] === bm[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    let i = 0,
      j = 0;
    while (i < am.length || j < bm.length) {
      if (i < am.length && j < bm.length && am[i] === bm[j]) middle.push({ kind: 'ctx', text: am[i++] }), j++;
      // prefer deletions first, so a replaced line reads "- old / + new"
      else if (i < am.length && (j === bm.length || lcs[i + 1][j] >= lcs[i][j + 1])) middle.push({ kind: 'del', text: am[i++] });
      else middle.push({ kind: 'add', text: bm[j++] });
    }
  }

  const all: DiffRow[] = [
    ...a.slice(0, pre).map((text): DiffRow => ({ kind: 'ctx', text })),
    ...middle,
    ...a.slice(a.length - suf).map((text): DiffRow => ({ kind: 'ctx', text })),
  ];
  let oldNo = 1,
    newNo = 1;
  for (const r of all) {
    if (r.kind !== 'add') r.oldNo = oldNo++;
    if (r.kind !== 'del') r.newNo = newNo++;
  }
  return withStats(collapse(all, context));
}

/** Keeps `context` unchanged lines around changes; longer unchanged runs become a hunk separator. */
function collapse(rows: DiffRow[], context: number): DiffRow[] {
  const keep = new Array<boolean>(rows.length).fill(false);
  rows.forEach((r, i) => {
    if (r.kind === 'ctx') return;
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true;
  });
  // a separator for one or two hidden lines costs more than it saves: show them
  for (let i = 0; i < rows.length; ) {
    if (keep[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < rows.length && !keep[j]) j++;
    if (i > 0 && j < rows.length && j - i <= 2) for (let k = i; k < j; k++) keep[k] = true;
    i = j;
  }
  const out: DiffRow[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    if (keep[i]) {
      if (skipped) out.push({ kind: 'hunk', text: `… ${skipped} 行未改动` });
      skipped = 0;
      out.push(r);
    } else skipped++;
  });
  if (skipped && out.length) out.push({ kind: 'hunk', text: `… ${skipped} 行未改动` });
  return out;
}
