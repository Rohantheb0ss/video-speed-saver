# Privacy

Video Speed Saver runs locally in your browser. It reads video duration, current
position, playback rate, and playback/visibility state to display timing estimates.

It does not transmit information to external services, collect analytics, or store
video titles, URLs, browsing history, or a viewing history. It has no accounts,
advertisements, or external network requests.

Preferences and normalized overlay position are stored in `chrome.storage.local`.
Historical keys keep the `youtubeSpeedSaver` prefix to preserve existing settings.

The service worker temporarily holds timing reports by tab/frame ID in memory.
Reports older than four seconds are ignored and pruned when queried. Closing or
loading a tab clears its reports. The extension does not persist these reports.

HTTP/HTTPS access enables video detection, including embedded frames. You can
restrict site access in Chrome's extension settings. Chrome removes stored
extension preferences when you uninstall the extension.
