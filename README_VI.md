# CrocFlow

[English](README.md) | [Tiếng Việt](README_VI.md)

CrocFlow là ứng dụng truyền tệp, thư mục và văn bản mã hóa đầu cuối đa nền tảng được xây dựng bằng TypeScript và React. Ứng dụng triển khai bộ giao thức Croc v11 tương thích với công cụ dòng lệnh Go `croc` CLI và `getcroc.com`, đồng thời cung cấp Chế độ Nâng cao hỗ trợ Bản Kê Thư Mục (Folder Manifest), Bộ Nhớ Đệm Khôi Phục (Resume Cache) theo từng Chunk bằng SHA-256 trong IndexedDB và Truyền Song Song 2 Relay kèm Chuyển Lỗi Tự Động (Failover) đối xứng.

## Các Chế Độ Truyền

| Thành phần | Chế Độ Chuẩn Croc v11 (Standard Mode) | Chế Độ Nâng Cao CrocFlow (Enhanced Mode) |
| :--- | :--- | :--- |
| Khả năng tương thích | `croc` v11 CLI chính thức và `getcroc.com` | Giữa các ứng dụng CrocFlow với nhau |
| Trao đổi khóa | PAKE v2 (SPAKE2 trên NIST P-256) + HKDF-SHA-256 | ECDH tạm thời (NIST P-256) gắn với Mã Bí Mật (Codephrase) qua HKDF-SHA-256 |
| Mã hóa dữ liệu | AES-256-GCM (IV 12-byte), nén DEFLATE thô | AES-256-GCM (IV ngẫu nhiên 12-byte cho mỗi thông điệp) |
| Kiểm tra toàn vẹn | Mã băm XXH64 toàn tệp | Mã băm SHA-256 từng Chunk và toàn tệp |
| Thư mục và khôi phục | Đóng gói tệp/thư mục theo khung Croc v11 | Folder Manifest chuẩn hóa đường dẫn và Resume Cache trên IndexedDB |
| Định tuyến Relay | Một Nút Chuyển Tiếp (Relay Node) chọn theo Codephrase | Một hoặc hai Relay (Chunk chẵn qua Relay Alpha, Chunk lẻ qua Relay Beta) kèm Failover |
| Chẩn đoán | Bảng Soi Giao Thức (bắt tay, tiến độ truyền) | Bảng Soi Giao Thức (bắt tay, lưới Chunk theo kênh, RTT đo thực tế, trạng thái Failover) |

## Kiến Trúc Hệ Thống

```text
+-------------------------------------------------------------------------+
|                Ứng Dụng CrocFlow (React 19 + TypeScript)                |
|  Chế độ Chuẩn:    src/protocol/croc/*                                   |
|  Chế độ Nâng cao: src/protocol/enhanced/* (Folder Manifest, Resume)     |
+--------------------+---------------------------------+------------------+
                     | WebSocket /ws                   | WebSocket /ws-dual
                     v                                 v
+-------------------------------------------------------------------------+
|                 Máy Chủ Cầu Nối Node.js (server.ts)                     |
|  /ws                  Cầu nối WebSocket-TCP theo allowlist (chống SSRF) |
|  /ws-dual             Phòng Lab 2 Relay cục bộ (Alpha & Beta)           |
|  /api/relays/status   Danh sách relay công cộng & bộ đếm Alpha/Beta     |
|  /api/relays/ping     Đo TCP RTT (công cộng) & đo vòng lặp (alpha/beta) |
|  /api/runtime-config  Cấu hình JSON runtime cho vỏ ứng dụng di động     |
|  /healthz             Điểm kiểm tra trạng thái dạng văn bản thuần       |
+--------------------+----------------------------------------------------+
                     | Socket TCP thuần (cổng 9009-9017)
                     v
+-------------------------------------------------------------------------+
|        Cụm Relay Croc Công Cộng (1.getcroc.com .. 4.getcroc.com)        |
|        Tương thích giao thức dây với Go croc CLI & getcroc.com          |
+-------------------------------------------------------------------------+
```

