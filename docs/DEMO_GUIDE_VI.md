# Hướng Dẫn Trình Diễn Trực Tiếp & Đánh Giá Kỹ Thuật CrocFlow

> **Đối tượng độc giả:** Người đánh giá kỹ thuật, Kỹ sư mạng & hệ thống, Giảng viên và Lập trình viên.  
> **Thời lượng trình diễn khuyến nghị:** 5 đến 7 phút.  
> **Phạm vi kiểm tra:** Tương thích wire-protocol chuẩn `croc` CLI, Truyền song song 2 Relay (Dual-Relay), Chuyển lỗi tự động (Failover), Tiếp tục truyền từ bộ nhớ đệm Chunk SHA-256 (IndexedDB Resume), và Bảo mật mã hóa đầu cuối Zero-Knowledge.

---

## 1. Tóm Tắt Tổng Quan Dự Án

**CrocFlow** là ứng dụng truyền tệp bảo mật đa nền tảng, tương thích 100% với hệ sinh thái công cụ mã nguồn mở `croc` (giao thức dây v11) và được mở rộng chế độ Nâng cao (Enhanced Mode) đáp ứng các yêu cầu khắt khe về độ tin cậy trong môi trường mạng thực tế.

Tài liệu này cung cấp quy trình khách quan, mạch lạc để trình diễn, đo lường và đánh giá toàn diện các trụ cột kỹ thuật của CrocFlow:
1. **Tương thích wire-protocol tuyệt đối**: Truyền nhận hai chiều mượt mà giữa CrocFlow và công cụ dòng lệnh `croc` CLI gốc của Go cũng như web client `getcroc.com`.
2. **Truyền song song 2 Relay (Dual-Relay)**: Chia tải các mảnh Chunk chẵn qua Relay Alpha và Chunk lẻ qua Relay Beta đồng thời qua WebSocket thực tế.
3. **Chuyển lỗi tự động (Live Failover)**: Tự động phát hiện ngắt kết nối một Relay và điều phối các Chunk còn lại sang Relay còn sống mà không làm hỏng hay phải tải lại phiên truyền từ đầu.
4. **Bộ nhớ đệm Folder Manifest & Resume Cache**: Kiểm tra toàn vẹn từng Chunk bằng mã băm SHA-256 lưu trong IndexedDB, cho phép tiếp tục tải khi có mạng và tự động nhận diện tệp mới thêm vào thư mục.
5. **Bảo mật Zero-Knowledge**: Bắt tay khóa PAKE / ECDH (P-256), dẫn xuất khóa phiên HKDF-SHA-256 và mã hóa luồng AES-256-GCM hoàn toàn ở phía client.

---

## 2. Kịch Bản Trình Diễn Từng Bước

### Giai đoạn 1: Kiểm thử Tương thích Chuẩn Croc v11 với CLI gốc (0:00 – 1:30)

#### Mục tiêu
Chứng minh CrocFlow tương thích chính xác ở mức từng byte với cụm Relay công cộng và CLI `croc` chính thức mà không cần thay đổi hạ tầng máy chủ gốc.

#### Các bước thực hiện:
1. **Khởi động CrocFlow**:
   - Mở trình duyệt truy cập `http://localhost:3000` (hoặc mở trên điện thoại / bản PWA đã cài đặt).
   - Quan sát giao diện hiện đại, nút chuyển đổi giao diện Sáng/Tối và nút đổi ngôn ngữ **[Tiếng Việt / English]**.
2. **Chọn Chế độ Chuẩn Croc v11**:
   - Tại màn hình **Gửi**, chọn chế độ **"Chuẩn Croc v11"**.
   - Chọn một tệp tài liệu hoặc nhập văn bản an toàn (ví dụ: `"Kiem tra Tuong thich Giao thuc Croc v11 - Chuoi Bi Mat 999"`).
   - Bấm **"Bắt đầu gửi mã hóa"**. Ứng dụng tạo mã bí mật 3 từ chuẩn EFF (ví dụ: `4281-croc-flow-demo`) kèm mã QR Code trực quan.
3. **Kiểm tra chiều CrocFlow ➔ croc CLI**:
   - Mở cửa sổ dòng lệnh (Terminal) có cài đặt `croc`, chạy lệnh:
     ```bash
     croc <codephrase>
     ```
   - Quan sát CLI bắt tay PAKE, xác thực mã bí mật và giải mã chính xác nội dung gửi từ CrocFlow.
