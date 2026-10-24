// The one main screen from the Figma redesign: where you are, Ask Leslie, the alert card,
// the map with category tabs, and below it whichever panel fits: nearby resources,
// Leslie's answer, "Aid near you", a selected place, or "Find what's closest to you".
import { useMemo, useState, type FormEvent } from "react";
import { primaryHazard, type LiveHazard } from "../../shared/hazards";
import { planPlaces, planSteps } from "../../shared/plan";
import {
  BY_ID,
  RESOURCES,
  distanceMiles,
  rankForSituation,
  rankResources,
  zipCenter,
  type Resource,
} from "../../shared/resources";
import AlertBanner, { useAlert } from "../components/AlertBanner";
import CategoryTabs from "../components/CategoryTabs";
import LegalFooter from "../components/LegalFooter";
import { FIcon, TABS } from "../components/figma";
import HomeMap, { type MapPlace, type RouteLine } from "../components/HomeMap";
import PlaceRow from "../components/PlaceRow";
import PlaceSheet from "../components/PlaceSheet";
import { Page } from "../components/Shell";
import { Icon } from "../components/ui";
import { go, useApp } from "../lib/app";
import { findPlace } from "../lib/backend";
import { liveSituation } from "../lib/hazards";
import { useDataNotice } from "../lib/dataNotice";
import { useLeslie, type Turn } from "../lib/leslie";
import { speak, useSpeechInput } from "../lib/speech";

const LIST_PREVIEW = 6;

function LocationCard({ onDone }: { onDone: () => void }) {
  const { t, online, update, requestGps } = useApp();
  const ensureNotice = useDataNotice();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setError(null);
    if (/^\d{5}$/.test(q)) {
      if (!zipCenter(q)) return setError(t.placeSearchFailed(q));
      update({ zip: q, area: null });
      return onDone();
    }
    if (!online) return setError(t.placeSearchOffline);
    // Typed places go to Amazon Location, so the data notice comes first.
    ensureNotice(
      async () => {
        setBusy(true);
        try {
          const found = await findPlace(q);
          if (!found) return setError(t.placeSearchFailed(q));
          update({ area: { label: q, lat: found.lat, lng: found.lng } });
          onDone();
        } catch {
          setError(t.placeSearchFailed(q));
        } finally {
          setBusy(false);
        }
      },
      () => setError(t.placeSearchDeclined),
    );
  };

  return (
    <section aria-labelledby="where-title" className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col gap-3">
      <h2 id="where-title" className="flex items-center gap-2 text-[1.25rem] text-on-surface">
        <FIcon name="locate-fixed" size={22} className="text-primary" /> {t.findClosest}
      </h2>
      <p className="text-[0.875rem] leading-5 text-on-surface-variant">{t.findClosestBody}</p>
      <button
        type="button"
        onClick={() => {
          requestGps();
          onDone();
        }}
        className="min-h-[2.875rem] rounded-xl bg-primary text-white text-[0.9375rem] font-semibold flex items-center justify-center gap-2"
      >
        <FIcon name="navigation" size={18} /> {t.useLocation}
      </button>
      <form onSubmit={submit} className="flex items-center gap-2 min-h-[2.875rem] px-3 rounded-xl border border-surface-variant">
        <FIcon name="search" size={18} className="text-on-surface-variant" />
        <label htmlFor="area" className="sr-only">
          {t.enterAddress}
        </label>
        <input
          id="area"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.enterAddress}
          className="flex-1 min-w-0 bg-transparent text-[0.875rem] focus:outline-none min-h-[2.75rem]"
        />
        <button type="submit" aria-label={t.find} disabled={busy} className="min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center text-primary">
          {busy ? <Icon name="hourglass_top" className="animate-pulse" /> : <FIcon name="arrow-right" size={18} />}
        </button>
      </form>
      {error && <p className="text-[0.8125rem] text-error">{error}</p>}
      <p className="text-[0.75rem] leading-[1.0625rem] text-on-surface-variant">{t.locationOptional}</p>
    </section>
  );
}

