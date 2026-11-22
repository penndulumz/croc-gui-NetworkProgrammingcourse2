# 01: Button Text Economy & Concise i18n Dictionary

**What to build:** Streamline all action button labels and dictionaries in `src/lib/i18n.ts` so every button uses punchy 1-3 word verbs (e.g. "Send", "Receive", "Cancel", "Simulate Failover", "Fastest Relay", "Copy Code", "Clear All") in both English and Vietnamese, removing long paragraph descriptions from button labels and moving them to tooltips/hints.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] All action button translation keys in `src/lib/i18n.ts` are 1-3 words maximum for both `vi` and `en`
- [ ] Unit tests in `src/lib/i18n.test.ts` verify all keys match between `vi` and `en` with concise strings
- [ ] `npm test` passes cleanly with 0 failures
