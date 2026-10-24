// Shared by the web app and the Lambda functions, so Leslie and the offline UI all reason about the same verified listings.
import raw from "../data/resources.json";

export type Category =
  | "pharmacy"
  | "food"
  | "cooling"
  | "charging"
  | "health"
  | "shelter"
  | "water"
  | "ev_charging";
export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type Lang = "en" | "es" | "vi";

export interface Resource {
  id: string;
  name: string;
  category: Category;
  tags: string[];
  address: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  /** A day with no key means its hours are unclear in the source; null means no hours at all. */
  hours: Partial<Record<DayKey, [string, string][]>> | null;
  hoursNote: string | null;
  services: string[];
  languages: string[];
  eligibility: string | null;
  notes: string | null;
  /** Whether the place is operating, per the team's check ("unknown" = not confirmed). */
  status: "open" | "closed" | "unknown";
  /** How likely the place is to be affected by a power outage, per the team's sheet. */
  outageRisk: string | null;
  transit: string | null;
  source: string;
  lastVerified: string;
}

export const RESOURCES = raw as Resource[];
export const BY_ID = new Map(RESOURCES.map((r) => [r.id, r]));

export const DAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const TIME_ZONE = "America/Los_Angeles";
export const STALE_AFTER_DAYS = 30;

/** Day of week and minutes since midnight in San José, whatever the device's time zone. */
export function sanJoseNow(date = new Date()): { day: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").toLowerCase().slice(0, 3) as DayKey;
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export interface OpenStatus {
  state: "open" | "closed" | "unknown";
  is24h?: boolean;
  closesAt?: string; // "HH:MM"
  opensAt?: string; // "HH:MM"
  opensDay?: DayKey; // set when the next opening is on a later day
}

export function openStatus(r: Resource, date = new Date()): OpenStatus {
  if (r.status === "closed") return { state: "closed" };
  if (!r.hours) return { state: "unknown" };
  const { day, minutes } = sanJoseNow(date);
  const dayIdx = DAYS.indexOf(day);
  if (!r.hours[day]) return { state: "unknown" };

  // A range from yesterday that runs past midnight (e.g. 22:00 to 02:00) can still be open.
  const yesterday = r.hours[DAYS[(dayIdx + 6) % 7]] ?? [];
  for (const [o, c] of yesterday) {
    if (toMinutes(c) <= toMinutes(o) && minutes < toMinutes(c)) return { state: "open", closesAt: c };
  }

  const today = r.hours[day] ?? [];
  for (const [o, c] of today) {
    const open = toMinutes(o);
    let close = toMinutes(c);
    if (close <= open) close += 24 * 60;
    if (open === 0 && close >= 24 * 60) {
      const allWeek = DAYS.every((d) => (r.hours?.[d] ?? []).some(([a, b]) => a === "00:00" && toMinutes(b) >= 24 * 60));
      return { state: "open", is24h: allWeek, closesAt: allWeek ? undefined : c };
    }
    if (minutes >= open && minutes < close) return { state: "open", closesAt: c };
  }

  const later = today.find(([o]) => toMinutes(o) > minutes);
  if (later) return { state: "closed", opensAt: later[0] };
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(dayIdx + i) % 7];
    const first = r.hours[d]?.[0];
    if (first) return { state: "closed", opensAt: first[0], opensDay: d };
  }
  return { state: "closed" };
}

export function hoursToday(r: Resource, date = new Date()): string {
  if (!r.hours) return "Hours not listed";
  const ranges = r.hours[sanJoseNow(date).day] ?? [];
  if (ranges.length === 0) return "Closed today";
  return ranges
    .map(([o, c]) => (o === "00:00" && toMinutes(c) >= 24 * 60 ? "Open 24 hours" : `${formatTime(o)} to ${formatTime(c)}`))
    .join(", ");
}

export function daysSinceVerified(r: Resource, date = new Date()): number {
  const verified = new Date(`${r.lastVerified}T12:00:00-08:00`).getTime();
  return Math.max(0, Math.floor((date.getTime() - verified) / 86_400_000));
}

export const isStale = (r: Resource, date = new Date()) => daysSinceVerified(r, date) > STALE_AFTER_DAYS;

export function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

// Approximate centers of San José ZIP codes, used when a resident or an outage
// is known only by ZIP. Accurate to roughly half a mile, which is enough to rank nearby help.
export const ZIP_CENTERS: Record<string, [number, number]> = {
  "95110": [37.345, -121.91], "95111": [37.283, -121.827], "95112": [37.344, -121.883],
  "95113": [37.333, -121.891], "95116": [37.35, -121.851], "95117": [37.312, -121.962],
  "95118": [37.256, -121.889], "95119": [37.231, -121.79], "95120": [37.205, -121.84],
  "95121": [37.305, -121.81], "95122": [37.329, -121.834], "95123": [37.245, -121.83],
  "95124": [37.256, -121.923], "95125": [37.296, -121.893], "95126": [37.326, -121.917],
  "95127": [37.373, -121.8], "95128": [37.316, -121.936], "95129": [37.306, -122.0],
  "95130": [37.288, -121.985], "95131": [37.387, -121.897], "95132": [37.403, -121.85],
  "95133": [37.372, -121.86], "95134": [37.413, -121.945], "95135": [37.3, -121.75],
  "95136": [37.27, -121.85], "95138": [37.25, -121.77], "95139": [37.226, -121.765],
  "95148": [37.33, -121.78],
};

export function zipCenter(zip: string): [number, number] | null {
  return ZIP_CENTERS[zip] ?? null;
}

export interface Ranked {
  resource: Resource;
  miles: number | null;
  status: OpenStatus;
}

/** Listings sorted open-first, then by distance from the given point (if any). */
export function rankResources(
  list: Resource[],
  from: [number, number] | null,
  date = new Date(),
): Ranked[] {
  const order = { open: 0, unknown: 1, closed: 2 } as const;
  return list
    .map((resource) => ({
      resource,
      miles: from ? distanceMiles(from[0], from[1], resource.lat, resource.lng) : null,
      status: openStatus(resource, date),
    }))
    .sort((a, b) => order[a.status.state] - order[b.status.state] || (a.miles ?? 0) - (b.miles ?? 0));
}

export const CATEGORY_LABELS: Record<Category, string> = {
  pharmacy: "Pharmacy",
  food: "Food",
  cooling: "Cooling center",
  charging: "Charging",
  health: "Hospital or clinic",
  shelter: "Shelter",
  water: "Drinking water",
  ev_charging: "EV charging",
};
