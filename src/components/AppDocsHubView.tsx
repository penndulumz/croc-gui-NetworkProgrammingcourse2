import { useEffect, useRef, useState } from "react";
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
  FlaskConical,
  Play,
  Square,
  WifiOff,
  AlertCircle,
  ShieldCheck,
  Database,
  Layers,
  Zap,
  Network,
  Activity,
  ArrowRight,
} from "lucide-react";
import { PWAInstallButton } from "./PWAInstallButton";
import { appendTransferHistory, type TransferHistoryEntry } from "../lib/history-store";
import { downloadTextFile, formatBytes, formatDateTimeVi } from "../lib/format";
import {
  runLoopbackDualRelayFailoverDemo,
  runLoopbackFolderResumeDemo,
  type EnhancedControlHandle,
  type EnhancedProgress,
  type EnhancedSendResult,
} from "../protocol/enhanced/enhanced-client";
import { RollingMetricsTracker, formatEta, formatSpeed } from "../lib/metrics";

export interface AppDocsHubViewProps {
  history: TransferHistoryEntry[];
  deviceAlias: string;
  onHistoryUpdated?: () => void;
}

type DocTab = "networking" | "architecture" | "demo";

export function AppDocsHubView({ history, deviceAlias, onHistoryUpdated }: AppDocsHubViewProps) {
  const [activeDoc, setActiveDoc] = useState<DocTab>("networking");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Demo Runner States
  const [runningDemo, setRunningDemo] = useState<"demo1" | "demo2" | null>(null);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [progress, setProgress] = useState<EnhancedProgress | null>(null);
  const [alphaSevered, setAlphaSevered] = useState(false);
  const [metrics, setMetrics] = useState<{
    speedBps: number;
    etaSeconds: number | null;
    isStalled: boolean;
  }>({
    speedBps: 0,
    etaSeconds: null,
    isStalled: false,
  });

  const [demo1Result, setDemo1Result] = useState<EnhancedSendResult | null>(null);
  const [demo2Result, setDemo2Result] = useState<{
    stage1CachedChunks: number;
    stage2Result: EnhancedSendResult;
    newFileDetected: string;
  } | null>(null);

  const metricsTrackerRef = useRef<RollingMetricsTracker | null>(null);
  const enhancedHandleRef = useRef<EnhancedControlHandle | null>(null);

  useEffect(() => {
    if (!runningDemo) return;
    const interval = setInterval(() => {
      if (metricsTrackerRef.current) {
        setMetrics(metricsTrackerRef.current.getSnapshot());
      }
    }, 500);
    return () => clearInterval(interval);
  }, [runningDemo]);

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

  const handleRunDualRelayDemo = async () => {
    setErrorText(null);
    setSuccessText(null);
    setProgress(null);
    setDemo1Result(null);
    setDemo2Result(null);
    setAlphaSevered(false);
    metricsTrackerRef.current = new RollingMetricsTracker();
    setMetrics({ speedBps: 0, etaSeconds: null, isStalled: false });
    setRunningDemo("demo1");
    setStatusText("Đang khởi tạo máy Gửi & Nhận loopback qua /ws-dual...");

    const demoCode = "4281-dual-relay-lab";
    try {
      const res = await runLoopbackDualRelayFailoverDemo({
        codephrase: demoCode,
        onStatus: setStatusText,
        onProgress: (p) => {
          setProgress(p);
          if (metricsTrackerRef.current) {
            setMetrics(metricsTrackerRef.current.update(p.bytesTransferred, p.totalBytes));
          }
        },
        onHandleReady: (h) => {
          enhancedHandleRef.current = h;
        },
      });

      setDemo1Result(res);
      appendTransferHistory({
        direction: "send",
        mode: "enhanced",
        dualRelay: true,
        codephrase: demoCode,
        fileCount: res.manifest.totalFiles,
        summaryName: "BaoCao_MangMayTinh/ (Demo 1: Dual-Relay & Failover)",
        totalBytes: res.manifest.totalBytes,
        status: "completed",
        verifiedHash: "SHA-256",
        failoverTriggered: res.failoverRerouted > 0,
        deviceAlias,
      });
      onHistoryUpdated?.();
      setSuccessText(
        `Demo 1 Hoàn tất! Alpha đã chuyển ${res.alphaDelivered} chunk chẵn · Beta đã chuyển ${res.betaDelivered} chunk (gồm ${res.failoverRerouted} chunk Failover sau khi ngắt Alpha). Khớp SHA-256 100%.`,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setErrorText(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunningDemo(null);
      enhancedHandleRef.current = null;
    }
  };

  const handleSimulateAlphaDisconnect = () => {
    if (enhancedHandleRef.current) {
      enhancedHandleRef.current.simulateAlphaDisconnect();
      setAlphaSevered(true);
      setStatusText("Đã cắt kết nối Relay Alpha thủ công! Quan sát các chunk chẵn lập tức chuyển hướng sang Relay Beta...");
    }
  };

  const handleCancelDemo = () => {
    enhancedHandleRef.current?.cancel();
    setRunningDemo(null);
    enhancedHandleRef.current = null;
    setStatusText("Đã dừng phiên chạy demo.");
  };

  const handleRunResumeDemo = async () => {
    setErrorText(null);
    setSuccessText(null);
    setProgress(null);
    setDemo1Result(null);
    setDemo2Result(null);
    setAlphaSevered(false);
    metricsTrackerRef.current = new RollingMetricsTracker();
    setMetrics({ speedBps: 0, etaSeconds: null, isStalled: false });
    setRunningDemo("demo2");
    setStatusText("Giai đoạn 1/2: Đang truyền 6 chunk đầu và lưu vào IndexedDB Resume Cache...");

    const demoCode = `resume-${Date.now().toString(36)}`;
    try {
      const res = await runLoopbackFolderResumeDemo({
        codephrase: demoCode,
        onStatus: setStatusText,
        onProgress: (p) => {
          setProgress(p);
          if (metricsTrackerRef.current) {
            setMetrics(metricsTrackerRef.current.update(p.bytesTransferred, p.totalBytes));
          }
        },
      });

      setDemo2Result(res);
      appendTransferHistory({
        direction: "send",
        mode: "enhanced",
        dualRelay: true,
        codephrase: demoCode,
        fileCount: res.stage2Result.manifest.totalFiles,
        summaryName: "BaoCao_MangMayTinh/ (Demo 2: Resume + Tệp mới)",
        totalBytes: res.stage2Result.manifest.totalBytes,
        status: "resumed",
        verifiedHash: "SHA-256",
        resumedChunks: res.stage2Result.resumedChunks,
        deviceAlias,
      });
      onHistoryUpdated?.();
      setSuccessText(
        `Demo 2 Hoàn tất! Đã bỏ qua ${res.stage2Result.resumedChunks} chunk đã lưu trong IndexedDB Resume Cache, tự động phát hiện & tải thêm tệp mới '${res.newFileDetected}' với SHA-256 khớp 100%.`,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setErrorText(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunningDemo(null);
    }
  };

  const progressPercent =
    progress && progress.totalChunks > 0
      ? Math.min(100, Math.round((progress.completedChunks / progress.totalChunks) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tải App, Tài liệu & Phòng thí nghiệm
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Hướng dẫn cài đặt cho Android, Desktop, phòng thí nghiệm tương tác mô phỏng 2 Relay và cẩm nang vấn đáp đồ án mạng máy tính.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportAcademicReport}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-teal-700"
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

      {/* DEDICATED LECTURER DEMO & LAB SECTION */}
      <section className="rounded-xl border border-teal-200/80 bg-white p-5 shadow-xs dark:border-teal-900/50 dark:bg-slate-900">
        {/* Lab Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  Phòng Thí Nghiệm & Báo Cáo Giảng Viên (Lecturer Demo Lab)
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
                  Mô phỏng 1-Click
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Thực nghiệm trực tiếp qua WebSocket thật (<code className="font-mono">/ws-dual</code>): chia tải 2 kênh Relay, ngắt kết nối chịu lỗi (Failover) và cơ chế Resume Cache từ IndexedDB.
              </p>
            </div>
          </div>
        </div>

        {/* Two Interactive Demo Cards */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* DEMO 1: DUAL-RELAY & LIVE FAILOVER */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
                    <Zap className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Demo 1: Dual-Relay Multi-Path & Failover
                    </h3>
                    <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                      Multi-path TCP Analog · Phân bổ Chẵn/Lẻ · Tái định tuyến
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2 rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-600 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Quy trình mô phỏng khi vấn đáp:
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-[11px]">
                  <li>Khởi chạy đồng thời Sender và Receiver nội bộ qua kênh <code className="font-mono">/ws-dual</code>.</li>
                  <li>Bộ lập lịch gán <strong>Chunk Chẵn</strong> vào Relay Alpha, <strong>Chunk Lẻ</strong> vào Relay Beta.</li>
                  <li>Nhấn nút <em>Cắt kết nối Relay Alpha</em> (hoặc đợi mốc 45%) để quan sát toàn bộ chunk chẵn chuyển sang Beta.</li>
                  <li>Xác nhận toàn bộ chunk được ghép hoàn chỉnh với SHA-256 khớp 100%.</li>
                </ol>
              </div>

              {/* Live Status when Demo 1 is running */}
              {runningDemo === "demo1" && (
                <div className="mt-3.5 space-y-2.5 rounded-lg border border-teal-300 bg-teal-50/80 p-3 text-xs dark:border-teal-800 dark:bg-teal-950/50">
                  <div className="flex items-center justify-between font-medium text-teal-900 dark:text-teal-200">
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-2 w-2 rounded-full bg-teal-600 animate-pulse" aria-hidden="true" />
                      <span className="truncate">{statusText}</span>
                    </div>
                    {progressPercent > 0 && (
                      <span className="font-mono font-bold tabular-nums">{progressPercent}%</span>
                    )}
                  </div>

                  {progressPercent > 0 && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-teal-600 transition-all duration-150 dark:bg-teal-400"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Metrics & Chunk Counts */}
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Tốc độ</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatSpeed(metrics.speedBps)}</span>
                    </div>
                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Còn lại (ETA)</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatEta(metrics.etaSeconds, metrics.isStalled)}</span>
                    </div>
                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Alpha (Chẵn)</span>
                      <span className="font-bold text-teal-700 dark:text-teal-300">{progress?.alphaChunks ?? 0}</span>
                    </div>
                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Beta (Lẻ/Failover)</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {progress?.betaChunks ?? 0}
                        {progress && progress.failoverChunks > 0 && ` (${progress.failoverChunks} failover)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 dark:text-slate-400">
                      Trạng thái Relay Alpha:{" "}
                      <strong className={progress?.alphaAlive && !alphaSevered ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                        {progress?.alphaAlive && !alphaSevered ? "Đang kết nối (Online)" : "Đã ngắt (Disconnected)"}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Demo 1 Result Box */}
              {demo1Result && !runningDemo && (
                <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50/90 p-3 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>Kết quả Thực nghiệm Demo 1 thành công:</span>
                  </div>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11px]">
                    <li>Tổng tệp: <strong>{demo1Result.manifest.totalFiles} tệp</strong> ({formatBytes(demo1Result.manifest.totalBytes)})</li>
                    <li>Relay Alpha (Chẵn): <strong>{demo1Result.alphaDelivered} chunks</strong></li>
                    <li>Relay Beta (Lẻ + Failover): <strong>{demo1Result.betaDelivered} chunks</strong> (trong đó <strong>{demo1Result.failoverRerouted} chunks</strong> tái định tuyến sau khi ngắt Alpha)</li>
                    <li>Toàn vẹn mật mã: <strong>SHA-256 khớp 100%</strong></li>
                  </ul>
                </div>
              )}
            </div>

            {/* Demo 1 Buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              {runningDemo !== "demo1" ? (
                <button
                  type="button"
                  disabled={runningDemo !== null}
                  onClick={() => void handleRunDualRelayDemo()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Khởi chạy Demo 1: Multi-Path & Failover
                </button>
              ) : (
                <>
                  {progress?.alphaAlive && !alphaSevered && (
                    <button
                      type="button"
                      onClick={handleSimulateAlphaDisconnect}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-amber-500/60 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-400/40 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      <WifiOff className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                      Cắt kết nối Relay Alpha (Disconnect Alpha)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelDemo}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                  >
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    Dừng Demo
                  </button>
                </>
              )}
            </div>
          </div>

          {/* DEMO 2: FOLDER MANIFEST & RESUME CACHE */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                    <Database className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Demo 2: Folder Manifest & Resume khi Thêm Tệp Mới
                    </h3>
                    <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">
                      IndexedDB Resume Cache · Bỏ qua Chunk cũ · Tải tệp mới
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2 rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-600 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Quy trình mô phỏng 2 giai đoạn:
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-[11px]">
                  <li><strong>Giai đoạn 1:</strong> Truyền 6 chunk đầu vào IndexedDB rồi ngắt kết nối đột ngột (giả lập rớt mạng).</li>
                  <li><strong>Giai đoạn 2:</strong> Bổ sung tệp mới <code className="font-mono">PhuLuc_MoiThemSauMatMang.bin</code> vào manifest và kết nối lại.</li>
                  <li>Lập <strong>Resume Plan</strong>: Đối chiếu băm SHA-256 để bỏ qua 100% các chunk đã có trong IndexedDB.</li>
                  <li>Chỉ truyền các chunk còn thiếu và tệp mới, ghép đủ toàn bộ thư mục.</li>
                </ol>
              </div>

              {/* Live Status when Demo 2 is running */}
              {runningDemo === "demo2" && (
                <div className="mt-3.5 space-y-2.5 rounded-lg border border-indigo-300 bg-indigo-50/80 p-3 text-xs dark:border-indigo-800 dark:bg-indigo-950/50">
                  <div className="flex items-center justify-between font-medium text-indigo-900 dark:text-indigo-200">
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" aria-hidden="true" />
                      <span className="truncate">{statusText}</span>
                    </div>
                    {progressPercent > 0 && (
                      <span className="font-mono font-bold tabular-nums">{progressPercent}%</span>
                    )}
                  </div>

                  {progressPercent > 0 && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-150 dark:bg-indigo-400"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-3">
                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Tốc độ</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatSpeed(metrics.speedBps)}</span>
                    </div>
                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Tiến độ Chunks</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {progress?.completedChunks ?? 0} / {progress?.totalChunks ?? 0}
                      </span>
                    </div>
                    <div className="rounded bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Bỏ qua Resume</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {progress?.resumedChunks ?? 0} chunks
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Demo 2 Result Box */}
              {demo2Result && !runningDemo && (
                <div className="mt-3 rounded-lg border border-indigo-300 bg-indigo-50/90 p-3 text-xs text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    <span>Kết quả Thực nghiệm Demo 2 thành công:</span>
                  </div>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11px]">
                    <li>Giai đoạn 1 lưu đệm: <strong>{demo2Result.stage1CachedChunks} chunks</strong> trong IndexedDB Resume Cache</li>
                    <li>Phát hiện tệp mới bổ sung: <code className="font-mono">{demo2Result.newFileDetected}</code></li>
                    <li>Bỏ qua dữ liệu cũ: <strong>{demo2Result.stage2Result.resumedChunks} chunks</strong> không cần truyền lại</li>
                    <li>Toàn vẹn thư mục mới: <strong>{demo2Result.stage2Result.manifest.totalFiles} tệp</strong> với <strong>SHA-256 khớp 100%</strong></li>
                  </ul>
                </div>
              )}
            </div>

            {/* Demo 2 Buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              {runningDemo !== "demo2" ? (
                <button
                  type="button"
                  disabled={runningDemo !== null}
                  onClick={() => void handleRunResumeDemo()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Khởi chạy Demo 2: Đứt mạng & Resume tệp mới
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelDemo}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  Dừng Demo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Global Demo Status / Error / Success Alerts */}
        {(errorText || successText) && (
          <div className="mt-4 space-y-2">
            {errorText && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            )}
            {successText && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{successText}</span>
              </div>
            )}
          </div>
        )}

        {/* VIETNAMESE EXPLANATORY CALLOUTS FOR NETWORKING CONCEPTS */}
        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Cẩm Nang Giải Thích Cơ Chế Mạng Khi Báo Cáo Giảng Viên (Networking Core Concepts)
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {/* Concept 1: Multi-path TCP Analog */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-semibold">
                <Network className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h4>1. Tương đồng Multi-path TCP (MPTCP RFC 8684) Tầng Ứng Dụng</h4>
              </div>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Ở tầng giao vận, MPTCP cho phép một phiên truyền đi qua nhiều card mạng (ví dụ kết hợp cả Wi-Fi và 4G/LTE). Ở tầng ứng dụng, <strong>CrocFlow</strong> mô phỏng cơ chế này bằng cách băm nhỏ tệp thành các Chunk độc lập: <strong>Chunk chẵn (0, 2, 4...)</strong> đi qua Relay Alpha, <strong>Chunk lẻ (1, 3, 5...)</strong> đi qua Relay Beta. Điều này giúp tối đa hóa thông lượng mạng phòng thí nghiệm mà không đòi hỏi thiết bị mạng tầng dưới (router, switch) phải hỗ trợ MPTCP.
              </p>
            </div>

            {/* Concept 2: Application-layer Failover */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold">
                <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h4>2. Chuyển Vùng Chịu Lỗi Tự Động (Application-Layer Failover)</h4>
              </div>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Khi Relay Alpha bị đứt kết nối đột ngột (mô phỏng bằng nút ngắt hoặc sập server), bộ lập lịch <code className="font-mono">DualRelayScheduler</code> bắt được sự kiện đóng socket, thu hồi ngay lập tức toàn bộ chunk chẵn chưa hoàn tất và tự động tái chỉ định (reassign) sang Relay Beta. Phiên truyền tiếp tục trơn tru mà không làm gián đoạn người dùng và không cần gửi lại từ đầu.
              </p>
            </div>

            {/* Concept 3: Per-chunk SHA-256 Verification */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h4>3. Xác Thực Toàn Vẹn Theo Từng Chunk (Zero-Trust SHA-256)</h4>
              </div>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Thay vì chỉ tính một mã băm duy nhất cho cả tệp lớn, CrocFlow lập <strong>Folder Manifest</strong> chứa mã băm SHA-256 độc lập cho từng mảnh (16–256 KB). Ngay khi nhận được một chunk từ bất kỳ relay nào, máy nhận kiểm tra SHA-256 trước khi lưu. Nếu relay trung gian sửa đổi byte dữ liệu hoặc gặp lỗi truyền gói tin, chỉ duy nhất chunk lỗi bị loại bỏ và yêu cầu gửi lại, bảo toàn tính toàn vẹn 100%.
              </p>
            </div>

            {/* Concept 4: Resume Cache in IndexedDB */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-semibold">
                <Database className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h4>4. Bộ Nhớ Đệm Khôi Phục Thông Minh (IndexedDB Resume Cache)</h4>
              </div>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Mỗi chunk đã vượt qua kiểm tra SHA-256 được lưu bền vững vào IndexedDB của trình duyệt. Khi kết nối lại sau sự cố mất mạng (hoặc khi người gửi bổ sung thêm tệp mới vào cây thư mục), hai bên trao đổi <strong>Resume Plan</strong>. Máy nhận báo cáo các chunk đã có sẵn trong IndexedDB để máy gửi bỏ qua không truyền lại, tiết kiệm tối đa băng thông và thời gian.
              </p>
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
                  <strong>Phút 2 — Demo 2 Relay + Failover trực tiếp:</strong> Tại mục <strong>Phòng Thí Nghiệm & Báo Cáo Giảng Viên (Lecturer Demo Lab)</strong> ngay trên màn hình này, nhấn <strong>Khởi chạy Demo 1: Multi-Path & Failover</strong>. Chỉ cho thầy xem <em>Bảng soi giao thức</em>: 5 bước PAKE chuyển xanh, lưới Chunk chia màu Alpha (chẵn) / Beta (lẻ), rồi nhấn nút <strong>Cắt kết nối Relay Alpha</strong> → quan sát các ô chuyển màu vàng Failover sang Beta nhưng toàn bộ tệp vẫn ghép đủ SHA-256 100%.
                </li>
                <li>
                  <strong>Phút 3 — Demo Đứt mạng & Thêm tệp Resume:</strong> Nhấn <strong>Khởi chạy Demo 2: Đứt mạng & Resume tệp mới</strong>. Giải thích cách IndexedDB giữ lại các chunk đã tải ở giai đoạn 1, bỏ qua khi kết nối lại ở giai đoạn 2 (bỏ qua các chunk cũ đã có trong cache), đồng thời tự phát hiện tệp mới thêm vào thư mục.
                </li>
                <li>
                  <strong>Phút 4 — Đo độ trễ Relay & Passphrase nhóm xoay vòng:</strong> Mở tab <em>Relay & Mạng</em> nhấn <strong>Đo độ trễ (Ping RTT)</strong> để xem xếp hạng tốc độ; mở <em>Lịch sử & Nhóm</em> tạo 1 khóa nhóm hàng tháng rồi nhấn <strong>Dùng để Gửi</strong>.
                </li>
                <li>
                  <strong>Phút 5 — Xuất báo cáo & Đóng gói App:</strong> Nhấn <strong>Xuất Báo Cáo Học Thuật (.md)</strong> ở đầu trang và trình bày nút cài đặt PWA / pipeline GitHub Actions tự build APK & Desktop.
                </li>
              </ol>
            </>
          )}
        </div>
      </section>
    </div>
  );
}