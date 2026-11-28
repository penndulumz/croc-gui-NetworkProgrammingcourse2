import {
  buildFolderManifest,
  computeResumePlan,
  makeChunkCacheKey,
  sha256Hex,
  type FolderManifest,
  type ManifestChunkDescriptor,
  type ManifestInputFile,
  type ResumePlan,
} from "./manifest";
import { DualRelayScheduler, type RelayLane } from "./dual-relay-scheduler";
import { clearResumeCache, loadVerifiedChunkMap, saveVerifiedChunk } from "./resume-cache";
import { protocolEventBus } from "../event-bus";
import { calculateManifestFileProgress, type FileProgress } from "../../lib/metrics";
import { bridgeWsURL } from "../../lib/bridge-origin";
import { relayIndex } from "../croc/codephrase";
import { connectRelay, controlPort } from "../croc/relay";
import type { CrocSocket } from "../croc/transport";
import {
  extractRelayHost,
  isLocalLabProfile,
  resolveStreamPairRtts,
  type RelayProfileMode,
} from "../../lib/relay-manager";

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface WebSocketLike {
  readonly readyState: number;
  binaryType: string;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  send(data: string | ArrayBuffer | Uint8Array): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export interface ChunkCacheAdapter {
  loadMap(): Promise<Map<string, Uint8Array>>;
  save(params: {
    sessionKey: string;
    filePath: string;
    chunkIndexInFile: number;
    sha256: string;
    data: Uint8Array;
  }): Promise<void>;
}

const browserIndexedDbCache: ChunkCacheAdapter = {
  loadMap: () => loadVerifiedChunkMap(),
  save: (params) => saveVerifiedChunk(params),
};

export interface EnhancedControlHandle {
  simulateAlphaDisconnect: () => void;
  cancel: () => void;
}

export interface EnhancedProgress {
  completedChunks: number;
  totalChunks: number;
  bytesTransferred: number;
  totalBytes: number;
  speedBps: number;
  resumedChunks: number;
  alphaChunks: number;
  betaChunks: number;
  failoverChunks: number;
  alphaAlive: boolean;
  betaAlive?: boolean;
  fileProgress?: FileProgress[];
}

export interface PublicRelaySettings {
  bridgeURL: string;
  relayAddresses: string[];
  relayPassword: string;
}

export interface PublicDualRelayPlan {
  alphaIndex: number;
  betaIndex: number;
  alphaHost: string;
  betaHost: string;
  alphaPort: string;
  betaPort: string;
  dualRelaySupported: boolean;
}

export interface ReceivedEnhancedFile {
  relativePath: string;
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  bytes: Uint8Array;
}

export interface EnhancedSendResult {
  manifest: FolderManifest;
  resumedChunks: number;
  alphaDelivered: number;
  betaDelivered: number;
  failoverRerouted: number;
  durationMs: number;
}

export interface EnhancedReceiveResult {
  manifest: FolderManifest;
  resumePlan: ResumePlan;
  files: ReceivedEnhancedFile[];
  alphaReceived: number;
  betaReceived: number;
  durationMs: number;
}

type WirePlainMessage =
  | { type: "pake-init"; pubKeyB64: string; saltB64: string }
  | { type: "pake-reply"; pubKeyB64: string; confirmB64: string }
  | { type: "pake-confirm"; confirmB64: string }
  | { type: "encrypted"; ivB64: string; ctB64: string }
  | { type: "peer_count"; channel: RelayLane; roomId: string; count: number };

type DecryptedPayload =
  | { kind: "manifest"; manifest: FolderManifest; dualRelay: boolean }
  | {
      kind: "resume-plan";
      missingIndices: number[];
      skippedCount: number;
      newFilePaths: string[];
      dualRelayAccepted?: boolean;
    }
  | {
      kind: "chunk";
      globalIndex: number;
      lane: RelayLane;
      rerouted: boolean;
      dataB64: string;
    }
  | { kind: "chunk-ack"; globalIndex: number; lane: RelayLane }
  | { kind: "lane-down"; lane: RelayLane }
  | { kind: "complete"; totalVerified: number }
  | { kind: "error"; message: string };

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}

export async function deriveEnhancedRoom(codephrase: string): Promise<string> {
  const digest = await sha256Hex(enc.encode(`crocflow-enhanced-room::${codephrase.trim()}`));
  return `cf-${digest.slice(0, 20)}`;
}

async function deriveSessionKeys(params: {
  ecdhSharedSecret: Uint8Array;
  codephrase: string;
  room: string;
  salt: Uint8Array;
}): Promise<{
  aesKey: CryptoKey;
  confirmSender: Uint8Array;
  confirmReceiver: Uint8Array;
}> {
  const combined = new Uint8Array(params.ecdhSharedSecret.byteLength + enc.encode(params.codephrase).byteLength);
  combined.set(params.ecdhSharedSecret, 0);
  combined.set(enc.encode(params.codephrase), params.ecdhSharedSecret.byteLength);

  const ikm = await crypto.subtle.importKey("raw", toArrayBuffer(combined), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: toArrayBuffer(params.salt),
        info: toArrayBuffer(enc.encode(`crocflow-enhanced-v1::${params.room}`)),
      },
      ikm,
      (32 + 32 + 32) * 8,
    ),
  );

  const aesRaw = bits.subarray(0, 32);
  const confirmSender = bits.subarray(32, 64);
  const confirmReceiver = bits.subarray(64, 96);

  const aesKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(aesRaw),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return { aesKey, confirmSender, confirmReceiver };
}

async function encryptPayload(aesKey: CryptoKey, payload: DecryptedPayload): Promise<WirePlainMessage> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = enc.encode(JSON.stringify(payload));
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    aesKey,
    toArrayBuffer(plainBytes),
  );
  return {
    type: "encrypted",
    ivB64: bytesToBase64(iv),
    ctB64: bytesToBase64(new Uint8Array(ctBuf)),
  };
}

async function decryptPayload(aesKey: CryptoKey, msg: WirePlainMessage): Promise<DecryptedPayload> {
  if (msg.type !== "encrypted") {
    throw new Error(`Gói tin bất ngờ khi kênh đã mã hóa: ${msg.type}`);
  }
  const iv = base64ToBytes(msg.ivB64);
  const ct = base64ToBytes(msg.ctB64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    aesKey,
    toArrayBuffer(ct),
  );
  return JSON.parse(dec.decode(new Uint8Array(plainBuf))) as DecryptedPayload;
}

class AsyncMessageQueue<T> {
  private items: T[] = [];
  private waiters: Array<{ resolve: (val: T) => void; reject: (err: Error) => void }> = [];
  private closedError: Error | null = null;

  push(item: T) {
    if (this.closedError) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve(item);
    } else {
      this.items.push(item);
    }
  }

  close(err: Error) {
    if (this.closedError) return;
    this.closedError = err;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.reject(err);
    }
  }

  next(): Promise<T> {
    if (this.items.length > 0) {
      return Promise.resolve(this.items.shift()!);
    }
    if (this.closedError) {
      return Promise.reject(this.closedError);
    }
    return new Promise<T>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }
}

interface RelayChannelConnection {
  lane: RelayLane;
  alive: boolean;
  sendJson: (msg: WirePlainMessage) => void;
  flush?: () => Promise<void>;
  close: () => void;
}

const MAX_IN_FLIGHT_PER_LANE = 4;
const PAKE_INIT_RETRY_MS = 350;

function defaultWsBaseUrl(): string {
  if (typeof window === "undefined") {
    return "ws://127.0.0.1:3000/ws-dual";
  }
  return bridgeWsURL("/ws-dual");
}

function defaultWebSocketFactory(url: string): WebSocketLike {
  return new WebSocket(url) as unknown as WebSocketLike;
}

/**
 * Resolves deterministic Public Croc Relay endpoints for Dual-Relay Alpha and Beta lanes
 * from the shared Codephrase so both peers always rendezvous without external signaling.
 */
export async function resolvePublicDualRelayPlan(
  codephrase: string,
  relayAddresses: string[],
): Promise<PublicDualRelayPlan> {
  if (relayAddresses.length === 0) {
    throw new Error("Chưa có cấu hình Relay Croc công cộng.");
  }
  const alphaIndex = await relayIndex(codephrase, relayAddresses.length);
  const dualRelaySupported = relayAddresses.length >= 2;
  const betaIndex = dualRelaySupported ? (alphaIndex + 1) % relayAddresses.length : alphaIndex;
  const alphaAddr = relayAddresses[alphaIndex];
  const betaAddr = relayAddresses[betaIndex];

  return {
    alphaIndex,
    betaIndex,
    alphaHost: extractRelayHost(alphaAddr),
    betaHost: extractRelayHost(betaAddr),
    alphaPort: controlPort(alphaAddr),
    betaPort: controlPort(betaAddr),
    dualRelaySupported,
  };
}

