# CrocFlow — Ứng Dụng Truyền File Mã Hóa Đa Nền Tảng (Hệ Sinh Thái Croc)

**CrocFlow** là ứng dụng truyền file & văn bản mã hóa đầu-cuối (End-to-End Encrypted) hoạt động mượt mà trên **Android, Desktop (Windows/macOS/Linux) và PWA**, tương thích hoàn toàn với `croc` CLI và `getcroc.com`, đồng thời mở rộng các tính năng mạng chuyên sâu phục vụ môn Lập trình mạng cùng bộ tài liệu học thuật chi tiết từ con số 0.

---

## Quyết Định Đã Chốt & Xác Nhận Trước Khi Xây Dựng

> [!IMPORTANT]
> Bốn quyết định cốt lõi dưới đây đã được chốt qua vòng phỏng vấn Wayfinder. Hãy xem lại toàn bộ bản kế hoạch và bấm **Proceed** để bắt đầu tạo Wayfinder Map, xây dựng ứng dụng hoàn chỉnh và bộ tài liệu giải thích.

- **Kiến trúc đóng gói đa nền tảng (Đã chốt)**: Dùng **1 bộ mã nguồn React + TypeScript chung** để vận hành ngay dưới dạng **Web App cài đặt được (PWA)** kèm **WebSocket-to-TCP Bridge thật**, đồng thời cấu hình sẵn quy trình đóng gói tự động ra **Android `.apk` (Capacitor)** và **Desktop `.exe` / `.dmg` / `.AppImage` (Electron)** qua GitHub Actions để sinh viên và giảng viên tải về chạy trực tiếp không cần cài môi trường dev.
- **Bốn nhóm tính năng mở rộng vượt trội hơn `getcroc.com` (Đã chốt)**:
  1. **Gửi nguyên thư mục & Resume bằng Manifest SHA-256** (lưu chunk đã xác thực cục bộ trong IndexedDB, phát hiện file mới bổ sung khi kết nối lại).
  2. **Quản lý Relay, đo độ trễ RTT thực tế & Chế độ 2 Relay song song (Dual-Relay)** chia mảnh chẵn/lẻ kèm tự động chuyển dự phòng (Failover) khi 1 Relay đứt kết nối.
  3. **Bảng soi giao thức trực tiếp (Protocol Inspector)** theo dõi thời gian thực quá trình bắt tay mã hóa PAKE, trạng thái từng mảnh Chunk và biểu đồ thông lượng.
  4. **Lịch sử truyền file, Danh bạ thiết bị cục bộ & Passphrase nhóm cố định xoay vòng theo chu kỳ**.
- **Quy trình Wayfinder & Tài liệu học thuật (Đã chốt)**: Lập đầy đủ **Wayfinder Map**, hệ thống **Decision Tickets**, từ điển thuật ngữ (**Glossary**), quyết định kiến trúc (**ADRs**), và bộ tài liệu hướng dẫn tiếng Việt giải thích tường tận mã nguồn + kịch bản demo cho giảng viên — sau đó triển khai trọn vẹn ứng dụng chạy được ngay.
- **Phong cách giao diện (Đã chốt)**: Hiện đại, sắc nét lấy cảm hứng từ **LocalSend**, hỗ trợ chuyển đổi mượt mà **Dark Mode & Light Mode**, thay thế hoàn toàn phong cách thô cứng của `crocgui` cũ.
- **Mặc định khuyến nghị cho tên & phạm vi chạy thử ngay**: Tên ứng dụng là **CrocFlow**; tích hợp sẵn cả **cầu nối tới cụm Relay công cộng của Croc** (để giao tiếp thật với `croc` CLI / `getcroc.com`) lẫn **2 Relay cục bộ tích hợp sẵn trong server** (để demo chế độ 2 Relay, ngắt mạng Resume và truyền 2 thiết bị trong cùng mạng Wi-Fi/lớp học ngay cả khi mạng trường chặn cổng ngoài).

---

## 1. Tổng Quan & Giá Trị Cốt Lõi

