import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { BY_ID, distanceMiles, openStatus, type Resource } from "../../shared/resources";
import type { RouteKind, RouteOption, RouteResult } from "../../shared/routes";
import { useApp } from "../lib/app";
import { planRoutes } from "../lib/backend";
import { CATEGORY_EMOJI, Icon, StatusBadge, statusLine } from "./ui";

const WALK_MPH = 3; // typical walking pace
const DETOUR = 1.25; // streets are longer than a straight line

function pin(r: Resource, n: number, selected: boolean, contrast: boolean) {
  const state = openStatus(r).state;
  const ring = contrast ? "#000" : state === "open" ? "#1e9e5a" : state === "closed" ? "#75777e" : "#ffad2e";
  const size = selected ? 48 : 38;
  const bg = selected ? (contrast ? "#ffff00" : "#ffad2e") : "#fff";
  return L.divIcon({
    className: "pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${selected ? 5 : 3}px solid ${ring};display:flex;align-items:center;justify-content:center;font-size:${selected ? 22 : 18}px;box-shadow:0 1px 5px rgba(0,0,0,.4)">${CATEGORY_EMOJI[r.category]}<span style="position:absolute;top:-8px;right:-8px;min-width:22px;height:22px;border-radius:11px;background:#0b1f3a;color:#fff;font:700 13px/22px sans-serif;text-align:center;border:2px solid #fff">${n}</span></div>`,
  });
}

/** Zooms the map to show the resident and every pin. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    // Points are compared by value through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

const KIND_ICON: Record<RouteKind, string> = { fastest_walk: "🚶", easiest_walk: "🚶", fastest_drive: "🚗" };

export default function AnswerMap({ ids }: { ids: string[] }) {
  const { t, origin, gps, settings, online } = useApp();
  const places = useMemo(() => ids.map((id) => BY_ID.get(id)).filter((r): r is Resource => !!r), [ids]);
  const [selectedId, setSelectedId] = useState(places[0]?.id ?? "");
  const [routes, setRoutes] = useState<Record<string, RouteResult | "loading" | "error">>({});
  const [chosen, setChosen] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const contrast = settings.highContrast;

  const selected = places.find((p) => p.id === selectedId) ?? places[0];
  const routeState = selected ? routes[selected.id] : undefined;
  const options: RouteOption[] = routeState && typeof routeState === "object" ? routeState.options : [];
  const option = options[chosen];

  useEffect(() => {
    if (!selected || !origin || !online || routes[selected.id]) return;
    setRoutes((r) => ({ ...r, [selected.id]: "loading" }));
    planRoutes(origin, [selected.lat, selected.lng], settings.lang)
      .then((res) => setRoutes((r) => ({ ...r, [selected.id]: res })))
      .catch(() => setRoutes((r) => ({ ...r, [selected.id]: "error" })));
  }, [selected, origin, online, routes, settings.lang]);

  if (!places.length) return null;

  const pick = (id: string) => {
    setSelectedId(id);
    setChosen(0);
    setShowSteps(false);
  };

  const crowMiles = (r: Resource) => (origin ? distanceMiles(origin[0], origin[1], r.lat, r.lng) : null);
  const fromLabel = gps ? t.fromYou : settings.zip ? t.fromZip(settings.zip) : "";
  const kindLabel = (k: RouteKind) => (k === "fastest_walk" ? t.fastestWalk : k === "easiest_walk" ? t.easiestWalk : t.fastestDrive);
  const mapsUrl = (r: Resource, mode: "walking" | "driving" | "transit") =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address)}&travelmode=${mode}${
      origin ? `&origin=${origin[0]},${origin[1]}` : ""
    }`;

  const points: [number, number][] = [...places.map((p) => [p.lat, p.lng] as [number, number]), ...(origin ? [origin] : [])];

  return (
    <section aria-labelledby="answer-map-title" className="flex flex-col gap-2">
      <h2 id="answer-map-title" className="text-headline-md text-primary flex items-center gap-2">
        <Icon name="map" /> {t.mapOfResults}
      </h2>
      <p className="text-body-md text-on-surface-variant">{t.pickPlace}</p>

      {/* The map is a visual aid; the list below has the same places and is the accessible way to choose. */}
      <div className="relative -mx-gutter h-[42vh] min-h-[260px] border-y border-surface-variant" aria-hidden="true">
        {/* No wheel zoom or one-finger drag, so scrolling the page never gets stuck on the map. */}
        <MapContainer
          center={points[0]}
          zoom={13}
          className="h-full w-full"
          zoomControl={false}
          keyboard={false}
          scrollWheelZoom={false}
          dragging={!L.Browser.mobile}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />
          <FitBounds points={points} />
          {option && (
            <Polyline
              positions={option.line}
              pathOptions={{
                color: contrast ? "#000" : option.mode === "walk" ? "#146eb4" : "#0b1f3a",
                weight: contrast ? 7 : 6,
                opacity: 0.9,
                dashArray: option.mode === "walk" ? "2 10" : undefined,
                lineCap: "round",
              }}
            />
          )}
          {origin && (
            <CircleMarker center={origin} radius={10} pathOptions={{ color: "#fff", weight: 3, fillColor: contrast ? "#000" : "#146eb4", fillOpacity: 1 }} />
          )}
          {places.map((r, i) => (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={pin(r, i + 1, r.id === selected?.id, contrast)}
              zIndexOffset={r.id === selected?.id ? 1000 : 0}
              keyboard={false}
              eventHandlers={{ click: () => pick(r.id) }}
            />
          ))}
        </MapContainer>
      </div>

      <ol className="flex flex-col gap-2" aria-label={t.placesFound(places.length)}>
        {places.map((r, i) => {
          const miles = crowMiles(r);
          const status = openStatus(r);
          const isSel = r.id === selected?.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick(r.id)}
                aria-pressed={isSel}
                className={`w-full text-left rounded-2xl border-2 p-3 flex gap-3 items-start focus:outline-none focus:ring-4 focus:ring-secondary-container ${
                  isSel ? "border-primary-container bg-surface-container-low" : "border-surface-variant bg-surface-container-lowest"
                }`}
              >
                <span className="shrink-0 w-8 h-8 rounded-full bg-primary-container text-white text-label-md flex items-center justify-center" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="text-label-lg text-primary">
                    <span aria-hidden="true">{CATEGORY_EMOJI[r.category]} </span>
                    {r.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
                    <StatusBadge status={status} />
                    {statusLine(status, t) && <span>{statusLine(status, t)}</span>}
                    {miles !== null && (
                      <span>
                        {t.miAway(miles.toFixed(1))} ({t.straightLine})
                      </span>
                    )}
                  </span>
                </span>
                {isSel && <span className="sr-only">{t.selected}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {selected && (
        <div className="bg-surface-container-lowest border-2 border-primary-container rounded-2xl p-4 flex flex-col gap-3" aria-live="polite">
          <h3 className="text-headline-md text-primary">
            {t.howToGetThere}: {selected.name}
          </h3>
          {selected.tags.includes("wheelchair") && (
            <p className="text-body-md flex items-center gap-2">
              <span aria-hidden="true">♿</span> {t.wheelchair}
            </p>
          )}

          {!origin && <p className="text-body-md">{t.setLocationForRoutes}</p>}

          {origin && routeState === "loading" && (
            <p role="status" className="text-body-md flex items-center gap-2">
              <Icon name="hourglass_top" className="animate-pulse" /> {t.routesLoading}
            </p>
          )}

          {origin && (!online || routeState === "error") && (
            <div className="flex flex-col gap-1">
              <p className="text-body-md">{online ? t.routeError : t.routesOffline}</p>
              {crowMiles(selected) !== null && (
                <p className="text-label-lg">
                  🚶 {t.walkEstimate(Math.max(1, Math.round(((crowMiles(selected)! * DETOUR) / WALK_MPH) * 60)))}
                </p>
              )}
            </div>
          )}

          {options.length > 0 && (
            <div role="radiogroup" aria-label={t.howToGetThere} className="grid gap-2">
              {options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={i === chosen}
                  onClick={() => {
                    setChosen(i);
                    setShowSteps(false);
                  }}
                  className={`text-left rounded-xl border-2 px-3 py-2 min-h-[56px] focus:outline-none focus:ring-4 focus:ring-secondary-container ${
                    i === chosen ? "border-primary-container bg-surface-container-low" : "border-surface-variant"
                  }`}
                >
                  <span className="block text-label-lg">
                    <span aria-hidden="true">{KIND_ICON[o.kinds[0]]} </span>
                    {o.kinds.map(kindLabel).join(" · ")}
                  </span>
                  <span className="block text-body-md text-on-surface-variant">
                    {t.minutes(Math.max(1, Math.round(o.seconds / 60)))} · {(o.meters / 1609.34).toFixed(1)} mi
                    {o.mode === "walk" && <> · {o.climbMeters * 3.28 < 15 ? t.flat : t.climb(Math.round(o.climbMeters * 3.28))}</>}
                    {" · "}
                    {t.turns(o.turns)}
                  </span>
                </button>
              ))}
              {selected.transit && (
                <a
                  href={mapsUrl(selected, "transit")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border-2 border-surface-variant px-3 py-2 min-h-[56px] block"
                >
                  <span className="block text-label-lg">
                    <span aria-hidden="true">🚌 </span>
                    {t.transitLabel}
                  </span>
                  <span className="block text-body-md text-on-surface-variant">{selected.transit}</span>
                </a>
              )}
              {fromLabel && <p className="text-label-sm text-on-surface-variant">{fromLabel}</p>}
            </div>
          )}

          {option && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                aria-expanded={showSteps}
                onClick={() => setShowSteps((s) => !s)}
                className="self-start inline-flex items-center gap-1 text-label-md text-primary underline underline-offset-4 min-h-[44px]"
              >
                <Icon name="directions" /> {showSteps ? t.hideSteps : t.showSteps}
              </button>
              {showSteps && (
                <ol className="list-decimal pl-6 flex flex-col gap-1 text-body-md">
                  {option.steps.map((s, i) => (
                    <li key={i}>{s.text}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <a
            href={mapsUrl(selected, option?.mode === "drive" ? "driving" : "walking")}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[56px] px-space-md bg-secondary-container text-[#151c24] text-headline-md rounded-2xl flex items-center justify-center gap-2 border-2 border-primary-container focus:outline-none focus:ring-4 focus:ring-secondary-container"
          >
            <Icon name="open_in_new" /> {t.openInMaps}
          </a>
        </div>
      )}
    </section>
  );
}
