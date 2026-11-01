# Changelog

## 1.1.1

- Replace iframe response races with recent per-frame service-worker reports.
- Ignore hidden and offscreen videos when selecting a player.
- Position overlays over visible video bounds without modifying player layout.
- Clear stale overlays on invalid metadata, disappearing videos, and player changes.
- Refresh visible timing values with seconds and wrap narrow overlays.
- Load saved preferences before the first overlay render.
- Add regression tests, GitHub Actions, installation and privacy documentation.

## 1.1.0

- Support HTML videos on HTTP/HTTPS sites and frames.
- Rename the extension to Video Speed Saver.

## Earlier Versions

- Add the neutral lightning icon, remaining watch time, persistent/drag settings,
  and improved late-loading video detection.
