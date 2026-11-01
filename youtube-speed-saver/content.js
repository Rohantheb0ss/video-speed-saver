(() => {
  if (window.__videoSpeedSaverLoaded) {
    return;
  }

  window.__videoSpeedSaverLoaded = true;

  const OVERLAY_ID = "video-speed-saver-overlay";
  const OVERLAY_POSITION_PADDING = 8;
  const OVERLAY_VISIBLE_MS = 2500;
  const STORAGE_KEY_OVERLAY_ENABLED = "youtubeSpeedSaverOverlayEnabled";
  const STORAGE_KEY_OVERLAY_PERSISTENT = "youtubeSpeedSaverOverlayPersistent";
  const STORAGE_KEY_OVERLAY_POSITION = "youtubeSpeedSaverOverlayPosition";

  const state = {
    currentVideo: null,
    drag: null,
    fallbackIntervalId: null,
    hideOverlayTimer: null,
    lastPlaybackRate: null,
    lastUrl: window.location.href,
    messageElement: null,
    observer: null,
    overlay: null,
    overlayEnabled: true,
    overlayPersistent: false,
    overlayPosition: null,
    renderTimer: null,
    videoStatsDetected: false
  };

  function isSupportedPage() {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  }

  function isValidPositiveNumber(value) {
    return Number.isFinite(value) && value > 0;
  }

  function getVisibleVideoArea(video) {
    const rect = video.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return 0;
    }

    const style = window.getComputedStyle(video);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return 0;
    }

    const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    return width * height;
  }

  function getVideoScore(video) {
    const isPlaying = !video.paused && !video.ended;
    const hasDuration = isValidPositiveNumber(video.duration);
    const hasProgress = Number.isFinite(video.currentTime) && video.currentTime > 0;

    return (
      (isPlaying ? 1_000_000_000 : 0) +
      (hasDuration ? 100_000_000 : 0) +
      (hasProgress ? 10_000 : 0) +
      getVisibleVideoArea(video)
    );
  }

  function getVideoElement() {
    const videos = Array.from(document.querySelectorAll("video"))
      .filter((video) => getVisibleVideoArea(video) > 0);

    if (videos.length === 0) {
      return null;
    }

    return videos.sort((first, second) => getVideoScore(second) - getVideoScore(first))[0];
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return "0s";
    }

    const isNegative = seconds < 0;
    const totalSeconds = Math.round(Math.abs(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    const pad = (value) => String(value).padStart(2, "0");

    let formatted;
    if (hours > 0) {
      formatted = `${hours}h ${pad(minutes)}m ${pad(remainingSeconds)}s`;
    } else if (minutes > 0) {
      formatted = `${minutes}m ${pad(remainingSeconds)}s`;
    } else {
      formatted = `${remainingSeconds}s`;
    }

    return isNegative && totalSeconds > 0 ? `-${formatted}` : formatted;
  }

  function formatPercent(percent) {
    if (!Number.isFinite(percent) || Math.abs(percent) < 0.05) {
      return "0.0%";
    }

    return `${percent.toFixed(1)}%`;
  }

  function formatOverlayMessage(stats) {
    const actualWatch = formatTime(stats.actualWatchTime);
    const saved = formatTime(stats.savedTime);
    const timeLeft = formatTime(stats.timeLeft);

    return `New length ${actualWatch} \u2022 Saved ${saved} \u2022 Left ${timeLeft}`;
  }

  function getNoVideoStats() {
    return {
      detected: false,
      message: "No video detected."
    };
  }

  function clamp(value, min, max) {
    if (max < min) {
      return (min + max) / 2;
    }

    return Math.min(Math.max(value, min), max);
  }

  function sanitizeOverlayPosition(position) {
    if (
      !position ||
      !Number.isFinite(position.xRatio) ||
      !Number.isFinite(position.yRatio)
    ) {
      return null;
    }

    return {
      xRatio: clamp(position.xRatio, 0, 1),
      yRatio: clamp(position.yRatio, 0, 1)
    };
  }

  function calculateStats() {
    if (!isSupportedPage()) {
      return getNoVideoStats();
    }

    const video = getVideoElement();
    if (!video) {
      return getNoVideoStats();
    }

    const duration = video.duration;
    const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const speed = video.playbackRate;

    if (!isValidPositiveNumber(duration) || !isValidPositiveNumber(speed)) {
      return getNoVideoStats();
    }

    const actualWatchTime = duration / speed;
    const elapsedTime = Math.min(Math.max(currentTime, 0), duration);
    const timeLeft = (duration - elapsedTime) / speed;
    const rawSavedTime = duration - actualWatchTime;
    const savedTime = speed === 1 ? 0 : rawSavedTime;
    const savedPercent = speed === 1 ? 0 : (1 - 1 / speed) * 100;

    return {
      actualWatchTime,
      detected: true,
      duration,
      formatted: {
        actualWatch: formatTime(actualWatchTime),
        original: formatTime(duration),
        saved: formatTime(savedTime),
        savedPercent: formatPercent(savedPercent),
        timeLeft: formatTime(timeLeft)
      },
      savedPercent,
      savedTime,
      speed,
      timeLeft
    };
  }

  function removeDuplicateOverlays() {
    document.querySelectorAll(`#${OVERLAY_ID}`).forEach((overlay) => {
      if (overlay !== state.overlay) {
        overlay.remove();
      }
    });
  }

  function getOverlayHost() {
    const video = getVideoElement();

    const fullscreen = document.fullscreenElement;
    // Native video fullscreen cannot render sibling DOM overlays.
    if (fullscreen === video) {
      return null;
    }
    return fullscreen || document.body;
  }

  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "speed-saver-overlay";
    overlay.setAttribute("role", "status");
    overlay.title = "Drag to move";
    overlay.addEventListener("pointerdown", handleOverlayPointerDown);

    const message = document.createElement("span");
    message.className = "speed-saver-overlay-message";

    overlay.append(message);
    state.messageElement = message;

    return overlay;
  }

  function ensureOverlay() {
    if (!document.body) {
      return null;
    }

    removeDuplicateOverlays();

    if (!state.overlay) {
      state.overlay = createOverlay();
    }

    const host = getOverlayHost();
    if (!host) {
      hideOverlay();
      return null;
    }

    if (state.overlay.parentElement !== host) {
      host.append(state.overlay);
    }

    state.overlay.classList.add("yss-fixed");

    return state.overlay;
  }

  function getOverlayPositionBounds() {
    if (!state.overlay) {
      return null;
    }

    const video = getVideoElement();
    if (!video) {
      return null;
    }
    const rect = video.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    return {
      height: Math.max(0, Math.min(window.innerHeight, rect.bottom) - top),
      left,
      top,
      width: Math.max(0, Math.min(window.innerWidth, rect.right) - left)
    };
  }

  function setOverlayPositionPixels(centerX, top, bounds) {
    if (!state.overlay || !bounds || bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    const overlayWidth = state.overlay.offsetWidth;
    const overlayHeight = state.overlay.offsetHeight;
    const halfWidth = overlayWidth / 2;
    const clampedCenterX = clamp(
      centerX,
      OVERLAY_POSITION_PADDING + halfWidth,
      bounds.width - OVERLAY_POSITION_PADDING - halfWidth
    );
    const clampedTop = clamp(
      top,
      OVERLAY_POSITION_PADDING,
      bounds.height - OVERLAY_POSITION_PADDING - overlayHeight
    );

    state.overlay.style.left = `${bounds.left + clampedCenterX}px`;
    state.overlay.style.top = `${bounds.top + clampedTop}px`;

    return {
      centerX: clampedCenterX,
      top: clampedTop
    };
  }

  function applyStoredOverlayPosition() {
    if (!state.overlay || state.drag) {
      return;
    }

    const bounds = getOverlayPositionBounds();
    if (!bounds) {
      return;
    }

    state.overlay.style.maxWidth = `${Math.max(0, bounds.width - 16)}px`;
    setOverlayPositionPixels(
      state.overlayPosition ? state.overlayPosition.xRatio * bounds.width : bounds.width / 2,
      state.overlayPosition ? state.overlayPosition.yRatio * bounds.height : 16,
      bounds
    );
  }

  function saveOverlayPosition(centerX, top, bounds) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    state.overlayPosition = {
      xRatio: centerX / bounds.width,
      yRatio: top / bounds.height
    };

    chrome.storage.local.set({
      [STORAGE_KEY_OVERLAY_POSITION]: state.overlayPosition
    });
  }

  function scheduleOverlayHide() {
    if (state.overlayPersistent) {
      return;
    }

    if (state.hideOverlayTimer) {
      window.clearTimeout(state.hideOverlayTimer);
    }

    state.hideOverlayTimer = window.setTimeout(() => {
      if (state.overlay) {
        state.overlay.classList.remove("visible");
      }
      state.hideOverlayTimer = null;
    }, OVERLAY_VISIBLE_MS);
  }

  function hideOverlay() {
    if (state.hideOverlayTimer) {
      window.clearTimeout(state.hideOverlayTimer);
      state.hideOverlayTimer = null;
    }

    if (state.overlay) {
      state.overlay.classList.remove("visible");
    }
  }

  function removeOverlay() {
    hideOverlay();

    if (state.overlay) {
      state.overlay.remove();
      state.overlay = null;
      state.messageElement = null;
    }
    state.drag = null;
  }

  function updateOverlayMessage() {
    const stats = calculateStats();
    if (!stats.detected) {
      removeOverlay();
      return null;
    }

    const overlay = ensureOverlay();
    if (!overlay) {
      return null;
    }

    if (state.messageElement) {
      state.messageElement.textContent = formatOverlayMessage(stats);
    }

    applyStoredOverlayPosition();

    return overlay;
  }

  function showOverlayTemporarily() {
    if (!state.overlayEnabled || !isSupportedPage()) {
      removeOverlay();
      return;
    }

    if (state.overlayPersistent) {
      showOverlayPermanently();
      return;
    }

    const overlay = updateOverlayMessage();
    if (!overlay) {
      return;
    }

    overlay.classList.add("visible");
    scheduleOverlayHide();
  }

  function showOverlayPermanently() {
    if (!state.overlayEnabled || !state.overlayPersistent || !isSupportedPage()) {
      removeOverlay();
      return;
    }

    const overlay = updateOverlayMessage();
    if (!overlay) {
      return;
    }

    if (state.hideOverlayTimer) {
      window.clearTimeout(state.hideOverlayTimer);
      state.hideOverlayTimer = null;
    }

    overlay.classList.add("visible", "permanent");
  }

  function handleOverlayPointerDown(event) {
    if (!state.overlay || (event.button !== undefined && event.button !== 0)) {
      return;
    }

    const bounds = getOverlayPositionBounds();
    if (!bounds) {
      return;
    }

    const rect = state.overlay.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();

    if (state.hideOverlayTimer) {
      window.clearTimeout(state.hideOverlayTimer);
      state.hideOverlayTimer = null;
    }

    state.overlay.classList.add("visible", "dragging");

    state.drag = {
      bounds,
      pointerId: event.pointerId,
      startCenterX: rect.left + rect.width / 2 - bounds.left,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTop: rect.top - bounds.top
    };

    try {
      state.overlay.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer capture can fail if the browser cancels the pointer first.
    }
    state.overlay.addEventListener("pointermove", handleOverlayPointerMove);
    state.overlay.addEventListener("pointerup", handleOverlayPointerUp);
    state.overlay.addEventListener("pointercancel", handleOverlayPointerUp);
  }

  function handleOverlayPointerMove(event) {
    if (!state.overlay || !state.drag || event.pointerId !== state.drag.pointerId) {
      return;
    }

    event.preventDefault();

    setOverlayPositionPixels(
      state.drag.startCenterX + event.clientX - state.drag.startClientX,
      state.drag.startTop + event.clientY - state.drag.startClientY,
      state.drag.bounds
    );
  }

  function handleOverlayPointerUp(event) {
    if (!state.overlay || !state.drag || event.pointerId !== state.drag.pointerId) {
      return;
    }

    event.preventDefault();

    const position = setOverlayPositionPixels(
      state.drag.startCenterX + event.clientX - state.drag.startClientX,
      state.drag.startTop + event.clientY - state.drag.startClientY,
      state.drag.bounds
    );

    if (position) {
      saveOverlayPosition(position.centerX, position.top, state.drag.bounds);
    }

    try {
      state.overlay.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // The pointer may already be released after cancellation.
    }
    state.overlay.removeEventListener("pointermove", handleOverlayPointerMove);
    state.overlay.removeEventListener("pointerup", handleOverlayPointerUp);
    state.overlay.removeEventListener("pointercancel", handleOverlayPointerUp);
    state.overlay.classList.remove("dragging");
    state.drag = null;

    if (state.overlayPersistent) {
      state.overlay.classList.add("visible");
    } else {
      scheduleOverlayHide();
    }
  }

  function queueAttachVideo() {
    if (state.renderTimer) {
      return;
    }

    state.renderTimer = window.setTimeout(() => {
      state.renderTimer = null;
      attachVideoListener();
    }, 100);
  }

  function handleRateChange() {
    if (!state.currentVideo) {
      return;
    }

    state.lastPlaybackRate = state.currentVideo.playbackRate;
    showOverlayTemporarily();
  }

  function detectVideoStats() {
    const stats = calculateStats();

    if (!stats.detected) {
      state.videoStatsDetected = false;
      removeOverlay();
      return;
    }

    const isFirstDetection = !state.videoStatsDetected;
    state.videoStatsDetected = true;

    if (state.overlayPersistent) {
      showOverlayPermanently();
    } else if (isFirstDetection) {
      showOverlayTemporarily();
    }
  }

  function attachVideoListener() {
    if (!isSupportedPage()) {
      detachVideoListener();
      removeOverlay();
      return;
    }

    const video = getVideoElement();
    if (video === state.currentVideo) {
      return;
    }

    detachVideoListener();
    removeOverlay();
    state.currentVideo = video;

    if (state.currentVideo) {
      state.lastPlaybackRate = state.currentVideo.playbackRate;
      state.videoStatsDetected = false;
      state.currentVideo.addEventListener("durationchange", detectVideoStats);
      state.currentVideo.addEventListener("loadedmetadata", detectVideoStats);
      state.currentVideo.addEventListener("playing", detectVideoStats);
      state.currentVideo.addEventListener("ratechange", handleRateChange);
      detectVideoStats();
    } else {
      state.lastPlaybackRate = null;
      state.videoStatsDetected = false;
    }
  }

  function detachVideoListener() {
    if (!state.currentVideo) {
      return;
    }

    state.currentVideo.removeEventListener("durationchange", detectVideoStats);
    state.currentVideo.removeEventListener("loadedmetadata", detectVideoStats);
    state.currentVideo.removeEventListener("playing", detectVideoStats);
    state.currentVideo.removeEventListener("ratechange", handleRateChange);
    state.currentVideo = null;
    state.lastPlaybackRate = null;
    state.videoStatsDetected = false;
  }

  function detectPlaybackRateChange() {
    if (window.location.href !== state.lastUrl) {
      handleNavigationChange();
    }
    attachVideoListener();
    reportStats();

    if (!state.currentVideo) {
      return;
    }

    detectVideoStats();
    if (state.overlay && state.overlay.classList.contains("visible") && !state.drag) {
      updateOverlayMessage();
    }

    const playbackRate = state.currentVideo.playbackRate;
    if (!Number.isFinite(playbackRate)) {
      return;
    }

    if (state.lastPlaybackRate === null) {
      state.lastPlaybackRate = playbackRate;
      return;
    }

    if (playbackRate !== state.lastPlaybackRate) {
      state.lastPlaybackRate = playbackRate;
      showOverlayTemporarily();
    }
  }

  function handleNavigationChange() {
    if (window.location.href !== state.lastUrl) {
      state.lastUrl = window.location.href;
      detachVideoListener();
      removeOverlay();
    }

    queueAttachVideo();
  }

  function startObservers() {
    if (!state.observer && document.documentElement) {
      state.observer = new MutationObserver(() => {
        if (
          window.location.href !== state.lastUrl ||
          !state.currentVideo ||
          !document.contains(state.currentVideo)
        ) {
          handleNavigationChange();
        }
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    window.addEventListener("yt-navigate-finish", handleNavigationChange);
    window.addEventListener("yt-page-data-updated", handleNavigationChange);
    window.addEventListener("popstate", handleNavigationChange);
    window.addEventListener("hashchange", handleNavigationChange);
    window.addEventListener("resize", applyStoredOverlayPosition);
    window.addEventListener("scroll", applyStoredOverlayPosition, true);
    document.addEventListener("fullscreenchange", detectPlaybackRateChange);
    document.addEventListener("playing", queueAttachVideo, true);

    if (!state.fallbackIntervalId) {
      state.fallbackIntervalId = window.setInterval(detectPlaybackRateChange, 1000);
    }
  }

  function setOverlayEnabled(enabled) {
    state.overlayEnabled = enabled !== false;

    if (!state.overlayEnabled) {
      removeOverlay();
    } else {
      showOverlayTemporarily();
    }
  }

  function setOverlayPersistent(enabled) {
    state.overlayPersistent = enabled === true;

    if (state.overlayPersistent) {
      showOverlayPermanently();
      return;
    }

    if (state.overlay) {
      state.overlay.classList.remove("permanent");
      hideOverlay();
    }
  }

  function initialize() {
    chrome.storage.local.get({
      [STORAGE_KEY_OVERLAY_ENABLED]: true,
      [STORAGE_KEY_OVERLAY_PERSISTENT]: false,
      [STORAGE_KEY_OVERLAY_POSITION]: null
    }, (result) => {
      state.overlayEnabled = result[STORAGE_KEY_OVERLAY_ENABLED] !== false;
      state.overlayPersistent = result[STORAGE_KEY_OVERLAY_PERSISTENT] === true;
      state.overlayPosition = sanitizeOverlayPosition(result[STORAGE_KEY_OVERLAY_POSITION]);
      startObservers();
      attachVideoListener();
      reportStats();
    });
  }

  function reportStats() {
    const stats = calculateStats();
    const video = getVideoElement();
    const priority = stats.detected && video ? getVideoScore(video) : 0;
    // The service worker selects across frames instead of racing sendResponse callbacks.
    chrome.runtime.sendMessage({ type: "YSS_REPORT_STATS", stats, priority }, () => {
      void chrome.runtime.lastError;
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEY_OVERLAY_ENABLED]) {
      setOverlayEnabled(changes[STORAGE_KEY_OVERLAY_ENABLED].newValue);
    }

    if (changes[STORAGE_KEY_OVERLAY_PERSISTENT]) {
      setOverlayPersistent(changes[STORAGE_KEY_OVERLAY_PERSISTENT].newValue);
    }

    if (changes[STORAGE_KEY_OVERLAY_POSITION]) {
      state.overlayPosition = sanitizeOverlayPosition(changes[STORAGE_KEY_OVERLAY_POSITION].newValue);
      applyStoredOverlayPosition();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
