# Hướng Dẫn Cài Đặt, Triển Khai & Đóng Gói Đa Nền Tảng

> **Mục tiêu:** Chạy ứng dụng CrocFlow trên máy cá nhân trong 2 phút và hiểu rõ quy trình tự động đóng gói đa nền tảng (Web PWA, Android APK, Desktop).

---

## 1. Khởi Động Nhanh: Môi Trường Phát Triển Cục Bộ Trong 2 Phút

### Yêu Cầu Môi Trường
- **Node.js**: Phiên bản 20 LTS hoặc 22 LTS trở lên. Tải từ trang chủ: https://nodejs.org
- **Trình Quản Lý Gói**: `npm` (có sẵn khi cài Node.js) hoặc `pnpm`.

### Bước 1: Cài Đặt Các Gói Thư Viện
Mở cửa sổ dòng lệnh (Terminal) tại thư mục gốc của dự án:
```bash
npm install
```

### Bước 2: Khởi Chạy Máy Chủ Phát Triển
```bash
npm run dev
```
- Máy chủ tích hợp sẽ lắng nghe tại địa chỉ: **http://localhost:3000**.
- Lệnh này khởi động đồng thời cả Express backend, WebSocket bridge (`/ws` và `/ws-dual`) cùng bộ phát triển Vite HMR.
- **Truy cập từ điện thoại di động cùng mạng Wi-Fi**:
  Xem địa chỉ IP mạng nội bộ của máy tính (ví dụ: `192.168.1.15`), sau đó mở trình duyệt trên điện thoại truy cập: `http://192.168.1.15:3000`!

---

## 2. Kiểm Thử Tự Động & Đảm Bảo Chất Lượng Mã Nguồn

CrocFlow sở hữu bộ kiểm thử tự động toàn diện kiểm tra wire-protocol, bắt tay mật mã, danh sách trắng chống SSRF, bộ lập lịch 2 relay và đóng gói tệp ZIP:

```bash
# 1. Kiểm tra tĩnh kiểu dữ liệu TypeScript
npm run lint

# 2. Chạy toàn bộ bài test backend & frontend
npm test
```

### Kiểm Tra Bản Build Sản Phẩm (Production Build)
Biên dịch bản bundle tối ưu hóa:
```bash
npm run build
```
Toàn bộ mã nguồn biên dịch sẽ nằm trong thư mục `dist/`, được tối ưu hóa dung lượng (code-splitting, tree-shaking) và sẵn sàng cho PWA.

---

## 3. Các Hình Thức Đóng Gói & Triển Khai Ứng Dụng

### Cách 1: Ứng Dụng Web Tiến Bộ (PWA — Progressive Web App)
1. Mở `http://localhost:3000` (hoặc tên miền máy chủ triển khai) trên Chrome, Edge, Safari hoặc Firefox.
2. Nhấn nút **"Cài ứng dụng"** ở thanh điều hướng trên cùng (hoặc biểu tượng cài đặt trên thanh địa chỉ trình duyệt).
3. Ứng dụng sẽ xuất hiện như một phần mềm độc lập trên máy tính hoặc di động, hỗ trợ cache ngoại tuyến đầy đủ qua Service Worker.

---

### Cách 2: Ứng Dụng Di Động Android (.apk) Bằng Capacitor
CrocFlow sử dụng **Capacitor** (`capacitor.config.ts`) để đóng gói trực tiếp mã nguồn web thành ứng dụng Android gốc:
1. Đảm bảo bản build web đã được tạo:
   ```bash
   npm run build
   ```
2. Cài các gói Capacitor mà repo không khai báo làm dependency mặc định, rồi khởi tạo dự án Android (repo không lưu thư mục `android/`):
   ```bash
   npm install --no-save @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   ```
3. Cài transport Android native, rồi đồng bộ mã nguồn web:
   ```bash
   node scripts/prepare-android-native.mjs
   npx cap sync android
   ```
4. Mở trong Android Studio hoặc biên dịch bằng Gradle:
   ```bash
   cd android
   .\gradlew.bat assembleDebug   # Windows PowerShell
   # ./gradlew assembleDebug     # Linux/macOS
   ```
   Tệp APK tạo ra sẽ nằm tại: `android/app/build/outputs/apk/debug/app-debug.apk`.

#### Android kết nối trực tiếp tới Relay công cộng
APK có một transport TCP native của Android. Khi chọn hồ sơ **Croc Public Relays**, APK kết nối trực tiếp tới các Relay Croc chính thức, không cần Bridge Server CrocFlow hay nhập địa chỉ máy chủ. Các APK Android khác, Desktop và ứng dụng `croc` chính thức vẫn gặp nhau qua cùng Relay công cộng và giao thức Croc hiện tại.