- **Ứng dụng làm gì?**: Cho phép bất kỳ hai thiết bị nào (Android ↔ Desktop ↔ `croc` CLI ↔ `getcroc.com`) trao đổi file, nguyên thư mục hoặc đoạn văn bản ngắn được mã hóa bằng mật khẩu dùng một lần (PAKE + AES-256-GCM) chỉ qua một mã cụm từ dễ đọc hoặc mã QR — không cần tài khoản, không cần cấu hình mở cổng router (NAT traversal qua Relay).
- **Đối tượng sử dụng**:
  - **Giảng viên (đóng vai người dùng phổ thông & người chấm bài)**: Tải về bấm cài (hoặc mở trực tiếp qua trình duyệt/PWA), gửi thử file từ điện thoại sang máy tính hoặc từ dòng lệnh `croc` CLI sang app, kiểm chứng các kịch bản mạng (2 Relay, ngắt mạng tải tiếp, soi gói tin PAKE).
  - **Sinh viên & các thành viên trong nhóm**: Dễ dàng đọc hiểu toàn bộ mã nguồn qua bộ docs tiếng Việt từ con số 0, phối hợp chia việc qua Wayfinder Map và tự tin thuyết trình, trả lời câu hỏi vấn đáp về tầng ứng dụng, mã hóa và truyền dữ liệu mạng.
- **Giá trị khác biệt so với `getcroc.com` và `crocgui`**:
  - Vượt trội hơn **`getcroc.com`**: Hỗ trợ chọn và gửi nguyên cây thư mục, lưu vết chunk vào bộ nhớ cục bộ để Resume khi rớt mạng/thêm file mới, đo độ trễ từng Relay & thử nghiệm truyền song song 2 Relay, lưu lịch sử giao dịch + danh bạ thiết bị + Passphrase nhóm theo tháng, có bảng soi giao thức phục vụ môn Lập trình mạng và cài đặt thành ứng dụng độc lập trên Android/Desktop.
  - Vượt trội hơn **`crocgui` (Go/Fyne)**: Giao diện chuẩn thiết kế ứng dụng hiện đại cho cả màn hình dọc điện thoại (thao tác bằng ngón cái) lẫn màn hình rộng máy tính, hỗ trợ Dark/Light mode mượt mà và cập nhật tiến độ + mã QR trực quan.

---

## 2. Trải Nghiệm Người Dùng & Thiết Kế Giao Diện

### Các Luồng Thao Tác Chính (User Flows)

1. **Luồng Gửi File / Thư Mục / Văn Bản (Send)**:
   - Người dùng chọn chế độ tương thích: **Chuẩn Croc (Tương thích CLI & `getcroc.com`)** hoặc **Nâng cao CrocFlow (Thư mục + Manifest SHA-256 / 2 Relay)**.
   - Kéo-thả hoặc bấm chọn nhiều file, chọn cả thư mục, hoặc chuyển sang tab nhập văn bản ngắn.
   - Bấm **Tạo mã gửi**: Hệ thống tự đo chọn Relay tối ưu (hoặc mở đồng thời Relay Alpha + Relay Beta ở chế độ 2 Relay), sinh mã 3–4 từ chuẩn EFF (hoặc dùng Passphrase cố định của nhóm), hiển thị **Mã QR**, **Lệnh nhận nhanh cho `croc` CLI**, và tiến độ từng file/chunk theo thời gian thực.
2. **Luồng Nhận File & Kiểm Chứng (Receive & Resume)**:
   - Nhập mã cụm từ, dán liên kết nhận trực tiếp, hoặc chọn nhanh từ **Passphrase nhóm đã lưu**.
   - Xem trước danh sách file/thư mục + tổng dung lượng trước khi bấm **Chấp nhận tải về**.
   - Nếu quá trình tải bị gián đoạn (hoặc người gửi thêm file mới vào thư mục), bấm **Tiếp tục (Resume)** sẽ đối chiếu Manifest SHA-256 với các mảnh đã lưu trong IndexedDB, bỏ qua toàn bộ mảnh đã khớp hash và chỉ tải phần còn thiếu.
3. **Luồng Quản Lý Relay & Thử Nghiệm 2 Relay (Relays & Network)**:
   - Xem danh sách cụm Relay công cộng của Croc, 2 Relay nội bộ (Alpha & Beta) và Relay tự thêm.
   - Bấm **Đo độ trễ (Ping RTT)** để đo thời gian phản hồi thực tế tính bằng mili-giây (`ms`) và tự động xếp hạng máy chủ tốt nhất.
   - Khi bật **Chế độ 2 Relay (Dual-Relay)**: Người dùng thấy rõ phân luồng **Chunk chẵn → Relay 1** và **Chunk lẻ → Relay 2**, kèm công tắc **Mô phỏng ngắt Relay 1** để chứng minh khả năng tự động chuyển dự phòng (Failover) sang Relay 2 mà không làm hỏng file.
