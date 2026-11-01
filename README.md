# Video Speed Saver

[![Extension checks](https://github.com/Rohantheb0ss/video-speed-saver/actions/workflows/check.yml/badge.svg)](https://github.com/Rohantheb0ss/video-speed-saver/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<img src="youtube-speed-saver/icons/speed-saver-128.png" width="80" height="80" alt="Video Speed Saver icon">

A lightweight Chrome extension showing adjusted video length, time saved, and
time left at the current playback rate. Supports visible HTML videos on HTTP/HTTPS
websites and embedded frames.

```text
New length 18m 40s | Saved 9m 20s | Left 12m 00s
```

## Install

1. Download this repository as a ZIP and extract it, or clone it with Git.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked**, then select the **youtube-speed-saver** folder inside this repository.
4. Refresh existing video tabs and allow site access where needed.
5. Open a video. Click the extension icon for stats and overlay settings.

No build step, dependency installation, or account is needed. The historical
extension folder name is retained for existing unpacked installations.

This is an unpacked developer installation, not a Chrome Web Store listing.

## Features

- Full-video length at the current rate, estimated savings, and remaining watch time.
- Selects a visible video, favoring a playing one when multiple players exist.
- Rechecks every second and responds to metadata, playback, and navigation events.
- Popup selects the highest-ranked recent video report across frames.
- Toast appears on detection or rate changes; persistent mode keeps it visible.
- Drag the overlay to move it; settings and position are saved locally.

## Calculations

```text
New length = duration / playback rate
Saved      = duration - new length
Time left  = max(0, duration - current position) / playback rate
Saved %    = (1 - 1 / playback rate) * 100
```

For a 28-minute video at 1.5x, new length is 18m 40s and savings are 9m 20s.
At a video position of 10 minutes, time left is 12m. Estimates assume the current
rate; savings describe the full video, not a history of time actually watched.
Slower rates produce negative savings. Pausing freezes the remaining-time estimate.

## Permissions And Privacy

`storage` saves overlay preferences and position. `activeTab` identifies the active
tab for the popup and controls. HTTP/HTTPS host access enables video detection
across supported websites and frames. Restrict site access in Chrome as desired.

No analytics, external requests, accounts, or watch-history storage. Frame timing
reports are held briefly in service-worker memory. See [PRIVACY.md](PRIVACY.md).

## Limitations

- Protected browser pages and the Chrome Web Store do not allow injection.
- Local `file://` videos are outside the supported URL patterns.
- Live streams and videos without finite positive duration cannot produce estimates.
- Shadow-root videos, canvas players, and some custom players are not supported.
- DOM overlays cannot appear over native video fullscreen or Picture-in-Picture; container fullscreen can work.
- Each frame manages its own overlay, so separate frames can each show a toast.
- Hidden/offscreen videos are ignored. Background tabs can be throttled; popup reports may take a second to refresh.
- Site CSS and unusual transformed containers may affect overlay placement.

## Development

Node.js 22+ is needed only for checks. There are no npm dependencies.

```sh
npm run check
npm test
```

Tests use Node's built-in runner with mocked browser APIs. They cover calculations,
late metadata, video switching, visibility, overlay updates, frame arbitration,
and packaged assets. GitHub Actions runs these checks on pushes and pull requests.
They do not replace real Chrome testing; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Layout

```text
youtube-speed-saver/   Load this folder as the extension
  manifest.json       Manifest V3 permissions and entry points
  content.js          Detection, timing, overlay, dragging
  background.js       Recent frame reports and popup selection
  popup.*             Popup stats and settings
  styles.css          Overlay and popup styles
  icons/              PNG icons
tests/                Dependency-free regression tests
.github/workflows/    Automated checks
```

## License

[MIT](LICENSE). Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
