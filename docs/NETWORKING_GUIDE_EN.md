# Computer Networking Fundamentals for Secure File Transfer

> Comprehensive technical guide covering network transport, cryptographic handshakes, and distributed transfer mechanisms in **CrocFlow**.

---

## 1. The Core Networking Problem: Why Can't Two Computers Simply Connect Directly?

### Private Subnets and Network Address Translation (NAT)
When your laptop or mobile phone connects to Wi-Fi at home, university, or the office:
- Your local router assigns your device a **Private IP Address** (e.g., `192.168.1.15` or `10.0.4.88`), defined under RFC 1918.
- These private IP addresses are **non-routable** on the public Internet.
- The entire Wi-Fi network shares a single **Public IP Address** (e.g., `203.0.113.42`) assigned by your ISP.
- When you request a webpage, your router executes **Network Address Translation (NAT)**: it records which internal device opened which outgoing TCP port, rewrites the packet headers, and routes responses back to your internal device.

```
[ Sender Laptop ] (Private IP: 192.168.1.15)
        │ Outbound Connection
        ▼
   [ Router NAT / Firewall ] (Public IP: 203.0.113.42)
        │
   ═══════════════════════════════════════════ (Public Internet)
        │
   [ Router NAT / Firewall ] (Public IP: 198.51.100.99)
        ▲
        │ Inbound Traffic Blocked! (Firewall Drops Unsolicited Syn Packets)
[ Receiver Laptop ] (Private IP: 192.168.0.22)
```

### The Inbound Connection Dilemma
If a sender in Hanoi wants to send a file to a receiver in Ho Chi Minh City:
1. The sender cannot open a direct TCP connection to `192.168.0.22` because that IP only exists within the receiver's private local network.
2. The sender cannot connect to the receiver's public router IP (`198.51.100.99`) either, because the receiver's firewall will immediately drop any unsolicited incoming TCP SYN packet for security.

### How Croc & CrocFlow Solve NAT Traversal: The Rendezvous Relay Model
Rather than requiring complex port forwarding or brittle UPnP/STUN hole-punching:
1. Both the **Sender** and the **Receiver** make an **outbound** TCP/WebSocket connection to a known, publicly accessible **Relay Node**.
2. Outbound connections are almost universally permitted by firewalls and NAT routers.
3. Both peers join the same virtual **Room** derived deterministically from their shared secret (`Codephrase`).
4. The Relay Node acts as an opaque binary pipe, splicing the two streams together.

---

## 2. Browser Sandbox Constraints: WebSockets vs. Raw TCP

### Why Can't JavaScript Open Raw TCP Sockets?
Web browsers operate under strict security sandboxes:
- A malicious webpage with raw TCP capabilities could scan internal enterprise networks, exploit unauthenticated internal printers, or launch DDoS attacks.
- Therefore, JavaScript running inside the browser can only initiate **HTTP/HTTPS** requests and **WebSockets (`ws://` / `wss://`)**.
- The official Go `croc` relay listens on **Raw TCP sockets** on ports `9009–9013`.

### The CrocFlow Bridge Server (`/ws`)
To enable full interoperability between a modern web browser and the raw TCP Croc relay ecosystem, CrocFlow includes a lightweight **Bridge Server** (`server.ts`):
1. The browser initiates a WebSocket connection to the bridge:
   `ws://localhost:3000/ws?relay=0&port=9009`
2. **SSRF Defense (`server/bridge-allowlist.ts`)**:
   - The bridge strictly checks the destination. It will never connect to arbitrary IP addresses.
   - It only maps integer indices (`relay=0..3`) to an internal list of approved public relays (`CROC_RELAY_HOSTS`).
   - It rigorously filters out all loopback (`127.0.0.1`), private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local, and cloud metadata addresses (`169.254.169.254`).
3. Once authorized, the bridge pipes raw binary bytes bidirectionally between the browser's WebSocket and the Croc Relay TCP socket.
4. **Result**: Zero native plugins required, 100% byte-for-byte wire compatibility with the official `croc` CLI.

---

## 3. Cryptographic Deep-Dive: Zero-Knowledge End-to-End Encryption

### The Fundamental Question
> *"If our file passes through intermediate Relay Nodes, can the relay operator eavesdrop on or alter our files?"*

**The answer is an unequivocal NO.** CrocFlow utilizes a three-tier cryptographic stack running entirely client-side:

```
[ Sender Client ]                                                [ Receiver Client ]
       │                                                                  │
       ├──────────────── Ephemeral Public Keys (P-256) ───────────────────┤
       │                          + PAKE Masking                          │
       ▼                                                                  ▼
[ Derive Shared Secret ]                                         [ Derive Shared Secret ]
       │                                                                  │
       ▼                                                                  ▼
[ HKDF-SHA-256 ]                                                 [ HKDF-SHA-256 ]
       ├──────────────► Session Key (AES-256-GCM) ◄──────────────────────┤
       ├──────────────► confirmA / confirmB tags ◄───────────────────────┤
       ▼                                                                  ▼
[ Mutual Auth Verified ] ◄──────── Bidirectional Check ────────► [ Mutual Auth Verified ]
       │                                                                  │
       ▼                                                                  ▼
[ Encrypt Chunks (GCM) ] ═════════ Ciphertext Stream ══════════► [ Decrypt Chunks (GCM) ]
```