Cả hai chế độ truyền đều tuân theo Hồ Sơ Relay (Relay Profile) đang kích hoạt:

- **Public Croc Relays**: Kết nối qua điểm cuối `/ws` trên Máy Chủ Cầu Nối tới `1.getcroc.com`–`4.getcroc.com` qua các cổng TCP `9009–9017`. Ở Chế độ Nâng cao, Truyền Song Song 2 Relay ghép cặp chỉ số relay xác định `(alphaIdx, (alphaIdx + 1) % N)` thông qua `connectRelay` và định khung có tiền tố độ dài.
- **Local Dual-Relay Lab**: Định tuyến Chế độ Nâng cao qua `/ws-dual` vào các phòng tách biệt trong bộ nhớ (`alpha` và `beta`) do `LocalDualRelayNode` (`server/local-dual-relay.ts`) quản lý, phục vụ thử nghiệm Truyền Song Song 2 Relay và Failover trong mạng nội bộ bị chặn cổng hoặc ngoại tuyến.

## Cài Đặt, Build và Kiểm Thử

Yêu cầu môi trường: Node.js 20 LTS hoặc 22 LTS và npm.

```bash
git clone https://github.com/<org>/croc-gui-networkprogrammingcourse.git
cd croc-gui-networkprogrammingcourse
npm install
npm run dev
```

Lệnh `npm run dev` thực thi `tsx server.ts`, lắng nghe trên `0.0.0.0:3000` với Vite middleware. Truy cập `http://localhost:3000` trên máy cục bộ hoặc `http://<dia-chi-ip-lan>:3000` từ thiết bị khác trong cùng mạng LAN.

Các lệnh kiểm tra và đóng gói trong `package.json`:

```bash
npm run lint   # Kiểm tra kiểu TypeScript (tsc --noEmit)
npm test       # Chạy kiểm thử đơn vị và tích hợp (tsx --test "src/**/*.test.ts" "server/**/*.test.ts")
npm run build  # Biên dịch mã nguồn giao diện tĩnh ra dist/ (vite build)
npm start      # Chạy máy chủ production (NODE_ENV=production tsx server.ts)
```

## Bảo Mật và Mật Mã Học

Toàn bộ quá trình dẫn xuất khóa, mã hóa và giải mã chạy tại máy khách bằng Web Crypto (`crypto.subtle`) và `@noble/curves`:

- **Mật mã Chế độ Chuẩn**: Triển khai SPAKE2 (PAKE v2 trên đường cong NIST P-256 cho trao đổi khóa giữa hai máy; `siec` cho xác thực phòng trên relay), dẫn xuất khóa HKDF-SHA-256 theo RFC 5869 kèm thẻ xác nhận hai chiều (`confirmationA`, `confirmationB`), mã hóa AES-256-GCM với IV 12-byte và kiểm tra tổng băm XXH64.
- **Mật mã Chế độ Nâng cao**: Thực hiện trao đổi ECDH tạm thời (NIST P-256) kết hợp với Codephrase qua HKDF-SHA-256 (`confirmSender`, `confirmReceiver`), mã hóa từng Chunk và thông điệp điều khiển bằng AES-256-GCM với IV ngẫu nhiên 12-byte, đồng thời xác thực mã băm SHA-256 cho từng Chunk và toàn bộ tệp sau khi ghép.
- **Chống SSRF trên Máy Chủ Cầu Nối** (`server/bridge-allowlist.ts`): Điểm cuối `/ws` chỉ phân giải đích dựa trên chỉ số relay nguyên đã cấu hình và danh sách cổng cho phép (`9009–9017`). Các địa chỉ loopback, dải mạng riêng RFC 1918, CGNAT (`100.64.0.0/10`), dải IPv6 link-local/ULA và địa chỉ metadata đám mây (`169.254.169.254`) đều bị từ chối.
- **Chống leo thư mục** (`src/protocol/enhanced/manifest.ts`): Hàm `sanitizeRelativePath` chuẩn hóa dấu phân cách thư mục và loại bỏ `..`, đường dẫn tuyệt đối, ký tự ổ đĩa Windows cũng như ký tự điều khiển ASCII.

