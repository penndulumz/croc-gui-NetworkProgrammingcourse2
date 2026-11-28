import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Globe,
  Link2,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
import type { BridgePublicConfig, RelayClusterStatus } from "../lib/bridge-client";
import {
  loadCustomRelays,
  pingRelayNode,
  rankRelaysByLatency,
  saveCustomRelays,
  saveRelayLatencies,
  type CustomRelayConfig,
  type RelayNodeEntry,
  type RelayProfileMode,
} from "../lib/relay-manager";
import {
  clearBridgeOrigin,
  configuredBridgeOrigin,
  loadSavedBridgeOrigin,
  needsBridgeOrigin,
  normalizeBridgeOrigin,
  resolveBridgeOrigin,
  saveBridgeOrigin,
} from "../lib/bridge-origin";
import { formatBytes } from "../lib/format";
import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";
import { hasNativeDirectTcp } from "../protocol/croc/native-tcp";

export interface RelaysViewProps {
  bridgeConfig: BridgePublicConfig | null;
  relayStatus: RelayClusterStatus | null;
  relayProfile: RelayProfileMode;
  onChangeRelayProfile: (mode: RelayProfileMode) => void;
  onRefreshStatus: () => void;
  onBridgeOriginChanged?: () => void;
  locale?: Locale;
}

function buildInitialNodes(
  bridgeConfig: BridgePublicConfig | null,
  customRelays: CustomRelayConfig[],
  locale: Locale = "vi",
): RelayNodeEntry[] {
  const isVi = locale === "vi";
  const nodes: RelayNodeEntry[] = hasNativeDirectTcp() ? [] : [
    {
      id: "local-alpha",
      name: isVi
        ? "Relay Alpha (Local Lab · Chunk Chẵn 0,2,4...)"
        : "Relay Alpha (Local Lab · Even Chunks 0,2,4...)",
      host: "127.0.0.1",
      port: "3000/ws-dual?channel=alpha",
      address: "local://relay-alpha",
      kind: "local-alpha",
      rttMs: null,
      status: "idle",
    },
    {
      id: "local-beta",
      name: isVi
        ? "Relay Beta (Local Lab · Chunk Lẻ 1,3,5...)"
        : "Relay Beta (Local Lab · Odd Chunks 1,3,5...)",
      host: "127.0.0.1",
      port: "3000/ws-dual?channel=beta",
      address: "local://relay-beta",
      kind: "local-beta",
      rttMs: null,
      status: "idle",
    },
  ];

  const pub = bridgeConfig?.relayAddresses ?? [];
  pub.forEach((addr, idx) => {
    const lastColon = addr.lastIndexOf(":");
    const host = lastColon > 0 ? addr.slice(0, lastColon) : addr;
    const port = lastColon > 0 ? addr.slice(lastColon + 1) : "9009";
    nodes.push({
      id: `public-${idx}`,
      name:
        idx === 0
          ? isVi
            ? "Croc Public Relay #1 (Chính)"
            : "Croc Public Relay #1 (Primary)"
          : `Croc Public Relay #${idx + 1}`,
      host,
      port,
      address: addr,
      kind: "public",
      publicIndex: idx,
      rttMs: null,
      status: "idle",
    });
  });

  for (const c of customRelays) {
    nodes.push({
      id: c.id,
      name: c.name,
      host: c.host,
      port: c.port,
      address: `${c.host}:${c.port}`,
      kind: "custom",
      rttMs: null,
      status: "idle",
    });
  }

  return nodes;
}

/**
 * Relay & Network Monitoring View.
 * Displays latency telemetry, allows switching between Public relays and Local Dual-Relay Lab,
 * measures real-time RTT pings across all configured endpoints, and supports custom self-hosted relays.
 */
