# Feature Spec: CrocFlow Cross-Platform Encrypted Transfer Application

Status: ready-for-agent

## Problem Statement

Students taking a Computer Networks course need to "app-ify" the Croc file transfer tool into usable **Android** and **Desktop** applications that stand meaningfully above the existing `getcroc.com` website while remaining fully interoperable with `croc` CLI and `getcroc.com`. Existing reference apps like `crocgui` (Go/Fyne) suffer from outdated, cramped mobile visuals, while `getcroc.com` lacks folder sending, persistent chunk-level resume across disconnects or folder changes, multi-relay diagnostics/dual-relay transfer, transfer history, and live protocol inspection. Furthermore, the student team has minimal programming and deployment experience, so both teammates and the lecturer need a painless way to download, install, run, understand, and grade the software without configuring complex native build toolchains.

## Solution

Build **CrocFlow**, a modern, LocalSend-inspired cross-platform application built from a single React + TypeScript codebase paired with a unified Node.js Bridge Server and embedded Local Dual-Relay Lab. Users immediately get an installable PWA (for Android, Windows, macOS, and Linux) alongside ready-to-run Capacitor (Android APK) and Electron (Desktop installer) configurations backed by automated GitHub Actions release builds. CrocFlow cleanly separates **Standard Mode** (byte-for-byte Croc v11 compatibility with `croc` CLI and `getcroc.com`) from **Enhanced Mode** (Folder Manifest SHA-256 Resume, Dual-Relay Even/Odd Chunking with Automatic Failover, Live Protocol Inspector, Transfer History, Device Alias, and Monthly Rotating Group Passphrases), accompanied by thorough Vietnamese zero-to-hero documentation and a lecturer demo script.

## User Stories

### Core Interoperability (Standard Mode — Croc CLI & `getcroc.com`)

1. As a lecturer acting as a regular user, I want to open CrocFlow on my phone or desktop, select one or more files, and receive a standard 3-to-4-word Codephrase and QR code, so that I can receive those exact files using `croc <codephrase>` in my terminal or on `getcroc.com`.
2. As a desktop CLI user, I want to run `croc send <file>` in my terminal and type the generated Codephrase into CrocFlow on Android or Desktop, so that I can preview the offered files and download them end-to-end encrypted.
3. As a user sending a quick snippet or link between phone and PC, I want to send and receive direct encrypted text messages (up to 1 MiB UTF-8) compatible with `croc send --text`, so that I can copy text securely without writing temporary files.
4. As a recipient, I want to copy a one-line `croc` CLI receive command or scan a QR code from the sender's screen, so that I do not have to type long Codephrases manually on mobile.
5. As a user transferring sensitive files, I want wrong Codephrases to fail during PAKE key confirmation before any file metadata or content is revealed, so that no unauthorized peer or Relay Node can inspect my files.
6. As a user with an active Transfer Session, I want to see real-time total progress, per-file progress, measured transfer speed, and estimated time remaining (ETA), and be able to cancel cleanly at any moment.

### Folder Transfer & SHA-256 Manifest Resume (Enhanced Mode)

7. As a student demonstrating application-layer networking, I want to pick an entire nested folder in Enhanced Mode and generate a Folder Manifest containing every file's sanitized relative path, chunk count, chunk size, and per-chunk SHA-256 digests, so that the receiver can verify every chunk independently.
8. As a receiver downloading a folder whose network drops mid-transfer, I want every verified chunk saved automatically in my local Resume Cache, so that reconnecting resumes from the exact missing chunks without re-downloading completed data.
9. As a lecturer testing incremental resume resilience, I want to interrupt a transfer, add a brand-new file into the sender's folder, and reconnect so that CrocFlow compares the updated Folder Manifest against my Resume Cache, skips already-verified chunks, and transfers only the newly added file and remaining chunks.
10. As a receiver saving a transferred folder, I want relative paths strictly sanitized against path traversal and reconstructed cleanly (via folder save or downloadable archive/files), so that malicious filenames cannot escape the target directory.
11. As a user inspecting cached partial transfers, I want to see how many chunks are stored in my Resume Cache and clear stale partial transfers on demand, so that my device storage stays tidy.

### Relay Manager, Latency Probing & Dual-Relay Failover

