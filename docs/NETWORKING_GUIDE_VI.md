# Cẩm Nang Kiến Thức Mạng Máy Tính Cho Truyền Tệp Bảo Mật

> Tài liệu kỹ thuật chi tiết phân tích bản chất các tầng mạng, bắt tay mật mã và cơ chế truyền file phân tán trong **CrocFlow**.

---

## 1. Bản Chất Mạng Máy Tính: Vì Sao Hai Thiết Bị Không Thể Tự Nối Với Nhau Trực Tiếp?

### Mạng Nội Bộ (Private Subnet) và Cơ Chế NAT (Network Address Translation)
Khi điện thoại hoặc laptop của bạn kết nối Wi-Fi tại nhà riêng, trường học hoặc văn phòng:
- Router Wi-Fi cấp cho thiết bị của bạn một địa chỉ **IP nội bộ (Private IP)** theo chuẩn RFC 1918 (ví dụ: `192.168.1.15` hoặc `10.0.4.88`).
- Các địa chỉ IP nội bộ này **không thể định tuyến trực tiếp trên Internet công cộng**.
- Toàn bộ thiết bị trong mạng Wi-Fi cùng dùng chung một địa chỉ **IP công cộng duy nhất (Public IP)** do nhà mạng ISP cung cấp.
- Khi bạn mở trình duyệt tải trang web, router thực hiện cơ chế **NAT (Network Address Translation)**: ghi nhớ cổng mở chiều ra, dịch địa chỉ gói tin và chuyển dữ liệu trả về đúng máy của bạn.

```
[ Máy Gửi (Hà Nội) ] (IP Nội bộ: 192.168.1.15)
        │ Mở kết nối đi ra (Outbound)
        ▼
   [ Router NAT / Firewall ] (IP Công cộng: 203.0.113.42)
        │
   ═══════════════════════════════════════════ (Internet Công cộng)
        │
   [ Router NAT / Firewall ] (IP Công cộng: 198.51.100.99)
        ▲
        │ Bị chặn! (Tường lửa chặn kết nối lạ từ ngoài vào)
[ Máy Nhận (TP.HCM) ] (IP Nội bộ: 192.168.0.22)
```

### Rào Cản Kết Nối Đi Vào (Inbound Connection Block)
Nếu một máy ở Hà Nội muốn gửi tệp trực tiếp sang máy ở TP.HCM:
1. Máy gửi không thể nối tới `192.168.0.22` vì địa chỉ này chỉ tồn tại trong mạng LAN của máy nhận.
2. Máy gửi cũng không thể nối tới IP công cộng của router máy nhận (`198.51.100.99`) vì tường lửa (Firewall) sẽ lập tức hủy bỏ (Drop) mọi gói tin TCP SYN từ bên ngoài tự ý đi vào.

### Giải Pháp Rendezvous Relay của Croc & CrocFlow
Thay vì bắt người dùng phải cấu hình mở cổng router (Port Forwarding) hoặc dùng các kỹ thuật xuyên NAT phức tạp dễ lỗi:
1. Cả **Máy Gửi** và **Máy Nhận** đều chủ động mở kết nối **chiều đi ra (Outbound)** tới cùng một **Relay Server** có IP công cộng sẵn sàng trên Internet.
2. Các kết nối chiều đi ra luôn được router NAT và tường lửa cho phép 100%.
3. Hai máy báo cùng tên **Phòng (Room)** được tính toán toán học từ mật khẩu bí mật chung (`Codephrase`).
4. Relay Server đóng vai trò chiếc "ống dẫn", chuyển tiếp luồng dữ liệu nhị phân giữa hai máy.

---

## 2. Rào Cản Sandbox Trình Duyệt: WebSockets vs. TCP Thuần (Raw TCP)

### Tại Sao JavaScript Trên Trình Duyệt Không Mở Được TCP Thuần?
Trình duyệt web hoạt động trong môi trường sandbox cô lập cực kỳ nghiêm ngặt:
- Nếu JavaScript được mở socket TCP tùy ý, một trang web độc hại có thể quét cổng mạng nội bộ của bạn, tấn công máy in văn phòng hoặc điều khiển thiết bị IoT trong nhà.
- Vì vậy, JavaScript trên trình duyệt chỉ được phép mở kết nối **HTTP/HTTPS** và **WebSocket (`ws://` / `wss://`)**.
- Tuy nhiên, cụm máy chủ Relay chính thức của Go `croc` lại lắng nghe trên cổng **TCP thuần** (`9009–9013`).

### Cầu Nối Bridge Server An Toàn (`/ws`)
Để ứng dụng web và di động có thể kết nối mượt mà vào hệ sinh thái Croc mà không cần cài đặt phần mềm Go WASM cồng kềnh:
1. Trình duyệt kết nối WebSocket tới Bridge Server tích hợp (`server.ts`):
   `ws://localhost:3000/ws?relay=0&port=9009`
