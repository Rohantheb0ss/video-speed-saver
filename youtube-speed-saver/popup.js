const MESSAGE_GET_STATS = "YSS_GET_STATS";
const STORAGE_KEY_OVERLAY_ENABLED = "youtubeSpeedSaverOverlayEnabled";
const STORAGE_KEY_OVERLAY_PERSISTENT = "youtubeSpeedSaverOverlayPersistent";
const STORAGE_KEY_OVERLAY_POSITION = "youtubeSpeedSaverOverlayPosition";

const elements = {
  actualWatch: document.getElementById("yss-actual-watch"),
  message: document.getElementById("yss-popup-message"),
  overlayToggle: document.getElementById("yss-overlay-toggle"),
  persistentToggle: document.getElementById("yss-persistent-toggle"),
  original: document.getElementById("yss-original"),
  resetPosition: document.getElementById("yss-reset-position"),
  saved: document.getElementById("yss-saved"),
  savedPercent: document.getElementById("yss-saved-percent"),
  timeLeft: document.getElementById("yss-time-left"),
  timeLeftBadge: document.getElementById("yss-popup-time-left"),
  stats: document.getElementById("yss-popup-stats")
};

function showNoVideo(message = "No video detected.") {
  elements.message.textContent = message;
  elements.message.hidden = false;
  elements.stats.hidden = true;
  elements.timeLeftBadge.textContent = "--";
}

function showStats(stats) {
  if (!stats || !stats.detected) {
    showNoVideo(stats?.message);
    return;
  }

  elements.message.hidden = true;
  elements.stats.hidden = false;

  elements.original.textContent = stats.formatted.original;
  elements.timeLeft.textContent = stats.formatted.timeLeft;
  elements.actualWatch.textContent = stats.formatted.actualWatch;
  elements.saved.textContent = stats.formatted.saved;
  elements.savedPercent.textContent = stats.formatted.savedPercent;
  elements.timeLeftBadge.textContent = stats.formatted.timeLeft;
}

function loadOverlaySettings() {
  chrome.storage.local.get({
    [STORAGE_KEY_OVERLAY_ENABLED]: true,
    [STORAGE_KEY_OVERLAY_PERSISTENT]: false
  }, (result) => {
    elements.overlayToggle.checked = result[STORAGE_KEY_OVERLAY_ENABLED] !== false;
    elements.persistentToggle.checked = result[STORAGE_KEY_OVERLAY_PERSISTENT] === true;
  });
}

function saveOverlaySetting(enabled) {
  chrome.storage.local.set({ [STORAGE_KEY_OVERLAY_ENABLED]: enabled });
}

function savePersistentSetting(persistent) {
  chrome.storage.local.set({ [STORAGE_KEY_OVERLAY_PERSISTENT]: persistent });
}

function resetOverlayPosition() {
  chrome.storage.local.remove(STORAGE_KEY_OVERLAY_POSITION);
}

function requestStatsFromActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];

    if (!activeTab || typeof activeTab.id !== "number") {
      showNoVideo();
      return;
    }

    chrome.runtime.sendMessage({ type: MESSAGE_GET_STATS, tabId: activeTab.id }, (response) => {
      if (chrome.runtime.lastError || !response || !response.stats) {
        showNoVideo();
        return;
      }

      showStats(response.stats);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadOverlaySettings();
  elements.overlayToggle.addEventListener("change", () => {
    saveOverlaySetting(elements.overlayToggle.checked);
  });
  elements.persistentToggle.addEventListener("change", () => {
    savePersistentSetting(elements.persistentToggle.checked);
  });
  elements.resetPosition.addEventListener("click", resetOverlayPosition);

  requestStatsFromActiveTab();
  window.setInterval(requestStatsFromActiveTab, 1000);
});