4. **Luồng Soi Giao Thức Trực Tiếp (Protocol Inspector)**:
   - Mở trực tiếp bên cạnh màn hình truyền (trên Desktop) hoặc qua tab riêng (trên Mobile).
   - Hiển thị theo thời gian thực: tiến trình bắt tay PAKE (đường cong mật mã, tạo khóa phiên HKDF, xác nhận AES-256-GCM), bản đồ trạng thái từng Chunk (đang chờ / đi qua Relay 1 / đi qua Relay 2 / đã xác thực SHA-256 / lấy từ bộ nhớ đệm Resume), và đồ thị tốc độ truyền thực tế.
5. **Luồng Lịch Sử, Thiết Bị & Tài Liệu Học Tập (History, Group & Docs)**:
   - Tra cứu và lọc lại các phiên gửi/nhận trước đó, cấu hình tên thiết bị hiển thị, quản lý Passphrase nhóm xoay vòng theo tháng (`YYYY-MM`).
   - Tab **Tải App & Học Tập** cung cấp nút **Cài đặt ứng dụng (Install PWA)** ngay trên giao diện, hướng dẫn từng bước cho giảng viên tải bản Android `.apk` / Desktop `.exe`, và bộ tài liệu giải thích kiến thức mạng + nút xuất báo cáo `.md`.

### Ngôn Ngữ Thị Giác & Hệ Thống Thiết Kế

- **Định hướng thẩm mỹ**: Tối giản kỹ thuật hiện đại kiểu **LocalSend** — sạch sẽ, rõ phân cấp, độ tin cậy cao của một công cụ truyền dữ liệu chuyên nghiệp, loại bỏ hoàn toàn sự rườm rà và các chi tiết trang trí giả lập.
- **Bảng màu 60-30-10 & Dual Theme (Light / Dark Mode)**:
  - *Chế độ Sáng (Light)*: 60% nền xám lạnh thanh thoát (`#F8FAFC`), 30% bề mặt khung trắng sắc nét (`#FFFFFF`) với đường viền mảnh `1px` (`#E2E8F0`), 10% màu nhấn xanh ngọc lục bảo (`#059669`) tập trung duy nhất vào nút hành động chính và mục điều hướng đang chọn.
  - *Chế độ Tối (Dark)*: 60% nền xanh đen sâu dịu mắt (`#0B1120`), 30% bề mặt nổi (`#111827`) với viền mảnh (`#1F2937`), 10% màu nhấn xanh ngọc sáng (`#10B981`) đạt chuẩn tương phản WCAG AA.
  - *Màu trạng thái ngữ nghĩa*: Xanh lá (`#16A34A` — Đã xác thực / Hoàn tất), Vàng hổ phách (`#D97706` — Đang chờ / Chuyển dự phòng), Đỏ thẫm (`#DC2626` — Đứt kết nối / Lỗi hash), luôn đi kèm nhãn chữ rõ ràng chứ không chỉ dùng màu.
- **Hệ thống chữ (Quy tắc 2+1 Font — hỗ trợ dấu tiếng Việt chuẩn)**:
  - Tiêu đề & nhận diện: **Plus Jakarta Sans** (đậm rõ ràng, cân bằng dòng với `text-wrap: balance`).
  - Nội dung giao diện: **Be Vietnam Pro** (tối ưu tuyệt đối cho tiếng Việt ở kích thước 13px–15px).
  - Số liệu mạng, mã cụm từ, SHA-256, lệnh CLI: **JetBrains Mono** kèm `tabular-nums` để cột tốc độ, độ trễ và dung lượng luôn thẳng hàng không rung giật.
- **Bố cục thích ứng hai thiết bị (Desktop 1440px & Android 390px)**:
  - *Trên Desktop*: Thanh điều hướng bên trái cố định (`256px`), thanh tiêu đề trên cùng 1 hàng gọn gàng (vệt đường dẫn + 1 nút hành động chính), vùng làm việc 2 cột cân bằng (không lồng card-trong-card, ngăn cách bằng khoảng trắng và đường kẻ mảnh).
  - *Trên Android / Mobile*: Thanh tiêu đề gọn (`52px`), toàn bộ vùng bấm tối thiểu `44×44px`, thanh điều hướng 5 tab cố định ở vùng ngón cái phía dưới (`64px`) đảm bảo tổng chiều cao phần cố định luôn dưới 15% màn hình.
  - *Kỷ luật giao diện sạch*: Không dùng cụm pill/chip viền dày cho metadata tĩnh (dùng văn bản gọn phân tách bằng dấu `·`), không dùng thanh viền trái dày, không chấm tròn nhấp nháy trang trí cho nhãn tĩnh (chỉ báo tín hiệu sống khi kết nối WebSocket thực sự đang truyền).

