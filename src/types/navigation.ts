export type NavDestinationId = "send" | "receive" | "relays" | "history" | "docs";

export interface NavDestination {
  id: NavDestinationId;
  label: string;
  shortLabel: string;
  breadcrumb: string;
  summary: string;
  ticketNumber: string;
}

export const NAV_DESTINATIONS: NavDestination[] = [
  {
    id: "send",
    label: "Gửi tệp & thư mục",
    shortLabel: "Gửi",
    breadcrumb: "Gửi",
    summary:
      "Chọn tệp, nguyên thư mục hoặc văn bản ngắn, tạo Codephrase mã hóa PAKE và chia sẻ mã QR.",
    ticketNumber: "Ticket 02 · Ticket 04 · Ticket 05",
  },
  {
    id: "receive",
    label: "Nhận tệp & Resume",
    shortLabel: "Nhận",
    breadcrumb: "Nhận",
    summary:
      "Nhập Codephrase từ CrocFlow, croc CLI hoặc getcroc.com, xem trước tệp và tiếp tục tải từ Resume Cache.",
    ticketNumber: "Ticket 02 · Ticket 04",
  },
  {
    id: "relays",
    label: "Relay & Mạng",
    shortLabel: "Relay",
    breadcrumb: "Relay & Mạng",
    summary:
      "Giám sát cụm Relay công cộng của Croc, đo độ trễ RTT thực tế và vận hành phòng Lab 2 Relay (Alpha & Beta).",
    ticketNumber: "Ticket 03 · Ticket 05",
  },
  {
    id: "history",
    label: "Lịch sử & Nhóm",
    shortLabel: "Lịch sử",
    breadcrumb: "Lịch sử & Nhóm",
    summary:
      "Tra cứu các Transfer Session đã lưu, đặt Device Alias và quản lý Group Passphrase xoay vòng theo tháng.",
    ticketNumber: "Ticket 06",
  },
  {
    id: "docs",
    label: "Tải App & Tài liệu",
    shortLabel: "Tài liệu",
    breadcrumb: "Tải App & Tài liệu",
    summary:
      "Cài đặt ứng dụng Android APK / Desktop / PWA và đọc tài liệu Lập trình mạng giải thích từ con số 0.",
    ticketNumber: "Ticket 08 · Ticket 09",
  },
];
