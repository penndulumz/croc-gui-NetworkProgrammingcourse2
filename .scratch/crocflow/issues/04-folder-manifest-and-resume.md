# 04: Enhanced Mode Folder Transfer & SHA-256 Manifest Resume (IndexedDB)

**What to build:** Implement **Enhanced Mode** folder transfers with application-layer **Folder Manifests** and persistent client-side **Resume Cache** (IndexedDB). Senders can pick an entire nested folder (preserving relative directory structure) and choose chunk size; CrocFlow computes a Folder Manifest with sanitized relative paths and per-chunk SHA-256 digests. Receivers verify every incoming chunk against its SHA-256 digest and persist verified chunks into IndexedDB immediately. If a Transfer Session is interrupted—or even if the sender adds a brand-new file to the folder while disconnected—reconnecting compares the refreshed Folder Manifest against the receiver's Resume Cache, skips all already-verified chunks, downloads only missing and newly added chunks, and lets the user save/download the reconstructed files or inspect/clear cached partial transfers.

**Blocked by:** 02: Standard Mode Croc v11 Direct Transfer (CLI & getcroc.com Interop), 03: Relay Manager, Live RTT Latency Probing & Local Dual-Relay Lab

**Status:** done

- [x] Senders can select an entire folder (or multiple files), inspect the generated Folder Manifest (file tree, chunk count, chunk size, SHA-256 hashes), and start an Enhanced Mode Transfer Session.
- [x] Relative paths inside incoming Folder Manifests are strictly sanitized to block path traversal (`..`, absolute roots, control characters).
- [x] Every received chunk is SHA-256 verified and persisted to IndexedDB Resume Cache before advancing; corrupted chunks are rejected and re-requested.
- [x] Interrupting a transfer, adding a new file on the sender side, and resuming transfers ONLY the missing and newly added chunks while reporting how many chunks were skipped from Resume Cache.
- [x] Unit tests verify Folder Manifest generation, path sanitization rejection, incremental folder diff calculation, and Resume Cache skip accuracy.

## Resolution

Implemented, type-checked (`tsc --noEmit`), bundled (`vite build`), verified with automated unit/integration tests (24/24 passing), and verified in headless Chromium across Desktop Light/Dark and Mobile 390x844 viewports.
