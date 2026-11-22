# 09: Zero-to-Hero Vietnamese Docs, Interactive Study Hub & Lecturer Demo Script

**What to build:** Complete the **App & Docs Hub** tab inside CrocFlow alongside comprehensive, beginner-friendly Vietnamese documentation in the repository so the student fully understands every concept and line of architecture, and the lecturer can test every requirement effortlessly. Cover four clear documents: (1) Networking Concepts from Zero mapped to CrocFlow (NAT, Relay, TCP vs WebSocket, PAKE, HKDF, AES-256-GCM, Chunking, SHA-256 Manifest, Resume, Dual-Relay Failover), (2) Architecture & Code Walkthrough explaining how each module fits together, (3) Zero-Experience Setup, Run & GitHub Actions APK/Desktop Download Guide, and (4) 5-Minute Lecturer Demo & Q&A Playbook. Include an in-app Export Report (`.md`) button bundling the architecture summary and live session history.

**Blocked by:** 05: Dual-Relay Multi-Path Transfer (Even/Odd Chunks) & Automatic Failover, 06: Transfer History, Device Alias & Monthly Rotating Group Passphrases, 07: Live Protocol Inspector (PAKE Timeline, Chunk Map & Throughput), 08: Multi-Platform App Packaging (PWA Install, Android APK & Desktop CI)

**Status:** done

- [x] In-app App & Docs Hub provides quick install links/instructions for Android (PWA + APK), Desktop (PWA + Electron), and `croc` CLI interop testing without jargon.
- [x] In-app Study Reader lets the student review Networking Concepts from Zero, Protocol Flow diagrams, and Lecturer Q&A preparation directly inside the app (including offline).
- [x] Clicking "Export Study & Session Report (.md)" downloads a well-formatted Markdown report combining CrocFlow's technical architecture and recorded session statistics.
- [x] Repository documentation files provide complete, accurate Vietnamese walkthroughs for beginners, teammates collaborating via tickets, and lecturers grading the app.
- [x] End-to-end browser verification confirms every journey (Standard Mode, Folder Manifest Resume, Dual-Relay Failover, Protocol Inspector, History/Group Passphrase, PWA, Dark/Light themes) works cleanly on both Desktop (`1440×900`) and Mobile (`390×844`) with zero high-severity defects.

## Resolution

Implemented, type-checked (`tsc --noEmit`), bundled (`vite build`), verified with automated unit/integration tests (24/24 passing), and verified in headless Chromium across Desktop Light/Dark and Mobile 390x844 viewports.