4. **Kiểm tra chiều ngược lại (croc CLI ➔ CrocFlow)**:
   - Trên Terminal chạy lệnh gửi tệp:
     ```bash
     croc send tailieu.pdf
     ```
   - Trên giao diện CrocFlow, chuyển sang tab **Nhận**, nhập mã bí mật và bấm **"Kết nối & Nhận"**.
   - Xác nhận nhận tệp, giải mã và lưu trữ thành công với mã băm toàn vẹn hoàn toàn trùng khớp.

---

### Giai đoạn 2: Truyền song song 2 Relay & Tự động Chuyển lỗi Failover (1:30 – 3:30)

#### Mục tiêu
Trực quan hóa cơ chế chia tải qua hai Relay độc lập (Relay Alpha và Relay Beta) và kiểm thử khả năng chịu lỗi tức thời khi một Relay bị mất kết nối giữa chừng.

#### Các bước thực hiện:
1. **Mở Bảng soi giao thức (Protocol Inspector)**:
   - Trên màn hình máy tính, Bảng soi giao thức được ghim cố định ở cạnh phải (hoặc nhấn mở trên di động).
2. **Kích hoạt phiên truyền Dual-Relay**:
   - Mở tab **Tải App & Tài liệu** ➔ mục **"Bộ chạy Demo Trực tiếp"** (hoặc dùng màn hình **Gửi** ở chế độ **Nâng cao CrocFlow** bật 2 Relay).
   - Bấm nút **"Chạy Demo 2 Relay + Failover"**.
   - CrocFlow thiết lập 2 kênh WebSocket thực:
     - `Relay Alpha` tại `/ws-dual?channel=alpha` (truyền Chunk chẵn: `0, 2, 4, ...`)
     - `Relay Beta` tại `/ws-dual?channel=beta` (truyền Chunk lẻ: `1, 3, 5, ...`)
3. **Theo dõi các mốc Bắt tay & Ma trận Chunk**:
   - Bảng soi giao thức ghi nhận 5 mốc bắt tay mật mã:
     `Tạo phòng` ➔ `Trao đổi ECDH P-256` ➔ `Dẫn xuất HKDF-SHA-256` ➔ `Xác nhận hai chiều` ➔ `Mã hóa dòng AES-256-GCM`.
   - Trong **Bản đồ Chunk**, Chunk chẵn hiển thị màu xanh ngọc (**Relay Alpha**) và Chunk lẻ hiển thị màu xanh dương (**Relay Beta**).
4. **Mô phỏng ngắt kết nối Relay Alpha (Failure Injection)**:
   - Khi phiên truyền đạt khoảng 45%, bấm nút **"Mô phỏng ngắt kết nối Relay Alpha (Failover)"**.
   - Máy trạng thái `DualRelayScheduler` phát hiện socket Alpha đóng và kích hoạt ngay hàm `triggerAlphaFailover()`.
   - **Xác nhận trực quan**: Các ô Chunk chẵn còn lại lập tức chuyển sang màu vàng hổ phách (**Failover**) và được định tuyến ngay qua **Relay Beta**.
   - **Kiểm tra tính toàn vẹn**: Phía nhận sắp xếp các chunk theo đúng chỉ số gốc, kiểm tra chữ ký SHA-256 khớp 100%, không bị hỏng hoặc thiếu byte nào.

---

### Giai đoạn 3: Folder Manifest SHA-256 & Khôi phục từ IndexedDB Cache (3:30 – 4:45)

#### Mục tiêu
Chứng minh khả năng bảo toàn cấu trúc thư mục, lưu trữ tạm các Chunk đã xác thực trong IndexedDB và khôi phục thông minh không cần tải lại các phần đã có.

#### Các bước thực hiện:
1. **Kích hoạt Demo Resume & Phát hiện tệp mới**:
   - Trong tab **Tải App & Tài liệu**, bấm **"Chạy Demo Resume Cache IndexedDB"**.
   - Giai đoạn 1 truyền 6 chunk đầu của thư mục vào cơ sở dữ liệu `crocflow-resume-db` của trình duyệt trước khi chủ động ngắt kết nối mô phỏng rớt mạng.
