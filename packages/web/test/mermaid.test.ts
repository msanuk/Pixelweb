import { describe, expect, it } from 'vitest';
import { isDark, mermaidThemeVariables } from '../src/lib/mermaid';

describe('isDark', () => {
  it('tells the graphite background from paper', () => {
    expect(isDark('#141413')).toBe(true);
    expect(isDark(' #f5f4f0')).toBe(false);
    expect(isDark('not a color')).toBe(false);
  });
});

describe('mermaidThemeVariables', () => {
  it('fills every color from the page variables', () => {
    const vars: Record<string, string> = { '--bg': '#141413', '--text': '#e7e5e0', '--series-1': '#b8b5ae' };
    const t = mermaidThemeVariables((name) => vars[name] ?? '#123456');
    expect(t.darkMode).toBe(true);
    expect(t.primaryTextColor).toBe('#e7e5e0');
    expect(t.pie1).toBe('#b8b5ae');
    expect(Object.entries(t).filter(([k, v]) => k !== 'darkMode' && !v)).toEqual([]);
  });
});