export async function prepareEnhancedRelayContext(params: {
  codephrase: string;
  relayProfile: RelayProfileMode;
  bridgeConfig: { relayAddresses: string[]; relayPassword: string } | null;
  latencies: Record<string, number | null>;
}): Promise<{
  publicRelaySettings?: PublicRelaySettings;
  streamPairRtts: { alphaRttMs: number | null; betaRttMs: number | null };
}> {
  const { codephrase, relayProfile, bridgeConfig, latencies } = params;
  if (isLocalLabProfile(relayProfile)) {
    return {
      streamPairRtts: resolveStreamPairRtts({ relayProfile, latencies }),
    };
  }
  if (!bridgeConfig || bridgeConfig.relayAddresses.length === 0) {
    throw new Error("Bridge Server chưa sẵn sàng danh sách Relay Croc công cộng.");
  }
  const plan = await resolvePublicDualRelayPlan(codephrase, bridgeConfig.relayAddresses);
  return {
    publicRelaySettings: {
      bridgeURL: bridgeWsURL("/ws"),
      relayAddresses: bridgeConfig.relayAddresses,
      relayPassword: bridgeConfig.relayPassword,
    },
    streamPairRtts: resolveStreamPairRtts({
      relayProfile,
      latencies,
      relayAddresses: bridgeConfig.relayAddresses,
      alphaIndex: plan.alphaIndex,
      betaIndex: plan.betaIndex,
    }),
  };
}

async function openLocalWsChannel(params: {
  baseWsUrl: string;
  lane: RelayLane;
  room: string;
  role: "sender" | "receiver";
  wsFactory: WebSocketFactory;
  onMessage: (lane: RelayLane, msg: WirePlainMessage) => void;
  onPeerCount?: (lane: RelayLane, count: number) => void;
  onClose: (lane: RelayLane) => void;
  signal?: AbortSignal;
}): Promise<RelayChannelConnection> {
  const separator = params.baseWsUrl.includes("?") ? "&" : "?";
  const url = `${params.baseWsUrl}${separator}channel=${params.lane}&room=${encodeURIComponent(params.room)}&role=${params.role}`;
  const ws = params.wsFactory(url);
  ws.binaryType = "arraybuffer";

  const conn: RelayChannelConnection = {
    lane: params.lane,
    alive: false,
    sendJson: (msg) => {
      if (!conn.alive || ws.readyState !== 1) {
        throw new Error(`Kênh Relay ${params.lane} đã ngắt kết nối`);
      }
      ws.send(JSON.stringify(msg));
    },
    close: () => {
      conn.alive = false;
      try {
        ws.close(1000, "done");
      } catch {
        // Ignore close errors
      }
    },
  };

  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      conn.close();
      reject(new DOMException("Phiên truyền đã bị hủy", "AbortError"));
    };
    params.signal?.addEventListener("abort", onAbort, { once: true });

    let settled = false;
    ws.onopen = () => {
      conn.alive = true;
      if (!settled) {
        settled = true;
        params.signal?.removeEventListener("abort", onAbort);
        resolve();
      }
    };
    ws.onerror = () => {
      conn.alive = false;
      if (!settled) {
        settled = true;
        params.signal?.removeEventListener("abort", onAbort);
        reject(new Error(`Không thể kết nối tới Relay ${params.lane}`));
      }
    };
    ws.onmessage = (ev) => {
      try {
        const raw =
          typeof ev.data === "string"
            ? ev.data
            : ev.data instanceof ArrayBuffer
              ? dec.decode(new Uint8Array(ev.data))
              : dec.decode(new Uint8Array(ev.data as Uint8Array));
        if (raw === "__pong__" || raw === "__ping__") return;
        const parsed = JSON.parse(raw) as WirePlainMessage;
        if (parsed.type === "peer_count") {
          params.onPeerCount?.(params.lane, parsed.count);
          return;
        }
        params.onMessage(params.lane, parsed);
      } catch {
        // Ignore malformed non-JSON frames
      }
    };
    ws.onclose = () => {
      const wasOpen = settled && conn.alive;
      conn.alive = false;
      if (wasOpen) {
        params.onClose(params.lane);
      }
      if (!settled) {
        settled = true;
        params.signal?.removeEventListener("abort", onAbort);
        reject(new Error(`Relay ${params.lane} đóng kết nối trước khi mở phiên`));
      }
    };
  });

  return conn;
}

async function openPublicCrocChannel(params: {
  publicRelaySettings: PublicRelaySettings;
  relayIdx: number;
  port: string;
  lane: RelayLane;
  room: string;
  onMessage: (lane: RelayLane, msg: WirePlainMessage) => void;
  onClose: (lane: RelayLane) => void;
  connectFn: typeof connectRelay;
  signal?: AbortSignal;
}): Promise<RelayChannelConnection> {
  const { socket } = await params.connectFn(
    {
      bridgeURL: params.publicRelaySettings.bridgeURL,
      relayAddresses: params.publicRelaySettings.relayAddresses,
      relayPassword: params.publicRelaySettings.relayPassword,
      storeAPI: "",
    },
    `${params.room}-${params.lane}`,
    params.port,
    params.relayIdx,
    params.signal,
  );

  let sendChain: Promise<void> = Promise.resolve();
  const conn: RelayChannelConnection = {
    lane: params.lane,
    alive: true,
    sendJson: (msg) => {
      if (!conn.alive) {
        throw new Error(`Kênh Relay ${params.lane} đã ngắt kết nối`);
      }
      const bytes = enc.encode(JSON.stringify(msg));
      sendChain = sendChain
        .then(() => socket.send(bytes))
        .catch(() => {
          const wasAlive = conn.alive;
          conn.alive = false;
          if (wasAlive) params.onClose(params.lane);
        });
    },
    flush: () => sendChain,
    close: () => {
      conn.alive = false;
      socket.close();
    },
  };

  void (async () => {
    try {
      while (conn.alive) {
        const frame = await socket.receive(true);
        if (!conn.alive) break;
        const parsed = JSON.parse(dec.decode(frame)) as WirePlainMessage;
        params.onMessage(params.lane, parsed);
      }
    } catch {
      // Socket closed or frame error
    } finally {
      const wasAlive = conn.alive;
      conn.alive = false;
      if (wasAlive) {
        params.onClose(params.lane);
      }
    }
  })();

  return conn;
}

