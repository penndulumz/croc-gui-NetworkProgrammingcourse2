# 0003: Unified Node.js Bridge Server with Allowlisted Public Relay Proxy and Embedded Local Dual-Relay Lab

Status: accepted

Web clients cannot open raw TCP sockets directly to Croc's public relays (`1.getcroc.com`–`4.getcroc.com`), and university Wi-Fi networks frequently block outbound non-HTTP TCP ports (`9009–9017`) during live classroom demonstrations. We decided to run a single Node.js server that serves the web app, exposes an allowlisted WebSocket-to-TCP Bridge Server for public Croc relays, and hosts two independent in-process Local Relay Nodes (Relay Alpha and Relay Beta) for deterministic Dual-Relay and failover demos.

## Considered Options

- **Use Go `croc-web` binary as the server**: Rejected because Go is not installed in this build environment and `croc-web` does not expose a dual-relay classroom lab or Node-native integration for Electron desktop bundling.
- **Allow arbitrary user-entered TCP host/port forwarding on `/ws`**: Rejected because an unrestricted WebSocket-to-TCP proxy creates an open SSRF/network-pivot risk; `/ws` enforces a strict host and port allowlist.

## Consequences

- Real CLI and `getcroc.com` interoperability works whenever outbound TCP `9009–9017` is reachable through the allowlisted bridge.
- Classroom Dual-Relay, failover, and disconnect-resume demonstrations work reliably even inside restricted or offline LAN environments using Relay Alpha and Relay Beta.
