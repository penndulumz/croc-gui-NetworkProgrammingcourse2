import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  Copy,
  FileText,
  FolderUp,
  Layers,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  WifiOff,
  X,
  AlertCircle,
  Zap,
  Smartphone,
  QrCode,
} from "lucide-react";
import { asCodephrase, generateCode, generateOptimizedCodephrase, isCodephrase, type Codephrase } from "../protocol/croc/codephrase";
import { prepareFiles, prepareText, sendFiles } from "../protocol/croc/client";
import { maxTextTransferBytes, type FileProgress as CrocFileProgress } from "../protocol/croc/types";
import {
  filesToManifestInputs,
  sendEnhancedTransfer,
  type EnhancedControlHandle,
  type EnhancedProgress,
} from "../protocol/enhanced/enhanced-client";
import { deriveBridgeURL, type BridgePublicConfig } from "../lib/bridge-client";
import {
  appendTransferHistory,
  loadPeerPresets,
  touchPeerPreset,
  type PeerPreset,
} from "../lib/history-store";
import { formatBytes } from "../lib/format";
import {
  RollingMetricsTracker,
  useRollingMetrics,
  formatEta,
  formatSpeed,
  calculateFileProgress,
  type FileProgress,
} from "../lib/metrics";
import {
  findFastestRelay,
  loadRelayLatencies,
  probePublicRelays,
  type RelayProfileMode,
} from "../lib/relay-manager";
import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";
import { ModeSelector } from "./ModeSelector";

export interface SendViewProps {
  bridgeConfig: BridgePublicConfig | null;
  deviceAlias: string;
  relayProfile?: RelayProfileMode;
  onChangeRelayProfile?: (mode: RelayProfileMode) => void;
  prefillCode?: string;
  onClearPrefill?: () => void;
  onHistoryUpdated: () => void;
  selectedPeer?: PeerPreset;
  onClearSelectedPeer?: () => void;
  locale?: Locale;
}

type SendMode = "standard" | "enhanced";
type StandardPayloadKind = "files" | "text";

