import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { distanceMiles, zipCenter, type Lang } from "../../shared/resources";
import { STRINGS, type Strings } from "./i18n";

export interface Settings {
  lang: Lang;
  zip: string;
  batterySaver: boolean;
  onboarded: boolean;
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  autoRead: boolean;
}

const prefers = (q: string) => typeof window !== "undefined" && window.matchMedia?.(q).matches === true;

// Start from the phone's own accessibility settings where the browser exposes them.
const DEFAULTS: Settings = {
  lang: "en",
  zip: "",
  batterySaver: false,
  onboarded: false,
  highContrast: prefers("(prefers-contrast: more)") || prefers("(forced-colors: active)"),
  largeText: false,
  reduceMotion: prefers("(prefers-reduced-motion: reduce)"),
  autoRead: false,
};
const SETTINGS_KEY = "lifeline.settings";

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
  /** Best known position: GPS if allowed, else the center of the saved ZIP. */
  origin: [number, number] | null;
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
    html.classList.toggle("dark", settings.batterySaver);
    html.classList.toggle("hc", settings.highContrast);
    html.classList.toggle("large-text", settings.largeText);
    html.classList.toggle("reduce-motion", settings.reduceMotion || settings.batterySaver);
    html.lang = settings.lang;
  }, [settings.batterySaver, settings.highContrast, settings.largeText, settings.reduceMotion, settings.lang]);

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
      origin: gps ?? (settings.zip ? zipCenter(settings.zip) : null),
    }),
    [settings, update, online, gps, gpsAccuracy, requestGps, watchGps, gpsError],
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