---

## 3. Các Quyết Định Sản Phẩm & Đánh Đổi (Trade-Offs)

- **Quyết định 1 — Tái sử dụng lõi giao thức TypeScript thuần của Croc v11 thay vì viết lại bằng Go/Fyne**
  - *Cách chọn*: Kế thừa trực tiếp thuật toán PAKE (`@noble/curves`, `lossless-json`), HKDF, AES-256-GCM, raw DEFLATE và XXH64 bằng TypeScript/Web Crypto từ `third-party/croc/web`.
  - *Vì sao*: Đảm bảo tương thích từng byte với `croc` CLI và `getcroc.com` mà không phải phụ thuộc vào trình biên dịch Go hay file WebAssembly nặng 6.5 MB; chạy mượt ngay trên trình duyệt, Android WebView (Capacitor) và Electron Desktop.
  - *Phương án đã loại bỏ*: Fork `third-party/crocgui` (Go + Fyne) bị loại vì giao diện Fyne khó tùy biến đẹp, khó bảo trì cho sinh viên mới và không thể chạy thử ngay trên trình duyệt.

- **Quyết định 2 — Chế độ Kép: Chuẩn Croc (Interop) song song với Chế độ Nâng cao (Folder Manifest & Dual-Relay)**
  - *Cách chọn*: Giữ nguyên đường dây chuẩn Croc v11 khi truyền với CLI/`getcroc.com`; khi hai máy cùng dùng CrocFlow có thể bật chế độ Nâng cao để truyền cây thư mục kèm Manifest SHA-256, lưu mảnh Resume cục bộ và chạy 2 Relay song song.
  - *Vì sao*: Nếu tự ý sửa giao thức lõi của Croc, ứng dụng sẽ mất khả năng nói chuyện với `croc` CLI và `getcroc.com`. Tách rõ hai chế độ giúp vừa bảo toàn 100% tính tương thích hệ sinh thái, vừa phô diễn trọn vẹn bài toán Lập trình mạng (Manifest tầng ứng dụng, Dual-Relay, Failover).

- **Quyết định 3 — Server Node.js tích hợp cả Cầu nối Public Relay lẫn Cụm 2 Relay Cục Bộ**
  - *Cách chọn*: Máy chủ Node.js chạy song song (1) cầu nối WebSocket-to-TCP an toàn tới danh sách Relay Croc công cộng và (2) bộ định tuyến 2 Relay cục bộ (Alpha & Beta) hỗ trợ truyền thật giữa hai thiết bị/hai tab ngay trong phòng học.
  - *Vì sao*: Khi thuyết trình tại lớp, mạng Wi-Fi trường học đôi khi chặn cổng TCP `9009–9017` ra ngoài Internet. Có sẵn 2 Relay cục bộ đảm bảo buổi demo trước giảng viên luôn chạy mượt 100%, đồng thời vẫn kết nối ra `1.getcroc.com..4.getcroc.com` khi mạng mở.

- **Quyết định 4 — Đóng gói Android APK & Desktop tự động qua GitHub Actions + Cài đặt PWA trực tiếp**
  - *Cách chọn*: Cung cấp sẵn cấu hình Capacitor (Android), Electron (Desktop) và workflow CI tự build file cài đặt phát hành trên GitHub Releases, đồng thời tích hợp chuẩn PWA đầy đủ ngay trên bản chạy web.
  - *Vì sao*: Người dùng ít kinh nghiệm và giảng viên không cần cài Android Studio, Xcode hay Go — chỉ cần mở link bấm **Install App** (PWA) hoặc tải file `.apk` / `.exe` tạo tự động từ GitHub Releases.

---

## 4. Kiến Trúc Kỹ Thuật & Chiến Lược Dữ Liệu *(Tham Khảo Kỹ Thuật)*

