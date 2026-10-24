// The map on Home, the full-screen map and the plan, in the Figma style: category-colored
// pins with line icons, numbered badges for recommendations, alert circles and "You".
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { AttributionControl, Circle, MapContainer, Marker, Polygon, Polyline, ScaleControl, TileLayer, useMap } from "react-leaflet";
import boundary from "../../data/san-jose-boundary.json";
import { situationHazard } from "../../shared/hazards";
import { HAZARD_RADIUS_MILES, openStatus, type Resource } from "../../shared/resources";
import type { SituationResult } from "../../shared/situation";
import collapseMap from "../assets/figma/collapse-map.svg";
import expandMap from "../assets/figma/expand-map.svg";
import locationAccuracy from "../assets/figma/location-accuracy.svg";
import yourLocation from "../assets/figma/your-location.svg";
import { useApp } from "../lib/app";
import { CATEGORY_STYLE, FIcon, figmaIconUrl } from "./figma";

export interface MapPlace {
  r: Resource;
  /** Recommendation number shown on the pin (Leslie's or the plan's options). */
  n?: number;
}

export interface RouteLine {
  points: [number, number][];
  color: string;
  dashed: boolean;
}

const SAN_JOSE: [number, number] = [37.3352, -121.8811];
// City limits, so it's clear the verified places cover San José only.
const CITY_OUTLINE = boundary.outline as [number, number][];
const HAZARD_RED = "#e03131";

function pinIcon(r: Resource, n: number | undefined, selected: boolean, contrast: boolean) {
  const style = CATEGORY_STYLE[r.category];
  const color = contrast ? "#000" : style.pin;
  const size = selected ? 36 : 28;
  const glyph = selected ? 17 : 14;
  const closed = openStatus(r).state === "closed";
  const badge =
    n != null
      ? `<span style="position:absolute;left:${size - 9}px;top:-5px;min-width:15px;height:15px;border-radius:99px;background:#163b3b;color:#fff;font:700 9px/15px Inter,sans-serif;text-align:center;padding:0 3px;border:1px solid #fff">${n}</span>`
      : "";
  return L.divIcon({
    className: "pin",
    iconSize: [size, size + 5],
    // The tip of the pin sits on the place.
    iconAnchor: [size / 2, size + 5],
    html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;opacity:${closed ? 0.55 : 1}">
      <span style="width:${size}px;height:${size}px;border-radius:99px;background:${color};display:flex;align-items:center;justify-content:center;${selected ? "border:3px solid #fff;" : ""}box-shadow:0 1px 3px rgba(0,51,51,.35)">
        <span class="ficon" style="width:${glyph}px;height:${glyph}px;color:#fff;--icon:url(&quot;${figmaIconUrl(style.icon)}&quot;)"></span>
      </span>
      <span class="ficon" style="width:8px;height:5px;color:${color};--icon:url(&quot;${figmaIconUrl("pin-tip")}&quot;)"></span>
      ${badge}
    </div>`,
  });
}

const youIcon = (label: string) =>
  L.divIcon({
    className: "pin",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div style="position:relative;width:32px;height:32px">
      <img src="${locationAccuracy}" alt="" width="32" height="32" style="position:absolute;inset:0"/>
      <img src="${yourLocation}" alt="" width="16" height="16" style="position:absolute;left:8px;top:8px"/>
      <span style="position:absolute;left:30px;top:9px;font:600 10px/14px Inter,sans-serif;color:#163b3b;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff">${label}</span>
    </div>`,
  });

/** Fits the pins, "You" and the hazard in view whenever the set of places changes. */
function FitView({ points, padBottom, focus }: { points: [number, number][]; padBottom: number; focus: [number, number] | null }) {
  const map = useMap();
  const key = focus ? `focus:${focus.join(",")}` : points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (focus) map.setView(focus, 14, { animate: false });
    else if (points.length === 1) map.setView(points[0], 15, { animate: false });
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [24, 40], paddingBottomRight: [24, padBottom], maxZoom: 15, animate: false });
    // Points are compared by value through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Hands the Leaflet map to controls that live outside it (so they stay reachable by keyboard). */
