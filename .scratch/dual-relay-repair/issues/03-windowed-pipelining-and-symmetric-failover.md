# 03: Windowed Chunk Pipelining, Symmetric Failover & Completion Convergence

**What to build:** Replace lockstep chunk delivery with a bounded `4`-chunk per-lane in-flight window, add explicit `lane-down` notifications and socket flush before close, unify symmetric `Relay Alpha` / `Relay Beta` `Failover`, and reconcile trailing slower-lane ACKs when `complete` arrives first.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Bound each active scheduler lane to an in-flight window (`MAX_IN_FLIGHT_PER_LANE = 4`) with event-driven worker wakeup.
- [ ] Extract a shared symmetric lane-failover transition handling both `Relay Alpha` and `Relay Beta` drops without losing chunks.
- [ ] Track per-lane in-flight counts and support `markRemainingDelivered` reconciliation if `complete` arrives ahead of trailing slower-lane ACKs.
- [ ] Flush buffered socket data explicitly before closing transport channels and emit `lane-down` from Receiver on premature lane closure.
- [ ] Unit and loopback fault-injection tests verify pipelined transfers, `Relay Alpha` failover, `Relay Beta` failover, and 100% SHA-256 integrity.
