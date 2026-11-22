# 05: Rolling Throughput Speed, Dynamic ETA & Granular Per-File Progress

**What to build:** Add real-time transfer performance metrics to both Standard Mode and Enhanced Mode transfers. Implement a smoothed 3-second sliding window throughput calculator that derives current transfer speed (KB/s or MB/s), calculates estimated time remaining (ETA) formatted in minutes and seconds, and gracefully handles network pauses (displaying "Paused" or "Calculating..."). Render individual per-file progress bars alongside the overall progress bar in both Send and Receive views.

**Blocked by:** 01: Domain Vocabulary Normalization, Branded Codephrase & Bridge Client Unification

**Status:** ready-for-agent

- [ ] Rolling 3-second window throughput calculator implemented in `src/lib/metrics.ts`.
- [ ] ETA calculation implemented with pause and zero-throughput handling.
- [ ] Speed and ETA rendered in real-time in both `SendView` and `ReceiveView` across Standard and Enhanced modes.
- [ ] Granular per-file progress bars rendered during multi-file transfers.
- [ ] Unit tests verify throughput windowing, ETA formatting, and stall handling.
