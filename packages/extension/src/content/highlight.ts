/**
 * Scrolls a field into view and outlines it for a few seconds. The outline is
 * one fixed-position element in a closed shadow root, so the console's own
 * CSS can't restyle it and it can't catch clicks; it follows scrolling, since
 * consoles often scroll an inner box rather than the window.
 */
const HOST_ID = 'pixelweb-highlight';
const SHOW_MS = 3000;

let stop: (() => void) | null = null;

export function highlight(target: Element): void {
  stop?.();
  // a bare radio or checkbox is often a hidden 16px input: outline what the user sees, its label
  const el = target.matches('input[type="radio"], input[type="checkbox"]') ? (target.closest('label') ?? target) : target;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;width:0;height:0;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>
    .box { position: fixed; border: 2px solid #e8590c; border-radius: 6px; box-shadow: 0 0 0 4px rgba(232, 89, 12, 0.25); animation: pulse 1s ease-in-out 3; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 9px rgba(232, 89, 12, 0.12); } }
  </style><div class="box"></div>`;
  const box = root.querySelector('.box') as HTMLElement;
  const place = () => {
    const r = el.getBoundingClientRect();
    box.style.left = `${r.left - 4}px`;
    box.style.top = `${r.top - 4}px`;
    box.style.width = `${r.width + 8}px`;
    box.style.height = `${r.height + 8}px`;
  };
  place();
  document.documentElement.append(host);

  let frame = 0;
  const onScroll = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };
  document.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
  const timer = setTimeout(() => stop?.(), SHOW_MS);
  stop = () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    document.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll);
    host.remove();
    stop = null;
  };
}
