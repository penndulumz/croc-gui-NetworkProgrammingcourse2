import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  History,
  KeyRound,
  Plus,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  deriveMonthlyGroupCode,
  formatMonthlyPeriod,
  loadGroupPassphrases,
  saveGroupPassphrases,
  type DerivedGroupCode,
  type GroupPassphraseRecord,
} from "../lib/group-passphrase";
import {
  clearTransferHistory,
  type TransferHistoryEntry,
} from "../lib/history-store";
import { formatBytes, formatDateTimeVi } from "../lib/format";

export interface HistoryGroupViewProps {
  deviceAlias: string;
  onUpdateDeviceAlias: (nextAlias: string) => void;
  history: TransferHistoryEntry[];
  onRefreshHistory: () => void;
  onUseCodeForSend: (code: string) => void;
  onUseCodeForReceive: (code: string) => void;
}

export function HistoryGroupView({
  deviceAlias,
  onUpdateDeviceAlias,
  history,
  onRefreshHistory,
  onUseCodeForSend,
  onUseCodeForReceive,
}: HistoryGroupViewProps) {
  const [aliasDraft, setAliasDraft] = useState(deviceAlias);
  const [aliasSaved, setAliasSaved] = useState(false);

  const [groups, setGroups] = useState<GroupPassphraseRecord[]>(() => loadGroupPassphrases());
  const [derivedMap, setDerivedMap] = useState<Record<string, DerivedGroupCode>>({});
  const [groupName, setGroupName] = useState("");
  const [groupSecret, setGroupSecret] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "send" | "receive">("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const currentPeriod = formatMonthlyPeriod(new Date());

  useEffect(() => {
    setAliasDraft(deviceAlias);
  }, [deviceAlias]);

  useEffect(() => {
    let active = true;
    const computeAll = async () => {
      const entries: Record<string, DerivedGroupCode> = {};
      for (const g of groups) {
        entries[g.id] = await deriveMonthlyGroupCode(g.sharedSecret, currentPeriod);
      }
      if (active) setDerivedMap(entries);
    };
    void computeAll();
    return () => {
      active = false;
    };
  }, [groups, currentPeriod]);

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDeviceAlias(aliasDraft);
    setAliasSaved(true);
    setTimeout(() => setAliasSaved(false), 1800);
  };

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError(null);
    const name = groupName.trim();
    const seed = groupSecret.trim();
    if (!name || seed.length < 6) {
      setGroupError("Cần nhập tên nhóm và khóa gốc tối thiểu 6 ký tự.");
      return;
    }
    const next: GroupPassphraseRecord[] = [
      {
        id: `grp-${Date.now()}`,
        groupName: name,
        sharedSecret: seed,
        rotationCycle: "monthly",
        createdAt: Date.now(),
      },
      ...groups,
    ];
    setGroups(next);
    saveGroupPassphrases(next);
    setGroupName("");
    setGroupSecret("");
  };

  const handleRemoveGroup = (id: string) => {
    const next = groups.filter((g) => g.id !== id);
    setGroups(next);
    saveGroupPassphrases(next);
  };

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => {
      if (directionFilter !== "all" && item.direction !== directionFilter) return false;
      if (!q) return true;
      return (
        item.summaryName.toLowerCase().includes(q) ||
        item.codephrase.toLowerCase().includes(q) ||
        item.deviceAlias.toLowerCase().includes(q)
      );
    });
  }, [history, searchQuery, directionFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Lịch sử, Thiết bị & Passphrase Nhóm
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Quản lý tên thiết bị, khóa nhóm tự xoay vòng hàng tháng (HKDF-SHA-256) và tra cứu toàn bộ phiên đã truyền.
        </p>
      </div>

      {/* Device Alias + Monthly Group Passphrase Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Device Alias Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Tên thiết bị (Device Alias)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Gắn nhãn dễ nhớ (ví dụ: Laptop thuyết trình, Android của Minh) vào lịch sử truyền cục bộ.
          </p>
          <form onSubmit={handleSaveAlias} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="device-alias-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Tên thiết bị hiện tại
              </label>
              <input
                id="device-alias-input"
                type="text"
                maxLength={48}
                value={aliasDraft}
                onChange={(e) => setAliasDraft(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            >
              {aliasSaved ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600" aria-hidden="true" />
                  Đã lưu tên thiết bị
                </>
              ) : (
                "Lưu tên thiết bị"
              )}
            </button>
          </form>
        </section>

        {/* Monthly Rotating Group Passphrase Card */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Passphrase nhóm xoay vòng hàng tháng
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Chu kỳ {currentPeriod}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Cả nhóm chỉ cần nhớ 1 khóa gốc chung — CrocFlow dùng <code className="font-mono">HKDF-SHA-256(seed, YYYY-MM)</code> để tự sinh mã EFF mới vào ngày đầu mỗi tháng.
          </p>

          <form onSubmit={handleAddGroup} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <input
              type="text"
              aria-label="Tên nhóm làm việc"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Tên nhóm (VD: Nhóm Đồ Án 04)"
              className="min-h-[40px] rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <input
              type="password"
              aria-label="Khóa gốc của nhóm"
              value={groupSecret}
              onChange={(e) => setGroupSecret(e.target.value)}
              placeholder="Khóa gốc (≥ 6 ký tự)"
              className="min-h-[40px] rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tạo khóa nhóm
            </button>
          </form>
          {groupError && (
            <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">
              {groupError}
            </p>
          )}

          {groups.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {groups.map((g) => {
                const derived = derivedMap[g.id];
                return (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {g.groupName}
                      </div>
                      <div className="mt-0.5 font-mono font-semibold text-teal-700 dark:text-teal-400">
                        {derived ? derived.codephrase : "Đang dẫn xuất…"}
                      </div>
                      {derived && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Đổi mã kế tiếp: {derived.nextRotationDate} · Vân tay {derived.fingerprint}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {derived && (
                        <>
                          <button
                            type="button"
                            onClick={() => onUseCodeForSend(derived.codephrase)}
                            className="min-h-[34px] rounded-lg bg-teal-600/10 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-600/20 dark:bg-teal-400/10 dark:text-teal-300"
                          >
                            Dùng để Gửi
                          </button>
                          <button
                            type="button"
                            onClick={() => onUseCodeForReceive(derived.codephrase)}
                            className="min-h-[34px] rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Dùng để Nhận
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveGroup(g.id)}
                        aria-label={`Xóa nhóm ${g.groupName}`}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Chưa có Passphrase nhóm nào. Tạo một nhóm để chia sẻ tệp định kỳ mà không phải đọc lại mã mỗi lần gửi.
            </p>
          )}
        </section>
      </div>

      {/* Transfer History Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Lịch sử phiên truyền ({filteredHistory.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm lịch sử truyền"
                placeholder="Tìm tên tệp hoặc mã…"
                className="min-h-[36px] rounded-lg border border-slate-300 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              {(["all", "send", "receive"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDirectionFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    directionFilter === f
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                  }`}
                >
                  {f === "all" ? "Tất cả" : f === "send" ? "Đã gửi" : "Đã nhận"}
                </button>
              ))}
            </div>

            {history.length > 0 &&
              (!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Xóa lịch sử
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      clearTransferHistory();
                      onRefreshHistory();
                      setConfirmClear(false);
                    }}
                    className="min-h-[36px] rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Xác nhận xóa
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[36px] rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    Hủy
                  </button>
                </div>
              ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            Chưa có phiên truyền nào phù hợp. Hãy thử gửi tệp hoặc chạy Demo 2 Relay ở mục Gửi để ghi nhận lịch sử thật.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-4 py-2.5 font-semibold">Hướng & Nội dung</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Giao thức & Xác thực</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Dung lượng</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell whitespace-nowrap">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {item.direction === "send" ? (
                          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                        ) : (
                          <ArrowDownLeft className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {item.summaryName}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                            {item.codephrase} · {item.deviceAlias}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell dark:text-slate-400">
                      <div>
                        {item.mode === "enhanced"
                          ? item.dualRelay
                            ? "Nâng cao Dual-Relay"
                            : "Nâng cao Manifest"
                          : "Chuẩn Croc v11"}{" "}
                        · {item.verifiedHash}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.failoverTriggered ? "Có Failover Alpha→Beta · " : ""}
                        {item.resumedChunks ? `Resume ${item.resumedChunks} chunks` : "Truyền mới 100%"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap text-slate-900 dark:text-slate-100">
                      {formatBytes(item.totalBytes)}
                    </td>
                    <td className="hidden px-4 py-3 font-mono tabular-nums whitespace-nowrap text-slate-500 sm:table-cell">
                      {formatDateTimeVi(item.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
