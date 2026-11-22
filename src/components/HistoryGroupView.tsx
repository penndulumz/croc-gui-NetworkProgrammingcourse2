import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  Edit2,
  History,
  KeyRound,
  Plus,
  Search,
  Send,
  Smartphone,
  Trash2,
  Users,
  X,
  Zap,
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
  deletePeerPreset,
  loadPeerPresets,
  savePeerPreset,
  touchPeerPreset,
  type PeerPreset,
  type RelayProfileMode,
  type TransferHistoryEntry,
} from "../lib/history-store";
import { formatBytes, formatDateTimeVi } from "../lib/format";
import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";

export interface HistoryGroupViewProps {
  deviceAlias: string;
  onUpdateDeviceAlias: (nextAlias: string) => void;
  history: TransferHistoryEntry[];
  onRefreshHistory: () => void;
  onUseCodeForSend: (code: string) => void;
  onUseCodeForReceive: (code: string) => void;
  onQuickSendToPeer?: (peer: PeerPreset) => void;
  locale?: Locale;
}

/**
 * History, Device Identity & Monthly Group Passphrase View.
 * Provides custom Device Alias management, monthly rotating HKDF-SHA-256 group passphrases,
 * address book of recurring peer presets, and searchable transfer audit logs.
 */
export function HistoryGroupView({
  deviceAlias,
  onUpdateDeviceAlias,
  history,
  onRefreshHistory,
  onUseCodeForSend,
  onUseCodeForReceive,
  onQuickSendToPeer,
  locale = "vi",
}: HistoryGroupViewProps) {
  const t = getTranslations(locale);
  const [aliasDraft, setAliasDraft] = useState(deviceAlias);
  const [aliasSaved, setAliasSaved] = useState(false);

  // Group passphrases state
  const [groups, setGroups] = useState<GroupPassphraseRecord[]>(() => loadGroupPassphrases());
  const [derivedMap, setDerivedMap] = useState<Record<string, DerivedGroupCode>>({});
  const [groupName, setGroupName] = useState("");
  const [groupSecret, setGroupSecret] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);

  // Frequent Peer Presets state
  const [peers, setPeers] = useState<PeerPreset[]>(() => loadPeerPresets());
  const [peerSearchQuery, setPeerSearchQuery] = useState("");
  const [peerAliasInput, setPeerAliasInput] = useState("");
  const [peerProfileInput, setPeerProfileInput] = useState<"default" | RelayProfileMode>("default");
  const [peerNotesInput, setPeerNotesInput] = useState("");
  const [editingPeerId, setEditingPeerId] = useState<string | null>(null);
  const [peerError, setPeerError] = useState<string | null>(null);
  const [peerSuccess, setPeerSuccess] = useState<string | null>(null);

  // Transfer history state
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
      setGroupError(
        locale === "vi"
          ? "Cần nhập tên nhóm và khóa gốc tối thiểu 6 ký tự."
          : "Please provide a group name and master secret with at least 6 characters.",
      );
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

  // Peer preset actions
  const handleSavePeer = (e: React.FormEvent) => {
    e.preventDefault();
    setPeerError(null);
    const cleanAlias = peerAliasInput.trim();
    if (!cleanAlias) {
      setPeerError(locale === "vi" ? "Vui lòng nhập tên thiết bị / bí danh." : "Please provide a device alias.");
      return;
    }

    const saved = savePeerPreset({
      id: editingPeerId || undefined,
      alias: cleanAlias,
      preferredRelayProfile: peerProfileInput === "default" ? undefined : peerProfileInput,
      notes: peerNotesInput.trim() || undefined,
    });

    setPeers(loadPeerPresets());
    setPeerAliasInput("");
    setPeerProfileInput("default");
    setPeerNotesInput("");
    setEditingPeerId(null);
    setPeerSuccess(
      editingPeerId
        ? (locale === "vi" ? `Đã cập nhật thiết bị "${saved.alias}".` : `Updated peer "${saved.alias}".`)
        : (locale === "vi" ? `Đã lưu thiết bị "${saved.alias}" vào danh sách thường gặp.` : `Saved peer "${saved.alias}" to frequent presets.`),
    );
    setTimeout(() => setPeerSuccess(null), 2500);
  };

  const handleStartEditPeer = (peer: PeerPreset) => {
    setEditingPeerId(peer.id);
    setPeerAliasInput(peer.alias);
    setPeerProfileInput(peer.preferredRelayProfile ?? "default");
    setPeerNotesInput(peer.notes ?? "");
    setPeerError(null);
  };

  const handleCancelEditPeer = () => {
    setEditingPeerId(null);
    setPeerAliasInput("");
    setPeerProfileInput("default");
    setPeerNotesInput("");
    setPeerError(null);
  };

  const handleDeletePeer = (id: string) => {
    deletePeerPreset(id);
    setPeers(loadPeerPresets());
    if (editingPeerId === id) {
      handleCancelEditPeer();
    }
  };

  const handleQuickSend = (peer: PeerPreset) => {
    touchPeerPreset(peer.id);
    setPeers(loadPeerPresets());
    if (onQuickSendToPeer) {
      onQuickSendToPeer(peer);
    }
  };

  const filteredPeers = useMemo(() => {
    const q = peerSearchQuery.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter(
      (p) =>
        p.alias.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q)),
    );
  }, [peers, peerSearchQuery]);

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

  const formatDate = (ts: number) => {
    return locale === "vi" ? formatDateTimeVi(ts) : new Date(ts).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.history.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t.history.subtitle}
        </p>
      </div>

      {/* Device Alias + Monthly Group Passphrase Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Device Alias Card */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
              <Smartphone className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              {t.history.deviceAliasTitle}
            </h2>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.history.deviceAliasHint}
          </p>
          <form onSubmit={handleSaveAlias} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="device-alias-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                {locale === "vi" ? "Tên thiết bị hiện tại" : "Current Device Alias"}
              </label>
              <input
                id="device-alias-input"
                type="text"
                maxLength={48}
                value={aliasDraft}
                onChange={(e) => setAliasDraft(e.target.value)}
                className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:outline-teal-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-xs transition-colors"
            >
              {aliasSaved ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600" aria-hidden="true" />
                  <span>{t.common.saved}</span>
                </>
              ) : (
                <span>{t.history.saveAliasBtn}</span>
              )}
            </button>
          </form>
        </section>

        {/* Monthly Rotating Group Passphrase Card */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-7 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                {t.history.groupPassphraseTitle}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {currentPeriod}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.history.groupPassphraseDesc}
          </p>

          <form onSubmit={handleAddGroup} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <input
              type="text"
              aria-label={t.history.groupNameLabel}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t.history.groupNameLabel}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-teal-600"
            />
            <input
              type="password"
              aria-label={t.history.groupSecretLabel}
              value={groupSecret}
              onChange={(e) => setGroupSecret(e.target.value)}
              placeholder={locale === "vi" ? "Khóa gốc (≥ 6 ký tự)" : "Master Secret (≥ 6 chars)"}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-teal-600"
            />
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{t.history.newGroupBtn}</span>
            </button>
          </form>
          {groupError && (
            <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-semibold">
              {groupError}
            </p>
          )}

          {groups.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {groups.map((g) => {
                const derived = derivedMap[g.id];
                return (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {g.groupName}
                      </div>
                      <div className="mt-0.5 font-mono font-bold text-teal-600 dark:text-teal-400">
                        {derived ? derived.codephrase : (locale === "vi" ? "Đang dẫn xuất…" : "Deriving...")}
                      </div>
                      {derived && (
                        <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
                          {locale === "vi" ? `Đổi mã: ${derived.nextRotationDate} · Vân tay ${derived.fingerprint}` : `Rotates: ${derived.nextRotationDate} · FP: ${derived.fingerprint}`}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {derived && (
                        <>
                          <button
                            type="button"
                            onClick={() => onUseCodeForSend(derived.codephrase)}
                            className="min-h-[34px] rounded-xl bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-950/60 dark:text-teal-300 transition-colors"
                          >
                            {t.history.useForSendBtn}
                          </button>
                          <button
                            type="button"
                            onClick={() => onUseCodeForReceive(derived.codephrase)}
                            className="min-h-[34px] rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                          >
                            {t.history.useForReceiveBtn}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveGroup(g.id)}
                        aria-label={`Remove group ${g.groupName}`}
                        className="flex h-[34px] w-[34px] items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 transition-colors"
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
              {locale === "vi"
                ? "Chưa có Passphrase nhóm nào. Tạo một nhóm để chia sẻ tệp định kỳ mà không phải đọc lại mã mỗi lần gửi."
                : "No group passphrases created yet. Create one to derive synchronized monthly transfer codes with collaborators."}
            </p>
          )}
        </section>
      </div>

      {/* Frequent Peer Presets Management Section */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                {t.history.peerPresetsTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.history.peerPresetsDesc}
              </p>
            </div>
          </div>

          {peers.length > 0 && (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={peerSearchQuery}
                onChange={(e) => setPeerSearchQuery(e.target.value)}
                placeholder={locale === "vi" ? "Tìm thiết bị…" : "Search peers..."}
                aria-label="Search peers"
                className="min-h-[36px] w-48 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-teal-600"
              />
            </div>
          )}
        </div>

        {/* Add / Edit Peer Form */}
        <form onSubmit={handleSavePeer} className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-950/40">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {editingPeerId
              ? (locale === "vi" ? "Chỉnh sửa thông tin thiết bị" : "Edit Saved Peer")
              : (locale === "vi" ? "Thêm thiết bị quen thuộc mới" : "Add New Frequent Peer")}
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
            <div className="sm:col-span-5">
              <input
                type="text"
                maxLength={48}
                value={peerAliasInput}
                onChange={(e) => setPeerAliasInput(e.target.value)}
                placeholder={t.history.peerAliasLabel}
                aria-label={t.history.peerAliasLabel}
                className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={peerProfileInput}
                onChange={(e) =>
                  setPeerProfileInput(e.target.value as "default" | RelayProfileMode)
                }
                aria-label="Preferred Relay Profile"
                className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 focus:outline-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="default">{locale === "vi" ? "Hồ sơ: Mặc định" : "Profile: Default"}</option>
                <option value="public">🌐 Public Croc Relays</option>
                <option value="local-lab">⚡ Local Dual-Relay Lab</option>
              </select>
            </div>

            <div className="sm:col-span-4 flex items-center gap-2">
              <input
                type="text"
                maxLength={64}
                value={peerNotesInput}
                onChange={(e) => setPeerNotesInput(e.target.value)}
                placeholder={t.history.peerNotesLabel}
                aria-label={t.history.peerNotesLabel}
                className="min-h-[38px] w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors"
              >
                {editingPeerId ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.common.save}</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.history.addPeerBtn}</span>
                  </>
                )}
              </button>
              {editingPeerId && (
                <button
                  type="button"
                  onClick={handleCancelEditPeer}
                  className="inline-flex min-h-[38px] shrink-0 items-center rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.common.cancel}</span>
                </button>
              )}
            </div>
          </div>

          {peerError && (
            <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-semibold">
              {peerError}
            </p>
          )}
          {peerSuccess && (
            <p role="status" className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {peerSuccess}
            </p>
          )}
        </form>

        {/* Existing Peers List */}
        {filteredPeers.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {filteredPeers.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {p.alias}
                    </span>
                    {p.preferredRelayProfile && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.preferredRelayProfile === "local-dual" ||
                          p.preferredRelayProfile === "local-lab"
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-200 border border-teal-300/40"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {p.preferredRelayProfile === "local-dual" ||
                        p.preferredRelayProfile === "local-lab" ? (
                          <>
                            <Zap className="h-2.5 w-2.5" aria-hidden="true" />
                            Local Lab
                          </>
                        ) : (
                          "🌐 Public"
                        )}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {p.notes && <span>{p.notes}</span>}
                    <span>{locale === "vi" ? `Lần cuối: ${formatDate(p.lastSeen)}` : `Last seen: ${formatDate(p.lastSeen)}`}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickSend(p)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-xl bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700 shadow-xs transition-colors"
                  >
                    <Send className="h-3 w-3" aria-hidden="true" />
                    <span>{locale === "vi" ? "Gửi nhanh" : "Quick Send"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditPeer(p)}
                    aria-label={`Edit ${p.alias}`}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePeer(p.id)}
                    aria-label={`Delete ${p.alias}`}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {peerSearchQuery
              ? (locale === "vi" ? `Không tìm thấy thiết bị nào khớp với "${peerSearchQuery}".` : `No peers found matching "${peerSearchQuery}".`)
              : (locale === "vi" ? "Chưa lưu thiết bị nào. Thêm các thiết bị thường xuyên chuyển tệp để gửi một chạm dễ dàng." : "No saved peers yet. Save recurring collaborator devices for quick 1-click dispatch.")}
          </p>
        )}
      </section>

      {/* Transfer History Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              {t.history.transferHistoryTitle} ({filteredHistory.length})
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
                aria-label="Search transfer history"
                placeholder={t.history.searchPlaceholder}
                className="min-h-[36px] rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-teal-600"
              />
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
              {(["all", "send", "receive"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDirectionFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    directionFilter === f
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {f === "all" ? t.history.filterAll : f === "send" ? t.history.filterSend : t.history.filterReceive}
                </button>
              ))}
            </div>

            {history.length > 0 &&
              (!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.history.clearHistoryBtn}</span>
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
                    className="min-h-[36px] rounded-xl bg-rose-600 px-3 py-1 text-xs font-semibold text-white shadow-xs"
                  >
                    {t.common.confirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[36px] rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            {t.history.noHistoryYet}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-400">
                  <th className="px-5 py-3 font-semibold">{locale === "vi" ? "Hướng & Nội dung" : "Direction & Payload"}</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">{locale === "vi" ? "Giao thức & Xác thực" : "Protocol & Verification"}</th>
                  <th className="px-5 py-3 font-semibold whitespace-nowrap">{t.common.bytes}</th>
                  <th className="hidden px-5 py-3 font-semibold sm:table-cell whitespace-nowrap">{locale === "vi" ? "Thời gian" : "Timestamp"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-start gap-2.5">
                        {item.direction === "send" ? (
                          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
                            <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                            {item.summaryName}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                            {item.codephrase} · {item.deviceAlias}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 text-slate-600 md:table-cell dark:text-slate-400">
                      <div>
                        {item.mode === "enhanced"
                          ? item.dualRelay
                            ? (locale === "vi" ? "Nâng cao Dual-Relay" : "Enhanced Dual-Relay")
                            : (locale === "vi" ? "Nâng cao Manifest" : "Enhanced Manifest")
                          : "Croc v11"}{" "}
                        · {item.verifiedHash}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.failoverTriggered ? (locale === "vi" ? "Có Failover Alpha→Beta · " : "Failover triggered · ") : ""}
                        {item.resumedChunks ? (locale === "vi" ? `Resume ${item.resumedChunks} chunks` : `Resumed ${item.resumedChunks} chunks`) : (locale === "vi" ? "Truyền mới 100%" : "Fresh transfer 100%")}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono tabular-nums whitespace-nowrap text-slate-900 dark:text-slate-100 font-semibold">
                      {formatBytes(item.totalBytes)}
                    </td>
                    <td className="hidden px-5 py-3.5 font-mono tabular-nums whitespace-nowrap text-slate-500 sm:table-cell">
                      {formatDate(item.timestamp)}
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