12. As a user in a classroom or on home Wi-Fi, I want to inspect all available Relay Nodes (public Croc relays `1..4.getcroc.com`, embedded local Relay Alpha & Relay Beta, and my own custom relay entries) in one view, so that I understand which servers carry my traffic.
13. As a user who wants the fastest connection, I want to trigger a real RTT Ping probe across all Relay Nodes and see measured latency in milliseconds ranked from fastest to slowest, so that CrocFlow automatically selects the healthiest relay.
14. As a student demonstrating Dual-Relay Multi-Path Transfer, I want to send a file or folder simultaneously across Relay Alpha (carrying even-indexed chunks `0, 2, 4...`) and Relay Beta (carrying odd-indexed chunks `1, 3, 5...`), so that the receiver reassembles the complete file verified by SHA-256.
15. As a lecturer stress-testing fault tolerance during a Dual-Relay Transfer, I want a live control to simulate Relay Alpha disconnecting mid-transfer, so that I can watch CrocFlow detect the failure and automatically trigger Failover to route all remaining even chunks through Relay Beta without corrupting the file.
16. As a user running CrocFlow on a restricted campus network that blocks outbound TCP ports `9009–9017`, I want to switch seamlessly to the embedded Local Dual-Relay Lab so two devices or two browser tabs can still perform real encrypted transfers.

### Live Protocol Inspector

17. As a student presenting to my Computer Networks lecturer, I want a Live Protocol Inspector that records real events directly from the active transfer engine (never fabricated logs), so that I can explain every phase of the protocol live.
18. As a learner studying cryptography, I want to see the PAKE handshake milestones step-by-step (room join, curve negotiation, key derivation via HKDF, mutual confirmation, AES-256-GCM activation), so that I can visually point to how end-to-end encryption is established.
19. As a grader verifying Dual-Relay and Resume behavior, I want a live Chunk Allocation Map showing each chunk's state (pending, routed via Relay Alpha, routed via Relay Beta, SHA-256 verified, cached/resumed, or failed-over), so that even/odd routing and failover are immediately visible.
20. As a user monitoring transfer performance, I want a live throughput sparkline and summary counters (bytes sent/received, active relay count, chunks verified, chunks resumed from cache) rendered with tabular numerals, so that numbers stay aligned while updating.

### Transfer History, Device Identity & Group Passphrases

21. As a returning user, I want every completed, resumed, or failed Transfer Session recorded in my local Transfer History with search and direction filters (All / Sent / Received), so that I can audit past transfers offline.
22. As a user sharing across my own devices, I want to set a friendly Device Alias (such as "Minh's Laptop" or "Android Phone") and save frequent peer presets, so that sessions feel personal and organized like LocalSend.
23. As a study group member, I want to create a Group Passphrase bound to a monthly rotation cycle (`YYYY-MM`) that deterministically derives the current month's secure room secret via HKDF-SHA-256, so that my group can keep one memorable team phrase while keys rotate automatically every month.
24. As a user with a saved Group Passphrase, I want a one-tap button to load its current derived Codephrase directly into Send or Receive, so that team transfers take seconds.

### Modern Responsive UI & Cross-Platform App-ification

25. As an Android user dissatisfied with `crocgui`, I want a clean, thumb-friendly mobile layout (bottom navigation bar, ≥44px touch targets, total sticky chrome ≤15% of viewport height) that feels like a native modern app rather than a shrunk desktop page.
26. As a Desktop user on a 1440px monitor, I want a spacious workspace with a 256px left navigation sidebar, a single-row top bar, and a 2-column working canvas (transfer controls alongside QR/Inspector) with zero horizontal overflow.
27. As any user working day or night, I want an instant Light Mode / Dark Mode toggle that persists across reloads and maintains crisp contrast on every surface, card, input, and button.
28. As a lecturer or student with zero developer tools installed, I want an in-app Install App button (PWA) plus clear guidance to download pre-built Android `.apk` and Desktop `.exe`/`.dmg`/`.AppImage` releases generated automatically by GitHub Actions, so that installing CrocFlow takes one click.
29. As a mobile user whose network drops temporarily, I want an offline connectivity indicator and cached PWA shell, so that the app still opens cleanly and lets me inspect history, cached chunks, and study docs offline.

### Learning Documentation & Multi-Agent Team Collaboration

