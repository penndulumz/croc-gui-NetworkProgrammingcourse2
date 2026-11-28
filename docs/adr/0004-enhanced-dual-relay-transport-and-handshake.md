# 0004: Relay-Profile-Aware Dual-Relay Transport, Idempotent PAKE Initiation, and Windowed Chunk Acknowledgment

Status: accepted

Enhanced Mode Dual-Relay Transfers previously routed all sessions exclusively to the single-server in-memory `/ws-dual` endpoint regardless of the active Relay Profile, dropped `pake-init` whenever the receiver joined before the sender, deadlocked on `dualRelay` setting mismatches, marked chunks delivered before receiver verification, and throttled browser background tabs via per-chunk `setTimeout` delays. We decided to unify Enhanced Mode transport behind a `RelayChannelConnection` abstraction dispatched by Relay Profile: `/ws-dual` under `local-lab` and `/ws` (`connectRelay` + `CrocSocket` length-prefixed framing across deterministic public relay pairs `(relayIndex(codephrase), (alphaIdx + 1) % N)`) under `public`. On top of both transports, the receiver performs idempotent `pake-init` retries (triggered on `peer_count >= 2` and a short timer until `pake-reply`), negotiates effective `dualRelayAccepted` inside `resume-plan`, sends per-chunk `chunk-ack` receipts alongside `lane-down` notifications, and relies on symmetric Alpha/Beta failover in `DualRelayScheduler`.

## Considered Options

- **Keep Enhanced Mode restricted to `/ws-dual` on a single Bridge Server**: Rejected because two peers on separate hosts using `Public Croc Relays` cannot rendezvous on an in-memory local node.
- **Host a dedicated centralized Enhanced relay service**: Rejected because it introduces external server hosting lock-in and breaks zero-infrastructure classroom operation on `1..4.getcroc.com`.
- **Buffer early PAKE messages inside `LocalDualRelayNode`**: Rejected as a sole fix because stateless public Croc TCP relays do not buffer pre-pair messages cleanly across reconnects; idempotent `pake-init` retry solves receiver-first ordering across every transport uniformly.

## Consequences

- Both Standard Mode and Enhanced Mode respect the active Relay Profile (`Public Croc Relays` across separate devices/bridges and `Local Dual-Relay Lab` for offline/campus demos).
- Dual-Relay transfers survive receiver-first joins, mismatched `dualRelay` peer settings, mid-flight Alpha or Beta disconnections, and background browser tabs without stalling or losing in-flight chunks.
- When outbound TCP ports (`9009–9017`) are blocked under the `public` Relay Profile, Enhanced Mode surfaces an explicit error directing users to switch to `Local Dual-Relay Lab` instead of silently bypassing public relays.
