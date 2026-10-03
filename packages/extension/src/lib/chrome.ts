import type { FrameCapture } from '../content/extract';
import type { PixelWebContent } from '../content/index';
import type { ServerConfig } from './api';
import { mergeFrames, type Draft } from './frames';

/** The guide session a browser window is following; kept for the browser session, so reopening the panel resumes it. */
export interface Thread {
  sessionID: string;
  title: string;
}

const SERVER_KEY = 'server';
const threadKey = (windowId: number) => `thread:${windowId}`;

export async function loadServer(): Promise<ServerConfig | null> {
  const v = (await chrome.storage.local.get(SERVER_KEY))[SERVER_KEY] as Partial<ServerConfig> | undefined;
  return v?.origin && v.token ? { origin: v.origin, token: v.token } : null;
}

export const saveServer = (cfg: ServerConfig) => chrome.storage.local.set({ [SERVER_KEY]: cfg });
export const clearServer = () => chrome.storage.local.remove(SERVER_KEY);

export async function loadThread(windowId: number): Promise<Thread | null> {
  const v = (await chrome.storage.session.get(threadKey(windowId)))[threadKey(windowId)] as Thread | undefined;
  return v?.sessionID ? v : null;
}

export function saveThread(windowId: number, t: Thread | null): Promise<void> {
  return t ? chrome.storage.session.set({ [threadKey(windowId)]: t }) : chrome.storage.session.remove(threadKey(windowId));
}

/**
 * The tab a capture reads: the active tab of the panel's window. `?tab=<id>`
 * overrides it, for opening sidepanel.html as an ordinary page while
 * developing or testing (a side panel can't be opened by a script).
 */
export async function targetTab(): Promise<{ id: number; windowId: number }> {
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  if (forced) {
    const t = await chrome.tabs.get(forced);
    return { id: forced, windowId: t.windowId };
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('找不到当前标签页');
  return { id: tab.id, windowId: tab.windowId };
}

export async function panelWindowId(): Promise<number> {
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  if (forced) return (await chrome.tabs.get(forced)).windowId;
  return (await chrome.windows.getCurrent()).id!;
}

/** Shown when Chrome won't let the extension read the page. */
export const NO_ACCESS = '读不了这个页面：插件只能读阿里云、AWS、华为云、Azure、GCP 控制台的页面。';

/** Reads every frame of the tab the extension may read, merged into one masked draft. */
export async function captureTab(tabId: number): Promise<Draft> {
  const target = { tabId, allFrames: true };
  try {
    await chrome.scripting.executeScript({ target, files: ['content.js'] });
  } catch (e) {
    throw new Error(`${NO_ACCESS}（${e instanceof Error ? e.message : e}）`);
  }
  const results = await chrome.scripting.executeScript({
    target,
    func: () => (globalThis as typeof globalThis & { __pixelweb?: PixelWebContent }).__pixelweb?.capture() ?? null,
  });
  return mergeFrames(results.map((r) => ({ frameId: r.frameId, result: r.result as FrameCapture | null })));
}
