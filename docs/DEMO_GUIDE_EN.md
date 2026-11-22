# CrocFlow Live Demonstration & Technical Evaluation Guide

> **Target Audience:** Technical Reviewers, Evaluators, Systems & Network Engineers, and Developers.  
> **Estimated Demonstration Time:** 5 to 7 minutes.  
> **Scope:** Verification of wire-compatibility with the official `croc` CLI, Concurrent Dual-Relay streaming, automated failover, IndexedDB SHA-256 chunk resume, and zero-knowledge end-to-end encryption.

---

## 1. Executive Summary

**CrocFlow** is a modern, cross-platform file transfer client interoperable with the official `croc` ecosystem (v11 wire protocol) and extended with an application-layer Enhanced Mode for high-reliability network environments. 

This guide provides an objective, step-by-step procedure to demonstrate, benchmark, and evaluate the core architectural capabilities of CrocFlow:
1. **Full Wire Compatibility**: Bidirectional transfer between CrocFlow and the official Go `croc` CLI / `getcroc.com`.
2. **Concurrent Dual-Relay Streaming**: Partitioning chunks concurrently across Relay Alpha (even-indexed chunks) and Relay Beta (odd-indexed chunks) over real WebSockets.
3. **Automated Live Failover**: Fault-tolerant rerouting of in-flight and pending chunks when one relay suffers network loss without restarting the transfer.
4. **Resilient Folder Manifest & Resume Cache**: IndexedDB-backed chunk-level validation using SHA-256 digests, supporting pause/resume and automatic detection of newly added files after reconnection.
5. **Zero-Knowledge Security**: Client-side PAKE / ECDH (P-256) key exchange, HKDF-SHA-256 key derivation, and authenticated AES-256-GCM stream encryption.

---

## 2. Step-by-Step Live Demonstration Walkthrough

### Phase 1: Environment Verification & Standard Croc v11 Interoperability (0:00 – 1:30)

#### Objective
Verify that CrocFlow communicates seamlessly with standard Croc relays and the official Go CLI tool without any custom backend modifications.

#### Steps:
1. **Launch CrocFlow**:
   - Open CrocFlow in any modern web browser (or mobile browser / installed PWA) at `http://localhost:3000`.
   - Observe the responsive interface, theme switcher (Dark/Light mode), and bilingual language toggle (VI / EN).
2. **Select Standard Mode**:
   - On the **Send** screen, select **"Standard Croc v11"**.
   - Attach a test document or enter a secure text payload (e.g., `"Networking Course Interop Verification - Secret Payload 123"`).
   - Click **"Start Encrypted Transfer"**. CrocFlow generates an EFF 3-word codephrase (e.g., `4281-croc-flow-demo`) and an instant QR code.
3. **Terminal Verification (CLI Interoperability)**:
   - In a terminal with `croc` installed, run:
     ```bash
     croc <codephrase>
     ```
   - Observe the official Go CLI negotiate the PAKE handshake, verify the codephrase, and decrypt the exact file/text sent from CrocFlow.
4. **Reverse Verification (CLI to CrocFlow)**:
   - In the terminal, send a file via CLI:
     ```bash
     croc send sample.txt
     ```
   - On CrocFlow, navigate to the **Receive** tab, enter the codephrase, and click **"Connect & Receive"**.
   - Verify that CrocFlow presents the transfer offer, downloads, decrypts, and displays the content with identical cryptographic checksums.

---

### Phase 2: Concurrent Dual-Relay Streaming & Live Failover (1:30 – 3:30)

#### Objective
Demonstrate high-throughput parallel streaming across two isolated relays (Relay Alpha and Relay Beta) and evaluate dynamic fault tolerance when one relay connection is abruptly severed.

#### Steps:
1. **Open the Protocol Inspector**:
   - On desktop, observe the **Protocol Inspector** pinned on the right side of the screen (or expand it on mobile).
