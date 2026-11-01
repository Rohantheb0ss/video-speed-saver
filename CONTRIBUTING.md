# Contributing

Keep changes focused, preserve or migrate existing storage keys, and avoid runtime
dependencies or external services unless required. Run `npm run check` and
`npm test` with Node.js 22+ before submitting a pull request.

## Manual Chrome Checks

1. Load `youtube-speed-saver` unpacked, reload after edits, and refresh test tabs.
2. Test 1x, 1.5x, 2x, and 0.5x. Seek and verify time left against the formulas.
3. Test direct navigation, in-page navigation, late metadata, and replaced videos.
4. Check multiple visible/hidden players and cross-origin embedded videos.
5. Toggle overlay/persistent mode, drag, reset, then reload to verify preferences.
6. Check narrow players, long durations, scrolling, resize, and container fullscreen.
7. Verify unsupported/live videos clear stale stats and protected pages fail gracefully.
8. Inspect the service-worker and page content-script consoles for errors.

Include reproduction steps, Chrome version, expected behavior, and the manual
checks performed with bug reports or pull requests. Automated tests use mocks.
