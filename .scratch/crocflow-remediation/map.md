# Wayfinder Map: CrocFlow Code Review Hardening & Specification Remediation

## Destination

Harden CrocFlow by addressing all 9 standard violations and 6 specification gaps identified during the code review:
1. Normalize domain vocabulary to match `GLOSSARY.md` (no "hub", "gateway", "proxy", "packet", "job", "task").
2. Connect the Relay Profile selection to active transfer routing for seamless campus-LAN / offline demos.
3. Optimize Standard Mode Codephrase generation to deterministically rendezvous on the lowest-latency public relay.
4. Reconstruct received folder hierarchies via client-side ZIP archive download and directory saving.
5. Provide real-time rolling speed, dynamic ETA, and per-file progress tracking.
6. Relocate synthetic loopback demo runners from the user Send workspace to the App & Docs Hub demo lab.
7. Support saving, editing, and selecting Frequent Peer Presets in Transfer History & Identity.

## Tickets

- `01`: [01-domain-standards-and-bridge-client.md](file:///C:/Users/Admin/Desktop/croc-gui-networkprogrammingcourse/.scratch/crocflow-remediation/issues/01-domain-standards-and-bridge-client.md) (Status: resolved)
- `02`: [02-relay-profile-propagation-and-campus-lan.md](file:///C:/Users/Admin/Desktop/croc-gui-networkprogrammingcourse/.scratch/crocflow-remediation/issues/02-relay-profile-propagation-and-campus-lan.md) (Status: resolved)
- `03`: [03-latency-aware-codephrase-generation.md](file:///C:/Users/Admin/Desktop/croc-gui-networkprogrammingcourse/.scratch/crocflow-remediation/issues/03-latency-aware-codephrase-generation.md) (Status: resolved)
- `04`: [04-folder-zip-archive-and-directory-save.md](file:///C:/Users/Admin/Desktop/croc-gui-networkprogrammingcourse/.scratch/crocflow-remediation/issues/04-folder-zip-archive-and-directory-save.md) (Status: resolved)
- `05`: [05-rolling-speed-eta-and-file-progress.md](file:///C:/Users/Admin/Desktop/croc-gui-networkprogrammingcourse/.scratch/crocflow-remediation/issues/05-rolling-speed-eta-and-file-progress.md) (Status: resolved)
- `06`: [06-relocate-demo-runners-to-study-hub.md](file:///C:/Users/Admin/Desktop/croc-gui-networkprogrammingcourse/.scratch/crocflow-remediation/issues/06-relocate-demo-runners-to-study-hub.md) (Status: resolved)
- `07`: [07-frequent-peer-presets.md](file:///C:/Users/Admin/Desktop/croc-gui-networkprogrammingcourse/.scratch/crocflow-remediation/issues/07-frequent-peer-presets.md) (Status: resolved)

## Resolution & Integration

All 7 tickets and code review remediation items have been built, verified, and merged into `integration/remediation`:
- 73/73 unit and integration tests passing (`npm test`).
- Type check passing with 0 errors (`npm run lint`).
- Commits:
  - `8442b88`: feat: implement ticket 01 domain standards and bridge client unification
  - `956092d`: feat: implement ticket 02 relay profile propagation and campus-lan routing
  - `7199584`: feat: implement ticket 03 latency-aware codephrase generation
  - `24487af`: feat: implement ticket 04 folder zip archive and directory save
  - `08f13dd`: feat: implement ticket 05 rolling speed eta and file progress
  - `be7ebf4`: feat: implement ticket 06 relocate demo runners to study hub
  - `de94b9a`: feat: implement ticket 07 frequent peer presets
  - `317ffd6`: fix: resolve standards and spec code review findings
