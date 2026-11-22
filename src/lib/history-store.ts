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

export interface PeerPreset {
  id: string;
  alias: string;
  lastSeen: number;
  preferredRelayProfile?: "public" | "local-dual";
  notes?: string;
}

const HISTORY_KEY = "crocflow-transfer-history-v1";
const DEVICE_ALIAS_KEY = "crocflow-device-alias-v1";
const PEER_PRESETS_KEY = "crocflow-peer-presets-v1";

function getStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return undefined;
}

export function defaultDeviceAlias(): string {
  if (typeof navigator === "undefined") return "CrocFlow Device";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "Android CrocFlow";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS CrocFlow";
  if (ua.includes("mac")) return "MacBook CrocFlow";
  if (ua.includes("win")) return "Windows CrocFlow";
  return "Linux CrocFlow";
}

export function loadDeviceAlias(storage?: Storage): string {
  const store = getStorage(storage);
  try {
    const saved = store?.getItem(DEVICE_ALIAS_KEY)?.trim();
    if (saved) return saved;
  } catch {
    // Ignore storage read errors
  }
  return defaultDeviceAlias();
}

export function saveDeviceAlias(alias: string, storage?: Storage): string {
  const store = getStorage(storage);
  const clean = alias.trim().slice(0, 48) || defaultDeviceAlias();
  try {
    store?.setItem(DEVICE_ALIAS_KEY, clean);
  } catch {
    // Ignore storage write errors
  }
  return clean;
}

export function loadTransferHistory(storage?: Storage): TransferHistoryEntry[] {
  const store = getStorage(storage);
  try {
    const raw = store?.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TransferHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendTransferHistory(
  entry: Omit<TransferHistoryEntry, "id" | "timestamp">,
  storage?: Storage,
): TransferHistoryEntry[] {
  const store = getStorage(storage);
  const current = loadTransferHistory(store);
  const next: TransferHistoryEntry = {
    ...entry,
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  const updated = [next, ...current].slice(0, 100);
  try {
    store?.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage write errors
  }
  return updated;
}

export function clearTransferHistory(storage?: Storage): void {
  const store = getStorage(storage);
  try {
    store?.removeItem(HISTORY_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function loadPeerPresets(storage?: Storage): PeerPreset[] {
  const store = getStorage(storage);
  try {
    const raw = store?.getItem(PEER_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: PeerPreset[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        item.id.trim() &&
        typeof item.alias === "string" &&
        item.alias.trim()
      ) {
        const lastSeen =
          typeof item.lastSeen === "number" && !isNaN(item.lastSeen)
            ? item.lastSeen
            : Date.now();
        const preferredRelayProfile =
          item.preferredRelayProfile === "public" || item.preferredRelayProfile === "local-dual"
            ? item.preferredRelayProfile
            : undefined;
        const notes = typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : undefined;
        valid.push({
          id: item.id.trim(),
          alias: item.alias.trim().slice(0, 48),
          lastSeen,
          preferredRelayProfile,
          notes,
        });
      }
    }
    return valid.sort((a, b) => b.lastSeen - a.lastSeen);
  } catch {
    return [];
  }
}

export function savePeerPreset(
  preset: Omit<PeerPreset, "id" | "lastSeen"> & { id?: string },
  storage?: Storage,
): PeerPreset {
  const store = getStorage(storage);
  const current = loadPeerPresets(store);
  const cleanAlias = preset.alias.trim().slice(0, 48) || "Peer Device";
  const now = Date.now();

  let targetId = preset.id?.trim();
  if (!targetId) {
    const existingByAlias = current.find(
      (p) => p.alias.toLowerCase() === cleanAlias.toLowerCase(),
    );
    if (existingByAlias) {
      targetId = existingByAlias.id;
    }
  }

  let savedItem: PeerPreset;
  if (targetId) {
    const index = current.findIndex((p) => p.id === targetId);
    if (index >= 0) {
      savedItem = {
        ...current[index],
        alias: cleanAlias,
        preferredRelayProfile:
          preset.preferredRelayProfile !== undefined
            ? preset.preferredRelayProfile
            : current[index].preferredRelayProfile,
        notes:
          preset.notes !== undefined
            ? preset.notes?.trim() || undefined
            : current[index].notes,
        lastSeen: now,
      };
      current[index] = savedItem;
    } else {
      savedItem = {
        id: targetId,
        alias: cleanAlias,
        preferredRelayProfile: preset.preferredRelayProfile,
        notes: preset.notes?.trim() || undefined,
        lastSeen: now,
      };
      current.unshift(savedItem);
    }
  } else {
    savedItem = {
      id: `peer-${now}-${Math.random().toString(36).slice(2, 7)}`,
      alias: cleanAlias,
      preferredRelayProfile: preset.preferredRelayProfile,
      notes: preset.notes?.trim() || undefined,
      lastSeen: now,
    };
    current.unshift(savedItem);
  }

  current.sort((a, b) => b.lastSeen - a.lastSeen);

  try {
    store?.setItem(PEER_PRESETS_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage write errors
  }

  return savedItem;
}

export function deletePeerPreset(id: string, storage?: Storage): boolean {
  const store = getStorage(storage);
  const current = loadPeerPresets(store);
  const filtered = current.filter((p) => p.id !== id);
  if (filtered.length === current.length) {
    return false;
  }
  try {
    store?.setItem(PEER_PRESETS_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

export function touchPeerPreset(idOrAlias: string, storage?: Storage): void {
  if (!idOrAlias || !idOrAlias.trim()) return;
  const store = getStorage(storage);
  const current = loadPeerPresets(store);
  const query = idOrAlias.trim().toLowerCase();
  const target = current.find(
    (p) => p.id === idOrAlias.trim() || p.alias.toLowerCase() === query,
  );
  if (!target) return;
  target.lastSeen = Date.now();
  current.sort((a, b) => b.lastSeen - a.lastSeen);
  try {
    store?.setItem(PEER_PRESETS_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage write errors
  }
}
