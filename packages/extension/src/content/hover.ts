import { browserDom, visibleText, type Dom } from './extract';

/** Where tooltip libraries draw: Fusion's next-balloon, Ant Design, Element, and anything marked role="tooltip". */
const POPUP = '[role="tooltip"], [class*="balloon" i], [class*="tooltip" i], [class*="popover" i]';
const MAX_ICONS = 25;
/** how long one tooltip may take to appear (Fusion: about 80 ms) */
const APPEAR_MS = 800;
/** all the hovering of one capture */
const BUDGET_MS = 8000;
const POLL_MS = 30;

const OVER = ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'mousemove'];
const OUT = ['pointerout', 'pointerleave', 'mouseout', 'mouseleave'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The events a real pointer sends, so both React's delegated handlers and native mouseenter listeners see it. */
function fire(el: Element, types: string[]): void {
  const view = el.ownerDocument.defaultView;
  for (const type of types) {
    const init = { bubbles: !/enter|leave/.test(type), cancelable: true, composed: true, view };
    const Pointer = view?.PointerEvent;
    el.dispatchEvent(type.startsWith('pointer') && Pointer ? new Pointer(type, { ...init, pointerType: 'mouse' }) : new MouseEvent(type, init));
  }
}

/** Tooltips on screen now, outermost only, with their text. */
function popups(doc: Document, dom: Dom): Map<Element, string> {
  const shown = Array.from(doc.querySelectorAll(POPUP)).filter((e) => dom.rendered(e));
  const out = new Map<Element, string>();
  for (const e of shown) {
    if (shown.some((o) => o !== e && o.contains(e))) continue;
    const t = visibleText(e, dom);
    if (t) out.set(e, t);
  }
  return out;
}

/**
 * Reads help icons whose text only exists while the mouse is over them. Each
 * icon gets a synthetic hover — no click, nothing changes on the page but the
 * tooltip — the tooltip that appears is read, and the pointer moves off again.
 * One at a time, so each tooltip is told apart from the last one closing.
 * Returns one text per icon, '' where none appeared.
 */
export async function hoverTips(icons: Element[], dom: Dom = browserDom): Promise<string[]> {
  const out: string[] = icons.map(() => '');
  const doc = icons[0]?.ownerDocument;
  if (!doc) return out;
  const opened: Element[] = [];
  const start = Date.now();
  for (const [i, icon] of icons.slice(0, MAX_ICONS).entries()) {
    if (Date.now() - start > BUDGET_MS || !icon.isConnected) continue;
    const before = popups(doc, dom);
    fire(icon, OVER);
    for (const t0 = Date.now(); !out[i] && Date.now() - t0 < APPEAR_MS; ) {
      await sleep(POLL_MS);
      for (const [el, t] of popups(doc, dom)) {
        // new, or an open one whose text changed; never the icon's own wrapper
        if (before.get(el) === t || el.contains(icon)) continue;
        out[i] = t;
        opened.push(el);
        break;
      }
    }
    fire(icon, OUT);
  }
  // leave the page as it was: wait for the last tooltips to close
  for (const t0 = Date.now(); opened.some((e) => e.isConnected && dom.rendered(e)) && Date.now() - t0 < 600; ) await sleep(POLL_MS);
  return out;
}
