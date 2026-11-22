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
  ExternalLink,
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
import { RollingMetricsTracker, formatEta, formatSpeed, useRollingMetrics } from "../lib/metrics";
import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";

export interface AppDocsHubViewProps {
  history: TransferHistoryEntry[];
  deviceAlias: string;
  onHistoryUpdated?: () => void;
  locale?: Locale;
}

type DocTab = "networking" | "architecture" | "demo";

/**
 * Technical Learning Hub & Interactive Verification Testbed.
 * Provides live 1-click loopback protocol simulations (Dual-Relay streaming, failure injection,
 * and IndexedDB delta resume) alongside multiplatform installation instructions and deep
 * bilingual technical documentation.
 */
export function AppDocsHubView({
  history,
  deviceAlias,
  onHistoryUpdated,
  locale = "vi",
}: AppDocsHubViewProps) {
  const t = getTranslations(locale);
  const [activeDoc, setActiveDoc] = useState<DocTab>("networking");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Demo Runner States
  const [runningDemo, setRunningDemo] = useState<"demo1" | "demo2" | null>(null);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [progress, setProgress] = useState<EnhancedProgress | null>(null);
  const [alphaSevered, setAlphaSevered] = useState(false);
  const [demo1Result, setDemo1Result] = useState<EnhancedSendResult | null>(null);
  const [demo2Result, setDemo2Result] = useState<{
    stage1CachedChunks: number;
    stage2Result: EnhancedSendResult;
    newFileDetected: string;
  } | null>(null);

  const metricsTrackerRef = useRef<RollingMetricsTracker | null>(null);
  const enhancedHandleRef = useRef<EnhancedControlHandle | null>(null);
  const [metrics, setMetrics] = useRollingMetrics(metricsTrackerRef, Boolean(runningDemo));

  const copyCommand = async (id: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(id);
      setTimeout(() => setCopiedCmd((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleExportTechnicalReport = () => {
    const isVi = locale === "vi";
    const nowStr = isVi ? formatDateTimeVi(Date.now()) : new Date().toISOString();

    const lines = isVi
      ? [
          "# BÁO CÁO ĐÁNH GIÁ KỸ THUẬT & AN TOÀN MẠNG — CROCFLOW",
          "",
          `- **Thiết bị xuất báo cáo:** ${deviceAlias}`,
          `- **Thời điểm xuất:** ${nowStr}`,
          `- **Giao thức cốt lõi:** Croc v11 PAKE v2 · Enhanced Multi-Relay & IndexedDB Resume`,
          "",
          "## 1. Kiến trúc hệ thống tổng thể (1 Codebase — Đa nền tảng)",
          "- **Frontend:** React 19 + TypeScript + Tailwind CSS biên dịch đồng thời ra Web App (PWA), Android APK (Capacitor) và Desktop Windows/macOS/Linux (Electron).",
          "- **Backend Bridge & Local Dual-Relay Lab:** Node.js + Express + WebSocket (`server.ts`) cung cấp cầu nối TCP allowlisted `/ws` (chống SSRF) cho chuẩn Croc v11 gốc và cặp Relay cục bộ Alpha/Beta `/ws-dual` cho chế độ chia tải Chunk Chẵn/Lẻ.",
          "",
          "## 2. Cơ chế giao thức & Bảo mật đầu cuối Zero-Knowledge",
          "1. **Chế độ Chuẩn Croc v11:** Tương thích 100% với `croc` CLI và `getcroc.com` qua giao thức PAKE v2 (P-256) + HKDF-SHA-256 + AES-256-GCM + XXH64.",
          "2. **Chế độ Nâng cao CrocFlow:** Bắt tay ECDH P-256 + HKDF-SHA-256 + xác thực Codephrase 2 chiều, lập Folder Manifest có SHA-256 cho từng Chunk, lưu bộ nhớ đệm Resume Cache trong IndexedDB.",
          "3. **Dual-Relay Multi-path & Failover:** Chunk chẵn (`0, 2, 4...`) gửi qua Relay Alpha; Chunk lẻ (`1, 3, 5...`) gửi qua Relay Beta. Khi Relay Alpha mất kết nối, `DualRelayScheduler` tự động định tuyến toàn bộ chunk chẵn chưa hoàn tất sang Relay Beta không làm mất dữ liệu.",
          "",
          `## 3. Nhật ký phiên kiểm thử thực tế đã ghi nhận (${history.length} phiên)`,
          ...(history.length === 0
            ? ["- (Chưa có phiên truyền nào được ghi nhận trên thiết bị này)"]
            : history.map(
                (h) =>
                  `- [${formatDateTimeVi(h.timestamp)}] **${h.direction === "send" ? "GỬI" : "NHẬN"}** \`${h.summaryName}\` (${formatBytes(h.totalBytes)}) · Chế độ: ${h.mode === "enhanced" ? (h.dualRelay ? "Dual-Relay Nâng cao" : "Manifest Nâng cao") : "Croc v11"} · Xác thực: ${h.verifiedHash}${h.failoverTriggered ? " · Đã kích hoạt Failover" : ""}${h.resumedChunks ? ` · Resume bỏ qua ${h.resumedChunks} chunks` : ""}`,
              )),
        ]
      : [
          "# CROCFLOW TECHNICAL EVALUATION & AUDIT REPORT",
          "",
          `- **Generated By Device:** ${deviceAlias}`,
          `- **Generation Timestamp:** ${nowStr}`,
          `- **Core Protocols:** Croc v11 PAKE v2 · Enhanced Multi-Relay & IndexedDB Resume`,
          "",
          "## 1. System Architecture (Unified 1-Codebase Cross-Platform)",
          "- **Frontend:** React 19 + TypeScript + Tailwind CSS compiling simultaneously to Web PWA, Android APK (Capacitor), and Desktop Windows/macOS/Linux (Electron).",
          "- **Backend Bridge & Local Dual-Relay Lab:** Node.js + Express + WebSocket (`server.ts`) providing an allowlisted TCP bridge `/ws` (SSRF protected) to public Croc relays and local Alpha/Beta channels `/ws-dual` for concurrent chunk streaming.",
          "",
          "## 2. Cryptographic Security & Protocol Mechanisms",
          "1. **Standard Croc v11 Mode:** 100% wire-compatible with `croc` CLI and `getcroc.com` via PAKE v2 (P-256) + HKDF-SHA-256 + AES-256-GCM + XXH64.",
          "2. **Enhanced CrocFlow Mode:** Client-side ECDH P-256 + HKDF-SHA-256 + bidirectional confirmation, Folder Manifest with per-chunk SHA-256 digests, and IndexedDB Resume Cache.",
          "3. **Dual-Relay Streaming & Dynamic Failover:** Even chunks (`0, 2, 4...`) dispatched across Relay Alpha; odd chunks (`1, 3, 5...`) across Relay Beta. If Relay Alpha disconnects, `DualRelayScheduler` seamlessly reroutes remaining even chunks across Relay Beta without payload corruption.",
          "",
          `## 3. Real-Time Verified Transfer Audit Log (${history.length} sessions)`,
          ...(history.length === 0
            ? ["- (No transfer sessions recorded on this device yet)"]
            : history.map(
                (h) =>
                  `- [${new Date(h.timestamp).toISOString()}] **${h.direction.toUpperCase()}** \`${h.summaryName}\` (${formatBytes(h.totalBytes)}) · Mode: ${h.mode === "enhanced" ? (h.dualRelay ? "Enhanced Dual-Relay" : "Enhanced Manifest") : "Croc v11"} · Verification: ${h.verifiedHash}${h.failoverTriggered ? " · Failover Triggered" : ""}${h.resumedChunks ? ` · Resumed ${h.resumedChunks} chunks` : ""}`,
              )),
        ];

    downloadTextFile(`CrocFlow_Evaluation_Report_${Date.now()}.md`, lines.join("\n"));
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
    setStatusText(
      locale === "vi"
        ? "Đang khởi tạo máy Gửi & Nhận loopback qua /ws-dual..."
        : "Initializing loopback Sender & Receiver across /ws-dual...",
    );

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
        summaryName: "Benchmark_Dataset/ (Demo 1: Dual-Relay & Failover)",
        totalBytes: res.manifest.totalBytes,
        status: "completed",
        verifiedHash: "SHA-256",
        failoverTriggered: res.failoverRerouted > 0,
        deviceAlias,
      });
      onHistoryUpdated?.();
      setSuccessText(
        locale === "vi"
          ? `Demo 1 Hoàn tất! Alpha đã chuyển ${res.alphaDelivered} chunk chẵn · Beta đã chuyển ${res.betaDelivered} chunk (gồm ${res.failoverRerouted} chunk Failover sau khi ngắt Alpha). Khớp SHA-256 100%.`
          : `Demo 1 Completed! Alpha streamed ${res.alphaDelivered} even chunks · Beta streamed ${res.betaDelivered} chunks (${res.failoverRerouted} failover chunks after Alpha cutoff). SHA-256 matched 100%.`,
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
      setStatusText(
        locale === "vi"
          ? "Đã ngắt kết nối Relay Alpha! Quan sát các chunk chẵn lập tức chuyển hướng sang Relay Beta..."
          : "Relay Alpha severed! Remaining even chunks are now dynamically migrating to Relay Beta...",
      );
    }
  };

  const handleCancelDemo = () => {
    enhancedHandleRef.current?.cancel();
    setRunningDemo(null);
    setStatusText(locale === "vi" ? "Đã dừng kịch bản mô phỏng." : "Simulation halted.");
  };

  const handleRunResumeDemo = async () => {
    setErrorText(null);
    setSuccessText(null);
    setProgress(null);
    setDemo1Result(null);
    setDemo2Result(null);
    metricsTrackerRef.current = new RollingMetricsTracker();
    setMetrics({ speedBps: 0, etaSeconds: null, isStalled: false });
    setRunningDemo("demo2");
    setStatusText(
      locale === "vi"
        ? "Bắt đầu Giai đoạn 1: Truyền 6 chunk đầu vào IndexedDB rồi ngắt kết nối..."
        : "Stage 1: Streaming first 6 chunks into IndexedDB before simulating disconnection...",
    );

    const demoCode = "4281-folder-resume-lab";
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

      setDemo2Result({
        stage1CachedChunks: res.stage1CachedChunks,
        stage2Result: res.stage2Result,
        newFileDetected: res.newFileDetected,
      });

      appendTransferHistory({
        direction: "receive",
        mode: "enhanced",
        dualRelay: false,
        codephrase: demoCode,
        fileCount: res.stage2Result.manifest.totalFiles,
        summaryName: "Dataset_Resume/ (Demo 2: Delta Resume)",
        totalBytes: res.stage2Result.manifest.totalBytes,
        status: "completed",
        verifiedHash: "SHA-256",
        resumedChunks: res.stage2Result.resumedChunks,
        deviceAlias,
      });
      onHistoryUpdated?.();
      setSuccessText(
        locale === "vi"
          ? `Demo 2 Hoàn tất! Bỏ qua ${res.stage2Result.resumedChunks} chunk đã có trong IndexedDB, tự phát hiện tệp mới "${res.newFileDetected}". Ghép đủ toàn bộ thư mục với SHA-256 100%! `
          : `Demo 2 Completed! Skipped ${res.stage2Result.resumedChunks} cached chunks in IndexedDB, auto-detected new file "${res.newFileDetected}". Verified 100% with SHA-256!`,
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
    progress && progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.bytesTransferred / progress.totalBytes) * 100))
      : 0;

  return (
    <div className="space-y-8">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.docs.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.docs.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportTechnicalReport}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-800 shadow-xs hover:bg-teal-100 dark:border-teal-400/30 dark:bg-teal-950/60 dark:text-teal-200 dark:hover:bg-teal-900/60 transition-all"
          >
            <FileDown className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>{t.docs.exportReportBtn}</span>
          </button>
        </div>
      </div>

      {/* CROSS-PLATFORM DOWNLOADS & INSTALLATION CARDS */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* PWA Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  {t.docs.pwaTitle}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                PWA
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {locale === "vi"
                ? "Chạy toàn màn hình không thanh URL, tự động lưu đệm ngoại tuyến (Service Worker), tương thích 100% Chrome, Edge, Safari và Firefox."
                : "Full-screen standalone app without browser chrome, offline caching via Workbox Service Workers, compatible with Chrome, Edge, and Safari."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <PWAInstallButton />
          </div>
        </div>

        {/* Android APK Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                </div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  {t.docs.androidTitle}
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Capacitor
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {locale === "vi"
                ? "Đóng gói Android gốc qua Capacitor (app.crocflow.mobile), tự động build file APK qua GitHub Actions mà không cần cài Android Studio."
                : "Native Android packaging via Capacitor (app.crocflow.mobile), with automated cloud APK builds via GitHub Actions."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <a
              href="docs/SETUP_AND_DEPLOY_EN.md"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{locale === "vi" ? "Xem hướng dẫn build APK" : "View APK Build Guide"}</span>
            </a>
          </div>
        </div>

        {/* Desktop Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
                  <Laptop className="h-4 w-4" aria-hidden="true" />
                </div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  {t.docs.desktopTitle}
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Electron
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {locale === "vi"
                ? "Tích hợp sẵn Bridge Server Node.js cục bộ chạy ngầm, hỗ trợ xuất tệp Windows (.exe), macOS (.dmg) và Linux (.AppImage)."
                : "Embeds background loopback Node.js bridge server, packaged for Windows (.exe), macOS (.dmg), and Linux (.AppImage)."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <a
              href="packaging/desktop/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{locale === "vi" ? "Mã nguồn Desktop packaging" : "Desktop Packaging Files"}</span>
            </a>
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO RUNNERS SECTION */}
      <section className="rounded-2xl border border-teal-200/80 bg-white p-6 shadow-sm dark:border-teal-900/50 dark:bg-[#111827]">
        {/* Lab Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <FlaskConical className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  {t.docs.interactiveDemoTitle}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200 border border-teal-200/60 dark:border-teal-800/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
                  Live WebSocket
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {locale === "vi"
                  ? "Thực nghiệm tương tác qua WebSocket thật (/ws-dual): chia tải 2 kênh Relay, mô phỏng ngắt kết nối (Failover) và cơ chế Resume Cache từ IndexedDB."
                  : "Interactive verification over real WebSockets (/ws-dual): 2-channel load balancing, live failover injection, and IndexedDB delta resume."}
              </p>
            </div>
          </div>
        </div>

        {/* Two Interactive Demo Cards */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* DEMO 1: DUAL-RELAY & LIVE FAILOVER */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
                  <Zap className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {locale === "vi"
                      ? "Demo 1: Dual-Relay Multi-Path & Tự Động Failover"
                      : "Demo 1: Concurrent Dual-Relay & Live Failover"}
                  </h3>
                  <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                    {locale === "vi"
                      ? "Multi-path TCP Analog · Phân bổ Chẵn/Lẻ · Tái định tuyến"
                      : "Even/Odd Chunk Partitioning · Socket Severance · Seamless Rerouting"}
                  </span>
                </div>
              </div>

              <div className="mt-3.5 space-y-2 rounded-xl bg-white p-3.5 text-xs leading-relaxed text-slate-600 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {locale === "vi" ? "Trình tự thực nghiệm:" : "Verification Sequence:"}
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-[11px]">
                  <li>
                    {locale === "vi"
                      ? "Khởi chạy đồng thời Sender và Receiver nội bộ qua kênh /ws-dual."
                      : "Spawns concurrent loopback Sender and Receiver over /ws-dual."}
                  </li>
                  <li>
                    {locale === "vi"
                      ? "Bộ lập lịch gán Chunk Chẵn vào Relay Alpha, Chunk Lẻ vào Relay Beta."
                      : "Scheduler assigns Even Chunks to Relay Alpha and Odd Chunks to Relay Beta."}
                  </li>
                  <li>
                    {locale === "vi"
                      ? "Nhấn nút 'Ngắt kết nối Alpha' để quan sát toàn bộ chunk chẵn chuyển sang Beta."
                      : "Click 'Simulate Alpha Severance' to watch even chunks migrate to Beta."}
                  </li>
                  <li>
                    {locale === "vi"
                      ? "Xác nhận toàn bộ chunk được ghép hoàn chỉnh với SHA-256 khớp 100%."
                      : "Receiver validates all chunks with 100% matching SHA-256 digests."}
                  </li>
                </ol>
              </div>

              {/* Live Status when Demo 1 is running */}
              {runningDemo === "demo1" && (
                <div className="mt-3.5 space-y-2.5 rounded-xl border border-teal-300 bg-teal-50/80 p-3 text-xs dark:border-teal-800 dark:bg-teal-950/50">
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
                    <div className="rounded-lg bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">{t.common.speed}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatSpeed(metrics.speedBps)}</span>
                    </div>
                    <div className="rounded-lg bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">{t.common.eta}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatEta(metrics.etaSeconds, metrics.isStalled)}</span>
                    </div>
                    <div className="rounded-lg bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Alpha (Even)</span>
                      <span className="font-bold text-teal-700 dark:text-teal-300">{progress?.alphaChunks ?? 0}</span>
                    </div>
                    <div className="rounded-lg bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">Beta (Odd/Failover)</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {progress?.betaChunks ?? 0}
                        {progress && progress.failoverChunks > 0 && ` (${progress.failoverChunks} failover)`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Demo 1 Result Box */}
              {demo1Result && !runningDemo && (
                <div className="mt-3.5 rounded-xl border border-teal-300 bg-teal-50/90 p-3.5 text-xs text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                  <div className="flex items-center gap-2 font-bold">
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>
                      {locale === "vi" ? "Kết quả Demo 1 thành công:" : "Demo 1 Result Summary:"}
                    </span>
                  </div>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11px]">
                    <li>
                      {locale === "vi"
                        ? `Relay Alpha đã chuyển ${demo1Result.alphaDelivered} chunk chẵn trước khi ngắt.`
                        : `Relay Alpha streamed ${demo1Result.alphaDelivered} even chunks before failover.`}
                    </li>
                    <li>
                      {locale === "vi"
                        ? `Relay Beta đã chuyển ${demo1Result.betaDelivered} chunk (gồm ${demo1Result.failoverRerouted} chunk chuyển hướng failover).`
                        : `Relay Beta streamed ${demo1Result.betaDelivered} chunks (${demo1Result.failoverRerouted} chunks rerouted via failover).`}
                    </li>
                    <li>
                      {locale === "vi"
                        ? "Xác thực toàn vẹn: 100% khớp mã băm SHA-256."
                        : "Payload integrity: 100% verified with SHA-256."}
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Demo 1 Buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              {runningDemo !== "demo1" ? (
                <button
                  type="button"
                  disabled={runningDemo !== null}
                  onClick={() => void handleRunDualRelayDemo()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.docs.runFailoverDemoBtn}
                </button>
              ) : (
                <>
                  {!alphaSevered && (
                    <button
                      type="button"
                      onClick={handleSimulateAlphaDisconnect}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.docs.severAlphaBtn}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelDemo}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                  >
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    {locale === "vi" ? "Dừng Demo" : "Stop"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* DEMO 2: FOLDER MANIFEST & RESUME CACHE */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/60">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <Database className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {locale === "vi"
                      ? "Demo 2: Folder Manifest & Resume khi Thêm Tệp Mới"
                      : "Demo 2: Folder Manifest & Delta Resume"}
                  </h3>
                  <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">
                    {locale === "vi"
                      ? "IndexedDB Resume Cache · Bỏ qua Chunk cũ · Tải tệp mới"
                      : "IndexedDB Chunk Cache · Skip Verified Chunks · Delta Detection"}
                  </span>
                </div>
              </div>

              <div className="mt-3.5 space-y-2 rounded-xl bg-white p-3.5 text-xs leading-relaxed text-slate-600 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {locale === "vi" ? "Quy trình mô phỏng 2 giai đoạn:" : "2-Stage Verification Sequence:"}
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-[11px]">
                  <li>
                    {locale === "vi"
                      ? "Giai đoạn 1: Truyền 6 chunk đầu vào IndexedDB rồi ngắt kết nối đột ngột."
                      : "Stage 1: Transmits 6 chunks into IndexedDB then triggers disconnect."}
                  </li>
                  <li>
                    {locale === "vi"
                      ? "Giai đoạn 2: Bổ sung tệp mới PhuLuc_MoiThemSauMatMang.bin vào manifest."
                      : "Stage 2: Appends new file PhuLuc_MoiThemSauMatMang.bin to folder manifest."}
                  </li>
                  <li>
                    {locale === "vi"
                      ? "Resume Plan: Đối chiếu SHA-256 để bỏ qua 100% các chunk đã có trong IndexedDB."
                      : "Resume Plan: Compares SHA-256 digests to skip all verified cached chunks."}
                  </li>
                  <li>
                    {locale === "vi"
                      ? "Chỉ truyền chunk còn thiếu và tệp mới, ghép đủ toàn bộ thư mục."
                      : "Transfers only missing chunks and delta file, reassembling the folder 100%."}
                  </li>
                </ol>
              </div>

              {/* Live Status when Demo 2 is running */}
              {runningDemo === "demo2" && (
                <div className="mt-3.5 space-y-2.5 rounded-xl border border-indigo-300 bg-indigo-50/80 p-3 text-xs dark:border-indigo-800 dark:bg-indigo-950/50">
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
                    <div className="rounded-lg bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">{t.common.speed}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{formatSpeed(metrics.speedBps)}</span>
                    </div>
                    <div className="rounded-lg bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">
                        {locale === "vi" ? "Tiến độ Chunks" : "Chunk Progress"}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {progress?.completedChunks ?? 0} / {progress?.totalChunks ?? 0}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white/80 p-1.5 dark:bg-slate-900/80">
                      <span className="block text-[10px] text-slate-500 font-sans">
                        {locale === "vi" ? "Bỏ qua Resume" : "Cached Chunks"}
                      </span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {progress?.resumedChunks ?? 0} chunks
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Demo 2 Result Box */}
              {demo2Result && !runningDemo && (
                <div className="mt-3.5 rounded-xl border border-indigo-300 bg-indigo-50/90 p-3.5 text-xs text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                  <div className="flex items-center gap-2 font-bold">
                    <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    <span>{locale === "vi" ? "Kết quả Demo 2 thành công:" : "Demo 2 Result Summary:"}</span>
                  </div>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11px]">
                    <li>
                      {locale === "vi"
                        ? `Giai đoạn 1 lưu đệm: ${demo2Result.stage1CachedChunks} chunks trong IndexedDB.`
                        : `Stage 1 cached ${demo2Result.stage1CachedChunks} chunks in IndexedDB.`}
                    </li>
                    <li>
                      {locale === "vi"
                        ? `Phát hiện tệp mới: ${demo2Result.newFileDetected}`
                        : `Delta detected: ${demo2Result.newFileDetected}`}
                    </li>
                    <li>
                      {locale === "vi"
                        ? `Bỏ qua ${demo2Result.stage2Result.resumedChunks} chunks cũ không cần tải lại.`
                        : `Skipped ${demo2Result.stage2Result.resumedChunks} verified cached chunks.`}
                    </li>
                    <li>
                      {locale === "vi"
                        ? `Khớp mã băm SHA-256 100% cho toàn bộ ${demo2Result.stage2Result.manifest.totalFiles} tệp.`
                        : `100% SHA-256 verification across all ${demo2Result.stage2Result.manifest.totalFiles} files.`}
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Demo 2 Buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              {runningDemo !== "demo2" ? (
                <button
                  type="button"
                  disabled={runningDemo !== null}
                  onClick={() => void handleRunResumeDemo()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.docs.runResumeDemoBtn}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelDemo}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  {locale === "vi" ? "Dừng Demo" : "Stop"}
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
                className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            )}
            {successText && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{successText}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* BILINGUAL TECHNICAL DOCUMENTATION VIEWER TABS */}
      <section className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-[#111827] shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-slate-800/80">
          {[
            { id: "networking" as const, label: t.docs.tabNetworking, icon: BookOpen },
            { id: "architecture" as const, label: t.docs.tabArchitecture, icon: Laptop },
            { id: "demo" as const, label: t.docs.tabDemo, icon: Presentation },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeDoc === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDoc(tab.id)}
                className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-teal-600 text-white shadow-xs dark:bg-teal-500 dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4 p-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {activeDoc === "networking" && (
            locale === "vi" ? (
              <>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  1. Tại sao hai máy tính không thể gửi tệp trực tiếp cho nhau mà cần Relay?
                </h3>
                <p>
                  Hầu hết thiết bị nằm sau router Wi-Fi sử dụng <strong>NAT (Network Address Translation)</strong> và tường lửa. Thiết bị chỉ có IP nội bộ (như <code className="font-mono">192.168.1.5</code>) nên thiết bị ở mạng khác không thể tự mở kết nối TCP tới bạn. <strong>Relay Server</strong> đóng vai trò phòng gặp mặt trung gian có địa chỉ công cộng: cả người gửi lẫn người nhận đều chủ động kết nối ra ngoài tới Relay cùng một tên phòng (Room), rồi Relay làm ống dẫn chuyển tiếp gói tin.
                </p>

                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  2. PAKE + HKDF + AES-256-GCM là gì? Relay có đọc trộm được tệp không?
                </h3>
                <p>
                  <strong>Hoàn toàn không!</strong> Trước khi gửi bất kỳ byte dữ liệu nào, hai máy thực hiện bắt tay mật mã <strong>PAKE (Password-Authenticated Key Exchange)</strong> dựa trên đường cong Elliptic P-256. Hai bên dùng mã bí mật ngắn (Codephrase) để đồng thuận ra một khóa phiên mạnh 256-bit thông qua <strong>HKDF-SHA-256</strong> mà <em>không bao giờ gửi nguyên văn Codephrase qua mạng</em>. Sau đó mọi tệp đều bị mã hóa bằng <strong>AES-256-GCM</strong> kèm IV ngẫu nhiên cho từng gói trên máy gửi trước khi chạm tới Relay — Relay chỉ thấy các khối byte ngẫu nhiên.
                </p>

                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  3. Tại sao phải cắt Chunk, dùng Folder Manifest SHA-256 và chia 2 Relay?
                </h3>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Cắt Chunk & SHA-256:</strong> Thay vì gửi nguyên khối lớn (đứt mạng ở 95% phải gửi lại từ đầu), CrocFlow cắt từng tệp thành các mảnh nhỏ 16–256 KB kèm mã băm SHA-256. Máy nhận lưu từng mảnh đã kiểm tra đúng vào <strong>IndexedDB Resume Cache</strong>. Khi kết nối lại, máy nhận chỉ yêu cầu gửi các mảnh còn thiếu.
                  </li>
                  <li>
                    <strong>Chia tải 2 Relay (Alpha Chẵn / Beta Lẻ) & Failover:</strong> Các mảnh đánh số chẵn (<code className="font-mono">0, 2, 4...</code>) đi qua Relay Alpha, mảnh lẻ (<code className="font-mono">1, 3, 5...</code>) đi qua Relay Beta để tận dụng băng thông song song. Nếu Relay Alpha bị ngắt kết nối giữa chừng, bộ lập lịch <code className="font-mono">DualRelayScheduler</code> tự động chuyển toàn bộ mảnh chẵn chưa tới đích sang Relay Beta.
                  </li>
                </ul>
              </>
            ) : (
              <>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  1. The Core Networking Problem: Why Can't Two Devices Connect Directly?
                </h3>
                <p>
                  Most client devices reside behind Wi-Fi routers using <strong>NAT (Network Address Translation)</strong> and stateful firewalls. Each device is assigned a non-routable private IP (e.g., <code className="font-mono">192.168.1.5</code>). An external device cannot initiate inbound TCP connections due to firewall packet dropping. The <strong>Rendezvous Relay Server</strong> solves this by accepting outbound connections from both peers into a shared room keyed by codephrase, relaying binary streams transparently.
                </p>

                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  2. PAKE + HKDF + AES-256-GCM: Can Relay Operators Eavesdrop on Files?
                </h3>
                <p>
                  <strong>No.</strong> Encryption and key exchange are strictly client-side. The peers negotiate an ephemeral key exchange over NIST P-256 blinded by the secret codephrase via <strong>PAKE v2</strong>. The shared point is fed into <strong>HKDF-SHA-256</strong> to derive a 256-bit symmetric session key and mutual authentication tags. All payload frames are encrypted using <strong>AES-256-GCM</strong> with unique 12-byte initialization vectors per packet.
                </p>

                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  3. Multi-path Dual-Relay Scheduling & SHA-256 Chunk Resume
                </h3>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>Deterministic Chunking & Resume:</strong> Files are indexed in a Folder Manifest, sliced into 16–256 KB chunks, and hashed via SHA-256. Verified chunks are stored in browser <strong>IndexedDB</strong>, allowing instant resume after network loss.
                  </li>
                  <li>
                    <strong>Dual-Relay Interleaving & Failover:</strong> Even chunks (<code className="font-mono">0, 2, 4...</code>) stream across Relay Alpha, while odd chunks (<code className="font-mono">1, 3, 5...</code>) stream across Relay Beta. If Relay Alpha drops, the <code className="font-mono">DualRelayScheduler</code> reassigns pending even chunks to Relay Beta dynamically.
                  </li>
                </ul>
              </>
            )
          )}

          {activeDoc === "architecture" && (
            locale === "vi" ? (
              <>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Bản đồ kiến trúc mã nguồn CrocFlow
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <strong className="font-mono text-teal-700 dark:text-teal-400">server.ts & server/bridge-allowlist.ts</strong>
                    <p className="mt-1">
                      Máy chủ Express + WebSocket chạy cổng 3000. Cung cấp cầu nối <code className="font-mono">/ws</code> nối trình duyệt tới TCP Relay của Croc gốc (có danh sách trắng host/port chặn SSRF) và endpoint <code className="font-mono">/api/relays/ping</code> đo RTT thật.
                    </p>
                  </li>
                  <li className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <strong className="font-mono text-teal-700 dark:text-teal-400">server/local-dual-relay.ts</strong>
                    <p className="mt-1">
                      Triển khai cặp phòng Relay độc lập <strong>Alpha</strong> và <strong>Beta</strong> trên <code className="font-mono">/ws-dual</code>, đếm số byte và gói tin chuyển tiếp thật theo từng kênh.
                    </p>
                  </li>
                  <li className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <strong className="font-mono text-teal-700 dark:text-teal-400">src/protocol/croc/*</strong>
                    <p className="mt-1">
                      Bộ giao thức Croc v11 viết thuần TypeScript (PAKE P-256, XXH64, nén, cắt luồng) tương thích trực tiếp với <code className="font-mono">croc</code> CLI và <code className="font-mono">getcroc.com</code> mà không cần Go WASM.
                    </p>
                  </li>
                  <li className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <strong className="font-mono text-teal-700 dark:text-teal-400">src/protocol/enhanced/manifest.ts · dual-relay-scheduler.ts · resume-cache.ts · enhanced-client.ts</strong>
                    <p className="mt-1">
                      Lõi tính năng mở rộng: lập Folder Manifest có kiểm tra chống path traversal (<code className="font-mono">sanitizeRelativePath</code>), chia tải Chẵn/Lẻ & Failover, lưu Chunk đã xác thực vào IndexedDB.
                    </p>
                  </li>
                </ul>
              </>
            ) : (
              <>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Key Codebase Modules & Architecture Map
                </h3>
                <ul className="space-y-2.5 text-xs">
                  <li className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <strong className="font-mono text-teal-700 dark:text-teal-400">server.ts & server/bridge-allowlist.ts</strong>
                    <p className="mt-1">
                      Express + WebSocket server on port 3000. Houses the allowlisted TCP bridge <code className="font-mono">/ws</code> (anti-SSRF sanitization) and real RTT latency endpoint <code className="font-mono">/api/relays/ping</code>.
                    </p>
                  </li>
                  <li className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <strong className="font-mono text-teal-700 dark:text-teal-400">server/local-dual-relay.ts</strong>
                    <p className="mt-1">
                      Implements in-memory isolated <strong>Alpha</strong> and <strong>Beta</strong> relay rooms on <code className="font-mono">/ws-dual</code>, counting relayed bytes and frames per channel.
                    </p>
                  </li>
                  <li className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <strong className="font-mono text-teal-700 dark:text-teal-400">src/protocol/croc/*</strong>
                    <p className="mt-1">
                      Pure TypeScript Croc v11 protocol stack (PAKE P-256, XXH64, binary framing) interoperable directly with official <code className="font-mono">croc</code> CLI without Go WASM overhead.
                    </p>
                  </li>
                  <li className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                    <strong className="font-mono text-teal-700 dark:text-teal-400">src/protocol/enhanced/manifest.ts · dual-relay-scheduler.ts · resume-cache.ts · enhanced-client.ts</strong>
                    <p className="mt-1">
                      Enhanced protocol engine: Folder manifest with path sanitization (<code className="font-mono">sanitizeRelativePath</code>), even/odd chunk scheduling with dynamic failover, and IndexedDB caching.
                    </p>
                  </li>
                </ul>
              </>
            )
          )}

          {activeDoc === "demo" && (
            locale === "vi" ? (
              <>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  Quy trình trình diễn & đánh giá kỹ thuật 5 phút
                </h3>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    <strong>Phút 1 — Tương thích chuẩn Croc v11:</strong> Chọn chế độ <em>Gửi → Chuẩn Croc v11</em>, chia sẻ mã QR hoặc lệnh <code className="font-mono">croc &lt;codephrase&gt;</code>, nhận thử từ Terminal để chứng minh tương thích 100% với CLI chính thức.
                  </li>
                  <li>
                    <strong>Phút 2 — Chạy Demo 2 Relay + Failover:</strong> Trong mục <strong>Bộ chạy Demo Trực tiếp</strong> ở trên, bấm <strong>Chạy Demo 2 Relay + Failover</strong>. Quan sát Bảng soi giao thức: 5 bước PAKE hoàn tất, lưới Chunk phân bổ màu Alpha (chẵn) và Beta (lẻ), bấm nút <strong>Ngắt kết nối Relay Alpha</strong> để thấy các chunk tự chuyển màu vàng Failover sang Beta mà không mất dữ liệu.
                  </li>
                  <li>
                    <strong>Phút 3 — Chạy Demo Resume & Phát hiện tệp mới:</strong> Bấm <strong>Chạy Demo Resume Cache IndexedDB</strong>. Quan sát giai đoạn 1 lưu 6 chunk vào cache, ngắt mạng, giai đoạn 2 thêm tệp mới và tiếp tục tải các phần còn thiếu mà không tải lại các chunk cũ.
                  </li>
                  <li>
                    <strong>Phút 4 — Đo độ trễ RTT & Passphrase nhóm:</strong> Mở tab <em>Relay & Mạng</em> bấm <strong>Đo độ trễ (Ping RTT)</strong> để xem bảng xếp hạng tốc độ; mở <em>Lịch sử & Nhóm</em> để tạo mã tháng tự động.
                  </li>
                  <li>
                    <strong>Phút 5 — Xuất báo cáo kỹ thuật:</strong> Bấm nút <strong>Xuất Báo Cáo Kỹ Thuật (.md)</strong> để lưu bản ghi kiểm thử hoàn chỉnh.
                  </li>
                </ol>
              </>
            ) : (
              <>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                  5-Minute Technical Evaluation & Live Verification Walkthrough
                </h3>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    <strong>Minute 1 — Standard Croc v11 Interoperability:</strong> On the <em>Send</em> tab, select <em>Standard Croc v11</em>. Share codephrase or QR code, and receive using <code className="font-mono">croc &lt;codephrase&gt;</code> in a terminal to verify byte-for-byte CLI interop.
                  </li>
                  <li>
                    <strong>Minute 2 — Concurrent Dual-Relay & Live Failover:</strong> In the <strong>Interactive Demo Runners</strong> above, click <strong>Run 2-Relay + Failover Demo</strong>. Inspect the Protocol Inspector: PAKE milestones complete, even/odd chunks render across Alpha and Beta, click <strong>Simulate Relay Alpha Outage</strong> to observe dynamic failover to Beta without corruption.
                  </li>
                  <li>
                    <strong>Minute 3 — IndexedDB Delta Resume Demo:</strong> Click <strong>Run IndexedDB Resume Demo</strong>. Stage 1 caches 6 chunks, disconnects, stage 2 appends a new file and downloads only missing bytes.
                  </li>
                  <li>
                    <strong>Minute 4 — RTT Latency Probing & Group Secrets:</strong> Benchmark public relays on the <em>Relays & Network</em> tab and verify monthly rotating group passphrases on the <em>History & Groups</em> tab.
                  </li>
                  <li>
                    <strong>Minute 5 — Export Audit Report:</strong> Click <strong>Export Technical Evaluation Report (.md)</strong> to save complete verification logs.
                  </li>
                </ol>
              </>
            )
          )}
        </div>
      </section>
    </div>
  );
}
