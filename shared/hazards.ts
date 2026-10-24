// Live disaster alerts for San José from free public government feeds, normalized to one
// shape. Used by the laptop server, the Amplify Lambda and (types and helpers only) the app.
// Fetching needs no keys or AWS credentials.
import { distanceMiles, type SituationHazard } from "./resources";

export type AlertType =
  | "earthquake"
  | "extreme_heat"
  | "wildfire_smoke"
  | "wildfire_risk"
  | "wildfire"
  | "flood"
  | "power_outage"
  | "other";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertSource = "USGS" | "National Weather Service" | "CAL FIRE" | "Simulated";

export interface LiveHazard {
  id: string;
  type: AlertType;
  title: string;
  severity: AlertSeverity;
  startedAt: string; // ISO
  /** Center of the affected area; null means the alert covers the whole San José area. */
  center: [number, number] | null;
  radiusMiles: number;
  source: AlertSource;
  sourceUrl: string;
  /** Short place name for the banner, e.g. "SJSU" or "3 km NE of Milpitas, CA". */
  place?: string;
  magnitude?: number;
}

export interface HazardFeed {
  hazards: LiveHazard[];
  fetchedAt: string;
  /** Per source: when it last answered and whether the latest attempt worked. */
  sources: Record<string, { ok: boolean; checkedAt: string | null }>;
}

export const SAN_JOSE: [number, number] = [37.3337, -121.8907];
/** Rough radius of the city, so "anywhere in San José" can be checked without a location. */
export const SAN_JOSE_RADIUS_MILES = 9;
const NEARBY_MILES = 60;
const CACHE_MS = 2 * 60_000;
const USER_AGENT = "Lifeline (SpartHill Hacks 2026 demo)";

export const SJSU: [number, number] = [37.3352, -121.8811];
// Simulated scenarios for demo mode, one per kind of alert the app handles. Each one reaches SJSU and
// downtown, so the "Are you affected?" card shows during a demo. Always labeled "Simulated".
type DemoScenario = Omit<LiveHazard, "id" | "startedAt" | "source">;
export const DEMOS = {
  "earthquake-sjsu": {
    type: "earthquake", title: "M6.2 earthquake", severity: "critical", center: SJSU, radiusMiles: 5,
    sourceUrl: "https://earthquake.usgs.gov/earthquakes/map/", place: "SJSU", magnitude: 6.2,
  },
  "heat-san-jose": {
    type: "extreme_heat", title: "Excessive Heat Warning", severity: "critical", center: null, radiusMiles: 9,
    sourceUrl: "https://www.weather.gov/safety/heat", place: "San José",
  },
  "smoke-san-jose": {
    type: "wildfire_smoke", title: "Air Quality Alert (wildfire smoke)", severity: "warning", center: null, radiusMiles: 9,
    sourceUrl: "https://www.airnow.gov/", place: "San José",
  },
  "outage-downtown": {
    type: "power_outage", title: "Power outage", severity: "warning", center: [37.3382, -121.8863], radiusMiles: 1.5,
    sourceUrl: "https://www.ready.gov/power-outages", place: "Downtown San José",
  },
  "flood-guadalupe": {
    type: "flood", title: "Flash Flood Warning", severity: "critical", center: [37.3305, -121.9005], radiusMiles: 2,
    sourceUrl: "https://www.weather.gov/safety/flood", place: "Guadalupe River",
  },
  "wildfire-foothills": {
    type: "wildfire", title: "Wildfire (450 acres)", severity: "critical", center: [37.37, -121.79], radiusMiles: 6,
    sourceUrl: "https://www.ready.gov/wildfires", place: "East Foothills",
  },
} satisfies Record<string, DemoScenario>;
export type DemoId = keyof typeof DEMOS;
export const DEMO_IDS = Object.keys(DEMOS) as DemoId[];

/** A demo scenario other than the current one, so each pick is a change. */
export function randomDemo(current?: string | null): DemoId {
  const choices = DEMO_IDS.filter((id) => id !== current);
  return choices[Math.floor(Math.random() * choices.length)];
}

