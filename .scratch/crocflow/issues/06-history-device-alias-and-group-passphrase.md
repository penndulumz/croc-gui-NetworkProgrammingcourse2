# 06: Transfer History, Device Alias & Monthly Rotating Group Passphrases

**What to build:** Deliver the **History & Group** workspace so CrocFlow behaves like a real personal and team utility rather than a disposable webpage. Users can set a friendly **Device Alias** (displayed in the sidebar/header and recorded on sessions), search and filter their local **Transfer History** (All / Sent / Received) showing mode, file count, total bytes, SHA-256 verification status, and timestamps, and manage **Group Passphrases** bound to a calendar rotation cycle (`YYYY-MM`). Each Group Passphrase deterministically derives the current month's secure Codephrase via HKDF-SHA-256 and provides one-tap buttons to load it directly into Send or Receive.

**Blocked by:** 01: App Foundation, Unified Bridge Server & Responsive Dual-Theme Shell

**Status:** done

- [x] Users can edit and persist a friendly Device Alias that survives page reloads and appears cleanly in the app shell.
- [x] Every completed, resumed, or failed Transfer Session logs an entry into local Transfer History with live search, Sent/Received segmented filters, empty states, and clear-history confirmation.
- [x] Users can create, delete, and inspect Group Passphrases configured with a shared team secret and monthly rotation (`YYYY-MM`), viewing both the active month's derived Codephrase and next rotation date.
- [x] Clicking "Use in Send" or "Use in Receive" on a Group Passphrase immediately populates the target screen with the derived Codephrase.
- [x] Unit tests verify deterministic HKDF-SHA-256 derivation within the same `YYYY-MM` period and cryptographic independence across consecutive months.

## Resolution

Implemented, type-checked (`tsc --noEmit`), bundled (`vite build`), verified with automated unit/integration tests (24/24 passing), and verified in headless Chromium across Desktop Light/Dark and Mobile 390x844 viewports.
