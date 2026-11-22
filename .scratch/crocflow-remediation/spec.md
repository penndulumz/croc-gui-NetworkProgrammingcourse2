# Feature Spec: CrocFlow Code Review Hardening & Specification Remediation

Status: ready-for-agent

## Problem Statement

The initial CrocFlow implementation established a cross-platform foundation (PWA, Android Capacitor, and Desktop Electron), byte-for-byte Croc v11 compatibility, and Enhanced Mode transfer capabilities. However, a rigorous two-axis code review against the project's documented standards and specification revealed seven critical operational and architectural gaps:

1. **Relay Profile Operational Disconnect**: In the user interface, selecting the "Local Dual-Relay Lab" profile only sorts table rows in the Relays view; it never propagates to active transfer clients. As a result, transfers cannot actually route through the embedded local Relay Nodes during offline classroom demos or on campus networks that block outbound public TCP relay ports (`9009–9017`).
2. **Latency Ranking Fails to Influence Routing**: The latency ping probe ranks public and local Relay Nodes by round-trip time, but active transfers ignore these metrics. Furthermore, arbitrary relay switching in Standard Mode would break rendezvous with external `croc` CLI and `getcroc.com` users who calculate relay indexes strictly from the Codephrase hash.
3. **Folder Structure Lost Upon Download**: When a receiver accepts a Folder Manifest transfer, files are downloaded as individual flattened files, stripping nested folder hierarchy and failing to provide directory reconstruction or archive bundling.
4. **Missing ETA & Per-File Progress Metrics**: Transfer sessions lack real-time estimated time remaining (ETA), granular per-file progress bars, and active transfer speed indicators in Standard Mode.
5. **Scope Creep in Primary Send Workspace**: Synthetic loopback test runners with hardcoded demo payloads are embedded directly in the main Send view, cluttering the end-user transfer experience instead of residing in the educational study hub.
6. **Missing Frequent Peer Presets**: While personal Device Alias is stored, users cannot save, manage, or quickly target frequent peer presets during transfer setup.
7. **Domain Standards & Code Smell Violations**: Several identifiers, metrics, and documentation headings violate the strict domain vocabulary in `GLOSSARY.md` (e.g., using "hub" for a Relay Node, "gateway" for the Bridge Server, "packet" for Chunks, and "job" for scheduled tasks), accompanied by duplicated bridge connection helpers and untyped Codephrase primitives.

## Solution

Harden CrocFlow by addressing all review findings across standards and specification compliance:

1. **Unified Relay Profile Propagation**: Lift the active Relay Profile into shared state so both Standard Mode and Enhanced Mode transfer sessions dynamically configure their Bridge Server WebSocket endpoints to route through either the Public Croc Relays or the embedded Local Dual-Relay Lab.
2. **Deterministic Latency-Optimized Rendezvous**: In Standard Mode, enable auto-generation of Codephrases whose deterministic hash specifically maps to the lowest-latency public Relay Node, preserving 100% byte-for-byte CLI compatibility while giving users the fastest possible relay. In Enhanced Mode, allow direct targeting of the fastest probed Relay Node.
3. **Folder Tree Reconstruction & Archive Export**: Reconstruct received folders cleanly by generating a client-side `.zip` archive preserving the sanitized relative folder structure, while offering direct folder saving via the browser's File System Access API where supported.
4. **Real-Time Transfer Metrics**: Implement a robust rolling-window speed calculator, dynamic ETA estimator, and per-file progress rendering across all transfer sessions.
5. **Educational Demo Relocation**: Move synthetic loopback and fault-injection demo runners out of the primary Send view and into a dedicated "Lecturer Live Demo & Lab" section inside the App & Docs Hub.
6. **Frequent Peer Presets Management**: Add peer preset management to Transfer History & Identity, allowing users to save friendly Device Aliases and target them with one tap.
7. **Strict Domain Vocabulary & Refactoring**: Normalize all code, types, and documentation to adhere strictly to `GLOSSARY.md` (renaming `LocalDualRelayHub` to `LocalDualRelayNode`, `gatewayURL` to `bridgeURL`, `packetsRelayed` to `chunksRelayed`, and `job` to typed chunk descriptors).

