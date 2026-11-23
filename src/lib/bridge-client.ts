import { bridgeHttpURL, deriveBridgeURL, loadSavedBridgeOrigin } from "./bridge-origin";

export interface PublicRelayInfo {
  index: number;
  id: string;
  name: string;
  host: string;
  port: string;
  address: string;
  kind: "public";
}

export interface LocalRelayChannelMetrics {
  online: boolean;
  activeRooms: number;
  activeConnections: number;
  bytesRelayed: number;
  chunksRelayed: number;
}

export interface BridgeStatusResponse {
  publicRelays: PublicRelayInfo[];
  localDualRelay: {
    alpha: LocalRelayChannelMetrics;
    beta: LocalRelayChannelMetrics;
  };
  allowedPorts: string[];
}

export type RelayClusterStatus = BridgeStatusResponse;

export interface BridgePublicConfig {
  relayAddresses: string[];
  relayPassword: string;
}

export { deriveBridgeURL };

export function extractBridgePublicConfig(status: BridgeStatusResponse | null): BridgePublicConfig | null {
  const runtimeCfg =
    typeof window !== "undefined"
      ? (window as unknown as {
          __CROC_RUNTIME_CONFIG__?: { relayAddresses?: string[]; relayPassword?: string };
        }).__CROC_RUNTIME_CONFIG__
      : undefined;

  if (runtimeCfg?.relayAddresses && runtimeCfg.relayAddresses.length > 0) {
    return {
      relayAddresses: runtimeCfg.relayAddresses,
      relayPassword: runtimeCfg.relayPassword ?? "pass123",
    };
  }
  if (!status) return null;
  return {
    relayAddresses: status.publicRelays.map((r) => r.address),
    relayPassword: "pass123",
  };
}

export async function fetchBridgeHealth(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(bridgeHttpURL("/healthz"), { cache: "no-store", signal });
  if (!response.ok) return false;
  const text = (await response.text()).trim();
  return text === "ok";
}

export async function fetchBridgeStatus(signal?: AbortSignal): Promise<BridgeStatusResponse> {
  const response = await fetch(bridgeHttpURL("/api/relays/status"), { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error(`Bridge Server trả về mã lỗi HTTP ${response.status}`);
  }
  return (await response.json()) as BridgeStatusResponse;
}

export interface CrocRuntimeConfigPayload {
  bridgeURL?: string;
  localDualRelayURL?: string;
  relayAddresses?: string[];
  relayPassword?: string;
}

let runtimeConfigFetchedFrom: string | null = null;

/**
 * Makes sure `window.__CROC_RUNTIME_CONFIG__` matches the active Bridge Server.
 * Served by the Bridge Server with no saved origin, `/config.js` already set it
 * and nothing changes. With a saved origin (native APK or static build), the
 * same object is fetched from `GET /api/runtime-config` on that origin; on
 * failure the existing defaults (relay list from `/api/relays/status`) apply.
 */
export async function ensureRuntimeConfig(signal?: AbortSignal): Promise<void> {
  if (typeof window === "undefined") return;
  const saved = loadSavedBridgeOrigin();
  if (!saved) {
    if (runtimeConfigFetchedFrom) {
      // The saved origin was cleared: drop the config fetched from it.
      delete window.__CROC_RUNTIME_CONFIG__;
      runtimeConfigFetchedFrom = null;
    }
    return;
  }
  if (runtimeConfigFetchedFrom === saved && window.__CROC_RUNTIME_CONFIG__) return;
  try {
    const response = await fetch(bridgeHttpURL("/api/runtime-config"), { cache: "no-store", signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    window.__CROC_RUNTIME_CONFIG__ = (await response.json()) as CrocRuntimeConfigPayload;
    runtimeConfigFetchedFrom = saved;
  } catch {
    if (signal?.aborted) return;
    // A config.js from another server must not leak relay lists into this origin.
    delete window.__CROC_RUNTIME_CONFIG__;
    runtimeConfigFetchedFrom = null;
  }
}
