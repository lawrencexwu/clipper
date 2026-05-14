// Service worker: opens the side panel on extension icon click and on
// "open-side-panel" messages from the content script. Also acts as a bridge
// for the side panel to fetch the active tab's HTML + URL.

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("Clipper:", err));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "open-side-panel") {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    if (tabId !== undefined && windowId !== undefined) {
      chrome.sidePanel
        .open({ tabId, windowId })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    sendResponse({ ok: false, error: "no tab context" });
    return false;
  }

  if (msg?.type === "fetch-active-tab") {
    fetchActiveTab()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  return false;
});

async function fetchActiveTab(): Promise<{ html: string; url: string; title: string }> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !tab.url) throw new Error("no active tab");
  if (/^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
    throw new Error("cannot clip browser internal pages");
  }
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      html: document.documentElement.outerHTML,
      url: location.href,
      title: document.title,
    }),
  });
  if (!result?.result) throw new Error("script injection returned nothing");
  return result.result as { html: string; url: string; title: string };
}