2. **Kiểm tra Bộ nhớ đệm cục bộ**:
   - Chuyển sang màn hình **Nhận**. Khu vực **Bộ nhớ đệm khôi phục (Resume Cache IndexedDB)** hiển thị số Chunk và dung lượng thực tế đang lưu.
3. **Kết nối lại & Tự động phát hiện Delta**:
   - Máy gửi thêm tệp mới (`PhuLuc_MoiThemSauMatMang.bin`) vào Folder Manifest và kết nối lại.
   - Hàm `computeResumePlan()` đối chiếu:
     - Các Chunk đã có trong IndexedDB được đánh dấu màu tím (**Khôi phục từ Cache — bỏ qua**).
     - Đường truyền chỉ tải các Chunk còn thiếu và tệp mới thêm.
   - Nhấn **"Tải toàn bộ dạng file .ZIP"** hoặc **"Lưu thẳng vào thư mục máy"** để kiểm tra cây thư mục hoàn chỉnh.

---

### Giai đoạn 4: Đo độ trễ RTT & Passphrase nhóm xoay vòng tự động (4:45 – 5:45)

#### Mục tiêu
Kiểm tra khả năng quan trắc mạng và cơ chế bảo mật nhóm theo chu kỳ thời gian.

#### Các bước thực hiện:
1. **Đo độ trễ RTT thực tế**:
   - Mở tab **Relay & Mạng**.
   - Bấm **"Đo độ trễ (Ping RTT)"**.
   - Hệ thống gửi gói tin đo độ trễ tới 2 relay phòng lab cục bộ và 4 relay công cộng của Croc (`1.getcroc.com` đến `4.getcroc.com`).
   - Bảng xếp hạng tự động sắp xếp các máy chủ từ nhanh nhất đến chậm nhất.
2. **Passphrase nhóm xoay vòng theo tháng**:
   - Mở tab **Lịch sử & Nhóm**.
   - Trong mục **Passphrase nhóm xoay vòng theo tháng**, nhập một mật mã bí mật (ví dụ: `"Nhom-Lap-Trinh-Mang"`).
   - Bấm **"Tạo mã tháng này"**. Hệ thống tính `HKDF-SHA-256(secret, "YYYY-MM")` để sinh mã Codephrase 3 từ EFF đồng bộ trên tất cả thiết bị của các thành viên.
   - Bấm **"Dùng để Gửi"** để chuyển thẳng mã vào màn hình gửi.

---

### Giai đoạn 5: Xuất Báo Cáo Kỹ Thuật & Đóng Gói Ứng Dụng (5:45 – 6:30)

#### Mục tiêu
Đánh giá tính sẵn sàng của sản phẩm, khả năng đóng gói đa nền tảng và xuất dữ liệu báo cáo kỹ thuật.

#### Các bước thực hiện:
1. **Xuất báo cáo kiểm thử**:
   - Trong tab **Tải App & Tài liệu**, bấm **"Xuất Báo Cáo Kỹ Thuật (.md)"**.
   - Trình duyệt tự tải tệp Markdown ghi nhận đầy đủ phiên làm việc, thiết bị, chế độ và kết quả đo lường.
2. **Kiểm tra đóng gói đa nền tảng**:
   - **PWA**: Hoạt động ngoại tuyến thông qua Service Worker và hỗ trợ cài đặt trực tiếp.
   - **Android**: Đóng gói bằng Capacitor (`capacitor.config.ts`) tạo file APK.
   - **Desktop**: Đóng gói bằng Electron (`packaging/desktop/`) tích hợp sẵn Bridge Server cục bộ.
   - **CI/CD**: Tự động kiểm thử và build bản phát hành trong `.github/workflows/build-releases.yml`.

---

## 3. Bộ Câu Hỏi & Trả Lời Vấn Đáp Kỹ Thuật

