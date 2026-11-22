# Wayfinder Map: CrocFlow Cross-Platform App

## Destination

Deliver a production-ready, beginner-documented **CrocFlow** application (Android APK + Desktop Electron + installable PWA from one React/TypeScript codebase) that interoperates seamlessly with `croc` CLI and `getcroc.com`, adds 4 high-value networking extensions (Folder Manifest SHA-256 Resume, Relay Manager + Dual-Relay Failover, Live Protocol Inspector, History & Rotating Group Passphrases), and breaks implementation into independent tracer-bullet tickets so multiple team members and agent sessions can build and verify cleanly.

## Notes

- **Domain docs**: Always consult `GLOSSARY.md` and `docs/adr/` (`ADR-0001` through `ADR-0003`) before starting any ticket.
- **Reference repos**: `third-party/croc` (official Go + TypeScript Croc v11 protocol reference) and `third-party/crocgui` (reference mobile UX to dramatically improve upon). Never modify files inside `third-party/`.
- **Audience constraint**: Primary user is a beginner in programming/deployment; every ticket must prioritize zero-friction setup, clear Vietnamese UI copy, and understandable modular code.
- **Execution tracker**: Implementation spec lives in `.scratch/crocflow/spec.md`; vertical-slice implementation tickets live in `.scratch/crocflow/issues/01-*.md` through `09-*.md`.

## Decisions so far

- **Cross-platform packaging architecture** (`docs/adr/0001-unified-react-ts-codebase-over-fyne.md`): Unified React + TypeScript codebase serving live PWA immediately and packaging Android `.apk` (Capacitor) + Desktop `.exe`/`.dmg`/`.AppImage` (Electron) via GitHub Actions.
- **Ecosystem interoperability vs extended networking features** (`docs/adr/0002-dual-mode-interop-and-enhanced-protocol.md`): Explicit Standard Mode (wire-identical Croc v11) alongside Enhanced Mode (Folder Manifest SHA-256 Resume & Dual-Relay Even/Odd chunking).
- **Network bridge & classroom resilience** (`docs/adr/0003-embedded-bridge-and-local-dual-relay.md`): Unified Node.js Bridge Server with strict allowlist for public Croc relays plus two embedded Local Relay Nodes (Alpha & Beta) for classroom/offline demos.
- **Visual design direction**: LocalSend-inspired crisp modern utility UI supporting both Dark Mode and Light Mode, responsive Desktop sidebar (1440px) + Android thumb-zone bottom bar (390px), using Plus Jakarta Sans + Be Vietnam Pro + JetBrains Mono.
- **Core extension scope**: Selected all 4 extensions — (1) Folder Transfer + SHA-256 Manifest Resume, (2) Relay Manager + RTT Ping + Dual-Relay Failover, (3) Live Protocol Inspector, (4) Transfer History + Device Alias + Monthly Rotating Group Passphrases.

## Not yet specified

- **Android APK signing for public distribution**: GitHub Actions will build an installable debug/sideload APK out of the box for lecturer grading; release keystore signing for Google Play can be configured later if the team decides to publish publicly.
- **Adaptive Chunking automation**: Dynamic chunk-size auto-tuning based on live RTT/packet-loss was intentionally deferred outside the first 9 tickets; Enhanced Mode will expose selectable chunk sizes and can graduate into an adaptive-chunking ticket later if desired.

## Out of scope

- **Cloud file storage / hosted accounts**: CrocFlow does not store user files on a cloud server or require login; all transfers remain peer-to-peer via relays with end-to-end encryption.
- **Browser-hosted SSH server**: Joining or hosting `croc ssh` terminals via Go WASM is out of scope so direct transfers remain 100% native TypeScript without a 6.5 MB WASM payload.
- **Modifying upstream third-party repos**: Files under `third-party/croc` and `third-party/crocgui` are read-only reference material.
