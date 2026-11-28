# 04: Relay Profile Routing Across Public Relay Node Pool via Bridge Server

**What to build:** Propagate active `Relay Profile` (`public` vs. local-lab) from send and receive workflows into `Enhanced Mode` so the public profile routes `Relay Alpha` and `Relay Beta` through distinct public `Relay Node` endpoints via `Bridge Server`, validates `Bridge Server` readiness, and enables latency-optimized `Codephrase` generation in `Enhanced Mode`.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Propagate `Relay Profile` and public `Relay Node` list into `Enhanced Mode` send and receive calls.
- [ ] Route public `Dual-Relay Transfer` across deterministic distinct indices (`alphaIndex` and `(alphaIndex + 1) % relayCount`) via `Bridge Server` Croc socket framing, falling back to single lane if fewer than `2` relays exist.
- [ ] Validate `Bridge Server` availability cleanly when using the public `Relay Profile` and enable optimized `Codephrase` generation for `Enhanced Mode` public transfers.
- [ ] Cross-server E2E test verifies dual-lane transfer across public Croc `Relay Node` endpoints (`Alpha` and `Beta` chunks verified).
