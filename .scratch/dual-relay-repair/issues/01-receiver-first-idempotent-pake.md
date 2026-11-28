# 01: Receiver-First Idempotent PAKE Handshake & Abort Cleanup

**What to build:** Ensure `Enhanced Mode` PAKE rendezvous on `Relay Alpha` converges deterministically regardless of whether Sender or Receiver connects first, and tears down timers and sockets immediately when aborted mid-handshake.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Track `peer_count` readiness on `Relay Alpha` so Sender triggers idempotent `pake-init` whenever the peer joins.
- [ ] Retry `pake-init` on a bounded `350ms` cadence until `pake-reply` is received.
- [ ] Re-emit `pake-reply` idempotently on Receiver upon duplicate `pake-init` frames.
- [ ] Wire abort signal handling cleanly into handshake waiting promises and cancel retry intervals on abort or completion.
- [ ] Integration tests cover Receiver-first join order and mid-PAKE abort cancellation.
