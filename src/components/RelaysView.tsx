import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Globe,
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
import { formatBytes } from "../lib/format";
import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";

export interface RelaysViewProps {
  bridgeConfig: BridgePublicConfig | null;
  relayStatus: RelayClusterStatus | null;
  relayProfile: RelayProfileMode;
  onChangeRelayProfile: (mode: RelayProfileMode) => void;
  onRefreshStatus: () => void;
  locale?: Locale;
}

function buildInitialNodes(
  bridgeConfig: BridgePublicConfig | null,
  customRelays: CustomRelayConfig[],
  locale: Locale = "vi",
): RelayNodeEntry[] {
  const isVi = locale === "vi";
  const nodes: RelayNodeEntry[] = [
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
  locale = "vi",
}: RelaysViewProps) {
  const t = getTranslations(locale);
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.relays.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.relays.subtitle}
          </p>
        </div>
        <button
          type="button"
          disabled={probing}
          onClick={() => void handleProbeAll()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-60 transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${probing ? "animate-spin" : ""}`} aria-hidden="true" />
          <span>{probing ? t.relays.measuring : t.relays.measureRttBtn}</span>
        </button>
      </div>

      {/* Active Relay Profile Selector */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onChangeRelayProfile("public")}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
            relayProfile === "public"
              ? "border-teal-600 bg-teal-50/70 shadow-xs dark:border-teal-400 dark:bg-teal-950/30"
              : "border-slate-200/80 bg-white hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900"
          }`}
        >
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t.relays.profilePublic}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.relays.profilePublicDesc}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeRelayProfile("local-lab")}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
            relayProfile === "local-dual" || relayProfile === "local-lab"
              ? "border-teal-600 bg-teal-50/70 shadow-xs dark:border-teal-400 dark:bg-teal-950/30"
              : "border-slate-200/80 bg-white hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900"
          }`}
        >
          <Server className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t.relays.profileLocalLab}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.relays.profileLocalLabDesc}
            </p>
          </div>
        </button>
      </div>

      {/* Live Local Dual-Relay Counters */}
      {relayStatus && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                {locale === "vi" ? "Relay Alpha · Luồng Chẵn (0, 2, 4...)" : "Relay Alpha · Even Stream (0, 2, 4...)"}
              </span>
              <Radio className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            </div>
            <div className="mt-3 flex items-baseline gap-5 font-mono tabular-nums">
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {formatBytes(relayStatus.localDualRelay.alpha.bytesRelayed)}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">{t.relays.bytesRelayed}</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {relayStatus.localDualRelay.alpha.chunksRelayed}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">Chunks</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {relayStatus.localDualRelay.alpha.activeRooms}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  {locale === "vi" ? "Phòng mở" : "Active Rooms"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                {locale === "vi" ? "Relay Beta · Luồng Lẻ (1, 3, 5...) + Failover" : "Relay Beta · Odd Stream (1, 3, 5...) + Failover"}
              </span>
              <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            </div>
            <div className="mt-3 flex items-baseline gap-5 font-mono tabular-nums">
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {formatBytes(relayStatus.localDualRelay.beta.bytesRelayed)}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">{t.relays.bytesRelayed}</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {relayStatus.localDualRelay.beta.chunksRelayed}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">Chunks</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  {relayStatus.localDualRelay.beta.activeRooms}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">
                  {locale === "vi" ? "Phòng mở" : "Active Rooms"}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ranked Relay Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800/80">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            {t.relays.rankTitle}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-400">
                <th className="px-5 py-3 font-semibold">Relay Node</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">
                  {locale === "vi" ? "Địa chỉ" : "Address"}
                </th>
                <th className="px-5 py-3 font-semibold whitespace-nowrap">RTT Latency</th>
                <th className="px-5 py-3 font-semibold whitespace-nowrap">{t.common.status}</th>
                <th className="px-5 py-3 text-right font-semibold">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {nodes.map((node) => (
                <tr key={node.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                    <div className="font-semibold">{node.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 sm:hidden">
                      {node.address}
                    </div>
                    {node.error && (
                      <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                        {node.error}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-5 py-3.5 font-mono text-slate-600 sm:table-cell dark:text-slate-400">
                    {node.address}
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold tabular-nums whitespace-nowrap text-slate-900 dark:text-slate-100">
                    {node.status === "probing" ? (
                      <span className="text-teal-600 dark:text-teal-400">{t.relays.measuring}</span>
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
                      <span className="text-teal-700 dark:text-teal-400">{t.relays.measuring}</span>
                    ) : (
                      <span className="text-slate-400">{t.common.idle}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {node.kind === "custom" ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomRelay(node.id)}
                        aria-label={`Delete relay ${node.name}`}
                        className="inline-flex items-center gap-1 text-rose-600 hover:underline dark:text-rose-400 font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.common.delete}
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px] font-mono">
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
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
          {t.relays.customModalTitle}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {locale === "vi"
            ? "Lưu cấu hình máy chủ croc relay riêng của nhóm bạn để dùng cùng CROC_RELAY_HOSTS trên Bridge Server."
            : "Save custom self-hosted croc relay endpoints to connect over the Bridge Server."}
        </p>

        <form onSubmit={handleAddCustomRelay} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-4">
          <div>
            <label htmlFor="custom-relay-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.relays.customNameLabel}
            </label>
            <input
              id="custom-relay-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Lab VPS #1"
              className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-teal-600"
            />
          </div>
          <div>
            <label htmlFor="custom-relay-host" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.relays.customHostLabel}
            </label>
            <input
              id="custom-relay-host"
              type="text"
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              placeholder="relay.example.com"
              className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-teal-600"
            />
          </div>
          <div>
            <label htmlFor="custom-relay-port" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.relays.customPortLabel}
            </label>
            <input
              id="custom-relay-port"
              type="text"
              value={newPort}
              onChange={(e) => setNewPort(e.target.value)}
              placeholder="9009"
              className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-teal-600"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-xs transition-colors"
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
    </div>
  );
}
