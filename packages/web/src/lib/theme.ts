import { useSyncExternalStore } from 'react';

/**
 * Two independent choices, each kept on <html>: the light/dark mode
 * (data-theme; "system" follows prefers-color-scheme) and the colour family
 * (data-palette), which has a light and a dark variant of its own.
 */
export type ThemeChoice = 'system' | 'paper' | 'graphite';
export type PaletteChoice = 'ink' | 'clay';

export const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: '跟随系统' },
  { id: 'paper', label: '浅色' },
  { id: 'graphite', label: '深色' },
];

export const PALETTES: { id: PaletteChoice; label: string }[] = [
  { id: 'ink', label: '纸墨' },
  { id: 'clay', label: '陶土' },
];

// Keep in sync with the inline script in index.html, which applies both before first paint.
const THEME_KEY = 'pixelweb.theme';
const PALETTE_KEY = 'pixelweb.palette';
const listeners = new Set<() => void>();

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode): the choice still applies for this page load
  }
}

let theme: ThemeChoice = read(THEME_KEY, ['paper', 'graphite'], 'system');
let palette: PaletteChoice = read(PALETTE_KEY, ['clay'], 'ink');

function apply(): void {
  const d = document.documentElement.dataset;
  if (theme === 'system') delete d.theme;
  else d.theme = theme;
  if (palette === 'ink') delete d.palette;
  else d.palette = palette;
}

function changed(): void {
  apply();
  for (const l of listeners) l();
}

export function setTheme(t: ThemeChoice): void {
  theme = t;
  save(THEME_KEY, t === 'system' ? null : t);
  changed();
}

export function setPalette(p: PaletteChoice): void {
  palette = p;
  save(PALETTE_KEY, p === 'ink' ? null : p);
  changed();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => theme);
}

export function usePalette(): PaletteChoice {
  return useSyncExternalStore(subscribe, () => palette);
}

apply();
