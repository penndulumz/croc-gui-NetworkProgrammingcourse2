# CrocFlow

Domain vocabulary for CrocFlow, a cross-platform end-to-end encrypted file transfer application interoperable with the Croc ecosystem and extended for computer networking education and demonstrations.

## Core Transfer Concepts

**Transfer Session**:
A single active or completed exchange of files, a folder, or direct text between a sender and one or more receivers.
_Avoid_: Job, task, upload job

**Codephrase**:
A human-readable secret phrase (typically three or four EFF words) used both to derive the relay room identifier and to authenticate the end-to-end encryption key via PAKE.
_Avoid_: PIN, invite link, room key

**Standard Mode**:
The wire-compatible Croc v11 transfer mode that interoperates byte-for-byte with the official `croc` CLI and `getcroc.com` web client.
_Avoid_: Legacy mode, basic mode, CLI mode

**Enhanced Mode**:
The CrocFlow app-to-app transfer mode that adds application-layer folder manifests, per-chunk SHA-256 resume, and optional dual-relay delivery without altering Standard Mode compatibility.
_Avoid_: Pro mode, custom mode, experimental mode

**Folder Manifest**:
An application-layer JSON descriptor listing every file's sanitized relative path, byte size, chunk size, total chunk count, and per-chunk SHA-256 digests for a folder transfer.
_Avoid_: File index, directory list, metadata blob

**Chunk**:
A fixed-index slice of a file's bytes transferred, verified, and cached independently to support resume and multi-relay splitting.
_Avoid_: Packet, segment, block

**Resume Cache**:
Client-side persistent storage holding verified received chunks keyed by manifest identity, relative path, and chunk index so interrupted transfers continue without re-downloading completed data.
_Avoid_: Temp storage, draft store, offline buffer

## Network & Relay Concepts

**Bridge Server**:
The local or hosted server component that forwards opaque encrypted binary streams between browser WebSocket connections and allowlisted Croc TCP relays.
_Avoid_: Proxy server, gateway daemon, backend relay

**Relay Node**:
An addressable intermediary server (public Croc relay, embedded local lab relay, or user-configured custom relay) that pairs peers inside a room without inspecting encrypted payloads.
_Avoid_: Broker, hub, mirror

**Dual-Relay Transfer**:
An Enhanced Mode delivery strategy that streams even-indexed chunks (`0, 2, 4...`) over Relay Alpha and odd-indexed chunks (`1, 3, 5...`) over Relay Beta concurrently.
_Avoid_: Split transfer, load-balanced transfer, multi-server upload

**Failover**:
The automatic rerouting of remaining in-flight or pending chunks from a disconnected Relay Node to the surviving Relay Node during a Dual-Relay Transfer.
_Avoid_: Retry, fallback, reconnect

**Protocol Inspector**:
The real-time diagnostic view that surfaces live PAKE handshake milestones, per-chunk relay assignment and verification state, and measured throughput emitted by the active transfer engine.
_Avoid_: Debug console, network log, telemetry panel

## Collaboration & Identity Concepts

**Device Alias**:
A user-chosen friendly name identifying the current phone or desktop inside transfer history and peer lists.
_Avoid_: Hostname, username, profile name

**Group Passphrase**:
A shared team secret that automatically derives a time-scoped room and encryption secret bound to a calendar rotation cycle (such as `YYYY-MM`).
_Avoid_: Static password, team key, persistent code
