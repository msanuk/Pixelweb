import type { FrameCapture } from '../content/extract';
import type { LocateTarget, PixelWebContent } from '../content/index';
import type { ServerConfig } from './api';
import { mergeFrames, type Draft, type FieldOrigin } from './frames';

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
 * Where the fields of a sent capture were, so a reply's ⟦f3⟧ can be found on
 * the page again. Matched to its prompt by the labels, which the prompt text
 * keeps too; kept for the browser session.
 */
export interface CaptureRecord {
  tabId: number;
  stamp: number;
  origins: Record<string, FieldOrigin>;
  /** ref → label, as sent */
  labels: Record<string, string>;
}

const capturesKey = (sessionID: string) => `captures:${sessionID}`;
const KEEP_CAPTURES = 20;

export async function loadCaptures(sessionID: string): Promise<CaptureRecord[]> {
  const v = (await chrome.storage.session.get(capturesKey(sessionID)))[capturesKey(sessionID)];
  return Array.isArray(v) ? (v as CaptureRecord[]) : [];
}

export async function addCapture(sessionID: string, rec: CaptureRecord): Promise<void> {
  const list = [...(await loadCaptures(sessionID)), rec].slice(-KEEP_CAPTURES);
  await chrome.storage.session.set({ [capturesKey(sessionID)]: list });
}

/** Calls `cb` whenever this session's capture records change; returns the unsubscribe. */
export function watchCaptures(sessionID: string, cb: (list: CaptureRecord[]) => void): () => void {
  const key = capturesKey(sessionID);
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (key in changes) cb((changes[key].newValue as CaptureRecord[] | undefined) ?? []);
  };
  chrome.storage.session.onChanged.addListener(listener);
  return () => chrome.storage.session.onChanged.removeListener(listener);
}

/**
 * The right-click menu asks the side panel of its window to capture a tab
 * (background.ts), through session storage: the panel may be opening just now
 * and not listening yet.
 */
export interface CaptureRequest {
  tabId: number;
  /** "解释选中的部分": start with only the selection ticked */
  selection: boolean;
  at: number;
}

export const requestKey = (windowId: number) => `capture:${windowId}`;
const REQUEST_TTL = 60_000;

/** The pending request for this window, removed as it is taken; stale ones are dropped. */
export async function takeCaptureRequest(windowId: number): Promise<CaptureRequest | null> {
  const key = requestKey(windowId);
  const v = (await chrome.storage.session.get(key))[key] as CaptureRequest | undefined;
  if (!v) return null;
  await chrome.storage.session.remove(key);
  return Date.now() - v.at < REQUEST_TTL ? v : null;
}

export function watchCaptureRequests(windowId: number, cb: () => void): () => void {
  const key = requestKey(windowId);
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes[key]?.newValue) cb();
  };
  chrome.storage.session.onChanged.addListener(listener);
  return () => chrome.storage.session.onChanged.removeListener(listener);
}

const forcedTab = () => Number(new URLSearchParams(location.search).get('tab'));

/**
 * The tab a capture reads: the active tab of the panel's window. `?tab=<id>`
 * overrides it, for opening sidepanel.html as an ordinary page while
 * developing or testing (a side panel can't be opened by a script).
 */
export async function targetTab(): Promise<{ id: number; windowId: number }> {
  const forced = forcedTab();
  if (forced) {
    const t = await chrome.tabs.get(forced);
    return { id: forced, windowId: t.windowId };
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('找不到当前标签页');
  return { id: tab.id, windowId: tab.windowId };
}

export async function panelWindowId(): Promise<number> {
  const forced = forcedTab();
  if (forced) return (await chrome.tabs.get(forced)).windowId;
  return (await chrome.windows.getCurrent()).id!;
}

/** Shown when Chrome won't let the extension read the page. */
export const NO_ACCESS =
  '读不了这个页面：插件默认只读阿里云、AWS、华为云、Azure、GCP 的控制台。别的网站请在页面上点右键 →「用 PixelWeb 向导看这一页」，临时允许读这一页。';

type Content = typeof globalThis & { __pixelweb?: PixelWebContent };

/**
 * Injects the page reader into every frame of the tab the extension may read.
 * With only the right-click's temporary access (activeTab), frames from other
 * sites are off limits, so then it is the top frame alone.
 */
async function inject(tabId: number, frameIds?: number[]): Promise<chrome.scripting.InjectionTarget> {
  const targets: chrome.scripting.InjectionTarget[] = frameIds ? [{ tabId, frameIds }] : [{ tabId, allFrames: true }, { tabId, frameIds: [0] }];
  let last: unknown;
  for (const target of targets) {
    try {
      await chrome.scripting.executeScript({ target, files: ['content.js'] });
      return target;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Reads every frame of the tab the extension may read, merged into one masked draft. */
export async function captureTab(tabId: number): Promise<Draft> {
  let target: chrome.scripting.InjectionTarget;
  try {
    target = await inject(tabId);
  } catch (e) {
    throw new Error(`${NO_ACCESS}（${e instanceof Error ? e.message : e}）`);
  }
  const stamp = Date.now();
  const results = await chrome.scripting.executeScript({
    target,
    func: (s: number) => (globalThis as Content).__pixelweb?.capture(s) ?? null,
    args: [stamp],
  });
  return mergeFrames(
    results.map((r) => ({ frameId: r.frameId, result: r.result as FrameCapture | null })),
    stamp,
  );
}

/**
 * Outlines a reply's field on the page. Tries the frame and element the
 * capture recorded; failing that (the page reloaded or moved on, or this is an
 * older capture), any frame with a field of that label. False if none has it.
 */
export async function locateField(tabId: number, target: LocateTarget, frameId?: number): Promise<boolean> {
  const run = async (frames: number[] | undefined, t: LocateTarget) => {
    const where = await inject(tabId, frames);
    const results = await chrome.scripting.executeScript({
      target: where,
      func: (x: LocateTarget) => (globalThis as Content).__pixelweb?.locate(x) ?? false,
      args: [t],
    });
    return results.some((r) => r.result === true);
  };
  if (frameId !== undefined) {
    try {
      if (await run([frameId], target)) return true;
    } catch {
      /* that frame is gone: look everywhere */
    }
  }
  return run(undefined, { label: target.label });
}