async function openEnhancedChannels(params: {
  room: string;
  role: "sender" | "receiver";
  codephrase: string;
  dualRelay: boolean;
  relayProfile?: RelayProfileMode;
  publicRelaySettings?: PublicRelaySettings;
  baseWsUrl: string;
  wsFactory: WebSocketFactory;
  publicConnectRelay?: typeof connectRelay;
  onMessage: (lane: RelayLane, msg: WirePlainMessage) => void;
  onPeerCount?: (lane: RelayLane, count: number) => void;
  onClose: (lane: RelayLane) => void;
  signal: AbortSignal;
}): Promise<{
  alphaConn: RelayChannelConnection;
  betaConn: RelayChannelConnection | null;
  effectiveDualRelay: boolean;
  routeDetail: string;
  betaFallbackReason?: string;
}> {
  const usePublic =
    params.relayProfile === "public" && Boolean(params.publicRelaySettings?.relayAddresses?.length);

  let alphaPromise: Promise<RelayChannelConnection>;
  let betaPromise: Promise<RelayChannelConnection | null> = Promise.resolve(null);
  let fallbackReasonIfNoBeta: string | undefined;
  let routeDetailFor: (dualActive: boolean) => string;

  if (usePublic && params.publicRelaySettings) {
    const publicSettings = params.publicRelaySettings;
    const plan = await resolvePublicDualRelayPlan(params.codephrase, publicSettings.relayAddresses);
    const connectFn = params.publicConnectRelay ?? connectRelay;

    alphaPromise = openPublicCrocChannel({
      publicRelaySettings: publicSettings,
      relayIdx: plan.alphaIndex,
      port: plan.alphaPort,
      lane: "alpha",
      room: params.room,
      onMessage: params.onMessage,
      onClose: params.onClose,
      connectFn,
      signal: params.signal,
    }).catch((err) => {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Không thể kết nối Public Croc Relay (${plan.alphaHost}:${plan.alphaPort}): ${reason}. Nếu mạng chặn cổng TCP 9009–9017, hãy đổi Hồ sơ Relay sang 'Local Dual-Relay Lab'.`,
      );
    });

    if (params.dualRelay && plan.dualRelaySupported) {
      betaPromise = openPublicCrocChannel({
        publicRelaySettings: publicSettings,
        relayIdx: plan.betaIndex,
        port: plan.betaPort,
        lane: "beta",
        room: params.room,
        onMessage: params.onMessage,
        onClose: params.onClose,
        connectFn,
        signal: params.signal,
      });
    } else if (params.dualRelay && !plan.dualRelaySupported) {
      fallbackReasonIfNoBeta = "Cần tối thiểu 2 Relay Node công cộng khác nhau — tự động thu gọn về Relay Alpha";
    }

    routeDetailFor = (dualActive) =>
      dualActive
        ? `Room ${params.room} · Public (${plan.alphaHost}:${plan.alphaPort} + ${plan.betaHost}:${plan.betaPort})`
        : `Room ${params.room} · Public (${plan.alphaHost}:${plan.alphaPort})`;
  } else {
    const openWsLane = (lane: RelayLane) =>
      openLocalWsChannel({
        baseWsUrl: params.baseWsUrl,
        lane,
        room: params.room,
        role: params.role,
        wsFactory: params.wsFactory,
        onMessage: params.onMessage,
        onPeerCount: params.onPeerCount,
        onClose: params.onClose,
        signal: params.signal,
      });

    alphaPromise = openWsLane("alpha");
    if (params.dualRelay) {
      betaPromise = openWsLane("beta");
    }
    routeDetailFor = () =>
      isLocalLabProfile(params.relayProfile)
        ? `Room ${params.room} · Local Dual-Relay Lab (/ws-dual)`
        : `Room ${params.room}`;
  }

  const [alphaRes, betaRes] = await Promise.allSettled([alphaPromise, betaPromise]);
  if (alphaRes.status === "rejected") {
    if (betaRes.status === "fulfilled" && betaRes.value) {
      betaRes.value.close();
    }
    throw alphaRes.reason;
  }

  const alphaConn = alphaRes.value;
  let betaConn: RelayChannelConnection | null = null;
  let betaFallbackReason = fallbackReasonIfNoBeta;

  if (betaRes.status === "fulfilled" && betaRes.value) {
    betaConn = betaRes.value;
  } else if (betaRes.status === "rejected") {
    betaFallbackReason =
      betaRes.reason instanceof Error ? betaRes.reason.message : String(betaRes.reason);
  }

  const effectiveDualRelay = Boolean(params.dualRelay && betaConn?.alive);
  return {
    alphaConn,
    betaConn,
    effectiveDualRelay,
    routeDetail: routeDetailFor(effectiveDualRelay),
    betaFallbackReason,
  };
}

function logEnhancedChannelOpened(params: {
  emitInspector: boolean;
  dualRequested: boolean;
  effectiveDualRelay: boolean;
  routeDetail: string;
  betaFallbackReason?: string;
  dualTitle: string;
  singleTitle: string;
}) {
  if (!params.emitInspector) return;
  if (params.dualRequested && !params.effectiveDualRelay && params.betaFallbackReason) {
    protocolEventBus.logEvent({
      kind: "relay",
      mode: "enhanced",
      relay: "alpha",
      title: "Không mở được Relay Beta — chuyển về 1 kênh Relay Alpha",
      detail: params.betaFallbackReason,
    });
  }
  protocolEventBus.setPakeStep("room", "done");
  protocolEventBus.logEvent({
    kind: "relay",
    mode: "enhanced",
    relay: "alpha",
    title: params.effectiveDualRelay ? params.dualTitle : params.singleTitle,
    detail: params.routeDetail,
  });
  protocolEventBus.setPakeStep("pake", "active");
}

export async function filesToManifestInputs(files: File[]): Promise<ManifestInputFile[]> {
  const inputs: ManifestInputFile[] = [];
  for (const file of files) {
    const rel =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim() || file.name;
    const buf = await file.arrayBuffer();
    inputs.push({
      relativePath: rel,
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      bytes: new Uint8Array(buf),
    });
  }
  return inputs;
}

export async function sendEnhancedTransfer(options: {
  files: ManifestInputFile[];
  codephrase: string;
  dualRelay?: boolean;
  relayProfile?: RelayProfileMode;
  publicRelaySettings?: PublicRelaySettings;
  publicConnectRelay?: typeof connectRelay;
  chunkSize?: number;
  baseWsUrl?: string;
  wsFactory?: WebSocketFactory;
  chunkDelayMs?: number;
  emitInspector?: boolean;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
  onProgress?: (progress: EnhancedProgress) => void;
  onHandleReady?: (handle: EnhancedControlHandle) => void;
}): Promise<EnhancedSendResult> {
  const {
    files,
    codephrase,
    dualRelay = true,
    relayProfile,
    publicRelaySettings,
    publicConnectRelay,
    chunkSize = 64 * 1024,
    baseWsUrl = defaultWsBaseUrl(),
    wsFactory = defaultWebSocketFactory,
    chunkDelayMs = 0,
    emitInspector = true,
    signal,
    onStatus,
    onProgress,
    onHandleReady,
  } = options;

  const startedAt = Date.now();
  onStatus?.("Đang lập Folder Manifest và tính mã băm SHA-256 cho từng Chunk…");
  const manifest = await buildFolderManifest(files, chunkSize);
  const room = await deriveEnhancedRoom(codephrase);

  if (emitInspector) {
    protocolEventBus.startSession({
      sessionId: `enh-send-${startedAt}`,
      mode: "enhanced",
      direction: "send",
      totalBytes: manifest.totalBytes,
      totalChunks: manifest.totalChunks,
    });
    protocolEventBus.setPakeStep("room", "active");
    protocolEventBus.logEvent({
      kind: "manifest",
      mode: "enhanced",
      title: `Đã tạo Folder Manifest (${manifest.totalFiles} tệp · ${manifest.totalChunks} chunks)`,
      detail: `Chunk size ${Math.round(chunkSize / 1024)} KB · Tổng ${manifest.totalBytes.toLocaleString()} bytes · SHA-256 mỗi chunk`,
    });
  }

  const incoming = new AsyncMessageQueue<{ lane: RelayLane; msg: WirePlainMessage }>();
  let alphaConn: RelayChannelConnection | null = null;
  let betaConn: RelayChannelConnection | null = null;
  let scheduler: DualRelayScheduler | null = null;
  let effectiveDualRelay = dualRelay;
  let alphaAlive = true;
  let betaAlive = dualRelay;
  let missingIndices: number[] = [];
  let skippedCount = 0;
  let bytesTransferred = 0;

  let workerWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  const wakeWorkers = (fatalErr?: Error) => {
    const waiters = workerWaiters.splice(0);
    for (const w of waiters) {
      if (fatalErr) w.reject(fatalErr);
      else w.resolve();
    }
  };
  const waitForWorkerSignal = (): Promise<void> => {
    if (controller.signal.aborted) {
      return Promise.reject(new DOMException("Phiên truyền đã bị hủy", "AbortError"));
    }
    return new Promise<void>((resolve, reject) => {
      workerWaiters.push({ resolve, reject });
    });
  };

  const reportProgress = () => {
    if (!scheduler) return;
    const snap = scheduler.getSnapshot();
    const elapsedSec = Math.max(0.05, (Date.now() - startedAt) / 1000);
    const speedBps = bytesTransferred / elapsedSec;
    if (emitInspector) {
      protocolEventBus.recordThroughput(bytesTransferred, manifest.totalBytes, speedBps);
    }
    const completedSet = new Set<number>();
    for (const idx of missingIndices) {
      if (scheduler.isDelivered(idx)) {
        completedSet.add(idx);
      }
    }
    for (const c of manifest.chunks) {
      if (!missingIndices.includes(c.globalIndex)) {
        completedSet.add(c.globalIndex);
      }
    }
    const fileProgress = calculateManifestFileProgress(
      manifest.files,
      manifest.chunks,
      completedSet,
    );
    onProgress?.({
      completedChunks: skippedCount + snap.deliveredCount,
      totalChunks: manifest.totalChunks,
      bytesTransferred,
      totalBytes: manifest.totalBytes,
      speedBps,
      resumedChunks: skippedCount,
      alphaChunks: snap.alphaDelivered,
      betaChunks: snap.betaDelivered,
      failoverChunks: snap.failoverReroutedCount,
      alphaAlive: snap.alphaAlive,
      betaAlive: snap.dualEnabled ? snap.betaAlive : undefined,
      fileProgress,
    });
  };

  const triggerLaneFailover = (failedLane: RelayLane, reason: string) => {
    if (failedLane === "alpha") {
      if (!alphaAlive || !effectiveDualRelay || !betaConn?.alive) return;
      alphaAlive = false;
      alphaConn?.close();
      const rerouted = scheduler?.triggerAlphaFailover() ?? [];
      if (emitInspector) {
        for (const idx of rerouted) {
          protocolEventBus.updateChunkState(idx, "failover", "failover");
        }
        protocolEventBus.logEvent({
          kind: "failover",
          mode: "enhanced",
          relay: "beta",
          title: "Failover kích hoạt: Relay Alpha mất kết nối!",
          detail: `${reason} · Chuyển hướng tự động ${rerouted.length} chunk chẵn còn lại sang Relay Beta`,
        });
      }
      onStatus?.(`Relay Alpha ngắt kết nối — đang tự động Failover ${rerouted.length} chunk sang Relay Beta…`);
      reportProgress();
      wakeWorkers();
      return;
    }

    if (!betaAlive || !effectiveDualRelay || !alphaConn?.alive) return;
    betaAlive = false;
    betaConn?.close();
    const rerouted = scheduler?.triggerBetaFailover() ?? [];
    if (emitInspector) {
      for (const idx of rerouted) {
        protocolEventBus.updateChunkState(idx, "failover", "failover");
      }
      protocolEventBus.logEvent({
        kind: "failover",
        mode: "enhanced",
        relay: "alpha",
        title: "Failover kích hoạt: Relay Beta mất kết nối!",
        detail: `${reason} · Chuyển hướng tự động ${rerouted.length} chunk lẻ còn lại sang Relay Alpha`,
      });
    }
    onStatus?.(`Relay Beta ngắt kết nối — đang tự động Failover ${rerouted.length} chunk sang Relay Alpha…`);
    reportProgress();
    wakeWorkers();
  };

  const controller = new AbortController();
  const handleAbort = () => {
    controller.abort();
    const err = new DOMException("Phiên truyền đã bị hủy", "AbortError");
    alphaConn?.close();
    betaConn?.close();
    incoming.close(err);
    wakeWorkers(err);
  };
  signal?.addEventListener("abort", handleAbort, { once: true });

  try {
    onStatus?.(
      relayProfile === "public" && publicRelaySettings?.relayAddresses?.length
        ? dualRelay
          ? "Đang mở kết nối Dual-Relay qua cụm Croc công cộng…"
          : "Đang kết nối tới Public Croc Relay…"
        : dualRelay
          ? "Đang mở kết nối đồng thời tới Relay Alpha (Chẵn) & Relay Beta (Lẻ)…"
          : "Đang kết nối tới Relay Alpha…",
    );

    const handleMessage = (lane: RelayLane, msg: WirePlainMessage) => {
      incoming.push({ lane, msg });
    };
    const handleClose = (lane: RelayLane) => {
      if (lane === "alpha") {
        if (effectiveDualRelay && betaConn?.alive) {
          triggerLaneFailover("alpha", "Phát hiện đóng socket trên Relay Alpha");
        } else {
          alphaAlive = false;
        }
      } else if (lane === "beta") {
        if (effectiveDualRelay && alphaConn?.alive) {
          triggerLaneFailover("beta", "Phát hiện đóng socket trên Relay Beta");
        } else {
          betaAlive = false;
        }
      }

      if (!alphaConn?.alive && !betaConn?.alive) {
        const err = new Error("Cả hai kênh Relay đều đã đóng");
        incoming.close(err);
        wakeWorkers(err);
      }
    };

    const opened = await openEnhancedChannels({
      room,
      role: "sender",
      codephrase,
      dualRelay,
      relayProfile,
      publicRelaySettings,
      publicConnectRelay,
      baseWsUrl,
      wsFactory,
      onMessage: handleMessage,
      onClose: handleClose,
      signal: controller.signal,
    });
    alphaConn = opened.alphaConn;
    betaConn = opened.betaConn;
    effectiveDualRelay = opened.effectiveDualRelay;
    alphaAlive = Boolean(alphaConn.alive);
    betaAlive = Boolean(betaConn?.alive);

    onHandleReady?.({
      simulateAlphaDisconnect: () =>
        triggerLaneFailover("alpha", "Người dùng kích hoạt mô phỏng ngắt Relay Alpha"),
      cancel: () => handleAbort(),
    });

    logEnhancedChannelOpened({
      emitInspector,
      dualRequested: dualRelay,
      effectiveDualRelay,
      routeDetail: opened.routeDetail,
      betaFallbackReason: opened.betaFallbackReason,
      dualTitle: "Đã mở song song Relay Alpha (chẵn) & Relay Beta (lẻ)",
      singleTitle: "Đã kết nối Relay Alpha",
    });

    onStatus?.("Đang chờ máy nhận tham gia phòng và bắt tay mã hóa PAKE/ECDH…");

    // Wait for receiver's pake-init on either channel
    let initMsg: Extract<WirePlainMessage, { type: "pake-init" }> | null = null;
    while (!initMsg) {
      const next = await incoming.next();
      if (next.msg.type === "pake-init") {
        initMsg = next.msg;
      }
    }

    const myKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const peerPub = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(base64ToBytes(initMsg.pubKeyB64)),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const sharedBits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "ECDH", public: peerPub },
        myKeyPair.privateKey,
        256,
      ),
    );
    const myPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", myKeyPair.publicKey));
    const salt = base64ToBytes(initMsg.saltB64);

    if (emitInspector) {
      protocolEventBus.setPakeStep("pake", "done");
      protocolEventBus.setPakeStep("hkdf", "active");
    }

    const keys = await deriveSessionKeys({
      ecdhSharedSecret: sharedBits,
      codephrase,
      room,
      salt,
    });

    if (emitInspector) {
      protocolEventBus.setPakeStep("hkdf", "done");
      protocolEventBus.setPakeStep("confirm", "active");
    }

    const sendControlMsg = (msg: WirePlainMessage) => {
      if (alphaConn?.alive) alphaConn.sendJson(msg);
      else if (betaConn?.alive) betaConn.sendJson(msg);
      else throw new Error("Không còn kênh Relay hoạt động để gửi gói điều khiển");
    };

    const pakeReplyMsg: WirePlainMessage = {
      type: "pake-reply",
      pubKeyB64: bytesToBase64(myPubRaw),
      confirmB64: bytesToBase64(keys.confirmSender),
    };
    sendControlMsg(pakeReplyMsg);

    // Verify receiver confirmation; idempotently re-reply if a duplicate pake-init arrives before confirm
    let confirmMsg: Extract<WirePlainMessage, { type: "pake-confirm" }> | null = null;
    while (!confirmMsg) {
      const next = await incoming.next();
      if (next.msg.type === "pake-confirm") {
        confirmMsg = next.msg;
      } else if (next.msg.type === "pake-init" && next.msg.pubKeyB64 === initMsg.pubKeyB64) {
        sendControlMsg(pakeReplyMsg);
      }
    }
    if (!bytesEqual(base64ToBytes(confirmMsg.confirmB64), keys.confirmReceiver)) {
      throw new Error("Xác thực mã bí mật thất bại — máy nhận nhập sai Codephrase");
    }

    if (emitInspector) {
      protocolEventBus.setPakeStep("confirm", "done");
      protocolEventBus.setPakeStep("stream", "active");
      protocolEventBus.logEvent({
        kind: "pake",
        mode: "enhanced",
        title: "Bắt tay ECDH P-256 + HKDF-SHA-256 + AES-256-GCM thành công",
        detail: "Cả hai bên đã xác nhận khớp Codephrase; khóa AES-256-GCM đã sẵn sàng",
      });
    }

    // Send encrypted FolderManifest advertising effectiveDualRelay capability
    onStatus?.("Đang gửi Folder Manifest đã mã hóa cho máy nhận…");
    sendControlMsg(
      await encryptPayload(keys.aesKey, {
        kind: "manifest",
        manifest,
        dualRelay: effectiveDualRelay,
      }),
    );

    // Wait for receiver's ResumePlan + Dual-Relay negotiation
    while (true) {
      const next = await incoming.next();
      if (next.msg.type === "encrypted") {
        const decMsg = await decryptPayload(keys.aesKey, next.msg);
        if (decMsg.kind === "resume-plan") {
          missingIndices = decMsg.missingIndices;
          skippedCount = decMsg.skippedCount;
          if (decMsg.dualRelayAccepted === false && effectiveDualRelay) {
            effectiveDualRelay = false;
            betaAlive = false;
            betaConn?.close();
            betaConn = null;
            if (emitInspector) {
              protocolEventBus.logEvent({
                kind: "relay",
                mode: "enhanced",
                relay: "alpha",
                title: "Chuyển về 1 kênh Relay Alpha theo thỏa thuận với máy nhận",
                detail: "Máy nhận chỉ bật Relay Alpha — toàn bộ chunk sẽ đi qua Alpha",
              });
            }
          }
          if (emitInspector && skippedCount > 0) {
            const missingSet = new Set(missingIndices);
            for (const c of manifest.chunks) {
              if (!missingSet.has(c.globalIndex)) {
                protocolEventBus.updateChunkState(c.globalIndex, "resumed", "resumed");
              }
            }
            protocolEventBus.logEvent({
              kind: "resume",
              mode: "enhanced",
              title: `Resume Cache khớp ${skippedCount}/${manifest.totalChunks} chunks`,
              detail:
                decMsg.newFilePaths.length > 0
                  ? `Bỏ qua phần đã tải, chỉ gửi ${missingIndices.length} chunk còn thiếu (phát hiện tệp mới: ${decMsg.newFilePaths.join(", ")})`
                  : `Bỏ qua phần đã tải, chỉ gửi ${missingIndices.length} chunk còn thiếu`,
            });
          }
          break;
        }
        if (decMsg.kind === "error") {
          throw new Error(decMsg.message);
        }
      }
    }

    scheduler = new DualRelayScheduler(missingIndices, effectiveDualRelay);
    if (!alphaAlive && effectiveDualRelay && betaAlive) {
      scheduler.triggerAlphaFailover();
    } else if (!betaAlive && effectiveDualRelay && alphaAlive) {
      scheduler.triggerBetaFailover();
    }

    const chunkLookup = new Map<number, ManifestChunkDescriptor>();
    for (const c of manifest.chunks) {
      chunkLookup.set(c.globalIndex, c);
    }

    bytesTransferred = manifest.chunks
      .filter((c) => !missingIndices.includes(c.globalIndex))
      .reduce((acc, c) => acc + c.size, 0);

    let receiverFinished = false;
    const finishedHandlers: {
      resolve?: () => void;
      reject?: (err: Error) => void;
    } = {};
    const finishedPromise = new Promise<void>((res, rej) => {
      finishedHandlers.resolve = res;
      finishedHandlers.reject = rej;
    });
    void finishedPromise.catch(() => undefined);

    // Background reader for chunk-ack, lane-down, and completion
    const ackLoop = (async () => {
      try {
        while (!receiverFinished) {
          const next = await incoming.next();
          if (next.msg.type !== "encrypted") continue;
          const payload = await decryptPayload(keys.aesKey, next.msg);
          if (payload.kind === "chunk-ack") {
            const newlyDelivered = scheduler.markDelivered(payload.globalIndex, payload.lane);
            if (newlyDelivered) {
              const desc = chunkLookup.get(payload.globalIndex);
              if (desc) bytesTransferred += desc.size;
              if (emitInspector) {
                const wasRerouted = scheduler.getChunk(payload.globalIndex)?.rerouted ?? false;
                protocolEventBus.updateChunkState(
                  payload.globalIndex,
                  wasRerouted ? "failover" : "verified",
                );
              }
              reportProgress();
              wakeWorkers();
            }
          } else if (payload.kind === "lane-down") {
            if (payload.lane === "alpha" && alphaAlive && effectiveDualRelay && betaConn?.alive) {
              triggerLaneFailover("alpha", "Máy nhận mất kết nối kênh Relay Alpha");
            } else if (payload.lane === "beta" && betaAlive && effectiveDualRelay && alphaConn?.alive) {
              triggerLaneFailover("beta", "Máy nhận mất kết nối kênh Relay Beta");
            }
          } else if (payload.kind === "complete") {
            const finalized = scheduler.markRemainingDelivered();
            for (const item of finalized) {
              const desc = chunkLookup.get(item.globalIndex);
              if (desc) bytesTransferred += desc.size;
              if (emitInspector) {
                protocolEventBus.updateChunkState(
                  item.globalIndex,
                  item.rerouted ? "failover" : "verified",
                );
              }
            }
            if (finalized.length > 0) {
              reportProgress();
            }
            receiverFinished = true;
            wakeWorkers();
            finishedHandlers.resolve?.();
            break;
          } else if (payload.kind === "error") {
            throw new Error(payload.message);
          }
        }
      } catch (err) {
        if (!receiverFinished) {
          const errorObj = err instanceof Error ? err : new Error(String(err));
          wakeWorkers(errorObj);
          finishedHandlers.reject?.(errorObj);
        }
      }
    })();
    void ackLoop.catch(() => undefined);

    const runLaneWorker = async (lane: RelayLane) => {
      while (!receiverFinished && !scheduler!.isComplete()) {
        if (controller.signal.aborted) {
          throw new DOMException("Phiên truyền đã bị hủy", "AbortError");
        }
        if ((lane === "alpha" && !alphaAlive) || (lane === "beta" && !betaAlive)) {
          break;
        }
        if (scheduler!.inFlightCountForLane(lane) >= MAX_IN_FLIGHT_PER_LANE) {
          await waitForWorkerSignal();
          continue;
        }

        const scheduledChunk = scheduler!.nextForLane(lane);
        if (!scheduledChunk) {
          const otherLaneAlive = lane === "alpha" ? betaAlive : alphaAlive;
          if (
            !receiverFinished &&
            !scheduler!.isComplete() &&
            (scheduler!.inFlightCountForLane(lane) > 0 || (effectiveDualRelay && otherLaneAlive))
          ) {
            await waitForWorkerSignal();
            continue;
          }
          break;
        }

        const desc = chunkLookup.get(scheduledChunk.globalIndex)!;
        const fileInput = files[desc.fileIndex];
        const rawSlice = fileInput.bytes.subarray(desc.offset, desc.offset + desc.size);
        const conn = lane === "alpha" ? alphaConn : betaConn;
        const survivingConn = lane === "alpha" ? betaConn : alphaConn;

        if (!conn || !conn.alive) {
          if (effectiveDualRelay && survivingConn?.alive) {
            triggerLaneFailover(lane, `Kênh Relay ${lane} không sẵn sàng khi đang phát`);
            break;
          }
          throw new Error(`Kênh Relay ${lane} bị ngắt kết nối`);
        }

        if (emitInspector) {
          protocolEventBus.updateChunkState(
            desc.globalIndex,
            scheduledChunk.rerouted ? "failover" : lane,
            lane,
          );
        }

        const encryptedFrame = await encryptPayload(keys.aesKey, {
          kind: "chunk",
          globalIndex: desc.globalIndex,
          lane,
          rerouted: scheduledChunk.rerouted,
          dataB64: bytesToBase64(rawSlice),
        });

        try {
          conn.sendJson(encryptedFrame);
        } catch {
          if (effectiveDualRelay && survivingConn?.alive) {
            triggerLaneFailover(lane, `Lỗi gửi frame trên Relay ${lane}`);
            break;
          }
          throw new Error(`Không thể gửi chunk #${desc.globalIndex} qua Relay ${lane}`);
        }

        if (chunkDelayMs > 0) {
          await new Promise((r) => setTimeout(r, chunkDelayMs));
        }
      }
    };

    onStatus?.(
      effectiveDualRelay
        ? "Đang truyền song song Chunk chẵn (Relay Alpha) & Chunk lẻ (Relay Beta)…"
        : "Đang truyền dữ liệu mã hóa qua Relay Alpha…",
    );

    if (missingIndices.length > 0) {
      if (effectiveDualRelay) {
        await Promise.all([runLaneWorker("alpha"), runLaneWorker("beta")]);
      } else {
        await runLaneWorker("alpha");
      }
    }

    reportProgress();
    onStatus?.("Đang chờ máy nhận xác nhận hoàn tất ghép tệp SHA-256…");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const onAbortWait = () => {
      finishedHandlers.reject?.(new DOMException("Phiên truyền đã bị hủy", "AbortError"));
    };
    if (controller.signal.aborted) {
      onAbortWait();
    } else {
      controller.signal.addEventListener("abort", onAbortWait, { once: true });
    }
    try {
      await Promise.race([
        finishedPromise,
        new Promise<void>((_, rej) => {
          timeoutId = setTimeout(
            () => rej(new Error("Quá thời gian chờ xác nhận hoàn tất từ máy nhận")),
            15000,
          );
        }),
      ]);
    } finally {
      controller.signal.removeEventListener("abort", onAbortWait);
      if (timeoutId) clearTimeout(timeoutId);
    }
    await ackLoop.catch(() => undefined);

    const finalSnap = scheduler.getSnapshot();
    if (emitInspector) {
      protocolEventBus.setPakeStep("stream", "done");
      protocolEventBus.finishSession(
        true,
        `Hoàn tất ${manifest.totalFiles} tệp · Alpha: ${finalSnap.alphaDelivered} chunk · Beta: ${finalSnap.betaDelivered} chunk · Resume: ${skippedCount} · Failover: ${finalSnap.failoverReroutedCount}`,
      );
    }
    onStatus?.("Đã gửi hoàn tất và xác thực SHA-256!");

    return {
      manifest,
      resumedChunks: skippedCount,
      alphaDelivered: finalSnap.alphaDelivered,
      betaDelivered: finalSnap.betaDelivered,
      failoverRerouted: finalSnap.failoverReroutedCount,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    if (emitInspector) {
      protocolEventBus.finishSession(false, err instanceof Error ? err.message : String(err));
    }
    throw err;
  } finally {
    signal?.removeEventListener("abort", handleAbort);
    alphaConn?.close();
    betaConn?.close();
  }
}

