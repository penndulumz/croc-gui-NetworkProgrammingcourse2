# Spec: Dual-Relay Transfer & Handshake Repair

Status: ready-for-agent

## Problem Statement

Users running `Enhanced Mode` with `Dual-Relay Transfer` encountered multiple protocol, UI-wiring, and scheduling breakdowns that caused sessions to hang, silently run single-lane, misreport stream telemetry, or fail mid-transfer:

1. **Broken `Relay Profile` routing on Public Croc Relays**: Even when the user selected the public `Relay Profile`, `Enhanced Mode` unconditionally tried to dial the local WebSocket dual-relay endpoint instead of routing `Relay Alpha` and `Relay Beta` through the configured `Bridge Server` and public `Relay Node` pool.
2. **Receiver-first PAKE handshake deadlock**: When the Receiver joined and waited on `Relay Alpha` before the Sender connected, the Receiver's initial `pake-init` could arrive before the Sender joined the room, leaving the `Transfer Session` stuck indefinitely in key exchange instead of completing or cleaning up promptly on abort.
3. **Mismatched `Dual-Relay Transfer` toggle hang**: When Sender and Receiver held opposite `Dual-Relay Transfer` toggle states, the dual-enabled side attempted or waited on `Relay Beta` traffic that the other side never opened, stalling the `Transfer Session` instead of negotiating down cleanly.
4. **Slow lockstep `Chunk` ACK, asymmetric `Failover`, and completion race**: Waiting per-chunk for an acknowledgment capped throughput (`~1 Chunk` per RTT) and interacted poorly with browser background-tab timer throttling when a fixed chunk delay was configured. In addition, simulated or sudden lane loss lacked symmetric `Failover` back to the surviving lane, explicit `lane-down` signaling, and race handling when `complete` arrived before trailing `Chunk` acknowledgments on the slower lane.
5. **Misleading `Relay Node` RTT telemetry**: Stream inspection displayed fabricated fallback latency values (`<2ms`) and artificial lane RTT offsets when real latency measurements were unavailable or identical, instead of surfacing measured `Relay Node` RTTs or null state plus lane sever status.

## Solution

Restore end-to-end reliability, throughput, and honest observability for `Enhanced Mode` `Dual-Relay Transfer` across both public and local-lab `Relay Profile` configurations:

1. **Profile-aware dual-lane transport opening**: Bind `Enhanced Mode` channel setup directly to the active `Relay Profile`. Under the local-lab profile, open `Relay Alpha` and `Relay Beta` over the dedicated local dual-relay transport. Under the public profile, derive deterministic distinct `Relay Alpha` and `Relay Beta` indices across the selected public `Relay Node` pool (`alphaIndex` from the `Codephrase` hash, `betaIndex = (alphaIndex + 1) % relayCount`), tunnel each lane through the `Bridge Server` using the standard Croc socket framing, and flush buffered bytes explicitly before closing a transport channel. When a single `Relay Node` or non-dual mode is configured, run cleanly on `Relay Alpha` alone.
2. **Idempotent Receiver-first PAKE rendezvous and responsive cancellation**: Ensure key exchange converges regardless of whether Sender or Receiver connects to `Relay Alpha` first by tracking peer readiness (`peer_count`), re-sending `pake-init` idempotently from the Receiver on peer arrival and on a short retry interval until `pake-reply` arrives, allowing idempotent `pake-reply` re-emission on the Sender, and wiring `AbortSignal` cleanup directly into handshake waiting states.
3. **Explicit `Dual-Relay Transfer` capability negotiation**: Exchange a peer capability acceptance flag inside `resume-plan` so both endpoints agree on `dualRelayAccepted = senderDualRelay && receiverDualRelay` before any `Relay Beta` traffic or lane scheduling proceeds, downgrading cleanly to single-lane `Relay Alpha` whenever either peer disables `Dual-Relay Transfer`.
4. **Pipelined windowed scheduling, symmetric `Failover`, and completion convergence**: Replace lockstep wait-after-send with a bounded per-lane in-flight window (`MAX_IN_FLIGHT_PER_LANE = 4`), event-driven worker wakeup, zero artificial browser chunk timer delay (`chunkDelayMs = 0`), explicit `lane-down` notifications from the Receiver when a lane closes prematurely, symmetric `triggerLaneFailover` handling for both `Relay Alpha` and `Relay Beta` failures, and `markRemainingDelivered` reconciliation if `complete` overtakes trailing `Chunk` acknowledgments on a slower lane.
5. **Measured stream-pair latency and lane-status reporting**: Resolve `Relay Alpha` and `Relay Beta` RTTs exclusively from real measured `Relay Node` ping results (returning `null` when unmeasured instead of synthetic offsets or `"<2ms"` strings), propagate real stream-pair RTTs into the `Protocol Inspector`, and indicate when `Relay Beta` is no longer alive.

## User Stories

- As a Sender or Receiver using the public `Relay Profile`, I want `Enhanced Mode` with `Dual-Relay Transfer` to establish `Relay Alpha` and `Relay Beta` across distinct public `Relay Node` endpoints via the `Bridge Server` so dual-channel transfers work outside localhost without extra setup.
- As a user generating a `Codephrase` in `Enhanced Mode` under the public `Relay Profile`, I want optimized `Relay Node` selection so the primary channel starts on the lowest-latency `Relay Node`.
- As a Receiver who opens a `Transfer Session` before the Sender starts, I want the PAKE handshake to complete automatically as soon as the Sender joins `Relay Alpha` (and cancel immediately if I abort), rather than hanging forever.
- As a Sender and Receiver whose `Dual-Relay Transfer` toggles do not match (ON/OFF or OFF/ON), I want the `Transfer Session` to negotiate down to `Relay Alpha` automatically and finish cleanly with full hash verification.
- As a user transferring a multi-megabyte file in `Enhanced Mode`, I want pipelined windowed `Chunk` delivery without background-tab timer throttling so dual-lane throughput scales smoothly instead of stalling at 1 `Chunk` per round trip.
- As a user testing or experiencing a severed `Relay Alpha` or `Relay Beta` connection mid-transfer, I want `Failover` to re-queue unacknowledged chunks onto the surviving lane, preserve `100%` SHA-256 integrity, and update the UI when `Relay Beta` goes down.
- As a user inspecting active streams in the `Protocol Inspector`, I want to see genuine measured `Relay Node` RTTs (or an explicit unavailable indicator when `null`) and accurate failover counters rather than hardcoded numbers.