### 1. PAKE (Password-Authenticated Key Exchange) on NIST P-256
Standard Diffie-Hellman allows two parties to agree on a secret over an insecure channel, but is vulnerable to active Man-in-the-Middle (MITM) attacks if keys are unauthenticated.
- **PAKE v2** binds an ephemeral elliptic curve key exchange directly with a shared secret codephrase (e.g., `4281-croc-flow-demo`).
- The codephrase is **never sent in plaintext**.
- An attacker passively logging network traffic or actively operating the relay cannot deduce the codephrase or perform offline dictionary attacks because public points are mathematically blinded by the codephrase hash.

### 2. HKDF-SHA-256 (HMAC-based Key Derivation Function)
Once both peers compute the shared elliptic curve point, they pass it through HKDF along with a cryptographically secure random 32-byte salt:
- Derives a **256-bit symmetric session key** for AES-GCM encryption.
- Derives two distinct verification tags (`confirmA` and `confirmB`). Both peers exchange these tags before any file metadata is sent, proving that both sides entered the identical codephrase without revealing the key.

### 3. AES-256-GCM (Galois/Counter Mode) Authenticated Encryption
- Every frame and file chunk is encrypted using **AES-256-GCM**.
- A unique 12-byte initialization vector (IV) is generated for every single packet.
- GCM provides **AEAD (Authenticated Encryption with Associated Data)**: if a relay server or malicious actor flips even a single bit in transit, the 16-byte authentication tag verification fails immediately, causing the client to terminate the connection.

---

## 4. Chunking, Folder Manifest, and IndexedDB Resume

### The Fragility of Monolithic Streams
In traditional file transfer protocols, transferring a 2 GB file or a folder of 1,000 files as an uninterrupted stream means a network disconnect at 98% requires restarting from byte zero.

### The CrocFlow Solution:
1. **Folder Manifest (`manifest.ts`)**:
   - The sender scans the directory hierarchy and normalizes all relative file paths using `sanitizeRelativePath` (neutralizing directory traversal vectors like `../../etc/passwd`).
   - Files are sliced into fixed-size **Chunks** (default: 64 KB).
   - A cryptographic SHA-256 hash is computed for each individual chunk, as well as an aggregate hash for each file.
2. **IndexedDB Resume Cache (`resume-cache.ts`)**:
   - As the receiver decrypts and verifies each chunk against its expected SHA-256 digest, the chunk is persisted to browser storage (`crocflow-resume-db`).
3. **Differential Resume (`computeResumePlan`)**:
   - If the network drops, upon reconnection the receiver compares the sender's manifest against its local IndexedDB cache.
   - Verified chunks are flagged as `Resume Cache` and skipped.
   - If the sender added new files to the directory while disconnected, CrocFlow dynamically detects the new entries and schedules only the missing bytes for transfer.

---

## 5. Concurrent Dual-Relay Streaming & Automated Failover

### Interleaving Chunks Over Multiple Paths
To overcome single-relay bandwidth bottlenecks and achieve high network utilization:
- CrocFlow establishes two concurrent WebSocket streams:
  - **Relay Alpha**: Assigned even-indexed chunks (`0, 2, 4, 6, ...`)
  - **Relay Beta**: Assigned odd-indexed chunks (`1, 3, 5, 7, ...`)

```
Sender ──────────► Chunk 0 (Even) ──────────► [ Relay Alpha ] ──────────► Receiver
       ──────────► Chunk 1 (Odd)  ──────────► [ Relay Beta  ] ──────────►
       ──────────► Chunk 2 (Even) ──────────► [ Relay Alpha ] ──────────►
       ──────────► Chunk 3 (Odd)  ──────────► [ Relay Beta  ] ──────────►
```

### Dynamic Failover State Machine
What happens if Relay Alpha's data center loses power or suffers a transient routing failure mid-transfer?
1. The `DualRelayScheduler` registers socket disconnection or frame write errors on the Relay Alpha channel.
2. It immediately invokes `triggerAlphaFailover()`.
3. Unacknowledged and pending even chunks are migrated dynamically into Relay Beta's dispatch queue.
4. The receiver reassembles chunks based on `globalIndex`, deduplicates any in-flight retransmissions, and verifies the final SHA-256 checksum. Zero data corruption, zero restart penalties.

---

## 6. Rotating Group Passphrases (`YYYY-MM`)

Teams working together frequently need a shared codephrase without having to communicate a new secret daily:
- CrocFlow implements monthly key derivation via:
  $$\text{MonthlyCode} = \text{HKDF-SHA-256}(\text{MasterSecret}, \text{"YYYY-MM"})$$
- The derived bytes are mapped to the standard EFF short wordlist to produce a natural 3-word codephrase.
- On the first day of each calendar month, all collaborator devices automatically rotate to the new codephrase in lockstep.