export interface EnhancedReceiveParams {
  codephrase: string;
  dualRelay?: boolean;
  relayProfile?: RelayProfileMode;
  publicRelaySettings?: PublicRelaySettings;
  publicConnectRelay?: typeof connectRelay;
  baseWsUrl?: string;
  wsFactory?: WebSocketFactory;
  cache?: ChunkCacheAdapter;
  emitInspector?: boolean;
  signal?: AbortSignal;
  stopAfterChunks?: number;
  onStatus?: (status: string) => void;
  onManifestOffer?: (manifest: FolderManifest, resumePlan: ResumePlan) => Promise<boolean>;
  onProgress?: (progress: EnhancedProgress) => void;
}

export async function receiveEnhancedTransfer(options: EnhancedReceiveParams): Promise<EnhancedReceiveResult> {
  const {
    codephrase,
    dualRelay = true,
    relayProfile,
    publicRelaySettings,
    publicConnectRelay,
    baseWsUrl = defaultWsBaseUrl(),
    wsFactory = defaultWebSocketFactory,
    cache = browserIndexedDbCache,
    emitInspector = true,
    signal,
    stopAfterChunks,
    onStatus,
    onManifestOffer,
    onProgress,
  } = options;

  const startedAt = Date.now();
  const room = await deriveEnhancedRoom(codephrase);

  if (emitInspector) {
    protocolEventBus.startSession({
      sessionId: `enh-recv-${startedAt}`,
      mode: "enhanced",
      direction: "receive",
    });
    protocolEventBus.setPakeStep("room", "active");
  }

  const incoming = new AsyncMessageQueue<{ lane: RelayLane; msg: WirePlainMessage }>();
  let alphaConn: RelayChannelConnection | null = null;
  let betaConn: RelayChannelConnection | null = null;
  let alphaAlive = false;
  let betaAlive = false;
  let sessionKeys: {
    aesKey: CryptoKey;
    confirmSender: Uint8Array;
    confirmReceiver: Uint8Array;
  } | null = null;
  let transferComplete = false;
  let gotPakeReply = false;
  let sendPakeInitFn: (() => void) | null = null;
  let pakeRetryTimer: ReturnType<typeof setInterval> | undefined;

  const controller = new AbortController();
  const handleAbort = () => {
    controller.abort();
    if (pakeRetryTimer) {
      clearInterval(pakeRetryTimer);
      pakeRetryTimer = undefined;
    }
    alphaConn?.close();
    betaConn?.close();
    incoming.close(new DOMException("Đã hủy nhận dữ liệu", "AbortError"));
  };
  if (signal?.aborted) {
    throw new DOMException("Đã hủy nhận dữ liệu", "AbortError");
  }
  signal?.addEventListener("abort", handleAbort, { once: true });

  try {
    onStatus?.(
      relayProfile === "public" && publicRelaySettings?.relayAddresses?.length
        ? dualRelay
          ? "Đang kết nối máy nhận qua cụm Public Croc Relay…"
          : "Đang kết nối máy nhận tới Public Croc Relay…"
        : dualRelay
          ? "Đang kết nối máy nhận tới Relay Alpha & Relay Beta…"
          : "Đang kết nối máy nhận tới Relay Alpha…",
    );

    const handleMsg = (lane: RelayLane, msg: WirePlainMessage) => {
      incoming.push({ lane, msg });
    };
    const handlePeerCount = (_lane: RelayLane, count: number) => {
      if (count >= 2 && !gotPakeReply && sendPakeInitFn) {
        sendPakeInitFn();
      }
    };
    const handleClose = (closedLane: RelayLane) => {
      if (closedLane === "alpha") alphaAlive = false;
      else betaAlive = false;

      if (!alphaConn?.alive && !betaConn?.alive) {
        incoming.close(new Error("Cả hai kênh Relay đã đóng kết nối"));
        return;
      }

      if (sessionKeys && !transferComplete && !controller.signal.aborted) {
        const surviving = closedLane === "alpha" ? betaConn : alphaConn;
        if (surviving?.alive) {
          void encryptPayload(sessionKeys.aesKey, {
            kind: "lane-down",
            lane: closedLane,
          })
            .then((frame) => {
              if (surviving.alive) surviving.sendJson(frame);
            })
            .catch(() => undefined);
        }
      }
    };

    const opened = await openEnhancedChannels({
      room,
      role: "receiver",
      codephrase,
      dualRelay,
      relayProfile,
      publicRelaySettings,
      publicConnectRelay,
      baseWsUrl,
      wsFactory,
      onMessage: handleMsg,
      onPeerCount: handlePeerCount,
      onClose: handleClose,
      signal: controller.signal,
    });
    alphaConn = opened.alphaConn;
    betaConn = opened.betaConn;
    let effectiveDualRelay = opened.effectiveDualRelay;
    alphaAlive = Boolean(alphaConn.alive);
    betaAlive = Boolean(betaConn?.alive);

    logEnhancedChannelOpened({
      emitInspector,
      dualRequested: dualRelay,
      effectiveDualRelay,
      routeDetail: opened.routeDetail,
      betaFallbackReason: opened.betaFallbackReason,
      dualTitle: "Đã kết nối song song Relay Alpha & Beta",
      singleTitle: "Đã kết nối Relay Alpha",
    });

    onStatus?.("Đang khởi tạo trao đổi khóa ECDH P-256 + HKDF-SHA-256…");
    const myKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const myPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", myKeyPair.publicKey));
    const salt = crypto.getRandomValues(new Uint8Array(32));

    const sendControlMsg = (msg: WirePlainMessage, preferredLane?: RelayLane) => {
      if (preferredLane === "beta" && betaConn?.alive) {
        betaConn.sendJson(msg);
      } else if (preferredLane === "alpha" && alphaConn?.alive) {
        alphaConn.sendJson(msg);
      } else if (alphaConn?.alive) {
        alphaConn.sendJson(msg);
      } else if (betaConn?.alive) {
        betaConn.sendJson(msg);
      } else {
        throw new Error("Không còn kênh Relay hoạt động");
      }
    };

    const pakeInitMsg: WirePlainMessage = {
      type: "pake-init",
      pubKeyB64: bytesToBase64(myPubRaw),
      saltB64: bytesToBase64(salt),
    };
    sendPakeInitFn = () => {
      if (gotPakeReply || controller.signal.aborted) return;
      try {
        sendControlMsg(pakeInitMsg);
      } catch {
        // Ignore if channel closed while retrying
      }
    };

    sendPakeInitFn();
    pakeRetryTimer = setInterval(() => {
      sendPakeInitFn?.();
    }, PAKE_INIT_RETRY_MS);

    let replyMsg: Extract<WirePlainMessage, { type: "pake-reply" }> | null = null;
    try {
      while (!replyMsg) {
        const next = await incoming.next();
        if (next.msg.type === "pake-reply") {
          gotPakeReply = true;
          replyMsg = next.msg;
        }
      }
    } finally {
      if (pakeRetryTimer) {
        clearInterval(pakeRetryTimer);
        pakeRetryTimer = undefined;
      }
      sendPakeInitFn = null;
    }

    const peerPub = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(base64ToBytes(replyMsg.pubKeyB64)),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const sharedBits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "ECDH", public: peerPub },
        myKeyPair.privateKey,
        256,
      ),
    );

    if (emitInspector) {
      protocolEventBus.setPakeStep("pake", "done");
      protocolEventBus.setPakeStep("hkdf", "active");
    }

    const keys = await deriveSessionKeys({
      ecdhSharedSecret: sharedBits,
      codephrase,
      room,
      salt,
    });
    sessionKeys = keys;

    if (emitInspector) {
      protocolEventBus.setPakeStep("hkdf", "done");
      protocolEventBus.setPakeStep("confirm", "active");
    }

    if (!bytesEqual(base64ToBytes(replyMsg.confirmB64), keys.confirmSender)) {
      throw new Error("Mã bí mật không khớp với người gửi — phiên bị hủy để bảo vệ dữ liệu");
    }

    sendControlMsg({
      type: "pake-confirm",
      confirmB64: bytesToBase64(keys.confirmReceiver),
    });

    if (emitInspector) {
      protocolEventBus.setPakeStep("confirm", "done");
      protocolEventBus.setPakeStep("stream", "active");
    }

    onStatus?.("Đang nhận Folder Manifest từ máy gửi…");
    let manifest: FolderManifest | null = null;
    let senderDualRelay = effectiveDualRelay;
    while (!manifest) {
      const next = await incoming.next();
      if (next.msg.type === "encrypted") {
        const decMsg = await decryptPayload(keys.aesKey, next.msg);
        if (decMsg.kind === "manifest") {
          manifest = decMsg.manifest;
          senderDualRelay = Boolean(decMsg.dualRelay);
        } else if (decMsg.kind === "error") {
          throw new Error(decMsg.message);
        }
      }
    }

    // Negotiate effective Dual-Relay mode; close idle Beta if single-channel is chosen
    const negotiatedDual = senderDualRelay && effectiveDualRelay && Boolean(betaConn?.alive);
    if (effectiveDualRelay && !negotiatedDual) {
      effectiveDualRelay = false;
      betaAlive = false;
      betaConn?.close();
      betaConn = null;
    }

    if (emitInspector) {
      protocolEventBus.initChunks(manifest.totalChunks, manifest.totalBytes);
    }

    // Check IndexedDB Resume Cache
    const cachedMap = await cache.loadMap();
    const knownKeys = new Set(cachedMap.keys());
    const resumePlan = computeResumePlan(manifest, knownKeys);

    if (onManifestOffer) {
      const accepted = await onManifestOffer(manifest, resumePlan);
      if (!accepted) {
        sendControlMsg(
          await encryptPayload(keys.aesKey, {
            kind: "error",
            message: "Người nhận đã từ chối tệp",
          }),
        );
        throw new Error("Bạn đã từ chối nhận thư mục");
      }
    }

    const chunkBuffers = new Map<number, Uint8Array>();
    for (const skipped of resumePlan.skippedChunks) {
      const key = makeChunkCacheKey(skipped.filePath, skipped.chunkIndexInFile, skipped.sha256);
      const cachedData = cachedMap.get(key);
      if (cachedData) {
        chunkBuffers.set(skipped.globalIndex, cachedData);
        if (emitInspector) {
          protocolEventBus.updateChunkState(skipped.globalIndex, "resumed", "resumed");
        }
      }
    }

    const missingIndices = manifest.chunks
      .filter((c) => !chunkBuffers.has(c.globalIndex))
      .map((c) => c.globalIndex);

    sendControlMsg(
      await encryptPayload(keys.aesKey, {
        kind: "resume-plan",
        missingIndices,
        skippedCount: resumePlan.skippedChunks.length,
        newFilePaths: resumePlan.newFilePaths,
        dualRelayAccepted: negotiatedDual,
      }),
    );

    const chunkLookup = new Map<number, ManifestChunkDescriptor>();
    for (const c of manifest.chunks) {
      chunkLookup.set(c.globalIndex, c);
    }

    let bytesReceived = resumePlan.bytesSkipped;
    let alphaReceived = 0;
    let betaReceived = 0;
    let failoverReceived = 0;
    let networkChunksReceived = 0;

    onStatus?.(
      missingIndices.length === 0
        ? "Toàn bộ Chunk đã có sẵn trong Resume Cache — đang ghép tệp…"
        : `Đang nhận ${missingIndices.length} chunk còn thiếu (đã bỏ qua ${resumePlan.skippedChunks.length} chunk từ Resume Cache)…`,
    );

    while (chunkBuffers.size < manifest.totalChunks) {
      if (controller.signal.aborted) {
        throw new DOMException("Đã hủy nhận dữ liệu", "AbortError");
      }
      const next = await incoming.next();
      if (next.msg.type !== "encrypted") continue;
      const payload = await decryptPayload(keys.aesKey, next.msg);
      if (payload.kind === "error") {
        throw new Error(payload.message);
      }
      if (payload.kind !== "chunk") continue;

      const desc = chunkLookup.get(payload.globalIndex);
      if (!desc) continue;

      if (chunkBuffers.has(desc.globalIndex)) {
        // Re-acknowledge duplicates so a sender whose earlier ACK dropped on failover unblocks
        sendControlMsg(
          await encryptPayload(keys.aesKey, {
            kind: "chunk-ack",
            globalIndex: desc.globalIndex,
            lane: next.lane,
          }),
          next.lane,
        );
        continue;
      }

      const bytes = base64ToBytes(payload.dataB64);
      const actualHash = await sha256Hex(bytes);
      if (actualHash !== desc.sha256) {
        throw new Error(
          `Chunk #${desc.globalIndex} (${desc.filePath}) sai chữ ký SHA-256 — dữ liệu bị hỏng trên đường truyền`,
        );
      }

      chunkBuffers.set(desc.globalIndex, bytes);
      bytesReceived += bytes.byteLength;
      networkChunksReceived += 1;

      if (payload.lane === "alpha") alphaReceived += 1;
      else betaReceived += 1;
      if (payload.rerouted) failoverReceived += 1;

      // Persist immediately to Resume Cache so any disconnect preserves progress
      await cache.save({
        sessionKey: room,
        filePath: desc.filePath,
        chunkIndexInFile: desc.chunkIndexInFile,
        sha256: desc.sha256,
        data: bytes,
      });

      // Send verified receipt back to sender over surviving lane
      sendControlMsg(
        await encryptPayload(keys.aesKey, {
          kind: "chunk-ack",
          globalIndex: desc.globalIndex,
          lane: next.lane,
        }),
        next.lane,
      );

      if (emitInspector) {
        protocolEventBus.updateChunkState(
          desc.globalIndex,
          payload.rerouted ? "failover" : "verified",
          payload.rerouted ? "failover" : payload.lane,
        );
        const elapsedSec = Math.max(0.05, (Date.now() - startedAt) / 1000);
        protocolEventBus.recordThroughput(
          bytesReceived,
          manifest.totalBytes,
          bytesReceived / elapsedSec,
        );
      }

      const elapsedSec = Math.max(0.05, (Date.now() - startedAt) / 1000);
      const completedSet = new Set<number>(chunkBuffers.keys());
      for (const c of resumePlan.skippedChunks) {
        completedSet.add(c.globalIndex);
      }
      const fileProgress = calculateManifestFileProgress(
        manifest.files,
        manifest.chunks,
        completedSet,
      );
      onProgress?.({
        completedChunks: chunkBuffers.size,
        totalChunks: manifest.totalChunks,
        bytesTransferred: bytesReceived,
        totalBytes: manifest.totalBytes,
        speedBps: bytesReceived / elapsedSec,
        resumedChunks: resumePlan.skippedChunks.length,
        alphaChunks: alphaReceived,
        betaChunks: betaReceived,
        failoverChunks: failoverReceived,
        alphaAlive: Boolean(alphaConn?.alive),
        betaAlive: effectiveDualRelay ? Boolean(betaConn?.alive) : undefined,
        fileProgress,
      });

      if (typeof stopAfterChunks === "number" && networkChunksReceived >= stopAfterChunks) {
        throw new Error(
          `Mô phỏng mất kết nối mạng sau khi nhận ${networkChunksReceived} chunk (đã lưu vào Resume Cache)`,
        );
      }
    }

    // Reassemble files and verify full file SHA-256
    const outputFiles: ReceivedEnhancedFile[] = [];
    for (const fileEntry of manifest.files) {
      const fileChunks = manifest.chunks
        .filter((c) => c.fileIndex === fileEntry.fileIndex)
        .sort((a, b) => a.chunkIndexInFile - b.chunkIndexInFile);
      const assembled = new Uint8Array(fileEntry.size);
      for (const c of fileChunks) {
        const buf = chunkBuffers.get(c.globalIndex);
        if (!buf) {
          throw new Error(`Thiếu chunk #${c.globalIndex} khi ghép tệp ${fileEntry.relativePath}`);
        }
        assembled.set(buf, c.offset);
      }
      const fileHash = await sha256Hex(assembled);
      if (fileHash !== fileEntry.fileSha256) {
        throw new Error(`Sai mã băm SHA-256 toàn tệp cho ${fileEntry.relativePath}`);
      }
      outputFiles.push({
        relativePath: fileEntry.relativePath,
        name: fileEntry.name,
        mimeType: fileEntry.mimeType,
        size: fileEntry.size,
        sha256: fileHash,
        bytes: assembled,
      });
    }

    transferComplete = true;
    const completeFrame = await encryptPayload(keys.aesKey, {
      kind: "complete",
      totalVerified: manifest.totalChunks,
    });
    // Broadcast completion on every live channel so failover never drops the final ACK
    let sentComplete = false;
    if (alphaConn?.alive) {
      try {
        alphaConn.sendJson(completeFrame);
        sentComplete = true;
      } catch {
        // Alpha may be closed on sender side
      }
    }
    if (betaConn?.alive) {
      try {
        betaConn.sendJson(completeFrame);
        sentComplete = true;
      } catch {
        // Ignore if beta closed
      }
    }
    if (!sentComplete) {
      throw new Error("Không còn kênh Relay hoạt động để gửi xác nhận hoàn tất");
    }
    await Promise.all([
      alphaConn?.flush?.() ?? Promise.resolve(),
      betaConn?.flush?.() ?? Promise.resolve(),
    ]);

    if (emitInspector) {
      protocolEventBus.setPakeStep("stream", "done");
      protocolEventBus.finishSession(
        true,
        `Đã nhận & xác thực SHA-256 toàn bộ ${outputFiles.length} tệp (${manifest.totalBytes.toLocaleString()} bytes)`,
      );
    }
    onStatus?.("Đã nhận và xác thực SHA-256 thành công!");

    return {
      manifest,
      resumePlan,
      files: outputFiles,
      alphaReceived,
      betaReceived,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    if (emitInspector) {
      protocolEventBus.finishSession(false, err instanceof Error ? err.message : String(err));
    }
    throw err;
  } finally {
    if (pakeRetryTimer) {
      clearInterval(pakeRetryTimer);
      pakeRetryTimer = undefined;
    }
    signal?.removeEventListener("abort", handleAbort);
    alphaConn?.close();
    betaConn?.close();
  }
}

