import { bridgeHttpURL, bridgeWsURL, deriveBridgeURL } from "./bridge-origin";

export type RelayProfileMode = "public" | "local-lab" | "local-dual";

export function isLocalLabProfile(profile?: RelayProfileMode | null): boolean {
  return profile === "local-lab" || profile === "local-dual";
}

export interface RelayNodeEntry {
  id: string;
  name: string;
  host: string;
  port: string;
  address: string;
  kind: "public" | "local-alpha" | "local-beta" | "custom";
  publicIndex?: number;
  rttMs: number | null;
  status: "idle" | "probing" | "online" | "offline";
  error?: string;
}

export interface CustomRelayConfig {
  id: string;
  name: string;
  host: string;
  port: string;
  password: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RelayProfileEndpoints {
  profile: RelayProfileMode;
  standardBridgeURL: string;
  enhancedDualURL: string;
  isLocalLab: boolean;
  label: string;
  badgeText: string;
}

export const CUSTOM_RELAYS_KEY = "crocflow-custom-relays-v1";
export const RELAY_PROFILE_KEY = "crocflow-relay-profile-v1";
export const RELAY_LATENCIES_KEY = "crocflow-relay-latencies-v1";

export function loadRelayLatencies(
  storage?: StorageLike | null,
): Record<string, number | null> {
  try {
    const targetStorage =
      storage !== undefined
        ? storage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    const raw = targetStorage?.getItem(RELAY_LATENCIES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRelayLatencies(
  latencies: Record<string, number | null>,
  storage?: StorageLike | null,
): void {
  try {
    const targetStorage =
      storage !== undefined
        ? storage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    targetStorage?.setItem(RELAY_LATENCIES_KEY, JSON.stringify(latencies));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Đo RTT thực tế tới từng Public Croc Relay thông qua endpoint `/api/relays/ping`
 * của Bridge Server, rồi lưu kết quả vào Storage (không bịa giá trị mặc định).
 */
export async function probePublicRelays(
  relayAddresses: string[],
): Promise<Record<string, number | null>> {
  const latencies: Record<string, number | null> = {};
  await Promise.all(
    relayAddresses.map(async (addr, idx) => {
      try {
        const res = await fetch(bridgeHttpURL(`/api/relays/ping?target=public&index=${idx}`), {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { ok: boolean; rttMs: number | null; host?: string };
          if (data.ok && typeof data.rttMs === "number") {
            latencies[addr] = data.rttMs;
            if (data.host) latencies[data.host] = data.rttMs;
            latencies[String(idx)] = data.rttMs;
          }
        }
      } catch {
        // Ignore probe error
      }
    }),
  );
  saveRelayLatencies(latencies);
  return latencies;
}

/**
 * Tách phần host khỏi chuỗi địa chỉ `host:port`.
 * Dùng `lastIndexOf(":")` thay vì `split(":")` để giữ nguyên định dạng nếu host là địa chỉ IPv6.
 */
export function extractRelayHost(address: string): string {
  const lastColon = address.lastIndexOf(":");
  return lastColon > 0 ? address.slice(0, lastColon) : address;
}

/**
 * Tra cứu RTT đo thực tế của Relay Node tại vị trí `idx` trong danh sách `relayAddresses`.
 * Thử lần lượt các khóa có thể có (`addr` đầy đủ -> `host` -> `idx` -> `public-${idx}`) vì
 * kết quả đo có thể được lưu dưới các khóa định danh khác nhau.
 * Chỉ chấp nhận số hữu hạn `>= 0`; trả về `null` nếu chưa đo được, tuyệt đối không dùng giá trị giả.
 */
function lookupRelayRtt(
  latencies: Record<string, number | null>,
  relayAddresses: string[],
  idx: number,
): number | null {
  const addr = relayAddresses[idx];
  const host = addr ? extractRelayHost(addr) : undefined;
  const rtt =
    (addr ? latencies[addr] : undefined) ??
    (host ? latencies[host] : undefined) ??
    latencies[String(idx)] ??
    latencies[`public-${idx}`];
  return typeof rtt === "number" && Number.isFinite(rtt) && rtt >= 0 ? rtt : null;
}

/**
 * Tìm Public Relay Node có RTT đo thực tế thấp nhất để ưu tiên làm kênh chính khi tạo Codephrase.
 * Bỏ qua mọi node có RTT là `null` (chưa đo được); trả về `null` nếu chưa có số liệu đo nào.
 */
export function findFastestRelay(
  latencies: Record<string, number | null>,
  relayAddresses: string[],
): { index: number; host: string; rttMs: number } | null {
  if (!relayAddresses || relayAddresses.length === 0 || !latencies) {
    return null;
  }

  let fastest: { index: number; host: string; rttMs: number } | null = null;

  for (let idx = 0; idx < relayAddresses.length; idx++) {
    const host = extractRelayHost(relayAddresses[idx]);
    const rtt = lookupRelayRtt(latencies, relayAddresses, idx);

    if (rtt !== null && (!fastest || rtt < fastest.rttMs)) {
      fastest = { index: idx, host, rttMs: rtt };
    }
  }

  return fastest;
}

/**
 * Giải quyết cặp RTT thực tế (`alphaRttMs`, `betaRttMs`) cho phiên Dual-Relay Transfer
 * để hiển thị lên Protocol Inspector theo đúng Relay Profile đang chọn:
 * - `Local Dual-Relay Lab`: đọc trực tiếp khóa đo của nút lab Alpha và Beta.
 * - `Public Croc Relays`: tra cứu theo `alphaIndex` và `betaIndex` trong `relayAddresses`.
 * Giữ nguyên `null` khi chưa có phép đo thực tế — không tự cộng/trừ độ trễ giả (synthetic offset)
 * và không thay bằng giá trị ước lượng giả tạo.
 */
export function resolveStreamPairRtts(params: {
  relayProfile: RelayProfileMode;
  latencies: Record<string, number | null>;
  relayAddresses?: string[];
  alphaIndex?: number;
  betaIndex?: number;
}): { alphaRttMs: number | null; betaRttMs: number | null } {
  const { relayProfile, latencies, relayAddresses = [], alphaIndex = 0, betaIndex = 1 } = params;
  if (isLocalLabProfile(relayProfile)) {
    const a = latencies["local-alpha"] ?? latencies["local://relay-alpha"] ?? null;
    const b = latencies["local-beta"] ?? latencies["local://relay-beta"] ?? null;
    return {
      alphaRttMs: typeof a === "number" ? a : null,
      betaRttMs: typeof b === "number" ? b : null,
    };
  }
  return {
    alphaRttMs: lookupRelayRtt(latencies, relayAddresses, alphaIndex),
    betaRttMs: lookupRelayRtt(latencies, relayAddresses, betaIndex),
  };
}

export function loadRelayProfile(storage?: StorageLike | null): RelayProfileMode {
  try {
    const targetStorage =
      storage !== undefined
        ? storage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    const saved = targetStorage?.getItem(RELAY_PROFILE_KEY);
    if (saved === "public" || saved === "local-lab" || saved === "local-dual") return saved;
  } catch {
    // Ignore storage read errors
  }
  return "public";
}

export function saveRelayProfile(
  mode: RelayProfileMode,
  storage?: StorageLike | null,
): void {
  try {
    const targetStorage =
      storage !== undefined
        ? storage
        : typeof localStorage !== "undefined"
          ? localStorage
          : null;
    targetStorage?.setItem(RELAY_PROFILE_KEY, mode);
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Trả về cấu hình endpoint của Bridge Server tương ứng với Relay Profile:
 * - `Public Croc Relays`: dùng `/ws` để tunnel tới Public Croc Relay TCP.
 * - `Local Dual-Relay Lab`: dùng `/ws-dual` cho phòng lab 2 Relay cục bộ.
 */
export function getRelayProfileEndpoints(
  profile: RelayProfileMode,
  protocol?: string,
  host?: string,
): RelayProfileEndpoints {
  const isLocalLab = profile === "local-lab" || profile === "local-dual";
  // Explicit protocol/host (tests, callers) win; otherwise resolve via the Bridge Server origin.
  const explicit = protocol !== undefined && host !== undefined;
  return {
    profile,
    standardBridgeURL: explicit ? deriveBridgeURL(protocol, host, "/ws") : bridgeWsURL("/ws"),
    enhancedDualURL: explicit ? deriveBridgeURL(protocol, host, "/ws-dual") : bridgeWsURL("/ws-dual"),
    isLocalLab,
    label: isLocalLab ? "Local Lab" : "Public Relays",
    badgeText: isLocalLab
      ? "Local Dual-Relay Lab (Offline/LAN)"
      : "Public Croc Relays",
  };
}

export function loadCustomRelays(): CustomRelayConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_RELAYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomRelayConfig[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomRelays(relays: CustomRelayConfig[]): void {
  try {
    localStorage.setItem(CUSTOM_RELAYS_KEY, JSON.stringify(relays));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Đo RTT đơn lẻ tới một Relay Node (cục bộ hoặc công cộng đã allowlist).
 * Custom relay không thể probe trực tiếp qua Bridge Server công cộng để bảo vệ chống SSRF.
 */
export async function pingRelayNode(node: RelayNodeEntry): Promise<{
  ok: boolean;
  rttMs: number | null;
  error?: string;
}> {
  if (node.kind === "local-alpha" || node.kind === "local-beta") {
    const target = node.kind === "local-alpha" ? "alpha" : "beta";
    const started = performance.now();
    const res = await fetch(bridgeHttpURL(`/api/relays/ping?target=${target}`), { cache: "no-store" });
    if (!res.ok) return { ok: false, rttMs: null, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { ok: boolean; rttMs: number | null };
    const totalRtt = Math.round((performance.now() - started) * 10) / 10;
    return { ok: data.ok, rttMs: data.ok ? Math.min(totalRtt, data.rttMs ?? totalRtt) : null };
  }

  if (node.kind === "public" && typeof node.publicIndex === "number") {
    const res = await fetch(bridgeHttpURL(`/api/relays/ping?target=public&index=${node.publicIndex}`), {
      cache: "no-store",
    });
    const data = (await res.json()) as { ok: boolean; rttMs: number | null; error?: string };
    return { ok: Boolean(data.ok), rttMs: data.rttMs, error: data.error };
  }

  // Custom relays cannot be probed directly through the allowlisted public bridge (SSRF protection)
  return {
    ok: false,
    rttMs: null,
    error: "Relay tùy chỉnh cần thêm vào CROC_RELAY_HOSTS của Bridge Server để đo TCP trực tiếp",
  };
}

export function rankRelaysByLatency(nodes: RelayNodeEntry[]): RelayNodeEntry[] {
  return [...nodes].sort((a, b) => {
    const aOnline = a.status === "online" && a.rttMs !== null;
    const bOnline = b.status === "online" && b.rttMs !== null;
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    if (aOnline && bOnline) return (a.rttMs ?? Infinity) - (b.rttMs ?? Infinity);
    return a.name.localeCompare(b.name);
  });
}
