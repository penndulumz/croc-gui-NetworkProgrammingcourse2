# CrocFlow

[English](README.md) | [Tiếng Việt](README_VI.md)

CrocFlow is a cross-platform, end-to-end encrypted file, folder, and text transfer application implemented in TypeScript and React. It provides a wire-compatible implementation of the Croc v11 protocol for interoperability with the official Go `croc` CLI and `getcroc.com`, alongside an Enhanced Mode with Folder Manifests, per-chunk SHA-256 Resume Cache in IndexedDB, and Dual-Relay Transfer with symmetric Failover.

## Transfer Modes

| Capability | Standard Mode (Croc v11) | Enhanced Mode (CrocFlow) |
| :--- | :--- | :--- |
| Peer compatibility | Official `croc` v11 CLI and `getcroc.com` | CrocFlow-to-CrocFlow peers |
| Key exchange | PAKE v2 (SPAKE2 on NIST P-256) + HKDF-SHA-256 | Ephemeral ECDH (NIST P-256) bound with Codephrase via HKDF-SHA-256 |
| Payload encryption | AES-256-GCM (12-byte IV), raw DEFLATE compression | AES-256-GCM (12-byte random IV per message) |
| Integrity verification | XXH64 file digest | Per-chunk SHA-256 and whole-file SHA-256 |
| Folder and resume support | Croc v11 bundle framing | Folder Manifest with path sanitization and IndexedDB Resume Cache |
| Relay routing | Single Relay Node selected by Codephrase | Single or Dual-Relay Transfer (even Chunks on Relay Alpha, odd Chunks on Relay Beta) with Failover |
| Inspection | Protocol Inspector (handshake and transfer progress) | Protocol Inspector (handshake, per-lane Chunk matrix, measured RTT, Failover state) |

## Architecture

```text
+-------------------------------------------------------------------------+
|                CrocFlow Client (React 19 + TypeScript)                  |
|  Standard Mode: src/protocol/croc/*                                     |
|  Enhanced Mode: src/protocol/enhanced/* (Folder Manifest, Resume Cache) |
+--------------------+---------------------------------+------------------+
                     | WebSocket /ws                   | WebSocket /ws-dual
                     v                                 v
+-------------------------------------------------------------------------+
|                    Node.js Bridge Server (server.ts)                    |
|  /ws                  Allowlisted WebSocket-to-TCP bridge (SSRF guard)  |
|  /ws-dual             In-process Local Dual-Relay Lab (Alpha & Beta)    |
|  /api/relays/status   Public relay list and local Alpha/Beta counters   |
|  /api/relays/ping     TCP RTT probe (public) & local probe (alpha/beta) |
|  /api/runtime-config  JSON runtime config for native shells             |
|  /healthz             Plain-text health check                           |
+--------------------+----------------------------------------------------+
                     | Raw TCP (ports 9009-9017)
                     v
+-------------------------------------------------------------------------+
|        Public Croc Relays (1.getcroc.com .. 4.getcroc.com)              |
|        Wire-compatible with official Go croc CLI & getcroc.com          |
+-------------------------------------------------------------------------+
```

Both transfer modes follow the active Relay Profile:

- **Public Croc Relays**: Connects through `/ws` on the Bridge Server to `1.getcroc.com`–`4.getcroc.com` over TCP ports `9009–9017`. In Enhanced Mode, Dual-Relay Transfer pairs deterministic relay indices `(alphaIdx, (alphaIdx + 1) % N)` via `connectRelay` and length-prefixed framing.
- **Local Dual-Relay Lab**: Routes Enhanced Mode over `/ws-dual` into isolated in-memory rooms (`alpha` and `beta`) hosted by `LocalDualRelayNode` (`server/local-dual-relay.ts`) for deterministic Dual-Relay Transfer and Failover testing on restricted or offline LANs.

## Setup, Build, and Test

Prerequisites: Node.js 20 LTS or 22 LTS and npm.

```bash
git clone https://github.com/<org>/croc-gui-networkprogrammingcourse.git
cd croc-gui-networkprogrammingcourse
npm install
npm run dev
```

`npm run dev` runs `tsx server.ts`, listening on `0.0.0.0:3000` with Vite middleware. Open `http://localhost:3000` locally or `http://<lan-ip>:3000` from another device on the same LAN.

Verification and production commands from `package.json`:

```bash
npm run lint   # TypeScript type check (tsc --noEmit)
npm test       # Unit and integration tests (tsx --test "src/**/*.test.ts" "server/**/*.test.ts")
npm run build  # Build static frontend bundle into dist/ (vite build)
npm start      # Run production server (NODE_ENV=production tsx server.ts)
```