export function SendView({
  bridgeConfig,
  deviceAlias,
  relayProfile = "public",
  onChangeRelayProfile,
  prefillCode,
  onClearPrefill,
  onHistoryUpdated,
  selectedPeer,
  onClearSelectedPeer,
  locale = "vi",
}: SendViewProps) {
  const t = getTranslations(locale);
  const [mode, setMode] = useState<SendMode>("enhanced");
  const [payloadKind, setPayloadKind] = useState<StandardPayloadKind>("files");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [textPayload, setTextPayload] = useState("");
  const [codephrase, setCodephrase] = useState("4281-croc-flow-demo");
  const [dualRelay, setDualRelay] = useState(true);
  const [targetFastestRelay, setTargetFastestRelay] = useState(true);
  const [chunkSize, setChunkSize] = useState<number>(64 * 1024);
  const [optimizedRelay, setOptimizedRelay] = useState<{
    index: number;
    host: string;
    rttMs: number;
  } | null>(null);

  const [peerPresets, setPeerPresets] = useState<PeerPreset[]>(() => loadPeerPresets());
  const [activePeer, setActivePeer] = useState<PeerPreset | null>(null);

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const [stdProgress, setStdProgress] = useState<CrocFileProgress | null>(null);
  const [enhProgress, setEnhProgress] = useState<EnhancedProgress | null>(null);
  const metricsTrackerRef = useRef<RollingMetricsTracker | null>(null);
  const [metrics, setMetrics] = useRollingMetrics(metricsTrackerRef, busy);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const enhancedHandleRef = useRef<EnhancedControlHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const fastestProbedRelay = useMemo(() => {
    const relayAddresses = bridgeConfig?.relayAddresses ?? [];
    const latencies = loadRelayLatencies();
    return findFastestRelay(latencies, relayAddresses);
  }, [bridgeConfig]);

  const autoGenerateCode = useCallback(
    async (targetMode: SendMode = mode) => {
      const relayAddresses = bridgeConfig?.relayAddresses ?? [];
      if (targetMode === "standard" && relayAddresses.length > 0) {
        let latencies = loadRelayLatencies();
        let fastest = findFastestRelay(latencies, relayAddresses);
        if (!fastest) {
          try {
            latencies = await probePublicRelays(relayAddresses);
            fastest = findFastestRelay(latencies, relayAddresses);
          } catch {
            // Ignore probe errors
          }
        }
        if (fastest) {
          const optimized = await generateOptimizedCodephrase(
            fastest.index,
            relayAddresses.length,
          );
          setCodephrase(optimized);
          setOptimizedRelay(fastest);
          return;
        }
      }
      setOptimizedRelay(null);
      setCodephrase(generateCode());
    },
    [bridgeConfig, mode],
  );

  useEffect(() => {
    if (prefillCode) {
      setCodephrase(prefillCode);
      setOptimizedRelay(null);
      onClearPrefill?.();
      return;
    }
    void autoGenerateCode();
  }, [prefillCode, onClearPrefill, autoGenerateCode]);

  useEffect(() => {
    if (selectedPeer) {
      setActivePeer(selectedPeer);
      touchPeerPreset(selectedPeer.id);
      if (
        selectedPeer.preferredRelayProfile &&
        onChangeRelayProfile &&
        selectedPeer.preferredRelayProfile !== relayProfile
      ) {
        onChangeRelayProfile(selectedPeer.preferredRelayProfile);
      }
      onClearSelectedPeer?.();
    }
  }, [selectedPeer, onChangeRelayProfile, relayProfile, onClearSelectedPeer]);

  const handleSelectPeerPreset = (peer: PeerPreset | null) => {
    setActivePeer(peer);
    if (peer) {
      touchPeerPreset(peer.id);
      setPeerPresets(loadPeerPresets());
      if (
        peer.preferredRelayProfile &&
        onChangeRelayProfile &&
        peer.preferredRelayProfile !== relayProfile
      ) {
        onChangeRelayProfile(peer.preferredRelayProfile);
      }
    }
  };

  const regenerateCode = () => {
    void autoGenerateCode();
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedItem(label);
      setTimeout(() => setCopiedItem((prev) => (prev === label ? null : prev)), 1800);
    } catch {
      setErrorText("Trình duyệt không cho phép sao chép tự động — hãy bôi đen và copy thủ công.");
    }
  };

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length === 0) return;
    setSelectedFiles((prev) => {
      const existing = new Set(
        prev.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name),
      );
      const merged = [...prev];
      for (const file of list) {
        const key =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        if (!existing.has(key)) {
          existing.add(key);
          merged.push(file);
        }
      }
      return merged;
    });
    setErrorText(null);
    setSuccessText(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSelectedBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const textByteCount = new TextEncoder().encode(textPayload).byteLength;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?code=${encodeURIComponent(codephrase.trim())}&mode=${mode}`
      : "";

  const cliCommand = `croc ${codephrase.trim()}`;

  const handleCancel = () => {
    abortRef.current?.abort();
    enhancedHandleRef.current?.cancel();
    setBusy(false);
    setStatusText("Đã hủy phiên gửi.");
  };

  const handleSimulateAlphaDisconnect = () => {
    enhancedHandleRef.current?.simulateAlphaDisconnect();
  };

  const handleStartSend = async () => {
    setErrorText(null);
    setSuccessText(null);
    setStdProgress(null);
    setEnhProgress(null);
    metricsTrackerRef.current = new RollingMetricsTracker();
    setMetrics({ speedBps: 0, etaSeconds: null, isStalled: false });

    const secret = codephrase.trim();
    if (!isCodephrase(secret)) {
      setErrorText("Codephrase không hợp lệ (tối thiểu 6 ký tự, chỉ chứa chữ cái, số, gạch ngang).");
      return;
    }

    if (mode === "standard") {
      if (payloadKind === "files" && selectedFiles.length === 0) {
        setErrorText("Hãy chọn ít nhất 1 tệp để gửi qua chuẩn Croc v11.");
        return;
      }
      if (payloadKind === "text") {
        if (textByteCount === 0) {
          setErrorText("Hãy nhập nội dung văn bản cần gửi.");
          return;
        }
        if (textByteCount > maxTextTransferBytes) {
          setErrorText("Văn bản gửi nhanh vượt quá giới hạn 1 MiB.");
          return;
        }
      }
      if (!bridgeConfig || bridgeConfig.relayAddresses.length === 0) {
        setErrorText("Bridge Server chưa sẵn sàng danh sách Relay Croc công cộng.");
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      try {
        const prepared =
          payloadKind === "text"
            ? await prepareText(textPayload, { onStatus: setStatusText }, controller.signal)
            : await prepareFiles(selectedFiles, { onStatus: setStatusText }, controller.signal);

        const bridgeURL = deriveBridgeURL(window.location.protocol, window.location.host, "/ws");

        await sendFiles({
          files: prepared,
          sendingText: payloadKind === "text",
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
            onProgress: (p) => {
              setStdProgress(p);
              if (metricsTrackerRef.current) {
                setMetrics(metricsTrackerRef.current.update(p.totalBytes, p.totalSize));
              }
            },
          },
        });

        const totalBytes = prepared.reduce((acc, f) => acc + f.size, 0);
        const recordedAlias = activePeer ? `${deviceAlias} → ${activePeer.alias}` : deviceAlias;
        if (activePeer) {
          touchPeerPreset(activePeer.id);
        }
        appendTransferHistory({
          direction: "send",
          mode: "standard",
          dualRelay: false,
          codephrase: secret,
          fileCount: prepared.length,
          summaryName:
            payloadKind === "text"
              ? "Tin nhắn văn bản (Croc v11)"
              : prepared.length === 1
                ? prepared[0].name
                : `${prepared[0].name} (+${prepared.length - 1} tệp)`,
          totalBytes,
          status: "completed",
          verifiedHash: "XXH64",
          deviceAlias: recordedAlias,
        });
        onHistoryUpdated();
        setSuccessText("Đã gửi hoàn tất qua chuẩn Croc v11 (tương thích CLI & getcroc.com).");
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setErrorText(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
      return;
    }

    // Enhanced Mode: Folder Manifest + SHA-256 + Dual-Relay
    if (selectedFiles.length === 0) {
      setErrorText("Hãy chọn ít nhất 1 tệp hoặc 1 thư mục cần gửi.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const inputs = await filesToManifestInputs(selectedFiles);
      const wsDualUrl = deriveBridgeURL(
        typeof window !== "undefined" ? window.location.protocol : "http:",
        typeof window !== "undefined" ? window.location.host : "localhost:3000",
        "/ws-dual",
      );
      const targetedNode =
        targetFastestRelay && fastestProbedRelay
          ? `${fastestProbedRelay.host} (${fastestProbedRelay.rttMs} ms)`
          : undefined;

      const res = await sendEnhancedTransfer({
        files: inputs,
        codephrase: secret,
        dualRelay,
        targetRelayNode: targetedNode,
        chunkSize,
        chunkDelayMs: 12,
        baseWsUrl: wsDualUrl,
        signal: controller.signal,
        onStatus: setStatusText,
        onProgress: (p) => {
          setEnhProgress(p);
          if (metricsTrackerRef.current) {
            setMetrics(metricsTrackerRef.current.update(p.bytesTransferred, p.totalBytes));
          }
        },
        onHandleReady: (h) => {
          enhancedHandleRef.current = h;
        },
      });

      const recordedAlias = activePeer ? `${deviceAlias} → ${activePeer.alias}` : deviceAlias;
      if (activePeer) {
        touchPeerPreset(activePeer.id);
      }
      appendTransferHistory({
        direction: "send",
        mode: "enhanced",
        dualRelay,
        codephrase: secret,
        fileCount: res.manifest.totalFiles,
        summaryName:
          res.manifest.totalFiles === 1
            ? res.manifest.files[0].relativePath
            : `${res.manifest.files[0].relativePath} (+${res.manifest.totalFiles - 1} tệp)`,
        totalBytes: res.manifest.totalBytes,
        status: res.resumedChunks > 0 ? "resumed" : "completed",
        verifiedHash: "SHA-256",
        resumedChunks: res.resumedChunks,
        failoverTriggered: res.failoverRerouted > 0,
        deviceAlias: recordedAlias,
      });
      onHistoryUpdated();
      setSuccessText(
        `Hoàn tất ${res.manifest.totalFiles} tệp (${formatBytes(res.manifest.totalBytes)}) · Alpha: ${res.alphaDelivered} chunk · Beta: ${res.betaDelivered} chunk${res.failoverRerouted > 0 ? ` · Failover: ${res.failoverRerouted}` : ""}${res.resumedChunks > 0 ? ` · Resume bỏ qua: ${res.resumedChunks}` : ""}.`,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setErrorText(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      enhancedHandleRef.current = null;
    }
  };

  const progressPercent =
    mode === "standard" && stdProgress && stdProgress.totalSize > 0
      ? Math.min(100, Math.round((stdProgress.totalBytes / stdProgress.totalSize) * 100))
      : mode === "enhanced" && enhProgress && enhProgress.totalChunks > 0
        ? Math.min(100, Math.round((enhProgress.completedChunks / enhProgress.totalChunks) * 100))
        : 0;

  const fileProgressList = useMemo<FileProgress[]>(() => {
    if (mode === "standard") {
      if (selectedFiles.length <= 1 || !stdProgress) return [];
      return calculateFileProgress(
        selectedFiles.map((f) => ({
          name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
          size: f.size,
        })),
        stdProgress.fileIndex,
        stdProgress.fileBytes,
      );
    }
    if (mode === "enhanced") {
      if (enhProgress?.fileProgress && enhProgress.fileProgress.length > 1) {
        return enhProgress.fileProgress;
      }
      if (selectedFiles.length > 1 && enhProgress) {
        return calculateFileProgress(
          selectedFiles.map((f) => ({
            name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
            size: f.size,
          })),
          0,
          0,
        );
      }
    }
    return [];
  }, [mode, selectedFiles, stdProgress, enhProgress]);

  const isLocalProfile = relayProfile === "local-dual" || relayProfile === "local-lab";

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.send.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.send.subtitle}
          </p>
        </div>
      </div>

      {/* Compact Segmented Mode Selector with Info Modal */}
      <ModeSelector
        mode={mode}
        onChangeMode={(newMode) => {
          setMode(newMode);
          if (newMode === "standard") {
            void autoGenerateCode("standard");
          }
        }}
        disabled={busy}
        locale={locale}
      />

      {/* Main Transfer Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        {/* Active Relay Profile Badge */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3.5 py-2 text-xs border border-slate-200 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">Hồ sơ Relay:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold ${
                isLocalProfile
                  ? "bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-200 border border-teal-300/40"
                  : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300/40"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isLocalProfile ? "bg-teal-500 animate-pulse" : "bg-emerald-500"
                }`}
                aria-hidden="true"
              />
              {isLocalProfile
                ? "Local Dual-Relay Lab (Offline/LAN)"
                : "Public Croc Relays"}
            </span>
          </div>
          {onChangeRelayProfile && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onChangeRelayProfile(isLocalProfile ? "public" : "local-lab")
              }
              className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium underline-offset-2 hover:underline disabled:opacity-50"
            >
              Đổi sang {isLocalProfile ? "Public Croc Relays" : "Local Lab"}
            </button>
          )}
        </div>

        {/* Guidance when Local Dual-Relay Lab is active in Standard Mode */}
        {mode === "standard" && isLocalProfile && (
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

        {/* Payload Selector Header */}
        {mode === "standard" ? (
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setPayloadKind("files")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                payloadKind === "files"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Tệp tin
            </button>
            <button
              type="button"
              onClick={() => setPayloadKind("text")}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                payloadKind === "text"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Văn bản nhanh (≤ 1 MiB)
            </button>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={dualRelay}
                  disabled={busy}
                  onChange={(e) => setDualRelay(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Chế độ 2 Relay (Alpha Chẵn / Beta Lẻ)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={targetFastestRelay}
                  disabled={busy}
                  onChange={(e) => setTargetFastestRelay(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Định tuyến trực tiếp qua Relay Node nhanh nhất
                {fastestProbedRelay && (
                  <span className="text-xs font-normal text-teal-700 dark:text-teal-400">
                    (⚡ {fastestProbedRelay.host} · {fastestProbedRelay.rttMs} ms)
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <label htmlFor="chunk-size-select">Kích thước Chunk:</label>
                <select
                  id="chunk-size-select"
                  value={chunkSize}
                  disabled={busy}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value={16 * 1024}>16 KB (Dễ soi lưới)</option>
                  <option value={64 * 1024}>64 KB (Cân bằng)</option>
                  <option value={256 * 1024}>256 KB (Tệp lớn)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* File / Folder Dropzone or Textarea */}
        {mode === "standard" && payloadKind === "text" ? (
          <div className="space-y-2">
            <label
              htmlFor="croc-text-payload"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Nội dung văn bản gửi mã hóa
            </label>
            <textarea
              id="croc-text-payload"
              rows={5}
              value={textPayload}
              disabled={busy}
              onChange={(e) => setTextPayload(e.target.value)}
              placeholder="Nhập ghi chú, cấu hình hoặc đoạn mã nguồn cần gửi an toàn…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Bên nhận sẽ xem trực tiếp trên màn hình thay vì tự tải xuống.</span>
              <span className="font-mono tabular-nums">
                {formatBytes(textByteCount)} / 1 MB
              </span>
            </div>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Unified Drag-and-Drop Canvas */}
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (!busy && e.dataTransfer.files) addFiles(e.dataTransfer.files);
              }}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                isDragging
                  ? "border-emerald-500 bg-emerald-500/10 scale-[1.005]"
                  : "border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/40 dark:hover:border-zinc-600"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Upload className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {locale === "vi" ? "Kéo thả tệp hoặc thư mục vào đây" : "Drop files or folders here"}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {locale === "vi" ? "hoặc duyệt từ thiết bị của bạn" : "or browse from your device"}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.send.browseFiles}
                </button>
                {mode === "enhanced" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => folderInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <FolderUp className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.send.browseFolders}
                  </button>
                )}
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="mb-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {selectedFiles.length} {locale === "vi" ? "tệp đã chọn" : "files selected"}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {formatBytes(totalSelectedBytes)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSelectedFiles([])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.send.clearFiles}
                  </button>
                </div>
                <ul className="max-h-48 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-100 dark:divide-zinc-800/80 dark:border-zinc-800">
                  {selectedFiles.map((file, idx) => {
                    const rel =
                      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
                      file.name;
                    return (
                      <li
                        key={`${rel}-${idx}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"
                      >
                        <span className="truncate font-mono text-zinc-800 dark:text-zinc-200">
                          {rel}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono tabular-nums text-zinc-500">
                            {formatBytes(file.size)}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeFile(idx)}
                            aria-label={`Bỏ tệp ${rel}`}
                            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Streamlined Transfer Target Bar */}
        <div className="mt-5 rounded-2xl border border-zinc-200/90 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Codephrase display & actions */}
            <div className="flex-1">
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="send-codephrase-input"
                  className="text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                >
                  {t.send.secretPhrase}
                </label>
                {optimizedRelay && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                    <Zap className="h-3 w-3" />
                    Relay #{optimizedRelay.index + 1} ({optimizedRelay.host}, {optimizedRelay.rttMs}ms)
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  id="send-codephrase-input"
                  type="text"
                  value={codephrase}
                  disabled={busy}
                  onChange={(e) => {
                    setCodephrase(e.target.value);
                    setOptimizedRelay(null);
                  }}
                  className="h-10 w-full rounded-xl border border-zinc-300 bg-white pl-3.5 pr-20 font-mono text-sm font-semibold text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void regenerateCode()}
                    title={t.send.regeneratePhrase}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText("code", codephrase.trim())}
                    title={t.common.copy}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    {copiedItem === "code" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Peer Selector & QR Modal Trigger */}
            <div className="flex flex-wrap items-center gap-2 lg:self-end">
              {peerPresets.length > 0 && (
                <div className="relative flex items-center">
                  <select
                    value={activePeer?.id ?? ""}
                    onChange={(e) => {
                      const found = peerPresets.find((p) => p.id === e.target.value);
                      handleSelectPeerPreset(found ?? null);
                    }}
                    className="h-10 rounded-xl border border-zinc-300 bg-white pl-3 pr-8 text-xs font-semibold text-zinc-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <option value="">{locale === "vi" ? "Gửi tới bạn bè..." : "Send to peer..."}</option>
                    {peerPresets.map((peer) => (
                      <option key={peer.id} value={peer.id}>
                        {peer.alias}
                      </option>
                    ))}
                  </select>
                  {activePeer && (
                    <button
                      type="button"
                      onClick={() => handleSelectPeerPreset(null)}
                      title="Clear peer"
                      className="ml-1 text-xs text-rose-500 hover:underline"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowQRModal(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
                <span>QR</span>
              </button>
            </div>
          </div>
        </div>

        {/* QR & Share Modal */}
        {showQRModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in"
            onClick={() => setShowQRModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {t.send.qrTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowQRModal(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex justify-center p-3 rounded-xl bg-white border border-zinc-200 dark:border-zinc-700">
                <QRCodeSVG value={shareUrl || codephrase} size={160} level="M" />
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {t.send.qrHint}
              </p>

              <div className="mt-4 space-y-2 text-left">
                <button
                  type="button"
                  onClick={() => void copyText("cli", cliCommand)}
                  className="w-full flex items-center justify-between rounded-xl border border-zinc-200 p-2.5 font-mono text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="truncate">{cliCommand}</span>
                  {copiedItem === "cli" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => void copyText("link", shareUrl)}
                  className="w-full flex items-center justify-between rounded-xl border border-zinc-200 p-2.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="truncate">{locale === "vi" ? "Sao chép liên kết" : "Copy Web Link"}</span>
                  {copiedItem === "link" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Primary Action Bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!busy ? (
            <button
              type="button"
              onClick={() => void handleStartSend()}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-teal-700"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {t.send.startSendBtn}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {t.send.cancelBtn}
              </button>
              {mode === "enhanced" && dualRelay && (
                <button
                  type="button"
                  onClick={handleSimulateAlphaDisconnect}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-400/40 dark:bg-amber-950/50 dark:text-amber-200"
                >
                  <WifiOff className="h-4 w-4" aria-hidden="true" />
                  {t.send.simulateFailoverBtn}
                </button>
              )}
            </>
          )}
        </div>

        {/* Live Progress & Feedback */}
        {(busy || statusText || errorText || successText) && (
          <div className="mt-4 space-y-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
            {statusText && (
              <div className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{statusText}</span>
                  <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                    ({isLocalProfile ? "Local Lab" : "Public"})
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

            {/* Live Metrics: Speed, ETA, Bytes */}
            {(busy || stdProgress || enhProgress) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                  <span>
                    <strong className="font-sans font-medium text-slate-500 dark:text-slate-400">Tốc độ:</strong>{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatSpeed(metrics.speedBps)}</span>
                  </span>
                  <span>
                    <strong className="font-sans font-medium text-slate-500 dark:text-slate-400">Còn lại (ETA):</strong>{" "}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatEta(metrics.etaSeconds, metrics.isStalled)}
                    </span>
                  </span>
                  {mode === "standard" && stdProgress && stdProgress.totalSize > 0 && (
                    <span className="text-slate-600 dark:text-slate-400">
                      {formatBytes(stdProgress.totalBytes)} / {formatBytes(stdProgress.totalSize)}
                    </span>
                  )}
                  {mode === "enhanced" && enhProgress && (
                    <span className="text-slate-600 dark:text-slate-400">
                      {formatBytes(enhProgress.bytesTransferred)} / {formatBytes(enhProgress.totalBytes)}
                    </span>
                  )}
                </div>
                {metrics.isStalled && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                    Tạm dừng (Stalled)
                  </span>
                )}
              </div>
            )}

            {enhProgress && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                <span>
                  Tiến độ chunk: {enhProgress.completedChunks}/{enhProgress.totalChunks}
                </span>
                <span>Alpha: {enhProgress.alphaChunks}</span>
                <span>Beta: {enhProgress.betaChunks}</span>
                {enhProgress.failoverChunks > 0 && (
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    Failover: {enhProgress.failoverChunks}
                  </span>
                )}
                {enhProgress.resumedChunks > 0 && (
                  <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                    Resume: {enhProgress.resumedChunks}
                  </span>
                )}
              </div>
            )}

            {/* Granular Per-File Progress Bars for Multi-File Transfers */}
            {fileProgressList.length > 1 && (
              <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>
                    Tiến độ từng tệp ({fileProgressList.filter((f) => f.done).length}/{fileProgressList.length} hoàn tất)
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {Math.round(
                      (fileProgressList.filter((f) => f.done).length / fileProgressList.length) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {fileProgressList.map((fp, idx) => {
                    const filePct =
                      fp.size > 0
                        ? Math.min(100, Math.round((fp.transferred / fp.size) * 100))
                        : fp.done
                          ? 100
                          : 0;
                    return (
                      <div key={`${fp.name}-${idx}`} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-1.5 truncate">
                            {fp.done ? (
                              <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                            ) : (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
                            )}
                            <span className="truncate font-mono text-slate-800 dark:text-slate-200">{fp.name}</span>
                          </div>
                          <div className="shrink-0 font-mono text-slate-500 dark:text-slate-400">
                            {formatBytes(fp.transferred)} / {formatBytes(fp.size)} ({filePct}%)
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-150 ${
                              fp.done ? "bg-emerald-500" : "bg-teal-500"
                            }`}
                            style={{ width: `${filePct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
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
      </section>
    </div>
  );
}
