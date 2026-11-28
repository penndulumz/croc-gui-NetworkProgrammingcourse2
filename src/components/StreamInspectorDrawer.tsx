import { useState } from "react";
import { ChevronRight, Activity, Zap } from "lucide-react";
import type { EnhancedProgress } from "../protocol/enhanced/enhanced-client";
import { getTranslations, type Locale } from "../lib/i18n";

export interface StreamInspectorDrawerProps {
  progress: EnhancedProgress;
  locale: Locale;
  alphaRttMs?: number | null;
  betaRttMs?: number | null;
}

function renderRttBadge(rttLabel: string, rttMs?: number | null) {
  if (typeof rttMs === "number") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-sans font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <Zap className="h-2 w-2" />
        {rttMs}ms
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-1 text-[9px] font-sans font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      {rttLabel}: N/A
    </span>
  );
}

function renderSeveredBadge(label: string) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-sans font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
      <Activity className="h-2 w-2" />
      {label}
    </span>
  );
}

export function StreamInspectorDrawer({
  progress,
  locale,
  alphaRttMs,
  betaRttMs,
}: StreamInspectorDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = getTranslations(locale);
  const alphaSevered = !progress.alphaAlive;
  const betaSevered = progress.betaAlive === false;

  return (
    <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
      >
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        <span>{t.streamInspector.toggleBtn}</span>
      </button>

      {isOpen && (
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">
          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-sans">
                {t.streamInspector.relayAlpha}
              </span>
              {alphaSevered
                ? renderSeveredBadge(t.streamInspector.statusSevered)
                : renderRttBadge(t.streamInspector.rttLabel, alphaRttMs)}
            </div>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{progress.alphaChunks}</span>
            <span className="text-[10px] text-zinc-500 block font-sans">{t.streamInspector.evenChunks}</span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-sans">
                {t.streamInspector.relayBeta}
              </span>
              {betaSevered
                ? renderSeveredBadge(t.streamInspector.statusSevered)
                : renderRttBadge(t.streamInspector.rttLabel, betaRttMs)}
            </div>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{progress.betaChunks}</span>
            <span className="text-[10px] text-zinc-500 block font-sans">{t.streamInspector.oddChunks}</span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-sans">
                {t.streamInspector.failover}
              </span>
              {(alphaSevered || betaSevered) && renderSeveredBadge(t.streamInspector.statusSevered)}
            </div>
            <span
              className={`text-sm font-bold ${
                progress.failoverChunks > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {progress.failoverChunks}
            </span>
            <span className="text-[10px] text-zinc-500 block font-sans">{t.streamInspector.failoverRerouted}</span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900 shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-sans">
              {t.streamInspector.resumeDb}
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {progress.resumedChunks}
            </span>
            <span className="text-[10px] text-zinc-500 block font-sans">{t.streamInspector.cachedSkip}</span>
          </div>
        </div>
      )}
    </div>
  );
}
