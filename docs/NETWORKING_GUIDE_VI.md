# Cẩm Nang Kiến Thức Mạng Máy Tính Từ Con Số 0 (Dành Cho Nhóm Phát Triển CrocFlow)

Tài liệu này giải thích từng khái niệm mạng máy tính đằng sau **CrocFlow** bằng tiếng Việt dễ hiểu, giúp thành viên mới chưa có nền tảng lập trình mạng vẫn nắm chắc bản chất và trả lời tự tin trước giảng viên.

---

## 1. Tại sao hai máy tính không thể "nhìn thấy nhau" trực tiếp trên Internet? (NAT & Tường lửa)

Khi bạn kết nối Wi-Fi ở trường hoặc ở nhà:
- Router Wi-Fi cấp cho điện thoại và laptop của bạn các địa chỉ **IP nội bộ (Private IP)** như `192.168.1.5` hay `10.0.0.12`.
- Toàn bộ mạng Wi-Fi chia sẻ chung một **IP công cộng (Public IP)** thông qua cơ chế **NAT (Network Address Translation)**.
- Nếu bạn ở ký túc xá muốn gửi tệp sang máy giảng viên đang dùng 4G, máy bạn không thể tự mở kết nối TCP trực tiếp tới `192.168.1.5` của thầy vì tường lửa NAT sẽ chặn mọi kết nối lạ đi vào.

### Giải pháp của Croc & CrocFlow: Relay Server
- Cả **Máy Gửi (Sender)** và **Máy Nhận (Receiver)** đều chủ động mở kết nối **đi ra (outbound)** tới cùng một **Relay Server** có IP công cộng (luôn được tường lửa cho phép).
- Hai máy báo cùng một tên **Phòng (Room)** được dẫn xuất từ mã bí mật (`Codephrase`).
- Relay Server ghép cặp 2 kết nối cùng phòng và làm "ống dẫn" chuyển tiếp byte qua lại.

---

## 2. Tại sao trình duyệt Web / App PWA cần Bridge Server (`/ws`)?

- **Trình duyệt Web** vì lý do bảo mật không cho phép JavaScript mở kết nối **TCP thuần (Raw TCP Socket)** trực tiếp tới cổng `9009` của `croc relay`. Trình duyệt chỉ được phép mở **HTTP** và **WebSocket (`ws://` / `wss://`)**.
- Vì vậy, CrocFlow chạy kèm một **Bridge Server** gọn nhẹ (`server.ts`):
  1. Trình duyệt mở WebSocket tới `/ws?relay=<index>&port=<port>`.
  2. Bridge Server kiểm tra **Danh sách trắng (Allowlist)** trong `server/bridge-allowlist.ts` — chỉ cho phép nối tới đúng cụm Croc Relay chính thức và đúng dải cổng `9009–9013`, đồng thời **chặn toàn bộ IP nội bộ (RFC1918, loopback, cloud metadata)** để chống lỗ hổng **SSRF**.
  3. Sau khi vượt kiểm tra, Bridge Server nối ống hai chiều giữa WebSocket và TCP Socket tới Croc Relay.
  4. Nhờ đó, **CrocFlow tương thích 100% ở mức byte** với công cụ dòng lệnh `croc` CLI và `getcroc.com`.

---

## 3. Mã hóa Đầu Cuối Zero-Knowledge (PAKE + HKDF + AES-256-GCM)

Câu hỏi giảng viên hay hỏi nhất: *"Đi qua Relay trung gian như vậy thì chủ Relay có đọc trộm được tệp của sinh viên không?"*

**Câu trả lời là KHÔNG**, nhờ 3 tầng mật mã chạy hoàn toàn trên máy người dùng:

1. **PAKE / ECDH trên đường cong Elliptic P-256:**
   - Hai máy trao đổi khóa công khai tạm thời (ephemeral key) và kết hợp với **Codephrase** bí mật (`src/protocol/croc/pake.ts` cho Chuẩn v11 và `src/protocol/enhanced/enhanced-client.ts` cho Chế độ Nâng cao).
   - **Codephrase KHÔNG BAO GIỜ được gửi nguyên văn qua mạng.**
