export type ProtocolEventKind =
  | "session"
  | "relay"
  | "pake"
  | "manifest"
  | "chunk"
  | "resume"
  | "failover"
  | "complete"
  | "error";

export type ChunkVisualState =
  | "pending"
  | "alpha"
  | "beta"
  | "verified"
  | "resumed"
  | "failover";

export interface ProtocolEvent {
  id: string;
  timestamp: number;
  kind: ProtocolEventKind;
  mode: "standard" | "enhanced";
  title: string;
  detail: string;
  relay?: "public" | "alpha" | "beta";
  chunkIndex?: number;
  bytes?: number;
}

export interface ThroughputSample {
  timestamp: number;
  bytesPerSecond: number;
}

export interface InspectorSnapshot {
  sessionId: string | null;
  mode: "standard" | "enhanced" | null;
  direction: "send" | "receive" | null;
  active: boolean;
  events: ProtocolEvent[];
  pakeSteps: Array<{
    step: string;
    label: string;
    status: "pending" | "active" | "done" | "error";
    timestamp?: number;
  }>;
  chunkStates: ChunkVisualState[];
  totalChunks: number;
  alphaChunks: number;
  betaChunks: number;
  resumedChunks: number;
  failoverChunks: number;
  verifiedChunks: number;
  bytesTransferred: number;
  totalBytes: number;
  currentSpeedBps: number;
  throughputHistory: ThroughputSample[];
}

type Listener = (snapshot: InspectorSnapshot) => void;

const DEFAULT_PAKE_STEPS: InspectorSnapshot["pakeSteps"] = [
  { step: "room", label: "Kết nối phòng Relay (Room Join)", status: "pending" },
  { step: "pake", label: "Trao đổi khóa PAKE (P-256 / ECDH)", status: "pending" },
  { step: "hkdf", label: "Sinh khóa phiên HKDF-SHA-256", status: "pending" },
  { step: "confirm", label: "Xác thực mật khẩu 2 chiều", status: "pending" },
  { step: "stream", label: "Truyền luồng mã hóa AES-256-GCM", status: "pending" },
];

function createEmptySnapshot(): InspectorSnapshot {
  return {
    sessionId: null,
    mode: null,
    direction: null,
    active: false,
    events: [],
    pakeSteps: DEFAULT_PAKE_STEPS.map((s) => ({ ...s })),
    chunkStates: [],
    totalChunks: 0,
    alphaChunks: 0,
    betaChunks: 0,
    resumedChunks: 0,
    failoverChunks: 0,
    verifiedChunks: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    currentSpeedBps: 0,
    throughputHistory: [],
  };
}

class ProtocolEventBus {
  private state: InspectorSnapshot = createEmptySnapshot();
  private listeners = new Set<Listener>();
  private seq = 0;

  getSnapshot(): InspectorSnapshot {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const next = { ...this.state };
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  startSession(params: {
    sessionId: string;
    mode: "standard" | "enhanced";
    direction: "send" | "receive";
    totalBytes?: number;
    totalChunks?: number;
  }) {
    const chunkCount = Math.min(params.totalChunks ?? 0, 512);
    this.state = {
      ...createEmptySnapshot(),
      sessionId: params.sessionId,
      mode: params.mode,
      direction: params.direction,
      active: true,
      totalBytes: params.totalBytes ?? 0,
      totalChunks: params.totalChunks ?? 0,
      chunkStates: Array.from({ length: chunkCount }, () => "pending"),
    };
    this.logEvent({
      kind: "session",
      mode: params.mode,
      title: params.direction === "send" ? "Khởi tạo phiên Gửi" : "Khởi tạo phiên Nhận",
      detail: `Chế độ ${params.mode === "standard" ? "Chuẩn Croc v11" : "Nâng cao Manifest/Dual-Relay"}`,
    });
  }

  setPakeStep(step: string, status: "active" | "done" | "error") {
    const now = Date.now();
    this.state.pakeSteps = this.state.pakeSteps.map((item) =>
      item.step === step ? { ...item, status, timestamp: now } : item,
    );
    this.emit();
  }

  initChunks(totalChunks: number, totalBytes: number) {
    const displayCount = Math.min(totalChunks, 512);
    this.state.totalChunks = totalChunks;
    this.state.totalBytes = totalBytes;
    this.state.chunkStates = Array.from({ length: displayCount }, () => "pending");
    this.state.alphaChunks = 0;
    this.state.betaChunks = 0;
    this.state.resumedChunks = 0;
    this.state.failoverChunks = 0;
    this.state.verifiedChunks = 0;
    this.emit();
  }

  updateChunkState(index: number, nextState: ChunkVisualState, trackRoute?: "alpha" | "beta" | "resumed" | "failover") {
    if (index >= 0 && index < this.state.chunkStates.length) {
      const updated = this.state.chunkStates.slice();
      updated[index] = nextState;
      this.state.chunkStates = updated;
    }
    if (trackRoute === "alpha") this.state.alphaChunks += 1;
    if (trackRoute === "beta") this.state.betaChunks += 1;
    if (trackRoute === "resumed") this.state.resumedChunks += 1;
    if (trackRoute === "failover") this.state.failoverChunks += 1;
    if (nextState === "verified" || nextState === "resumed") {
      this.state.verifiedChunks += 1;
    }
    this.emit();
  }

  recordThroughput(bytesTransferred: number, totalBytes: number, bytesPerSecond: number) {
    this.state.bytesTransferred = bytesTransferred;
    if (totalBytes > 0) this.state.totalBytes = totalBytes;
    this.state.currentSpeedBps = Math.max(0, Math.round(bytesPerSecond));
    const sample: ThroughputSample = {
      timestamp: Date.now(),
      bytesPerSecond: this.state.currentSpeedBps,
    };
    this.state.throughputHistory = [...this.state.throughputHistory.slice(-29), sample];
    this.emit();
  }

  logEvent(event: Omit<ProtocolEvent, "id" | "timestamp">) {
    const entry: ProtocolEvent = {
      ...event,
      id: `evt-${++this.seq}`,
      timestamp: Date.now(),
    };
    this.state.events = [entry, ...this.state.events].slice(0, 120);
    this.emit();
  }

  finishSession(success: boolean, detail: string) {
    this.state.active = false;
    this.logEvent({
      kind: success ? "complete" : "error",
      mode: this.state.mode ?? "standard",
      title: success ? "Hoàn tất Transfer Session" : "Phiên kết thúc có lỗi",
      detail,
    });
  }

  reset() {
    this.state = createEmptySnapshot();
    this.emit();
  }
}

export const protocolEventBus = new ProtocolEventBus();
