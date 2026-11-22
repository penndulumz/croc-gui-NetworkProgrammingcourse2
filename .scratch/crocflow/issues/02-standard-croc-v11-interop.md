# 02: Standard Mode Croc v11 Direct Transfer (CLI & getcroc.com Interop)

**What to build:** Enable complete end-to-end encrypted file and direct text transfers in **Standard Mode** that interoperate byte-for-byte with official `croc` CLI and `getcroc.com`. Users can select single or multiple files (or compose a UTF-8 text message up to 1 MiB), auto-generate a standard EFF Codephrase or enter a custom one, view a scannable QR code and one-click copyable `croc` CLI receive command, and complete real PAKE + HKDF + AES-256-GCM + raw DEFLATE + XXH64 transfers through the allowlisted public Croc Relay Nodes. On the Receive screen, users can enter a Codephrase from `croc` CLI or `getcroc.com`, preview offered files before accepting, track real-time speed/ETA/per-file progress, cancel cleanly, and reject wrong Codephrases before any metadata is exposed.

**Blocked by:** 01: App Foundation, Unified Bridge Server & Responsive Dual-Theme Shell

**Status:** done

- [x] Standard Mode sends and receives files and direct text using Croc v11 native TypeScript cryptography (PAKE, HKDF, AES-256-GCM, raw DEFLATE, XXH64) with zero WebAssembly dependency.
- [x] Sender displays the generated EFF Codephrase, a scannable QR code for direct receive URLs, and a copyable `croc` CLI receive command.
- [x] Receiver previews offered file names and sizes before confirming download, displays live throughput and ETA in tabular numerals, and supports mid-transfer cancellation.
- [x] Wrong Codephrases fail cleanly at PAKE key confirmation without leaking file metadata or crashing the UI.
- [x] Automated unit tests verify EFF Codephrase generation/parsing, SHA-256 relay selection, and cryptographic primitives against Croc v11 compatibility expectations.

## Resolution

Implemented, type-checked (`tsc --noEmit`), bundled (`vite build`), verified with automated unit/integration tests (24/24 passing), and verified in headless Chromium across Desktop Light/Dark and Mobile 390x844 viewports.
