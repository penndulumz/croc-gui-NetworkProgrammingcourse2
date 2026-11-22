# 08: Multi-Platform App Packaging (PWA Install, Android APK & Desktop CI)

**What to build:** Turn the single CrocFlow web codebase into a genuinely installable multi-platform app across Android, Desktop, and Web so neither the student nor the lecturer needs developer tools to install it. Configure full **PWA compliance** (Web App Manifest with `standalone` display, 192px/512px/maskable PNG icons, Apple touch icon, Workbox offline shell caching, offline connectivity indicator, and a prominent in-app **Install App** button with iOS Safari fallback instructions). Add ready-to-build **Capacitor (Android APK)** and **Electron (Desktop app embedding the local Bridge Server)** configurations plus a **GitHub Actions release workflow** that automatically builds and publishes downloadable `.apk`, `.exe`, `.dmg`, and `.AppImage` artifacts on push or version tag.

**Blocked by:** 01: App Foundation, Unified Bridge Server & Responsive Dual-Theme Shell

**Status:** done

- [x] PWA Web App Manifest passes completeness checks (`id`, `name`, `short_name` ≤ 12 chars, `standalone`, `192×192`, `512×512`, padded `maskable` icon, and PNG `apple-touch-icon`).
- [x] Prominent in-app Install App button handles `beforeinstallprompt` on Android/Desktop Chrome & Edge, hides itself in `standalone` mode, and displays a guided modal on iOS Safari.
- [x] Offline connectivity banner appears cleanly when network connectivity drops while cached UI shell, History, and Study Docs remain accessible.
- [x] Capacitor Android configuration, Electron Desktop wrapper (with embedded Bridge Server), and GitHub Actions workflow are complete, syntactically valid, and documented so pushing to GitHub produces downloadable Android APK and Desktop installers automatically.

## Resolution

Implemented, type-checked (`tsc --noEmit`), bundled (`vite build`), verified with automated unit/integration tests (24/24 passing), and verified in headless Chromium across Desktop Light/Dark and Mobile 390x844 viewports.
