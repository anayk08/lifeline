import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import { RESOURCES, openStatus, type Resource } from "../../shared/resources";
import { Page } from "../components/Shell";
import { CATEGORY_EMOJI, Icon, ResourceCard, StatusBadge } from "../components/ui";
import { go, useApp } from "../lib/app";
import { inCategory } from "../lib/search";

const SAN_JOSE: [number, number] = [37.3337, -121.8907];

function pin(r: Resource) {
  const state = openStatus(r).state;
  const ring = state === "open" ? "#1e9e5a" : state === "closed" ? "#75777e" : "#ffad2e";
  return L.divIcon({
    className: "pin",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div style="width:36px;height:36px;border-radius:50%;background:#fff;border:3px solid ${ring};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 1px 4px rgba(0,0,0,.35)">${CATEGORY_EMOJI[r.category]}</div>`,
  });
}

export default function MapPage() {
  const { t, origin, gps, online } = useApp();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Resource | null>(null);
  const filters = [
    { key: "all", label: t.filterAll },
    { key: "pharmacy", label: `💊 ${t.medicine}` },
    { key: "food", label: `🍲 ${t.food}` },
    { key: "cooling", label: `❄️ ${t.stayCool}` },
    { key: "charging", label: `⚡ ${t.charge}` },
  ];
  const shown = useMemo(
    () => RESOURCES.filter((r) => filter === "all" || inCategory(r, filter) || (filter === "pharmacy" && r.category === "health")),
    [filter],
  );
  const icons = useMemo(() => new Map(RESOURCES.map((r) => [r.id, pin(r)])), []);

  return (
    <Page tab="map">
      <div className="flex gap-2 overflow-x-auto -mx-gutter px-gutter pb-1" role="toolbar" aria-label="Filter">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`shrink-0 px-3 min-h-[44px] rounded-full border text-label-md ${
              filter === f.key ? "bg-primary-container text-white border-primary-container" : "bg-surface-container-lowest border-surface-variant"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative -mx-gutter h-[58vh] border-y border-surface-variant">
        <MapContainer center={origin ?? SAN_JOSE} zoom={origin ? 13 : 11} className="h-full w-full" zoomControl={false}>
          {/* Tiles come from the network or the offline tile cache; pins always render from saved data. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {gps && (
            <CircleMarker center={gps} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#146eb4", fillOpacity: 1 }}>
              <Tooltip>{t.locationOn}</Tooltip>
            </CircleMarker>
          )}
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

      {selected ? (
        <div className="flex flex-col gap-2">
          <ResourceCard r={selected} miles={null} />
          <button type="button" onClick={() => go(`/place/${selected.id}`)} className="text-label-md text-primary underline underline-offset-4 self-start min-h-[44px]">
            {t.hours} · {t.services} <Icon name="chevron_right" />
          </button>
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant flex items-center gap-2">
          <StatusBadge status={{ state: "open" }} /> {shown.filter((r) => openStatus(r).state === "open").length} / {shown.length}
        </p>
      )}
    </Page>
  );
}
