# 02: Peer Dual-Relay Transfer Capability Negotiation (resume-plan)

**What to build:** Exchange explicit `dualRelayAccepted` capability negotiation inside `resume-plan` so mismatched Sender/Receiver `Dual-Relay Transfer` settings (ON/OFF or OFF/ON) downgrade cleanly to single-lane `Relay Alpha` instead of stalling on `Relay Beta`.

**Blocked by:** 01

**Status:** resolved

- [x] Compute `dualRelayAccepted` from both peers' `Dual-Relay Transfer` preference and availability of a second distinct `Relay Node`.
- [x] Exchange `dualRelayAccepted` in `resume-plan` before initiating any `Relay Beta` stream or scheduler lane.
- [x] Keep Receiver-first and Sender-first `Transfer Session` runs passing end-to-end when `Dual-Relay Transfer` is enabled on only one peer.
- [x] Integration and browser E2E tests verify ON/OFF and OFF/ON downgrade cleanly to `Relay Alpha` with SHA-256 verification.
