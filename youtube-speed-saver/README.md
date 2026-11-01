# Video Speed Saver

See the [project README](../README.md) for full setup, compatibility, development,
and [privacy details](../PRIVACY.md). Load this folder as the unpacked extension.

Video Speed Saver is a Chrome Extension Manifest V3 project that shows how much time you save by watching an HTML video at the current playback speed.

The extension reads the native HTML video element:

```js
const video = document.querySelector("video");
const duration = video.duration;
const speed = video.playbackRate;
```

It displays the new total watch length, saved time, and remaining watch time in a small overlay near the active video. The extension popup also shows the original duration, saved percentage, and related stats when the toolbar icon is clicked. It keeps checking for late-loading and reused video elements so in-page navigation is handled without a full page reload.

## Install

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer Mode**.
3. Click **Load unpacked**.
4. Select this extension folder.
5. Open a page with a standard HTML video and change the video playback speed.

## Formula

The extension uses:

```txt
actual_watch_time = video_duration / playback_speed
time_left = (video_duration - current_video_time) / playback_speed
time_saved = video_duration - actual_watch_time
saved_percent = (1 - 1 / playback_speed) * 100
```

Example at `1.5x` for a `28m 00s` video:

```txt
New length: 18m 40s
Time left: calculated from current video progress
Saved: 9m 20s
Saved %: 33.3%
```

At `1x`, time saved is shown as `0s`.

## Known Limitations

- The extension loads on HTTP and HTTPS pages, including frames, so it can detect embedded videos.
- Browser-internal pages like `chrome://` pages cannot run extension content scripts.
- Live streams and videos with unavailable, `NaN`, or infinite duration are shown as `No video detected.`
- Sites with custom, DRM-only, canvas-based, or closed shadow DOM players may not expose a readable HTML video element.
- Playback speeds below `1x` can produce negative saved time because they increase total watch time.
