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
  extractBridgePublicConfig,
  fetchBridgeHealth,
  fetchBridgeStatus,
  type BridgeStatusResponse,
} from "./lib/bridge-client";
import {
  loadDeviceAlias,
  loadTransferHistory,
  saveDeviceAlias,
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

  const [bridgeHealthy, setBridgeHealthy] = useState<boolean | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatusResponse | null>(null);
  const [relayProfile, setRelayProfile] = useState<RelayProfileMode>(() => loadRelayProfile());
  const [deviceAlias, setDeviceAlias] = useState<string>(() => loadDeviceAlias());
  const [history, setHistory] = useState<TransferHistoryEntry[]>(() => loadTransferHistory());

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

  const loadBridge = useCallback(async (signal?: AbortSignal) => {
    try {
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

  const handleToggleTheme = () => {
    setTheme((prev) => toggleThemeMode(prev));
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
      bridgeHealthy={bridgeHealthy}
      relayProfile={relayProfile}
      onChangeRelayProfile={handleChangeRelayProfile}
      deviceAlias={deviceAlias}
      topBarAction={<PWAInstallButton compact />}
    >
      {showInspectorSplit ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_370px] xl:items-start">
          <div>
            {activeNav === "send" ? (
              <SendView
                bridgeConfig={bridgeConfig}
                deviceAlias={deviceAlias}
                relayProfile={relayProfile}
                onChangeRelayProfile={handleChangeRelayProfile}
                prefillCode={prefillSendCode}
                onClearPrefill={() => setPrefillSendCode(undefined)}
                onHistoryUpdated={handleRefreshHistory}
              />
            ) : (
              <ReceiveView
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
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <span className="inline-flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  Bảng soi giao thức trực tiếp (PAKE · Chunk · Speed)
                </span>
                {mobileInspectorOpen ? (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              {mobileInspectorOpen && (
                <div className="mt-3">
                  <ProtocolInspector />
                </div>
              )}
            </div>

            <div className="hidden xl:block">
              <ProtocolInspector />
            </div>
          </div>
        </div>
      ) : activeNav === "relays" ? (
        <RelaysView
          bridgeConfig={bridgeConfig}
          relayStatus={bridgeStatus}
          relayProfile={relayProfile}
          onChangeRelayProfile={handleChangeRelayProfile}
          onRefreshStatus={() => void loadBridge()}
        />
      ) : activeNav === "history" ? (
        <HistoryGroupView
          deviceAlias={deviceAlias}
          onUpdateDeviceAlias={handleUpdateDeviceAlias}
          history={history}
          onRefreshHistory={handleRefreshHistory}
          onUseCodeForSend={handleUseCodeForSend}
          onUseCodeForReceive={handleUseCodeForReceive}
        />
      ) : (
        <AppDocsHubView
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
