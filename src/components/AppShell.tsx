import React from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Clock,
  Globe,
  Moon,
  Network,
  Sun,
  ShieldCheck,
} from "lucide-react";
import {
  getNavDestinations,
  type NavDestinationId,
} from "../types/navigation";
import type { ThemeMode } from "../lib/theme";
import type { RelayProfileMode } from "../lib/relay-manager";
import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";
import { hasNativeDirectTcp } from "../protocol/croc/native-tcp";

const NAV_ICONS: Record<NavDestinationId, React.ComponentType<{ className?: string }>> = {
  send: ArrowUpFromLine,
  receive: ArrowDownToLine,
  relays: Network,
  history: Clock,
  docs: BookOpen,
};

export interface AppShellProps {
  activeNav: NavDestinationId;
  onSelectNav: (nav: NavDestinationId) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  locale: Locale;
  onToggleLocale: () => void;
  bridgeHealthy: boolean | null;
  relayProfile?: RelayProfileMode;
  deviceAlias?: string;
  topBarAction?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Modern, polished application shell providing responsive dual-layout:
 * - Desktop: Fixed glassmorphic 260px sidebar with brand badge, nav tabs, server telemetry, and theme/locale toggles.
 * - Mobile: Fixed header (52px) with quick toggles and thumb-friendly bottom navigation bar (64px).
 */
export const AppShell: React.FC<AppShellProps> = ({
  activeNav,
  onSelectNav,
  theme,
  onToggleTheme,
  locale,
  onToggleLocale,
  bridgeHealthy,
  relayProfile,
  deviceAlias,
  topBarAction,
  children,
}) => {
  const t = getTranslations(locale);
  const destinations = getNavDestinations(locale);
  const current = destinations.find((item) => item.id === activeNav) ?? destinations[0];
  const isLocalLab = relayProfile === "local-dual" || relayProfile === "local-lab";
  const androidDirectTcp = hasNativeDirectTcp();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-200 antialiased selection:bg-emerald-500/20 selection:text-emerald-700 dark:selection:text-emerald-300">
      {/* Desktop Layout: Fixed 260px left sidebar */}
      <aside
        aria-label={locale === "vi" ? "Điều hướng chính" : "Main Navigation"}
        className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:flex-col border-r border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-30"
      >
        {/* Brand header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80">
          <a
            href="#send"
            onClick={(e) => {
              e.preventDefault();
              onSelectNav("send");
            }}
            className="flex items-center gap-3 text-lg font-bold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0 group focus-visible:outline-2 focus-visible:outline-zinc-600 rounded-lg p-1"
          >
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900 group-hover:scale-105 transition-transform duration-200">
              <img
                src="/icon.svg"
                alt="CrocFlow"
                className="w-5 h-5 rounded-md"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold tracking-tight text-base leading-none text-zinc-900 dark:text-white">
                CrocFlow
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-medium tracking-wide">
                v11 · PAKE E2E
              </span>
            </div>
          </a>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
            <ShieldCheck className="w-3 h-3" />
            E2E
          </span>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label={locale === "vi" ? "Các màn hình chức năng" : "Application Views"}>
          {destinations.map((item) => {
            const Icon = NAV_ICONS[item.id];
            const isActive = item.id === activeNav;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-zinc-600 group relative ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/60"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                    isActive ? "scale-105" : "group-hover:scale-105 opacity-80"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info & controls */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="px-2 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            {deviceAlias && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <p className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                  {deviceAlias}
                </p>
              </div>
            )}
            <p className="font-mono tabular-nums text-[11px] text-zinc-400 dark:text-zinc-500">
              {androidDirectTcp
                ? locale === "vi" ? "Android · TCP Relay trực tiếp" : "Android · Direct Relay TCP"
                : bridgeHealthy === null
                ? locale === "vi" ? "Đang kết nối bridge..." : "Connecting bridge..."
                : bridgeHealthy
                  ? locale === "vi" ? "Bridge cục bộ · Cổng 3000" : "Local Bridge · Port 3000"
                  : locale === "vi" ? "Chưa kết nối Bridge" : "Bridge Disconnected"}
            </p>
            {relayProfile && (
              <button
                type="button"
                onClick={() => onSelectNav("relays")}
                className="w-full text-left text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center justify-between transition-colors pt-0.5"
                title={locale === "vi" ? "Bấm để xem cấu hình Relay" : "Click to manage relay cluster"}
              >
                <span>{locale === "vi" ? "Cụm Relay:" : "Relay Cluster:"}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {isLocalLab ? "Local Lab (LAN)" : "Public Relays"}
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Language toggle button */}
            <button
              type="button"
              onClick={onToggleLocale}
              aria-label={t.common.switchLang}
              title={t.common.switchLang}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <Globe className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
              <span>{locale === "vi" ? "VI" : "EN"}</span>
            </button>

            {/* Theme toggle button */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? t.common.themeLight : t.common.themeDark}
              title={theme === "dark" ? t.common.themeLight : t.common.themeDark}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              {theme === "dark" ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                  <span>{locale === "vi" ? "Tối" : "Dark"}</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{locale === "vi" ? "Sáng" : "Light"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Desktop Top Bar & Mobile Compact Top Bar */}
        <header className="sticky top-0 z-30 h-[56px] lg:h-16 px-4 lg:px-8 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icon.svg"
              alt="CrocFlow"
              className="w-7 h-7 rounded-lg shrink-0 lg:hidden shadow-xs"
              referrerPolicy="no-referrer"
            />
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="font-display font-extrabold text-zinc-900 dark:text-white whitespace-nowrap shrink-0 lg:text-zinc-400 lg:dark:text-zinc-500 lg:font-semibold">
                CrocFlow
              </span>
              <span aria-hidden="true" className="hidden lg:inline text-zinc-300 dark:text-zinc-700">
                /
              </span>
              <h1 className="hidden lg:block font-display text-sm font-bold text-zinc-900 dark:text-white truncate">
                {current.breadcrumb}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {relayProfile && (
              <button
                type="button"
                onClick={() => onSelectNav("relays")}
                title={`Relay Profile: ${isLocalLab ? "Local Lab (LAN)" : "Public Croc Relays"} — click to view`}
                className={`inline-flex min-h-[36px] items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs ${
                  isLocalLab
                    ? "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 hover:bg-zinc-100"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isLocalLab ? "bg-emerald-500 animate-pulse" : "bg-emerald-500"
                  }`}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Relay:</span>
                <span>{isLocalLab ? "Local Lab" : "Public"}</span>
              </button>
            )}

            {/* Language toggle on mobile top bar */}
            <button
              type="button"
              onClick={onToggleLocale}
              aria-label={t.common.switchLang}
              title={t.common.switchLang}
              className="lg:hidden min-h-[36px] px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1"
            >
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <span>{locale.toUpperCase()}</span>
            </button>

            {topBarAction}

            {/* Theme toggle on mobile top bar */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? t.common.themeLight : t.common.themeDark}
              className="lg:hidden min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-600" />
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8 pb-24 lg:pb-12">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (64px) */}
      <nav
        aria-label={locale === "vi" ? "Thanh điều hướng di động" : "Mobile Navigation"}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 pb-safe border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md grid grid-cols-5 items-center shadow-lg"
      >
        {destinations.map((item) => {
          const Icon = NAV_ICONS[item.id];
          const isActive = item.id === activeNav;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectNav(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`min-h-[44px] min-w-[44px] h-full flex flex-col items-center justify-center gap-1 transition-all relative ${
                isActive
                  ? "text-zinc-900 dark:text-zinc-100 font-bold"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? "scale-105" : ""}`} />
              <span className="text-[11px] font-medium leading-none whitespace-nowrap">
                {item.shortLabel}
              </span>
              {isActive && (
                <span className="absolute top-1 w-6 h-0.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