### Câu 1: Làm thế nào CrocFlow đảm bảo các máy chủ Relay trung gian không thể đọc trộm hoặc sửa đổi dữ liệu tệp?
> **Trả lời:** Mọi thao tác trao đổi khóa và mã hóa diễn ra 100% tại thiết bị người dùng (client-side). Ứng dụng kết hợp trao đổi khóa tạm thời ECDH trên đường cong P-256 với thuật toán PAKE dẫn xuất từ mật mã chung (Codephrase). Máy chủ Relay chỉ đóng vai trò chuyển tiếp các gói tin nhị phân đã mã hóa bằng AES-256-GCM kèm vector khởi tạo ngẫu nhiên (IV 12-byte). Nếu Relay can thiệp sửa đổi dù chỉ 1 bit, thẻ xác thực (Auth Tag 16-byte) của AES-GCM và mã băm SHA-256 ở phía nhận sẽ lập tức báo lỗi và hủy gói tin.

### Câu 2: Biện pháp chống tấn công Server-Side Request Forgery (SSRF) qua cổng Bridge `/ws` được thiết kế ra sao?
> **Trả lời:** Trình duyệt web không thể mở socket TCP thuần do hạn chế sandbox, vì vậy cần cổng `/ws` làm cầu nối. Để ngăn chặn kẻ xấu lợi dụng biến máy chủ thành công cụ quét mạng nội bộ (SSRF):
> 1. Bridge Server (`server/bridge-allowlist.ts`) **không nhận host tùy ý** từ phía client mà chỉ nhận chỉ số `relay` (0..3) ánh xạ vào danh sách trắng cấu hình sẵn trên server.
> 2. Giới hạn dải cổng nghiêm ngặt trong khoảng `9009–9017`.
> 3. Lọc bỏ triệt để mọi địa chỉ IP nội bộ RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.1`) và IP cloud metadata (`169.254.169.254`). Mọi yêu cầu vi phạm đều bị từ chối với HTTP 400/403 (được kiểm thử tự động trong `server/bridge-allowlist.test.ts`).

### Câu 3: Quá trình đồng bộ dữ liệu diễn ra thế nào khi Relay Alpha bị đứt kết nối trong chế độ Dual-Relay?
> **Trả lời:** Bộ lập lịch `DualRelayScheduler` (`src/protocol/enhanced/dual-relay-scheduler.ts`) quản lý trạng thái từng Chunk thông qua máy trạng thái: `pending`, `in-flight`, `verified`, `failover`. Khi kết nối WebSocket của Relay Alpha gặp sự cố, hàm `triggerAlphaFailover()` chuyển toàn bộ các Chunk chẵn đang chờ hoặc chưa được xác nhận hoàn tất sang hàng đợi phát của Relay Beta. Phía nhận gom các Chunk dựa trên chỉ số tuần tự (`globalIndex`). Các Chunk trùng lặp (nếu có) được khử trùng lặp an toàn và không gây ảnh hưởng đến bộ đệm ghép tệp.

### Câu 4: Làm thế nào để phòng chống tấn công leo thư mục (Path Traversal) khi truyền thư mục lồng nhau?
> **Trả lời:** Trong Chế độ Nâng cao, cấu trúc thư mục được đóng gói trong `FolderManifest`. Tất cả đường dẫn tương đối của các tệp đều được xử lý qua hàm làm sạch `sanitizeRelativePath()` (`src/protocol/enhanced/manifest.ts`). Hàm này loại bỏ các chuỗi nguy hiểm như `..`, dấu gạch chéo đầu dòng `/`, tiền tố ổ đĩa Windows (`C:`) và các ký tự điều khiển, chuẩn hóa về đường dẫn an toàn trước khi lưu vào đĩa hoặc tạo tệp ZIP.

### Câu 5: Tại sao nhóm chọn viết lại bộ giao thức Croc v11 bằng TypeScript thuần thay vì đóng gói Go WebAssembly?
> **Trả lời:** Việc biên dịch Go sang WebAssembly tạo ra tệp nhị phân rất nặng (>15 MB), thời gian khởi động chậm và khó tương thích với môi trường đa nền tảng nhẹ nhàng. Bằng cách hiện thực giao thức Croc v11 bằng TypeScript thuần kết hợp Web Crypto API (`crypto.subtle`) và thư viện chuẩn `@noble/curves`:
> 1. Kích thước bundle nhẹ (<400 KB sau nén gzip), khởi động ngay lập tức.
> 2. Hoạt động đồng nhất trên Web PWA, Android (Capacitor) và Desktop (Electron) mà không cần binary trung gian.
> 3. Tận dụng tối đa hiệu năng của luồng dữ liệu (Streams API) và bộ nhớ đệm IndexedDB.