2. **Execute Live Dual-Relay Transfer**:
   - Navigate to **Docs & Hub** → **"Interactive Live Demo Runners"** (or use the **Send** screen in **Enhanced Mode** with dual-relay enabled).
   - Click **"Run 2-Relay + Failover Demo"**.
   - CrocFlow establishes two real WebSocket connections:
     - `Relay Alpha` on `/ws-dual?channel=alpha` (handles even chunks: `0, 2, 4, ...`)
     - `Relay Beta` on `/ws-dual?channel=beta` (handles odd chunks: `1, 3, 5, ...`)
3. **Monitor Live Protocol Milestones**:
   - Observe the 5-step cryptographic handshake:
     `Room Initialization` ➔ `ECDH P-256 Exchange` ➔ `HKDF-SHA-256 Derivation` ➔ `Bidirectional Confirmation` ➔ `AES-256-GCM Cipher Stream`.
   - In the **Chunk Matrix**, observe even chunks rendering in teal (**Relay Alpha**) and odd chunks in sky blue (**Relay Beta**).
4. **Simulate Relay Severance (Failure Injection)**:
   - Mid-transfer (~45% completion), click **"Simulate Relay Alpha Outage (Failover)"** (or simulate network drop).
   - Observe the `DualRelayScheduler` detect socket closure and trigger `triggerAlphaFailover()`.
   - **Visual Confirmation**: The remaining even chunks dynamically shift to amber (**Failover**) and are immediately dispatched across **Relay Beta**.
   - **Integrity Check**: The receiver reassembles all chunks in index order and validates the final SHA-256 checksum. Zero data is corrupted or lost.

---

### Phase 3: Folder Manifest SHA-256 & IndexedDB Resume Cache (3:30 – 4:45)

#### Objective
Demonstrate directory preservation, chunk-level caching in browser storage (IndexedDB), and differential resume upon reconnecting after an interruption.

#### Steps:
1. **Trigger the Resume & Delta File Demo**:
   - In **Docs & Hub**, click **"Run IndexedDB Resume Demo"**.
   - Stage 1 transmits the first 6 chunks of a multi-file folder manifest into the browser's `crocflow-resume-db` IndexedDB database before intentionally terminating the connection.
2. **Inspect the Local Resume Cache**:
   - Switch to the **Receive** screen. Notice the **IndexedDB Resume Cache** card showing verified chunks preserved in local storage.
3. **Stage 2 Reconnection & Delta Detection**:
   - The sender adds a new file (`PhuLuc_MoiThemSauMatMang.bin`) to the folder manifest and reconnects.
   - The receiver executes `computeResumePlan()`:
     - Chunks already verified in IndexedDB are marked in purple (**Resumed from Cache**) and bypassed.
     - Only missing chunks and the newly added file are streamed over the wire.
   - Download the reassembled folder or click **"Download Entire Folder as .ZIP"** / **"Save Directly to Directory"** to inspect the complete directory hierarchy.

---

### Phase 4: Network RTT Latency Benchmarking & Group Passphrases (4:45 – 5:45)

#### Objective
Evaluate network telemetry and cryptographic time-scoped key rotation.

#### Steps:
1. **Network Latency Ranking**:
   - Navigate to the **Relays & Network** tab.
   - Click **"Measure Latency (Ping RTT)"**.
   - The application executes real RTT round-trip probes against both local lab nodes and the 4 public Croc relays (`1.getcroc.com` to `4.getcroc.com`).
   - Nodes are automatically sorted by RTT, highlighting the fastest available node.
2. **Monthly Rotating Group Passphrase**:
   - Navigate to **History & Groups**.
   - Under **Monthly Rotating Group Passphrase**, enter a group secret (e.g., `"Team-Network-Lab"`).
   - Click **"Derive Monthly Code"**. CrocFlow computes `HKDF-SHA-256(secret, "YYYY-MM")` to generate a 3-word EFF codephrase valid only for the current month.
   - Click **"Use to Send"** to populate the codephrase into the transfer engine.

---

### Phase 5: Technical Report Generation & Build Verification (5:45 – 6:30)