2. **HKDF-SHA-256 (Key Derivation Function):**
   - Từ bí mật chung sau PAKE/ECDH + muối ngẫu nhiên (`salt`), cả hai máy độc lập dẫn xuất ra:
     - Khóa mã hóa phiên **256-bit** cho AES-GCM.
     - Hai thẻ xác nhận 2 chiều (`confirmA`, `confirmB`) để chắc chắn cả hai bên đều gõ đúng cùng một Codephrase trước khi gửi bất kỳ thông tin tệp nào.
3. **AES-256-GCM (Authenticated Encryption):**
   - Mọi tên tệp, Folder Manifest, văn bản và từng mảnh Chunk đều bị mã hóa bằng AES-256-GCM kèm vector khởi tạo (IV 12 byte) ngẫu nhiên cho từng gói.
   - GCM vừa **mã hóa (bảo mật)** vừa gắn **thẻ xác thực (chống sửa đổi gói tin trên đường truyền)**.

---

## 4. Cắt mảnh Chunk, Folder Manifest SHA-256 & IndexedDB Resume Cache

Trong truyền tệp truyền thống, nếu gửi một thư mục 500 MB và rớt mạng ở 90%, bạn phải gửi lại từ đầu.

**CrocFlow Chế độ Nâng cao giải quyết triệt để bằng:**
- **Folder Manifest (`src/protocol/enhanced/manifest.ts`):** Trước khi truyền, máy gửi liệt kê toàn bộ cấu trúc đường dẫn tương đối (được làm sạch bởi `sanitizeRelativePath` để chặn tấn công leo thư mục `../`), cắt mỗi tệp thành các **Chunk** (16 KB / 64 KB / 256 KB) và tính mã băm **SHA-256** cho từng Chunk và từng tệp.
- **Resume Cache (`src/protocol/enhanced/resume-cache.ts`):** Mỗi khi máy nhận giải mã một Chunk và thấy mã băm SHA-256 khớp 100%, Chunk đó được lưu ngay vào cơ sở dữ liệu cục bộ **IndexedDB** của trình duyệt/app.
- **Khôi phục thông minh & phát hiện tệp mới (`computeResumePlan`):** Khi mạng có lại (kể cả khi người gửi vừa bỏ thêm tệp mới vào thư mục), máy nhận đối chiếu Manifest mới với IndexedDB, đánh dấu các Chunk đã có là `Resume Cache` (bỏ qua không tải lại) và chỉ yêu cầu gửi các Chunk còn thiếu hoặc thuộc tệp mới.

---

## 5. Truyền song song qua 2 Relay (Dual-Relay) & Tự động Failover

Đây là yêu cầu mạng trọng tâm nâng cao:
- Thay vì đẩy 100% lưu lượng qua 1 đường ống duy nhất, CrocFlow mở **2 kênh WebSocket độc lập** tới **Relay Alpha** và **Relay Beta** (`server/local-dual-relay.ts`).
- Bộ lập lịch `DualRelayScheduler` (`src/protocol/enhanced/dual-relay-scheduler.ts`) phân luồng theo chỉ số Chunk:
  - **Chunk chẵn (`0, 2, 4, 6...`)** → đi qua **Relay Alpha**.
  - **Chunk lẻ (`1, 3, 5, 7...`)** → đi qua **Relay Beta**.
- **Chịu lỗi tự động (Automatic Failover):**
  - Nếu giữa phiên truyền Relay Alpha bị ngắt (hoặc bạn bấm nút **"Mô phỏng ngắt Relay Alpha (Failover)"** để trình diễn cho giảng viên), `DualRelayScheduler.triggerAlphaFailover()` ngay lập tức chuyển toàn bộ các Chunk chẵn đang chờ hoặc đang bay sang hàng đợi của **Relay Beta**.
  - Máy nhận tự động khử trùng lặp (deduplicate), kiểm tra SHA-256 từng Chunk, ghép đủ file gốc 100% không sai một bit.

---

## 6. Passphrase Nhóm Xoay Vòng Hàng Tháng (`YYYY-MM`)

- Module `src/lib/group-passphrase.ts` cho phép nhóm đồ án thống nhất duy nhất một khóa gốc chung (`secretSeed`).
- Mỗi tháng, thuật toán `HKDF-SHA-256(secretSeed, "YYYY-MM")` tự động dẫn xuất ra một **Codephrase 3 từ chuẩn EFF** hoàn toàn mới nhưng **giống hệt nhau trên mọi máy của các thành viên trong nhóm** — vừa tiện lợi vừa giới hạn thời gian hiệu lực khóa theo tháng.
