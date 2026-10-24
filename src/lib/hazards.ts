import { situationHazard, type LiveHazard } from "../../shared/hazards";
import { readStore } from "./app";
import type { Strings } from "./i18n";
import type { SituationResult } from "../../shared/situation";

/**
 * The situation a live alert implies, in the same shape Leslie returns, so maps and rankings
 * work the same with or without her (offline, or when she can't be reached).
 */
export function liveSituation(
  live: LiveHazard | null,
  origin: [number, number] | null,
  zip: string,
  fromGps: boolean,
  originLabel?: string,
): SituationResult | null {
  if (!live) return null;
  return {
    hazardType: situationHazard(live.type),
    hazardPoint: live.center ? { label: live.place ?? live.title, lat: live.center[0], lng: live.center[1] } : null,
    hazardRadiusMiles: live.center ? live.radiusMiles : undefined,
    needs: [],
    origin: origin
      ? {
          label: originLabel ?? (fromGps ? "your location" : `ZIP ${zip}`),
          lat: origin[0],
          lng: origin[1],
          source: originLabel ? "stated" : fromGps ? "gps" : "zip",
        }
      : null,
    notFound: [],
    flaggedIds: [],
    alert: { id: live.id, title: live.title, source: live.source, sourceUrl: live.sourceUrl, place: live.place },
  };
}

/** "12 min ago" style age, in the app language. */
export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
}

/** "M6.2 earthquake near SJSU" in the app language (feed titles stay as published). */
export function alertTitle(h: LiveHazard, t: Strings): string {
  // Live alerts keep their official names; simulated ones read in the app language.
  const title =
    h.type === "earthquake" && h.magnitude != null
      ? t.quakeTitle(h.magnitude.toFixed(1))
      : h.source === "Simulated"
        ? t.alertNames[h.type] ?? h.title
        : h.title;
  return h.place ? `${title} ${t.near(h.place)}` : title;
}

export const timeOfDay = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

// Only the last position and the last plan are kept on the phone, never a history.
export const LAST_POSITION_KEY = "lifeline.lastPosition";
export const LAST_PLAN_KEY = "lifeline.lastPlan";

export interface SavedPlan {
  alert: LiveHazard | null;
  summary: string;
  picks: { rightNow: string[]; then: string[] } | null;
  lang: string;
}

/** For Ask: the plan's summary as earlier conversation, so follow-ups keep its context. */
export function planHistory(): { role: "user" | "assistant"; text: string }[] {
  const saved = readStore<SavedPlan | null>(LAST_PLAN_KEY, null);
  if (!saved?.alert || !saved.summary) return [];
  return [
    { role: "user", text: `I'm affected by the ${saved.alert.title}${saved.alert.place ? ` near ${saved.alert.place}` : ""}. Make me a plan.` },
    { role: "assistant", text: saved.summary },
  ];
}