function MapHandle({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => onMap(map), [map, onMap]);
  return null;
}

export default function HomeMap({
  places,
  selectedId,
  onSelect,
  situation,
  route,
  className = "h-[15.625rem]",
  expanded,
  onToggleExpand,
  padBottom = 30,
  recenterBottom = "1.25rem",
  fit = true,
  wheelZoom = false,
}: {
  places: MapPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  situation?: SituationResult | null;
  route?: RouteLine | null;
  className?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  padBottom?: number;
  /** Where the recenter button sits, above any floating panel. */
  recenterBottom?: string;
  /** Fit every pin in view (numbered options); otherwise stay on the person, like a street map. */
  fit?: boolean;
  /** Mouse-wheel zoom, only where the map fills the screen (elsewhere the wheel scrolls the page). */
  wheelZoom?: boolean;
}) {
  const { t, settings, origin: appOrigin, hazards, requestGps } = useApp();
  const [map, setMap] = useState<L.Map | null>(null);
  // Bring a place picked from a list into view.
  const picked = places.find((p) => p.r.id === selectedId)?.r;
  useEffect(() => {
    if (map && picked) map.panTo([picked.lat, picked.lng], { animate: !settings.reduceMotion });
  }, [map, picked, settings.reduceMotion]);
  const contrast = settings.highContrast;
  const so = situation?.origin;
  const origin: [number, number] | null = so ? [so.lat, so.lng] : appOrigin;

  // Alert circles: every active alert with a known area, plus a hazard the resident named.
  const alerts = hazards.filter((h) => h.center && h.severity !== "info");
  const named =
    situation?.hazardPoint && !alerts.some((h) => h.id === situation.alert?.id)
      ? { center: [situation.hazardPoint.lat, situation.hazardPoint.lng] as [number, number], radius: situation.hazardRadiusMiles ?? HAZARD_RADIUS_MILES, name: t.hazardNames[situation.hazardType] ?? t.hazardNames.other }
      : null;

  const points = useMemo<[number, number][]>(
    () => [
      ...places.map(({ r }) => [r.lat, r.lng] as [number, number]),
      ...(origin ? [origin] : []),
      ...(named ? [named.center] : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, origin?.[0], origin?.[1], named?.center[0], named?.center[1]],
  );
  const circleStyle = contrast
    ? { color: "#000", weight: 3, dashArray: "8 6", fillColor: "#000", fillOpacity: 0.1 }
    : { color: HAZARD_RED, weight: 2, fillColor: HAZARD_RED, fillOpacity: 0.12 };

  return (
    <section aria-label={t.mapOfResults} className={`relative isolate overflow-hidden rounded-2xl bg-map ${className}`}>
      {/* Keyboard and screen-reader users pick places here; touch users tap the pins. */}
      <ol aria-label={t.placesFound(places.length)} className="sr-only">
        {places.map(({ r, n }) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              aria-pressed={r.id === selectedId}
              className="focus:not-sr-only focus:absolute focus:z-[600] focus:top-2 focus:left-2 focus:bg-surface-container-lowest focus:px-3 focus:py-2 focus:rounded-xl"
            >
              {n != null ? `${n}. ` : ""}
              {r.name}
            </button>
          </li>
        ))}
      </ol>

      <div className="absolute inset-0" aria-hidden="true">
        <MapContainer center={origin ?? SAN_JOSE} zoom={14} className="h-full w-full" zoomControl={false} keyboard={false} scrollWheelZoom={wheelZoom} attributionControl={false}>
          <TileLayer
            attribution='<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="tiles-soft"
            maxZoom={19}
          />
          {/* OpenStreetMap's license needs a visible credit; it stays, kept tiny and without the Leaflet logo. */}
          <AttributionControl position="bottomright" prefix={false} />
          <ScaleControl position="bottomleft" imperial metric={false} maxWidth={60} />
          <Polygon
            positions={CITY_OUTLINE}
            interactive={false}
            pathOptions={{
              color: contrast ? "#000" : settings.darkMode ? "#7fd3cf" : "#075d60",
              weight: contrast ? 2 : 1.5,
              opacity: contrast ? 0.8 : 0.5,
              dashArray: "6 6",
              fillColor: "#075d60",
              fillOpacity: contrast ? 0 : 0.03,
            }}
          />
          <FitView points={points} padBottom={padBottom} focus={!fit && origin ? origin : null} />
          {alerts.map((h) => (
            <Circle key={h.id} center={h.center!} radius={h.radiusMiles * 1609.34} pathOptions={circleStyle} interactive={false} />
          ))}
          {named && <Circle center={named.center} radius={named.radius * 1609.34} pathOptions={circleStyle} interactive={false} />}
          {route && (
            <Polyline
              positions={route.points}
              pathOptions={{ color: contrast ? "#000" : route.color, weight: 6, opacity: 0.9, dashArray: route.dashed ? "1 10" : undefined, lineCap: "round" }}
            />
          )}
          {origin && <Marker position={origin} icon={youIcon(t.youAreHere)} keyboard={false} interactive={false} zIndexOffset={-100} />}
          {places.map(({ r, n }) => (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={pinIcon(r, n, r.id === selectedId, contrast)}
              zIndexOffset={r.id === selectedId ? 1000 : n != null ? 500 : 0}
              keyboard={false}
              eventHandlers={{ click: () => onSelect(r.id) }}
            />
          ))}
          <MapHandle onMap={setMap} />
        </MapContainer>
      </div>

      {/* Key for the alert circles, kept off the map so it never covers a pin. */}
      {(alerts.length > 0 || named) && (
        <ul className="absolute z-[500] left-2 top-2 max-w-[70%] flex flex-col gap-1 pointer-events-none">
          {alerts.map((h) => (
            <li key={h.id} className="hazard-chip">
              <span aria-hidden="true" className="hazard-dot" />
              {t.hazardArea(t.hazardNames[situationHazard(h.type)] ?? h.title, h.radiusMiles)}
              {h.source === "Simulated" && ` · ${t.simulatedDemo}`}
            </li>
          ))}
          {named && (
            <li className="hazard-chip">
              <span aria-hidden="true" className="hazard-dot" />
              {t.hazardArea(named.name, named.radius)}
            </li>
          )}
        </ul>
      )}

      <button
        type="button"
        onClick={() => {
          requestGps();
          if (origin) map?.flyTo(origin, 15, { duration: 0.5 });
        }}
        aria-label={t.locateMe}
        style={{ bottom: recenterBottom }}
        className="absolute z-[500] right-3 w-[2.125rem] h-[2.125rem] rounded-[10px] bg-surface-container-lowest border border-surface-variant shadow-[0_2px_5px_rgba(0,51,51,0.12)] flex items-center justify-center text-primary"
      >
        <FIcon name="locate-fixed" size={19} />
      </button>

      {onToggleExpand && (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? t.collapseMap : t.expandMap}
          className={`absolute z-[500] right-3 top-3 rounded-[10px] ${expanded ? "w-11 h-11" : "w-9 h-9"}`}
        >
          {/* The Figma button art includes its own white tile, border and shadow. */}
          {expanded ? (
            <img src={collapseMap} alt="" width={54} height={54} className="absolute max-w-none" style={{ left: "-11.36%", top: "-6.82%", width: "122.72%", height: "122.73%" }} />
          ) : (
            <img src={expandMap} alt="" width={46} height={46} className="absolute max-w-none" style={{ left: "-13.89%", top: "-8.33%", width: "127.78%", height: "127.77%" }} />
          )}
        </button>
      )}
    </section>
  );
}
