import { requestKey, type CaptureRequest } from './lib/chrome';

// The toolbar icon opens the side panel; everything else happens there.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => console.error('[pixelweb] side panel', e));

const PAGE = 'pixelweb-page';
const SELECTION = 'pixelweb-selection';

// The right-click menu works on any site: the click grants temporary access to that tab (activeTab),
// which is how pages outside the known consoles get read.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: PAGE, title: '用 PixelWeb 向导看这一页', contexts: ['page', 'frame', 'editable', 'link', 'image'] });
    chrome.contextMenus.create({ id: SELECTION, title: '用 PixelWeb 向导解释选中的部分', contexts: ['selection'] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id === undefined || tab.windowId === undefined) return;
  // first, and not awaited: Chrome lets an extension open its side panel only while the click's gesture lasts
  chrome.sidePanel.open({ windowId: tab.windowId }).catch((e) => console.error('[pixelweb] open side panel', e));
  const req: CaptureRequest = { tabId: tab.id, selection: info.menuItemId === SELECTION, at: Date.now() };
  void chrome.storage.session.set({ [requestKey(tab.windowId)]: req });
});
