# 03: Latency-Aware Codephrase Generation for Fastest Relay Rendezvous

**What to build:** Make latency probe results actionable without breaking Croc v11 rendezvous rules. In Standard Mode, when the user auto-generates a Codephrase and latency probe data is available, generate candidate EFF wordphrases in a fast loop until candidate hash maps to the lowest-latency public relay index (`hash(candidate) % 4 + 1 === targetRelayIndex`). Display a badge indicating the optimized relay and measured latency. In Enhanced Mode, allow direct targeting of the fastest Relay Node.

**Blocked by:** 01: Domain Vocabulary Normalization, Branded Codephrase & Bridge Client Unification

**Status:** resolved

- [x] Function `generateOptimizedCodephrase(targetRelayIndex)` implemented to generate phrases matching target relay hash.
- [x] Standard Mode Codephrase generation auto-selects the fastest public relay when latency data is present.
- [x] UI shows "Optimized for Relay N (X ms)" badge when an optimized phrase is active.
- [x] Enhanced Mode directly routes transfers to the lowest-ping Relay Node.
- [x] Unit tests verify candidate generation speed (<5ms) and deterministic relay mapping.
