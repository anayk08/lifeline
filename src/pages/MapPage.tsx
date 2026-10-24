// The Figma "Expanded map": the map fills the screen, with Ask Leslie, the area and the
// category tabs floating on top. Tapping a pin opens the place card.
import { useState, type FormEvent } from "react";
import { BY_ID, RESOURCES, distanceMiles } from "../../shared/resources";
import collapseMap from "../assets/figma/collapse-map.svg";
import CategoryTabs from "../components/CategoryTabs";
import { FIcon, TABS } from "../components/figma";
import HomeMap, { type RouteLine } from "../components/HomeMap";
import PlaceSheet from "../components/PlaceSheet";
import { go, useApp } from "../lib/app";
import { liveSituation } from "../lib/hazards";
import { primaryHazard } from "../../shared/hazards";

const FLOAT = "shadow-[0_2px_5px_rgba(0,51,51,0.12)]";

export default function MapPage() {
  const { t, settings, origin, originSource, hazards, online } = useApp();
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteLine | null>(null);
  const [query, setQuery] = useState("");

  const cats = TABS.find((x) => x.key === tab)?.categories ?? null;
  const places = RESOURCES.filter((r) => !cats || cats.includes(r.category)).map((r) => ({ r }));
  const live = primaryHazard(hazards, origin);
  const situation = liveSituation(live, origin, settings.zip, originSource === "gps", originSource === "area" ? settings.area?.label : undefined);
  const place = selected ? BY_ID.get(selected) ?? null : null;
  const areaLabel =
    originSource === "gps"
      ? t.yourLocation.charAt(0).toUpperCase() + t.yourLocation.slice(1)
      : originSource === "area"
        ? settings.area!.label
        : originSource === "zip"
          ? `ZIP ${settings.zip}`
          : t.chooseArea;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) go(`/?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="relative w-full max-w-md mx-auto h-[100dvh] overflow-hidden bg-map">
      <HomeMap
        places={places}
        selectedId={selected}
        onSelect={setSelected}
        situation={situation}
        route={place ? route : null}
        className="!absolute inset-0 !rounded-none"
        padBottom={place ? 420 : 140}
        recenterBottom={place ? "calc(100% - 13rem)" : "8.5rem"}
        fit={!origin}
        wheelZoom
      />

      <form onSubmit={submit} role="search" className={`absolute z-[600] top-3 left-4 right-4 bg-surface-container-lowest border border-surface-variant rounded-2xl min-h-[3.25rem] px-3 flex items-center gap-[9px] ${FLOAT}`}>
        <span aria-hidden="true" className="shrink-0 w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
          <FIcon name="sparkles" size={16} />
        </span>
        <label htmlFor="map-q" className="sr-only">
          {t.askLeslie}
        </label>
        <input
          id="map-q"
          type="search"
          enterKeyHint="send"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.askLeslieWhat}
          className="flex-1 min-w-0 bg-transparent text-[0.875rem] focus:outline-none min-h-[2.75rem]"
        />
        <button type="submit" aria-label={t.send} className="shrink-0 min-w-[2.75rem] min-h-[2.75rem] -mr-2 flex items-center justify-center text-primary">
          <FIcon name={query.trim() ? "arrow-right" : "mic"} size={22} />
        </button>
      </form>

      <p className={`absolute z-[600] top-[4.75rem] left-4 bg-surface rounded-[10px] h-9 px-2.5 flex items-center gap-[5px] text-[0.6875rem] font-medium text-on-surface-variant ${FLOAT}`}>
        <FIcon name="map-pin" size={13} className="text-primary" /> {areaLabel}
        {settings.demo && <span className="text-[0.625rem] font-semibold text-primary">· {t.demo}</span>}
        {!online && <span className="text-[0.625rem] font-semibold text-error">· {t.offline}</span>}
      </p>

      <button type="button" onClick={() => go("/")} aria-label={t.collapseMap} className="absolute z-[600] top-[4.75rem] right-4 w-11 h-11 rounded-[10px]">
        <img src={collapseMap} alt="" width={54} height={54} className="absolute max-w-none" style={{ left: "-11.36%", top: "-6.82%", width: "122.72%", height: "122.73%" }} />
      </button>

      <div className="absolute z-[600] left-4 right-4 bottom-4 max-h-[60%] overflow-y-auto overscroll-contain flex flex-col gap-2">
        {place && (
          <PlaceSheet
            key={place.id}
            r={place}
            miles={origin ? distanceMiles(origin[0], origin[1], place.lat, place.lng) : null}
            origin={origin}
            onClose={() => setSelected(null)}
            onRoute={setRoute}
          />
        )}
        <div className={`bg-surface border border-surface-variant rounded-2xl p-2 flex flex-col gap-2 ${FLOAT}`}>
          <CategoryTabs
            tab={tab}
            onChange={(k) => {
              setTab(k);
              setSelected(null);
            }}
          />
          <p className="text-[0.625rem] leading-[0.875rem] text-on-surface-variant text-center">{t.verifiedNote}</p>
        </div>
      </div>
    </div>
  );
}