## User Stories

### Relay Management & Campus-LAN Mode

1. As a student in a classroom blocking outbound TCP ports 9009–9017, I want to switch the Relay Profile to "Local Dual-Relay Lab", so that all my Standard and Enhanced Mode transfers route entirely through the embedded local Relay Nodes without failing.
2. As a lecturer grading transfers, I want my active Transfer Session to visibly reflect the currently active Relay Profile, so that I know whether traffic is traversing public relays or the local embedded lab.
3. As a user testing network performance, I want running a latency probe across all Relay Nodes to identify the fastest node and visually display which node was selected for my next session.
4. As a sender auto-generating a Codephrase in Standard Mode, I want CrocFlow to select a Codephrase that deterministically hashes to the lowest-latency public relay, so that external CLI receivers join the fastest relay without breaking Croc v11 rendezvous rules.
5. As an Enhanced Mode user, I want the client to connect directly to the lowest-latency Relay Node discovered during latency probing, so that app-to-app transfers automatically maximize throughput.

### Folder Preservation & Archive Delivery

6. As a receiver downloading a nested folder transfer in Enhanced Mode, I want the app to offer a "Download as ZIP" option that packages all files into a single `.zip` file preserving nested relative directory paths, so that my downloaded folder structure matches the sender's original directory tree.
7. As a desktop or Android Chrome user, I want CrocFlow to prompt me with a directory picker via the File System Access API when available, so that I can save reconstructed files directly into an actual folder on my filesystem without manual extraction.
8. As a security-conscious user receiving a folder, I want any malicious paths containing directory traversal segments (such as `..` or leading slashes) to be sanitized and neutralized before inclusion in the zip archive or filesystem save, so that files cannot write outside the destination directory.
9. As a receiver inspecting completed folder transfers, I want to see a collapsible tree view of the received files with per-file byte sizes and verification badges, so that I can confirm every file was received cleanly.

### Transfer Metrics & Progress Tracking

10. As a user sending or receiving large files, I want to see a live rolling-average transfer speed (in KB/s or MB/s) updated at steady intervals, so that I know my connection is actively progressing.
11. As a user waiting for a transfer, I want to see an estimated time remaining (ETA) formatted in minutes and seconds, so that I can anticipate when the Transfer Session will finish.
12. As a user transferring multiple files in a batch, I want to see both an overall batch progress bar and individual progress indicators for each file, so that I know exactly which file is currently being transmitted.
13. As a user experiencing a slow or stalled transfer, I want the ETA calculation to handle pauses gracefully (displaying "Calculating..." or "Paused" when throughput drops to zero) rather than displaying infinite or erratic numbers.

### Educational Demonstration & Clean User Experience

14. As a regular user opening the Send tab, I want a clean, distraction-free file picking and codephrase generation workspace free of synthetic test buttons, so that the app feels like a polished consumer utility.
15. As a student demonstrating dual-relay failover to my lecturer, I want a dedicated "Lecturer Live Demo & Fault-Tolerance Lab" inside the App & Docs Hub, so that I can trigger synthetic demonstrations with pre-loaded mock files on demand without affecting regular user workflows.
16. As a lecturer evaluating fault tolerance, I want the live demo panel to provide one-click triggers for Dual-Relay Alpha disconnect simulation and incremental folder resume with newly added files, accompanied by live step-by-step explanatory text.

### Peer Presets & Team Identity

17. As a frequent user sharing files with my phone or study partners, I want to save frequent peer presets (with a friendly Device Alias and optional default relay preference) in Transfer History & Identity, so that I do not have to re-type peer details repeatedly.
18. As a user initiating a transfer, I want to pick a saved peer preset from a quick-select dropdown or list, so that I can configure recipient targeting in one click.
19. As a user managing my saved peers, I want to edit, delete, or rename saved peer presets in `localStorage`, so that my peer list stays up to date.

