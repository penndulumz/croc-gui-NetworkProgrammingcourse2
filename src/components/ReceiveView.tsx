import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Database,
  Download,
  Inbox,
  Layers,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { receiveFiles } from "../protocol/croc/client";
import { DownloadDestination, TextDestination } from "../protocol/croc/storage";
import type { FileProgress, TransferOffer } from "../protocol/croc/types";
import {
  receiveEnhancedTransfer,
  type EnhancedProgress,
  type ReceivedEnhancedFile,
} from "../protocol/enhanced/enhanced-client";
import type { FolderManifest, ResumePlan } from "../protocol/enhanced/manifest";
import {
  clearResumeCache,
  getResumeCacheSummary,
  type ResumeCacheSummary,
} from "../protocol/enhanced/resume-cache";
import { deriveBridgeURL, type BridgePublicConfig } from "../lib/bridge-client";
import { isCodephrase } from "../protocol/croc/codephrase";
import { appendTransferHistory } from "../lib/history-store";
import { downloadBinaryFile, formatBytes, formatSpeed } from "../lib/format";
import type { RelayProfileMode } from "../lib/relay-manager";

export interface ReceiveViewProps {
  bridgeConfig: BridgePublicConfig | null;
  deviceAlias: string;
  relayProfile?: RelayProfileMode;
  onChangeRelayProfile?: (mode: RelayProfileMode) => void;
  prefillCode?: string;
  prefillMode?: "standard" | "enhanced";
  onClearPrefill?: () => void;
  onHistoryUpdated: () => void;
}

type ReceiveMode = "standard" | "enhanced";

interface PendingStandardOffer {
  offer: TransferOffer;
  resolve: (accepted: boolean) => void;
}

interface PendingEnhancedOffer {
  manifest: FolderManifest;
  resumePlan: ResumePlan;
  resolve: (accepted: boolean) => void;
}

