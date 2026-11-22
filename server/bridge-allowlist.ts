/**
 * Security & Allowlist Gateway for the CrocFlow WebSocket Bridge Server.
 *
 * ## Threat Model & Rationale:
 * Browsers cannot open raw TCP sockets to port 9009 (Croc Relay protocol).
 * Therefore, CrocFlow runs a local Bridge Server that pipes WebSocket frames
 * to remote TCP sockets.
 *
 * If a bridge blindly connects to arbitrary hostnames supplied by clients,
 * it becomes a proxy for Server-Side Request Forgery (SSRF) attacks, enabling
 * attackers to scan internal corporate intranets, access loopback daemons,
 * or steal credentials from AWS/GCP/Azure instance metadata endpoints (169.254.169.254).
 *
 * This module enforces strict zero-trust allowlisting:
 * 1. Resolves targets via server-configured integer indices (`relay=0..3`), never raw client hostnames.
 * 2. Restricts ports strictly to known Croc relay ports (9009-9017).
 * 3. Enforces RFC 1918 and cloud metadata blocklists.
 */

export interface BridgeConfig {
  /** List of approved public or trusted relay hostnames */
  relayHosts: string[];
  /** Approved TCP ports for relay traffic (default: 9009-9017) */
  allowedPorts: string[];
  /** Public relay room authorization password */
  relayPassword: string;
}

/** Official public Croc relays maintained by the upstream Croc project */
export const DEFAULT_PUBLIC_RELAY_HOSTS = [
  "1.getcroc.com",
  "2.getcroc.com",
  "3.getcroc.com",
  "4.getcroc.com",
];

/** Standard port range allocated for Croc multiplexed communication */
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

/** Official public Croc relay pool default passphrase (public protocol constant) */
export const PUBLIC_CROC_DEFAULT_PASS = "pass123";

/**
 * Checks whether an IP address or hostname represents a private, local,
 * or cloud metadata endpoint that must never be proxied to prevent SSRF.
 *
 * Blocked subnets include:
 * - Loopback: 127.0.0.0/8, ::1, localhost
 * - RFC 1918 Private Subnets: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 * - Link-Local / Cloud Metadata: 169.254.0.0/16 (AWS/GCP/Azure instance credentials)
 * - Carrier-Grade NAT (CGNAT): 100.64.0.0/10
 * - IPv6 Unique Local & Link-Local: fc00::/7, fe80::/10
 */
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
    // Loopback (127.x.x.x), Current Network (0.x.x.x), Private Class A (10.x.x.x)
    if (a === 127 || a === 10 || a === 0) return true;
    // Link-local / Cloud Metadata endpoint (169.254.x.x)
    if (a === 169 && b === 254) return true;
    // Private Class B (172.16.x.x - 172.31.x.x)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // Private Class C (192.168.x.x)
    if (a === 192 && b === 168) return true;
    // Carrier-Grade NAT (100.64.x.x - 100.127.x.x)
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) {
    return true;
  }
  return false;
}

/**
 * Validates and normalizes a candidate relay host string.
 * Rejects URI schemes, slashes, query strings, and non-alphanumeric characters.
 */
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

/**
 * Parses environment variables into a validated BridgeConfig.
 * Strips any invalid or private hostnames from `CROC_RELAY_HOSTS`.
 */
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

/**
 * Resolves a client query (`?relay=0&port=9009`) against the server's allowlist.
 * Ensures the client cannot specify arbitrary hosts or ports outside the allowlist.
 */
export function resolveAllowedTarget(
  config: BridgeConfig,
  relayIndexParam: string | null | undefined,
  portParam: string | null | undefined,
): BridgeTargetResult {
  const relayIdxStr = (relayIndexParam ?? "0").trim();
  if (!/^\d+$/.test(relayIdxStr)) {
    return { ok: false, statusCode: 400, error: "Tham số relay phải là số nguyên dương" };
  }
  const idx = Number.parseInt(relayIdxStr, 10);
  if (idx < 0 || idx >= config.relayHosts.length) {
    return {
      ok: false,
      statusCode: 403,
      error: `Chỉ số relay ngoài danh sách cho phép (0..${config.relayHosts.length - 1})`,
    };
  }

  const portStr = (portParam ?? "9009").trim();
  if (!config.allowedPorts.includes(portStr)) {
    return {
      ok: false,
      statusCode: 403,
      error: `Cổng ${portStr} không nằm trong danh sách cổng Croc cho phép`,
    };
  }

  const host = config.relayHosts[idx];
  if (isPrivateOrLoopbackHost(host)) {
    return {
      ok: false,
      statusCode: 403,
      error: "Địa chỉ relay thuộc dải mạng riêng tư/loopback không được phép làm bridge",
    };
  }

  return { ok: true, host, port: Number.parseInt(portStr, 10), relayIndex: idx };
}