### Architectural Standards & Domain Integrity

20. As a developer maintaining CrocFlow, I want all class names, variables, parameters, and UI labels to strictly follow `GLOSSARY.md`, so that terminology never drifts to forbidden synonyms like "hub", "gateway", "proxy", "packet", or "job".
21. As a developer reviewing network code, I want WebSocket bridge URL derivations unified in a single helper module, so that connection logic is never duplicated across send and receive components.
22. As a developer reviewing cryptography, I want Codephrase values strongly typed with validation helpers, so that raw primitive strings cannot bypass formatting rules.

## Implementation Decisions

### 1. Unified Relay Profile State & Transfer Client Parameterization

- Define a reactive application-level store for `activeRelayProfile` (`"public"` vs `"local-lab"`).
- Pass the active profile configuration directly into both Standard Mode (`CrocClient`) and Enhanced Mode (`EnhancedClient`) instantiation.
- When `"local-lab"` is selected:
  - Standard Mode transfers route through the local embedded Bridge Server configured to relay via the in-process local single relay channel.
  - Enhanced Mode transfers route through `/ws-dual` connecting directly to embedded Relay Alpha and Relay Beta.
- The UI header and active transfer cards will render a badge indicating the active profile (`Public Croc Relays` or `Local Dual-Relay Lab`).

### 2. Latency-Aware Codephrase Rendezvous Algorithm

- In **Standard Mode**, Croc v11 requires sender and receiver to join relay index `relayIndex = hash(codephrase) % 4 + 1`.
- When the user selects "Auto-generate Codephrase" and latency probing data is available:
  - Identify the target relay index corresponding to the lowest-ping public relay (`1.getcroc.com` through `4.getcroc.com`).
  - Generate candidate 3-to-4-word EFF Codephrases in a fast loop until candidate hash satisfies `hash(candidate) % 4 + 1 === targetRelayIndex`.
  - Display the generated Codephrase alongside a label indicating: "Optimized for fastest relay (Relay N, X ms)".
  - This guarantees external `croc` CLI and web users rendezvous on the lowest-latency relay without altering Croc v11 protocol rules.
- In **Enhanced Mode**, the client connects directly to the lowest-latency Relay Node address recorded in the active profile.

### 3. Folder Reconstruction & In-Browser Archive Generation

- Introduce a pure client-side zip creation utility using standard deflate compression.
- When an Enhanced Mode folder transfer completes:
  - Inspect the verified files in memory / Resume Cache.
  - Sanitize relative paths (rejecting `..`, leading slashes, and control characters).
  - Package all files into a downloadable `.zip` archive matching the folder's original directory hierarchy.
  - If the browser supports `window.showDirectoryPicker`, provide a secondary "Save directly to folder" option that writes files into the selected local directory using the File System Access API.

### 4. Real-Time Rolling Transfer Metrics Engine

- Implement a smoothed throughput and ETA calculator module:
  - Maintains a sliding window of transferred byte counts over the last 3 seconds.
  - Computes instantaneous and moving-average speed: `speed = transferredBytesInWindow / windowDurationSeconds`.
  - Computes ETA: `etaSeconds = remainingBytes / smoothedSpeed`.
  - Emits formatted strings: speed (`e.g., 2.4 MB/s`) and ETA (`e.g., 1m 15s`, or `"Calculating..."` if speed < 1 KB/s).
- Standard Mode transfers will wire their byte progress callbacks into this calculator.
- Enhanced Mode chunk transfers will update both overall manifest progress and individual file progress rows.

### 5. Relocation of Demo Runners to App & Docs Hub

