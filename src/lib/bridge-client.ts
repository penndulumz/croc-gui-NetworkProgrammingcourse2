import {
  bridgeHttpURL,
  configuredBridgeOrigin,
  deriveBridgeURL,
  needsBridgeOrigin,
} from "./bridge-origin";
import { hasNativeDirectTcp } from "../protocol/croc/native-tcp";

export const DEFAULT_PUBLIC_RELAY_ADDRESSES = [
  "1.getcroc.com:9009",
  "2.getcroc.com:9009",
  "3.getcroc.com:9009",
  "4.getcroc.com:9009",
];

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

/** Explains the common reasons the public relay list is unavailable. */
export function publicRelayUnavailableMessage(locale: "vi" | "en" = "vi"): string {
  if (needsBridgeOrigin()) {
    return locale === "vi"
      ? "APK không tích hợp Bridge Server. Hãy mở tab Relay, nhập địa chỉ máy tính đang chạy CrocFlow trong cùng mạng (ví dụ http://192.168.1.10:3000), kiểm tra rồi lưu."
      : "The APK does not include a Bridge Server. Open the Relays tab, enter the address of a computer running CrocFlow on the same network (for example, http://192.168.1.10:3000), test it, and save it.";
  }

  const origin = configuredBridgeOrigin();
  if (origin) {
    return locale === "vi"
      ? `Không tải được danh sách Relay từ ${origin}. Hãy kiểm tra Bridge Server đang chạy và địa chỉ này truy cập được qua mạng hiện tại, sau đó thử lại trong tab Relay.`
      : `Could not load the relay list from ${origin}. Check that the Bridge Server is running and reachable over the current network, then retry from the Relays tab.`;
  }

  return locale === "vi"
    ? "Bridge Server chưa trả về danh sách Relay công cộng. Hãy kiểm tra kết nối trong tab Relay rồi thử lại."
    : "The Bridge Server did not provide a public relay list. Check the connection in the Relays tab and try again.";
}

export function extractBridgePublicConfig(status: BridgeStatusResponse | null): BridgePublicConfig | null {
  // The Android APK can open native TCP sockets to the official Croc relays,
  // so its public profile does not depend on a Bridge Server configuration.
  if (hasNativeDirectTcp()) {
    return {
      relayAddresses: [...DEFAULT_PUBLIC_RELAY_ADDRESSES],
      relayPassword: "pass123",
    };
  }

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
 * With a build default or device override (native APK or static build), fetches
 * `GET /api/runtime-config` from that origin. Without one, the page keeps its
 * same-origin behavior and `/api/relays/status` supplies the relay list.
 */
export async function ensureRuntimeConfig(signal?: AbortSignal): Promise<void> {
  if (typeof window === "undefined") return;
  const origin = configuredBridgeOrigin();
  if (!origin) {
    if (runtimeConfigFetchedFrom) {
      // The configured origin was cleared: drop the config fetched from it.
      delete window.__CROC_RUNTIME_CONFIG__;
      runtimeConfigFetchedFrom = null;
    }
    return;
  }
  if (runtimeConfigFetchedFrom === origin && window.__CROC_RUNTIME_CONFIG__) return;
  try {
    const response = await fetch(`${origin}/api/runtime-config`, { cache: "no-store", signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    window.__CROC_RUNTIME_CONFIG__ = (await response.json()) as CrocRuntimeConfigPayload;
    runtimeConfigFetchedFrom = origin;
  } catch {
    if (signal?.aborted) return;
    // A config.js from another server must not leak relay lists into this origin.
    delete window.__CROC_RUNTIME_CONFIG__;
    runtimeConfigFetchedFrom = null;
  }
}
