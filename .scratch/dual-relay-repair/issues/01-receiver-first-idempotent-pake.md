# 01: Receiver-First Idempotent PAKE Handshake & Abort Cleanup

**What to build:** Ensure `Enhanced Mode` PAKE rendezvous on `Relay Alpha` converges deterministically regardless of whether Sender or Receiver connects first, and tears down timers and sockets immediately when aborted mid-handshake.

**Blocked by:** None

**Status:** resolved

- [x] Track `peer_count` readiness on `Relay Alpha` so Receiver triggers idempotent `pake-init` whenever the peer joins.
- [x] Retry `pake-init` from Receiver on a bounded `350ms` cadence until `pake-reply` is received.
- [x] Re-emit `pake-reply` idempotently on Sender upon duplicate `pake-init` frames.
- [x] Wire abort signal handling cleanly into handshake waiting promises and cancel retry intervals on abort or completion.
- [x] Integration tests cover Receiver-first join order and mid-PAKE abort cancellation.
