# 01: Domain Vocabulary Normalization, Branded Codephrase & Bridge Client Unification

**What to build:** Normalize all codebase identifiers, documentation, metrics, and parameters to strictly adhere to `GLOSSARY.md`. Rename `LocalDualRelayHub` to `LocalDualRelayNode` across `server/` and `src/`, rename `gatewayURL` to `bridgeURL` across all server and client interfaces, update ADR-0003 title to use "Bridge" instead of "Proxy", rename metrics from `packetsRelayed` to `chunksRelayed`, type raw codephrases with a branded `Codephrase` type, and extract the duplicated WebSocket bridge URL derivation into a shared helper function in `src/lib/bridge-client.ts`.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `LocalDualRelayHub` renamed to `LocalDualRelayNode` across `server/local-dual-relay.ts`, `server.ts`, and test files.
- [x] `gatewayURL` renamed to `bridgeURL` across `server.ts`, `src/vite-env.d.ts`, `src/protocol/croc/types.ts`, `src/components/SendView.tsx`, and `src/components/ReceiveView.tsx`.
- [x] Title of `docs/adr/0003-embedded-bridge-and-local-dual-relay.md` updated to avoid "Proxy".
- [x] `packetsRelayed` metric renamed to `chunksRelayed` across server and client views.
- [x] Scheduler `job` variables renamed to `scheduledChunk` in `enhanced-client.ts` and hash tasks disambiguated.
- [x] Common WebSocket bridge URL derivation extracted into `deriveBridgeURL()` in `src/lib/bridge-client.ts`.
- [x] Branded `Codephrase` type and validation helper added and adopted.
- [x] Typecheck and unit tests pass.
