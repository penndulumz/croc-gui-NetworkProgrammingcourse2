import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { AppShell } from "./components/AppShell";
import { SendView } from "./components/SendView";
import { ReceiveView } from "./components/ReceiveView";
import { RelaysView } from "./components/RelaysView";
import { HistoryGroupView } from "./components/HistoryGroupView";
import { AppDocsHubView } from "./components/AppDocsHubView";
import { ProtocolInspector } from "./components/ProtocolInspector";
import { OfflineIndicator, PWAInstallButton } from "./components/PWAInstallButton";
import {
  ensureRuntimeConfig,
  extractBridgePublicConfig,
  fetchBridgeHealth,
  fetchBridgeStatus,
  type BridgeStatusResponse,
} from "./lib/bridge-client";
import {
  loadDeviceAlias,
  loadTransferHistory,
  saveDeviceAlias,
  type PeerPreset,
  type TransferHistoryEntry,
} from "./lib/history-store";
import {
  loadRelayProfile,
  saveRelayProfile,
  type RelayProfileMode,
} from "./lib/relay-manager";
import {
  applyThemeToDocument,
  persistTheme,
  resolveInitialTheme,
  toggleThemeMode,
  type ThemeMode,
} from "./lib/theme";
import {
  persistLocale,
  resolveInitialLocale,
  type Locale,
} from "./lib/i18n";
import type { NavDestinationId } from "./types/navigation";

function readInitialQueryParams(): {
  nav: NavDestinationId;
  code?: string;
  mode?: "standard" | "enhanced";
} {
  if (typeof window === "undefined") return { nav: "send" };
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code")?.trim();
  const modeParam = params.get("mode");
  const mode = modeParam === "standard" || modeParam === "enhanced" ? modeParam : undefined;
  if (code) {
    return { nav: "receive", code, mode };
  }
  return { nav: "send" };
}

