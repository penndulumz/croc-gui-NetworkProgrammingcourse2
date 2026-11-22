# Hướng Dẫn Cài Đặt, Chạy Thử & Tải File Cài Đặt Cho Người Mới (Zero-to-Hero)

Hướng dẫn này viết dành riêng cho người **chưa từng deploy hay build app bao giờ**, đồng thời giúp **giảng viên** tải và trải nghiệm CrocFlow nhanh nhất mà không gặp rắc rối kỹ thuật.

---

## Cách 1: Trải nghiệm ngay lập tức qua Trình duyệt / Cài App PWA (Khuyên dùng cho Giảng viên)

1. Mở đường link ứng dụng CrocFlow trên trình duyệt **Chrome / Edge** (trên máy tính hoặc điện thoại Android) hoặc **Safari** (trên iPhone/iPad).
2. Nhấn nút **"Cài App"** ở góc trên bên phải (hoặc mở tab **Tải App & Tài liệu → Cài ứng dụng (PWA)**).
3. Ứng dụng sẽ xuất hiện ngoài màn hình chính với biểu tượng CrocFlow, chạy toàn màn hình không cần thanh địa chỉ trình duyệt và vẫn mở được Lịch sử, Tài liệu, Resume Cache khi mất mạng.

---

## Cách 2: Chạy trực tiếp trên máy tính cá nhân (Windows / macOS / Linux)

### Bước 1: Cài Node.js (chỉ làm 1 lần duy nhất)
- Tải và cài **Node.js 22 LTS** từ trang chủ: https://nodejs.org (bấm Next liên tục là xong).

### Bước 2: Mở Terminal tại thư mục dự án và chạy 2 lệnh
```bash
npm install
npm run dev
```
- Khi thấy dòng báo máy chủ đã chạy ở cổng `3000`, mở trình duyệt truy cập: **http://localhost:3000**
- Để cho điện thoại Android cùng mạng Wi-Fi truy cập vào máy tính của bạn: xem địa chỉ IP nội bộ của laptop (ví dụ `192.168.1.15`) rồi mở `http://192.168.1.15:3000` trên Android!

### Bước 3: Chạy bộ kiểm thử tự động để chứng minh mã nguồn ổn định
```bash
npm run lint
npx tsx --test \
  server/bridge-allowlist.test.ts \
  server/server.test.ts \
  server/local-dual-relay.test.ts \
  src/lib/theme.test.ts \
  src/lib/group-passphrase.test.ts \
  src/protocol/croc/codephrase.test.ts \
  src/protocol/enhanced/manifest.test.ts \
  src/protocol/enhanced/dual-relay-scheduler.test.ts \
  src/protocol/enhanced/enhanced-transfer.test.ts
```

---

## Cách 3: Tự động build file Android `.apk` và Desktop `.exe` / `.dmg` / `.AppImage` bằng GitHub Actions (Không cần cài Android Studio!)

Vì cài Android Studio / Xcode trên máy cá nhân rất nặng và hay lỗi môi trường, dự án đã cấu hình sẵn **GitHub Actions** trong `.github/workflows/build-releases.yml`.

### Các bước thực hiện (chỉ mất 3 phút):
1. Tạo một repository mới trên GitHub (ví dụ `crocflow-app`).
2. Đẩy toàn bộ mã nguồn dự án này lên nhánh `main`:
   ```bash
   git init
   git add .
   git commit -m "Initial CrocFlow cross-platform release"
   git branch -M main
   git remote add origin https://github.com/<ten-tai-khoan>/crocflow-app.git
   git push -u origin main
   ```
3. Mở trang GitHub của bạn → chọn tab **Actions** → chọn workflow **"Build CrocFlow Releases (Android APK & Desktop)"**.
4. Chờ khoảng 4–6 phút để máy chủ miễn phí của GitHub tự động:
   - Chạy toàn bộ unit/integration test và build bản Web PWA.
   - Build file cài đặt Android: **`CrocFlow-Android-APK`** (`app-debug.apk`).
   - Build bộ cài Desktop: **`CrocFlow-Windows-Installer`** (`.exe`), **`CrocFlow-macOS-DMG`** (`.dmg`), **`CrocFlow-Linux-AppImage`** (`.AppImage`).
5. Kéo xuống cuối trang workflow ở mục **Artifacts** để tải file về gửi cho giảng viên hoặc cài trực tiếp lên điện thoại Android!

---

## Cách 4: Kết nối thử với `croc` CLI chính thức

1. Cài `croc` CLI trên máy tính (xem https://github.com/schollz/croc):
   - Windows: `winget install schollz.croc` hoặc `scoop install croc`
   - macOS: `brew install croc`
   - Linux: `curl https://getcroc.schollz.com | bash`
2. **Thử chiều CrocFlow → CLI:**
   - Trên CrocFlow mở mục **Gửi → Chuẩn Croc v11**, chọn tệp và nhấn **Bắt đầu gửi mã hóa**.
   - Sao chép lệnh `croc <codephrase>` và dán vào Terminal máy tính → tệp sẽ được tải xuống và giải mã thành công.
3. **Thử chiều CLI → CrocFlow:**
   - Trên Terminal chạy: `croc send ten-tep.pdf` → terminal in ra mã bí mật.
   - Trên CrocFlow mở mục **Nhận → Chuẩn Croc v11**, dán mã bí mật đó và nhấn **Kết nối & Nhận** → xác nhận tệp để tải về.
