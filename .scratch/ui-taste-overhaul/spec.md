# Spec: UI Taste Overhaul & Button Text Economy

## Problem Statement

Users find the current CrocFlow user interface visually unappealing and "too AI generated". Specifically:
1. Buttons contain excessive text, paragraphs of explanatory text, and nested subtitles inside the clickable button surfaces itself (e.g., full two-line protocol descriptions inside the mode selection buttons).
2. The visual aesthetic feels like a boilerplate generic Tailwind card stack: cluttered colored alert callouts, redundant pill badges, heavy borders, and overwhelming technical metrics displayed simultaneously.
3. The file upload interface and recipient target configuration are scattered across multiple disparate vertical rows, creating high cognitive load and visual fatigue.

Users need an interface that possesses genuine taste (clean, minimalist, fast utility aesthetic inspired by modern tools like Linear and Raycast), where buttons are concise (1 to 3 words), interactions are intuitive, and technical depth is readily accessible via progressive disclosure rather than dominating the primary screen.

## Solution

A comprehensive design overhaul transforming CrocFlow into a sleek, high-taste, user-friendly utility:
1. **Strict Button Text Economy**: All action buttons and toggle buttons are restricted to 1–3 words (e.g., "Send", "Receive", "Cancel", "Simulate Failover", "Fastest Relay"). Explanatory descriptions are removed from button surfaces and relocated into clean inline tooltips or contextual popovers.
2. **Refined Visual Identity ("Taste")**: Implement a sleek utility design system with deep neutral tones (`zinc-900` / `slate-950`), subtle border dividers (`border-white/10` and `border-zinc-200`), crisp typography hierarchy with tabular figures, and an intentional accent palette (electric mint/emerald for secure transfer states) replacing the cluttered colored banners.
3. **Compact Segmented Mode Selector**: Replace the bulky two-card mode selector at the top of Send and Receive views with a sleek segmented pill control (`[ Standard (Croc v11) | Turbo (Dual-Relay) ]`) with an unobtrusive `(i)` info trigger, reclaiming 40% of above-the-fold screen space.
4. **Unified Drag-and-Drop Canvas**: Consolidate file and folder selection into a single spacious, responsive dropzone with drag-over animations, instant file type chip previews, and a single-click clear button.
5. **Streamlined Transfer Target Bar**: Merge the multi-row codephrase generator, QR code button, and peer presets into a compact horizontal transfer bar.
6. **Calm Primary Telemetry & Expandable Inspector**: Present a distraction-free, smooth primary progress bar with speed and ETA during active transfers, while delegating low-level Dual-Relay chunk mechanics into an expandable "Live Stream Stats" drawer.
7. **Full Bilingual Consistency**: Update both English (`en`) and Vietnamese (`vi`) dictionaries in the i18n engine with concise, natural phrasing.

## User Stories

1. As a user sending files, I want concise 1-to-3-word button labels like "Send" and "Cancel", so that I can immediately identify the primary action without reading paragraphs of text inside buttons.
2. As a user, I want the visual theme to look modern and refined rather than like a generic AI-generated template, so that using the app feels polished and professional.
3. As a sender, I want a compact segmented tab to switch between Standard Croc v11 and Dual-Relay Turbo mode, so that mode switching does not consume excessive vertical screen real estate.
4. As a user curious about protocol differences, I want an unobtrusive info icon next to the mode selector, so that I can read the protocol comparison on demand without cluttering the main screen.
5. As a sender, I want to drag and drop either individual files or whole folders into a single unified dropzone, so that I don't have to hunt for separate file and folder buttons.
6. As a sender, I want to see clean file preview chips with names and sizes in the dropzone, so that I can verify what I'm sending at a glance.
7. As a sender, I want a single-click button to clear all selected files, so that I can quickly reset my payload if I made a mistake.
8. As a user sharing a transfer secret, I want the codephrase, copy button, and QR code trigger grouped into a single horizontal bar, so that sharing is seamless on desktop and mobile.
9. As a sender, I want to quickly pick a saved peer device from an inline selector, so that I don't have to scroll past 4 separate rows of preset chips.
10. As a user during an active transfer, I want to see a calm primary progress bar showing completion percentage, speed, and ETA, so that I am not overwhelmed by confusing low-level metrics.
11. As a technical evaluator, I want an expandable "Live Stream Stats" drawer during dual-relay transfers, so that I can inspect Alpha vs. Beta chunk distribution and failover events when needed.
12. As a tester simulating failover, I want a simple "Simulate Failover" button with an icon, so that I can test relay disconnects without wading through verbose button explanations.
13. As a receiver entering a codephrase, I want an auto-formatting input that accepts hyphenated codes and pastes cleanly, so that receiving files is effortless.
14. As a receiver downloading a folder, I want a clean interactive directory tree view with file size badges, so that I can inspect folder hierarchy without visual clutter.
15. As a Vietnamese-speaking user, I want all polished buttons and tooltips to render natural, concise Vietnamese text, so that the localized UI feels native and professional.
16. As an English-speaking user, I want all polished buttons and tooltips to render crisp, concise English text, so that the international interface is clear and elegant.
17. As a mobile user, I want touch targets to maintain a minimum 44px hit area while keeping text labels brief, so that tapping is effortless on touchscreen devices.
18. As a desktop user, I want keyboard shortcuts (e.g., Enter to send/receive, Esc to cancel/close popovers), so that transfers can be driven quickly without touching the mouse.

