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

export function findFastestRelay(
  latencies: Record<string, number | null>,
  relayAddresses: string[],
): { index: number; host: string; rttMs: number } | null {
  if (!relayAddresses || relayAddresses.length === 0 || !latencies) {
    return null;
  }

  let fastest: { index: number; host: string; rttMs: number } | null = null;

  for (let idx = 0; idx < relayAddresses.length; idx++) {
    const addr = relayAddresses[idx];
    const lastColon = addr.lastIndexOf(":");
    const host = lastColon > 0 ? addr.slice(0, lastColon) : addr;

    const rtt =
      latencies[addr] ??
      latencies[host] ??
      latencies[String(idx)] ??
      latencies[`public-${idx}`];

    if (typeof rtt === "number" && Number.isFinite(rtt) && rtt >= 0) {
      if (!fastest || rtt < fastest.rttMs) {
        fastest = { index: idx, host, rttMs: rtt };
      }
    }
  }

  return fastest;
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
