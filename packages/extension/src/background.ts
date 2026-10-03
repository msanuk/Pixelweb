// The toolbar icon opens the side panel; everything else happens there.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((e) => console.error('[pixelweb] side panel', e));
