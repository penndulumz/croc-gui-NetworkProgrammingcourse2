import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  protocolEventBus,
  type ChunkVisualState,
  type InspectorSnapshot,
} from "../protocol/event-bus";
import { downloadTextFile, formatBytes, formatSpeed, formatTimeShort } from "../lib/format";
import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";

const CHUNK_COLOR: Record<ChunkVisualState, string> = {
  pending: "bg-zinc-200 dark:bg-zinc-800",
  alpha: "bg-teal-500 dark:bg-teal-400",
  beta: "bg-sky-500 dark:bg-sky-400",
  verified: "bg-emerald-500 dark:bg-emerald-400",
  resumed: "bg-indigo-500 dark:bg-indigo-400",
  failover: "bg-amber-500 dark:bg-amber-400",
};

const CHUNK_TITLE_VI: Record<ChunkVisualState, string> = {
  pending: "Chờ gửi",
  alpha: "Đang đi qua Relay Alpha (Chẵn)",
  beta: "Đang đi qua Relay Beta (Lẻ)",
  verified: "Đã xác thực SHA-256 / XXH64",
  resumed: "Bỏ qua — lấy từ Resume Cache (IndexedDB)",
  failover: "Failover — chuyển hướng từ Alpha sang Beta",
};

const CHUNK_TITLE_EN: Record<ChunkVisualState, string> = {
  pending: "Pending dispatch",
  alpha: "Streaming via Relay Alpha (Even)",
  beta: "Streaming via Relay Beta (Odd)",
  verified: "Verified SHA-256 / XXH64",
  resumed: "Skipped — Cached in IndexedDB",
  failover: "Failover — Rerouted from Alpha to Beta",
};

function ThroughputSparkline({
  samples,
  emptyText,
}: {
  samples: InspectorSnapshot["throughputHistory"];
  emptyText: string;
}) {
  if (samples.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {emptyText}
      </div>
    );
  }
  const maxVal = Math.max(1, ...samples.map((s) => s.bytesPerSecond));
  const width = 320;
  const height = 60;
  const points = samples
    .map((s, idx) => {
      const x = (idx / (samples.length - 1)) * width;
      const y = height - 6 - (s.bytesPerSecond / maxVal) * (height - 12);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full overflow-visible rounded-xl bg-zinc-50 px-1 dark:bg-zinc-950/60"
      role="img"
      aria-label="Throughput sparkline graph"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-500 dark:text-emerald-400"
        points={points}
      />
    </svg>
  );
}

export interface ProtocolInspectorProps {
  locale?: Locale;
}

/**
 * Real-time Protocol Inspector component.
 * Visualizes 5-step cryptographic PAKE/ECDH handshake milestones,
 * concurrent chunk allocation matrix across Relay Alpha and Relay Beta,
 * rolling throughput sparkline, and live diagnostic event logs.
 */