2. **Bộ lọc Chống Tấn Công SSRF (`server/bridge-allowlist.ts`)**:
   - Bridge Server tuyệt đối không nhận địa chỉ IP hay host tùy ý từ client.
   - Chỉ nhận chỉ số số nguyên (`relay=0..3`) ánh xạ tới danh sách trắng máy chủ Croc chính thức (`CROC_RELAY_HOSTS`).
   - Lọc bỏ hoàn toàn địa chỉ loopback (`127.0.0.1`), dải IP nội bộ RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) và IP metadata đám mây (`169.254.169.254`).
3. Sau khi xác thực an toàn, Bridge Server nối ống dữ liệu hai chiều giữa WebSocket của trình duyệt và kết nối TCP tới Croc Relay.
4. **Kết quả**: Tương thích byte-for-byte 100% với công cụ dòng lệnh `croc` CLI gốc.

---

## 3. Mật Mã Học Đầu Cuối Zero-Knowledge (PAKE + HKDF + AES-256-GCM)

### Câu Hỏi Lớn Về Bảo Mật
> *"Dữ liệu đi qua máy chủ Relay trung gian như vậy, liệu người quản trị Relay có đọc trộm hoặc sửa đổi được tệp của chúng ta không?"*

**Câu trả lời là TUYỆT ĐỐI KHÔNG.** CrocFlow sử dụng bộ 3 tầng mật mã thực thi 100% phía máy khách:

```
[ Thiết Bị Gửi ]                                                 [ Thiết Bị Nhận ]
       │                                                                  │
       ├──────────────── Khóa Công Khai Tạm Thời (P-256) ─────────────────┤
       │                          + Che Khóa Bằng PAKE                    │
       ▼                                                                  ▼
[ Tính Điểm Bí Mật Chung ]                                       [ Tính Điểm Bí Mật Chung ]
       │                                                                  │
       ▼                                                                  ▼
[ Hàm Dẫn Xuất HKDF-SHA-256 ]                                    [ Hàm Dẫn Xuất HKDF-SHA-256 ]
       ├──────────────► Khóa Phiên AES-256-GCM ◄──────────────────────────┤
       ├──────────────► Thẻ Xác Nhận confirmA / confirmB ◄────────────────┤
       ▼                                                                  ▼
[ Xác Nhận Hai Chiều Khớp ] ◄────── Kiểm Tra Đối Chiếu ────────► [ Xác Nhận Hai Chiều Khớp ]
       │                                                                  │
       ▼                                                                  ▼
[ Mã Hóa Từng Chunk GCM ] ═════════ Luồng Bản Mã ══════════════► [ Giải Mã Từng Chunk GCM ]
```

### 1. Thuật Toán Bắt Tay Khóa PAKE v2 Trên Đường Cong NIST P-256
Thuật toán Diffie-Hellman thông thường cho phép hai bên thỏa thuận khóa bí mật qua kênh không an toàn, nhưng rất dễ bị tấn công xen giữa (Man-in-the-Middle) nếu không có chứng chỉ số.
- **PAKE v2 (Password Authenticated Key Exchange)** kết hợp cặp khóa tạm thời trên đường cong elliptic P-256 với mã băm của mật khẩu chung (Codephrase).
- Mật khẩu Codephrase **không bao giờ được gửi nguyên văn qua mạng**.
- Kẻ tấn công nghe lén trên đường truyền hoặc chính quản trị viên Relay không thể giải mã hoặc thử mật khẩu ngoại tuyến (offline dictionary attack) vì các điểm công khai đã được làm mờ toán học.

### 2. Hàm Dẫn Xuất Khóa HKDF-SHA-256
Sau khi tính được điểm bí mật chung, cả hai bên truyền điểm đó qua hàm HKDF cùng một chuỗi muối (`salt`) ngẫu nhiên 32-byte:
- Sinh ra **khóa đối xứng 256-bit** dùng cho thuật toán AES-GCM.
- Sinh ra hai thẻ xác nhận hai chiều (`confirmA` và `confirmB`). Hai bên đối chiếu hai thẻ này trước khi gửi dữ liệu tệp, đảm bảo cả hai đều nhập chính xác cùng một mã Codephrase.

### 3. Mã Hóa Xác Thực AES-256-GCM (Authenticated Encryption)
- Mọi gói tin nhị phân và từng mảnh Chunk đều được mã hóa bằng **AES-256-GCM**.
- Mỗi gói tin sử dụng một vector khởi tạo (IV 12-byte) ngẫu nhiên hoàn toàn riêng biệt.
- GCM cung cấp cơ chế **AEAD**: nếu Relay hoặc tin tặc cố tình can thiệp sửa đổi dù chỉ 1 bit, thẻ xác thực (Auth Tag 16-byte) ở phía nhận sẽ lập tức báo lỗi và socket bị ngắt ngay lập tức, ngăn ngừa hoàn toàn dữ liệu rác.