export const App: React.FC = () => {
  const initialQuery = useMemo(() => readInitialQueryParams(), []);

  const [activeNav, setActiveNav] = useState<NavDestinationId>(initialQuery.nav);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return resolveInitialTheme(
      typeof window !== "undefined" ? window.localStorage : null,
      prefersDark ?? true,
    );
  });

  const [locale, setLocale] = useState<Locale>(() => {
    return resolveInitialLocale(typeof window !== "undefined" ? window.localStorage : null);
  });

  const [bridgeHealthy, setBridgeHealthy] = useState<boolean | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatusResponse | null>(null);
  const [relayProfile, setRelayProfile] = useState<RelayProfileMode>(() => loadRelayProfile());
  const [deviceAlias, setDeviceAlias] = useState<string>(() => loadDeviceAlias());
  const [history, setHistory] = useState<TransferHistoryEntry[]>(() => loadTransferHistory());

  const [targetPeerForSend, setTargetPeerForSend] = useState<PeerPreset | undefined>(undefined);
  const [prefillSendCode, setPrefillSendCode] = useState<string | undefined>(undefined);
  const [prefillReceiveCode, setPrefillReceiveCode] = useState<string | undefined>(
    initialQuery.code,
  );
  const [prefillReceiveMode, setPrefillReceiveMode] = useState<"standard" | "enhanced" | undefined>(
    initialQuery.mode,
  );
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  useEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme, window.localStorage);
  }, [theme]);

  useEffect(() => {
    persistLocale(locale, window.localStorage);
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const loadBridge = useCallback(async (signal?: AbortSignal) => {
    try {
      await ensureRuntimeConfig(signal);
      const [healthy, status] = await Promise.all([
        fetchBridgeHealth(signal),
        fetchBridgeStatus(signal),
      ]);
      setBridgeHealthy(healthy);
      setBridgeStatus(status);
    } catch {
      if (signal?.aborted) return;
      setBridgeHealthy(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBridge(controller.signal);
    return () => controller.abort();
  }, [loadBridge]);

  const bridgeConfig = useMemo(
    () => extractBridgePublicConfig(bridgeStatus),
    [bridgeStatus],
  );

  const handleBridgeOriginChanged = useCallback(() => {
    // Drop status from the previous Bridge Server before probing the new one.
    setBridgeStatus(null);
    setBridgeHealthy(null);
    void loadBridge();
  }, [loadBridge]);

  const handleToggleTheme = () => {
    setTheme((prev) => toggleThemeMode(prev));
  };

  const handleToggleLocale = () => {
    setLocale((prev) => (prev === "vi" ? "en" : "vi"));
  };

  const handleChangeRelayProfile = (next: RelayProfileMode) => {
    setRelayProfile(next);
    saveRelayProfile(next);
  };

  const handleUpdateDeviceAlias = (next: string) => {
    const saved = saveDeviceAlias(next);
    setDeviceAlias(saved);
  };

  const handleRefreshHistory = useCallback(() => {
    setHistory(loadTransferHistory());
    void loadBridge();
  }, [loadBridge]);

  const handleUseCodeForSend = (code: string) => {
    setPrefillSendCode(code);
    setActiveNav("send");
  };

  const handleQuickSendToPeer = (peer: PeerPreset) => {
    setTargetPeerForSend(peer);
    setActiveNav("send");
  };

  const handleUseCodeForReceive = (code: string) => {
    setPrefillReceiveCode(code);
    setActiveNav("receive");
  };

  const showInspectorSplit = activeNav === "send" || activeNav === "receive";

  return (
    <AppShell
      activeNav={activeNav}
      onSelectNav={setActiveNav}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      locale={locale}
      onToggleLocale={handleToggleLocale}
      bridgeHealthy={bridgeHealthy}
      relayProfile={relayProfile}
      deviceAlias={deviceAlias}
      topBarAction={<PWAInstallButton compact />}
    >
      {showInspectorSplit ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          <div>
            {activeNav === "send" ? (
              <SendView
                locale={locale}
                bridgeConfig={bridgeConfig}
                deviceAlias={deviceAlias}
                relayProfile={relayProfile}
                onChangeRelayProfile={handleChangeRelayProfile}
                prefillCode={prefillSendCode}
                onClearPrefill={() => setPrefillSendCode(undefined)}
                onHistoryUpdated={handleRefreshHistory}
                selectedPeer={targetPeerForSend}
                onClearSelectedPeer={() => setTargetPeerForSend(undefined)}
              />
            ) : (
              <ReceiveView
                locale={locale}
                bridgeConfig={bridgeConfig}
                deviceAlias={deviceAlias}
                relayProfile={relayProfile}
                onChangeRelayProfile={handleChangeRelayProfile}
                prefillCode={prefillReceiveCode}
                prefillMode={prefillReceiveMode}
                onClearPrefill={() => {
                  setPrefillReceiveCode(undefined);
                  setPrefillReceiveMode(undefined);
                }}
                onHistoryUpdated={handleRefreshHistory}
              />
            )}
          </div>

          {/* Desktop sticky inspector; Mobile collapsible drawer */}
          <div className="xl:sticky xl:top-20">
            <div className="xl:hidden">
              <button
                type="button"
                aria-expanded={mobileInspectorOpen}
                onClick={() => setMobileInspectorOpen((prev) => !prev)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-zinc-200/80 bg-white/95 px-4 py-2.5 text-xs font-semibold text-zinc-900 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/95 dark:text-zinc-100"
              >
                <span className="inline-flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  {locale === "vi"
                    ? "Bảng soi giao thức trực tiếp (PAKE · Chunk · Tốc độ)"
                    : "Live Protocol Inspector (PAKE · Chunk · Speed)"}
                </span>
                {mobileInspectorOpen ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              {mobileInspectorOpen && (
                <div className="mt-3">
                  <ProtocolInspector locale={locale} />
                </div>
              )}
            </div>

            <div className="hidden xl:block">
              <ProtocolInspector locale={locale} />
            </div>
          </div>
        </div>
      ) : activeNav === "relays" ? (
        <RelaysView
          locale={locale}
          bridgeConfig={bridgeConfig}
          relayStatus={bridgeStatus}
          relayProfile={relayProfile}
          onChangeRelayProfile={handleChangeRelayProfile}
          onRefreshStatus={() => void loadBridge()}
          onBridgeOriginChanged={handleBridgeOriginChanged}
        />
      ) : activeNav === "history" ? (
        <HistoryGroupView
          locale={locale}
          deviceAlias={deviceAlias}
          onUpdateDeviceAlias={handleUpdateDeviceAlias}
          history={history}
          onRefreshHistory={handleRefreshHistory}
          onUseCodeForSend={handleUseCodeForSend}
          onUseCodeForReceive={handleUseCodeForReceive}
          onQuickSendToPeer={handleQuickSendToPeer}
        />
      ) : (
        <AppDocsHubView
          locale={locale}
          history={history}
          deviceAlias={deviceAlias}
          onHistoryUpdated={handleRefreshHistory}
        />
      )}

      <OfflineIndicator />
    </AppShell>
  );
};

export default App;
