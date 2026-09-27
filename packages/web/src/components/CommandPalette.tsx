import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { getState, openCard, refreshSessions, selectSession, setState, toast, useStore, type Tab } from '../lib/store';
import { THEMES, setTheme, useTheme } from '../lib/theme';
import { downloadText, exportFilename, learningMarkdown } from '../lib/export';
import { relTime } from '../lib/format';
import { buildItems, filterItems, type PaletteAction, type PaletteItem } from '../lib/palette';
import { Icon, type IconName } from './Icon';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const PALETTE_SHORTCUT = IS_MAC ? '⌘K' : 'Ctrl K';

const TAB_ICON: Record<Tab, IconName> = { timeline: 'timeline', git: 'git', arch: 'arch', knowledge: 'book' };
const optionId = (i: number) => `cmdk-opt-${i}`;

/** The top bar's stand-in for a search box: opens the palette. */
export function PaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="cmdk-trigger" onClick={onOpen} aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" title={`命令面板（${PALETTE_SHORTCUT}）`}>
      <Icon name="search" size={14} />
      <span>搜索概念、会话、命令…</span>
      <kbd>{PALETTE_SHORTCUT}</kbd>
    </button>
  );
}

/** ⌘K: jump to a page, session or concept card, or run a command. Ranking lives in lib/palette.ts. */
export function CommandPalette({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const sessions = useStore((s) => s.sessions);
  const teaching = useStore((s) => s.teachingSessions);
  const knowledge = useStore((s) => s.knowledge);
  const canExport = useStore((s) => Object.keys(s.learning.records).length > 0);
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // captured on first render, before the input takes focus
  const [restoreTo] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));

  const items = useMemo(
    () => buildItems({ sessions, teaching, knowledge, themes: THEMES, theme, canExport }),
    [sessions, teaching, knowledge, theme, canExport],
  );
  const sections = useMemo(() => filterItems(items, query), [items, query]);
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const current = Math.min(active, flat.length - 1); // the list can shrink under us (sessions update live)

  const inputRef = useRef<HTMLInputElement>(null);
  // focus in the same effect that hands it back, so StrictMode's mount/unmount/mount leaves it in the input
  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (restoreTo?.isConnected) restoreTo.focus();
    };
  }, [restoreTo]);
  useEffect(() => {
    if (current >= 0) document.getElementById(optionId(current))?.scrollIntoView({ block: 'nearest' });
  }, [current, sections]);

  const run = (item: PaletteItem) => {
    onClose();
    perform(item.action, onOpenSettings);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // IME: Enter/arrows belong to the candidate window
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[current]) run(flat[current]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // don't also close an open concept card
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // the input is the only stop in this dialog
    }
  };

  let index = 0;
  return (
    <div className="modal-backdrop cmdk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal cmdk" role="dialog" aria-modal="true" aria-label="命令面板">
        <div className="cmdk-input">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-autocomplete="list"
            aria-activedescendant={current >= 0 ? optionId(current) : undefined}
            aria-label="搜索概念、会话、命令"
            placeholder="搜索概念、会话、命令…"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(e) => (setQuery(e.target.value), setActive(0))}
            onKeyDown={onKeyDown}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" aria-label="结果">
          {sections.map((sec) => (
            <div key={sec.group} role="group" aria-labelledby={`cmdk-g-${sec.group}`}>
              <div className="cmdk-group" id={`cmdk-g-${sec.group}`} role="presentation">
                {sec.label}
              </div>
              {sec.items.map((item) => {
                const i = index++;
                return (
                  <div
                    key={item.key}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === current}
                    className={`cmdk-item ${i === current ? 'on' : ''}`}
                    onMouseMove={() => i !== current && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                    onClick={() => run(item)}
                  >
                    <Icon name={iconFor(item)} size={15} />
                    <span className="cmdk-title">{item.title}</span>
                    {item.summary && <span className="cmdk-sub">{item.summary}</span>}
                    <span className="cmdk-meta">{meta(item)}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && <p className="cmdk-empty muted">没有找到“{query.trim()}”相关的概念、会话或命令</p>}
        </div>
        <footer className="cmdk-foot muted small" aria-hidden="true">
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
          <span>Esc 关闭</span>
        </footer>
      </div>
    </div>
  );
}

function iconFor(item: PaletteItem): IconName {
  const a = item.action;
  switch (a.kind) {
    case 'tab':
      return TAB_ICON[a.tab];
    case 'session':
      return item.teaching ? 'book' : 'chat';
    case 'card':
      return 'book';
    case 'theme':
      return 'contrast';
    case 'settings':
      return 'settings';
    case 'export':
      return 'download';
    case 'refresh':
      return 'refresh';
  }
}

function meta(item: PaletteItem): string {
  if (item.group === 'session') return `${item.teaching ? '教学 · ' : item.child ? '子任务 · ' : ''}${relTime(item.updated ?? 0)}`;
  if (item.current) return '当前';
  return '';
}

function perform(a: PaletteAction, openSettings: () => void): void {
  switch (a.kind) {
    case 'tab':
      return setState({ tab: a.tab });
    case 'session':
      return void selectSession(a.id);
    case 'card':
      return openCard(a.id);
    case 'theme':
      return setTheme(a.theme);
    case 'settings':
      return openSettings();
    case 'refresh':
      return void refreshSessions().then(() => {
        const err = getState().sessionsError;
        toast(err ? `刷新会话失败：${err}` : '会话已刷新');
      });
    case 'export': {
      const s = getState();
      const now = Date.now();
      const project = s.server?.projectRoot.split(/[\\/]/).filter(Boolean).pop(); // Windows paths use backslashes
      return downloadText(exportFilename(now), learningMarkdown(s.knowledge, s.learning, { project, now }));
    }
  }
}
