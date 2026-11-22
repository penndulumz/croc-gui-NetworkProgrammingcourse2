import React from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Clock,
  Moon,
  Network,
  Sun,
} from "lucide-react";
import {
  NAV_DESTINATIONS,
  type NavDestinationId,
} from "../types/navigation";
import type { ThemeMode } from "../lib/theme";
import type { RelayProfileMode } from "../lib/relay-manager";

const NAV_ICONS: Record<NavDestinationId, React.ComponentType<{ className?: string }>> = {
  send: ArrowUpFromLine,
  receive: ArrowDownToLine,
  relays: Network,
  history: Clock,
  docs: BookOpen,
};

interface AppShellProps {
  activeNav: NavDestinationId;
  onSelectNav: (nav: NavDestinationId) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  bridgeHealthy: boolean | null;
  relayProfile?: RelayProfileMode;
  onChangeRelayProfile?: (mode: RelayProfileMode) => void;
  deviceAlias?: string;
  topBarAction?: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeNav,
  onSelectNav,
  theme,
  onToggleTheme,
  bridgeHealthy,
  relayProfile,
  onChangeRelayProfile: _onChangeRelayProfile,
  deviceAlias,
  topBarAction,
  children,
}) => {
  const current =
    NAV_DESTINATIONS.find((item) => item.id === activeNav) ?? NAV_DESTINATIONS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B1120] dark:text-slate-100 transition-colors duration-200">
      {/* Desktop Layout: Fixed 256px left sidebar */}
      <aside
        aria-label="Điều hướng chính"
        className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]"
      >
        <div className="h-16 px-6 flex items-center border-b border-slate-200 dark:border-slate-800">
          <a
            href="#send"
            onClick={(e) => {
              e.preventDefault();
              onSelectNav("send");
            }}
            className="flex items-center gap-3 text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600 rounded-md"
          >
            <img
              src="/icon.svg"
              alt="Biểu tượng CrocFlow"
              className="w-7 h-7 rounded-lg shrink-0"
              referrerPolicy="no-referrer"
            />
            <span className="font-display">CrocFlow</span>
          </a>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Các màn hình">
          {NAV_DESTINATIONS.map((item) => {
            const Icon = NAV_ICONS[item.id];
            const isActive = item.id === activeNav;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                  isActive
                    ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="px-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            {deviceAlias && (
              <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                {deviceAlias}
              </p>
            )}
            <p className="font-mono tabular-nums text-[11px]">
              {bridgeHealthy === null
                ? "Đang kiểm tra máy chủ…"
                : bridgeHealthy
                  ? "Bridge cục bộ · Cổng 3000"
                  : "Chưa kết nối Bridge"}
            </p>
            {relayProfile && (
              <button
                type="button"
                onClick={() => onSelectNav("relays")}
                className="w-full text-left text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-between transition-colors pt-0.5"
                title="Bấm để chuyển tới cấu hình Relay"
              >
                <span>Hồ sơ Relay:</span>
                <span className="font-semibold text-teal-700 dark:text-teal-300">
                  {relayProfile === "local-dual" ? "Local Lab (LAN)" : "Public Relays"}
                </span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between transition-colors whitespace-nowrap"
          >
            <span>{theme === "dark" ? "Chế độ Tối" : "Chế độ Sáng"}</span>
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Sun className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Desktop Top Bar (64px) & Mobile Compact Top Bar (52px) */}
        <header className="sticky top-0 z-30 h-[52px] lg:h-16 px-4 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icon.svg"
              alt="Biểu tượng CrocFlow"
              className="w-6 h-6 rounded-md shrink-0 lg:hidden"
              referrerPolicy="no-referrer"
            />
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="font-display font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0 lg:text-slate-500 lg:dark:text-slate-400 lg:font-medium">
                CrocFlow
              </span>
              <span aria-hidden="true" className="hidden lg:inline text-slate-300 dark:text-slate-700">
                /
              </span>
              <h1 className="hidden lg:block font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                {current.breadcrumb}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {relayProfile && (
              <button
                type="button"
                onClick={() => onSelectNav("relays")}
                title={`Hồ sơ Relay: ${relayProfile === "local-dual" ? "Local Dual-Relay Lab (Mạng nội bộ / Offline)" : "Public Croc Relays (Công cộng)"} — Nhấp để xem & cấu hình`}
                aria-label={`Hồ sơ Relay: ${relayProfile === "local-dual" ? "Local Lab" : "Public Relays"}`}
                className={`inline-flex min-h-[38px] items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                  relayProfile === "local-dual"
                    ? "border-teal-500/50 bg-teal-50 text-teal-800 dark:border-teal-400/40 dark:bg-teal-950/60 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60"
                    : "border-slate-200 bg-slate-100/90 text-slate-700 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    relayProfile === "local-dual" ? "bg-teal-500 animate-pulse" : "bg-emerald-500"
                  }`}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Relay:</span>
                <span>{relayProfile === "local-dual" ? "Local Lab" : "Public Relays"}</span>
              </button>
            )}
            {topBarAction}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
              className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 pb-24 lg:pb-10">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (64px; 52 + 64 = 116px <= 15% of 844px) */}
      <nav
        aria-label="Thanh điều hướng di động"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 pb-safe border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md grid grid-cols-5 items-center"
      >
        {NAV_DESTINATIONS.map((item) => {
          const Icon = NAV_ICONS[item.id];
          const isActive = item.id === activeNav;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectNav(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`min-h-[44px] min-w-[44px] h-full flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="w-[21px] h-[21px] shrink-0" />
              <span className="text-[11px] font-medium leading-none whitespace-nowrap">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
