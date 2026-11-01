const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "../youtube-speed-saver");

class Element {
  constructor() {
    this.children = [];
    this.style = {};
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name)
    };
    this.offsetWidth = 350;
    this.offsetHeight = 36;
    this.rect = { left: 100, top: 100, right: 900, bottom: 550, width: 800, height: 450 };
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name) { this.listeners.delete(name); }
  setAttribute() {}
  append(element) { element.parentElement = this; this.children.push(element); }
  remove() { this.parentElement = null; }
  getBoundingClientRect() { return this.rect; }
}

function contentHarness() {
  const videos = [];
  const reports = [];
  const body = new Element();
  const document = {
    body, documentElement: body, readyState: "loading", fullscreenElement: null,
    querySelectorAll: (selector) => selector === "video" ? videos : [],
    contains: (video) => videos.includes(video),
    createElement: () => new Element(), addEventListener() {}
  };
  const window = {
    location: { href: "https://example.org/watch", protocol: "https:" },
    innerWidth: 1200, innerHeight: 800,
    getComputedStyle: (element) => ({ display: "block", visibility: "visible", opacity: "1", ...element.style }),
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, addEventListener() {}
  };
  const chrome = {
    storage: { local: { get: (defaults, callback) => callback(defaults), set() {}, remove() {} }, onChanged: { addListener() {} } },
    runtime: { onMessage: { addListener() {} }, sendMessage: (message, callback) => { reports.push(message); callback(); } }
  };
  const context = vm.createContext({ window, document, chrome, MutationObserver: class { observe() {} } });
  const source = fs.readFileSync(path.join(root, "content.js"), "utf8");
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, `globalThis.api = { calculateStats, getVideoElement, formatOverlayMessage,
    attachVideoListener, detectPlaybackRateChange, detectVideoStats, applyStoredOverlayPosition,
    setOverlayEnabled, setOverlayPersistent, state }; })();`), context);
  function video(properties = {}) {
    const element = Object.assign(new Element(), { duration: 1680, currentTime: 600, playbackRate: 1.5, paused: false, ended: false }, properties);
    videos.push(element);
    return element;
  }
  return { api: context.api, video, videos, reports, window, document };
}

test("calculates full length, savings and remaining time from current progress", () => {
  const { api, video } = contentHarness();
  const media = video();
  const stats = api.calculateStats();
  assert.equal(stats.actualWatchTime, 1120);
  assert.equal(stats.savedTime, 560);
  assert.equal(stats.timeLeft, 720);
  assert.equal(stats.formatted.actualWatch, "18m 40s");
  assert.equal(api.formatOverlayMessage(stats), "New length 18m 40s \u2022 Saved 9m 20s \u2022 Left 12m 00s");
  media.playbackRate = 0.5;
  assert.equal(api.calculateStats().savedTime, -1680);
  media.currentTime = 9999;
  assert.equal(api.calculateStats().timeLeft, 0);
  media.currentTime = -10;
  assert.equal(api.calculateStats().timeLeft, 3360);
});

test("ignores hidden and offscreen playing videos in favor of a visible paused player", () => {
  const { api, video } = contentHarness();
  video({ style: { display: "none" } });
  video({ rect: { left: 1500, top: 0, right: 1800, bottom: 200, width: 300, height: 200 } });
  const visible = video({ paused: true });
  assert.equal(api.getVideoElement(), visible);
});

test("late metadata is detected and invalid metadata removes stale overlay", () => {
  const { api, video } = contentHarness();
  const media = video({ duration: NaN });
  api.attachVideoListener();
  assert.equal(api.state.overlay, null);
  media.duration = 120;
  media.listeners.get("loadedmetadata")();
  assert.equal(api.state.overlay.classList.contains("visible"), true);
  media.duration = Infinity;
  media.listeners.get("durationchange")();
  assert.equal(api.state.overlay, null);
});

test("switching videos cleans listeners and disappearing videos clear overlay", () => {
  const { api, video, videos } = contentHarness();
  const first = video({ paused: true });
  api.attachVideoListener();
  const second = video();
  api.detectPlaybackRateChange();
  assert.equal(api.state.currentVideo, second);
  assert.equal(first.listeners.size, 0);
  videos.length = 0;
  api.detectPlaybackRateChange();
  assert.equal(api.state.overlay, null);
});

test("persistent overlay refreshes remaining time and follows video position", () => {
  const { api, video, reports } = contentHarness();
  const media = video();
  api.attachVideoListener();
  api.setOverlayPersistent(true);
  media.currentTime = 780;
  api.detectPlaybackRateChange();
  assert.match(api.state.messageElement.textContent, /Left 10m 00s/);
  assert.equal(reports.at(-1).stats.timeLeft, 600);
  assert.equal(api.state.overlay.style.top, "116px");
  api.setOverlayEnabled(false);
  assert.equal(api.state.overlay, null);
  api.setOverlayEnabled(true);
  assert.ok(api.state.overlay);
});

test("frame arbitration prefers playing frames and expires stale reports", () => {
  let receive;
  let removeTab;
  let now = 100;
  const chrome = {
    runtime: { onMessage: { addListener: (callback) => { receive = callback; } } },
    tabs: { onRemoved: { addListener: (callback) => { removeTab = callback; } }, onUpdated: { addListener() {} } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "background.js"), "utf8"), { chrome, Date: { now: () => now } });
  const report = (frameId, priority, detected, label) => receive({ type: "YSS_REPORT_STATS", priority, stats: { detected, label } }, { tab: { id: 1 }, frameId }, () => {});
  const query = () => { let result; receive({ type: "YSS_GET_STATS", tabId: 1 }, {}, (response) => { result = response; }); return result.stats; };
  report(0, 0, false, "top");
  report(2, 100, true, "paused");
  report(3, 1000, true, "playing");
  assert.equal(query().label, "playing");
  now += 5000;
  assert.equal(query().detected, false);
  report(2, 100, true, "new");
  removeTab(1);
  assert.equal(query().detected, false);
});

test("manifest assets exist, icons have correct dimensions, popup IDs match", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json")));
  for (const script of manifest.content_scripts) {
    for (const asset of [...script.js, ...script.css]) assert.ok(fs.existsSync(path.join(root, asset)));
  }
  assert.ok(fs.existsSync(path.join(root, manifest.background.service_worker)));
  for (const [size, file] of Object.entries(manifest.icons)) {
    const png = fs.readFileSync(path.join(root, file));
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
  const html = fs.readFileSync(path.join(root, "popup.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "popup.js"), "utf8");
  for (const [, id] of js.matchAll(/getElementById\("([^"]+)"\)/g)) assert.ok(html.includes(`id="${id}"`), id);
});