/**
 * Generates deterministic synthetic academic demo files for 1-click live Dual-Relay
 * Failover and Folder Resume demonstrations over the real /ws-dual server.
 */
function buildDemoFolderFiles(includeExtraFile: boolean): ManifestInputFile[] {
  const mkPayload = (seed: number, byteLen: number): Uint8Array => {
    const out = new Uint8Array(byteLen);
    for (let i = 0; i < byteLen; i += 1) {
      out[i] = (i * 31 + seed * 17) & 0xff;
    }
    return out;
  };

  const files: ManifestInputFile[] = [
    {
      relativePath: "BaoCao_MangMayTinh/Chuong1_TongQuan_PAKE.bin",
      name: "Chuong1_TongQuan_PAKE.bin",
      size: 160 * 1024,
      mimeType: "application/octet-stream",
      bytes: mkPayload(1, 160 * 1024),
    },
    {
      relativePath: "BaoCao_MangMayTinh/Chuong2_DualRelay_Chunking.bin",
      name: "Chuong2_DualRelay_Chunking.bin",
      size: 192 * 1024,
      mimeType: "application/octet-stream",
      bytes: mkPayload(2, 192 * 1024),
    },
  ];

  if (includeExtraFile) {
    files.push({
      relativePath: "BaoCao_MangMayTinh/PhuLuc_MoiThemSauMatMang.bin",
      name: "PhuLuc_MoiThemSauMatMang.bin",
      size: 96 * 1024,
      mimeType: "application/octet-stream",
      bytes: mkPayload(3, 96 * 1024),
    });
  }

  return files;
}

