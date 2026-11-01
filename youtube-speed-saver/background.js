const FRAME_TTL_MS = 4000;
const tabFrames = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "YSS_REPORT_STATS" && Number.isInteger(sender.tab?.id)) {
    const frames = tabFrames.get(sender.tab.id) || new Map();
    frames.set(sender.frameId, {
      stats: message.stats,
      priority: Number.isFinite(message.priority) ? message.priority : 0,
      receivedAt: Date.now()
    });
    tabFrames.set(sender.tab.id, frames);
    sendResponse({ ok: true });
  }

  if (message?.type === "YSS_GET_STATS" && !sender.tab) {
    const frames = tabFrames.get(message.tabId);
    let selected = null;
    if (frames) {
      for (const [frameId, report] of frames) {
        if (Date.now() - report.receivedAt > FRAME_TTL_MS) {
          frames.delete(frameId);
        } else if (report.stats?.detected && (!selected || report.priority > selected.priority)) {
          selected = report;
        }
      }
    }
    sendResponse({ stats: selected?.stats || { detected: false, message: "No video detected." } });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => tabFrames.delete(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabFrames.delete(tabId);
  }
});
