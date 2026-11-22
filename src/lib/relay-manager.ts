export type RelayProfileMode = "public" | "local-dual";

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

const CUSTOM_RELAYS_KEY = "crocflow-custom-relays-v1";
const RELAY_PROFILE_KEY = "crocflow-relay-profile-v1";

export function loadRelayProfile(): RelayProfileMode {
  try {
    const saved = localStorage.getItem(RELAY_PROFILE_KEY);
    if (saved === "public" || saved === "local-dual") return saved;
  } catch {
    // Ignore storage read errors
  }
  return "public";
}

export function saveRelayProfile(mode: RelayProfileMode): void {
  try {
    localStorage.setItem(RELAY_PROFILE_KEY, mode);
  } catch {
    // Ignore storage write errors
  }
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
    const res = await fetch(`/api/relays/ping?target=${target}`, { cache: "no-store" });
    if (!res.ok) return { ok: false, rttMs: null, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { ok: boolean; rttMs: number | null };
    const totalRtt = Math.round((performance.now() - started) * 10) / 10;
    return { ok: data.ok, rttMs: data.ok ? Math.min(totalRtt, data.rttMs ?? totalRtt) : null };
  }

  if (node.kind === "public" && typeof node.publicIndex === "number") {
    const res = await fetch(`/api/relays/ping?target=public&index=${node.publicIndex}`, {
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
