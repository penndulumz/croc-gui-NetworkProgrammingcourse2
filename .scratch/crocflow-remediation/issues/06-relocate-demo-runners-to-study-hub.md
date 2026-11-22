# 06: Relocation of Synthetic Demo Runners to Interactive Study & Demo Lab

**What to build:** Clean up the primary user Send workspace by removing synthetic loopback test buttons (`runLoopbackDualRelayFailoverDemo` and `runLoopbackFolderResumeDemo`) from `SendView.tsx`. Move them into a dedicated "Phòng Thí Nghiệm & Báo Cáo Giảng Viên (Lecturer Demo Lab)" section inside `AppDocsHubView.tsx`. Graders and students can trigger live demonstrations, simulate Relay Alpha disconnects with pre-loaded mock files, and view live step-by-step explanatory text without cluttering real end-user transfers.

**Blocked by:** 02: Dynamic Relay Profile Selection & Campus-LAN Transfer Routing

**Status:** ready-for-agent

- [ ] Synthetic loopback demo buttons removed from `SendView.tsx`.
- [ ] Dedicated "Lecturer Demo Lab" section created in `AppDocsHubView.tsx`.
- [ ] Interactive demo controls (dual-relay failover and resume demo with failure simulation) fully functional in the hub.
- [ ] Step-by-step Vietnamese explanatory notes accompany the demo triggers.
- [ ] Send view presents a clean, distraction-free transfer interface.
