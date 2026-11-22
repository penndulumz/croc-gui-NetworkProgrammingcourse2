import { makeChunkCacheKey } from "./manifest";

const DB_NAME = "crocflow-resume-db";
const DB_VERSION = 1;
const STORE_NAME = "verified-chunks";

export interface CachedChunkRecord {
  key: string;
  sessionKey: string;
  filePath: string;
  chunkIndexInFile: number;
  sha256: string;
  size: number;
  savedAt: number;
  data: Uint8Array;
}

export interface ResumeCacheSummary {
  totalChunks: number;
  totalBytes: number;
  sessions: Array<{
    sessionKey: string;
    filePaths: string[];
    chunkCount: number;
    totalBytes: number;
    lastSavedAt: number;
  }>;
}

function openResumeDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB không khả dụng trong môi trường này"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("sessionKey", "sessionKey", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Không thể mở Resume Cache"));
  });
}

export async function saveVerifiedChunk(params: {
  sessionKey: string;
  filePath: string;
  chunkIndexInFile: number;
  sha256: string;
  data: Uint8Array;
}): Promise<void> {
  const db = await openResumeDb();
  const key = makeChunkCacheKey(params.filePath, params.chunkIndexInFile, params.sha256);
  const record: CachedChunkRecord = {
    key,
    sessionKey: params.sessionKey,
    filePath: params.filePath,
    chunkIndexInFile: params.chunkIndexInFile,
    sha256: params.sha256,
    size: params.data.byteLength,
    savedAt: Date.now(),
    data: new Uint8Array(params.data),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Lỗi lưu chunk vào Resume Cache"));
  });
  db.close();
}

export async function loadAllVerifiedChunks(): Promise<CachedChunkRecord[]> {
  try {
    const db = await openResumeDb();
    const records = await new Promise<CachedChunkRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as CachedChunkRecord[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error("Lỗi đọc Resume Cache"));
    });
    db.close();
    return records;
  } catch {
    return [];
  }
}

export async function loadVerifiedChunkMap(): Promise<Map<string, Uint8Array>> {
  const records = await loadAllVerifiedChunks();
  const map = new Map<string, Uint8Array>();
  for (const r of records) {
    map.set(r.key, r.data instanceof Uint8Array ? r.data : new Uint8Array(r.data));
  }
  return map;
}

export async function getResumeCacheSummary(): Promise<ResumeCacheSummary> {
  const records = await loadAllVerifiedChunks();
  const bySession = new Map<
    string,
    { filePaths: Set<string>; chunkCount: number; totalBytes: number; lastSavedAt: number }
  >();
  let totalBytes = 0;

  for (const r of records) {
    totalBytes += r.size;
    let entry = bySession.get(r.sessionKey);
    if (!entry) {
      entry = { filePaths: new Set(), chunkCount: 0, totalBytes: 0, lastSavedAt: r.savedAt };
      bySession.set(r.sessionKey, entry);
    }
    entry.filePaths.add(r.filePath);
    entry.chunkCount += 1;
    entry.totalBytes += r.size;
    entry.lastSavedAt = Math.max(entry.lastSavedAt, r.savedAt);
  }

  return {
    totalChunks: records.length,
    totalBytes,
    sessions: Array.from(bySession.entries()).map(([sessionKey, info]) => ({
      sessionKey,
      filePaths: Array.from(info.filePaths),
      chunkCount: info.chunkCount,
      totalBytes: info.totalBytes,
      lastSavedAt: info.lastSavedAt,
    })),
  };
}

export async function clearResumeCache(): Promise<void> {
  try {
    const db = await openResumeDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Lỗi xóa Resume Cache"));
    });
    db.close();
  } catch {
    // Ignore when IndexedDB unavailable
  }
}
