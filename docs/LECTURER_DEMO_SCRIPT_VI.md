# Kịch Bản Trình Diễn 5 Phút & Bộ Câu Hỏi Vấn Đáp Giảng Viên

Tài liệu này là "phao cứu sinh" để nhóm bạn trình bày mạch lạc trong đúng 5 phút và trả lời gãy gọn các câu hỏi xoáy của giảng viên môn Lập Trình Mạng.

---

## 1. Kịch Bản Trình Diễn Trực Tiếp (5 Phút)

### Phút 0:00 – 1:00 | Giới thiệu bài toán & Tương thích 100% hệ sinh thái Croc
- **Mở màn hình Gửi (CrocFlow):** Giới thiệu giao diện hiện đại (bật chuyển đổi **Sáng / Tối** và thu hẹp trình duyệt để cho thấy bố cục di động Android sạch đẹp, khắc phục hoàn toàn giao diện cũ của `crocgui`).
- **Chuyển sang chế độ `Chuẩn Croc v11`:** Chọn 1 tệp hoặc nhập 1 đoạn văn bản, chỉ mã QR Code và lệnh `croc <codephrase>`. Nếu có sẵn terminal cài `croc`, nhận thử 1 tệp ngay tại chỗ để chứng minh tương thích 100% với CLI & `getcroc.com`.

### Phút 1:00 – 2:30 | Trọng tâm: Truyền song song 2 Relay (Chẵn/Lẻ) & Tự động Failover
- Chuyển sang chế độ **`Nâng cao CrocFlow (Thư mục · 2 Relay · Resume)`**.
- Nhấn nút **"Chạy Demo 2 Relay + Failover trực tiếp"** (chạy WebSocket thật qua `/ws-dual`, không phải giả lập tĩnh).
- Chỉ trực tiếp vào **Bảng soi giao thức** bên phải:
  1. **5 bước bắt tay mật mã** (Room Join → ECDH P-256 → HKDF-SHA-256 → Xác thực 2 chiều → Luồng AES-256-GCM) lần lượt hoàn tất.
  2. **Bản đồ Chunk** phân bổ song song: Chunk chẵn màu xanh ngọc (**Relay Alpha**), Chunk lẻ màu xanh dương (**Relay Beta**).
  3. Giữa phiên truyền (~45%), hệ thống chủ động **ngắt kết nối Relay Alpha** → các ô Chunk chẵn còn lại tự động đổi sang màu vàng (**Failover**) và được định tuyến qua **Relay Beta**, không phải truyền lại từ đầu.
  4. Cuối phiên, toàn bộ tệp ghép đủ và vượt qua kiểm tra chữ ký **SHA-256** 100%.

### Phút 2:30 – 3:30 | Gửi thư mục + Resume bằng Folder Manifest SHA-256 & Phát hiện tệp mới
- Nhấn nút **"Demo Đứt mạng & Thêm tệp Resume (IndexedDB)"**.
- Giải thích 2 giai đoạn diễn ra ngay trước mắt:
  - Giai đoạn 1: Nhận được 6 chunk đầu lưu vào **IndexedDB Resume Cache** thì bị ngắt mạng đột ngột.
  - Giai đoạn 2: Máy gửi **thêm 1 tệp mới** (`PhuLuc_MoiThemSauMatMang.bin`) vào thư mục rồi kết nối lại. Trên Bảng soi giao thức, 6 chunk đã tải chuyển màu tím (**Resume Cache — bỏ qua**), chỉ truyền đúng các chunk còn thiếu và tệp mới thêm.
- Chuyển nhanh sang tab **Nhận** để chỉ cho giảng viên khu vực **Bộ nhớ đệm Resume Cache (IndexedDB)** đang hiển thị số chunk thực đã lưu.

### Phút 3:30 – 4:30 | Đo độ trễ Relay RTT & Passphrase nhóm xoay vòng hàng tháng
- Mở tab **Relay & Mạng:** Nhấn **"Đo độ trễ (Ping RTT)"** → bảng tự đo độ trễ thật (`ms`) tới Local Alpha, Local Beta và 4 Relay Croc công cộng, tự xếp hạng từ nhanh nhất đến chậm nhất; chỉ vào bộ đếm byte/frame thật của Alpha & Beta vừa tăng sau buổi demo.
- Mở tab **Lịch sử & Nhóm:**
  - Cho thấy 2 phiên vừa demo đã tự lưu vào **Lịch sử phiên truyền**.
  - Tạo nhanh 1 **Passphrase nhóm xoay vòng hàng tháng** (ví dụ "Nhóm Đồ Án 04") → bấm **"Dùng để Gửi"** để thấy mã EFF tự điền sang màn hình Gửi.

