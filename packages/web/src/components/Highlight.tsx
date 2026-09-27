import { useMemo } from 'react';
import { openCard, useStore } from '../lib/store';
import { buildMatcher, splitByTerms } from '../lib/terms';
import { useSettings } from '../lib/settings';

let cache: { key: number; matcher: ReturnType<typeof buildMatcher> } | null = null;

/** Renders text with every known knowledge term as a clickable underline. */
export function Highlight({ text, context }: { text: string; context?: string }) {
  const terms = useStore((s) => s.terms);
  const matcher = useMemo(() => {
    if (cache && cache.key === terms.length) return cache.matcher;
    const m = buildMatcher(terms);
    cache = { key: terms.length, matcher: m };
    return m;
  }, [terms]);
  const pieces = useMemo(() => splitByTerms(text, matcher), [text, matcher]);
  const enabled = useSettings().highlightTerms;
  if (!enabled) return <>{text}</>;
  return (
    <>
      {pieces.map((p, i) =>
        p.cardId ? (
          <button
            key={i}
            type="button"
            className="term"
            title="点击查看概念卡片"
            onClick={(e) => {
              e.stopPropagation();
              openCard(p.cardId!, context ?? text.slice(0, 400));
            }}
          >
            {p.text}
          </button>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