export function ProtocolInspector({ locale = "vi" }: ProtocolInspectorProps) {
  const [snap, setSnap] = useState<InspectorSnapshot>(() => protocolEventBus.getSnapshot());
  const t = getTranslations(locale);
  const titles = locale === "vi" ? CHUNK_TITLE_VI : CHUNK_TITLE_EN;

  useEffect(() => {
    return protocolEventBus.subscribe(setSnap);
  }, []);

  const handleExportMarkdown = () => {
    const isVi = locale === "vi";
    const lines = isVi
      ? [
          "# Báo cáo Soi Giao Thức CrocFlow (Protocol Inspector Log)",
          "",
          `- **Session ID:** ${snap.sessionId ?? "Chưa có phiên"}`,
          `- **Chế độ:** ${snap.mode === "enhanced" ? "Nâng cao (Folder Manifest · Dual-Relay)" : snap.mode === "standard" ? "Chuẩn Croc v11" : "N/A"}`,
          `- **Hướng:** ${snap.direction ?? "N/A"}`,
          `- **Tổng dung lượng:** ${formatBytes(snap.bytesTransferred)} / ${formatBytes(snap.totalBytes)}`,
          `- **Phân bổ Chunk:** Tổng ${snap.totalChunks} · Alpha (Chẵn): ${snap.alphaChunks} · Beta (Lẻ): ${snap.betaChunks} · Resume Cache: ${snap.resumedChunks} · Failover: ${snap.failoverChunks}`,
          "",
          "## 1. Tiến trình bắt tay mật mã (PAKE / ECDH + AES-256-GCM)",
          ...snap.pakeSteps.map((s) => `- [${s.status === "done" ? "x" : " "}] ${s.label} (${s.status})`),
          "",
          "## 2. Nhật ký sự kiện trực tiếp",
          ...snap.events.map(
            (ev) => `- \`${formatTimeShort(ev.timestamp)}\` **[${ev.kind.toUpperCase()}]** ${ev.title} — ${ev.detail}`,
          ),
        ]
      : [
          "# CrocFlow Protocol Inspector Audit Log",
          "",
          `- **Session ID:** ${snap.sessionId ?? "None"}`,
          `- **Protocol Mode:** ${snap.mode === "enhanced" ? "Enhanced (Folder Manifest · Dual-Relay)" : snap.mode === "standard" ? "Standard Croc v11" : "N/A"}`,
          `- **Direction:** ${snap.direction ?? "N/A"}`,
          `- **Transfer Volume:** ${formatBytes(snap.bytesTransferred)} / ${formatBytes(snap.totalBytes)}`,
          `- **Chunk Distribution:** Total ${snap.totalChunks} · Alpha (Even): ${snap.alphaChunks} · Beta (Odd): ${snap.betaChunks} · Resume Cache: ${snap.resumedChunks} · Failover: ${snap.failoverChunks}`,
          "",
          "## 1. Cryptographic Handshake Milestones (PAKE / ECDH + AES-256-GCM)",
          ...snap.pakeSteps.map((s) => `- [${s.status === "done" ? "x" : " "}] ${s.label} (${s.status})`),
          "",
          "## 2. Live Diagnostic Event Log",
          ...snap.events.map(
            (ev) => `- \`${formatTimeShort(ev.timestamp)}\` **[${ev.kind.toUpperCase()}]** ${ev.title} — ${ev.detail}`,
          ),
        ];

    downloadTextFile(`crocflow-inspector-${Date.now()}.md`, lines.join("\n"));
  };

  return (
    <aside
      aria-label={t.inspector.title}
      className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white/95 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/95 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3.5 dark:border-zinc-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t.inspector.title}
            </h2>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              {snap.sessionId
                ? `${snap.mode === "enhanced" ? "Dual-Relay" : "Croc v11"} · ${snap.active ? (locale === "vi" ? "Đang chạy" : "Active") : (locale === "vi" ? "Hoàn tất" : "Idle")}`
                : locale === "vi"
                  ? "Dữ liệu thật từ engine"
                  : "Live protocol engine stream"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportMarkdown}
            disabled={snap.events.length === 0}
            aria-label={t.inspector.exportLogBtn}
            title={t.inspector.exportLogBtn}
            className="inline-flex min-h-[34px] shrink-0 whitespace-nowrap items-center gap-1 rounded-xl border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
          >
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{locale === "vi" ? "Xuất Log" : "Export"}</span>
          </button>
          <button
            type="button"
            onClick={() => protocolEventBus.reset()}
            aria-label="Reset Inspector"
            title="Reset"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* 1. PAKE / Encryption Handshake Timeline */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {locale === "vi" ? "1. Bắt tay mã hóa E2E" : "1. Cryptographic Handshake"}
            </h3>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Zero-Knowledge
            </span>
          </div>
          <ol className="space-y-1.5">
            {snap.pakeSteps.map((step) => (
              <li
                key={step.step}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {step.status === "done" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : step.status === "active" ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-900 dark:text-zinc-100" aria-hidden="true" />
                  ) : step.status === "error" ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-zinc-300 dark:text-zinc-700" aria-hidden="true" />
                  )}
                  <span
                    className={`truncate ${
                      step.status === "done"
                        ? "font-medium text-zinc-900 dark:text-zinc-100"
                        : step.status === "active"
                          ? "font-semibold text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {step.timestamp && (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-400">
                    {formatTimeShort(step.timestamp)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        {/* 2. Chunk Allocation Map */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {locale === "vi"
                ? `2. Bản đồ phân bổ Chunk (${snap.totalChunks})`
                : `2. Chunk Allocation Matrix (${snap.totalChunks})`}
            </h3>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400 font-semibold">
              Alpha {snap.alphaChunks} · Beta {snap.betaChunks}
            </span>
          </div>

          {snap.chunkStates.length > 0 ? (
            <div
              data-testid="chunk-grid"
              className="grid grid-cols-12 gap-1 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800"
            >
              {snap.chunkStates.map((st, idx) => (
                <div
                  key={idx}
                  title={`Chunk #${idx}: ${titles[st]}`}
                  className={`h-3.5 rounded-[3px] transition-colors ${CHUNK_COLOR[st]}`}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {locale === "vi"
                ? "Chưa có Chunk nào được lập lịch. Hãy gửi tệp hoặc chạy Demo để quan sát phân luồng Chẵn / Lẻ."
                : "No active chunks scheduled yet. Start a transfer or run a live demo to inspect even/odd streaming."}
            </div>
          )}

          {/* Explicit Legend */}
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-teal-500" /> {t.inspector.legendAlpha}
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-sky-500" /> {t.inspector.legendBeta}
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500" /> {t.inspector.legendVerified}
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-indigo-500" /> {t.inspector.legendResumed} ({snap.resumedChunks})
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-amber-500" /> {t.inspector.legendFailover} ({snap.failoverChunks})
            </span>
          </div>
        </div>

        {/* 3. Throughput Metrics & Sparkline */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {locale === "vi" ? "3. Thông lượng thực tế" : "3. Real-Time Throughput"}
            </h3>
            <span className="font-mono text-xs font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatSpeed(snap.currentSpeedBps)} · {formatBytes(snap.bytesTransferred)}
            </span>
          </div>
          <ThroughputSparkline
            samples={snap.throughputHistory}
            emptyText={
              locale === "vi"
                ? "Biểu đồ thông lượng sẽ vẽ khi có luồng dữ liệu"
                : "Throughput graph renders when data streams"
            }
          />
        </div>

        {/* 4. Event Stream */}
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {locale === "vi"
              ? `4. Nhật ký sự kiện (${snap.events.length})`
              : `4. Live Event Stream (${snap.events.length})`}
          </h3>
          {snap.events.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {locale === "vi"
                ? "Sẵn sàng ghi nhận các gói bắt tay PAKE, sự kiện Resume Cache và Failover."
                : "Standby for PAKE handshakes, resume cache events, and failover notifications."}
            </p>
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto pr-1 text-xs">
              {snap.events.slice(0, 20).map((ev) => (
                <li
                  key={ev.id}
                  className="border-b border-zinc-100 pb-1.5 last:border-b-0 dark:border-zinc-800/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {ev.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-400">
                      {formatTimeShort(ev.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {ev.detail}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
