# 03: Relay Manager, Live RTT Latency Probing & Local Dual-Relay Lab

**What to build:** Build the **Relays & Network** view alongside two independent embedded Local Relay Nodes (**Relay Alpha** and **Relay Beta**) inside the unified Node.js server. Users can view all public Croc Relay Nodes (`1..4.getcroc.com`), the embedded Local Dual-Relay Lab nodes, and any saved custom Relay Nodes; run a live RTT latency probe measuring actual response times in milliseconds; see Relay Nodes automatically ranked from fastest to slowest; and select whether transfers route via the Public Croc pool or the Local Dual-Relay Lab (enabling offline/campus-LAN demos even when outbound TCP `9009–9017` is blocked).

**Blocked by:** 01: App Foundation, Unified Bridge Server & Responsive Dual-Theme Shell

**Status:** done

- [x] Embedded server runs two isolated local relay rooms (**Relay Alpha** and **Relay Beta**) over WebSocket capable of pairing sender and receiver peers with opaque encrypted payloads.
- [x] Relays & Network screen lists Public Croc relays, Local Relay Alpha/Beta, and user-added custom relays with live online/offline state and measured RTT latency in `ms` (using tabular numerals).
- [x] Clicking the Ping RTT action measures actual round-trip latency and updates relay rankings and active relay recommendation.
- [x] Users can switch between Public Croc Ecosystem mode and Local Dual-Relay Lab mode cleanly without restarting the app.
- [x] Integration tests verify pairing, message forwarding, room isolation, and latency probing against both embedded local relays.

## Resolution

Implemented, type-checked (`tsc --noEmit`), bundled (`vite build`), verified with automated unit/integration tests (24/24 passing), and verified in headless Chromium across Desktop Light/Dark and Mobile 390x844 viewports.
