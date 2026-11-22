<div align="center">

# 🐊 CrocFlow

**Nền Tảng Truyền Tệp Mã Hóa Đầu Cuối Đa Nền Tảng Hiện Đại**  
*Tương thích 100% Wire-Protocol với `croc` v11 CLI · Truyền song song 2 Relay · Resume Chunk SHA-256*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![TypeScript: 5.8](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React: 19](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Tailwind CSS: v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com/)
[![PWA: Ready](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://web.dev/progressive-web-apps/)
[![Security: Zero--Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge-green.svg)](#bảo-mật--mật-mã-học)

[**Bản Tiếng Việt**](README_VI.md) · [**English Guide**](README.md) · [**Kịch Bản Demo Trực Tiếp**](docs/DEMO_GUIDE_VI.md) · [**Kiến Trúc Hệ Thống**](docs/ARCHITECTURE_VI.md) · [**Cẩm Nang Mạng Máy Tính**](docs/NETWORKING_GUIDE_VI.md)

</div>

---

## 📖 Giới Thiệu Tổng Quan

**CrocFlow** là ứng dụng truyền tệp bảo mật đa nền tảng mã nguồn mở, phục vụ giảng dạy, nghiên cứu bộ môn Mạng máy tính và sử dụng thực tế hàng ngày. Ứng dụng triển khai trọn vẹn bộ giao thức Croc v11 thuần **TypeScript** tương thích byte-for-byte với cụm Relay công cộng và công cụ dòng lệnh `croc` CLI gốc của Go, đồng thời mở rộng **Chế độ Nâng cao (Enhanced Mode)** đáp ứng các bài toán mạng phức tạp và đòi hỏi độ sẵn sàng cao.

### Điểm Vượt Trội Của CrocFlow:
- **Duy Nhất 1 Mã Nguồn (Single Codebase)**: Một mã nguồn React + TypeScript biên dịch đồng thời ra **Web PWA**, **Android APK** (qua Capacitor), và **Desktop** Windows/macOS/Linux (qua Electron).
- **Tương Thích Wire-Protocol Tuyệt Đối**: Truyền nhận tệp và văn bản an toàn hai chiều giữa trình duyệt web và cửa sổ dòng lệnh chạy `croc send` / `croc <codephrase>`.
- **Truyền Song Song 2 Relay (Dual-Relay)**: Chia tải các mảnh Chunk chẵn qua **Relay Alpha** và Chunk lẻ qua **Relay Beta**, tăng gấp đôi băng thông và chứng minh trực quan định tuyến đa đường.
- **Tự Động Chuyển Lỗi (Failover)**: Tự động điều phối các Chunk còn lại sang Relay còn sống khi một Relay gặp sự cố mạng mà không phải truyền lại từ đầu.
- **Folder Manifest SHA-256 & IndexedDB Resume**: Bảo toàn cấu trúc thư mục lồng nhau, chống leo thư mục (`../`), lưu cache các Chunk đã xác thực trong IndexedDB và tự động nhận diện tệp mới thêm vào thư mục khi kết nối lại.
- **Bảng Soi Giao Thức Trực Tiếp (Protocol Inspector)**: Trực quan hóa tiến trình bắt tay PAKE/ECDH, ma trận chunk chẵn/lẻ, đồ thị thông lượng và nhật ký chi tiết theo thời gian thực.
- **Hỗ Trợ Song Ngữ Toàn Diện (Tiếng Việt & English)**: Chuyển đổi ngôn ngữ tức thời giữa Tiếng Việt và Tiếng Anh với khả năng lưu giữ tùy chọn người dùng.

---

## 🏛 Sơ Đồ Kiến Trúc Hệ Thống

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Giao diện CrocFlow (React 19 + TypeScript)           │
│        [Gửi]    [Nhận]    [Relay & Mạng]    [Lịch sử/Nhóm]    [Docs]   │
│            │                              │                            │
│    (Chuẩn Croc v11)              (Nâng cao CrocFlow)                   │
│    src/protocol/croc/*           src/protocol/enhanced/*               │
│    PAKE v2 · AES-GCM · XXH64     ECDH · SHA-256 · IndexedDB · 2 Relay  │
└────────────┬──────────────────────────────┬────────────────────────────┘
             │ WebSocket /ws                │ WebSocket /ws-dual
             ▼                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Máy chủ Bridge Server Hợp Nhất (server.ts)                │
│  • /ws       ➔ Cầu nối TCP allowlist (chống SSRF) tới Relay Croc       │
│  • /ws-dual  ➔ Phòng Lab 2 Relay: Relay Alpha (Chẵn) & Beta (Lẻ)       │
│  • /api/*    ➔ Đo độ trễ RTT thực tế & bộ đếm lưu lượng trực tiếp      │
└────────────┬───────────────────────────────────────────────────────────┘
             │ Socket TCP Thuần (9009–9017)
             ▼
     Cụm Relay Croc Công Cộng (1.getcroc.com ... 4.getcroc.com)
             ↕ (Tương thích 100% Wire Protocol)
     Công cụ dòng lệnh croc CLI chính thức (Go) & getcroc.com
```

---

## 🚀 Khởi Động Nhanh (Phát Triển Cục Bộ)

### Yêu Cầu Cài Đặt
- **Node.js**: Phiên bản 20 LTS hoặc 22 LTS (Tải về: [nodejs.org](https://nodejs.org))
- **npm** hoặc **pnpm**

```bash
# 1. Sao chép mã nguồn kho chứa
git clone https://github.com/your-username/croc-gui-networkprogrammingcourse.git
cd croc-gui-networkprogrammingcourse

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Khởi chạy máy chủ phát triển
npm run dev
```

Mở trình duyệt truy cập **http://localhost:3000**. Các thiết bị di động trong cùng mạng Wi-Fi có thể truy cập qua `http://<dia-chi-ip-noi-bo>:3000`.

---

## 🧪 Kiểm Thử & Đảm Bảo Chất Lượng

Dự án sở hữu bộ kiểm thử tự động nghiêm ngặt kiểm tra tính tương thích giao thức, thuật toán mật mã, chống SSRF và cơ chế chịu lỗi đa relay:

```bash
# Kiểm tra kiểu dữ liệu TypeScript
npm run lint

# Chạy toàn bộ bài test tự động
npm test

# Build bản phát hành sản phẩm
npm run build
```

---

## 🔐 Bảo Mật & Mật Mã Học

Mọi tiến trình mã hóa và giải mã đều diễn ra 100% tại máy khách (client-side):

1. **Bắt tay PAKE v2 (NIST P-256)**: Các khóa công khai tạm thời được làm mờ với mã băm của mật mã Codephrase. Máy chủ Relay không thể đọc trộm hay thử mật mã ngoại tuyến.
2. **Dẫn xuất khóa HKDF-SHA-256**: Sinh khóa phiên đối xứng 256-bit độc lập cùng cặp thẻ xác thực hai chiều (`confirmA`, `confirmB`).
3. **Mã hóa xác thực AES-256-GCM**: Mỗi Chunk sử dụng một IV ngẫu nhiên 12-byte riêng biệt. Mọi hành vi can thiệp dữ liệu trên đường truyền đều lập tức bị phát hiện và hủy kết nối.
4. **Phòng vệ chống SSRF**: Bridge Server kiểm tra danh sách trắng máy chủ nghiêm ngặt, giới hạn dải cổng (9009–9017) và chặn đứng mọi dải IP nội bộ RFC 1918, loopback và metadata đám mây (`169.254.169.254`).
5. **Chống leo thư mục (Path Traversal)**: Toàn bộ đường dẫn tương đối trong Folder Manifest được chuẩn hóa qua `sanitizeRelativePath`, loại trừ chuỗi `..`, dấu `/` đầu dòng và ký tự ổ đĩa.

---

## 📱 Khả Năng Triển Khai Đa Nền Tảng

| Mục tiêu | Phương thức đóng gói | Chi tiết triển khai |
| :--- | :--- | :--- |
| **Web PWA** | `npm run build` | Cài đặt trực tiếp trên Chrome, Edge, Safari với bộ nhớ đệm Service Worker ngoại tuyến. |
| **Android APK** | `npx cap sync android` | Bộ bao Capacitor tích hợp bộ chọn tệp gốc và quét mã QR camera. |
| **Desktop App** | `packaging/desktop/` | Gói Electron độc lập tích hợp sẵn Bridge Server Node.js cục bộ chạy ngầm. |
| **CI/CD** | `.github/workflows/build-releases.yml` | Tự động kiểm thử, build PWA, Android APK và Desktop cài đặt qua GitHub Actions. |

---

## 📚 Mục Lục Tài Liệu Kỹ Thuật

Tài liệu kỹ thuật chi tiết song ngữ được lưu trữ trong thư mục `docs/`:

- [**Cẩm Nang Trình Diễn Trực Tiếp & Đánh Giá Kỹ Thuật (VI)**](docs/DEMO_GUIDE_VI.md) / [**(EN)**](docs/DEMO_GUIDE_EN.md) — Kịch bản 5 phút, lệnh kiểm thử và bộ câu hỏi vấn đáp chuyên sâu.
- [**Kiến Trúc Mã Nguồn & Thiết Kế Hệ Thống (VI)**](docs/ARCHITECTURE_VI.md) / [**(EN)**](docs/ARCHITECTURE_EN.md) — Sơ đồ luồng dữ liệu, ranh giới module và máy trạng thái.
- [**Cẩm Nang Kiến Thức Mạng Máy Tính (VI)**](docs/NETWORKING_GUIDE_VI.md) / [**(EN)**](docs/NETWORKING_GUIDE_EN.md) — Xuyên NAT, WebSockets vs. TCP, mật mã PAKE và cơ chế failover.
- [**Hướng Dẫn Cài Đặt, Triển Khai & Đóng Gói (VI)**](docs/SETUP_AND_DEPLOY_VI.md) / [**(EN)**](docs/SETUP_AND_DEPLOY_EN.md) — Hướng dẫn cài đặt, build Android APK và kiểm thử với croc CLI.
- [**Thuật Ngữ Dự Án (GLOSSARY.md)**](GLOSSARY.md) — Định nghĩa chuẩn mực các khái niệm nghiệp vụ.

---

## 📄 Giấy Phép

Dự án được phát hành theo giấy phép mã nguồn mở [MIT License](LICENSE).
