export interface BridgeConfig {
  relayHosts: string[];
  allowedPorts: string[];
  relayPassword: string;
}

export const DEFAULT_PUBLIC_RELAY_HOSTS = [
  "1.getcroc.com",
  "2.getcroc.com",
  "3.getcroc.com",
  "4.getcroc.com",
];

export const DEFAULT_ALLOWED_PORTS = [
  "9009",
  "9010",
  "9011",
  "9012",
  "9013",
  "9014",
  "9015",
  "9016",
  "9017",
];

// Official public Croc relay pool default passphrase (public protocol constant)
export const PUBLIC_CROC_DEFAULT_PASS = "pass123";

export function isPrivateOrLoopbackHost(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) {
    return true;
  }
  return false;
}

export function sanitizeRelayHost(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("://") || /[/?#\s]/.test(trimmed)) {
    return null;
  }
  // Strip optional :port suffix for IPv4/domain
  const hostOnly = trimmed.includes(":") && !trimmed.startsWith("[")
    ? trimmed.split(":")[0]
    : trimmed.replace(/^\[|\]$/g, "");
  if (!hostOnly || !/^[a-zA-Z0-9.-]+$/.test(hostOnly)) {
    return null;
  }
  return hostOnly;
}

export function parseBridgeConfig(
  env: Record<string, string | undefined> = process.env,
): BridgeConfig {
  const rawHosts = (env.CROC_RELAY_HOSTS || "")
    .split(",")
    .map((h) => sanitizeRelayHost(h))
    .filter((h): h is string => Boolean(h) && !isPrivateOrLoopbackHost(h!));

  const relayHosts = rawHosts.length > 0 ? Array.from(new Set(rawHosts)) : [...DEFAULT_PUBLIC_RELAY_HOSTS];

  const rawPorts = (env.CROC_ALLOWED_PORTS || "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => /^\d{1,5}$/.test(p) && Number(p) >= 1 && Number(p) <= 65535);

  const allowedPorts = rawPorts.length > 0 ? Array.from(new Set(rawPorts)) : [...DEFAULT_ALLOWED_PORTS];

  const relayPassword = (env.CROC_RELAY_PASSWORD || "").trim() || PUBLIC_CROC_DEFAULT_PASS;

  return { relayHosts, allowedPorts, relayPassword };
}

export type BridgeTargetResult =
  | { ok: true; host: string; port: number; relayIndex: number }
  | { ok: false; statusCode: 400 | 403; error: string };

export function resolveAllowedTarget(
  config: BridgeConfig,
  relayIndexParam: string | null | undefined,
  portParam: string | null | undefined,
): BridgeTargetResult {
  const rawIdx = (relayIndexParam ?? "").trim();
  const rawPort = (portParam ?? "").trim();

  if (!/^\d+$/.test(rawIdx)) {
    return { ok: false, statusCode: 400, error: "Invalid relay index parameter" };
  }
  const relayIndex = Number(rawIdx);
  if (!Number.isSafeInteger(relayIndex) || relayIndex < 0 || relayIndex >= config.relayHosts.length) {
    return { ok: false, statusCode: 403, error: "Relay index is not in the server allowlist" };
  }

  if (!/^\d{1,5}$/.test(rawPort) || !config.allowedPorts.includes(rawPort)) {
    return { ok: false, statusCode: 403, error: "Relay port is not in the server allowlist" };
  }

  const host = config.relayHosts[relayIndex];
  if (isPrivateOrLoopbackHost(host)) {
    return { ok: false, statusCode: 403, error: "Private or loopback relay host is forbidden" };
  }

  return { ok: true, host, port: Number(rawPort), relayIndex };
}
