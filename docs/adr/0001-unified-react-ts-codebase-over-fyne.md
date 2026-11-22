# 0001: Single React and TypeScript Codebase Packaged as PWA, Android APK, and Desktop App

Status: accepted

We need an Android app, a Desktop app, and an immediately testable web preview with modern visual quality for a beginner team and a lecturer who should not need to install native build toolchains. We decided to build a single React and TypeScript codebase reusing Croc v11's native TypeScript cryptographic engine, served immediately as an installable PWA and packaged automatically into an Android APK (Capacitor) and Desktop installers (Electron) via GitHub Actions.

## Considered Options

- **Fork `third-party/crocgui` (Go + Fyne)**: Rejected because Fyne's default visual aesthetic is difficult to modernize for mobile and desktop, requires Go/Android NDK toolchains locally, and cannot run live in the browser preview.
- **Separate Flutter or native Android/Desktop apps**: Rejected because duplicating UI and protocol logic across multiple languages increases maintenance burden for a beginner team and prevents single-command testing.

## Consequences

- Browser-based runs require a WebSocket-to-TCP Bridge Server to talk to public Croc TCP relays (`9009–9017`).
- Desktop builds embed the Bridge Server locally so end users launch a single executable without external configuration.
- Native `.apk` and `.exe`/`.dmg`/`.AppImage` binaries are produced reproducibly in GitHub Actions Releases rather than requiring local Android Studio or Xcode installs.
