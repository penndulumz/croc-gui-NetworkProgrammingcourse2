# CrocFlow Setup, Deployment & Packaging Guide

> **Objective:** Running CrocFlow locally in 2 minutes and understanding automated multi-platform builds (Web PWA, Android APK, and Desktop executables).

---

## 1. Quick Start: Local Development in 2 Minutes

### Prerequisites
- **Node.js**: Version 20 LTS or 22 LTS or newer. Download from: https://nodejs.org
- **Package Manager**: `npm` (included with Node.js) or `pnpm`.

### Step 1: Install Dependencies
Open your terminal inside the project directory:
```bash
npm install
```

### Step 2: Launch the Development Server
```bash
npm run dev
```
- The integrated server starts listening on **http://localhost:3000**.
- This starts the Express backend, WebSocket bridge (`/ws` and `/ws-dual`), and Vite HMR (Hot Module Replacement) simultaneously.
- **Access from Mobile Devices on Local Wi-Fi**:
  Check your computer's local IP address (e.g. `192.168.1.15`), and open `http://192.168.1.15:3000` on your mobile phone!

---

## 2. Running Automated Tests & Code Verification

CrocFlow maintains a comprehensive unit and integration test suite covering protocol wire compatibility, crypto handshakes, SSRF allowlists, dual-relay scheduling, and ZIP packing:

```bash
# 1. Type check without emitting files
npm run lint

# 2. Run all backend and frontend unit tests
npm test
```

### Production Build Verification
To compile the production-optimized client bundle:
```bash
npm run build
```
The compiled output is emitted to `dist/`, fully optimized with code-splitting, tree-shaking, and PWA manifest generation.

---

## 3. Deployment & Packaging Targets

### Method A: Progressive Web App (PWA)
1. Navigate to `http://localhost:3000` (or your deployed domain) in Chrome, Edge, Safari, or Firefox.
2. Click the **"Install App"** button in the top navigation bar (or browser omnibox).
3. The app is installed directly to your OS application menu / mobile home screen with full offline caching via Workbox Service Workers.

---

### Method B: Native Android Package (.apk) via Capacitor
CrocFlow uses **Capacitor** (`capacitor.config.ts`) to package the exact same web codebase into a native Android APK:
1. Ensure the web assets are compiled:
   ```bash
   npm run build
   ```
2. Install the Capacitor packages (they are not default repo dependencies), then create the Android project (`android/` is generated and not committed):
   ```bash
   npm install --no-save @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   ```
3. Install the native Android transport, then sync the web assets:
   ```bash
   node scripts/prepare-android-native.mjs
   npx cap sync android
   ```
4. Open in Android Studio or build via Gradle:
   ```bash
   cd android
   .\gradlew.bat assembleDebug   # Windows PowerShell
   # ./gradlew assembleDebug     # Linux/macOS
   ```
   The generated APK will be located at: `android/app/build/outputs/apk/debug/app-debug.apk`.

#### Android direct connection to public relays
The APK includes a small native Android TCP transport. In the **Public Croc Relays** profile it connects directly to the official Croc relay hosts, so no CrocFlow Bridge Server or user-supplied server address is required. Other Android, desktop, and official `croc` clients rendezvous through those same public relays using the existing Croc protocol.

The GitHub Actions APK workflow runs the preparation script automatically. For a manual build, run it once after `npx cap add android` and before every `npx cap sync android` that regenerates the Android project.

Technical notes:
- The native Android transport is isolated to the Capacitor APK. Web/PWA and Electron Desktop continue to use their existing Bridge Server paths.
- Android direct mode uses the official public relay list and TCP ports `9009–9017`. Networks that block outbound connections to those ports can still prevent transfers; choosing another Internet connection may be necessary.
- **Local Dual-Relay Lab** and custom relay entries still require a Bridge Server and are not available in Android direct mode.
- The existing `server.ts` Bridge Server remains available for web, PWA, Desktop, and older APK builds.
- The Android native bridge restricts socket destinations to the four official Croc relay hosts and ports `9009–9017`.

---

### Method C: Desktop App (Windows .exe / macOS .dmg / Linux .AppImage)
The desktop package lives under `packaging/desktop/` and wraps the application using **Electron**:
1. It automatically launches an embedded local Node.js bridge server on a background loopback port upon startup.
2. To test the desktop app locally:
   ```bash
   npm run build
   cd packaging/desktop
   npm install
   npm start
   ```
3. To package into distributable installers, use `electron-builder`:
   ```bash
   npx electron-builder --win --mac --linux
   ```

---

### Method D: Automated Zero-Setup CI/CD via GitHub Actions
You do not need to install Android Studio or Xcode on your local machine to build installers!
CrocFlow includes a turnkey GitHub Actions workflow (`.github/workflows/build-releases.yml`):

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete overhaul of ui, docs, and i18n"
   git push origin main
   ```
2. Navigate to your repository's **Actions** tab on GitHub.
3. Select the **"Build CrocFlow Releases"** workflow.
4. GitHub's cloud runners will automatically:
   - Run the full test suite and TypeScript checks.
   - Build the Progressive Web App.
   - Generate the Android APK (`CrocFlow-Android-APK`).
   - Generate Desktop installers: Windows `.exe`, macOS `.dmg`, and Linux `.AppImage`.
5. Download the artifacts directly from the workflow run summary!

---

## 4. End-to-End Interoperability Testing with Official `croc` CLI

To verify 100% wire-compatibility against the official Go `croc` implementation:

### 1. Install `croc` CLI
- **Windows**: `winget install schollz.croc` or `scoop install croc`
- **macOS**: `brew install croc`
- **Linux**: `curl https://getcroc.schollz.com | bash`

### 2. Test Flow: CrocFlow Web ➔ `croc` CLI
1. On CrocFlow, navigate to **Send** ➔ **Standard Croc v11**.
2. Select a file or enter secure text, then click **"Start Encrypted Transfer"**.
3. Note the generated codephrase (e.g. `4281-croc-flow-demo`).
4. In your terminal, run:
   ```bash
   croc 4281-croc-flow-demo
   ```
5. Confirm download. Observe the file being received and decrypted cleanly.

### 3. Test Flow: `croc` CLI ➔ CrocFlow Web
1. In your terminal, send a file:
   ```bash
   croc send my-file.txt
   ```
   The terminal will output a codephrase.
2. In CrocFlow, navigate to **Receive** ➔ **Standard Croc v11**.
3. Enter the codephrase and click **"Connect & Receive"**.
4. Confirm the incoming offer to download the decrypted file.
