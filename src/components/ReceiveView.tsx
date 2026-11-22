import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileText,
  Folder,
  FolderDown,
  FolderOpen,
  Inbox,
  Layers,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { receiveFiles } from "../protocol/croc/client";
import { DownloadDestination, TextDestination } from "../protocol/croc/storage";
import type { FileProgress as CrocFileProgress, OfferedFile, TransferOffer } from "../protocol/croc/types";
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
import { downloadBinaryFile, formatBytes } from "../lib/format";
import {
  RollingMetricsTracker,
  useRollingMetrics,
  formatEta,
  formatSpeed,
  calculateFileProgress,
  type FileProgress,
} from "../lib/metrics";
import { downloadZipArchive, saveEntriesToDirectory, type ZipEntry } from "../lib/zip";
import {
  findFastestRelay,
  loadRelayLatencies,
  type RelayProfileMode,
} from "../lib/relay-manager";
import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";
import { ModeSelector } from "./ModeSelector";
import { RelayProfileBanner } from "./RelayProfileBanner";
import { StreamInspectorDrawer } from "./StreamInspectorDrawer";

export interface ReceiveViewProps {
  bridgeConfig: BridgePublicConfig | null;
  deviceAlias: string;
  relayProfile?: RelayProfileMode;
  onChangeRelayProfile?: (mode: RelayProfileMode) => void;
  prefillCode?: string;
  prefillMode?: "standard" | "enhanced";
  onClearPrefill?: () => void;
  onHistoryUpdated: () => void;
  locale?: Locale;
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

export interface FolderTreeProps {
  files: ReceivedEnhancedFile[];
  onDownloadFile?: (file: ReceivedEnhancedFile) => void;
}

interface DirectoryTreeNode {
  name: string;
  path: string;
  files: ReceivedEnhancedFile[];
  subfolders: Map<string, DirectoryTreeNode>;
}

function buildDirectoryTree(files: ReceivedEnhancedFile[]): DirectoryTreeNode {
  const root: DirectoryTreeNode = {
    name: "",
    path: "",
    files: [],
    subfolders: new Map(),
  };

  for (const file of files) {
    const rawPath = file.relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = rawPath.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = current.path ? `${current.path}/${folderName}` : folderName;
      let next = current.subfolders.get(folderName);
      if (!next) {
        next = {
          name: folderName,
          path: folderPath,
          files: [],
          subfolders: new Map(),
        };
        current.subfolders.set(folderName, next);
      }
      current = next;
    }
    current.files.push(file);
  }

  return root;
}

function countTreeStats(node: DirectoryTreeNode): { totalCount: number; totalBytes: number } {
  let totalCount = node.files.length;
  let totalBytes = node.files.reduce((sum, f) => sum + f.size, 0);
  for (const sub of node.subfolders.values()) {
    const subStats = countTreeStats(sub);
    totalCount += subStats.totalCount;
    totalBytes += subStats.totalBytes;
  }
  return { totalCount, totalBytes };
}

interface FolderTreeNodeViewProps {
  node: DirectoryTreeNode;
  openFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onDownloadFile: (file: ReceivedEnhancedFile) => void;
  level: number;
}

