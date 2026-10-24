import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { BY_ID, openStatus, type Category, type Resource } from "../../shared/resources";
import type { RouteKind, RouteOption, RouteResult } from "../../shared/routes";
import { useApp } from "../lib/app";
import { planRoutes } from "../lib/backend";
import { Icon, StatusBadge, statusLine } from "./ui";

// One color per kind of help, used for pins and their number badges.
export const CATEGORY_COLOR: Record<Category, string> = {
  pharmacy: "#d6336c",
  health: "#c92a2a",
  food: "#e8590c",
  cooling: "#1c7ed6",
  charging: "#7048e8",
  shelter: "#2b8a3e",
  water: "#0c8599",
  ev_charging: "#495057",
};

// One color per route option, used for the line on the map and its button.
const ROUTE_COLOR: Record<RouteKind, string> = {
  fastest_walk: "#1971c2",
  easiest_walk: "#2f9e44",
  fastest_drive: "#e8590c",
};
const KIND_ICON: Record<RouteKind, string> = { fastest_walk: "🚶", easiest_walk: "🚶", fastest_drive: "🚗" };

const minutesOf = (o: RouteOption) => Math.max(1, Math.round(o.seconds / 60));
const milesOf = (o: RouteOption) => (o.meters / 1609.34).toFixed(1);

