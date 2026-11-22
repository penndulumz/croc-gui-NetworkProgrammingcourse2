import type { Locale } from "../lib/i18n";
import { getTranslations } from "../lib/i18n";

export type NavDestinationId = "send" | "receive" | "relays" | "history" | "docs";

export interface NavDestination {
  id: NavDestinationId;
  label: string;
  shortLabel: string;
  breadcrumb: string;
  summary: string;
}

export function getNavDestinations(locale: Locale): NavDestination[] {
  const t = getTranslations(locale);
  return [
    {
      id: "send",
      label: t.nav.send,
      shortLabel: t.nav.sendShort,
      breadcrumb: t.nav.sendShort,
      summary: t.nav.sendSummary,
    },
    {
      id: "receive",
      label: t.nav.receive,
      shortLabel: t.nav.receiveShort,
      breadcrumb: t.nav.receiveShort,
      summary: t.nav.receiveSummary,
    },
    {
      id: "relays",
      label: t.nav.relays,
      shortLabel: t.nav.relaysShort,
      breadcrumb: t.nav.relaysShort,
      summary: t.nav.relaysSummary,
    },
    {
      id: "history",
      label: t.nav.history,
      shortLabel: t.nav.historyShort,
      breadcrumb: t.nav.historyShort,
      summary: t.nav.historySummary,
    },
    {
      id: "docs",
      label: t.nav.docs,
      shortLabel: t.nav.docsShort,
      breadcrumb: t.nav.docsShort,
      summary: t.nav.docsSummary,
    },
  ];
}

/** Legacy fallback export for backward compatibility */
export const NAV_DESTINATIONS: NavDestination[] = getNavDestinations("vi");
