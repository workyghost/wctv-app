# WCTV IPTV Player & Self-Healing Stream Engine

WCTV is a premium, high-performance IPTV web client built with React and Vite. It features Sanal Master Playlist integration, multi-quality Adaptive Bitrate (ABR) control, Latency/Buffer tuning, and an advanced **Self-Healing & Ping Monitoring System** designed to prevent live stream interruptions during high-traffic events (e.g., live football matches).

---

## 🚀 Key Features

1. **Self-Healing Stream Engine**: Detects freeze/stall events and automatically recovers the player within 10-12 seconds by generating a fresh session ID (`sid`) and rebuilds the Hls instance.
2. **Periyodik Bağlantı Kontrolü (Self-Ping)**: Background worker pings the remote manifest every 8 seconds to measure network latency. If a ping failure coincides with a minor buffer stall (>= 5s), it fast-tracks the auto-healing sequence.
3. **Adaptive Bitrate (ABR) Virtual Playlist**: Generates virtual master playlists on the fly for TRT channels, exposing multiple streams (2K, 1080p, 720p, 480p, 360p) for dynamic stream quality switching.
4. **Latency Modes**: Low Latency (5s buffer), Balanced (15s buffer - Recommended), and Super Stable (30s buffer) playback modes.
5. **Autoplay Ready**: Fully configured to autoplay instantly upon loading in any modern browser by utilising standard muted autoplay fallback guidelines.

---

## 🛠️ System Architecture & Codebase Details

For future developers or AI assistants, here is the architectural flow of the system located in `src/App.jsx` and `src/index.css`.

### 1. The React State & Refs Architecture
The state variables governing the self-checking system are:
- `autoHealingEnabled` (boolean): Master switch to toggle automatic player recovery.
- `pingLatency` (number | null): Current request-response duration of the stream ping.
- `pingStatus` (string: `'healthy' | 'checking' | 'error' | 'disabled'`): Current connection health.
- `reloadCount` (number): Tracks number of times the player has successfully self-recovered.
- `reloadTrigger` (number): A dependency trigger state. Incrementing this triggers the primary player effect to tear down the current Hls instance and spin up a fresh one with a brand-new session ID (`sid`).

Refs used for tracking metrics without triggering re-renders:
- `lastTimeRef.current`: The last recorded value of `video.currentTime`.
- `stallCountRef.current`: An accumulator tracking consecutive seconds where the stream was supposed to be playing but the time did not progress.
- `autoHealingEnabledRef.current`: Kept in sync with `autoHealingEnabled` to avoid stale closures in the interval without forcing player rebuilds when toggling settings.

### 2. Auto-Healing & Stall Detection Loop
Inside the primary player `useEffect`, we register a unified interval running every **1,000ms**:

```javascript
// 1. Stall Check (Every 1s)
if (video.readyState >= 2 && !video.paused && !video.ended) {
  if (video.currentTime === lastTimeRef.current) {
    stallCountRef.current += 1;
    if (autoHealingEnabledRef.current && stallCountRef.current >= 12) {
      // Stream is frozen for 12 seconds - trigger reload
      setReloadCount(r => r + 1);
      setReloadTrigger(t => t + 1);
      stallCountRef.current = 0;
    }
  } else {
    lastTimeRef.current = video.currentTime;
    stallCountRef.current = 0;
  }
}
```

### 3. Self-Ping Connection Check
To check the connection health without disrupting video transmission:
- Every 8 ticks (8 seconds), we perform a lightweight `fetch` request targeting the active stream url or the remote proxy manifest.
- We utilize an `AbortController` to timeout the ping check after 4 seconds.
- We utilize `mode: 'no-cors'` to avoid CORS restriction blockages on custom IPTV links. The browser handles the request, and we measure the round-trip latency to update the UI badges.
- If a ping request fails (indicating connection loss) AND `stallCountRef.current` is >= 5 seconds, the system fast-tracks the reload trigger instead of waiting the full 12 seconds.

---

## 🌐 Autoplay Guidelines & Policies
Modern browsers block autoplaying video elements that contain audio. To guarantee **zero-interaction automatic playback**:
1. The `<video>` tag is marked with both `autoPlay` and `muted`.
2. Hls.js loads the source and plays immediately.
3. Users can unmute the stream at any time using the native player controls.

---

## 🎨 UI/UX Elements (CSS)
All styling tokens reside in [index.css](file:///c:/Users/murat/Desktop/wctv/src/index.css). Look for `/* Self-Healing & Ping Monitor Styles */` at the end of the file.
- **`.header-ping-badge`**: Displays green/amber/red indicators directly on the top application header depending on latency status.
- **`.ping-indicator-dot`**: A pulsing CSS indicator inside the diagnostics card.
- **`.action-btn-reconnect`**: Instant manual refresh trigger button which rotates 180 degrees on hover.