Workflow APK trên GitHub Actions tự chạy script chuẩn bị này. Khi tự build, chạy script một lần sau `npx cap add android` và trước mỗi lần `npx cap sync android` có tạo lại dự án Android.

Ghi chú kỹ thuật:
- Transport native chỉ được đóng gói vào APK Capacitor. Web/PWA và Electron Desktop tiếp tục dùng Bridge Server như trước.
- Chế độ Android trực tiếp dùng danh sách relay chính thức và TCP cổng `9009–9017`. Mạng chặn kết nối TCP đi ra các cổng này vẫn có thể làm truyền tệp thất bại; khi đó cần dùng mạng khác.
- **Local Dual-Relay Lab** và relay tùy chỉnh vẫn cần Bridge Server, chưa dùng được trong chế độ Android trực tiếp.
- `server.ts` vẫn được dùng cho Web, PWA, Desktop và các bản APK cũ.
- Native bridge Android chỉ cho phép kết nối tới bốn máy chủ Croc chính thức qua cổng `9009–9017`.

---

### Cách 3: Ứng Dụng Máy Tính Desktop (Windows .exe / macOS .dmg / Linux .AppImage)
Mã nguồn đóng gói Desktop nằm trong thư mục `packaging/desktop/` sử dụng **Electron**:
1. Khi mở ứng dụng Desktop, Electron tự động chạy ngầm một Bridge Server Node.js cục bộ trên cổng loopback nội bộ.
2. Để chạy thử bản Desktop trên máy:
   ```bash
   npm run build
   cd packaging/desktop
   npm install
   npm start
   ```
3. Đóng gói ra bộ cài đặt hoàn chỉnh:
   ```bash
   npx electron-builder --win --mac --linux
   ```

---

### Cách 4: Tự Động Đóng Gói Hoàn Toàn Bằng GitHub Actions (Zero Setup)
Bạn không cần phải cài Android Studio hay Xcode nặng hàng chục GB trên máy cá nhân!
Dự án đã thiết lập sẵn quy trình CI/CD hoàn chỉnh trong `.github/workflows/build-releases.yml`:

1. Đẩy mã nguồn lên kho chứa GitHub:
   ```bash
   git add .
   git commit -m "feat: complete overhaul of ui, docs, and i18n"
   git push origin main
   ```
2. Truy cập kho chứa trên GitHub, chọn tab **Actions**.
3. Chọn quy trình **"Build CrocFlow Releases"**.
4. Máy chủ đám mây của GitHub sẽ tự động:
   - Chạy toàn bộ bài test và kiểm tra TypeScript.
   - Build bản Web PWA.
   - Biên dịch tệp Android APK (`CrocFlow-Android-APK`).
   - Biên dịch bộ cài đặt Desktop: Windows `.exe`, macOS `.dmg` và Linux `.AppImage`.
5. Tải trực tiếp các tệp cài đặt tại mục **Artifacts** ở cuối trang chạy Actions!

---

## 4. Kiểm Thử Tương Thích Hai Chiều Với `croc` CLI Chính Thức

Để chứng minh tính tương thích 100% với phiên bản Go gốc của `croc`:

### 1. Cài Đặt `croc` CLI
- **Windows**: `winget install schollz.croc` hoặc `scoop install croc`
- **macOS**: `brew install croc`
- **Linux**: `curl https://getcroc.schollz.com | bash`

### 2. Chiều Truyền: CrocFlow Web ➔ `croc` CLI
1. Trên CrocFlow, mở mục **Gửi** ➔ **Chuẩn Croc v11**.
2. Chọn tệp hoặc nhập văn bản, bấm **"Bắt đầu gửi mã hóa"**.
3. Ghi nhận mã bí mật (ví dụ: `4281-croc-flow-demo`).
4. Trên cửa sổ Terminal, chạy lệnh:
   ```bash
   croc 4281-croc-flow-demo
   ```
5. Xác nhận tải về. Quan sát tệp được nhận và giải mã chính xác 100%.

### 3. Chiều Truyền: `croc` CLI ➔ CrocFlow Web
1. Trên Terminal, gửi tệp bất kỳ:
   ```bash
   croc send tailieu.pdf
   ```
   Terminal sẽ in ra mã Codephrase.
2. Trên CrocFlow, mở mục **Nhận** ➔ **Chuẩn Croc v11**.
3. Dán mã Codephrase và bấm **"Kết nối & Nhận"**.
4. Xác nhận nhận tệp và tải xuống máy thành công.
