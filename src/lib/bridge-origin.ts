/**
 * Bridge Server origin resolution.
 *
 * When the web app is served by `server.ts` (the default), every Bridge Server
 * call stays same-origin and URLs resolve exactly as before. When the app runs
 * from static assets with no Bridge Server behind it (the Capacitor Android
 * APK, or any static build), the user saves the origin of a CrocFlow Bridge
 * Server on the LAN (e.g. `http://192.168.1.10:3000`) and every HTTP and
 * WebSocket URL is built against that origin instead.
 */

export const BRIDGE_ORIGIN_KEY = "crocflow-bridge-origin-v1";

export interface BridgeOriginStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BridgeLocation {
  protocol: string;
  host: string;
  origin?: string;
}

export interface BridgeOriginEnv {
  storage?: BridgeOriginStorage | null;
  location?: BridgeLocation | null;
  native?: boolean;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
}

const NATIVE_SHELL_PROTOCOLS = new Set(["capacitor:", "ionic:", "file:"]);

/**
 * Derives the WebSocket bridge URL given a protocol, host, and optional path.
 * Normalizes http(s): and ws(s): schemes and ensures a clean URL.
 */
export function deriveBridgeURL(protocol: string, host: string, path = "/ws"): string {
  const isSecure =
    protocol.startsWith("https") || protocol.startsWith("wss") || protocol === "wss:";
  const wsProto = isSecure ? "wss:" : "ws:";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const cleanHost = host.replace(/\/+$/, "");
  return `${wsProto}//${cleanHost}${cleanPath}`;
}

/**
 * Normalizes user input such as `192.168.1.10:3000`, `http://pc.local:3000/`
 * or `https://crocflow.example.com/some/path` into a bare `scheme://host[:port]`
 * origin. Only http: and https: are accepted. Returns null for invalid input.
 */
export function normalizeBridgeOrigin(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname || parsed.username || parsed.password) return null;
  return parsed.origin;
}

function defaultStorage(): BridgeOriginStorage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function defaultLocation(): BridgeLocation | null {
  return typeof window !== "undefined" && window.location ? window.location : null;
}

/**
 * True when the app runs inside a native shell (Capacitor WebView) where no
 * Bridge Server serves the page. Uses the `window.Capacitor` global injected by
 * the native bridge, so no @capacitor package dependency is needed.
 */
export function isNativeShell(
  win: { Capacitor?: CapacitorLike; location?: BridgeLocation } | undefined = typeof window !==
  "undefined"
    ? (window as unknown as { Capacitor?: CapacitorLike; location?: BridgeLocation })
    : undefined,
): boolean {
  if (!win) return false;
  try {
    if (win.Capacitor?.isNativePlatform?.() === true) return true;
  } catch {
    // Ignore a broken Capacitor global
  }
  const protocol = win.location?.protocol ?? "";
  return NATIVE_SHELL_PROTOCOLS.has(protocol);
}

export function loadSavedBridgeOrigin(
  storage: BridgeOriginStorage | null | undefined = defaultStorage(),
): string | null {
  try {
    return normalizeBridgeOrigin(storage?.getItem(BRIDGE_ORIGIN_KEY));
  } catch {
    return null;
  }
}

/** Saves a normalized origin. Returns the stored origin, or null if the input is invalid. */
export function saveBridgeOrigin(
  input: string,
  storage: BridgeOriginStorage | null | undefined = defaultStorage(),
): string | null {
  const origin = normalizeBridgeOrigin(input);
  if (!origin) return null;
  try {
    storage?.setItem(BRIDGE_ORIGIN_KEY, origin);
  } catch {
    // Ignore storage write errors
  }
  return origin;
}

export function clearBridgeOrigin(
  storage: BridgeOriginStorage | null | undefined = defaultStorage(),
): void {
  try {
    storage?.removeItem(BRIDGE_ORIGIN_KEY);
  } catch {
    // Ignore storage write errors
  }
}

function resolveEnv(env: BridgeOriginEnv = {}) {
  const storage = env.storage !== undefined ? env.storage : defaultStorage();
  const location = env.location !== undefined ? env.location : defaultLocation();
  const native = env.native ?? isNativeShell();
  return { saved: loadSavedBridgeOrigin(storage), location, native };
}

/**
 * Resolves the Bridge Server origin: the saved value if present, otherwise the
 * page's own origin when it is a normal http(s) page served by the Bridge
 * Server. Returns null inside a native shell with nothing saved.
 */
export function resolveBridgeOrigin(env?: BridgeOriginEnv): string | null {
  const { saved, location, native } = resolveEnv(env);
  if (saved) return saved;
  if (native || !location) return null;
  if (location.protocol !== "http:" && location.protocol !== "https:") return null;
  return location.origin ?? `${location.protocol}//${location.host}`;
}

/** True when running natively with no Bridge Server origin configured. */
export function needsBridgeOrigin(env?: BridgeOriginEnv): boolean {
  const { saved, native } = resolveEnv(env);
  return native && !saved;
}

/**
 * Builds an HTTP URL for a Bridge Server path. With no saved origin the path
 * stays relative (same-origin), exactly as the web app always resolved it.
 */
export function bridgeHttpURL(path: string, env?: BridgeOriginEnv): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const { saved } = resolveEnv(env);
  return saved ? `${saved}${cleanPath}` : cleanPath;
}

/**
 * Builds a ws:// or wss:// URL for a Bridge Server path (`/ws`, `/ws-dual`).
 * With no saved origin it derives from the page location, exactly as before.
 */
export function bridgeWsURL(path: string, env?: BridgeOriginEnv): string {
  const { saved, location } = resolveEnv(env);
  if (saved) {
    const url = new URL(saved);
    return deriveBridgeURL(url.protocol, url.host, path);
  }
  return deriveBridgeURL(location?.protocol ?? "http:", location?.host ?? "localhost:3000", path);
}

/** Origin used for shareable receive links: the Bridge Server when known, else the page. */
export function shareLinkOrigin(env?: BridgeOriginEnv): string {
  const resolved = resolveBridgeOrigin(env);
  if (resolved) return resolved;
  const { location } = resolveEnv(env);
  return location?.origin ?? "";
}
