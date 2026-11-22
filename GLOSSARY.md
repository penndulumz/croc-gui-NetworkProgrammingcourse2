# CrocFlow Domain Glossary / Thuật Ngữ Nghiệp Vụ

Canonical domain vocabulary for CrocFlow, a cross-platform end-to-end encrypted file transfer system interoperable with the Croc ecosystem and extended for computer networking education and high-reliability data exchange.

Bảng thuật ngữ chuẩn hóa cho CrocFlow, hệ thống truyền tệp mã hóa đầu cuối đa nền tảng tương thích với hệ sinh thái Croc và mở rộng cho nghiên cứu, đào tạo mạng máy tính.

---

## 1. Core Transfer Concepts / Khái Niệm Truyền Tệp Cốt Lõi

### Transfer Session (Phiên Truyền)
- **EN**: A single active or completed exchange of files, a folder, or direct text between a sender and one or more receivers.
- **VI**: Một phiên trao đổi dữ liệu đang diễn ra hoặc đã hoàn tất (gửi tệp, thư mục hoặc văn bản) giữa bên gửi và một hoặc nhiều bên nhận.
- _Avoid / Tránh_: Job, task, upload job, tiến trình gửi

### Codephrase (Mã Bí Mật)
- **EN**: A human-readable secret phrase (typically three or four EFF words) used both to derive the relay room identifier and to authenticate the end-to-end encryption key via PAKE.
- **VI**: Cụm từ bí mật dễ đọc (thường gồm 3 hoặc 4 từ chuẩn EFF) dùng để vừa tính toán định danh phòng trên Relay, vừa xác thực khóa mã hóa đầu cuối qua PAKE.
- _Avoid / Tránh_: PIN, invite link, room key, mã phòng, password

### Standard Mode (Chế Độ Chuẩn Croc v11)
- **EN**: The wire-compatible Croc v11 transfer mode that interoperates byte-for-byte with the official `croc` CLI and `getcroc.com` web client.
- **VI**: Chế độ truyền tương thích byte-for-byte với giao thức dây Croc v11 chính thức của `croc` CLI và web client `getcroc.com`.
- _Avoid / Tránh_: Legacy mode, basic mode, CLI mode, chế độ cũ

### Enhanced Mode (Chế Độ Nâng Cao CrocFlow)
- **EN**: The CrocFlow app-to-app transfer mode that adds application-layer folder manifests, per-chunk SHA-256 resume, and optional dual-relay delivery without altering Standard Mode compatibility.
- **VI**: Chế độ truyền chuyên dụng giữa các ứng dụng CrocFlow, bổ sung bản kê thư mục tầng ứng dụng, cơ chế resume từng chunk bằng SHA-256 và truyền song song 2 relay.
- _Avoid / Tránh_: Pro mode, custom mode, experimental mode, chế độ thử nghiệm

### Folder Manifest (Bản Kê Thư Mục)
- **EN**: An application-layer descriptor listing every file's sanitized relative path, byte size, chunk size, total chunk count, and per-chunk SHA-256 digests for a folder transfer.
- **VI**: Bản mô tả tầng ứng dụng liệt kê đường dẫn tương đối an toàn, kích thước byte, kích thước chunk, tổng số chunk và mã băm SHA-256 của từng chunk trong thư mục.
- _Avoid / Tránh_: File index, directory list, metadata blob, danh sách tệp

### Chunk (Mảnh Dữ Liệu)
- **EN**: A fixed-index slice of a file's bytes transferred, verified, and cached independently to support resume and multi-relay splitting.
- **VI**: Một lát cắt dữ liệu có chỉ số cố định của tệp, được truyền tải, kiểm tra tính toàn vẹn và lưu bộ nhớ đệm độc lập phục vụ resume và chia tải đa relay.
- _Avoid / Tránh_: Packet, segment, block, gói tin, đoạn

### Resume Cache (Bộ Nhớ Đệm Khôi Phục)
- **EN**: Client-side persistent storage holding verified received chunks keyed by manifest identity, relative path, and chunk index so interrupted transfers continue without re-downloading completed data.
- **VI**: Bộ lưu trữ bền vững phía máy khách (IndexedDB) lưu các chunk đã kiểm tra tính toàn vẹn theo ID manifest, đường dẫn và chỉ số chunk để tiếp tục tải khi mất mạng.
- _Avoid / Tránh_: Temp storage, draft store, offline buffer, bộ nhớ tạm

