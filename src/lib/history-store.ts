export interface TransferHistoryEntry {
  id: string;
  timestamp: number;
  direction: "send" | "receive";
  mode: "standard" | "enhanced";
  dualRelay: boolean;
  codephrase: string;
  fileCount: number;
  summaryName: string;
  totalBytes: number;
  status: "completed" | "resumed" | "failed" | "cancelled";
  verifiedHash: "XXH64" | "SHA-256";
  resumedChunks?: number;
  failoverTriggered?: boolean;
  deviceAlias: string;
}

const HISTORY_KEY = "crocflow-transfer-history-v1";
const DEVICE_ALIAS_KEY = "crocflow-device-alias-v1";

export function defaultDeviceAlias(): string {
  if (typeof navigator === "undefined") return "CrocFlow Device";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "Android CrocFlow";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS CrocFlow";
  if (ua.includes("mac")) return "MacBook CrocFlow";
  if (ua.includes("win")) return "Windows CrocFlow";
  return "Linux CrocFlow";
}

export function loadDeviceAlias(): string {
  try {
    const saved = localStorage.getItem(DEVICE_ALIAS_KEY)?.trim();
    if (saved) return saved;
  } catch {
    // Ignore storage read errors
  }
  return defaultDeviceAlias();
}

export function saveDeviceAlias(alias: string): string {
  const clean = alias.trim().slice(0, 48) || defaultDeviceAlias();
  try {
    localStorage.setItem(DEVICE_ALIAS_KEY, clean);
  } catch {
    // Ignore storage write errors
  }
  return clean;
}

export function loadTransferHistory(): TransferHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TransferHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendTransferHistory(
  entry: Omit<TransferHistoryEntry, "id" | "timestamp">,
): TransferHistoryEntry[] {
  const current = loadTransferHistory();
  const next: TransferHistoryEntry = {
    ...entry,
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  const updated = [next, ...current].slice(0, 100);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage write errors
  }
  return updated;
}

export function clearTransferHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore storage errors
  }
}