- Remove `runLoopbackDualRelayFailoverDemo` and `runLoopbackFolderResumeDemo` buttons from the primary Send view.
- In `AppDocsHubView`, add a dedicated section: **"Phòng Thí Nghiệm & Báo Cáo Giảng Viên (Lecturer Demo Lab)"**.
- Embed the interactive demo triggers, live failure injection controls (sever Relay Alpha), and step-by-step Vietnamese walkthrough explanations in this hub.

### 6. Frequent Peer Presets Data Store

- Extend the identity persistence layer in `localStorage` to include:
  ```ts
  interface PeerPreset {
    id: string;
    alias: string;
    lastSeen: number;
    preferredRelayProfile?: "public" | "local-lab";
  }
  ```
- Provide UI in `HistoryGroupView` to add, edit, and delete peer presets.
- Provide a quick-select peer button on the Send screen that populates the transfer target or prepares a pre-shared group pass key.

### 7. Domain Standards Alignment & Code Smell Remediation

- Rename class `LocalDualRelayHub` to `LocalDualRelayNode` across `server/local-dual-relay.ts` and `server.ts`.
- Rename property `gatewayURL` to `bridgeURL` across `server.ts`, types, `vite-env.d.ts`, and all components.
- Update ADR-0003 title to replace "Proxy" with "Bridge".
- Rename metrics `packetsRelayed` to `chunksRelayed`.
- Replace variable names like `job` with `scheduledChunk` in scheduler and client logic.
- Extract common WebSocket bridge derivation into `deriveBridgeURL()` inside `src/lib/bridge-client.ts`.
- Introduce a branded `Codephrase` type with validation helpers.

## Testing Decisions

### Core Testing Seams

We will verify all changes against **two high-level seams** to maximize coverage and prevent fragile implementation-coupled tests:

1. **Seam 1: Pure Logic & Protocol Seam (`node:test` via `tsx`)**:
   - **Relay Profile Routing**: Unit tests verifying that `deriveBridgeURL(profile)` returns the correct public bridge or local lab URLs.
   - **Latency Codephrase Hashing**: Unit tests verifying that candidate generation produces valid EFF Codephrases whose hash maps to the specified target relay index (1..4) within <5ms.
   - **Folder Archive Packaging**: Unit tests verifying zip archive creation, directory entry creation, relative path sanitization, and rejection of traversal attempts (`../../evil`).
   - **Metrics Calculator**: Unit tests verifying speed smoothing, ETA calculations, handling of zero-throughput pauses, and per-file progress updates.
   - **Peer Presets Store**: Unit tests verifying serialization, schema validation, and retrieval of peer presets.
   - **Domain Naming & Type Safety**: Type-checking tests ensuring `Codephrase`, `bridgeURL`, and `LocalDualRelayNode` are enforced without compiler errors.
2. **Seam 2: Real Transport & Relay Integration Seam (`node:test` against local server)**:
   - Spins up the unified Node server.
   - Connects two clients configured with the `"local-lab"` profile to verify end-to-end transfer across the embedded Local Dual-Relay Node without hitting external networks.
   - Verifies folder manifest verification, chunk transfer, zip export generation, and simulated Relay Alpha failover.

### Prior Art

- Follows the testing patterns established in `server/server.test.ts`, `server/local-dual-relay.test.ts`, and `src/protocol/croc/codephrase.test.ts`.

## Out of Scope

- Modifying the upstream Go `croc` binary or CLI source code.
- Cloud-hosted user accounts, remote databases, or cloud file storage (all transfers remain end-to-end encrypted and peer-to-peer).
- Real-time adaptive dynamic chunk resizing auto-tuned by live packet-loss feedback during an active transfer.
- Forcing filesystem folder writes without browser consent on platforms where the File System Access API is not supported (ZIP archive download is the universal, secure fallback).

## Further Notes

- All user-facing text, error messages, and documentation will remain in natural, beginner-friendly Vietnamese with standard networking terms in parentheses.
- The implementation directly addresses every point raised in the Standards and Spec code reviews.