/**
 * Runs a REAL end-to-end Sender + Receiver Dual-Relay transfer over /ws-dual
 * and automatically triggers a real Relay Alpha disconnect mid-flight so the user
 * and lecturer can inspect real PAKE, Even/Odd routing, and Failover in 1 click.
 */
export async function runLoopbackDualRelayFailoverDemo(options: {
  codephrase: string;
  onStatus?: (status: string) => void;
  onProgress?: (progress: EnhancedProgress) => void;
  onHandleReady?: (handle: EnhancedControlHandle) => void;
}): Promise<EnhancedSendResult> {
  const demoFiles = buildDemoFolderFiles(false);
  const ephemeralCacheMap = new Map<string, Uint8Array>();
  const ephemeralCache: ChunkCacheAdapter = {
    loadMap: async () => new Map(ephemeralCacheMap),
    save: async (params) => {
      const k = makeChunkCacheKey(params.filePath, params.chunkIndexInFile, params.sha256);
      ephemeralCacheMap.set(k, params.data);
    },
  };

  let failoverTriggered = false;
  let senderHandle: EnhancedControlHandle | null = null;

  const sendPromise = sendEnhancedTransfer({
    files: demoFiles,
    codephrase: options.codephrase,
    dualRelay: true,
    chunkSize: 16 * 1024,
    chunkDelayMs: 45,
    emitInspector: true,
    onStatus: options.onStatus,
    onHandleReady: (h) => {
      senderHandle = h;
      options.onHandleReady?.(h);
    },
    onProgress: (p) => {
      options.onProgress?.(p);
      if (!failoverTriggered && p.completedChunks >= Math.floor(p.totalChunks * 0.45)) {
        failoverTriggered = true;
        senderHandle?.simulateAlphaDisconnect();
      }
    },
  });

  // Give sender a brief moment to join rooms before receiver opens and initiates PAKE
  await new Promise((r) => setTimeout(r, 80));

  const recvPromise = receiveEnhancedTransfer({
    codephrase: options.codephrase,
    dualRelay: true,
    cache: ephemeralCache,
    emitInspector: false,
  });

  const [sendResult] = await Promise.all([sendPromise, recvPromise]);
  return sendResult;
}

