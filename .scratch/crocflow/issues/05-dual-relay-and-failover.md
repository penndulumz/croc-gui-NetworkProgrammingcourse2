# 05: Dual-Relay Multi-Path Transfer (Even/Odd Chunks) & Automatic Failover

**What to build:** Upgrade Enhanced Mode transfers with **Dual-Relay Transfer** scheduling across **Relay Alpha** and **Relay Beta** simultaneously. When Dual-Relay is enabled, the sender streams even-indexed chunks (`0, 2, 4...`) over Relay Alpha and odd-indexed chunks (`1, 3, 5...`) over Relay Beta in parallel while the receiver reassembles and SHA-256 verifies the complete file(s). Provide a live **Simulate Relay Alpha Disconnect** control during active transfers so students and lecturers can sever Relay Alpha mid-flight and watch CrocFlow detect the dropped channel, trigger **Failover**, automatically reroute all remaining even chunks over Relay Beta, and finish the transfer with 100% byte-for-byte integrity.

**Blocked by:** 03: Relay Manager, Live RTT Latency Probing & Local Dual-Relay Lab, 04: Enhanced Mode Folder Transfer & SHA-256 Manifest Resume (IndexedDB)

**Status:** done

- [x] Dual-Relay Transfer routes even-indexed chunks strictly through Relay Alpha and odd-indexed chunks strictly through Relay Beta during healthy operation.
- [x] Receiver collects chunks from both relays out-of-order, verifies every chunk's SHA-256 digest, and reassembles the exact original file(s) without corruption.
- [x] Triggering "Simulate Relay Alpha Disconnect" mid-transfer immediately closes the Relay Alpha channel, detects pending/in-flight even chunks, and reroutes them automatically through Relay Beta.
- [x] UI clearly reports per-relay chunk counters (Alpha vs Beta vs Rerouted via Failover) alongside explicit text status labels (not color-only).
- [x] Pure unit tests and live dual-WebSocket integration tests prove lossless completion both under normal dual-path operation and under mid-transfer Relay Alpha failure.

## Resolution

Implemented, type-checked (`tsc --noEmit`), bundled (`vite build`), verified with automated unit/integration tests (24/24 passing), and verified in headless Chromium across Desktop Light/Dark and Mobile 390x844 viewports.