export function RelaysView({
  bridgeConfig,
  relayStatus,
  relayProfile,
  onChangeRelayProfile,
  onRefreshStatus,
  onBridgeOriginChanged,
  locale = "vi",
}: RelaysViewProps) {
  const t = getTranslations(locale);
  const androidDirectTcp = hasNativeDirectTcp();
  const [customRelays, setCustomRelays] = useState<CustomRelayConfig[]>(() => loadCustomRelays());
  const [nodes, setNodes] = useState<RelayNodeEntry[]>(() =>
    buildInitialNodes(bridgeConfig, loadCustomRelays(), locale),
  );
  const [probing, setProbing] = useState(false);

  const [newName, setNewName] = useState("");
  const [newHost, setNewHost] = useState("");
  const [newPort, setNewPort] = useState("9009");
  const [newPassword, setNewPassword] = useState("pass123");
  const [formError, setFormError] = useState<string | null>(null);

  const [savedOrigin, setSavedOrigin] = useState<string | null>(() => loadSavedBridgeOrigin());
  const [originInput, setOriginInput] = useState<string>(
    () => loadSavedBridgeOrigin() ?? configuredBridgeOrigin() ?? "",
  );
  const [originTest, setOriginTest] = useState<{
    state: "idle" | "testing" | "ok" | "fail" | "invalid";
    detail?: string;
  }>({ state: "idle" });
  const missingOrigin = !savedOrigin && needsBridgeOrigin();
  const activeOrigin = savedOrigin ?? resolveBridgeOrigin();
  const hasConfiguredOrigin = Boolean(savedOrigin ?? configuredBridgeOrigin());

  const handleSaveOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = saveBridgeOrigin(originInput);
    if (!stored) {
      setOriginTest({ state: "invalid" });
      return;
    }
    setSavedOrigin(stored);
    setOriginInput(stored);
    setOriginTest({ state: "idle" });
    onBridgeOriginChanged?.();
  };

  const handleClearOrigin = () => {
    clearBridgeOrigin();
    setSavedOrigin(null);
    setOriginInput(configuredBridgeOrigin() ?? "");
    setOriginTest({ state: "idle" });
    onBridgeOriginChanged?.();
  };

  const handleTestOrigin = async () => {
    const target = originInput.trim() ? normalizeBridgeOrigin(originInput) : activeOrigin;
    if (!target) {
      setOriginTest({ state: "invalid" });
      return;
    }
    setOriginTest({ state: "testing" });
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${target}/healthz`, { cache: "no-store", signal: controller.signal });
      const ok = res.ok && (await res.text()).trim() === "ok";
      setOriginTest(ok ? { state: "ok", detail: target } : { state: "fail", detail: `HTTP ${res.status}` });
    } catch (err) {
      setOriginTest({ state: "fail", detail: err instanceof Error ? err.message : String(err) });
    } finally {
      window.clearTimeout(timer);
    }
  };

  useEffect(() => {
    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      const rebuilt = buildInitialNodes(bridgeConfig, customRelays, locale).map((fresh) => {
        const old = prevMap.get(fresh.id);
        return old ? { ...fresh, rttMs: old.rttMs, status: old.status, error: old.error } : fresh;
      });
      return rebuilt;
    });
  }, [bridgeConfig, customRelays, locale]);

  const handleProbeAll = useCallback(async () => {
    setProbing(true);
    setNodes((prev) => prev.map((n) => ({ ...n, status: "probing", error: undefined })));

    const current = buildInitialNodes(bridgeConfig, customRelays, locale);
    const probed = await Promise.all(
      current.map(async (node): Promise<RelayNodeEntry> => {
        try {
          const res = await pingRelayNode(node);
          return {
            ...node,
            rttMs: res.rttMs,
            status: res.ok ? "online" : "offline",
            error: res.error,
          };
        } catch (err) {
          return {
            ...node,
            rttMs: null,
            status: "offline",
            error: err instanceof Error ? err.message : (locale === "vi" ? "Lỗi đo mạng" : "Ping error"),
          };
        }
      }),
    );

    const latenciesRecord: Record<string, number | null> = {};
    for (const p of probed) {
      if (p.rttMs !== null) {
        latenciesRecord[p.address] = p.rttMs;
        latenciesRecord[p.host] = p.rttMs;
        latenciesRecord[p.id] = p.rttMs;
        if (typeof p.publicIndex === "number") {
          latenciesRecord[String(p.publicIndex)] = p.rttMs;
        }
      }
    }
    saveRelayLatencies(latenciesRecord);

    setNodes(rankRelaysByLatency(probed));
    onRefreshStatus();
    setProbing(false);
  }, [bridgeConfig, customRelays, onRefreshStatus, locale]);

  const handleAddCustomRelay = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = newName.trim();
    const host = newHost.trim();
    const port = newPort.trim();
    if (!name || !host) {
      setFormError(
        locale === "vi"
          ? "Vui lòng nhập Tên hiển thị và Địa chỉ Host/Domain của Relay."
          : "Please provide both Display Name and Host/Domain.",
      );
      return;
    }
    if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      setFormError(
        locale === "vi"
          ? "Cổng (Port) phải là số hợp lệ từ 1 đến 65535."
          : "Port must be a valid integer between 1 and 65535.",
      );
      return;
    }
    const next: CustomRelayConfig[] = [
      ...customRelays,
      {
        id: `custom-${Date.now()}`,
        name,
        host,
        port,
        password: newPassword.trim() || "pass123",
      },
    ];
    setCustomRelays(next);
    saveCustomRelays(next);
    setNewName("");
    setNewHost("");
    setNewPort("9009");
  };

  const handleRemoveCustomRelay = (id: string) => {
    const next = customRelays.filter((r) => r.id !== id);
    setCustomRelays(next);
    saveCustomRelays(next);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t.relays.title}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t.relays.subtitle}
          </p>
        </div>
        <button
          type="button"
          disabled={probing}
          onClick={() => void handleProbeAll()}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white disabled:opacity-60 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${probing ? "animate-spin" : ""}`} aria-hidden="true" />
          <span>{probing ? t.relays.measuring : t.relays.measureRttBtn}</span>
        </button>
      </div>

      {androidDirectTcp && (
        <section className="rounded-2xl border border-emerald-300/60 bg-emerald-50/70 p-4 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200">
          {locale === "vi"
            ? "APK Android kết nối TCP trực tiếp tới Croc Public Relays. Không cần Bridge Server; thiết bị gửi và nhận vẫn cần Internet và mạng phải cho phép TCP cổng 9009–9017."
            : "The Android APK connects directly to public Croc relays over TCP. No Bridge Server is needed; both devices still need Internet, and the network must allow TCP ports 9009–9017."}
        </section>
      )}

      {/* Bridge Server origin is retained for web, PWA, desktop and older APKs. */}
      {!androidDirectTcp && (
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t.relays.bridgeOriginTitle}
          </h2>
        </div>
        {missingOrigin ? (
          <p
            role="alert"
            className="mt-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >
            {t.relays.bridgeOriginNativeNotice}
          </p>
        ) : (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {hasConfiguredOrigin ? t.relays.bridgeOriginActive : t.relays.bridgeOriginSameOrigin}
            {activeOrigin && (
              <>
                {": "}
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{activeOrigin}</span>
              </>
            )}
          </p>
        )}
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{t.relays.bridgeOriginDesc}</p>

        <form onSubmit={handleSaveOrigin} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="bridge-origin" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t.relays.bridgeOriginLabel}
            </label>
            <input
              id="bridge-origin"
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={originInput}
              onChange={(e) => {
                setOriginInput(e.target.value);
                if (originTest.state !== "testing") setOriginTest({ state: "idle" });
              }}
              placeholder="http://192.168.1.10:3000"
              className="mt-1 min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:border-zinc-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={originTest.state === "testing"}
              onClick={() => void handleTestOrigin()}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all"
            >
              {originTest.state === "testing" ? t.relays.bridgeOriginTesting : t.relays.bridgeOriginTestBtn}
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all"
            >
              {t.relays.bridgeOriginSaveBtn}
            </button>
            {savedOrigin && (
              <button
                type="button"
                onClick={handleClearOrigin}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 transition-colors"
              >
                {t.relays.bridgeOriginClearBtn}
              </button>
            )}
          </div>
        </form>
        {originTest.state === "invalid" && (
          <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {t.relays.bridgeOriginInvalid}
          </p>
        )}
        {originTest.state === "ok" && (
          <p className="mt-2 flex flex-wrap items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t.relays.bridgeOriginTestOk}
            {originTest.detail && <span className="font-mono font-normal">({originTest.detail})</span>}
          </p>
        )}
        {originTest.state === "fail" && (
          <p role="alert" className="mt-2 flex flex-wrap items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {t.relays.bridgeOriginTestFail}
            {originTest.detail && <span className="font-mono font-normal">({originTest.detail})</span>}
          </p>
        )}
      </section>
      )}

      {/* Active Relay Profile Selector */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onChangeRelayProfile("public")}
          className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            relayProfile === "public"
              ? "border-zinc-900 bg-zinc-50/80 shadow-xs ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-800/60 dark:ring-zinc-100"
              : "border-zinc-200/80 bg-white hover:bg-zinc-50/60 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/40"
          }`}
        >
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
            relayProfile === "public"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}>
            <Globe className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t.relays.profilePublic}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t.relays.profilePublicDesc}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeRelayProfile("local-lab")}
          disabled={androidDirectTcp}
          className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all ${
            relayProfile === "local-dual" || relayProfile === "local-lab"
              ? "border-zinc-900 bg-zinc-50/80 shadow-xs ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-800/60 dark:ring-zinc-100"
              : "border-zinc-200/80 bg-white hover:bg-zinc-50/60 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/40"
          } ${androidDirectTcp ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
            relayProfile === "local-dual" || relayProfile === "local-lab"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}>
            <Server className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t.relays.profileLocalLab}
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {androidDirectTcp
                ? locale === "vi"
                  ? "Cần Bridge Server cục bộ; APK trực tiếp chỉ dùng Croc Public Relays."
                  : "Requires a local Bridge Server; direct APK mode uses public Croc relays."
                : t.relays.profileLocalLabDesc}
            </p>
          </div>
        </button>
      </div>

      {/* Live Local Dual-Relay Counters */}
      {relayStatus && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {locale === "vi" ? "Relay Alpha · Luồng Chẵn (0, 2, 4...)" : "Relay Alpha · Even Stream (0, 2, 4...)"}
              </span>
              <Radio className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            </div>
            <div className="mt-3 flex items-baseline gap-5 font-mono tabular-nums">
              <div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatBytes(relayStatus.localDualRelay.alpha.bytesRelayed)}
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">{t.relays.bytesRelayed}</div>
              </div>
              <div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {relayStatus.localDualRelay.alpha.chunksRelayed}
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">Chunks</div>
              </div>
              <div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {relayStatus.localDualRelay.alpha.activeRooms}
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">
                  {locale === "vi" ? "Phòng mở" : "Active Rooms"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                {locale === "vi" ? "Relay Beta · Luồng Lẻ (1, 3, 5...) + Failover" : "Relay Beta · Odd Stream (1, 3, 5...) + Failover"}
              </span>
              <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            </div>
            <div className="mt-3 flex items-baseline gap-5 font-mono tabular-nums">
              <div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatBytes(relayStatus.localDualRelay.beta.bytesRelayed)}
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">{t.relays.bytesRelayed}</div>
              </div>
              <div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {relayStatus.localDualRelay.beta.chunksRelayed}
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">Chunks</div>
              </div>
              <div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {relayStatus.localDualRelay.beta.activeRooms}
                </div>
                <div className="text-[11px] text-zinc-500 font-sans">
                  {locale === "vi" ? "Phòng mở" : "Active Rooms"}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ranked Relay Table */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="border-b border-zinc-200/80 px-5 py-3.5 dark:border-zinc-800/80">
          <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t.relays.rankTitle}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-950/60 dark:text-zinc-400">
                <th className="px-5 py-3 font-semibold">Relay Node</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">
                  {locale === "vi" ? "Địa chỉ" : "Address"}
                </th>
                <th className="px-5 py-3 font-semibold whitespace-nowrap">RTT Latency</th>
                <th className="px-5 py-3 font-semibold whitespace-nowrap">{t.common.status}</th>
                <th className="px-5 py-3 text-right font-semibold">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {nodes.map((node) => (
                <tr key={node.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">
                    <div className="font-semibold">{node.name}</div>
                    <div className="font-mono text-[11px] text-zinc-500 sm:hidden">
                      {node.address}
                    </div>
                    {node.error && (
                      <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                        {node.error}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-5 py-3.5 font-mono text-zinc-600 sm:table-cell dark:text-zinc-400">
                    {node.address}
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                    {node.status === "probing" ? (
                      <span className="text-zinc-500">{t.relays.measuring}</span>
                    ) : node.rttMs !== null ? (
                      <span className={node.rttMs < 60 ? "text-emerald-600 dark:text-emerald-400" : node.rttMs < 150 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}>
                        {node.rttMs} ms
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    {node.status === "online" ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.common.online}
                      </span>
                    ) : node.status === "offline" ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.common.offline}
                      </span>
                    ) : node.status === "probing" ? (
                      <span className="text-zinc-500">{t.relays.measuring}</span>
                    ) : (
                      <span className="text-zinc-400">{t.common.idle}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {node.kind === "custom" ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomRelay(node.id)}
                        aria-label={`Delete relay ${node.name}`}
                        className="inline-flex items-center gap-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 font-semibold transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.common.delete}
                      </button>
                    ) : (
                      <span className="text-zinc-400 text-[11px] font-mono">
                        {locale === "vi" ? "Mặc định" : "Default"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Custom Relay Form */}
      {!androidDirectTcp && (
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t.relays.customModalTitle}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {locale === "vi"
            ? "Lưu cấu hình máy chủ croc relay riêng của nhóm bạn để dùng cùng CROC_RELAY_HOSTS trên Bridge Server."
            : "Save custom self-hosted croc relay endpoints to connect over the Bridge Server."}
        </p>

        <form onSubmit={handleAddCustomRelay} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-4">
          <div>
            <label htmlFor="custom-relay-name" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t.relays.customNameLabel}
            </label>
            <input
              id="custom-relay-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Lab VPS #1"
              className="mt-1 min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:border-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="custom-relay-host" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t.relays.customHostLabel}
            </label>
            <input
              id="custom-relay-host"
              type="text"
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              placeholder="relay.example.com"
              className="mt-1 min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:border-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="custom-relay-port" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t.relays.customPortLabel}
            </label>
            <input
              id="custom-relay-port"
              type="text"
              value={newPort}
              onChange={(e) => setNewPort(e.target.value)}
              placeholder="9009"
              className="mt-1 min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:border-zinc-100"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-all"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{t.relays.saveRelayBtn}</span>
            </button>
          </div>
        </form>
        {formError && (
          <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-semibold">
            {formError}
          </p>
        )}
      </section>
      )}
    </div>
  );
}
