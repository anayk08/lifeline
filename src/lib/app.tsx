import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DemoId, LiveHazard } from "../../shared/hazards";
import { distanceMiles, zipCenter, type Lang } from "../../shared/resources";
import { getHazards } from "./backend";
import { STRINGS, type Strings } from "./i18n";

export interface Settings {
  lang: Lang;
  zip: string;
  /** Dark colors instead of the light Figma palette. */
  darkMode: boolean;
  onboarded: boolean;
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  autoRead: boolean;
  /** Demo mode: a simulated hazard (picked at random) added to the live alerts, or null when off. */
  demo: DemoId | null;
  /** A place the person typed as their area ("Spartan Village"); only the latest is kept. */
  area: { label: string; lat: number; lng: number } | null;
  /** The person agreed to send questions and locations to the AI and map services (see DataNotice). */
  dataNotice: boolean;
}

const prefers = (q: string) => typeof window !== "undefined" && window.matchMedia?.(q).matches === true;

// Start from the phone's own accessibility settings where the browser exposes them.
const DEFAULTS: Settings = {
  lang: "en",
  zip: "",
  darkMode: prefers("(prefers-color-scheme: dark)"),
  onboarded: false,
  highContrast: prefers("(prefers-contrast: more)") || prefers("(forced-colors: active)"),
  largeText: false,
  reduceMotion: prefers("(prefers-reduced-motion: reduce)"),
  autoRead: false,
  demo: null,
  area: null,
  dataNotice: false,
};
const SETTINGS_KEY = "lifeline.settings";
const HAZARDS_KEY = "lifeline.hazards";
const HAZARD_REFRESH_MS = 5 * 60_000;

interface SavedHazards {
  hazards: LiveHazard[];
  /** When the list was last fetched; shown as "as of 2:14 PM" when it may be out of date. */
  fetchedAt: string | null;
  /** Which demo the list included, if any. */
  demo: string | null;
}

// Storage can be unavailable (private mode, blocked site data), so every access is guarded.
export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

interface AppState {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  t: Strings;
  online: boolean;
  gps: [number, number] | null;
  /** How precise the GPS fix is, in meters. */
  gpsAccuracy: number | null;
  requestGps: () => void;
  watchGps: () => () => void;
  gpsError: boolean;
  /** Best known position: GPS if allowed, else a place they typed, else the center of the saved ZIP. */
  origin: [number, number] | null;
  /** What `origin` is, for labels: "gps", "area" or "zip". */
  originSource: "gps" | "area" | "zip" | null;
  /** Active alerts, newest list we have (live, or saved from the last time we had a signal). */
  hazards: LiveHazard[];
  hazardsAt: string | null;
  /** False when the list is from an earlier fetch (offline, or the last refresh failed). */
  hazardsFresh: boolean;
}

const Ctx = createContext<AppState | null>(null);

function initialLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en";
  return nav.startsWith("es") ? "es" : nav.startsWith("vi") ? "vi" : "en";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() =>
    readStore(SETTINGS_KEY, { ...DEFAULTS, lang: initialLang() }),
  );
  const [online, setOnline] = useState(() => navigator.onLine);
  const [gps, setGps] = useState<[number, number] | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeStore(SETTINGS_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", settings.darkMode);
    html.classList.toggle("hc", settings.highContrast);
    html.classList.toggle("large-text", settings.largeText);
    html.classList.toggle("reduce-motion", settings.reduceMotion);
    html.lang = settings.lang;
  }, [settings.darkMode, settings.highContrast, settings.largeText, settings.reduceMotion, settings.lang]);

  // Only move the position when it changes by more than ~25 m, so GPS jitter
  // doesn't re-rank lists or refetch routes every second.
  const applyPosition = useCallback((pos: GeolocationPosition) => {
    const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
    setGps((prev) => (prev && distanceMiles(prev[0], prev[1], next[0], next[1]) < 0.016 ? prev : next));
    setGpsAccuracy(Math.round(pos.coords.accuracy));
    setGpsError(false);
  }, []);

  const requestGps = useCallback(() => {
    if (!("geolocation" in navigator)) return setGpsError(true);
    navigator.geolocation.getCurrentPosition(applyPosition, () => setGpsError(true), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60_000,
    });
  }, [applyPosition]);

  /** Follows the phone's exact position while a map is open. Returns a stop function. */
  const watchGps = useCallback(() => {
    if (!("geolocation" in navigator)) return () => {};
    const id = navigator.geolocation.watchPosition(applyPosition, () => setGpsError(true), {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 10_000,
    });
    return () => navigator.geolocation.clearWatch(id);
  }, [applyPosition]);

  // Live alerts: on load, every 5 minutes, when the app comes back to the front, and when
  // the signal or demo mode changes. The last list is saved so it still shows offline.
  const [saved, setSaved] = useState<SavedHazards>(() => readStore(HAZARDS_KEY, { hazards: [], fetchedAt: null, demo: null }));
  const [lastFetchOk, setLastFetchOk] = useState(false);
  const hazardsFresh = online && lastFetchOk;
  const demo = settings.demo;
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    const refresh = () =>
      getHazards(demo)
        .then((feed) => {
          if (cancelled) return;
          const next = { hazards: feed.hazards, fetchedAt: feed.fetchedAt, demo };
          setSaved(next);
          writeStore(HAZARDS_KEY, next);
          setLastFetchOk(true);
        })
        .catch(() => !cancelled && setLastFetchOk(false));
    refresh();
    const timer = window.setInterval(refresh, HAZARD_REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [online, demo]);
  // Turning demo mode off (or picking another scenario) hides the old simulated alert right away.
  const hazards = useMemo(
    () => saved.hazards.filter((h) => h.source !== "Simulated" || h.id === `demo-${demo}`),
    [saved.hazards, demo],
  );

  // GPS works without a data connection, so ask once if the browser already allows it.
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => p.state === "granted" && requestGps())
      .catch(() => {});
  }, [requestGps]);

  const value = useMemo<AppState>(
    () => ({
      settings,
      update,
      t: STRINGS[settings.lang],
      online,
      gps,
      gpsAccuracy,
      requestGps,
      watchGps,
      gpsError,
      origin: gps ?? (settings.area ? [settings.area.lat, settings.area.lng] : settings.zip ? zipCenter(settings.zip) : null),
      originSource: gps ? "gps" : settings.area ? "area" : settings.zip && zipCenter(settings.zip) ? "zip" : null,
      hazards,
      hazardsAt: saved.fetchedAt,
      hazardsFresh,
    }),
    [settings, update, online, gps, gpsAccuracy, requestGps, watchGps, gpsError, hazards, saved.fetchedAt, hazardsFresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

/** Minimal hash router: "#/place/abc" -> ["place", "abc"]. Hash routing works on static hosting with no rewrites. */
export function useRoute(): string[] {
  const parse = () =>
    window.location.hash
      .replace(/^#\/?/, "")
      .split("?")[0]
      .split("/")
      .filter(Boolean)
      .map(decodeURIComponent);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onHash = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export function queryParam(name: string): string | null {
  const q = window.location.hash.split("?")[1];
  return q ? new URLSearchParams(q).get(name) : null;
}

export const go = (path: string) => {
  window.location.hash = path;
};