30. As a beginner student preparing for my oral defense, I want comprehensive Vietnamese documentation explaining core networking concepts from zero (NAT, Relay, TCP vs WebSocket, PAKE, AES-GCM, Chunking, SHA-256 Manifest, Resume, Dual-Relay Failover) mapped directly to CrocFlow's modules.
31. As a beginner student who has never built or deployed an app, I want step-by-step non-technical guides for running CrocFlow locally, pushing to GitHub to trigger automated Android/Desktop builds, and giving the lecturer a 5-minute demo script.
32. As a student writing my course report, I want an in-app Study & Download Hub where I can browse the networking glossary/architecture and export a clean Markdown report containing the project overview and real session metrics.
33. As a teammate or future coding agent joining the project in a fresh session, I want clear Wayfinder maps, domain glossary, ADRs, and self-contained vertical-slice tickets so we can work in parallel on unblocked tickets without stepping on each other's work.

## Implementation Decisions

### High-Level Module Boundaries

- **Unified Bridge & Lab Server**: A single Node.js HTTP + WebSocket server running on port 3000 serving the Vite/built frontend, a health check endpoint, a runtime configuration script, an allowlisted WebSocket-to-TCP Bridge Server for public Croc relays, and an embedded Local Dual-Relay Lab hosting two independent relay channels (Relay Alpha and Relay Beta) plus an HTTP latency ping endpoint.
- **Standard Croc v11 Protocol Engine**: Ports the native TypeScript cryptographic and framing modules from the reference `third-party/croc` web implementation (PAKE over `@noble/curves` 2.4.0 for P-256/P-384/P-521/SIEC/Ed25519, `lossless-json` 4.3.3, Web Crypto PBKDF2/HKDF/AES-256-GCM, raw DEFLATE Compression Streams, incremental XXH64, EFF wordlists). Runs without WebAssembly and guarantees byte-level interoperability with `croc` CLI and `getcroc.com`.
- **Enhanced Manifest & Resume Engine**: Pure TypeScript application-layer protocol running over encrypted WebSocket relay rooms. Splits selected files/folders into indexed Chunks, computes per-chunk SHA-256 digests using Web Crypto, validates and sanitizes relative paths, compares incoming Folder Manifests against verified chunks persisted in the IndexedDB Resume Cache, and requests only missing or newly added chunks.
- **Dual-Relay Scheduler & Failover Controller**: Pure TypeScript scheduler assigning even-indexed chunks (`index % 2 === 0`) to Relay Alpha and odd-indexed chunks (`index % 2 === 1`) to Relay Beta concurrently. Monitors channel health; when Relay Alpha disconnects (real drop or user-triggered simulation), immediately marks in-flight Alpha chunks as rerouted and reassigns all remaining chunks to Relay Beta while emitting structured Failover events.
- **Protocol Event Bus & Inspector Store**: Lightweight typed event emitter invoked directly by both Standard Mode and Enhanced Mode engines to publish timestamped milestones (`pake`, `relay`, `manifest`, `chunk`, `resume`, `failover`, `complete`, `error`) without coupling protocol logic to React components.
- **Persistence & Group Security Module**: IndexedDB store for Resume Cache binary chunks; `localStorage` persistence for Transfer History, Device Alias, custom Relay Nodes, theme preference, and Group Passphrases. Group Passphrase derivation uses Web Crypto HKDF-SHA-256 combining the shared secret and the active rotation cycle (`YYYY-MM`) to produce a deterministic room code and key material.
- **Responsive Dual-Form-Factor UI**: React + Tailwind CSS v4 (`@custom-variant dark` configured for class-based Light/Dark switching) implementing a 256px sidebar desktop workspace (1440px baseline) and a 64px thumb-zone bottom-tab mobile interface (390px baseline) with 5 primary destinations: Send, Receive, Relays & Network, History & Group, and App & Docs Hub, plus an expandable Live Protocol Inspector panel.
- **Multi-Platform Packaging Layer**:
  - **PWA**: `vite-plugin-pwa` with compliant Web App Manifest (`standalone`, 192px/512px/maskable PNG icons, Apple touch icon), offline app-shell caching, `usePWAInstall` hook, prominent Install App button, and offline connectivity banner.
  - **Android APK**: Capacitor project configuration pointing at the production web bundle, paired with a GitHub Actions workflow that compiles and uploads a downloadable `.apk` artifact/release.
  - **Desktop App**: Electron main/preload wrapper that embeds the local Bridge Server inside the desktop process, paired with `electron-builder` configuration and GitHub Actions jobs for Windows, macOS, and Linux packages.

