# 07: Frequent Peer Presets & One-Tap Recipient Selection

**What to build:** Complete device identity management by supporting Frequent Peer Presets. Extend `src/lib/history-store.ts` and `src/components/HistoryGroupView.tsx` with a "Thiết Bị Thường Gặp (Frequent Peers)" management card in `localStorage`. Allow users to save peer Device Aliases, last-seen timestamps, and default profile preferences, edit or delete entries, and add a quick-select peer dropdown/button on the Send screen to prepare a transfer target in one tap.

**Blocked by:** 01: Domain Vocabulary Normalization, Branded Codephrase & Bridge Client Unification

**Status:** ready-for-agent

- [ ] `PeerPreset` data model and CRUD functions added to `src/lib/history-store.ts`.
- [ ] "Frequent Peers" management UI added to `HistoryGroupView.tsx` (add, edit, delete, search).
- [ ] Quick-select peer button/dropdown added to `SendView.tsx` to prefill transfer targets.
- [ ] Peer presets persisted in `localStorage`.
- [ ] Unit tests verify peer preset serialization, validation, and retrieval.