### Sơ Đồ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       CROCFLOW CLIENT (1 Codebase React + TS)                   │
│             [ PWA (Web/Mobile)  │  Android APK (Capacitor)  │  Desktop (Electron) ] │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Giao Diện Thích Ứng (Desktop Sidebar 256px / Mobile Bottom Tabs 64px)          │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ Gửi (Send) │ │ Nhận (Recv)│ │ Relay & Mạng │ │ Lịch Sử &   │ │ Tải App &   │ │
│  │ File/ThưMục│ │ + Resume   │ │ Ping + 2Relay│ │ Nhóm/Pass   │ │ Tài Liệu VI │ │
│  └─────┬──────┘ └─────┬──────┘ └──────┬───────┘ └──────┬──────┘ └─────────────┘ │
│        └──────────────┴───────────────┼────────────────┘                        │
│                                       ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                    BỘ ĐIỀU PHỐI TRUYỀN & SOI GIAO THỨC                    │  │
│  │  • Chuẩn Croc v11 Engine (PAKE, HKDF, AES-256-GCM, DEFLATE, XXH64)        │  │
│  │  • Enhanced Manifest Engine (Cắt Chunk, SHA-256 từng mảnh, Diff Thư mục)  │  │
│  │  • Dual-Relay Scheduler (Chunk Chẵn → Alpha, Chunk Lẻ → Beta + Failover)  │  │
│  │  • Event Bus cho Protocol Inspector (Timeline PAKE, Bản đồ Chunk, Speed)  │  │
│  └──────────────────────────┬─────────────────────────────┬──────────────────┘  │
│                             ▼                             ▼                     │
│                ┌─────────────────────────┐   ┌───────────────────────────────┐  │
│                │ Lưu Trữ Cục Bộ (Client) │   │ Cổng Kết Nối (Transport)      │  │
│                │ • IndexedDB (ChunkCache)│   │ • WebSocket Binary Stream     │  │
│                │ • LocalStorage (History,│   │   (/ws & /ws-dual)            │  │
│                │   Devices, Group Pass)  │   └───────────────┬───────────────┘  │
│                └─────────────────────────┘                   │                  │
└──────────────────────────────────────────────────────────────┼──────────────────┘
                                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     NODE.JS UNIFIED BRIDGE & LAB SERVER (:3000)                 │
│  ┌──────────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │ Public Croc WS-to-TCP Bridge     │   │ Local Dual-Relay Lab (Alpha & Beta) │ │
│  │ • Kiểm tra Allowlist Host & Port │   │ • Phòng truyền bảo mật 2 kênh độc   │ │
│  │ • Chuyển tiếp luồng byte mã hóa  │   │   lập cho Demo 2 Relay & Failover   │ │
│  └────────────────┬─────────────────┘   └─────────────────────────────────────┘ │
└───────────────────┼─────────────────────────────────────────────────────────────┘
                    ▼ (TCP 9009–9017)
┌─────────────────────────────────────────────────────────────────────────────────┐
│              HỆ SINH THÁI CROC (1..4.getcroc.com ◄──► croc CLI / getcroc.com)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Mô Hình Dữ Liệu & Trạng Thái Chính

- **TransferSession**: Đại diện một phiên truyền đang hoạt động (vai trò gửi/nhận, chế độ chuẩn Croc hoặc nâng cao, mã phòng, trạng thái kết nối, tiến độ từng file, tốc độ thực tế bytes/s, thời gian còn lại ETA).
- **FolderManifest**: Cấu trúc JSON ở tầng ứng dụng gồm mã định danh phiên, danh sách tệp kèm đường dẫn tương đối trong thư mục, kích thước mảnh (chunk size), danh sách chỉ số mảnh và mã băm **SHA-256** cho từng mảnh để kiểm tra toàn vẹn và đối chiếu Resume.
- **ChunkResumeRecord (IndexedDB)**: Lưu tạm các mảnh dữ liệu đã giải mã và khớp SHA-256 theo cặp `(manifestId, filePath, chunkIndex)` để khôi phục lập tức sau khi ngắt mạng hoặc tải lại trang.
- **RelayNode**: Thông tin từng máy chủ Relay (nhãn, địa chỉ, loại công cộng/nội bộ/tùy chỉnh, độ trễ RTT đo được tính bằng `ms`, trạng thái trực tuyến, vai trò Alpha/Beta).
- **ProtocolEvent**: Sự kiện thật phát ra trực tiếp từ tầng giao thức (dấu thời gian, pha PAKE/HKDF/Chunk/Failover, chiều gửi/nhận, kích thước byte, kênh Relay) nuôi giao diện Protocol Inspector.
- **HistoryEntry & GroupPassphrase**: Lịch sử các phiên đã thực hiện và danh sách phòng/mật khẩu nhóm cố định hỗ trợ xoay vòng khóa tự động theo chu kỳ `YYYY-MM`.