## Implementation Decisions

- **Public vs. local-lab `Relay Profile` routing**: Standardize public dual-lane routing around deterministic distinct lane assignment across public `Relay Node` entries via the `Bridge Server` TCP-tunnel framing, and validate `Bridge Server` availability before starting a public `Enhanced Mode` send or receive flow. Keep existing local dual-relay signaling semantics intact for the local-lab `Relay Profile`.
- **Single-channel fallback when fewer than two distinct `Relay Node` endpoints exist**: Never attempt to dual-dial the same `Relay Node` index as both `Relay Alpha` and `Relay Beta` under the public `Relay Profile`; gracefully narrow to single-lane `Relay Alpha` when fewer than two distinct `Relay Node` endpoints are available.
- **Deterministic PAKE convergence without central coordinator**: Keep Receiver-first and Sender-first symmetry in the protocol client itself rather than adding session state to the `Relay Node` or `Bridge Server`, using peer-presence triggers plus a bounded `350ms` retry cadence and idempotent `pake-init` / `pake-reply` handling coupled with abort-signal teardown.
- **Negotiation at `resume-plan` boundary**: Treat `Dual-Relay Transfer` activation as the logical conjunction of Sender preference, Receiver preference, and availability of a second distinct `Relay Node`, surfaced via an explicit `dualRelayAccepted` capability flag in `resume-plan` before the `Chunk` transfer phase starts.
- **Symmetric scheduler `Failover` via shared transition**: Unify `Relay Alpha` and `Relay Beta` failover logic behind a single parameterized lane-failover transition in the scheduler, track per-lane in-flight counts and chunk lookup safely, and reconcile remaining unacknowledged chunks once `complete` confirms all chunks passed verification at the Receiver while trailing acknowledgments on the slower lane are still in flight.
- **Zero-delay pipelining & truthful telemetry**: Run browser transfers with zero artificial inter-chunk timer delay so multi-megabyte transfers are never hit by Chromium background-tab `1000ms` timer clamping, bound each active lane to an in-flight window of `4` unacknowledged chunks, emit explicit `lane-down` control messages on premature lane closure, flush buffered socket writes before closing channels, and report strictly measured RTT values (or `null` when absent).

## Testing Decisions

Keep verification organized around three external-behavior testing seams (matching the codebase's existing pure scheduler tests, in-memory/loopback enhanced-transfer tests, and headless Chromium cross-tab/cross-server verification):

1. **Pure Scheduler & Relay-Pair Resolution Seam**:
   - External behavior verified: `Dual-Relay Transfer` chunk assignment across `Relay Alpha` and `Relay Beta`, per-lane in-flight tracking, symmetric `Relay Alpha` and `Relay Beta` `Failover` re-queueing without data loss, completion convergence on trailing acknowledgments, and stream-pair RTT truthfulness (`null` preservation vs. real measured RTT selection).
   - Prior art pattern: deterministic state-machine unit tests on pure domain modules without network sockets.
2. **Protocol Handshake, Capability Negotiation & Windowed Transport Seam**:
   - External behavior verified: Receiver-first vs. Sender-first join ordering on `Relay Alpha`, mid-PAKE abort termination, `dualRelayAccepted` negotiation under mismatched ON/OFF toggles, windowed `Chunk` pipelining, explicit socket flush before close, `lane-down` emission, and mid-transfer `Relay Alpha` or `Relay Beta` disconnect `Failover` ending in verified SHA-256 completion.
   - Prior art pattern: programmatic multi-peer transfer tests exercising the protocol client against local loopback relay transports and controlled lane-drop faults.
3. **Browser Cross-Tab & Cross-Server UI/E2E Seam**:
   - External behavior verified: end-to-end UI interactions across separate tabs and separate server instances (including public Croc `Relay Node` routing via `Bridge Server`, local-lab `4 MB` transfer with live simulated `Failover`, mismatched peer toggles, Receiver-first start, interactive docs demo verification, zero fabricated `"<2ms"` telemetry, and zero console errors).

## Out of Scope

- Changing `Standard Mode` wire compatibility with upstream `croc` CLI clients (covered by ADR-0002).
- Replacing `Bridge Server` TCP tunneling or embedding a custom QUIC/WebRTC data plane for public `Relay Node` connections.
- Reworking unrelated UI layout or `Group Passphrase` room management flows outside the send view, receive view, and stream latency/lane inspection.

## Further Notes

- Architectural context is documented in ADR-0002 (dual-mode interop and enhanced protocol), ADR-0003 (embedded bridge and local dual-relay), and ADR-0004 (enhanced dual-relay transport and handshake).
- **Current Repository Status**: All implementation fixes, unit/integration regression tests, and ADR/Glossary updates described in this spec have **already been implemented and verified** on `integration/dual-relay-repair` (`107/107` automated tests passing, TypeScript typecheck clean, Vite production build clean, and `6/6` headless Chromium E2E scenarios passing after resolving all Standards & Spec code review findings).
