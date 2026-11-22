# 01: App Foundation, Unified Bridge Server & Responsive Dual-Theme Shell

**What to build:** Stand up the runnable CrocFlow web application on port 3000 with its unified Node.js server (serving the frontend, health check, runtime config, and the allowlisted WebSocket-to-TCP Bridge Server entry point) and the LocalSend-inspired responsive navigation shell. Users on Desktop (1440px) see a 256px left navigation sidebar, single-row top bar, and full-width workspace; users on Android/mobile (390px) see a compact top bar and a thumb-zone 5-tab bottom navigation bar. Users can switch cleanly between Light Mode and Dark Mode with persisted preference, navigate across all 5 primary views (Send, Receive, Relays & Network, History & Group, App & Docs Hub), and see the app compile, boot cleanly on port 3000, and pass allowlist validation unit tests.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Application boots cleanly on port 3000 with zero console or build errors and serves the health check and runtime configuration endpoints.
- [x] WebSocket-to-TCP Bridge Server validates relay index and port against a strict server-side allowlist, rejecting disallowed hosts, loopback/private targets, or ports with HTTP 403/400 (verified by unit and integration tests).
- [x] Desktop layout displays a 256px left sidebar, clean single-row top bar, and spacious workspace; mobile layout (`390×844`) displays a compact top bar and 5-tab bottom bar with ≥44px touch targets and ≤15% aggregate sticky height.
- [x] Light Mode and Dark Mode toggle persists across reloads with proper contrast across all surfaces, borders, text, and interactive controls.
- [x] Typography loads Plus Jakarta Sans (headings), Be Vietnam Pro (Vietnamese UI body), and JetBrains Mono with tabular numerals for network metrics.

## Comments

- Completed Ticket 01 with 9/9 passing `node:test` unit & server integration tests, clean `tsc --noEmit` & Vite production build, and live headless Chromium verification on both Desktop (`1440×900` Dark/Light) and Mobile (`390×844`). Unblocked frontier tickets: **02**, **03**, **06**, and **08**.