// ---- Helpers shared with the app ---------------------------------------------

/** Ranking and Leslie only know four hazard kinds; the rest rank as a general emergency. */
export function situationHazard(type: AlertType): SituationHazard {
  if (type === "earthquake" || type === "extreme_heat" || type === "wildfire_smoke" || type === "power_outage") return type;
  if (type === "wildfire") return "wildfire_smoke";
  return "other";
}

/** Whether the alert covers a point (or, with no point, any part of San José). */
export function covers(h: LiveHazard, at: [number, number] | null): boolean {
  if (!h.center) return true; // NWS zone alerts are only returned for San José's own point.
  if (at) return distanceMiles(at[0], at[1], h.center[0], h.center[1]) <= h.radiusMiles;
  return distanceMiles(SAN_JOSE[0], SAN_JOSE[1], h.center[0], h.center[1]) <= h.radiusMiles + SAN_JOSE_RADIUS_MILES;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Most serious first, then newest. */
export const byImportance = (a: LiveHazard, b: LiveHazard) =>
  SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.startedAt.localeCompare(a.startedAt);

const ALERT_TYPES: AlertType[] = ["earthquake", "extreme_heat", "wildfire_smoke", "wildfire_risk", "wildfire", "flood", "power_outage", "other"];
const SOURCES_ALLOWED: AlertSource[] = ["USGS", "National Weather Service", "CAL FIRE", "Simulated"];

/** Alerts arrive from the app with each question, so check every field before trusting it. */
export function sanitizeHazard(v: unknown): LiveHazard | null {
  if (!v || typeof v !== "object") return null;
  const h = v as Record<string, unknown>;
  const center = Array.isArray(h.center) && h.center.length === 2 ? (h.center.map(Number) as [number, number]) : null;
  if (center && !center.every(Number.isFinite)) return null;
  if (!ALERT_TYPES.includes(h.type as AlertType) || !SOURCES_ALLOWED.includes(h.source as AlertSource)) return null;
  if (!["info", "warning", "critical"].includes(h.severity as string)) return null;
  const text = (x: unknown, max = 160) => (typeof x === "string" ? x.slice(0, max) : "");
  const radius = Number(h.radiusMiles);
  return {
    id: text(h.id, 200),
    type: h.type as AlertType,
    title: text(h.title),
    severity: h.severity as AlertSeverity,
    startedAt: text(h.startedAt, 40),
    center,
    radiusMiles: Number.isFinite(radius) ? Math.min(Math.max(radius, 0.1), 60) : 1,
    source: h.source as AlertSource,
    sourceUrl: text(h.sourceUrl, 300),
    place: text(h.place) || undefined,
    magnitude: typeof h.magnitude === "number" ? h.magnitude : undefined,
  };
}

export const sanitizeHazards = (v: unknown): LiveHazard[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? safeParse(v) : [])
    .slice(0, 10)
    .map(sanitizeHazard)
    .filter((h): h is LiveHazard => !!h);

function safeParse(s: string): unknown[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** The alert that matters most for someone at `at`: a warning or worse that covers them. */
export function primaryHazard(hazards: LiveHazard[], at: [number, number] | null): LiveHazard | null {
  return hazards.filter((h) => h.severity !== "info" && covers(h, at)).sort(byImportance)[0] ?? null;
}

/** "M6.2 earthquake near SJSU" style text for prompts and labels. */
export const describeHazard = (h: LiveHazard) => `${h.title}${h.place ? ` near ${h.place}` : ""}`;

// ---- Parsers (checked against the live feeds on 2026-10-23) ------------------

interface UsgsFeature {
  id: string;
  properties: { mag: number | null; place: string | null; time: number; url: string; title: string; type: string };
  geometry: { coordinates: [number, number, number] };
}

/** M6 is about 5 miles; each magnitude step doubles or halves it. */
export const quakeRadius = (mag: number) => Math.max(1, Math.round(5 * 2 ** (mag - 6) * 10) / 10);
const quakeSeverity = (mag: number): AlertSeverity => (mag >= 6 ? "critical" : mag >= 4 ? "warning" : "info");

export function parseUsgs(json: { features?: UsgsFeature[] }): LiveHazard[] {
  return (json.features ?? [])
    .filter((f) => f.properties?.type === "earthquake" && typeof f.properties.mag === "number")
    .flatMap((f) => {
      const [lng, lat] = f.geometry.coordinates;
      if (distanceMiles(SAN_JOSE[0], SAN_JOSE[1], lat, lng) > NEARBY_MILES) return [];
      const mag = f.properties.mag!;
      return [
        {
          id: `usgs-${f.id}`,
          type: "earthquake" as const,
          title: `M${mag.toFixed(1)} earthquake`,
          severity: quakeSeverity(mag),
          startedAt: new Date(f.properties.time).toISOString(),
          center: [lat, lng] as [number, number],
          radiusMiles: quakeRadius(mag),
          source: "USGS" as const,
          sourceUrl: f.properties.url,
          place: f.properties.place ?? undefined,
          magnitude: mag,
        },
      ];
    });
}

interface NwsFeature {
  id: string;
  geometry: { type: string; coordinates: number[][][] } | null;
  properties: { event: string; severity: string; headline: string | null; onset: string | null; effective: string; areaDesc: string };
}

export function nwsType(event: string): AlertType {
  if (/excessive heat|extreme heat|heat advisory|heat warning|heat watch/i.test(event)) return "extreme_heat";
  if (/air quality|dense smoke|smoke/i.test(event)) return "wildfire_smoke";
  if (/red flag|fire weather/i.test(event)) return "wildfire_risk";
  if (/flood/i.test(event)) return "flood";
  return "other";
}

const nwsSeverity = (s: string): AlertSeverity => (/extreme|severe/i.test(s) ? "critical" : /moderate/i.test(s) ? "warning" : "info");

/** Center and radius of an alert polygon, or null for zone-only alerts. */
function polygonCircle(geometry: NwsFeature["geometry"]): { center: [number, number]; radiusMiles: number } | null {
  const ring = geometry?.type === "Polygon" ? geometry.coordinates[0] : null;
  if (!ring?.length) return null;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const radiusMiles = Math.max(...ring.map((p) => distanceMiles(lat, lng, p[1], p[0])));
  return { center: [lat, lng], radiusMiles: Math.round(radiusMiles * 10) / 10 };
}

export function parseNws(json: { features?: NwsFeature[] }): LiveHazard[] {
  return (json.features ?? []).map((f) => {
    const circle = polygonCircle(f.geometry);
    return {
      id: `nws-${f.id.split("/").pop()}`,
      type: nwsType(f.properties.event),
      title: f.properties.event,
      severity: nwsSeverity(f.properties.severity),
      startedAt: new Date(f.properties.onset ?? f.properties.effective).toISOString(),
      center: circle?.center ?? null,
      radiusMiles: circle?.radiusMiles ?? SAN_JOSE_RADIUS_MILES,
      source: "National Weather Service" as const,
      sourceUrl: f.id,
      place: f.properties.areaDesc,
    };
  });
}

interface CalFireIncident {
  Name: string;
  Started: string;
  Latitude: number;
  Longitude: number;
  IsActive: boolean;
  PercentContained: number | null;
  AcresBurned: number | null;
  Url: string;
  UniqueId: string;
  Location: string;
}

/** CAL FIRE's map list isn't a documented API, so anything unexpected throws and the source is skipped. */
export function parseCalFire(json: unknown): LiveHazard[] {
  if (!Array.isArray(json)) throw new Error("CAL FIRE: expected a list");
  return (json as CalFireIncident[]).flatMap((f) => {
    if (typeof f.Latitude !== "number" || typeof f.Longitude !== "number" || typeof f.Name !== "string") {
      throw new Error("CAL FIRE: unexpected incident format");
    }
    if (!f.IsActive || (f.PercentContained ?? 0) >= 100) return [];
    if (distanceMiles(SAN_JOSE[0], SAN_JOSE[1], f.Latitude, f.Longitude) > NEARBY_MILES) return [];
    const acres = f.AcresBurned ?? 0;
    return [
      {
        id: `calfire-${f.UniqueId}`,
        type: "wildfire" as const,
        title: `${f.Name.trim()}${acres ? ` (${Math.round(acres).toLocaleString("en-US")} acres)` : ""}`,
        severity: acres >= 1000 ? "critical" : "warning",
        startedAt: new Date(f.Started).toISOString(),
        center: [f.Latitude, f.Longitude] as [number, number],
        // Smoke and evacuations reach well past the fire line.
        radiusMiles: Math.max(3, Math.min(15, Math.sqrt(acres) / 10)),
        source: "CAL FIRE" as const,
        sourceUrl: `https://www.fire.ca.gov${f.Url}`,
        place: f.Location,
      },
    ];
  });
}

// ---- Fetching with a small in-memory cache -----------------------------------

const SOURCES: { name: AlertSource; url: string; parse: (json: never) => LiveHazard[]; headers?: Record<string, string> }[] = [
  {
    name: "USGS",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
    parse: parseUsgs,
  },
  {
    name: "National Weather Service",
    url: `https://api.weather.gov/alerts/active?point=${SAN_JOSE[0]},${SAN_JOSE[1]}`,
    parse: parseNws,
    // NWS requires a User-Agent that identifies the app.
    headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
  },
  {
    name: "CAL FIRE",
    url: "https://www.fire.ca.gov/api/sitecore/Incident/GetFiresForMap?showFeatured=false",
    parse: parseCalFire,
  },
];

interface SourceCache {
  hazards: LiveHazard[];
  ok: boolean;
  checkedAt: number | null; // last successful answer
  triedAt: number;
}
const cache = new Map<AlertSource, SourceCache>();

async function refresh(source: (typeof SOURCES)[number], now: number): Promise<SourceCache> {
  const prev = cache.get(source.name);
  if (prev && now - prev.triedAt < CACHE_MS) return prev;
  try {
    const res = await fetch(source.url, { headers: { "User-Agent": USER_AGENT, ...source.headers }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const next = { hazards: source.parse((await res.json()) as never), ok: true, checkedAt: now, triedAt: now };
    cache.set(source.name, next);
    return next;
  } catch (err) {
    // Keep the last good result so one flaky feed doesn't wipe out known alerts.
    console.warn(`hazards: ${source.name} failed (${(err as Error).message}); keeping last good result`);
    const kept = { hazards: prev?.hazards ?? [], ok: false, checkedAt: prev?.checkedAt ?? null, triedAt: now };
    cache.set(source.name, kept);
    return kept;
  }
}

const demoStartedAt = new Map<DemoId, number>();

/** A simulated alert that "started a few minutes ago" and keeps that start time across calls. */
export function demoHazard(id: DemoId, now = Date.now()): LiveHazard {
  const started = demoStartedAt.get(id);
  if (!started || now - started > 6 * 3_600_000) demoStartedAt.set(id, now - 4 * 60_000);
  const scenario: DemoScenario = DEMOS[id];
  return { ...scenario, id: `demo-${id}`, startedAt: new Date(demoStartedAt.get(id)!).toISOString(), source: "Simulated" };
}

export async function getHazards(demo?: string | null, now = Date.now()): Promise<HazardFeed> {
  const results = await Promise.all(SOURCES.map((s) => refresh(s, now)));
  const hazards = results.flatMap((r) => r.hazards);
  if (demo && demo in DEMOS) hazards.push(demoHazard(demo as DemoId, now));
  return {
    hazards: hazards.sort(byImportance),
    fetchedAt: new Date(now).toISOString(),
    sources: Object.fromEntries(
      SOURCES.map((s, i) => [s.name, { ok: results[i].ok, checkedAt: results[i].checkedAt ? new Date(results[i].checkedAt!).toISOString() : null }]),
    ),
  };
}
