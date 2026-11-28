const PUBLIC_CROC_HOSTS = new Set([
  "1.getcroc.com",
  "2.getcroc.com",
  "3.getcroc.com",
  "4.getcroc.com",
]);
const MIN_CROC_PORT = 9009;
const MAX_CROC_PORT = 9017;

interface NativeTcpBridge {
  connect(connectionId: string, host: string, port: number): void;
  send(connectionId: string, base64Data: string): void;
  close(connectionId: string): void;
}

interface NativeTcpEvent {
  connectionId: string;
  type: "open" | "data" | "error" | "close";
  data?: string;
  error?: string;
}

declare global {
  interface Window {
    CrocDirectTcp?: NativeTcpBridge;
    __crocDirectTcpEvent?: (eventJson: string) => void;
  }
}

const sockets = new Map<string, NativeTcpWebSocket>();
let connectionSequence = 0;

function installNativeEventHandler(): boolean {
  if (typeof window === "undefined" || !window.CrocDirectTcp) return false;
  window.__crocDirectTcpEvent = (eventJson) => {
    let event: NativeTcpEvent;
    try {
      event = JSON.parse(eventJson) as NativeTcpEvent;
    } catch {
      return;
    }
    sockets.get(event.connectionId)?.handleNativeEvent(event);
  };
  return true;
}

export function hasNativeDirectTcp(): boolean {
  return installNativeEventHandler();
}

function parsePublicRelay(address: string, portOverride?: string): { host: string; port: number } {
  const match = /^([a-z0-9.-]+)(?::(\d+))?$/i.exec(address.trim());
  if (!match) throw new Error("Invalid public Croc Relay address");
  const host = match[1].toLowerCase();
  const port = Number(portOverride ?? match[2] ?? MIN_CROC_PORT);
  if (!PUBLIC_CROC_HOSTS.has(host)) throw new Error("Android direct mode supports the official public Croc Relays");
  if (!Number.isInteger(port) || port < MIN_CROC_PORT || port > MAX_CROC_PORT) {
    throw new Error(`Croc Relay port must be between ${MIN_CROC_PORT} and ${MAX_CROC_PORT}`);
  }
  return { host, port };
}

function toBase64(data: ArrayBuffer | ArrayBufferView): string {
  const bytes = data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  let binary = "";
  const stride = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += stride) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + stride, bytes.length)));
  }
  return btoa(binary);
}

function fromBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

/** WebSocket-shaped adapter so CrocSocket can keep its stream framing unchanged. */
class NativeTcpWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly id: string;
  readonly host: string;
  readonly port: number;
  binaryType: BinaryType = "arraybuffer";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  url: string;
  readyState = NativeTcpWebSocket.CONNECTING;
  private closeEmitted = false;

  constructor(host: string, port: number) {
    super();
    this.host = host;
    this.port = port;
    this.id = `croc-${Date.now()}-${++connectionSequence}`;
    this.url = `tcp://${host}:${port}`;
    sockets.set(this.id, this);
  }

  open(): void {
    const bridge = window.CrocDirectTcp;
    if (!bridge || !installNativeEventHandler()) {
      this.fail("Android direct TCP bridge is unavailable");
      return;
    }
    try {
      bridge.connect(this.id, this.host, this.port);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error));
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState !== NativeTcpWebSocket.OPEN) {
      throw new Error("Relay connection is not open");
    }
    if (typeof data === "string" || data instanceof Blob) {
      throw new Error("Croc Relay transport accepts binary data only");
    }
    window.CrocDirectTcp?.send(this.id, toBase64(data as ArrayBuffer | ArrayBufferView));
  }

  close(): void {
    if (this.readyState === NativeTcpWebSocket.CLOSED || this.closeEmitted) return;
    this.readyState = NativeTcpWebSocket.CLOSING;
    window.CrocDirectTcp?.close(this.id);
    this.finishClose();
  }

  handleNativeEvent(event: NativeTcpEvent): void {
    if (event.type === "open") {
      if (this.readyState !== NativeTcpWebSocket.CONNECTING) return;
      this.readyState = NativeTcpWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
      return;
    }
    if (event.type === "data") {
      if (this.readyState === NativeTcpWebSocket.OPEN && event.data) {
        this.dispatchEvent(new MessageEvent("message", { data: fromBase64(event.data) }));
      }
      return;
    }
    if (event.type === "error") {
      this.dispatchEvent(new ErrorEvent("error", { message: event.error ?? "Relay connection failed" }));
      return;
    }
    this.finishClose();
  }

  private fail(message: string): void {
    this.dispatchEvent(new ErrorEvent("error", { message }));
    this.finishClose();
  }

  private finishClose(): void {
    if (this.closeEmitted) return;
    this.closeEmitted = true;
    this.readyState = NativeTcpWebSocket.CLOSED;
    sockets.delete(this.id);
    this.dispatchEvent(new CloseEvent("close"));
  }
}

export function connectNativeRelaySocket(address: string, port: string): WebSocket {
  if (!installNativeEventHandler()) throw new Error("Android direct TCP bridge is unavailable");
  const target = parsePublicRelay(address, port);
  const socket = new NativeTcpWebSocket(target.host, target.port);
  queueMicrotask(() => socket.open());
  return socket as unknown as WebSocket;
}

export async function probeNativeRelay(address: string, timeoutMs = 3_000): Promise<number> {
  const target = parsePublicRelay(address);
  const started = performance.now();
  const socket = connectNativeRelaySocket(target.host, String(target.port));
  let timeout = 0;
  let onOpen: EventListener | undefined;
  let onError: EventListener | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timeout = window.setTimeout(() => reject(new Error("Relay connection timed out")), timeoutMs);
      onOpen = () => resolve();
      onError = () => reject(new Error("Could not connect to the public Croc Relay"));
      socket.addEventListener("open", onOpen, { once: true });
      socket.addEventListener("error", onError, { once: true });
    });
    return performance.now() - started;
  } finally {
    window.clearTimeout(timeout);
    if (onOpen) socket.removeEventListener("open", onOpen);
    if (onError) socket.removeEventListener("error", onError);
    socket.close();
  }
}