function LesliePanel({
  turns,
  pins,
  onPick,
  onClose,
}: {
  turns: Turn[];
  pins: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t, settings, origin } = useApp();
  const current = turns[turns.length - 1];
  const miles = (r: Resource) => (origin ? distanceMiles(origin[0], origin[1], r.lat, r.lng) : null);
  return (
    <section aria-label={t.leslieHelper} className="bg-surface-container-lowest rounded-2xl px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[0.875rem] text-primary">
          <FIcon name="sparkles" size={17} /> {t.leslieHelper}
        </p>
        <button type="button" onClick={onClose} aria-label={t.closeLeslie} className="min-w-[2.75rem] min-h-[2.75rem] -mr-2 flex items-center justify-center text-primary">
          <FIcon name="x" size={18} />
        </button>
      </div>

      <p className="bg-surface-container-low rounded-lg p-2.5 text-[0.875rem] text-on-surface">
        <span className="sr-only">{t.youAsked} </span>
        {current.question}
      </p>
      <div aria-live="polite" className="flex flex-col gap-1.5">
        {current.state === "loading" && (
          <p role="status" className="text-[0.875rem] text-on-surface-variant flex items-center gap-2">
            <Icon name="hourglass_top" className="animate-pulse !text-[18px]" /> {t.leslieThinking}
          </p>
        )}
        {current.state === "answered" && (
          <>
            <p className="text-[0.875rem] leading-5 text-on-surface whitespace-pre-line">
              <span className="sr-only">Leslie: </span>
              {current.answer}
            </p>
            <div className="flex flex-wrap items-center gap-x-3">
              <button
                type="button"
                onClick={() => speak(current.answer ?? "", current.language ?? settings.lang)}
                className="inline-flex items-center gap-1 text-primary text-[0.8125rem] font-semibold min-h-[2.75rem]"
              >
                <Icon name="volume_up" className="!text-[18px]" /> {t.listen}
              </button>
              {!current.verified && (
                <a href="tel:211" className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-primary underline underline-offset-2 min-h-[2.75rem]">
                  <FIcon name="phone" size={14} /> 211
                </a>
              )}
              <a href="tel:911" className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-error underline underline-offset-2 min-h-[2.75rem]">
                911
              </a>
            </div>
          </>
        )}
        {(current.state === "offline" || current.state === "error" || current.state === "declined") && (
          <p className="text-[0.875rem] leading-5 text-on-surface">
            {current.state === "offline"
              ? pins.length ? t.leslieOffline : t.leslieOfflineNoMatch
              : current.state === "declined"
                ? pins.length ? t.leslieDeclined : t.leslieDeclinedNoMatch
                : pins.length ? t.leslieError : t.leslieErrorNoMatch}
          </p>
        )}
        {current.state !== "loading" &&
          pins.map((id, i) => {
            const r = BY_ID.get(id)!;
            return <PlaceRow key={id} r={r} miles={miles(r)} n={i + 1} highlighted={i === 0} onClick={() => onPick(id)} detail={r.address.replace(/, San Jos[eé],? CA.*$/i, "")} />;
          })}
        {current.state !== "loading" && pins.length === 0 && (
          <p className="text-[0.8125rem] text-on-surface-variant">
            {t.noVerified}{" "}
            <a href="tel:211" className="font-semibold text-primary underline underline-offset-2">
              {t.call211}
            </a>
          </p>
        )}
      </div>
      <p className="text-[0.75rem] leading-[1.0625rem] text-on-surface-variant">{t.verifiedNote}</p>

      {/* Earlier questions live below the current answer, folded away, so the newest answer is always first. */}
      {turns.length > 1 && (
        <details className="border-t border-surface-variant pt-1.5 group">
          <summary className="list-none cursor-pointer min-h-[2.75rem] flex items-center justify-between text-[0.8125rem] font-semibold text-primary">
            {t.earlierQuestions(turns.length - 1)}
            <FIcon name="chevron-down" size={16} className="transition-transform group-open:rotate-180" />
          </summary>
          <ol className="flex flex-col gap-2 pb-1" reversed>
            {turns
              .slice(0, -1)
              .map((turn, i) => ({ turn, i }))
              .reverse()
              .map(({ turn, i }) => (
                <li key={i} className="flex flex-col gap-1 pb-2 border-b border-surface-variant last:border-b-0">
                  <p className="bg-surface-container-low rounded-lg px-2.5 py-2 text-[0.8125rem] text-on-surface">
                    <span className="sr-only">{t.youAsked} </span>
                    {turn.question}
                  </p>
                  {turn.answer && <p className="text-[0.8125rem] leading-5 text-on-surface-variant">{turn.answer}</p>}
                </li>
              ))}
          </ol>
        </details>
      )}
    </section>
  );
}

