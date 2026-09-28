/**
 * Mermaid's `base` theme, filled from the page's CSS variables so diagrams
 * follow the current PixelWeb theme. Mermaid computes derived shades itself
 * (khroma), so it needs real colors, not `var(--x)`: callers pass a reader
 * over getComputedStyle.
 */
export type CssVar = (name: string) => string;

/** Relative luminance below the midpoint: a dark theme. */
export function isDark(color: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.18;
}

export function mermaidThemeVariables(v: CssVar): Record<string, string | boolean> {
  const text = v('--text');
  const panel = v('--panel');
  const node = v('--panel-2');
  const soft = v('--accent-soft');
  const border = v('--border-strong');
  const line = v('--muted');
  return {
    darkMode: isDark(v('--bg')),
    background: panel,
    fontFamily: v('--sans'),
    fontSize: '13px',
    textColor: text,
    titleColor: text,
    lineColor: line,
    primaryColor: node,
    primaryTextColor: text,
    primaryBorderColor: border,
    secondaryColor: soft,
    secondaryTextColor: text,
    secondaryBorderColor: border,
    tertiaryColor: panel,
    tertiaryTextColor: text,
    tertiaryBorderColor: v('--border'),
    mainBkg: node,
    nodeBorder: border,
    clusterBkg: panel,
    clusterBorder: v('--border'),
    edgeLabelBackground: panel,
    noteBkgColor: soft,
    noteTextColor: text,
    noteBorderColor: border,
    actorBkg: node,
    actorBorder: border,
    actorTextColor: text,
    actorLineColor: line,
    signalColor: text,
    signalTextColor: text,
    labelBoxBkgColor: node,
    labelBoxBorderColor: border,
    labelTextColor: text,
    loopTextColor: text,
    activationBkgColor: soft,
    activationBorderColor: border,
    // pie slices take the chart series, in order
    ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`pie${i}`, v(`--series-${i}`)])),
    pieStrokeColor: panel,
    pieOuterStrokeColor: border,
    pieTitleTextColor: text,
    pieSectionTextColor: panel,
    pieLegendTextColor: text,
  };
}