const FolderTreeNodeView: React.FC<FolderTreeNodeViewProps> = ({
  node,
  openFolders,
  onToggleFolder,
  onDownloadFile,
  level,
}) => {
  const sortedSubfolders = Array.from(node.subfolders.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const sortedFiles = [...node.files].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-1.5">
      {/* Subfolders */}
      {sortedSubfolders.map((sub) => {
        const isOpen = openFolders.has(sub.path);
        const { totalCount, totalBytes } = countTreeStats(sub);

        return (
          <div key={sub.path} className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 overflow-hidden">
            <button
              type="button"
              onClick={() => onToggleFolder(sub.path)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-2 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-800"
              style={{ paddingLeft: `${Math.max(12, level * 16 + 12)}px` }}
            >
              <div className="flex min-w-0 items-center gap-2 truncate">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                )}
                {isOpen ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                )}
                <span className="truncate font-mono">{sub.name}/</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-[10px] dark:bg-zinc-700">
                  {totalCount} tệp
                </span>
                <span className="font-mono tabular-nums">{formatBytes(totalBytes)}</span>
              </div>
            </button>

            {isOpen && (
              <div className="p-1.5 bg-zinc-50/30 dark:bg-zinc-950/20">
                <FolderTreeNodeView
                  node={sub}
                  openFolders={openFolders}
                  onToggleFolder={onToggleFolder}
                  onDownloadFile={onDownloadFile}
                  level={level + 1}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Files */}
      {sortedFiles.map((file) => (
        <div
          key={file.relativePath}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2 text-xs shadow-xs hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-zinc-700"
          style={{ paddingLeft: `${Math.max(12, level * 16 + 12)}px` }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <FileText className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
            <div className="min-w-0">
              <div className="truncate font-mono font-medium text-zinc-900 dark:text-zinc-100">
                {file.name}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-mono">{formatBytes(file.size)}</span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  SHA-256 ✓ {file.sha256.slice(0, 10)}…
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onDownloadFile(file)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Lưu tệp
          </button>
        </div>
      ))}
    </div>
  );
};

export const FolderTree: React.FC<FolderTreeProps> = ({
  files,
  onDownloadFile = (f) => downloadBinaryFile(f.name, f.bytes, f.mimeType),
}) => {
  const rootNode = useMemo(() => buildDirectoryTree(files), [files]);

  const allFolderPaths = useMemo(() => {
    const paths = new Set<string>();
    const collect = (n: DirectoryTreeNode) => {
      if (n.path) paths.add(n.path);
      for (const sub of n.subfolders.values()) collect(sub);
    };
    collect(rootNode);
    return paths;
  }, [rootNode]);

  const [openFolders, setOpenFolders] = useState<Set<string>>(() => new Set(allFolderPaths));

  useEffect(() => {
    setOpenFolders(new Set(allFolderPaths));
  }, [allFolderPaths]);

  const handleToggleFolder = (path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200/80 p-2 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-950/20">
      <FolderTreeNodeView
        node={rootNode}
        openFolders={openFolders}
        onToggleFolder={handleToggleFolder}
        onDownloadFile={onDownloadFile}
        level={0}
      />
    </div>
  );
};

export function sanitizeCodephraseInput(raw: string): string {
  let clean = raw.trim();
  if (/^croc\s+/i.test(clean)) {
    clean = clean.replace(/^croc\s+(?:send\s+)?/i, "").trim();
  }
  clean = clean.replace(/[\s_]+/g, "-");
  clean = clean.replace(/[^a-zA-Z0-9-]/g, "");
  clean = clean.replace(/-{2,}/g, "-");
  return clean.toLowerCase();
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
  locale = "vi",
}: ReceiveViewProps) {
  const t = getTranslations(locale);
  const [mode, setMode] = useState<ReceiveMode>(prefillMode ?? "enhanced");
  const [codephrase, setCodephrase] = useState(prefillCode ?? "");
  const [dualRelay, setDualRelay] = useState(true);

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const [stdProgress, setStdProgress] = useState<CrocFileProgress | null>(null);
  const [enhProgress, setEnhProgress] = useState<EnhancedProgress | null>(null);
  const [offeredFiles, setOfferedFiles] = useState<OfferedFile[] | null>(null);
  const metricsTrackerRef = useRef<RollingMetricsTracker | null>(null);
  const [metrics, setMetrics] = useRollingMetrics(metricsTrackerRef, busy);
  const [pendingStdOffer, setPendingStdOffer] = useState<PendingStandardOffer | null>(null);
  const [pendingEnhOffer, setPendingEnhOffer] = useState<PendingEnhancedOffer | null>(null);

  const [receivedText, setReceivedText] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedEnhancedFile[]>([]);
  const [receivedManifest, setReceivedManifest] = useState<FolderManifest | null>(null);
  const [cacheSummary, setCacheSummary] = useState<ResumeCacheSummary>({
    totalChunks: 0,
    totalBytes: 0,
    sessions: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  const isLocalProfile = relayProfile === "local-dual" || relayProfile === "local-lab";

  const fastestProbedRelay = useMemo(() => {
    const relayAddresses = bridgeConfig?.relayAddresses ?? [];
    const latencies = loadRelayLatencies();
    return findFastestRelay(latencies, relayAddresses);
  }, [bridgeConfig]);

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

  const handleCancel = useCallback(() => {
    pendingStdOffer?.resolve(false);
    pendingEnhOffer?.resolve(false);
    setPendingStdOffer(null);
    setPendingEnhOffer(null);
    abortRef.current?.abort();
    setBusy(false);
    setStatusText(locale === "vi" ? "Đã hủy phiên nhận." : "Receive transfer cancelled.");
  }, [pendingStdOffer, pendingEnhOffer, locale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busy) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, handleCancel]);

  const handleStartReceive = async () => {
    setErrorText(null);
    setSuccessText(null);
    setStdProgress(null);
    setEnhProgress(null);
    setOfferedFiles(null);
    metricsTrackerRef.current = new RollingMetricsTracker();
    setMetrics({ speedBps: 0, etaSeconds: null, isStalled: false });
    setReceivedText(null);
    setReceivedFiles([]);
    setReceivedManifest(null);

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
            onProgress: (p) => {
              setStdProgress(p);
              if (metricsTrackerRef.current) {
                setMetrics(metricsTrackerRef.current.update(p.totalBytes, p.totalSize));
              }
            },
            onOffer: async (incomingOffer) => {
              setOfferedFiles(incomingOffer.files);
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
      const targetedNode = fastestProbedRelay
        ? `${fastestProbedRelay.host} (${fastestProbedRelay.rttMs} ms)`
        : undefined;
      const res = await receiveEnhancedTransfer({
        codephrase: secret,
        dualRelay,
        targetRelayNode: targetedNode,
        baseWsUrl: wsDualUrl,
        signal: controller.signal,
        onStatus: setStatusText,
        onProgress: (p) => {
          setEnhProgress(p);
          if (metricsTrackerRef.current) {
            setMetrics(metricsTrackerRef.current.update(p.bytesTransferred, p.totalBytes));
          }
        },
        onManifestOffer: (manifest, resumePlan) =>
          new Promise<boolean>((resolve) => {
            setPendingEnhOffer({ manifest, resumePlan, resolve });
          }).finally(() => setPendingEnhOffer(null)),
      });

      setReceivedFiles(res.files);
      setReceivedManifest(res.manifest);
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

  const fileProgressList = useMemo<FileProgress[]>(() => {
    if (mode === "standard") {
      if (!offeredFiles || offeredFiles.length <= 1 || !stdProgress) return [];
      return calculateFileProgress(
        offeredFiles.map((f) => ({ name: f.path, size: f.size })),
        stdProgress.fileIndex,
        stdProgress.fileBytes,
      );
    }
    if (mode === "enhanced") {
      if (enhProgress?.fileProgress && enhProgress.fileProgress.length > 1) {
        return enhProgress.fileProgress;
      }
      if (pendingEnhOffer?.manifest && pendingEnhOffer.manifest.files.length > 1) {
        return pendingEnhOffer.manifest.files.map((f) => ({
          name: f.relativePath,
          size: f.size,
          transferred: 0,
          done: false,
        }));
      }
    }
    return [];
  }, [mode, offeredFiles, stdProgress, enhProgress, pendingEnhOffer]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t.receive.title}
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t.receive.subtitle}
        </p>
      </div>

      {/* Compact Segmented Mode Selector with Info Modal */}
      <ModeSelector
        mode={mode}
        onChangeMode={setMode}
        disabled={busy}
        locale={locale}
      />

      {/* Main Receive Input Card */}
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
        {/* Active Relay Profile Banner */}
        <RelayProfileBanner
          relayProfile={relayProfile}
          mode={mode}
          locale={locale}
          busy={busy}
          onChangeRelayProfile={onChangeRelayProfile}
        />

        <label
          htmlFor="receive-codephrase-input"
          className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
        >
          Nhập Codephrase từ máy gửi
        </label>
        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <input
            id="receive-codephrase-input"
            type="text"
            value={codephrase}
            disabled={busy}
            onChange={(e) => setCodephrase(sanitizeCodephraseInput(e.target.value))}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text");
              setCodephrase(sanitizeCodephraseInput(pasted));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void handleStartReceive();
            }}
            placeholder="Ví dụ: 4281-mango-solar-river"
            className="min-h-[44px] flex-1 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 font-mono text-xs font-semibold text-zinc-900 placeholder:font-sans placeholder:font-normal placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
          {!busy ? (
            <button
              type="button"
              onClick={() => void handleStartReceive()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all"
            >
              <Inbox className="h-4 w-4" aria-hidden="true" />
              {t.receive.connectBtn}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-5 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/70 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 transition-all"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t.common.cancel}
            </button>
          )}
        </div>

        {mode === "enhanced" && (
          <div className="mt-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={dualRelay}
                disabled={busy}
                onChange={(e) => setDualRelay(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
              />
              Mở song song 2 kênh nhận (Relay Alpha Chẵn & Relay Beta Lẻ)
            </label>
          </div>
        )}

        {/* Standard Mode Offer Preview */}
        {pendingStdOffer && (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Xác nhận nhận {pendingStdOffer.offer.kind === "text" ? "văn bản" : `${pendingStdOffer.offer.files.length} tệp`} ({formatBytes(pendingStdOffer.offer.totalSize)})
            </h3>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono text-xs text-zinc-700 dark:text-zinc-300">
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
                className="min-h-[38px] rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all"
              >
                {t.receive.acceptBtn}
              </button>
              <button
                type="button"
                onClick={() => pendingStdOffer.resolve(false)}
                className="min-h-[38px] rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
              >
                {t.receive.rejectBtn}
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Mode Manifest & Resume Offer Preview */}
        {pendingEnhOffer && (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Folder Manifest: {pendingEnhOffer.manifest.totalFiles} tệp ({formatBytes(pendingEnhOffer.manifest.totalBytes)})
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Resume Cache khớp{" "}
              <strong className="font-mono">
                {pendingEnhOffer.resumePlan.skippedChunks.length}/{pendingEnhOffer.manifest.totalChunks}
              </strong>{" "}
              chunks ({formatBytes(pendingEnhOffer.resumePlan.bytesSkipped)} đã có sẵn) · Cần tải{" "}
              <strong className="font-mono">{formatBytes(pendingEnhOffer.resumePlan.bytesRemaining)}</strong>.
            </p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto font-mono text-xs text-zinc-700 dark:text-zinc-300">
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
                className="min-h-[38px] rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all"
              >
                {t.receive.acceptBtn}
              </button>
              <button
                type="button"
                onClick={() => pendingEnhOffer.resolve(false)}
                className="min-h-[38px] rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
              >
                {t.receive.rejectBtn}
              </button>
            </div>
          </div>
        )}

        {/* Progress / Status */}
        {(busy || statusText || errorText || successText) && (
          <div className="mt-4 space-y-2.5 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/80">
            {/* Primary Calm Telemetry */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {busy && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                <span className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {statusText || (busy ? (locale === "vi" ? "Đang nhận dữ liệu..." : "Receiving payload...") : "")}
                </span>
                {metrics.isStalled && (
                  <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    Stalled
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {(busy || metrics.speedBps > 0) && (
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatSpeed(metrics.speedBps)}</span>
                )}
                {(busy || (metrics.etaSeconds !== null && metrics.etaSeconds > 0)) && (
                  <span>ETA {formatEta(metrics.etaSeconds, metrics.isStalled)}</span>
                )}
                {progressPercent > 0 && (
                  <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {progressPercent}%
                  </span>
                )}
              </div>
            </div>

            {/* Smooth Progress Bar */}
            {(busy || progressPercent > 0) && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-200 dark:bg-emerald-400"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {/* Expandable Dual-Relay Stream Stats Drawer */}
            {mode === "enhanced" && enhProgress && (
              <StreamInspectorDrawer
                progress={enhProgress}
                locale={locale}
                alphaRttMs={isLocalProfile ? null : (fastestProbedRelay?.rttMs ?? null)}
                betaRttMs={isLocalProfile ? null : (fastestProbedRelay?.rttMs ? fastestProbedRelay.rttMs + 4 : null)}
              />
            )}

            {/* Granular Per-File Progress Bars for Multi-File Transfers */}
            {fileProgressList.length > 1 && (
              <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <span>
                    Tiến độ từng tệp ({fileProgressList.filter((f) => f.done).length}/{fileProgressList.length} hoàn tất)
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">
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
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                            )}
                            <span className="truncate font-mono text-zinc-800 dark:text-zinc-200">{fp.name}</span>
                          </div>
                          <div className="shrink-0 font-mono text-zinc-500 dark:text-zinc-400">
                            {formatBytes(fp.transferred)} / {formatBytes(fp.size)} ({filePct}%)
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                          <div
                            className={`h-full rounded-full transition-all duration-150 ${
                              fp.done ? "bg-emerald-500" : "bg-zinc-900 dark:bg-zinc-100"
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
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorText}</span>
              </div>
            )}
            {successText && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{successText}</span>
              </div>
            )}
          </div>
        )}

        {/* Received Text Display (never auto-downloaded) */}
        {receivedText !== null && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Văn bản đã giải mã
              </span>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(receivedText);
                  setCopiedText(true);
                  setTimeout(() => setCopiedText(false), 1800);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                {copiedText ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedText ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-zinc-900 dark:text-zinc-100">
              {receivedText}
            </pre>
          </div>
        )}

        {/* Received Enhanced Files Ready to Save */}
        {receivedFiles.length > 0 && (() => {
          const isFolderOrMultiple = Boolean(receivedManifest) || receivedFiles.length > 1;
          const isDirectoryPickerSupported =
            typeof window !== "undefined" &&
            typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";

          const handleDownloadZip = () => {
            const entries: ZipEntry[] = receivedFiles.map((file) => ({
              path: file.relativePath,
              data: file.bytes,
            }));
            const zipName = receivedManifest?.manifestId
              ? `crocflow-folder-${receivedManifest.manifestId}.zip`
              : `crocflow-transfer-${Date.now()}.zip`;
            downloadZipArchive(zipName, entries);
          };

          const handleDirectorySave = async () => {
            try {
              const picker = (
                window as unknown as {
                  showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
                }
              ).showDirectoryPicker;
              const dirHandle = await picker();
              const entries: ZipEntry[] = receivedFiles.map((file) => ({
                path: file.relativePath,
                data: file.bytes,
              }));
              const count = await saveEntriesToDirectory(entries, dirHandle);
              setSuccessText(`Đã lưu trực tiếp ${count} tệp vào thư mục được chọn.`);
            } catch (err) {
              if (err instanceof DOMException && err.name === "AbortError") {
                return;
              }
              setErrorText(err instanceof Error ? err.message : String(err));
            }
          };

          return (
            <div className="mt-4 space-y-2.5 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Tệp đã ghép & xác thực SHA-256 ({receivedFiles.length})
                  </h3>
                  {receivedManifest && (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Cấu trúc thư mục nguyên bản: {receivedManifest.totalFiles} tệp · {formatBytes(receivedManifest.totalBytes)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isFolderOrMultiple && (
                    <button
                      type="button"
                      onClick={handleDownloadZip}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all"
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.receive.downloadZipBtn}
                    </button>
                  )}
                  {isFolderOrMultiple && isDirectoryPickerSupported && (
                    <button
                      type="button"
                      onClick={() => void handleDirectorySave()}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
                    >
                      <FolderDown className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.receive.saveFolderBtn}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      for (const file of receivedFiles) {
                        downloadBinaryFile(file.name, file.bytes, file.mimeType);
                      }
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {locale === "vi" ? "Lưu từng tệp" : "Save Files"}
                  </button>
                </div>
              </div>
              <FolderTree
                files={receivedFiles}
                onDownloadFile={(file) => downloadBinaryFile(file.name, file.bytes, file.mimeType)}
              />
            </div>
          );
        })()}
      </section>

      {/* IndexedDB Resume Cache Manager */}
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Database className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Bộ nhớ đệm Resume Cache (IndexedDB)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Lưu từng Chunk đã khớp mã băm SHA-256 để tiếp tục ngay từ chỗ đứt khi mất mạng.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshCacheSummary()}
              aria-label="Làm mới Resume Cache"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t.common.refresh}
            </button>
            <button
              type="button"
              disabled={cacheSummary.totalChunks === 0}
              onClick={() => void handleClearCache()}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/70 active:scale-[0.98] disabled:opacity-40 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t.receive.clearResumeCacheBtn}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 border-t border-zinc-100 pt-3.5 text-xs dark:border-zinc-800">
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Chunk đã xác thực</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {cacheSummary.totalChunks}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Dung lượng lưu cục bộ</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatBytes(cacheSummary.totalBytes)}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 dark:text-zinc-400">Phiên đang lưu</div>
            <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {cacheSummary.sessions.length}
            </div>
          </div>
        </div>

        {cacheSummary.sessions.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            {cacheSummary.sessions.map((s) => (
              <li
                key={s.sessionKey}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800"
              >
                <span className="truncate font-mono text-zinc-800 dark:text-zinc-200">
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