function AidCard({ alert, places, onPick }: { alert: LiveHazard; places: { r: Resource; miles: number | null; nearHazard: boolean; reasons: string[] }[]; onPick: (id: string) => void }) {
  const { t, settings } = useApp();
  // The first vetted step after "Call 911", with its source.
  const tip = planSteps(alert.type).rightNow[1];
  return (
    <section aria-labelledby="aid-title" className="bg-surface-container-lowest rounded-2xl p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h2 id="aid-title" className="text-[1.0625rem] font-semibold text-on-surface">
          {t.aidNearYou}
        </h2>
        <p className="text-[0.6875rem] text-primary">{t.optionsOnMap(places.length)}</p>
      </div>
      <p className="text-[0.75rem] leading-[1.0625rem] text-on-surface-variant">{t.verifiedNote}</p>
      {places.map(({ r, miles, nearHazard, reasons }, i) => (
        <PlaceRow key={r.id} r={r} miles={miles} n={i + 1} onClick={() => onPick(r.id)} detail={nearHazard ? t.mayBeAffected : reasons.slice(0, 2).join(", ")} />
      ))}
      {tip && (
        <p className="bg-surface-container-low rounded-lg p-2 flex gap-1.5 items-start text-[0.6875rem] leading-[0.9375rem] text-on-surface">
          <FIcon name="guidance-link" size={13} className="mt-px text-primary" />
          <span>
            {tip.text[settings.lang]}{" "}
            <a href={tip.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-primary">
              {t.sourceIs(tip.source)}
            </a>
          </span>
        </p>
      )}
      <button
        type="button"
        onClick={() => go(`/plan?alert=${encodeURIComponent(alert.id)}`)}
        className="min-h-[2.75rem] rounded-xl bg-primary text-white text-[0.875rem] font-semibold flex items-center justify-center gap-2"
      >
        <Icon name="checklist" className="!text-[18px]" /> {t.openFullPlan}
      </button>
    </section>
  );
}

export default function Home() {
  const app = useApp();
  const { t, settings, origin, originSource, online, hazards, requestGps } = app;
  const leslie = useLeslie();
  const ensureNotice = useDataNotice();
  const { alert, answer, respond, now } = useAlert();
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showWhere, setShowWhere] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [route, setRoute] = useState<RouteLine | null>(null);
  const [query, setQuery] = useState("");

  const ask = (text: string) => {
    setSelected(null);
    setShowWhere(false);
    leslie.ask(text);
  };
  const speech = useSpeechInput(settings.lang, (text) => {
    setQuery("");
    ask(text);
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setQuery("");
    ask(q);
  };

  const tabCats = TABS.find((x) => x.key === tab)?.categories ?? null;
  const inTab = (r: Resource) => !tabCats || tabCats.includes(r.category);
  const milesTo = (r: Resource) => (origin ? distanceMiles(origin[0], origin[1], r.lat, r.lng) : null);
  const live = primaryHazard(hazards, origin);
  const affected = alert && answer === "yes" ? alert : null;

  // What the map and the panel show, most specific first.
  const current = leslie.current;
  const lesliePins = current && current.state !== "loading" ? leslie.pinsFor(current) : [];
  const aid = useMemo(() => (affected ? planPlaces(affected, origin) : []), [affected, origin]);
  const nearby = useMemo(() => {
    const list = RESOURCES.filter(inTab);
    return live
      ? rankForSituation(list, origin, { hazardType: liveSituation(live, origin, settings.zip, false)!.hazardType, hazardPoint: live.center, hazardRadiusMiles: live.radiusMiles })
      : rankResources(list, origin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, origin, live]);

  const mode = current ? "leslie" : affected ? "aid" : "browse";
  const mapPlaces: MapPlace[] =
    mode === "leslie"
      ? lesliePins.map((id, i) => ({ r: BY_ID.get(id)!, n: i + 1 }))
      : mode === "aid"
        ? aid.map((x, i) => ({ r: x.resource, n: i + 1 }))
        : RESOURCES.filter(inTab).map((r) => ({ r }));
  const situation =
    mode === "leslie" && current
      ? leslie.situationFor(current)
      : liveSituation(live, origin, settings.zip, originSource === "gps", originSource === "area" ? settings.area?.label : undefined);
  const flagged = new Set(
    mode === "aid" ? aid.filter((x) => x.nearHazard).map((x) => x.resource.id) : mode === "leslie" ? situation?.flaggedIds ?? [] : nearby.filter((x) => "nearHazard" in x && x.nearHazard).map((x) => x.resource.id),
  );
  const selectedPlace = selected ? BY_ID.get(selected) ?? null : null;
  const routeOrigin: [number, number] | null = situation?.origin ? [situation.origin.lat, situation.origin.lng] : origin;

  const areaLabel =
    originSource === "gps"
      ? t.yourLocation.charAt(0).toUpperCase() + t.yourLocation.slice(1)
      : originSource === "area"
        ? settings.area!.label
        : originSource === "zip"
          ? `ZIP ${settings.zip}`
          : t.chooseArea;

  const shownNearby = tab === "all" && !showAll ? nearby.slice(0, LIST_PREVIEW) : nearby;

  return (
    <Page>
      <div className="flex flex-col gap-1">
        <h1 className="text-[1.375rem] leading-[1.5625rem] text-on-surface">{t.findHelp}</h1>
        <button
          type="button"
          onClick={() => {
            setShowWhere((s) => !s);
            setSelected(null);
          }}
          aria-expanded={showWhere}
          className="self-start flex items-center gap-[5px] text-[0.75rem] text-on-surface-variant min-h-[2rem]"
        >
          <FIcon name="map-pin" size={13} className="text-primary" />
          {areaLabel}
          <FIcon name="chevron-down" size={12} className="text-primary" />
        </button>
      </div>

      <form onSubmit={submit} role="search" className="bg-surface-container-lowest border border-surface-variant rounded-2xl min-h-[3.25rem] px-3 flex items-center gap-[9px] focus-within:ring-2 focus-within:ring-primary">
        <span aria-hidden="true" className="shrink-0 w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
          <FIcon name="sparkles" size={16} />
        </span>
        <label htmlFor="q" className="sr-only">
          {t.askLeslie}
        </label>
        <input
          id="q"
          type="search"
          enterKeyHint="send"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={current ? t.followUp : t.askLeslieWhat}
          className="flex-1 min-w-0 bg-transparent text-[0.875rem] text-on-surface placeholder:text-on-surface-variant focus:outline-none min-h-[2.75rem]"
        />
        {query.trim() ? (
          <button type="submit" aria-label={t.send} className="shrink-0 min-w-[2.75rem] min-h-[2.75rem] -mr-2 flex items-center justify-center text-primary">
            <Icon name="send" />
          </button>
        ) : (
          speech.supported && (
            <button
              type="button"
              onClick={() => ensureNotice(speech.start)}
              aria-label={t.speak}
              aria-pressed={speech.listening}
              className={`shrink-0 min-w-[2.75rem] min-h-[2.75rem] -mr-2 rounded-xl flex items-center justify-center ${speech.listening ? "bg-surface-container-low text-error" : "text-primary"}`}
            >
              <FIcon name="mic" size={22} />
            </button>
          )
        )}
      </form>
      {!online && <p className="text-[0.75rem] text-on-surface-variant">{t.leslieHintOffline}</p>}

      {alert && (
        <AlertBanner
          alert={alert}
          answer={answer}
          now={now}
          onAnswer={(a) => {
            respond(a);
            // Location is only used after "Yes" (or if it was already allowed).
            if (a === "yes") requestGps();
            setSelected(null);
          }}
        />
      )}

      <div className="flex flex-col">
        <HomeMap
          places={mapPlaces}
          selectedId={selected}
          onSelect={(id) => {
            setSelected(id);
            setShowWhere(false);
          }}
          situation={situation}
          route={selectedPlace ? route : null}
          className={alert ? "h-[12.5rem]" : "h-[15.625rem]"}
          onToggleExpand={() => go("/map")}
          fit={mode !== "browse" || !origin}
        />
        <CategoryTabs
          tab={tab}
          onChange={(k) => {
            setTab(k);
            setSelected(null);
            setShowAll(false);
          }}
        />
      </div>

      {selectedPlace ? (
        <PlaceSheet
          key={selectedPlace.id}
          r={selectedPlace}
          miles={routeOrigin ? distanceMiles(routeOrigin[0], routeOrigin[1], selectedPlace.lat, selectedPlace.lng) : null}
          origin={routeOrigin}
          flagged={flagged.has(selectedPlace.id)}
          onClose={() => setSelected(null)}
          onRoute={setRoute}
          primary={
            mode === "browse"
              ? {
                  label: t.findAnother(t.tabNames[TABS.find((x) => x.categories?.includes(selectedPlace.category))?.key ?? "all"]),
                  onClick: () => {
                    setTab(TABS.find((x) => x.categories?.includes(selectedPlace.category))?.key ?? "all");
                    setSelected(null);
                  },
                }
              : undefined
          }
        />
      ) : showWhere ? (
        <LocationCard onDone={() => setShowWhere(false)} />
      ) : mode === "leslie" ? (
        <LesliePanel turns={leslie.turns} pins={lesliePins} onPick={setSelected} onClose={leslie.reset} />
      ) : mode === "aid" && affected ? (
        <AidCard alert={affected} places={aid.map((x) => ({ r: x.resource, miles: x.miles, nearHazard: x.nearHazard, reasons: x.reasons }))} onPick={setSelected} />
      ) : (
        <section aria-labelledby="nearby-title" className="flex flex-col">
          <div className="flex items-center justify-between min-h-[1.5625rem]">
            <h2 id="nearby-title" className="text-[1.0625rem] text-on-surface">
              {tab === "all" ? t.nearbyResources : t.nearbyIn(t.tabNames[tab])}
            </h2>
            {tab === "all" && !showAll ? (
              <button type="button" onClick={() => setShowAll(true)} className="text-[0.75rem] text-on-surface-variant min-h-[2.75rem] px-1">
                {t.browseAll}
              </button>
            ) : (
              <span className="text-[0.75rem] text-on-surface-variant">{t.results(nearby.length)}</span>
            )}
          </div>
          <p className="text-[0.75rem] leading-[1.0625rem] text-on-surface-variant">{t.verifiedNote}</p>
          {shownNearby.length === 0 && <p className="text-[0.875rem] py-2">{t.noResults}</p>}
          {shownNearby.map(({ resource }) => (
            <PlaceRow key={resource.id} r={resource} miles={milesTo(resource)} onClick={() => setSelected(resource.id)} detail={flagged.has(resource.id) ? t.mayBeAffected : undefined} />
          ))}
          <p className="text-[0.875rem] text-on-surface mt-3">
            {t.emergencyLine}{" "}
            <a href="tel:911" className="font-semibold text-error underline underline-offset-2">
              911
            </a>
            . {t.infoLine}{" "}
            <a href="tel:211" className="font-semibold text-primary underline underline-offset-2">
              211
            </a>
            .
          </p>
        </section>
      )}
      <LegalFooter />
    </Page>
  );
}