## Security and Cryptography

All key derivation, encryption, and decryption execute on the client using Web Crypto (`crypto.subtle`) and `@noble/curves`:

- **Standard Mode cryptography**: Implements SPAKE2 (PAKE v2 over NIST P-256 for peer key agreement; `siec` for relay room authorization), RFC 5869 HKDF-SHA-256 key derivation with bidirectional confirmation tags (`confirmationA`, `confirmationB`), AES-256-GCM with 12-byte IVs, and XXH64 checksums.
- **Enhanced Mode cryptography**: Performs ephemeral ECDH (NIST P-256) combined with the Codephrase through HKDF-SHA-256 (`confirmSender`, `confirmReceiver`), encrypts each Chunk and control message with AES-256-GCM using a 12-byte random IV, and verifies SHA-256 digests per Chunk and per reassembled file.
- **Bridge Server SSRF defense** (`server/bridge-allowlist.ts`): `/ws` resolves targets strictly by configured integer relay index and allowlisted ports (`9009–9017`). Loopback addresses, RFC 1918 private subnets, CGNAT (`100.64.0.0/10`), IPv6 link-local/ULA ranges, and cloud metadata endpoints (`169.254.169.254`) are rejected.
- **Path traversal defense** (`src/protocol/enhanced/manifest.ts`): `sanitizeRelativePath` normalizes directory separators and rejects `..`, absolute paths, Windows drive letters, and ASCII control characters.

## Deployment Targets

| Target | Build / Entry | Notes |
| :--- | :--- | :--- |
| **Web PWA** | `npm run build` | Static bundle built with Vite and `vite-plugin-pwa` (Workbox caching), served by `server.ts`. |
| **Android APK (Capacitor)** | `npx cap sync android` | Wraps static `dist/` in a Capacitor WebView (`androidScheme: "http"`, `cleartext: true` in `capacitor.config.ts`). It does not embed a Bridge Server: run `server.ts` on a PC in the same LAN and enter its URL (for example `http://192.168.1.10:3000`) under **Relays & Network -> Bridge Server Address**. |
| **Desktop (Electron)** | `packaging/desktop/` | Bundles `server.ts` into `server.mjs` (`npm run bundle:server`) together with `dist/`, running an embedded Bridge Server on loopback. Package targets: `dist:win`, `dist:mac`, `dist:linux`. |
| **CI/CD** | `.github/workflows/build-releases.yml` | Runs `npm run lint`, unit/integration tests, `npm run build`, Capacitor Android debug APK assembly, and Electron desktop builds. |

## Documentation

| Document | Description |
| :--- | :--- |
| [Architecture (EN)](docs/ARCHITECTURE_EN.md) / [(VI)](docs/ARCHITECTURE_VI.md) | Module boundaries, data flows, and state machines |
| [Networking Guide (EN)](docs/NETWORKING_GUIDE_EN.md) / [(VI)](docs/NETWORKING_GUIDE_VI.md) | NAT traversal, WebSocket vs. TCP bridging, PAKE, and Failover |
| [Setup and Deployment (EN)](docs/SETUP_AND_DEPLOY_EN.md) / [(VI)](docs/SETUP_AND_DEPLOY_VI.md) | Local development, Android APK setup, and `croc` CLI testing |
| [Live Demo Guide (EN)](docs/DEMO_GUIDE_EN.md) / [(VI)](docs/DEMO_GUIDE_VI.md) | 5-minute evaluation walkthrough and verification scenarios |
| [Dual-Relay Presentation & Study Guide (VI)](docs/DUAL_RELAY_PRESENTATION_VI.md) | Technical deep dive, bug analyses, demo script, and Q&A guide |
| [Lecturer Demo Script (VI)](docs/LECTURER_DEMO_SCRIPT_VI.md) | Structured classroom presentation script |
| [Domain Glossary](GLOSSARY.md) | Canonical EN/VI terminology and concept boundaries |

Architecture Decision Records:

- [ADR 0001: Unified React + TypeScript Codebase over Fyne](docs/adr/0001-unified-react-ts-codebase-over-fyne.md)
- [ADR 0002: Separate Standard Mode from Enhanced Mode](docs/adr/0002-dual-mode-interop-and-enhanced-protocol.md)
- [ADR 0003: Unified Node.js Bridge Server and Local Dual-Relay Lab](docs/adr/0003-embedded-bridge-and-local-dual-relay.md)
- [ADR 0004: Relay-Profile-Aware Dual-Relay Transport and Handshake](docs/adr/0004-enhanced-dual-relay-transport-and-handshake.md)