## Implementation Decisions

1. **Button Economy Rule**:
   - Every `<button>` component across SendView, ReceiveView, RelaysView, and HistoryGroupView must adhere to a strict 1-3 word visible label.
   - Secondary explanations previously baked into button children are converted into either:
     - An accessible `title` / tooltip attribute or floating popover.
     - A subtle helper caption positioned beneath the control group.
2. **Compact Segmented Mode Selector**:
   - Replace the two full-width button cards with an accessible `Role="tablist"` segmented pill container (`bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl`).
   - Labels: `Standard (Croc v11)` and `Turbo (Dual-Relay)`.
   - Include an inline popover trigger with an Info icon (`h-4 w-4`) displaying the technical trade-offs (single-thread CLI interop vs. multiplexed LAN/Web speed).
3. **Unified File/Folder Dropzone**:
   - Replace fragmented upload buttons with a unified drop area with a dashed border (`border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 rounded-2xl`).
   - Supports dragging files or directories directly onto the canvas.
   - Clean secondary link buttons inside the dropzone: "Browse files" / "Browse folder".
   - Shows badge list of selected files with total size and an "X" remove icon per file or "Clear all".
4. **Consolidated Transfer Target Bar**:
   - Place Codephrase, Generate New, Copy, and QR Code in a single flex/grid row.
   - Peer preset selector integrated as a clean compact combobox / chip bar with avatar icon.
5. **Calm Telemetry with Progressive Disclosure**:
   - Default view: Smooth gradient progress bar (`bg-emerald-500` or accent color), large tabular font percentage (e.g. `68%`), current speed (`14.2 MB/s`), and ETA (`12s`).
   - Secondary technical drawer: Accordion/collapsible button labeled "Stream Stats" / "Chi tiết luồng" displaying Alpha/Beta chunk distribution, RTT latency, and failover status.
6. **Design System & Palette Refinement**:
   - Shift from generic slate-teal to a modern zinc-neutral palette with high contrast and subtle borders.
   - Dark mode: `bg-zinc-950`, surfaces `bg-zinc-900`, borders `border-zinc-800`.
   - Light mode: `bg-zinc-50`, surfaces `bg-white`, borders `border-zinc-200`.
   - Accent: Focused emerald/mint green for active transfer states and connection indicators.
7. **i18n Dictionary Alignment**:
   - Streamline `src/lib/i18n.ts` dictionary values to short, punchy verbs for all `send.*`, `receive.*`, `relays.*`, and `history.*` button keys.

## Testing Decisions

1. **What Makes a Good Test**:
   - Tests assert on observable user behavior and component outputs through public interfaces, never internal component state or private helper methods.
   - Tests must survive styling changes and refactoring.
2. **Modules to Test**:
   - `src/lib/i18n.test.ts`: Verify that dictionary keys match across `vi` and `en` and that action button phrases do not exceed word count thresholds.
   - Component rendering and interaction tests: Verify mode tab toggling, unified dropzone file handling, and codephrase copy/paste behavior.
3. **Prior Art**:
   - Existing 78 unit/integration tests running via `npm test` (`tsx --test`).

## Out of Scope

- Changes to the underlying Croc v11 wire protocol or PAKE cryptographic handshakes.
- Changes to the WebSocket bridge server architecture or local dual-relay multiplexing logic.
- Adding third-party CSS frameworks (stay within pure Tailwind CSS to avoid bundle bloat).

## Further Notes

- Maintains 100% wire-compatibility with the official `croc` CLI.
- All file links adhere to the file:// scheme convention.