export function ReceiveView({
  bridgeConfig,
  deviceAlias,
  relayProfile = "public",
  onChangeRelayProfile,
  prefillCode,
  prefillMode,
  onClearPrefill,
  onHistoryUpdated,
}: ReceiveViewProps) {
  const [mode, setMode] = useState<ReceiveMode>(prefillMode ?? "enhanced");
  const [codephrase, setCodephrase] = useState(prefillCode ?? "");
  const [dualRelay, setDualRelay] = useState(true);

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const [stdProgress, setStdProgress] = useState<FileProgress | null>(null);
  const [enhProgress, setEnhProgress] = useState<EnhancedProgress | null>(null);
  const [pendingStdOffer, setPendingStdOffer] = useState<PendingStandardOffer | null>(null);
  const [pendingEnhOffer, setPendingEnhOffer] = useState<PendingEnhancedOffer | null>(null);

  const [receivedText, setReceivedText] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedEnhancedFile[]>([]);
  const [cacheSummary, setCacheSummary] = useState<ResumeCacheSummary>({
    totalChunks: 0,
    totalBytes: 0,
    sessions: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (prefillCode) {
      setCodephrase(prefillCode);
      if (prefillMode) setMode(prefillMode);
      onClearPrefill?.();
    }
  }, [prefillCode, prefillMode, onClearPrefill]);

  const refreshCacheSummary = async () => {
    const summary = await getResumeCacheSummary();
    setCacheSummary(summary);
  };

  useEffect(() => {
    void refreshCacheSummary();
  }, []);

  const handleClearCache = async () => {
    await clearResumeCache();
    await refreshCacheSummary();
  };

  const handleCancel = () => {
    pendingStdOffer?.resolve(false);
    pendingEnhOffer?.resolve(false);
    setPendingStdOffer(null);
    setPendingEnhOffer(null);
    abortRef.current?.abort();
    setBusy(false);
    setStatusText("Đã hủy phiên nhận.");
  };

  const handleStartReceive = async () => {
    setErrorText(null);
    setSuccessText(null);
    setStdProgress(null);
    setEnhProgress(null);
    setReceivedText(null);
    setReceivedFiles([]);

    const secret = codephrase.trim();
    if (!isCodephrase(secret)) {
      setErrorText("Vui lòng nhập Codephrase hợp lệ (tối thiểu 6 ký tự, chỉ chứa chữ cái, số, gạch ngang).");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);

    if (mode === "standard") {
      if (!bridgeConfig || bridgeConfig.relayAddresses.length === 0) {
        setErrorText("Bridge Server chưa sẵn sàng danh sách Relay công cộng.");
        setBusy(false);
        return;
      }

      try {
        const bridgeURL = deriveBridgeURL(window.location.protocol, window.location.host, "/ws");

        const offer = await receiveFiles({
          secret,
          settings: {
            bridgeURL,
            relayAddresses: bridgeConfig.relayAddresses,
            relayPassword: bridgeConfig.relayPassword,
            storeAPI: "",
          },
          signal: controller.signal,
          callbacks: {
            onStatus: setStatusText,
            onProgress: setStdProgress,
            onOffer: async (incomingOffer) => {
              const accepted = await new Promise<boolean>((resolve) => {
                setPendingStdOffer({ offer: incomingOffer, resolve });
              });
              setPendingStdOffer(null);
              if (!accepted) return false;
              if (incomingOffer.kind === "text") {
                return new TextDestination((txt) => setReceivedText(txt));
              }
              return new DownloadDestination();
            },
          },
        });

        appendTransferHistory({
          direction: "receive",
          mode: "standard",
          dualRelay: false,
          codephrase: secret,
          fileCount: offer.files.length,
          summaryName:
            offer.kind === "text"
              ? "Tin nhắn văn bản (Croc v11)"
              : offer.files.length === 1
                ? offer.files[0].path
                : `${offer.files[0].path} (+${offer.files.length - 1} tệp)`,
          totalBytes: offer.totalSize,
          status: "completed",
          verifiedHash: "XXH64",
          deviceAlias,
        });
        onHistoryUpdated();
        setSuccessText(
          offer.kind === "text"
            ? "Đã nhận văn bản mã hóa thành công — xem nội dung bên dưới."
            : `Đã nhận & kiểm tra XXH64 xong ${offer.files.length} tệp (${formatBytes(offer.totalSize)}).`,
        );
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setErrorText(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setBusy(false);
        setPendingStdOffer(null);
        abortRef.current = null;
      }
      return;
    }

    // Enhanced Mode Receive
    try {
      const wsDualUrl = deriveBridgeURL(
        typeof window !== "undefined" ? window.location.protocol : "http:",
        typeof window !== "undefined" ? window.location.host : "localhost:3000",
        "/ws-dual",
      );
      const res = await receiveEnhancedTransfer({
        codephrase: secret,
        dualRelay,
        baseWsUrl: wsDualUrl,
        signal: controller.signal,
        onStatus: setStatusText,
        onProgress: setEnhProgress,
        onManifestOffer: (manifest, resumePlan) =>
          new Promise<boolean>((resolve) => {
            setPendingEnhOffer({ manifest, resumePlan, resolve });
          }).finally(() => setPendingEnhOffer(null)),
      });

      setReceivedFiles(res.files);
      await refreshCacheSummary();

      appendTransferHistory({
        direction: "receive",
        mode: "enhanced",
        dualRelay,
        codephrase: secret,
        fileCount: res.files.length,
        summaryName:
          res.files.length === 1
            ? res.files[0].relativePath
            : `${res.files[0].relativePath} (+${res.files.length - 1} tệp)`,
        totalBytes: res.manifest.totalBytes,
        status: res.resumePlan.skippedChunks.length > 0 ? "resumed" : "completed",
        verifiedHash: "SHA-256",
        resumedChunks: res.resumePlan.skippedChunks.length,
        deviceAlias,
      });
      onHistoryUpdated();
      setSuccessText(
        `Đã nhận & xác thực SHA-256 toàn bộ ${res.files.length} tệp (${formatBytes(res.manifest.totalBytes)}). Bỏ qua ${res.resumePlan.skippedChunks.length} chunk từ Resume Cache.`,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setErrorText(err instanceof Error ? err.message : String(err));
      }
      await refreshCacheSummary();
    } finally {
      setBusy(false);
      setPendingEnhOffer(null);
      abortRef.current = null;
    }
  };

  const progressPercent =
    mode === "standard" && stdProgress && stdProgress.totalSize > 0
      ? Math.min(100, Math.round((stdProgress.totalBytes / stdProgress.totalSize) * 100))
      : mode === "enhanced" && enhProgress && enhProgress.totalChunks > 0
        ? Math.min(100, Math.round((enhProgress.completedChunks / enhProgress.totalChunks) * 100))
        : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Nhận tệp & thư mục mã hóa
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Nhập Codephrase từ người gửi hoặc mở trực tiếp từ mã QR. Dữ liệu chỉ được giải mã sau khi xác thực PAKE 2 chiều.
        </p>
      </div>

      {/* Mode Switcher */}
      <div
        role="tablist"
        aria-label="Chọn chế độ nhận"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "standard"}
          disabled={busy}
          onClick={() => setMode("standard")}
          className={`flex min-h-[54px] items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
            mode === "standard"
              ? "border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/30"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70"
          }`}
        >
          <ShieldCheck
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              mode === "standard" ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
            }`}
            aria-hidden="true"
          />
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Chuẩn Croc v11
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Nhận từ <code className="font-mono">croc send</code> trên CLI hoặc getcroc.com
            </div>
          </div>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "enhanced"}
          disabled={busy}
          onClick={() => setMode("enhanced")}
          className={`flex min-h-[54px] items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
            mode === "enhanced"
              ? "border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/30"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70"
          }`}
        >
          <Layers
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              mode === "enhanced" ? "text-teal-600 dark:text-teal-400" : "text-slate-400"
            }`}
            aria-hidden="true"
          />
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Nâng cao CrocFlow (2 Relay & Resume)
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Tự kiểm tra IndexedDB Resume Cache để bỏ qua chunk đã tải trước đó
            </div>
          </div>
        </button>
      </div>

      {/* Main Receive Input Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {/* Active Relay Profile Badge */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">Hồ sơ Relay:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold ${
                relayProfile === "local-dual"
                  ? "bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-200 border border-teal-300/40"
                  : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300/40"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  relayProfile === "local-dual" ? "bg-teal-500 animate-pulse" : "bg-emerald-500"
                }`}
                aria-hidden="true"
              />
              {relayProfile === "local-dual"
                ? "Local Dual-Relay Lab (Offline/LAN)"
                : "Public Croc Relays"}
            </span>
          </div>
          {onChangeRelayProfile && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onChangeRelayProfile(relayProfile === "local-dual" ? "public" : "local-dual")
              }
              className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium underline-offset-2 hover:underline disabled:opacity-50"
            >
              Đổi sang {relayProfile === "local-dual" ? "Public Croc Relays" : "Local Lab"}
            </button>
          )}
        </div>

        {/* Guidance when Local Dual-Relay Lab is active in Standard Mode */}
        {mode === "standard" && relayProfile === "local-dual" && (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div>
                <p className="font-semibold">Lưu ý khi dùng Chuẩn Croc v11 với Local Dual-Relay Lab:</p>
                <p className="mt-1 leading-relaxed text-amber-800 dark:text-amber-300">
                  Chế độ Nâng cao (Enhanced Mode) được tối ưu hóa cho Local Dual-Relay Lab qua <code>/ws-dual</code> (hoạt động offline/LAN hoàn toàn không cần mở cổng TCP ra internet). Với Chuẩn Croc v11, kết nối sẽ đi qua Bridge cục bộ nhưng vẫn phụ thuộc vào cổng TCP của relay. Khuyên dùng <strong>Nâng cao CrocFlow</strong> để có trải nghiệm tối ưu trong phòng lab offline.
                </p>
              </div>
            </div>
          </div>
        )}

        <label
          htmlFor="receive-codephrase-input"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Nhập Codephrase từ máy gửi
        </label>
        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <input
            id="receive-codephrase-input"
            type="text"
            value={codephrase}
            disabled={busy}
            onChange={(e) => setCodephrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void handleStartReceive();
            }}
            placeholder="Ví dụ: 4281-mango-solar-river"
            className="min-h-[46px] flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 font-mono text-sm font-semibold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {!busy ? (
            <button
              type="button"
              onClick={() => void handleStartReceive()}
              className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <Inbox className="h-4 w-4" aria-hidden="true" />
              Kết nối & Nhận
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex min-h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Hủy nhận
            </button>
          )}
        </div>

        {mode === "enhanced" && (
          <div className="mt-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={dualRelay}
                disabled={busy}
                onChange={(e) => setDualRelay(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Mở song song 2 kênh nhận (Relay Alpha Chẵn & Relay Beta Lẻ)
            </label>
          </div>
        )}

        {/* Standard Mode Offer Preview */}
        {pendingStdOffer && (
          <div className="mt-4 rounded-xl border border-teal-500/40 bg-teal-50/60 p-4 dark:border-teal-400/30 dark:bg-teal-950/30">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Xác nhận nhận {pendingStdOffer.offer.kind === "text" ? "văn bản" : `${pendingStdOffer.offer.files.length} tệp`} ({formatBytes(pendingStdOffer.offer.totalSize)})
            </h3>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono text-xs text-slate-700 dark:text-slate-300">
              {pendingStdOffer.offer.files.map((f, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span className="truncate">{f.path}</span>
                  <span className="shrink-0 tabular-nums">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => pendingStdOffer.resolve(true)}
                className="min-h-[40px] rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
              >
                Chấp nhận & Tải xuống
              </button>
              <button
                type="button"
                onClick={() => pendingStdOffer.resolve(false)}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Từ chối
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Mode Manifest & Resume Offer Preview */}
        {pendingEnhOffer && (
          <div className="mt-4 rounded-xl border border-teal-500/40 bg-teal-50/60 p-4 dark:border-teal-400/30 dark:bg-teal-950/30">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Folder Manifest: {pendingEnhOffer.manifest.totalFiles} tệp ({formatBytes(pendingEnhOffer.manifest.totalBytes)})
            </h3>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
              Resume Cache khớp{" "}
              <strong className="font-mono">
                {pendingEnhOffer.resumePlan.skippedChunks.length}/{pendingEnhOffer.manifest.totalChunks}
              </strong>{" "}
              chunks ({formatBytes(pendingEnhOffer.resumePlan.bytesSkipped)} đã có sẵn) · Cần tải{" "}
              <strong className="font-mono">{formatBytes(pendingEnhOffer.resumePlan.bytesRemaining)}</strong>.
            </p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto font-mono text-xs text-slate-700 dark:text-slate-300">
              {pendingEnhOffer.manifest.files.map((f) => (
                <li key={f.relativePath} className="flex justify-between gap-2">
                  <span className="truncate">{f.relativePath}</span>
                  <span className="shrink-0 tabular-nums">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => pendingEnhOffer.resolve(true)}
                className="min-h-[40px] rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
              >
                Chấp nhận & Nhận tiếp
              </button>
              <button
                type="button"
                onClick={() => pendingEnhOffer.resolve(false)}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Từ chối
              </button>
            </div>
          </div>
        )}

        {/* Progress / Status */}
        {(busy || statusText || errorText || successText) && (
          <div className="mt-4 space-y-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
            {statusText && (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{statusText}</span>
                  <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                    ({relayProfile === "local-dual" ? "Local Lab" : "Public"})
                  </span>
                </div>
                {progressPercent > 0 && (
                  <span className="font-mono font-semibold tabular-nums">{progressPercent}%</span>
                )}
              </div>
            )}
            {(busy || progressPercent > 0) && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-150 dark:bg-teal-400"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
            {enhProgress && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                <span>
                  Chunks: {enhProgress.completedChunks}/{enhProgress.totalChunks}
                </span>
                <span>Tốc độ: {formatSpeed(enhProgress.speedBps)}</span>
                <span>Alpha: {enhProgress.alphaChunks}</span>
                <span>Beta: {enhProgress.betaChunks}</span>
                <span>Resume: {enhProgress.resumedChunks}</span>
              </div>
            )}
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

        {/* Received Text Display (never auto-downloaded) */}
        {receivedText !== null && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Văn bản đã giải mã
              </span>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(receivedText);
                  setCopiedText(true);
                  setTimeout(() => setCopiedText(false), 1800);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
              >
                {copiedText ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedText ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-900 dark:text-slate-100">
              {receivedText}
            </pre>
          </div>
        )}

        {/* Received Enhanced Files Ready to Save */}
        {receivedFiles.length > 0 && (
          <div className="mt-4 space-y-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Tệp đã ghép & xác thực SHA-256 ({receivedFiles.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  for (const file of receivedFiles) {
                    downloadBinaryFile(file.name, file.bytes, file.mimeType);
                  }
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Lưu tất cả
              </button>
            </div>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {receivedFiles.map((file) => (
                <li
                  key={file.relativePath}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono font-medium text-slate-900 dark:text-slate-100">
                      {file.relativePath}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {formatBytes(file.size)} · SHA-256: {file.sha256.slice(0, 12)}…
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadBinaryFile(file.name, file.bytes, file.mimeType)}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Lưu tệp
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* IndexedDB Resume Cache Manager */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Bộ nhớ đệm Resume Cache (IndexedDB)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lưu từng Chunk đã khớp mã băm SHA-256 để tiếp tục ngay từ chỗ đứt khi mất mạng.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshCacheSummary()}
              aria-label="Làm mới Resume Cache"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Làm mới
            </button>
            <button
              type="button"
              disabled={cacheSummary.totalChunks === 0}
              onClick={() => void handleClearCache()}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Xóa bộ nhớ đệm
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-100 pt-3.5 text-xs dark:border-slate-800">
          <div>
            <div className="text-slate-500 dark:text-slate-400">Chunk đã xác thực</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {cacheSummary.totalChunks}
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Dung lượng lưu cục bộ</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {formatBytes(cacheSummary.totalBytes)}
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Phiên đang lưu</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {cacheSummary.sessions.length}
            </div>
          </div>
        </div>

        {cacheSummary.sessions.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            {cacheSummary.sessions.map((s) => (
              <li
                key={s.sessionKey}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
              >
                <span className="truncate font-mono text-slate-800 dark:text-slate-200">
                  {s.filePaths.join(", ")}
                </span>
                <span className="shrink-0 font-mono tabular-nums">
                  {s.chunkCount} chunks · {formatBytes(s.totalBytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