### Ánh Xạ Tương Tác & Trạng Thái

- **Chọn File / Thư mục & Tạo Mã Gửi**: Xác thực dung lượng và cấu trúc thư mục → tự chọn Relay nhanh nhất hoặc khởi tạo đồng thời 2 kết nối Relay → băm kiểm lỗi (XXH64 cho chuẩn Croc, SHA-256 cho chế độ Manifest) → tạo mã cụm từ & QR → đẩy luồng mã hóa và cập nhật thanh tiến độ + biểu đồ Protocol Inspector.
- **Nhận, Gián đoạn & Resume Thư mục**: Nhập mã → thực hiện bắt tay PAKE & giải mã Manifest → tự động đối chiếu IndexedDB để đánh dấu các mảnh đã có sẵn màu xanh (bỏ qua không tải lại) → nếu ngắt mạng và người gửi thêm file mới vào thư mục, phiên nối lại chỉ yêu cầu các mảnh của file mới + phần dang dở.
- **Đo Độ Trễ & Ngắt Thử Relay 1 (Failover)**: Bấm **Đo độ trễ** gửi gói ping thật tới từng Relay và cập nhật bảng xếp hạng RTT; trong phiên Dual-Relay, gạt công tắc **Ngắt Relay 1 (Alpha)** sẽ đóng kênh 1 ngay lập tức, hệ thống phát hiện lỗi kênh và tự động chuyển toàn bộ các chunk chẵn chưa hoàn tất sang đi qua **Relay 2 (Beta)**, ghi nhận rõ sự kiện Failover vào Protocol Inspector.
- **Chuyển Theme, Cài PWA & Xuất Tài Liệu**: Nút đổi Dark/Light đồng bộ tức thì lớp `.dark` và lưu lựa chọn; nút **Install App** kích hoạt hộp thoại cài đặt PWA trình duyệt (hoặc hướng dẫn Safari trên iOS); nút **Xuất tài liệu báo cáo** đóng gói kiến thức mạng và lịch sử phiên thành file `.md` tải về máy.

### Đảm Bảo An Toàn & Bảo Mật Máy Chủ

- **Danh sách cho phép nghiêm ngặt trên cầu nối `/ws`**: Máy chủ chỉ chấp nhận kết nối TCP tới danh sách Relay và cổng được cấu hình sẵn (`1..4.getcroc.com` hoặc máy chủ cấu hình qua biến môi trường), ngăn chặn tuyệt đối việc lợi dụng cầu nối truy cập trái phép vào địa chỉ mạng nội bộ.
- **Mã hóa đầu-cuối tuyệt đối (Zero-Knowledge Bridge)**: Mọi khóa phiên PAKE/HKDF và mã hóa AES-256-GCM đều chạy hoàn toàn trên thiết bị người dùng; máy chủ cầu nối và Relay chỉ chuyển tiếp dữ liệu đã mã hóa và không bao giờ lưu giữ mật khẩu hay nội dung file.
- **Làm sạch đường dẫn khi nhận thư mục**: Mọi đường dẫn tệp trong Manifest đều được chuẩn hóa và chặn ký tự leo thư mục (`..`, đường dẫn tuyệt đối) trước khi lưu xuống máy nhận.

### Quy Trình Wayfinder & Bộ Tài Liệu Đi Kèm Sau Khi Duyệt

Ngay khi bạn bấm **Proceed**, quá trình triển khai sẽ thực hiện tuần tự và đầy đủ:
1. Khởi tạo **Wayfinder Map**, hệ thống **Decision Tickets** trong bộ theo dõi cục bộ, **Glossary** (từ điển thuật ngữ thống nhất cho cả nhóm) và các **ADR** giải thích lý do chọn kiến trúc.
2. Xây dựng hoàn chỉnh ứng dụng **CrocFlow** (Server Bridge + Local Dual-Relay + Giao diện Desktop/Android + Lõi giao thức Croc v11 + 4 tính năng mở rộng + PWA + Cấu hình Capacitor Android & Electron Desktop + GitHub Actions tự build file cài đặt).
3. Viết bộ tài liệu tiếng Việt chi tiết từ con số 0 (Giải thích kiến thức mạng & mã nguồn, Hướng dẫn chạy & đóng gói APK/EXE không cần biết code, và Kịch bản demo thuyết trình trước giảng viên) cùng kiểm thử tự động và kiểm tra thực tế trên trình duyệt ở cả kích thước Desktop và Mobile.
