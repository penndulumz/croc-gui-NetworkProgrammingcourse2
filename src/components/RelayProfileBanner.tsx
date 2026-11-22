import { AlertCircle } from "lucide-react";
import { getTranslations, type Locale } from "../lib/i18n";
import { isLocalLabProfile, type RelayProfileMode } from "../lib/relay-manager";

export interface RelayProfileBannerProps {
  relayProfile: RelayProfileMode;
  mode: "standard" | "enhanced";
  locale: Locale;
  busy?: boolean;
  onChangeRelayProfile?: (profile: "public" | "local-lab") => void;
}

export function RelayProfileBanner({
  relayProfile,
  mode,
  locale,
  busy = false,
  onChangeRelayProfile,
}: RelayProfileBannerProps) {
  const t = getTranslations(locale);
  const isLocalProfile = isLocalLabProfile(relayProfile);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3.5 py-2 text-xs border border-zinc-200/70 dark:bg-zinc-900/60 dark:border-zinc-800/70">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">{t.relayProfile.activeLabel}</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isLocalProfile ? "bg-emerald-400 animate-pulse" : "bg-emerald-500"
              }`}
              aria-hidden="true"
            />
            {isLocalProfile ? t.relayProfile.localLabTitle : t.relayProfile.publicRelaysTitle}
          </span>
        </div>
        {onChangeRelayProfile && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeRelayProfile(isLocalProfile ? "public" : "local-lab")}
            title={isLocalProfile ? t.relayProfile.switchToPublicTitle : t.relayProfile.switchToLocalTitle}
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium underline-offset-2 hover:underline disabled:opacity-50 transition-colors"
          >
            {t.relayProfile.switchBtn}
          </button>
        )}
      </div>

      {mode === "standard" && isLocalProfile && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-50/5 p-3.5 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div>
              <p className="font-semibold">{t.relayProfile.standardLocalNoticeTitle}</p>
              <p className="mt-1 leading-relaxed text-amber-800 dark:text-amber-300">
                {t.relayProfile.standardLocalNoticeBody}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
