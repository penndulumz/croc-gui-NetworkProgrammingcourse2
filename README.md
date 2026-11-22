<div align="center">

# 🐊 CrocFlow

**Modern, Cross-Platform End-to-End Encrypted File Transfer Engine**  
*100% Wire-Compatible with `croc` v11 CLI · Concurrent Dual-Relay Streaming · SHA-256 Chunk Resume*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![TypeScript: 5.8](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React: 19](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Tailwind CSS: v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![PWA: Ready](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://web.dev/progressive-web-apps/)
[![Security: Zero--Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge-green.svg)](#security--cryptography)

[**English Guide**](README.md) · [**Bản Tiếng Việt**](README_VI.md) · [**Live Demo Guide**](docs/DEMO_GUIDE_EN.md) · [**Architecture**](docs/ARCHITECTURE_EN.md) · [**Networking Guide**](docs/NETWORKING_GUIDE_EN.md)

</div>

---

## 📖 Overview

**CrocFlow** is an open-source, multiplatform secure file transfer application designed for computer networking education, research, and daily peer-to-peer productivity. It implements a clean, native **TypeScript** port of the Croc v11 protocol stack that communicates directly with official Croc relay infrastructure and the original Go `croc` CLI tool, while extending the protocol with an **Enhanced Mode** for advanced, high-reliability networking scenarios.

### Why CrocFlow?
- **Unified Single Codebase**: One single React + TypeScript codebase targets **Web PWA**, **Android APK** (via Capacitor), and **Desktop** Windows/macOS/Linux (via Electron).
- **100% Wire Interoperability**: Transmit files or secure text seamlessly between a web browser and a terminal running `croc send` / `croc <codephrase>`.
- **Concurrent Dual-Relay Streaming**: Interleaves even chunks over **Relay Alpha** and odd chunks over **Relay Beta**, doubling bandwidth utilization and demonstrating dynamic multi-path routing.
- **Automated Live Failover**: Automatically reroutes in-flight chunks to the surviving relay without restarting the transfer if one relay disconnects.
- **SHA-256 Folder Manifest & IndexedDB Resume**: Preserves complete directory hierarchies, sanitizes paths against directory traversal (`../`), caches verified chunks in browser IndexedDB, and automatically detects newly added files upon reconnection.
- **Real-Time Protocol Inspector**: Visualizes PAKE/ECDH handshakes, per-chunk relay routing, rolling transfer throughput, and live diagnostic events.
- **Full Bilingual Support (EN & VI)**: Instant in-app language switching between English and Vietnamese with persistent preference.

---

## 🏛 Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CrocFlow UI (React 19 + TypeScript)                  │
│       [Send]   [Receive]   [Relays]   [History/Groups]   [Docs Hub]    │
│            │                              │                            │
│    (Standard Croc v11)           (Enhanced CrocFlow Mode)              │
│    src/protocol/croc/*           src/protocol/enhanced/*               │
│    PAKE v2 · AES-GCM · XXH64     ECDH · SHA-256 · IndexedDB · 2 Relays │
└────────────┬──────────────────────────────┬────────────────────────────┘
             │ WebSocket /ws                │ WebSocket /ws-dual
             ▼                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Unified Node.js Bridge Server (server.ts)                 │
│  • /ws       ➔ Allowlisted TCP bridge (Anti-SSRF) to Croc Relays       │
│  • /ws-dual  ➔ Local Dual-Relay Lab: Relay Alpha (Even) & Beta (Odd)  │
│  • /api/*    ➔ Real RTT latency probes & live byte counters            │
└────────────┬───────────────────────────────────────────────────────────┘
             │ Raw TCP Sockets (9009–9017)
             ▼
     Public Croc Relay Cluster (1.getcroc.com ... 4.getcroc.com)
             ↕ (100% Wire Compatible)
     Official Go croc CLI (Windows/macOS/Linux) & getcroc.com
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: v20 LTS or v22 LTS (Download: [nodejs.org](https://nodejs.org))
- **npm** or **pnpm**

```bash
# 1. Clone repository
git clone https://github.com/your-username/croc-gui-networkprogrammingcourse.git
cd croc-gui-networkprogrammingcourse

# 2. Install dependencies
npm install

# 3. Launch unified development server
npm run dev
```

Visit **http://localhost:3000** in any browser. Mobile devices on the same Wi-Fi can open `http://<your-lan-ip>:3000`.

---

## 🧪 Testing & Verification

CrocFlow maintains a strict automated test suite verifying protocol compliance, cryptographic correctness, SSRF allowlists, and multi-relay failover state machines:

```bash
# Check TypeScript types without emitting files
npm run lint

# Run all unit and integration tests
npm test

# Build production bundle
npm run build
```

---

## 🔐 Security & Cryptography

All encryption and decryption occur strictly on the user's client machine:

1. **PAKE v2 Key Exchange (NIST P-256)**: Ephemeral elliptic curve keys are masked with the secret codephrase hash. Relay nodes cannot inspect the codephrase or decrypt payload streams.
2. **HKDF-SHA-256 Key Derivation**: Derives independent 256-bit symmetric session keys along with bidirectional verification tags (`confirmA`, `confirmB`).
3. **AES-256-GCM Authenticated Encryption**: Every chunk is encrypted with a unique 12-byte random initialization vector (IV). Any tampering in transit immediately triggers GCM authentication failure and terminates the session.
4. **Anti-SSRF Security**: The backend WebSocket bridge enforces strict host allowlists, restricts port ranges (9009–9017), and blocks RFC 1918 private subnets, loopbacks, and cloud metadata IPs (`169.254.169.254`).
5. **Path Traversal Defense**: All relative paths in folder manifests are normalized via `sanitizeRelativePath`, rejecting `..`, absolute paths, Windows drive letters, and control characters.

---

## 📱 Cross-Platform Deployment

| Target | Build Method | Details |
| :--- | :--- | :--- |
| **Web PWA** | `npm run build` | Installable directly in Chrome, Edge, and Safari with offline Workbox caching. |
| **Android APK** | `npx cap sync android` | Capacitor wrapper with native file picker and camera QR scanner. |
| **Desktop App** | `packaging/desktop/` | Standalone Electron package embedding a background loopback Node bridge. |
| **CI/CD** | `.github/workflows/build-releases.yml` | Automated GitHub Actions workflow building Web, APK, and Desktop artifacts. |

---

## 📚 Technical Documentation Index

Detailed bilingual documentation is available under `docs/`:

- [**Live Demonstration & Technical Evaluation Guide (EN)**](docs/DEMO_GUIDE_EN.md) / [**(VI)**](docs/DEMO_GUIDE_VI.md) — 5-minute walkthrough, test commands, and reviewer Q&A.
- [**Codebase Architecture & System Design (EN)**](docs/ARCHITECTURE_EN.md) / [**(VI)**](docs/ARCHITECTURE_VI.md) — Module boundaries, data flow diagrams, and state machines.
- [**Computer Networking Fundamentals (EN)**](docs/NETWORKING_GUIDE_EN.md) / [**(VI)**](docs/NETWORKING_GUIDE_VI.md) — NAT traversal, WebSockets vs. TCP, PAKE cryptography, and failover.
- [**Setup, Deployment & Packaging Guide (EN)**](docs/SETUP_AND_DEPLOY_EN.md) / [**(VI)**](docs/SETUP_AND_DEPLOY_VI.md) — Local development, Android APK build, and CLI testing.
- [**Domain Vocabulary (GLOSSARY.md)**](GLOSSARY.md) — Canonical terminology and concept boundaries.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
