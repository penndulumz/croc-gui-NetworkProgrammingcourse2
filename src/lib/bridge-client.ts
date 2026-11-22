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
  packetsRelayed: number;
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
  const response = await fetch("/healthz", { cache: "no-store", signal });
  if (!response.ok) return false;
  const text = (await response.text()).trim();
  return text === "ok";
}

export async function fetchBridgeStatus(signal?: AbortSignal): Promise<BridgeStatusResponse> {
  const response = await fetch("/api/relays/status", { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error(`Bridge Server trả về mã lỗi HTTP ${response.status}`);
  }
  return (await response.json()) as BridgeStatusResponse;
}
