import { addHelp, browserDom, extractPage, type FrameCapture } from './extract';
import { highlight } from './highlight';
import { hoverTips } from './hover';
import { adapterFor } from './vendors';

/** Which field "show me ⟦f3⟧" means: where the capture put it, and its label for when the page has changed since. */
export interface LocateTarget {
  /** the capture the ref belongs to */
  stamp?: number;
  /** its index in this frame's element list at that capture */
  index?: number;
  label: string;
}

/**
 * Injected into every frame of the console tab when the user clicks 捕捉. It
 * only defines a reader; the side panel then calls `__pixelweb.capture()` in
 * the same (isolated) world. The elements behind each field stay here, so a
 * later "show me ⟦f3⟧" can find them without marking up the page.
 */
export interface PixelWebContent {
  /** bumped when this interface changes: a reloaded extension injects into the same world as the old one */
  version: number;
  capture(stamp: number): Promise<FrameCapture>;
  /** outlines the field; false if it isn't on the page (any more) */
  locate(target: LocateTarget): boolean;
  elements: Element[];
  stamp: number;
}

const VERSION = 2;

const g = globalThis as typeof globalThis & { __pixelweb?: PixelWebContent };
if (g.__pixelweb?.version !== VERSION)
  g.__pixelweb = {
    version: VERSION,
    elements: [],
    stamp: 0,
    async capture(stamp) {
      const adapter = adapterFor(location.hostname);
      const { capture, elements, tips } = extractPage(document, browserDom, adapter);
      this.elements = elements;
      this.stamp = stamp;
      if (adapter.hoverHelp && tips.length) {
        const texts = await hoverTips(tips.map((t) => t.icon));
        texts.forEach((t, i) => addHelp(capture.fields[tips[i].field], t));
      }
      return capture;
    },
    locate({ stamp, index, label }) {
      let el = stamp === this.stamp && index !== undefined ? this.elements[index] : undefined;
      if (!el?.isConnected || !browserDom.rendered(el)) {
        // re-rendered, another page, or an older capture: the field with that label, if it is still here
        const { capture, elements } = extractPage(document);
        const i = label ? capture.fields.findIndex((f) => f.label === label) : -1;
        el = i >= 0 ? elements[i] : undefined;
      }
      if (!el) return false;
      highlight(el);
      return true;
    },
  };
