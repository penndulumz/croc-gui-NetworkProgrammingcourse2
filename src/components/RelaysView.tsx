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
  type CustomRelayConfig,
  type RelayNodeEntry,
  type RelayProfileMode,
} from "../lib/relay-manager";
import { formatBytes } from "../lib/format";

export interface RelaysViewProps {
  bridgeConfig: BridgePublicConfig | null;
  relayStatus: RelayClusterStatus | null;
  relayProfile: RelayProfileMode;
  onChangeRelayProfile: (mode: RelayProfileMode) => void;
  onRefreshStatus: () => void;
}

function buildInitialNodes(
  bridgeConfig: BridgePublicConfig | null,
  customRelays: CustomRelayConfig[],
): RelayNodeEntry[] {
  const nodes: RelayNodeEntry[] = [
    {
      id: "local-alpha",
      name: "Relay Alpha (Local Lab · Chunk Chẵn 0,2,4...)",
      host: "127.0.0.1",
      port: "3000/ws-dual?channel=alpha",
      address: "local://relay-alpha",
      kind: "local-alpha",
      rttMs: null,
      status: "idle",
    },
    {
      id: "local-beta",
      name: "Relay Beta (Local Lab · Chunk Lẻ 1,3,5...)",
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
      name: idx === 0 ? "Croc Public Relay #1 (Chính)" : `Croc Public Relay #${idx + 1}`,
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

export function RelaysView({
  bridgeConfig,
  relayStatus,
  relayProfile,
  onChangeRelayProfile,
  onRefreshStatus,
}: RelaysViewProps) {
  const [customRelays, setCustomRelays] = useState<CustomRelayConfig[]>(() => loadCustomRelays());
  const [nodes, setNodes] = useState<RelayNodeEntry[]>(() =>
    buildInitialNodes(bridgeConfig, loadCustomRelays()),
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
      const rebuilt = buildInitialNodes(bridgeConfig, customRelays).map((fresh) => {
        const old = prevMap.get(fresh.id);
        return old ? { ...fresh, rttMs: old.rttMs, status: old.status, error: old.error } : fresh;
      });
      return rebuilt;
    });
  }, [bridgeConfig, customRelays]);

  const handleProbeAll = useCallback(async () => {
    setProbing(true);
    setNodes((prev) => prev.map((n) => ({ ...n, status: "probing", error: undefined })));

    const current = buildInitialNodes(bridgeConfig, customRelays);
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
            error: err instanceof Error ? err.message : "Lỗi đo mạng",
          };
        }
      }),
    );

    setNodes(rankRelaysByLatency(probed));
    onRefreshStatus();
    setProbing(false);
  }, [bridgeConfig, customRelays, onRefreshStatus]);

  const handleAddCustomRelay = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = newName.trim();
    const host = newHost.trim();
    const port = newPort.trim();
    if (!name || !host) {
      setFormError("Vui lòng nhập Tên hiển thị và Địa chỉ Host/Domain của Relay.");
      return;
    }
    if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      setFormError("Cổng (Port) phải là số hợp lệ từ 1 đến 65535.");
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Relay & Đo độ trễ mạng
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Đo thời gian phản hồi RTT (ms) tới cụm Relay công cộng và cặp Local Dual-Relay Lab (Alpha & Beta).
          </p>
        </div>
        <button
          type="button"
          disabled={probing}
          onClick={() => void handleProbeAll()}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${probing ? "animate-spin" : ""}`} aria-hidden="true" />
          {probing ? "Đang đo RTT…" : "Đo độ trễ (Ping RTT)"}
        </button>
      </div>

      {/* Active Relay Profile Selector */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onChangeRelayProfile("public")}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
            relayProfile === "public"
              ? "border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/30"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Cụm Relay Croc Công Cộng (Chuẩn v11)
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Đi qua cầu nối TCP allowlisted <code className="font-mono">/ws</code> tới cụm relay chính thức của Croc để truyền qua Internet với CLI & getcroc.com.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChangeRelayProfile("local-dual")}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
            relayProfile === "local-dual"
              ? "border-teal-600 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/30"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
          }`}
        >
          <Server className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Local Dual-Relay Lab (Alpha & Beta)
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hai phòng Relay độc lập chạy ngay trên Bridge Server (<code className="font-mono">/ws-dual</code>) phục vụ chia tải Chunk Chẵn/Lẻ & Failover.
            </p>
          </div>
        </button>
      </div>

      {/* Live Local Dual-Relay Counters */}
      {relayStatus && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                Relay Alpha · Luồng Chẵn (0, 2, 4...)
              </span>
              <Radio className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-4 font-mono tabular-nums">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatBytes(relayStatus.localDualRelay.alpha.bytesRelayed)}
                </div>
                <div className="text-[11px] text-slate-500">Đã chuyển tiếp</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {relayStatus.localDualRelay.alpha.packetsRelayed}
                </div>
                <div className="text-[11px] text-slate-500">Gói tin (Frames)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {relayStatus.localDualRelay.alpha.activeRooms}
                </div>
                <div className="text-[11px] text-slate-500">Phòng mở</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                Relay Beta · Luồng Lẻ (1, 3, 5...) + Failover
              </span>
              <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-4 font-mono tabular-nums">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatBytes(relayStatus.localDualRelay.beta.bytesRelayed)}
                </div>
                <div className="text-[11px] text-slate-500">Đã chuyển tiếp</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {relayStatus.localDualRelay.beta.packetsRelayed}
                </div>
                <div className="text-[11px] text-slate-500">Gói tin (Frames)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {relayStatus.localDualRelay.beta.activeRooms}
                </div>
                <div className="text-[11px] text-slate-500">Phòng mở</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Ranked Relay Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Danh sách Relay Node (Xếp hạng theo độ trễ nhanh nhất)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Relay Node</th>
                <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Địa chỉ</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Độ trễ (RTT)</th>
                <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Trạng thái</th>
                <th className="px-4 py-2.5 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {nodes.map((node) => (
                <tr key={node.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    <div>{node.name}</div>
                    <div className="font-mono text-[11px] text-slate-500 sm:hidden">
                      {node.address}
                    </div>
                    {node.error && (
                      <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                        {node.error}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-slate-600 sm:table-cell dark:text-slate-400">
                    {node.address}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums whitespace-nowrap text-slate-900 dark:text-slate-100">
                    {node.status === "probing"
                      ? "Đang đo…"
                      : node.rttMs !== null
                        ? `${node.rttMs} ms`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {node.status === "online" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Sẵn sàng
                      </span>
                    ) : node.status === "offline" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Không phản hồi
                      </span>
                    ) : node.status === "probing" ? (
                      <span className="text-teal-700 dark:text-teal-400">Đang kiểm tra</span>
                    ) : (
                      <span className="text-slate-500">Chưa đo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {node.kind === "custom" ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomRelay(node.id)}
                        aria-label={`Xóa relay ${node.name}`}
                        className="inline-flex items-center gap-1 text-rose-600 hover:underline dark:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Xóa
                      </button>
                    ) : (
                      <span className="text-slate-400">Mặc định</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Custom Relay Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
          Thêm Relay tự dựng (Self-hosted Croc Relay)
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Lưu cấu hình máy chủ <code className="font-mono">croc relay</code> riêng của nhóm bạn để dùng cùng <code className="font-mono">CROC_RELAY_HOSTS</code> trên Bridge Server.
        </p>

        <form onSubmit={handleAddCustomRelay} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="custom-relay-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Tên hiển thị
            </label>
            <input
              id="custom-relay-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="VPS Nhóm 4"
              className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="custom-relay-host" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Host / Domain
            </label>
            <input
              id="custom-relay-host"
              type="text"
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              placeholder="relay.example.com"
              className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="custom-relay-port" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Cổng TCP
            </label>
            <input
              id="custom-relay-port"
              type="text"
              value={newPort}
              onChange={(e) => setNewPort(e.target.value)}
              placeholder="9009"
              className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Lưu Relay
            </button>
          </div>
        </form>
        {formError && (
          <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}
      </section>
    </div>
  );
}