### Phút 4:30 – 5:00 | Đóng gói Đa nền tảng & Xuất Báo Cáo Học Thuật
- Mở tab **Tải App & Tài liệu:**
  - Nhấn **"Xuất Báo Cáo Học Thuật (.md)"** để tải về file báo cáo có kèm sẵn nhật ký kiểm thử thật.
  - Giới thiệu nút **Cài đặt PWA** và workflow **GitHub Actions** tự build file `.apk` Android cùng `.exe`/`.dmg`/`.AppImage` Desktop.

---

## 2. Bộ Câu Hỏi Vấn Đáp Giảng Viên Thường Hỏi & Cách Trả Lời

### Câu 1: *"Làm sao em chứng minh Relay Server không đọc trộm được tệp của người dùng?"*
> **Trả lời:** Vì toàn bộ quá trình trao đổi khóa **PAKE / ECDH P-256**, dẫn xuất khóa **HKDF-SHA-256** và mã hóa **AES-256-GCM** diễn ra hoàn toàn ở phía trình duyệt/app khách (client-side). Mã bí mật Codephrase không bao giờ đi nguyên văn lên mạng; Relay Alpha và Relay Beta chỉ chuyển tiếp các khối bản mã (ciphertext) có IV 12-byte ngẫu nhiên. Nếu sửa chỉ 1 bit trên Relay, thẻ xác thực GCM và mã băm SHA-256 ở máy nhận sẽ lập tức báo lỗi và hủy gói.

### Câu 2: *"Khi chia chunk chẵn qua Relay Alpha và chunk lẻ qua Relay Beta, nếu Relay Alpha sập giữa chừng thì chuyện gì xảy ra?"*
> **Trả lời:** Trong `src/protocol/enhanced/dual-relay-scheduler.ts`, chúng em thiết kế máy trạng thái `DualRelayScheduler`. Ngay khi phát hiện kênh WebSocket của Alpha đóng (hoặc lỗi gửi frame), hàm `triggerAlphaFailover()` chuyển trạng thái toàn bộ các chunk chẵn chưa hoàn tất sang hàng đợi của Relay Beta. Ở máy nhận, bộ thu gom khử trùng lặp theo `globalIndex` và xác nhận hoàn tất phát rộng (broadcast) trên cả hai kênh nên phiên vẫn hoàn thành trọn vẹn không mất dữ liệu.

### Câu 3: *"Vì sao các em không dùng lại Go + Fyne của `crocgui` mà viết lại bằng React + TypeScript?"*
> **Trả lời:** Như đã ghi nhận trong quyết định kiến trúc `docs/adr/0001-unified-react-ts-codebase-over-fyne.md`, giao diện Fyne cũ thiếu linh hoạt trên màn hình cảm ứng di động và khó tích hợp bảng trực quan hóa giao thức thời gian thực. Bằng 1 mã nguồn React + TypeScript kết hợp lõi giao thức Croc v11 thuần TypeScript (không cần Go WASM), nhóm vừa có giao diện sắc nét Dark/Light đạt chuẩn di động, vừa đóng gói đồng thời ra Web PWA, Android APK (Capacitor) và Desktop (Electron) mà vẫn tương thích 100% với `croc` CLI gốc.

### Câu 4: *"Bridge Server `/ws` mở kết nối TCP giúp trình duyệt, vậy có rủi ro bị tin tặc lợi dụng quét cổng mạng nội bộ (SSRF) không?"*
> **Trả lời:** Chúng em đã phòng chống SSRF ngay tại `server/bridge-allowlist.ts`: endpoint `/ws` **không nhận tùy ý địa chỉ host từ người dùng** mà chỉ nhận chỉ số `relay` (0..3) ánh xạ tới danh sách trắng `relayHosts` cấu hình trên server, đồng thời kiểm tra cổng nằm trong tập cho phép (`9009–9013`) và lọc bỏ toàn bộ IP nội bộ RFC1918, loopback (`127.0.0.1`), và IP cloud metadata (`169.254.169.254`). Mọi yêu cầu vi phạm bị chặn ngay với HTTP `400`/`403` (đã có test tự động trong `server/server.test.ts`).

### Câu 5: *"Chế độ gửi thư mục có rủi ro bảo mật gì khi nhận đường dẫn lồng nhau không?"*
> **Trả lời:** Có rủi ro tấn công leo thư mục (Path Traversal như `../../etc/passwd` hoặc đường dẫn tuyệt đối `C:\...`). Em đã viết hàm `sanitizeRelativePath()` trong `src/protocol/enhanced/manifest.ts` chặn mọi đoạn `..`, đường dẫn bắt đầu bằng `/`, ký tự ổ đĩa Windows và ký tự điều khiển (đã kiểm thử tự động trong `manifest.test.ts`).
