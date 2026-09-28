import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTheme } from '../lib/theme';
import { mermaidThemeVariables } from '../lib/mermaid';

type MermaidApi = typeof import('mermaid').default;

// mermaid is a few MB: loaded the first time a reply or card contains a diagram, never in the main bundle
let loading: Promise<MermaidApi> | null = null;
const load = () => (loading ??= import('mermaid').then((m) => m.default));

/** Rendered SVG by theme + source, so re-renders while a reply streams below a diagram don't redraw it. */
const cache = new Map<string, string>();
let seq = 0;

async function draw(code: string, themeKey: string): Promise<string> {
  const key = `${themeKey}\n${code}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mermaid = await load();
  const style = getComputedStyle(document.documentElement);
  mermaid.initialize({
    startOnLoad: false,
    // the source is agent output: no click handlers, scripts or raw HTML labels
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: mermaidThemeVariables((name) => style.getPropertyValue(name).trim()),
    suppressErrorRendering: true,
  });
  const id = `pw-mermaid-${++seq}`;
  try {
    const { svg } = await mermaid.render(id, code);
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
    cache.set(key, svg);
    return svg;
  } finally {
    // a failed render can leave its scratch element behind
    document.getElementById(`d${id}`)?.remove();
  }
}

const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function useSystemDark(): boolean {
  return useSyncExternalStore(
    (l) => {
      darkQuery?.addEventListener('change', l);
      return () => darkQuery?.removeEventListener('change', l);
    },
    () => darkQuery?.matches ?? false,
  );
}

/** A ```mermaid block: the diagram, with its source one click away (and shown instead when it doesn't parse). */
export function MermaidBlock({ code }: { code: string }) {
  const theme = useTheme();
  const systemDark = useSystemDark();
  const themeKey = theme === 'system' ? `system-${systemDark ? 'dark' : 'light'}` : theme;
  const [state, setState] = useState<{ svg?: string; error?: string }>(() => ({ svg: cache.get(`${themeKey}\n${code}`) }));
  const [source, setSource] = useState(false);

  useEffect(() => {
    let alive = true;
    draw(code, themeKey).then(
      (svg) => alive && setState({ svg }),
      (e: unknown) => alive && setState({ error: (e instanceof Error ? e.message : String(e)).split('\n')[0] }),
    );
    return () => {
      alive = false;
    };
  }, [code, themeKey]);

  const showSource = source || !!state.error;
  return (
    <div className="md-mermaid">
      <div className="md-mermaid-bar">
        <span className="muted">{state.error ? `图画不出来：${state.error}` : state.svg ? 'Mermaid 图' : '正在画图…'}</span>
        {!state.error && (
          <button className="link-btn" onClick={() => setSource((s) => !s)}>
            {source ? '看图' : '看源码'}
          </button>
        )}
      </div>
      {showSource ? (
        <pre className="md-code">
          <code>{code}</code>
        </pre>
      ) : (
        state.svg && <div className="md-mermaid-svg" dangerouslySetInnerHTML={{ __html: state.svg }} />
      )}
    </div>
  );
}
