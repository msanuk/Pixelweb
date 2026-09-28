import { useSyncExternalStore } from 'react';

/** Per-browser preferences (the theme lives in theme.ts, which predates this). */
export interface Settings {
  /** UI zoom in percent */
  scale: 90 | 100 | 110 | 125;
  density: 'comfortable' | 'compact';
  /** underline known terms in agent text; off for people who know the vocabulary */
  highlightTerms: boolean;
  notify: {
    enabled: boolean;
    /** a top-level session went from busy to idle */
    done: boolean;
    permission: boolean;
    error: boolean;
    /** stay quiet while this tab is in front */
    onlyWhenHidden: boolean;
  };
}

export const SCALES: Settings['scale'][] = [90, 100, 110, 125];

export const DEFAULTS: Settings = {
  scale: 100,
  density: 'comfortable',
  highlightTerms: true,
  notify: { enabled: false, done: true, permission: true, error: true, onlyWhenHidden: true },
};

// Keep in sync with the inline script in index.html, which applies scale and density before first paint.
const KEY = 'pixelweb.settings';
const listeners = new Set<() => void>();

/** Saved settings over the defaults; anything unrecognised falls back to its default. */
export function parseSettings(raw: string | null): Settings {
  let v: any = {};
  try {
    v = raw ? JSON.parse(raw) : {};
  } catch {
    /* corrupt: defaults */
  }
  const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
  const n = v?.notify ?? {};
  return {
    scale: SCALES.includes(v?.scale) ? v.scale : DEFAULTS.scale,
    density: v?.density === 'compact' ? 'compact' : 'comfortable',
    highlightTerms: bool(v?.highlightTerms, DEFAULTS.highlightTerms),
    notify: {
      enabled: bool(n.enabled, DEFAULTS.notify.enabled),
      done: bool(n.done, DEFAULTS.notify.done),
      permission: bool(n.permission, DEFAULTS.notify.permission),
      error: bool(n.error, DEFAULTS.notify.error),
      onlyWhenHidden: bool(n.onlyWhenHidden, DEFAULTS.notify.onlyWhenHidden),
    },
  };
}

function read(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return DEFAULTS;
  }
}

let current: Settings = read();

function apply(s: Settings): void {
  const root = document.documentElement;
  root.style.zoom = s.scale === 100 ? '' : String(s.scale / 100);
  if (s.density === 'compact') root.dataset.density = 'compact';
  else delete root.dataset.density;
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Omit<Settings, 'notify'>> & { notify?: Partial<Settings['notify']> }): void {
  current = { ...current, ...patch, notify: { ...current.notify, ...patch.notify } };
  apply(current);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage unavailable (private mode): applies for this page load only
  }
  for (const l of listeners) l();
}

export function resetSettings(): void {
  updateSettings(DEFAULTS);
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

if (typeof document !== 'undefined') apply(current); // absent in unit tests
