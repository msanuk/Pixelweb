import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectOption } from '@pixelweb/shared';
import { Icon } from './Icon';
import { api } from '../lib/api';
import { switchProject, useStore } from '../lib/store';
import { relTime } from '../lib/format';

/**
 * The project crumb in the top bar. OpenCode serves many projects at once but PixelWeb
 * visualises one; this switches which (for every open tab — the server holds the choice).
 */
export function ProjectPicker() {
  const root = useStore((s) => s.server?.projectRoot);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setAnchor(null);
    btnRef.current?.focus();
  }, []);
  if (!root) return null;
  const name = root.split(/[\\/]/).filter(Boolean).pop() ?? root; // Windows paths use backslashes
  return (
    <>
      <button
        ref={btnRef}
        className="project-btn mono"
        title={`${root}\n点击切换项目`}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={() => setAnchor(anchor ? null : btnRef.current!.getBoundingClientRect())}
      >
        <span>{name}</span>
        <Icon name="down" size={12} />
      </button>
      {anchor && <ProjectMenu anchor={anchor} onClose={close} />}
    </>
  );
}

function ProjectMenu({ anchor, onClose }: { anchor: DOMRect; onClose: () => void }) {
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.projects().then(setProjects).catch((e) => (setProjects([]), setErr(e instanceof Error ? e.message : String(e))));
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // don't also close an open concept card
      onClose();
    };
    // the click that opened the menu is still bubbling; listen from the next tick
    const t = setTimeout(() => document.addEventListener('mousedown', onDown));
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const pick = async (dir: string) => {
    setBusy(dir);
    setErr(null);
    try {
      await switchProject(dir);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="project-menu" role="dialog" aria-label="切换项目" style={{ top: anchor.bottom + 6, left: Math.max(8, anchor.left - 8) }}>
      <div className="project-menu-head muted small">OpenCode 打开过的项目，以及本次用过的</div>
      <ul className="project-list">
        {projects === null && <li className="muted small project-hint">加载中…</li>}
        {projects?.map((p) => (
          <li key={p.dir}>
            <button className={`project-item ${p.current ? 'on' : ''}`} disabled={!!busy} aria-current={p.current || undefined} onClick={() => (p.current ? onClose() : void pick(p.dir))}>
              <span className="project-check">{p.current && <Icon name="check" size={13} />}</span>
              <span className="project-text">
                <span className="project-name">{p.name}</span>
                <span className="project-dir mono">{p.dir}</span>
              </span>
              <span className="muted small">{busy === p.dir ? '切换中…' : p.updated ? relTime(p.updated) : ''}</span>
            </button>
          </li>
        ))}
        {projects?.length === 1 && <li className="muted small project-hint">OpenCode 还没有打开过别的项目，也可以在下面直接输入路径。</li>}
      </ul>
      <form
        className="project-custom"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) void pick(custom.trim());
        }}
      >
        <input className="mono" placeholder="其他目录的完整路径" spellCheck={false} value={custom} onChange={(e) => (setCustom(e.target.value), setErr(null))} disabled={!!busy} aria-label="项目路径" />
        <button type="submit" disabled={!!busy || !custom.trim()}>
          打开
        </button>
      </form>
      {err && <p className="error small project-err">{err}</p>}
      <p className="muted small project-foot">切换后，所有打开的标签页都会跟着换；Git、架构图和会话列表都改为这个项目的。</p>
    </div>
  );
}
