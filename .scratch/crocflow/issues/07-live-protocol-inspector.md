# 07: Live Protocol Inspector (PAKE Timeline, Chunk Map & Throughput)

**What to build:** Connect a real-time **Protocol Inspector** directly to the live transfer engine's event bus so every handshake step, chunk transfer, resume cache hit, and failover event is rendered visually as it happens—with zero fabricated or mock telemetry. On Desktop, the Protocol Inspector sits alongside the active transfer workspace (or expands on demand); on Mobile, it opens cleanly in an inspectable panel. Users see (1) the ordered PAKE & AES-256-GCM handshake timeline, (2) a live Chunk Allocation Map distinguishing pending, Relay Alpha, Relay Beta, SHA-256 verified, resumed-from-cache, and failover-rerouted chunks, and (3) a real-time throughput sparkline and tabular summary metrics.

**Blocked by:** 02: Standard Mode Croc v11 Direct Transfer (CLI & getcroc.com Interop), 04: Enhanced Mode Folder Transfer & SHA-256 Manifest Resume (IndexedDB), 05: Dual-Relay Multi-Path Transfer (Even/Odd Chunks) & Automatic Failover

**Status:** done

- [x] Protocol Inspector displays an informative empty state before any transfer starts and populates exclusively from live events emitted by Standard Mode and Enhanced Mode transfers.
- [x] PAKE Handshake Timeline updates step-by-step with real timestamps (Room Join → Curve Negotiation → Key Derivation → Mutual Confirmation → Encrypted Stream Active).
- [x] Chunk Allocation Map visually distinguishes Relay Alpha (even), Relay Beta (odd), Verified (SHA-256), Resumed (Cache Hit), and Rerouted (Failover) chunks with accessible text legends.
- [x] Throughput sparkline and summary counters (bytes transferred, active speed, verified chunks, resumed chunks, failover count) update live using monospace tabular numerals.
- [x] Users can export the captured session protocol log as Markdown/JSON for inclusion in Computer Networks lab reports.

## Resolution

Implemented, type-checked (`tsc --noEmit`), bundled (`vite build`), verified with automated unit/integration tests (24/24 passing), and verified in headless Chromium across Desktop Light/Dark and Mobile 390x844 viewports.
