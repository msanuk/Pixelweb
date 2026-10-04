// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { Dom } from '../src/content/extract';
import { hoverTips } from '../src/content/hover';

const shown = (el: Element) => !el.closest('[hidden]');
const dom: Dom = { visible: shown, rendered: shown };

/** A tooltip library in miniature: draws its balloon a moment after mouseenter, removes it after mouseleave (like Fusion). */
function tooltip(icon: Element, text: string) {
  let tip: HTMLElement | null = null;
  icon.addEventListener('mouseenter', () =>
    setTimeout(() => {
      tip = document.createElement('div');
      tip.className = 'next-overlay-wrapper opened';
      tip.innerHTML = `<div role="tooltip" class="next-balloon-tooltip"><div class="next-balloon-arrow"></div><div class="next-balloon-content">${text}</div></div>`;
      document.body.append(tip);
    }, 40),
  );
  icon.addEventListener('mouseleave', () => setTimeout(() => tip?.remove(), 100));
}

describe('hoverTips', () => {
  it('hovers each icon in turn and reads the tooltip it opens', async () => {
    document.body.innerHTML = '<i id="a"></i><i id="b"></i><i id="c"></i><div role="tooltip" class="always">页面上一直开着的提示</div>';
    const [a, b, c] = ['a', 'b', 'c'].map((id) => document.getElementById(id)!);
    tooltip(a, '包年包月：预付费');
    tooltip(c, '按量付费：按秒计费');
    const seen: string[] = [];
    b.addEventListener('mouseover', () => seen.push('over'));
    expect(await hoverTips([a, b, c], dom)).toEqual(['包年包月：预付费', '', '按量付费：按秒计费']);
    expect(seen).toEqual(['over']); // React listens for the bubbling mouseover
    // the tooltips it opened are closed again
    expect(document.querySelectorAll('.next-balloon-tooltip')).toHaveLength(0);
  });
});