## Mục Tiêu Triển Khai

| Nền tảng | Lệnh / Thư mục | Chi tiết triển khai |
| :--- | :--- | :--- |
| **Web PWA** | `npm run build` | Bản build tĩnh tạo bởi Vite và `vite-plugin-pwa` (lưu đệm Workbox), được phục vụ qua `server.ts`. |
| **Android APK (Capacitor)** | `npx cap sync android` | Đóng gói giao diện trong Capacitor WebView và transport TCP native để kết nối trực tiếp tới Croc Relay công cộng. Hồ sơ Public không cần Bridge Server CrocFlow; Web/PWA và Desktop vẫn dùng Bridge Server. |
| **Desktop (Electron)** | `packaging/desktop/` | Đóng gói `server.ts` thành `server.mjs` (`npm run bundle:server`) cùng với `dist/`, chạy Máy Chủ Cầu Nối tích hợp trên loopback. Các mục tiêu đóng gói: `dist:win`, `dist:mac`, `dist:linux`. |
| **CI/CD** | `.github/workflows/build-releases.yml` | Tự động chạy `npm run lint`, bộ kiểm thử, `npm run build`, đóng gói Android debug APK bằng Capacitor và build ứng dụng Electron Desktop. |

## Danh Mục Tài Liệu

| Tài liệu | Nội dung |
| :--- | :--- |
| [Kiến Trúc Hệ Thống (VI)](docs/ARCHITECTURE_VI.md) / [(EN)](docs/ARCHITECTURE_EN.md) | Ranh giới module, luồng dữ liệu và máy trạng thái |
| [Cẩm Nang Mạng Máy Tính (VI)](docs/NETWORKING_GUIDE_VI.md) / [(EN)](docs/NETWORKING_GUIDE_EN.md) | Xuyên NAT, cầu nối WebSocket sang TCP, PAKE và Failover |
| [Hướng Dẫn Cài Đặt & Triển Khai (VI)](docs/SETUP_AND_DEPLOY_VI.md) / [(EN)](docs/SETUP_AND_DEPLOY_EN.md) | Môi trường phát triển cục bộ, đóng gói Android APK và kiểm thử `croc` CLI |
| [Hướng Dẫn Trình Diễn Trực Tiếp (VI)](docs/DEMO_GUIDE_VI.md) / [(EN)](docs/DEMO_GUIDE_EN.md) | Kịch bản trình diễn 5 phút và các tình huống kiểm chứng |
| [Tài Liệu Thuyết Trình & Học Tập Dual-Relay (VI)](docs/DUAL_RELAY_PRESENTATION_VI.md) | Phân tích chuyên sâu kiến trúc Dual-Relay, phân tích lỗi thực tế, kịch bản demo và Q&A |
| [Kịch Bản Demo Giảng Viên (VI)](docs/LECTURER_DEMO_SCRIPT_VI.md) | Kịch bản trình bày trực tiếp trên lớp |
| [Thuật Ngữ Dự Án](GLOSSARY.md) | Bảng thuật ngữ chuẩn hóa song ngữ Anh - Việt |

Hồ sơ quyết định kiến trúc (ADR):

- [ADR 0001: Chọn React + TypeScript hợp nhất thay cho Fyne](docs/adr/0001-unified-react-ts-codebase-over-fyne.md)
- [ADR 0002: Tách biệt Chế Độ Chuẩn và Chế Độ Nâng Cao](docs/adr/0002-dual-mode-interop-and-enhanced-protocol.md)
- [ADR 0003: Máy Chủ Cầu Nối Node.js hợp nhất và Phòng Lab 2 Relay cục bộ](docs/adr/0003-embedded-bridge-and-local-dual-relay.md)
- [ADR 0004: Truyền Tải Dual-Relay Theo Hồ Sơ Relay và Bắt Tay Ổn Định](docs/adr/0004-enhanced-dual-relay-transport-and-handshake.md)
- [ADR 0005: Kết Nối Android Trực Tiếp tới Croc Relay Công Cộng](docs/adr/0005-android-direct-public-relay-transport.md)
