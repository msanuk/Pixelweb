import { useSyncExternalStore } from 'react';

/** "system" follows prefers-color-scheme; the others pin a theme via <html data-theme>. */
export type ThemeChoice = 'system' | 'paper' | 'graphite';

export const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: '跟随系统' },
  { id: 'paper', label: '纸白' },
  { id: 'graphite', label: '石墨' },
];

// Keep in sync with the inline script in index.html, which applies the theme before first paint.
const KEY = 'pixelweb.theme';
const listeners = new Set<() => void>();

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'paper' || v === 'graphite' ? v : 'system';
  } catch {
    return 'system';
  }
}

let current: ThemeChoice = read();

function apply(t: ThemeChoice): void {
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

export function setTheme(t: ThemeChoice): void {
  current = t;
  apply(t);
  try {
    if (t === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // storage unavailable (private mode): theme still applies for this page load
  }
  for (const l of listeners) l();
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

apply(current);
