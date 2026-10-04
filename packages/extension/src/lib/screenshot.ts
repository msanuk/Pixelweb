/** A screenshot ready to send: a scaled-down JPEG as a data: URL. */
export interface Shot {
  url: string;
  width: number;
  height: number;
}

/** Long edge the model gets: providers scale bigger images down anyway, and every pixel costs tokens. */
const MAX_EDGE = 1600;
const QUALITY = 0.8;

export const NO_SHOT_ACCESS =
  '截图要先临时授权这个标签页：在页面上点右键 →「用 PixelWeb 向导看这一页」重新捕捉（或点一下工具栏上的 PixelWeb 图标），再勾选截图。';

/**
 * The visible part of a tab. Chrome lets an extension capture a tab only after
 * the user invoked it there (activeTab: the right-click menu, the toolbar icon)
 * or with access to every site; the console host permissions aren't enough,
 * and asking for every site just for a screenshot isn't worth it.
 */
export async function screenshotTab(tabId: number): Promise<Shot> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active) throw new Error('要截图的页面不在前台：先切回那个标签页。');
  let png: string;
  try {
    png = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(/activeTab|all_urls|permission/i.test(msg) ? NO_SHOT_ACCESS : `截图失败：${msg}`);
  }
  return shrink(png);
}

/** Scales an image down to MAX_EDGE on its long side and re-encodes it as JPEG. */
export async function shrink(dataUrl: string, maxEdge = MAX_EDGE): Promise<Shot> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return { url, width, height };
}

/** Roughly how much a data: URL uploads, for the preview. */
export function sizeText(dataUrl: string): string {
  const kb = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4 / 1024);
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