---

## 2. Network & Relay Concepts / Khái Niệm Mạng & Relay

### Bridge Server (Máy Chủ Cầu Nối)
- **EN**: The server component that forwards opaque encrypted binary streams between browser WebSocket connections and allowlisted Croc TCP relays while defending against SSRF.
- **VI**: Thành phần máy chủ chuyển tiếp luồng nhị phân mã hóa giữa kết nối WebSocket của trình duyệt và cổng TCP của Croc Relay, đồng thời phòng chống tấn công SSRF.
- _Avoid / Tránh_: Proxy server, gateway daemon, backend relay, cổng trung gian

### Relay Node (Nút Chuyển Tiếp)
- **EN**: An addressable intermediary server (public Croc relay, embedded local lab relay, or custom relay) that pairs peers inside a room without inspecting encrypted payloads.
- **VI**: Máy chủ trung gian có địa chỉ định tuyến (relay công cộng, relay lab cục bộ hoặc relay tự dựng) ghép cặp hai máy trong cùng một phòng mà không đọc nội dung mã hóa.
- _Avoid / Tránh_: Broker, hub, mirror, máy chủ proxy

### Dual-Relay Transfer (Truyền Song Song 2 Relay)
- **EN**: An Enhanced Mode delivery strategy that streams even-indexed chunks (`0, 2, 4...`) over Relay Alpha and odd-indexed chunks (`1, 3, 5...`) over Relay Beta concurrently.
- **VI**: Chiến lược truyền dữ liệu trong Chế độ Nâng cao chia đồng thời các chunk chẵn qua Relay Alpha và chunk lẻ qua Relay Beta.
- _Avoid / Tránh_: Split transfer, load-balanced transfer, multi-server upload, chia file tải lên

### Failover (Chuyển Lỗi Tự Động)
- **EN**: The automatic rerouting of remaining in-flight or pending chunks from a disconnected Relay Node to the surviving Relay Node during a Dual-Relay Transfer.
- **VI**: Cơ chế tự động điều phối các chunk đang truyền hoặc đang chờ từ một Relay bị mất kết nối sang Relay còn hoạt động trong phiên truyền song song 2 Relay.
- _Avoid / Tránh_: Retry, fallback, reconnect, thử lại kết nối

### Protocol Inspector (Bảng Soi Giao Thức)
- **EN**: The real-time diagnostic view that surfaces live PAKE handshake milestones, per-chunk relay assignment, and measured throughput emitted by the active transfer engine.
- **VI**: Bảng chẩn đoán trực tiếp hiển thị các mốc bắt tay PAKE, trạng thái gán chunk theo relay và tốc độ truyền thực tế do engine phát ra.
- _Avoid / Tránh_: Debug console, network log, telemetry panel, bảng điều khiển lỗi

---

## 3. Collaboration & Identity Concepts / Khái Niệm Nhận Diện & Nhóm

### Device Alias (Tên Định Danh Thiết Bị)
- **EN**: A user-chosen friendly name identifying the current phone or desktop inside transfer history and peer address books.
- **VI**: Tên thân thiện do người dùng đặt để nhận diện điện thoại hoặc máy tính trong nhật ký truyền và danh bạ thiết bị quen thuộc.
- _Avoid / Tránh_: Hostname, username, profile name, tên người dùng

### Group Passphrase (Mật Mã Nhóm Xoay Vòng)
- **EN**: A shared team secret that automatically derives a time-scoped room and encryption secret bound to a calendar rotation cycle (such as `YYYY-MM`).
- **VI**: Khóa bí mật chung của nhóm tự động dẫn xuất mã phòng và khóa mã hóa theo chu kỳ lịch (ví dụ hàng tháng `YYYY-MM`) mà không cần gửi lại mật mã mỗi ngày.
- _Avoid / Tránh_: Static password, team key, persistent code, mật khẩu vĩnh viễn
