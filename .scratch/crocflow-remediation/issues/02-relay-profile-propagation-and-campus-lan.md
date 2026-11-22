# 02: Dynamic Relay Profile Selection & Campus-LAN Transfer Routing

**What to build:** Lift the active `RelayProfile` state from `RelaysView` into shared application state (in `App.tsx` or a reactive store), allowing users to switch between "Public Croc Relays" and "Local Dual-Relay Lab". Pass the active profile into `SendView` and `ReceiveView`. When "Local Dual-Relay Lab" is selected, Standard Mode transfers route through the local embedded bridge server and Enhanced Mode transfers route through `/ws-dual` (Relay Alpha and Relay Beta), enabling complete offline or campus-LAN transfers even when outbound TCP ports 9009–9017 are blocked. Display a visible badge in the header/transfer cards reflecting the active Relay Profile.

**Blocked by:** 01: Domain Vocabulary Normalization, Branded Codephrase & Bridge Client Unification

**Status:** ready-for-agent

- [ ] `activeRelayProfile` lifted to shared state accessible across views.
- [ ] `SendView` and `ReceiveView` configure their transfer clients with the active profile's endpoints.
- [ ] In "Local Dual-Relay Lab" mode, Standard Mode routes via the local bridge and Enhanced Mode routes via `/ws-dual`.
- [ ] Active transfer cards render an indicator showing which relay profile is currently active.
- [ ] Unit/integration tests verify transfer client endpoint configuration under both profiles.