#### Objective
Validate cross-platform distribution artifacts and generate automated audit reports.

#### Steps:
1. **Export Audit Report**:
   - In **Docs & Hub**, click **"Export Technical Evaluation Report (.md)"**.
   - The app compiles a Markdown report containing timestamps, active device alias, protocol modes, and audit logs.
2. **Review Multiplatform Capabilities**:
   - **PWA**: Instant offline caching via Workbox Service Worker and desktop/mobile install prompt.
   - **Android**: Packaged via Capacitor (`capacitor.config.ts`) targeting standard APKs.
   - **Desktop**: Standalone Electron bundle (`packaging/desktop/`) embedding a local Node bridge server.
   - **CI/CD**: Fully automated in `.github/workflows/build-releases.yml`.

---

## 3. Technical Evaluation Q&A

### Q1: How does CrocFlow guarantee that relay servers cannot inspect or tamper with transferred files?
> **Answer:** All encryption and authentication are strictly client-side. The transfer utilizes ephemeral elliptic curve Diffie-Hellman keys over the NIST P-256 curve combined with the shared secret codephrase via PAKE. Relay nodes (whether public Croc relays or local lab nodes) only receive and forward opaque ciphertext payloads framed with 12-byte random IVs and authenticated with 16-byte AES-GCM tags. If a relay modifies a single bit in transit, GCM tag verification fails immediately at the receiver, terminating the socket and preventing plaintext corruption.

### Q2: What prevents Server-Side Request Forgery (SSRF) through the Bridge Server (`/ws`)?
> **Answer:** Browser WebSocket clients cannot open raw TCP sockets directly due to web sandbox constraints, necessitating the `/ws` bridge endpoint. To prevent SSRF exploitation:
> 1. The bridge does not accept arbitrary destination hostnames. It only accepts an integer `relay` parameter index mapped to an internal server-side allowlist (`CROC_RELAY_HOSTS`).
> 2. Ports are strictly restricted to `9009–9017`.
> 3. Hostnames resolving to private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.1`), link-local, or cloud metadata endpoints (`169.254.169.254`) are rejected with HTTP 400/403. These boundaries are covered by unit tests in `server/bridge-allowlist.test.ts`.

### Q3: How is synchronization maintained during Dual-Relay streaming when Relay Alpha fails?
> **Answer:** The `DualRelayScheduler` (`src/protocol/enhanced/dual-relay-scheduler.ts`) tracks chunk states via an internal state machine: `pending`, `in-flight`, `verified`, and `failover`. When Relay Alpha's WebSocket connection emits an error or close event, `triggerAlphaFailover()` transitions all in-flight chunks that were not yet acknowledged by Relay Alpha back into the dispatch queue assigned to Relay Beta. At the receiver, incoming chunks are keyed by their global sequential chunk index (`globalIndex`). Redundant or duplicate chunks arriving after failover are discarded idempotently without altering the reassembly buffer.

### Q4: How does folder transfer protect against Path Traversal vulnerabilities?
> **Answer:** In Enhanced Mode, folders are described by an application-layer `FolderManifest`. Every relative file path is filtered through `sanitizeRelativePath()` in `src/protocol/enhanced/manifest.ts`. The sanitizer rejects any path segment containing `..`, leading slashes, Windows drive prefixes (`C:`), or control characters, normalizing paths strictly to safe relative POSIX paths before any filesystem or ZIP extraction occurs.

### Q5: Why implement a pure TypeScript Croc v11 protocol stack instead of bundling Go WebAssembly?
> **Answer:** Compiling Go to WebAssembly introduces significant binary overhead (>15 MB WASM download), slow cold-start initialization, and restricted threading inside web workers. Implementing Croc v11 directly in TypeScript leveraging native `crypto.subtle` and `@noble/curves` provides:
> 1. Near-instant startup and bundle sizes under 400 KB gzipped.
> 2. Direct interoperability across Web, Capacitor Android, and Electron without external native binaries.
> 3. High memory efficiency and native stream piping to IndexedDB.