---

## 4. Cắt Mảnh Chunk, Folder Manifest và Bộ Nhớ Đệm IndexedDB Resume

### Hạn Chế Của Luồng Truyền Truyền Thống
Khi truyền một thư mục chứa hàng trăm tệp hoặc một tệp lớn 2 GB qua một luồng duy nhất, nếu mạng bị đứt ở 98%, bạn phải tải lại toàn bộ từ con số 0.

### Giải Pháp Đột Phá Của CrocFlow:
1. **Folder Manifest (`manifest.ts`)**:
   - Máy gửi quét toàn bộ thư mục, làm sạch đường dẫn bằng `sanitizeRelativePath` (chặn triệt để tấn công leo thư mục `../../etc/passwd`).
   - Cắt các tệp thành các **Chunk** có kích thước cố định (mặc định 64 KB).
   - Tính mã băm SHA-256 cho từng Chunk riêng biệt và mã băm toàn phần cho từng tệp.
2. **Bộ Nhớ Đệm Khôi Phục IndexedDB (`resume-cache.ts`)**:
   - Khi máy nhận giải mã và xác thực mã băm SHA-256 của từng Chunk thành công, Chunk đó được ghi ngay vào cơ sở dữ liệu `crocflow-resume-db` của trình duyệt.
3. **Tiếp Tục Tải Thông Minh (`computeResumePlan`)**:
   - Khi có kết nối lại, máy nhận đối chiếu Manifest mới với dữ liệu đang có trong IndexedDB.
   - Các Chunk đã có sẵn được đánh dấu là `Resume Cache` và bỏ qua không tải lại.
   - Nếu trong lúc mất mạng, người gửi bỏ thêm tệp mới vào thư mục, CrocFlow tự động nhận diện và chỉ truyền đúng các phần dữ liệu còn thiếu.

---

## 5. Truyền Song Song 2 Relay (Dual-Relay) & Tự Động Chuyển Lỗi (Failover)

### Chia Tải Qua Hai Đường Ống Mạng
Nhằm tối đa hóa băng thông và không phụ thuộc vào một máy chủ duy nhất:
- CrocFlow mở đồng thời 2 kênh WebSocket độc lập:
  - **Relay Alpha**: Phụ trách các Chunk có chỉ số chẵn (`0, 2, 4, 6, ...`)
  - **Relay Beta**: Phụ trách các Chunk có chỉ số lẻ (`1, 3, 5, 7, ...`)

```
Máy Gửi ──────────► Chunk 0 (Chẵn) ──────────► [ Relay Alpha ] ──────────► Máy Nhận
        ──────────► Chunk 1 (Lẻ)   ──────────► [ Relay Beta  ] ──────────►
        ──────────► Chunk 2 (Chẵn) ──────────► [ Relay Alpha ] ──────────►
        ──────────► Chunk 3 (Lẻ)   ──────────► [ Relay Beta  ] ──────────►
```

### Cơ Chế Tự Động Chuyển Lỗi (Failover)
Nếu Relay Alpha gặp sự cố mất mạng hoặc sập phòng giữa phiên truyền:
1. Máy trạng thái `DualRelayScheduler` phát hiện socket của Relay Alpha bị đóng hoặc gửi lỗi.
2. Hệ thống gọi ngay hàm `triggerAlphaFailover()`.
3. Toàn bộ các Chunk chẵn chưa được xác nhận hoàn tất lập tức được chuyển sang hàng đợi phát của **Relay Beta**.
4. Máy nhận sắp xếp các Chunk theo đúng chỉ số tuần tự (`globalIndex`), khử trùng lặp các gói tin đến muộn và xác nhận mã băm SHA-256 cuối cùng. Dữ liệu bảo toàn 100%, không cần truyền lại từ đầu.

---

## 6. Passphrase Nhóm Xoay Vòng Tự Động Hàng Tháng (`YYYY-MM`)

Các nhóm làm việc thường xuyên cần một mã dùng chung mà không muốn phải gửi lại mật mã mỗi ngày:
- CrocFlow tính toán mã bí mật theo công thức:
  $$\text{CodeTháng} = \text{HKDF-SHA-256}(\text{KhóaGốc}, \text{"YYYY-MM"})$$
- Các byte dẫn xuất được ánh xạ sang từ điển ngắn EFF để sinh ra mã 3 từ tự nhiên.
- Sang ngày đầu tiên của tháng mới, tất cả thiết bị của các thành viên tự động xoay sang mã bảo mật mới mà không cần can thiệp thủ công.
