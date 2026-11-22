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

const CHUNK_COLOR: Record<ChunkVisualState, string> = {
  pending: "bg-slate-200 dark:bg-slate-800",
  alpha: "bg-teal-500 dark:bg-teal-400",
  beta: "bg-sky-500 dark:bg-sky-400",
  verified: "bg-emerald-500 dark:bg-emerald-400",
  resumed: "bg-indigo-500 dark:bg-indigo-400",
  failover: "bg-amber-500 dark:bg-amber-400",
};

const CHUNK_TITLE: Record<ChunkVisualState, string> = {
  pending: "Chờ gửi",
  alpha: "Đang đi qua Relay Alpha (Chẵn)",
  beta: "Đang đi qua Relay Beta (Lẻ)",
  verified: "Đã xác thực SHA-256 / XXH64",
  resumed: "Bỏ qua — lấy từ Resume Cache (IndexedDB)",
  failover: "Failover — chuyển hướng từ Alpha sang Beta",
};

function ThroughputSparkline({ samples }: { samples: InspectorSnapshot["throughputHistory"] }) {
  if (samples.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Biểu đồ thông lượng (Throughput) sẽ vẽ khi có luồng dữ liệu
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
      className="h-16 w-full overflow-visible rounded-lg bg-slate-50 px-1 dark:bg-slate-950/60"
      role="img"
      aria-label="Biểu đồ tốc độ truyền theo thời gian thực"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-teal-600 dark:text-teal-400"
        points={points}
      />
    </svg>
  );
}

export function ProtocolInspector() {
  const [snap, setSnap] = useState<InspectorSnapshot>(() => protocolEventBus.getSnapshot());

  useEffect(() => {
    return protocolEventBus.subscribe(setSnap);
  }, []);

  const handleExportMarkdown = () => {
    const lines = [
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
    ];
    downloadTextFile(`crocflow-inspector-${Date.now()}.md`, lines.join("\n"));
  };

  return (
    <aside
      aria-label="Bảng soi giao thức mạng trực tiếp"
      className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Bảng soi giao thức
            </h2>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {snap.sessionId
                ? `${snap.mode === "enhanced" ? "Dual-Relay" : "Croc v11"} · ${snap.active ? "Đang chạy" : "Hoàn tất"}`
                : "Dữ liệu thật từ engine"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportMarkdown}
            disabled={snap.events.length === 0}
            aria-label="Xuất log giao thức Markdown"
            className="inline-flex min-h-[34px] shrink-0 whitespace-nowrap items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Xuất Log</span>
          </button>
          <button
            type="button"
            onClick={() => protocolEventBus.reset()}
            aria-label="Đặt lại bảng soi giao thức"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* 1. PAKE / Encryption Handshake Timeline */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              1. Bắt tay mã hóa E2E
            </h3>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
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
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  ) : step.status === "error" ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-700" aria-hidden="true" />
                  )}
                  <span
                    className={`truncate ${
                      step.status === "done"
                        ? "font-medium text-slate-900 dark:text-slate-100"
                        : step.status === "active"
                          ? "font-semibold text-teal-700 dark:text-teal-300"
                          : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {step.timestamp && (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400">
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2. Bản đồ phân bổ Chunk ({snap.totalChunks})
            </h3>
            <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
              Alpha {snap.alphaChunks} · Beta {snap.betaChunks}
            </span>
          </div>

          {snap.chunkStates.length > 0 ? (
            <div
              data-testid="chunk-grid"
              className="grid grid-cols-12 gap-1 rounded-lg bg-slate-50 p-2 dark:bg-slate-950/60"
            >
              {snap.chunkStates.map((st, idx) => (
                <div
                  key={idx}
                  title={`Chunk #${idx}: ${CHUNK_TITLE[st]}`}
                  className={`h-3.5 rounded-[3px] transition-colors ${CHUNK_COLOR[st]}`}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Chưa có Chunk nào được lập lịch. Hãy gửi tệp hoặc chạy Demo 2 Relay để quan sát phân luồng Chẵn / Lẻ.
            </div>
          )}

          {/* Explicit Legend */}
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-teal-500" /> Alpha (Chẵn)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-sky-500" /> Beta (Lẻ)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500" /> SHA-256 OK
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-indigo-500" /> Resume ({snap.resumedChunks})
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[2px] bg-amber-500" /> Failover ({snap.failoverChunks})
            </span>
          </div>
        </div>

        {/* 3. Throughput Metrics & Sparkline */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              3. Thông lượng thực tế
            </h3>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatSpeed(snap.currentSpeedBps)} · {formatBytes(snap.bytesTransferred)}
            </span>
          </div>
          <ThroughputSparkline samples={snap.throughputHistory} />
        </div>

        {/* 4. Event Stream */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            4. Nhật ký sự kiện ({snap.events.length})
          </h3>
          {snap.events.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sẵn sàng ghi nhận các gói bắt tay PAKE, sự kiện Resume Cache và Failover.
            </p>
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto pr-1 text-xs">
              {snap.events.slice(0, 20).map((ev) => (
                <li
                  key={ev.id}
                  className="border-b border-slate-100 pb-1.5 last:border-b-0 dark:border-slate-800/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {ev.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                      {formatTimeShort(ev.timestamp)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
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
