import { useState } from "react";
import {
  BookOpen,
  Download,
  FileDown,
  Laptop,
  Presentation,
  Smartphone,
  Terminal,
  Check,
  Copy,
} from "lucide-react";
import { PWAInstallButton } from "./PWAInstallButton";
import type { TransferHistoryEntry } from "../lib/history-store";
import { downloadTextFile, formatBytes, formatDateTimeVi } from "../lib/format";

export interface AppDocsHubViewProps {
  history: TransferHistoryEntry[];
  deviceAlias: string;
}

type DocTab = "networking" | "architecture" | "demo";

export function AppDocsHubView({ history, deviceAlias }: AppDocsHubViewProps) {
  const [activeDoc, setActiveDoc] = useState<DocTab>("networking");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyCommand = async (id: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleExportAcademicReport = () => {
    const lines = [
      "# BÁO CÁO ĐỒ ÁN MẠNG MÁY TÍNH — CROCFLOW",
      "",
      `- **Thiết bị xuất báo cáo:** ${deviceAlias}`,
      `- **Thời điểm xuất:** ${formatDateTimeVi(Date.now())}`,
      "",
      "## 1. Kiến trúc tổng quan (1 Codebase — Đa nền tảng)",
      "- **Frontend:** React + TypeScript + Tailwind CSS đóng gói đồng thời thành Web App (PWA), Android APK (Capacitor) và Desktop App Windows/macOS/Linux (Electron).",
      "- **Backend Bridge & Local Dual-Relay Lab:** Node.js + Express + WebSocket (`server.ts`) cung cấp cầu nối TCP allowlisted `/ws` (chống SSRF) cho chuẩn Croc v11 gốc và cặp Relay cục bộ Alpha/Beta `/ws-dual` cho chế độ chia tải Chunk Chẵn/Lẻ.",
      "",
      "## 2. Cơ chế giao thức & Bảo mật đầu cuối (Zero-Knowledge E2E)",
      "1. **Chế độ Chuẩn Croc v11:** Tương thích 100% với `croc` CLI và `getcroc.com` qua giao thức PAKE v2 (P-256) + HKDF-SHA-256 + AES-256-GCM + XXH64.",
      "2. **Chế độ Nâng cao CrocFlow:** Bắt tay ECDH P-256 + HKDF-SHA-256 + xác thực Codephrase 2 chiều, lập Folder Manifest có SHA-256 cho từng Chunk, lưu bộ nhớ đệm Resume Cache trong IndexedDB.",
      "3. **Dual-Relay Multi-path & Failover:** Chunk chẵn (`0, 2, 4...`) gửi qua Relay Alpha; Chunk lẻ (`1, 3, 5...`) gửi qua Relay Beta. Khi Relay Alpha mất kết nối, `DualRelayScheduler` tự động định tuyến toàn bộ chunk chẵn chưa hoàn tất sang Relay Beta không cần bắt đầu lại.",
      "",
      `## 3. Nhật ký phiên kiểm thử thực tế đã ghi nhận (${history.length} phiên)`,
      ...(history.length === 0
        ? ["- (Chưa có phiên truyền nào được ghi nhận trên thiết bị này)"]
        : history.map(
            (h) =>
              `- [${formatDateTimeVi(h.timestamp)}] **${h.direction === "send" ? "GỬI" : "NHẬN"}** \`${h.summaryName}\` (${formatBytes(h.totalBytes)}) · Chế độ: ${h.mode === "enhanced" ? (h.dualRelay ? "Dual-Relay Nâng cao" : "Manifest Nâng cao") : "Croc v11"} · Xác thực: ${h.verifiedHash}${h.failoverTriggered ? " · Đã kích hoạt Failover" : ""}${h.resumedChunks ? ` · Resume bỏ qua ${h.resumedChunks} chunks` : ""}`,
          )),
    ];
    downloadTextFile(`BaoCao_CrocFlow_${new Date().toISOString().slice(0, 10)}.md`, lines.join("\n"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tải App & Tài liệu học thuật
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Hướng dẫn cài đặt cho Android, Desktop, kết nối với Croc CLI và cẩm nang giải thích kiến thức mạng khi vấn đáp giảng viên.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportAcademicReport}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
        >
          <FileDown className="h-4 w-4" aria-hidden="true" />
          Xuất Báo Cáo Học Thuật (.md)
        </button>
      </div>

      {/* Multi-Platform Install & Distribution Hub */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Android Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Android (PWA & File APK)
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <strong>Cách nhanh nhất cho giảng viên:</strong> Mở URL ứng dụng bằng Chrome trên Android và nhấn nút Cài ứng dụng để đưa ra màn hình chính như app gốc.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              <strong>File .apk cài trực tiếp:</strong> Đẩy mã nguồn lên GitHub → mở tab <strong>Actions → Build CrocFlow Releases</strong> → tải artifact <code className="font-mono">CrocFlow-Android-APK</code> (tự động build bằng Capacitor + Gradle).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <PWAInstallButton />
          </div>
        </div>

        {/* Desktop Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2">
              <Laptop className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Desktop (Windows / macOS / Linux)
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Gói Electron tại <code className="font-mono">packaging/desktop/</code> tích hợp sẵn Embedded Node Bridge Server nên mở app là chạy ngay cả 2 Relay cục bộ mà không cần gõ lệnh terminal.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              GitHub Actions tự build đủ 3 bản cài đặt: Windows <code className="font-mono">.exe</code>, macOS <code className="font-mono">.dmg</code>, Linux <code className="font-mono">.AppImage</code>.
            </p>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 font-mono text-[11px] text-slate-500 dark:border-slate-800">
            <Download className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            GitHub Actions → Artifacts → CrocFlow-Desktop
          </div>
        </div>

        {/* Croc CLI Interop Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Tương tác với Croc CLI & Web
              </h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Khi chọn chế độ <strong>Chuẩn Croc v11</strong>, CrocFlow nói cùng một giao thức nhị phân PAKE v2 với bản dòng lệnh chính thức và <code className="font-mono">getcroc.com</code>.
            </p>
            <div className="mt-3 space-y-2">
              {[
                { id: "send", label: "Gửi từ máy tính CLI", cmd: "croc send bao-cao.pdf" },
                { id: "recv", label: "Nhận trên máy tính CLI", cmd: "croc 4281-mango-solar-river" },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2 font-mono text-[11px] text-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  <span className="truncate">{item.cmd}</span>
                  <button
                    type="button"
                    onClick={() => void copyCommand(item.id, item.cmd)}
                    aria-label={`Sao chép lệnh ${item.label}`}
                    className="shrink-0 text-slate-500 hover:text-teal-600"
                  >
                    {copiedCmd === item.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Study Reader for Beginners & Lecturer Defense */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          {[
            { id: "networking" as const, label: "Kiến thức mạng từ con số 0", icon: BookOpen },
            { id: "architecture" as const, label: "Giải thích mã nguồn CrocFlow", icon: Laptop },
            { id: "demo" as const, label: "Kịch bản Demo 5 phút & Vấn đáp", icon: Presentation },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeDoc === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDoc(tab.id)}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-4 p-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {activeDoc === "networking" && (
            <>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                1. Tại sao hai máy tính không thể gửi tệp trực tiếp cho nhau mà cần Relay?
              </h3>
              <p>
                Hầu hết máy tính và điện thoại nằm sau router Wi-Fi sử dụng <strong>NAT (Network Address Translation)</strong> và tường lửa. Máy bạn chỉ có IP nội bộ (như <code className="font-mono">192.168.1.5</code>) nên máy ở mạng khác không thể tự mở kết nối TCP tới bạn. <strong>Relay Server</strong> đóng vai trò "phòng gặp mặt trung gian" có địa chỉ công cộng: cả người gửi lẫn người nhận đều chủ động kết nối ra ngoài tới Relay cùng một tên phòng (Room), rồi Relay chuyển tiếp gói tin qua lại.
              </p>

              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                2. PAKE + HKDF + AES-256-GCM là gì? Relay có đọc trộm được tệp không?
              </h3>
              <p>
                <strong>Không!</strong> Trước khi gửi bất kỳ byte dữ liệu nào, hai máy thực hiện bắt tay mật mã <strong>PAKE (Password-Authenticated Key Exchange)</strong> dựa trên đường cong Elliptic P-256. Hai bên dùng mã bí mật ngắn (Codephrase) để đồng thuận ra một khóa phiên mạnh 256-bit thông qua <strong>HKDF-SHA-256</strong> mà <em>không bao giờ gửi nguyên văn Codephrase qua mạng</em>. Sau đó mọi tệp đều bị mã hóa bằng <strong>AES-256-GCM</strong> trên máy gửi trước khi chạm tới Relay — Relay chỉ thấy các khối byte ngẫu nhiên.
              </p>

              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                3. Tại sao phải cắt Chunk, dùng Folder Manifest SHA-256 và chia 2 Relay?
              </h3>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Cắt Chunk & SHA-256:</strong> Thay vì gửi nguyên khối lớn (đứt mạng ở 95% phải gửi lại từ đầu), CrocFlow cắt từng tệp trong thư mục thành các mảnh nhỏ 16–256 KB kèm mã băm SHA-256. Máy nhận lưu từng mảnh đã kiểm tra đúng vào <strong>IndexedDB Resume Cache</strong>. Khi kết nối lại (kể cả khi bạn thêm tệp mới vào thư mục), máy nhận chỉ yêu cầu gửi các mảnh còn thiếu.
                </li>
                <li>
                  <strong>Chia tải 2 Relay (Alpha Chẵn / Beta Lẻ) & Failover:</strong> Các mảnh đánh số chẵn (<code className="font-mono">0, 2, 4...</code>) đi qua Relay Alpha, mảnh lẻ (<code className="font-mono">1, 3, 5...</code>) đi qua Relay Beta để tận dụng băng thông song song. Nếu Relay Alpha bị sập giữa chừng, bộ lập lịch <code className="font-mono">DualRelayScheduler</code> tự động chuyển toàn bộ mảnh chẵn chưa tới đích sang Relay Beta.
                </li>
              </ul>
            </>
          )}

          {activeDoc === "architecture" && (
            <>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Bản đồ các khối mã nguồn chính (dùng khi giảng viên hỏi "chỗ này code ở đâu?")
              </h3>
              <ul className="space-y-2.5 text-xs">
                <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60">
                  <strong className="font-mono text-teal-700 dark:text-teal-400">server.ts & server/bridge-allowlist.ts</strong>
                  <p className="mt-1">
                    Máy chủ Express + WebSocket chạy cổng 3000. Cung cấp cầu nối <code className="font-mono">/ws</code> nối trình duyệt tới TCP Relay của Croc gốc (có danh sách trắng host/port chặn SSRF) và endpoint <code className="font-mono">/api/relays/ping</code> đo RTT thật.
                  </p>
                </li>
                <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60">
                  <strong className="font-mono text-teal-700 dark:text-teal-400">server/local-dual-relay.ts</strong>
                  <p className="mt-1">
                    Triển khai cặp phòng Relay độc lập <strong>Alpha</strong> và <strong>Beta</strong> trên <code className="font-mono">/ws-dual</code>, đếm số byte và gói tin chuyển tiếp thật theo từng kênh.
                  </p>
                </li>
                <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60">
                  <strong className="font-mono text-teal-700 dark:text-teal-400">src/protocol/croc/*</strong>
                  <p className="mt-1">
                    Bộ giao thức Croc v11 viết thuần TypeScript (PAKE P-256, XXH64, nén, cắt luồng) tương thích trực tiếp với <code className="font-mono">croc</code> CLI và <code className="font-mono">getcroc.com</code> mà không cần Go WASM.
                  </p>
                </li>
                <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/60">
                  <strong className="font-mono text-teal-700 dark:text-teal-400">src/protocol/enhanced/manifest.ts · dual-relay-scheduler.ts · resume-cache.ts · enhanced-client.ts</strong>
                  <p className="mt-1">
                    Lõi tính năng mở rộng: lập Folder Manifest có kiểm tra chống path traversal (<code className="font-mono">sanitizeRelativePath</code>), chia tải Chẵn/Lẻ & Failover, lưu Chunk đã xác thực vào IndexedDB.
                  </p>
                </li>
              </ul>
            </>
          )}

          {activeDoc === "demo" && (
            <>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Kịch bản thuyết trình 5 phút trước giảng viên
              </h3>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  <strong>Phút 1 — Tương thích hệ sinh thái Croc:</strong> Chuyển tab <em>Gửi → Chuẩn Croc v11</em>, chọn 1 tệp, hiện mã QR và lệnh <code className="font-mono">croc &lt;codephrase&gt;</code>, nhận thử từ Terminal hoặc máy khác để chứng minh tương thích 100% với bản gốc.
                </li>
                <li>
                  <strong>Phút 2 — Demo 2 Relay + Failover trực tiếp:</strong> Chuyển sang <em>Nâng cao CrocFlow</em>, nhấn <strong>Chạy Demo 2 Relay + Failover trực tiếp</strong>. Chỉ cho thầy xem <em>Bảng soi giao thức</em>: 5 bước PAKE chuyển xanh, lưới Chunk chia màu Alpha (chẵn) / Beta (lẻ), rồi giữa chừng ngắt Relay Alpha → các ô chuyển màu vàng Failover sang Beta nhưng toàn bộ tệp vẫn ghép đủ SHA-256 100%.
                </li>
                <li>
                  <strong>Phút 3 — Demo Đứt mạng & Thêm tệp Resume:</strong> Nhấn <strong>Demo Đứt mạng & Thêm tệp Resume</strong>. Giải thích cách IndexedDB giữ lại các chunk đã tải, bỏ qua khi kết nối lại (ô màu tím Resume), đồng thời tự phát hiện tệp mới thêm vào thư mục.
                </li>
                <li>
                  <strong>Phút 4 — Đo độ trễ Relay & Passphrase nhóm xoay vòng:</strong> Mở tab <em>Relay & Mạng</em> nhấn <strong>Đo độ trễ (Ping RTT)</strong> để xem xếp hạng tốc độ; mở <em>Lịch sử & Nhóm</em> tạo 1 khóa nhóm hàng tháng rồi nhấn <strong>Dùng để Gửi</strong>.
                </li>
                <li>
                  <strong>Phút 5 — Xuất báo cáo & Đóng gói App:</strong> Mở <em>Tải App & Tài liệu</em>, nhấn <strong>Xuất Báo Cáo Học Thuật (.md)</strong> và trình bày nút cài đặt PWA / pipeline GitHub Actions tự build APK & Desktop.
                </li>
              </ol>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
