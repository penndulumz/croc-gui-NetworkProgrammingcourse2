# 05: Zero-Delay Browser Scheduling & Measured Relay Node RTT Telemetry

**What to build:** Eliminate browser background-tab `1000ms` timer clamping by running browser `Enhanced Mode` transfers with zero inter-chunk delay, propagate strictly measured `Relay Node` stream-pair RTTs (preserving `null` when unavailable), and surface `Relay Beta` sever state in the `Protocol Inspector`.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Configure browser transfers with `chunkDelayMs = 0` so multi-megabyte transfers complete rapidly even in background tabs.
- [ ] Resolve `Relay Alpha` and `Relay Beta` latency solely from measured `Relay Node` ping RTTs without synthetic offsets or hardcoded `"<2ms"` strings.
- [ ] Pass real stream-pair RTTs into transfer telemetry and display explicit unavailable vs. severed `Relay Beta` indicators in `Protocol Inspector`.
- [ ] Unit and browser E2E tests verify genuine RTT resolution (`null` preservation) and fast multi-megabyte `4 MB` transfer with live `Failover`.
