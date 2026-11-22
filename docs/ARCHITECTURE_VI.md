# Kiến Trúc Mã Nguồn CrocFlow (Dành Cho Thành Viên Nhóm & Vấn Đáp Giảng Viên)

Tài liệu này mô tả cấu trúc dự án để bất kỳ thành viên nào cũng có thể chỉ chính xác vị trí từng tính năng khi giảng viên mở mã nguồn hỏi trực tiếp.

---

## 1. Triết lý "1 Codebase — Đa Nền Tảng"

Thay vì phải viết 3 ứng dụng riêng rẽ bằng Java/Kotlin (Android), Go/Fyne (Desktop — vốn là lý do giao diện `third-party/crocgui` cũ kém trực quan) và React (Web), CrocFlow sử dụng **duy nhất 1 mã nguồn React + TypeScript + Tailwind CSS**:
- **Web App / PWA cài đặt được:** Build bởi Vite + `vite-plugin-pwa` (có Service Worker cache tài sản ngoại tuyến và nút cài app ngay trong giao diện).
- **Android APK:** Đóng gói trực tiếp thư mục `dist/` bằng **Capacitor** (`capacitor.config.ts`).
- **Desktop App (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`):** Đóng gói bởi **Electron** (`packaging/desktop/`), tự khởi chạy ngầm **Embedded Node Bridge Server** ở cổng cục bộ nên mở app lên là sử dụng được ngay.

---

## 2. Sơ Đồ Luồng Dữ Liệu Tổng Thể

```
┌──────────────────────────────────────────────────────────────────────┐
│            Giao diện CrocFlow (React + TS · Light/Dark)             │
│  [Gửi]  [Nhận]  [Relay & Mạng]  [Lịch sử & Nhóm]  [Tải App & Docs]  │
│              │                              │                        │
│     (Chế độ Chuẩn v11)             (Chế độ Nâng cao)                 │
│   src/protocol/croc/*           src/protocol/enhanced/*              │
│   PAKE v2 · AES-GCM · XXH64     ECDH · SHA-256 · IndexedDB · 2 Relay │
└──────────────┼──────────────────────────────┼────────────────────────┘
               │ WebSocket /ws                │ WebSocket /ws-dual
               ▼                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│           Unified Bridge & Dual-Relay Server (server.ts)             │
│  • /ws       → Cầu nối TCP allowlisted (chặn SSRF) tới Croc Public  │
│  • /ws-dual  → Local Dual-Relay Lab: Relay Alpha (Chẵn) & Beta (Lẻ) │
│  • /api/relays/ping & /status → Đo độ trễ RTT (ms) & đếm byte thật  │
└──────────────┬───────────────────────────────────────────────────────┘
               │ Raw TCP (9009–9013)
               ▼
   Cụm Croc Relay Công Cộng (1.getcroc.com ... 4.getcroc.com)
               ↕ (100% tương thích)
       croc CLI (Windows/macOS/Linux) & getcroc.com
```

---

## 3. Bản Đồ Các File Quan Trọng

### Phần Máy Chủ (Backend Bridge & Dual-Relay)
| Đường dẫn | Vai trò chính |
| :--- | :--- |
| `server.ts` | Điểm khởi chạy Express + WebSocket + Vite Dev Middleware trên cổng `3000`. |
| `server/bridge-allowlist.ts` | Kiểm tra bảo mật danh sách trắng host/port cho `/ws`, chặn IP nội bộ (chống SSRF). |
| `server/local-dual-relay.ts` | Triển khai cặp phòng Relay Alpha và Relay Beta độc lập, cô lập phòng theo `room`, đếm byte và frame chuyển tiếp thật. |

### Phần Lõi Giao Thức (Protocol Engines)
| Đường dẫn | Vai trò chính |
| :--- | :--- |
| `src/protocol/croc/*` | Bộ giao thức **Croc v11** thuần TypeScript (PAKE P-256, XXH64, nén, đóng khung nhị phân) tương thích `croc` CLI gốc. |
| `src/protocol/event-bus.ts` | Kênh sự kiện trực tiếp (`protocolEventBus`) phát mốc PAKE, trạng thái từng Chunk, thông lượng và log thật tới Bảng soi giao thức. |
| `src/protocol/enhanced/manifest.ts` | Tạo Folder Manifest, chống leo thư mục (`sanitizeRelativePath`), băm SHA-256 từng Chunk và lập kế hoạch khôi phục (`computeResumePlan`). |
| `src/protocol/enhanced/dual-relay-scheduler.ts` | Bộ lập lịch chia tải Chunk Chẵn → Alpha, Chunk Lẻ → Beta và xử lý `triggerAlphaFailover()`. |
| `src/protocol/enhanced/resume-cache.ts` | Lưu/đọc/xóa các Chunk đã xác thực SHA-256 trong IndexedDB (`crocflow-resume-db`). |
| `src/protocol/enhanced/enhanced-client.ts` | Engine truyền nhận E2E hoàn chỉnh trên `/ws-dual`, bao gồm cả 2 kịch bản Demo 1-click dùng WebSocket thật. |

### Phần Giao Diện & Tiện Ích Người Dùng
| Đường dẫn | Vai trò chính |
| :--- | :--- |
| `src/components/AppShell.tsx` | Khung ứng dụng responsive kiểu LocalSend (Sidebar Desktop + Bottom Bar 5 tab Mobile + đổi Dark/Light mode). |
| `src/components/SendView.tsx` | Màn hình Gửi (Chuẩn Croc v11 File/Text + Nâng cao Thư mục/2 Relay/Failover + QR Code + Demo 1-click). |
| `src/components/ReceiveView.tsx` | Màn hình Nhận (tự điền `?code=`, xem trước Offer/Manifest, xem văn bản an toàn, quản lý IndexedDB Resume Cache). |
| `src/components/ProtocolInspector.tsx` | Bảng soi giao thức trực tiếp (Timeline PAKE 5 bước, lưới Chunk, biểu đồ tốc độ, xuất log `.md`). |
| `src/components/RelaysView.tsx` | Quản lý Relay, đo Ping RTT trực tiếp, xếp hạng độ trễ và cấu hình Relay tự dựng. |
| `src/components/HistoryGroupView.tsx` | Đổi tên thiết bị (`Device Alias`), Passphrase nhóm xoay vòng theo tháng (`HKDF-SHA-256`) và Lịch sử truyền có tìm kiếm/lọc. |
| `src/components/AppDocsHubView.tsx` | Trung tâm cài đặt PWA/APK/Desktop, tài liệu học thuật tích hợp và xuất Báo Cáo Học Thuật `.md`. |

### Đóng Gói Đa Nền Tảng & CI/CD
| Đường dẫn | Vai trò chính |
| :--- | :--- |
| `capacitor.config.ts` | Cấu hình đóng gói Android APK (`app.crocflow.mobile`). |
| `packaging/desktop/*` | Trình bao Electron tự khởi chạy Bridge Server cục bộ cho Windows/macOS/Linux. |
| `.github/workflows/build-releases.yml` | Quy trình GitHub Actions tự động chạy toàn bộ bài test, build PWA, build Android `.apk` và Desktop `.exe`/`.dmg`/`.AppImage`. |

---

## 4. Bộ Kiểm Thử Tự Động (Automated Tests)

Mọi thuật toán cốt lõi đều tách rời khỏi giao diện và có bài kiểm thử tự động chạy bằng `npx tsx --test`:
- `server/bridge-allowlist.test.ts` — Xác minh chặn SSRF & allowlist cổng.
- `server/server.test.ts` — Kiểm tra `/healthz`, `/config.js`, `/api/relays/status`, và từ chối cổng cấm trên `/ws`.
- `server/local-dual-relay.test.ts` — Kiểm tra ghép cặp Alpha/Beta, cô lập phòng và ping.
- `src/protocol/croc/codephrase.test.ts` — Kiểm tra bộ từ điển 1296 từ EFF và tính chỉ số relay chuẩn Croc v11.
- `src/protocol/enhanced/manifest.test.ts` — Kiểm tra chống Path Traversal, băm SHA-256 và Resume khi có tệp mới.
- `src/protocol/enhanced/dual-relay-scheduler.test.ts` — Kiểm tra chia tải Chẵn/Lẻ và Failover sang Beta.
- `src/protocol/enhanced/enhanced-transfer.test.ts` — Kiểm thử WebSocket đầu-cuối thật cho cả Dual-Relay Failover và Folder Resume.
- `src/lib/group-passphrase.test.ts` & `src/lib/theme.test.ts` — Kiểm tra xoay vòng khóa hàng tháng và lưu giao diện Sáng/Tối.
