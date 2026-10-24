import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { situationHazard } from "../../shared/hazards";
import { RESOURCES, openStatus, type Category, type Resource } from "../../shared/resources";
import { CATEGORY_COLOR, CategoryFilter, LocationPointer } from "../components/mapParts";
import { Page } from "../components/Shell";
import { CATEGORY_EMOJI, Icon, ResourceCard, StatusBadge } from "../components/ui";
import { go, useApp } from "../lib/app";

const SAN_JOSE: [number, number] = [37.3337, -121.8907];

// Listed hours say open, but a place the team couldn't confirm is operating still shows as "call ahead".
const pinState = (r: Resource) => {
  const state = openStatus(r).state;
  return state === "open" && r.status === "unknown" ? "unknown" : state;
};

// Emblem pins: the kind of place in its color, with a ring for open / call ahead / closed.
function pin(r: Resource, contrast: boolean) {
  const state = pinState(r);
  const ring = state === "open" ? "#1e9e5a" : state === "closed" ? "#75777e" : "#ffad2e";
  const bg = contrast ? "#fff" : CATEGORY_COLOR[r.category];
  return L.divIcon({
    className: "pin",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div style="width:38px;height:38px;border-radius:50%;background:${bg};border:4px solid ${contrast ? "#000" : ring};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 1px 4px rgba(0,0,0,.4)">${CATEGORY_EMOJI[r.category]}</div>`,
  });
}

/** Moves the map to the resident's location when they ask for it. */
function FlyTo({ to, nonce }: { to: [number, number] | null; nonce: number }) {
  const map = useMap();
  const flown = useRef(0);
  useEffect(() => {
    // Once per button press, as soon as a position is known (it can arrive a moment later).
    if (to && nonce > flown.current) {
      flown.current = nonce;
      map.flyTo(to, 16, { duration: 0.6 });
    }
  }, [nonce, to, map]);
  return null;
}

export default function MapPage() {
  const { t, origin, gps, gpsAccuracy, online, settings, requestGps, watchGps, hazards } = useApp();
  const alerts = hazards.filter((h) => h.center && h.severity !== "info");
  const contrast = settings.highContrast;
  const [hidden, setHidden] = useState<Set<Category>>(new Set());
  const [selected, setSelected] = useState<Resource | null>(null);
  const [flyNonce, setFlyNonce] = useState(0);

  // Follow the phone's exact position while the map is open.
  useEffect(() => watchGps(), [watchGps]);

  const categories = useMemo(() => {
    const present = new Set(RESOURCES.map((r) => r.category));
    return (Object.keys(CATEGORY_COLOR) as Category[]).filter((c) => present.has(c));
  }, []);
  const counts = useMemo(
    () => RESOURCES.reduce((a, r) => ((a[r.category] = (a[r.category] ?? 0) + 1), a), {} as Partial<Record<Category, number>>),
    [],
  );
  const shown = useMemo(() => RESOURCES.filter((r) => !hidden.has(r.category)), [hidden]);
  const icons = useMemo(() => new Map(RESOURCES.map((r) => [r.id, pin(r, contrast)])), [contrast]);

  return (
    <Page tab="map">
      <CategoryFilter categories={categories} hidden={hidden} onChange={setHidden} counts={counts} />

      <div className="relative -mx-gutter h-[56vh] border-y border-surface-variant">
        <MapContainer center={origin ?? SAN_JOSE} zoom={origin ? 13 : 11} className="h-full w-full" zoomControl={false}>
          {/* Tiles come from the network or the offline tile cache; pins always render from saved data. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <FlyTo to={gps} nonce={flyNonce} />
          {/* Active alerts with a known area, drawn the same way as on Leslie's answer map. */}
          {alerts.map((h) => (
            <Circle
              key={h.id}
              center={h.center!}
              radius={h.radiusMiles * 1609.34}
              pathOptions={
                contrast
                  ? { color: "#000", weight: 3, dashArray: "8 6", fillColor: "#000", fillOpacity: 0.12 }
                  : { color: "#e03131", weight: 2, fillColor: "#e03131", fillOpacity: 0.15 }
              }
            >
              <Tooltip permanent direction="center" className="hazard-label">
                {t.hazardArea(t.hazardNames[situationHazard(h.type)] ?? h.title, h.radiusMiles)}
                {h.source === "Simulated" && ` · ${t.simulatedDemo}`}
              </Tooltip>
            </Circle>
          ))}
          {gps && <LocationPointer at={gps} label={t.youAreHere} accuracyMeters={gpsAccuracy} contrast={contrast} />}
          {shown.map((r) => (
            <Marker
              key={r.id}
              position={[r.lat, r.lng]}
              icon={icons.get(r.id)}
              title={r.name}
              eventHandlers={{ click: () => setSelected(r) }}
            />
          ))}
        </MapContainer>

        <button
          type="button"
          onClick={() => {
            requestGps();
            setFlyNonce((n) => n + 1);
          }}
          aria-label={t.locateMe}
          className="absolute z-[500] bottom-3 right-3 min-w-[52px] min-h-[52px] rounded-full bg-surface-container-lowest border-2 border-surface-variant shadow-md flex items-center justify-center text-primary"
        >
          <Icon name="my_location" />
        </button>
        {gps && gpsAccuracy != null && (
          <p className="absolute z-[500] bottom-3 left-3 bg-surface-container-lowest border-2 border-surface-variant rounded-xl px-2 py-1 text-[0.75rem] font-bold">
            {t.accuracy(gpsAccuracy)}
          </p>
        )}
        {!online && (
          <div className="absolute top-2 left-2 right-2 z-[500] bg-primary-container text-white rounded-xl px-3 py-2 text-label-sm flex items-center gap-2">
            <Icon name="offline_bolt" className="!text-[18px]" /> {t.offlineReadyDetail(RESOURCES.length)}
          </div>
        )}
      </div>

      <div className="flex gap-3 text-label-sm text-on-surface-variant flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-[3px] border-[#1e9e5a]" />{t.openNow}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-[3px] border-[#ffad2e]" />{t.hoursUnknown}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-[3px] border-[#75777e]" />{t.closedNow}</span>
      </div>

      {selected && !hidden.has(selected.category) ? (
        <div className="flex flex-col gap-2">
          <ResourceCard r={selected} miles={null} />
          <button type="button" onClick={() => go(`/place/${selected.id}`)} className="text-label-md text-primary underline underline-offset-4 self-start min-h-[44px]">
            {t.hours} · {t.services} <Icon name="chevron_right" />
          </button>
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant flex items-center gap-2">
          <StatusBadge status={{ state: "open" }} /> {shown.filter((r) => pinState(r) === "open").length} / {shown.length}
        </p>
      )}
    </Page>
  );
}
