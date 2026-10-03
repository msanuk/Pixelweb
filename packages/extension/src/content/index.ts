import { extractPage, type FrameCapture } from './extract';

/**
 * Injected into every frame of the console tab when the user clicks 捕捉. It
 * only defines a reader; the side panel then calls `__pixelweb.capture()` in
 * the same (isolated) world. The elements behind each field stay here, so a
 * later "show me ⟦f3⟧" can find them without marking up the page.
 */
export interface PixelWebContent {
  capture(): FrameCapture;
  elements: Element[];
}

const g = globalThis as typeof globalThis & { __pixelweb?: PixelWebContent };
g.__pixelweb ??= {
  elements: [],
  capture() {
    const { capture, elements } = extractPage(document);
    this.elements = elements;
    return capture;
  },
};