/**
 * Runs a REAL 2-stage Folder Manifest Resume demo over /ws-dual:
 * Stage 1: Transfers 50% of chunks into IndexedDB Resume Cache, then disconnects.
 * Stage 2: Adds a brand-new file to the folder, reconnects, skips all cached chunks,
 *          transfers only remaining + new file chunks, and verifies full SHA-256.
 */
export async function runLoopbackFolderResumeDemo(options: {
  codephrase: string;
  onStatus?: (status: string) => void;
  onProgress?: (progress: EnhancedProgress) => void;
}): Promise<{
  stage1CachedChunks: number;
  stage2Result: EnhancedSendResult;
  newFileDetected: string;
}> {
  // Start from a clean Resume Cache so Stage 1 -> disconnect -> Stage 2 Resume is deterministic every click
  await clearResumeCache();
  const stage1Files = buildDemoFolderFiles(false);
  const stage1RoomCode = `${options.codephrase}-s1`;

  options.onStatus?.("Giai đoạn 1/2: Đang truyền 6 chunk đầu rồi mô phỏng đứt mạng đột ngột…");

  const stage1Abort = new AbortController();
  const s1Send = sendEnhancedTransfer({
    files: stage1Files,
    codephrase: stage1RoomCode,
    dualRelay: true,
    chunkSize: 32 * 1024,
    chunkDelayMs: 25,
    emitInspector: true,
    signal: stage1Abort.signal,
  }).catch(() => null);

  await new Promise((r) => setTimeout(r, 70));

  await receiveEnhancedTransfer({
    codephrase: stage1RoomCode,
    dualRelay: true,
    cache: browserIndexedDbCache,
    emitInspector: false,
    stopAfterChunks: 6,
  }).catch(() => {
    stage1Abort.abort();
  });
  stage1Abort.abort();
  await s1Send;

  options.onStatus?.(
    "Giai đoạn 2/2: Đã thêm tệp mới 'PhuLuc_MoiThemSauMatMang.bin' — đang kết nối lại & Resume từ IndexedDB…",
  );
  await new Promise((r) => setTimeout(r, 250));

  const stage2Files = buildDemoFolderFiles(true);
  const stage2RoomCode = `${options.codephrase}-s2`;

  const s2Send = sendEnhancedTransfer({
    files: stage2Files,
    codephrase: stage2RoomCode,
    dualRelay: true,
    chunkSize: 32 * 1024,
    chunkDelayMs: 30,
    emitInspector: true,
    onStatus: options.onStatus,
    onProgress: options.onProgress,
  });

  await new Promise((r) => setTimeout(r, 70));

  const s2Recv = receiveEnhancedTransfer({
    codephrase: stage2RoomCode,
    dualRelay: true,
    cache: browserIndexedDbCache,
    emitInspector: false,
  });

  const [stage2Result] = await Promise.all([s2Send, s2Recv]);
  return {
    stage1CachedChunks: 6,
    stage2Result,
    newFileDetected: "BaoCao_MangMayTinh/PhuLuc_MoiThemSauMatMang.bin",
  };
}