### Security & Validation Contracts

- **Bridge Allowlist Enforcement**: The WebSocket-to-TCP bridge accepts only integer relay indices mapped to a server-configured allowlist of relay hosts and allowlisted TCP ports (`9009–9017` by default), rejecting arbitrary hostnames, IP literals, loopback, or private-network targets.
- **Zero-Knowledge Relaying**: All encryption, key exchange, and integrity hashing happen exclusively on client devices; neither the Bridge Server nor the Local Dual-Relay Lab ever inspects plaintext file bytes or stores user passphrases.
- **Path Sanitization**: Every relative path in a Folder Manifest is normalized, stripped of leading slashes/drive letters, and rejected if any segment equals `..` or contains control characters before persisting or saving.
- **Safe Rendering**: All untrusted peer metadata (filenames, folder names, direct text messages, relay banners) is rendered through React's default text escaping with zero raw HTML injection.

## Testing Decisions

### Core Testing Seams (Highest-Value, Minimal Seams)

To keep tests fast, deterministic, and focused strictly on **external observable behavior** rather than internal implementation details, we establish **three clean seams**:

1. **Pure Protocol & Logic Seam (`node:test` via `tsx`)**:
   - **Folder Manifest & Diff Engine**: Given a set of files and an existing Resume Cache snapshot, verifies SHA-256 manifest generation, path-traversal rejection, skip-verified-chunk calculation, and detection of newly added files after disconnect.
   - **Dual-Relay Scheduler & Failover State Machine**: Given N chunks and 2 relay channels, verifies strict even/odd allocation, mid-transfer Relay Alpha failure detection, automatic reassignment of remaining even chunks to Relay Beta, and 100% lossless reassembly.
   - **Group Passphrase Rotation & Codephrase Utils**: Verifies deterministic HKDF-SHA-256 derivation per `YYYY-MM` period, distinct outputs across consecutive months, and EFF codephrase generation/parsing compatibility with Croc v11.
   - **Bridge Allowlist Validator**: Verifies valid public relay index/port acceptance and rejection of disallowed ports, out-of-range indices, or non-allowlisted hosts.
2. **Real Transport & Relay Integration Seam (`node:test` against the live Node server)**:
   - Spins up the unified Node server on an ephemeral port and verifies `/healthz`, `/config.js`, `/api/relays/ping`, `/ws` allowlist rejections (HTTP 403/400), and an actual end-to-end two-client WebSocket transfer across Relay Alpha & Relay Beta including mid-stream Relay Alpha drop + Failover completion.
3. **Real Browser Verification Seam (Playwright CLI on Desktop `1440×900` & Mobile `390×844`)**:
   - Exercises real user journeys: switching Dark/Light theme, sending & receiving via Local Dual-Relay across two tabs/contexts, toggling Relay Alpha disconnect during Dual-Relay to observe Failover & Protocol Inspector chunk grid updates, testing Folder Manifest Resume with a newly added file, searching Transfer History, generating a Monthly Group Passphrase, verifying PWA manifest/install affordance, and checking zero console/network errors and clean responsive reflow at both desktop and mobile viewports.

### Prior Art

- Follows the behavior-driven unit-testing style seen in `third-party/croc/web/src/protocol/*.test.ts` (testing wire compatibility, hash determinism, and failure rejection) while using Node's native `node:test` + `node:assert/strict` executed via `npx --yes tsx --test` for millisecond feedback.

## Out of Scope

- Cloud-hosted persistent file storage or user authentication/accounts (transfers remain ephemeral and end-to-end encrypted).
- Browser-hosted or WASM-based `croc ssh` terminal sharing (omitted to keep the bundle lean and 100% native TypeScript).
- Automatic real-time adaptive chunk-size resizing driven by packet-loss telemetry (kept in Wayfinder Fog of War for future iteration; Enhanced Mode provides manual chunk-size selection for experiments).
- Editing or modifying any upstream files inside `third-party/croc` or `third-party/crocgui`.

## Further Notes

- Every ticket generated from this spec is designed as an independent **tracer-bullet vertical slice** sized for a single agent session or student teammate, with explicit `Blocked by` dependencies so unblocked frontier tickets can be built in parallel.
- All user-facing text in the app and study documentation should be written in clear, natural Vietnamese with standard English networking terms kept in parentheses where helpful for exams and technical interviews.