function pin(r: Resource, n: number, selected: boolean, contrast: boolean, walkMin: number | null) {
  const color = contrast ? "#000" : CATEGORY_COLOR[r.category];
  const closed = openStatus(r).state === "closed";
  const size = selected ? 50 : 36;
  const ring = selected ? (contrast ? "#ffd400" : "#ffffff") : "#ffffff";
  const label =
    selected && walkMin !== null
      ? `<span style="position:absolute;top:${size - 2}px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#fff;color:#111;border:2px solid ${color};border-radius:10px;padding:0 6px;font:700 12px/18px sans-serif">🚶 ${walkMin} min</span>`
      : "";
  return L.divIcon({
    className: "pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:${closed ? 0.55 : 1};border:${selected ? 5 : 3}px solid ${ring};outline:${selected ? `3px solid ${color}` : "none"};display:flex;align-items:center;justify-content:center;font:800 ${selected ? 22 : 17}px/1 sans-serif;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.45)">${n}${label}</div>`,
  });
}

/** Zooms the map to show the resident and every pin, leaving room for the pop-up card. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1)
      map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [30, 30], paddingBottomRight: [30, 190], maxZoom: 15 });
    // Points are compared by value through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

type RouteState = RouteResult | "loading" | "error";

export default function AnswerMap({ ids }: { ids: string[] }) {
  const { t, origin, settings, online } = useApp();
  const places = useMemo(() => ids.map((id) => BY_ID.get(id)).filter((r): r is Resource => !!r), [ids]);
  const [openId, setOpenId] = useState<string | null>(places[0]?.id ?? null);
  const [routes, setRoutes] = useState<Record<string, RouteState>>({});
  const [chosen, setChosen] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const contrast = settings.highContrast;

  // Fetch real routes for every pin at once, so each pin can show its walking time.
  useEffect(() => {
    if (!origin || !online) return;
    for (const r of places) {
      setRoutes((s) => (s[r.id] ? s : { ...s, [r.id]: "loading" }));
      planRoutes(origin, [r.lat, r.lng], settings.lang)
        .then((res) => setRoutes((s) => ({ ...s, [r.id]: res })))
        .catch(() => setRoutes((s) => ({ ...s, [r.id]: "error" })));
    }
  }, [places, origin, online, settings.lang]);

  if (!places.length) return null;

  const open = places.find((p) => p.id === openId) ?? null;
  const optionsFor = (id: string): RouteOption[] => {
    const s = routes[id];
    return s && typeof s === "object" ? s.options : [];
  };
  const walkMinutes = (id: string) => {
    const walk = optionsFor(id).find((o) => o.kinds.includes("fastest_walk"));
    return walk ? minutesOf(walk) : null;
  };
  const options = open ? optionsFor(open.id) : [];
  const option = options[chosen];
  const routeState = open ? routes[open.id] : undefined;

  const select = (id: string) => {
    setOpenId(id);
    setChosen(0);
    setShowSteps(false);
  };

  const kindLabel = (k: RouteKind) => (k === "fastest_walk" ? t.fastestWalk : k === "easiest_walk" ? t.easiestWalk : t.fastestDrive);
  const mapsUrl = (r: Resource, mode: "walking" | "driving" | "transit") =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address)}&travelmode=${mode}${
      origin ? `&origin=${origin[0]},${origin[1]}` : ""
    }`;
  const points: [number, number][] = [...places.map((p) => [p.lat, p.lng] as [number, number]), ...(origin ? [origin] : [])];

  return (
    <section aria-label={t.mapOfResults} className="relative -mx-gutter h-full min-h-[260px]">
      {/* Keyboard and screen-reader users pick places here; sighted mouse and touch users tap the pins. */}
      <ol aria-label={t.placesFound(places.length)} className="sr-only">
        {places.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => select(r.id)}
              aria-pressed={r.id === openId}
              className="focus:not-sr-only focus:absolute focus:z-[600] focus:top-2 focus:left-2 focus:bg-secondary-container focus:text-[#151c24] focus:px-3 focus:py-2 focus:rounded-xl"
            >
              {i + 1}. {r.name}
              {walkMinutes(r.id) !== null ? `, ${t.minutes(walkMinutes(r.id)!)} ${t.fastestWalk.toLowerCase()}` : ""}
            </button>
          </li>
        ))}
      </ol>

      <div className="absolute inset-0" aria-hidden="true">
        <MapContainer
          center={points[0]}
          zoom={13}
          className="h-full w-full"
          zoomControl={false}
          keyboard={false}
          scrollWheelZoom={false}
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <FitBounds points={points} />
          {/* Every route option for the open place, the chosen one drawn bold on top. */}
          {options.map((o, i) =>
            i === chosen ? null : (
              <Polyline
                key={i}
                positions={o.line}
                pathOptions={{ color: contrast ? "#777" : ROUTE_COLOR[o.kinds[0]], weight: 4, opacity: 0.45 }}
              />
            ),
          )}
          {option && (
            <Polyline
              positions={option.line}
              pathOptions={{
                color: contrast ? "#000" : ROUTE_COLOR[option.kinds[0]],
                weight: 7,
                opacity: 0.95,
                dashArray: option.mode === "walk" ? "1 11" : undefined,
                lineCap: "round",
              }}
            />
          )}
          {origin && (
            <CircleMarker
              center={origin}
              radius={11}
              pathOptions={{ color: "#fff", weight: 4, fillColor: contrast ? "#000" : "#1971c2", fillOpacity: 1 }}
            />
          )}
          {places.map((r, i) => (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={pin(r, i + 1, r.id === openId, contrast, walkMinutes(r.id))}
              zIndexOffset={r.id === openId ? 1000 : 0}
              keyboard={false}
              eventHandlers={{ click: () => select(r.id) }}
            />
          ))}
        </MapContainer>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label={open.name}
          aria-live="polite"
          className="absolute z-[500] left-2 right-2 bottom-2 max-h-[58%] overflow-y-auto overscroll-contain bg-surface-container-lowest rounded-2xl shadow-[0_4px_18px_rgba(0,0,0,0.35)] border-2 p-2.5 flex flex-col gap-2"
          style={{ borderColor: contrast ? undefined : CATEGORY_COLOR[open.category] }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="shrink-0 w-8 h-8 rounded-full text-white text-label-md flex items-center justify-center"
              style={{ background: contrast ? "#000" : CATEGORY_COLOR[open.category] }}
            >
              {places.indexOf(open) + 1}
            </span>
            <a href={`#/place/${open.id}`} className="flex-1 min-w-0 text-label-lg text-primary underline underline-offset-2 truncate">
              {open.name}
            </a>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              aria-label={t.close}
              className="shrink-0 min-w-[44px] min-h-[44px] -my-1 rounded-xl flex items-center justify-center hover:bg-surface-container"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm text-on-surface-variant">
            <StatusBadge status={openStatus(open)} />
            {statusLine(openStatus(open), t) && <span>{statusLine(openStatus(open), t)}</span>}
            {open.tags.includes("wheelchair") && (
              <span title={t.wheelchair}>
                <span aria-hidden="true">♿</span>
                <span className="sr-only">{t.wheelchair}</span>
              </span>
            )}
          </div>

          {!origin && <p className="text-body-md">{t.setLocationForRoutes}</p>}
          {origin && !online && <p className="text-body-md">{t.routesNeedSignal}</p>}
          {origin && online && routeState === "loading" && (
            <p role="status" className="text-body-md flex items-center gap-2">
              <Icon name="hourglass_top" className="animate-pulse" /> {t.routesLoading}
            </p>
          )}
          {origin && online && routeState === "error" && <p className="text-body-md">{t.routeError}</p>}

          {options.length > 0 && (
            <div role="radiogroup" aria-label={t.howToGetThere} className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-1.5">
              {options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={i === chosen}
                  aria-label={`${o.kinds.map(kindLabel).join(", ")}: ${t.minutes(minutesOf(o))}, ${milesOf(o)} mi`}
                  onClick={() => {
                    setChosen(i);
                    setShowSteps(false);
                  }}
                  className={`text-left rounded-xl border-[3px] px-2 py-1 min-h-[52px] ${i === chosen ? "bg-surface-container-low" : ""}`}
                  style={{ borderColor: i === chosen ? (contrast ? undefined : ROUTE_COLOR[o.kinds[0]]) : "var(--surface-variant)" }}
                >
                  <span className="block text-label-lg whitespace-nowrap">
                    <span aria-hidden="true">{KIND_ICON[o.kinds[0]]} </span>
                    {t.minutes(minutesOf(o))}
                  </span>
                  <span className="block text-[0.75rem] leading-4 font-bold text-on-surface-variant">
                    {o.kinds.length > 1 ? t.fastestEasiest : kindLabel(o.kinds[0])}
                  </span>
                </button>
              ))}
              {open.transit && (
                <a
                  href={mapsUrl(open, "transit")}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={open.transit}
                  className="rounded-xl border-[3px] border-surface-variant px-2 py-1 min-h-[52px]"
                >
                  <span className="block text-label-lg">
                    <span aria-hidden="true">🚌 </span>
                    {t.transitShort}
                  </span>
                  <span className="block text-[0.75rem] leading-4 font-bold text-on-surface-variant truncate">{open.transit}</span>
                </a>
              )}
            </div>
          )}

          {option && (
            <p className="text-label-sm text-on-surface-variant">
              {milesOf(option)} mi{option.mode === "walk" && <> · {option.climbMeters * 3.28 < 15 ? t.flat : t.climb(Math.round(option.climbMeters * 3.28))}</>} · {t.turns(option.turns)}
            </p>
          )}

          {option && showSteps && (
            <ol className="list-decimal pl-6 flex flex-col gap-1 text-body-md">
              {option.steps.map((s, i) => (
                <li key={i}>{s.text}</li>
              ))}
            </ol>
          )}

          <div className="flex gap-2">
            {option && (
              <button
                type="button"
                aria-expanded={showSteps}
                onClick={() => setShowSteps((s) => !s)}
                className="min-h-[48px] px-3 rounded-xl border-2 border-surface-variant text-label-md flex items-center gap-1"
              >
                <Icon name="directions" /> {showSteps ? t.hideSteps : t.showSteps}
              </button>
            )}
            <a
              href={mapsUrl(open, option?.mode === "drive" ? "driving" : "walking")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-[48px] px-3 bg-secondary-container text-[#151c24] text-label-lg rounded-xl flex items-center justify-center gap-1 border-2 border-primary-container"
            >
              <Icon name="open_in_new" /> {t.go}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
