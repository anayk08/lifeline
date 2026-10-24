import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PlanResult } from "../../shared/bedrock";
import { primaryHazard, type LiveHazard } from "../../shared/hazards";
import { planPlaces, planSteps, type GuidanceItem } from "../../shared/plan";
import { BY_ID, distanceMiles, zipCenter } from "../../shared/resources";
import { AlertSource } from "../components/AlertBanner";
import { FIcon } from "../components/figma";
import HomeMap, { type RouteLine } from "../components/HomeMap";
import PlaceRow from "../components/PlaceRow";
import PlaceSheet from "../components/PlaceSheet";
import { Page } from "../components/Shell";
import { Icon } from "../components/ui";
import { go, queryParam, readStore, useApp, writeStore } from "../lib/app";
import { findPlace, makePlan } from "../lib/backend";
import { useDataNotice } from "../lib/dataNotice";
import { LAST_PLAN_KEY, LAST_POSITION_KEY, alertTitle, liveSituation, minutesSince, type SavedPlan } from "../lib/hazards";
import { speak } from "../lib/speech";

interface Position {
  lat: number;
  lng: number;
  /** A place the person typed; absent for GPS and ZIP. */
  label?: string;
  source: "gps" | "zip" | "stated";
}

type SummaryState = { state: "loading" } | { state: "ready"; plan: PlanResult } | { state: "offline" } | { state: "error" } | { state: "needsNotice" };

export default function Plan() {
  const { t, settings, online, gps, gpsError, requestGps, hazards } = useApp();
  const ensureNotice = useDataNotice();
  const [typed, setTyped] = useState<Position | null>(() => {
    const last = readStore<Position | null>(LAST_POSITION_KEY, null);
    return last && last.source === "stated" ? last : null;
  });
  const [asked, setAsked] = useState(false);
  const [where, setWhere] = useState("");
  const [whereError, setWhereError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [summary, setSummary] = useState<SummaryState>({ state: "loading" });
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteLine | null>(null);
  const savedPlan = readStore<SavedPlan | null>(LAST_PLAN_KEY, null);

  // a. Ask for GPS once, with the reason on screen. Location is only used after "Yes".
  useEffect(() => {
    if (!gps && !asked) {
      setAsked(true);
      requestGps();
    }
  }, [gps, asked, requestGps]);

  // Where the plan starts: a place they typed here, then GPS, then their chosen area, then the saved ZIP.
  const zipPoint = settings.zip ? zipCenter(settings.zip) : null;
  const position: Position | null = typed
    ? typed
    : gps
      ? { lat: gps[0], lng: gps[1], source: "gps" }
      : gpsError && settings.area
        ? { lat: settings.area.lat, lng: settings.area.lng, label: settings.area.label, source: "stated" }
        : gpsError && zipPoint
          ? { lat: zipPoint[0], lng: zipPoint[1], source: "zip" }
          : null;
  const origin: [number, number] | null = position ? [position.lat, position.lng] : null;
  const needsWhere = !position && gpsError;
  const locating = !position && !gpsError;

  useEffect(() => {
    if (position) writeStore(LAST_POSITION_KEY, position);
  }, [position?.lat, position?.lng, position?.source]); // eslint-disable-line react-hooks/exhaustive-deps

  // The alert from Home; if it's gone (offline reopen), the strongest one covering them, then the last plan's.
  const wanted = queryParam("alert");
  const alert: LiveHazard | null =
    hazards.find((h) => h.id === wanted) ?? primaryHazard(hazards, origin) ?? (savedPlan?.alert?.id === wanted ? savedPlan.alert : null);

  // b. Leslie's summary and step choice (online). Steps and places never wait for her.
  const alertId = alert?.id;
  useEffect(() => {
    if (!alert || locating) return;
    if (!online) return setSummary({ state: "offline" });
    // The summary sends the alert and location to Bedrock, so it waits for the data notice.
    if (!settings.dataNotice) return setSummary({ state: "needsNotice" });
    let cancelled = false;
    setSummary({ state: "loading" });
    makePlan({
      hazard: alert,
      language: settings.lang,
      lat: origin?.[0],
      lng: origin?.[1],
      originLabel: position?.label ?? (position?.source === "zip" ? `ZIP ${settings.zip}` : position ? "their GPS location" : undefined),
    })
      .then((plan) => {
        if (cancelled) return;
        setSummary({ state: "ready", plan });
        writeStore(LAST_PLAN_KEY, { alert, summary: plan.summary, picks: { rightNow: plan.rightNow, then: plan.then }, lang: plan.language });
      })
      .catch(() => !cancelled && setSummary({ state: "error" }));
    return () => {
      cancelled = true;
    };
    // Re-plan when the alert, the position or the language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId, origin?.[0], origin?.[1], online, settings.lang, locating, settings.dataNotice]);

  const picks =
    summary.state === "ready"
      ? { rightNow: summary.plan.rightNow, then: summary.plan.then }
      : savedPlan?.alert?.id === alertId
        ? savedPlan?.picks
        : null;
  const steps = alert ? planSteps(alert.type, picks) : null;
  const ranked = useMemo(() => (alert ? planPlaces(alert, origin) : []), [alert, origin?.[0], origin?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const situation = useMemo(() => {
    const s = liveSituation(alert, origin, settings.zip, position?.source === "gps", position?.label);
    if (s) s.flaggedIds = ranked.filter((x) => x.nearHazard).map((x) => x.resource.id);
    return s;
  }, [alert, origin?.[0], origin?.[1], position?.source, position?.label, ranked]); // eslint-disable-line react-hooks/exhaustive-deps

  const summaryText =
    summary.state === "ready" ? summary.plan.summary : savedPlan?.alert?.id === alertId && !online ? savedPlan?.summary ?? "" : "";

  const submitWhere = async (e: FormEvent) => {
    e.preventDefault();
    const text = where.trim();
    if (!text) return;
    setWhereError(null);
    const zip = text.match(/^\d{5}$/)?.[0];
    if (zip && zipCenter(zip)) {
      const [lat, lng] = zipCenter(zip)!;
      return setTyped({ lat, lng, label: `ZIP ${zip}`, source: "stated" });
    }
    if (!online) return setWhereError(t.placeSearchOffline);
    ensureNotice(
      async () => {
        setSearching(true);
        try {
          const found = await findPlace(text);
          if (found) setTyped({ lat: found.lat, lng: found.lng, label: text, source: "stated" });
          else setWhereError(t.placeSearchFailed(text));
        } catch {
          setWhereError(t.placeSearchFailed(text));
        } finally {
          setSearching(false);
        }
      },
      () => setWhereError(t.placeSearchDeclined),
    );
  };

  const askLeslie = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (q) go(`/ask?q=${encodeURIComponent(q)}&ctx=plan`);
  };

  const fromLabel = position ? (position.source === "stated" ? position.label! : position.source === "gps" ? t.yourLocation : `ZIP ${settings.zip}`) : null;
  const place = selected ? BY_ID.get(selected) ?? null : null;
  const flagged = new Set(situation?.flaggedIds ?? []);

  const stepList = (items: GuidanceItem[], start = 1) => (
    <ol className="flex flex-col gap-1.5" start={start}>
      {items.map((item, i) => {
        const urgent = item.id === "call-911";
        return (
          <li
            key={item.id}
            className={`flex gap-2.5 rounded-[10px] border p-2.5 ${urgent ? "border-error bg-error-container text-on-error-container" : "border-surface-variant bg-surface"}`}
          >
            <span aria-hidden="true" className={`shrink-0 w-[1.625rem] h-[1.625rem] rounded-full text-white text-[0.75rem] font-bold flex items-center justify-center ${urgent ? "bg-error" : "bg-primary"}`}>
              {start + i}
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[0.875rem] leading-5">
                {item.text[settings.lang]}
                {urgent && (
                  <a href="tel:911" className="ml-2 underline underline-offset-2 font-bold whitespace-nowrap">
                    911
                  </a>
                )}
              </span>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[0.6875rem] font-semibold text-primary underline underline-offset-2 self-start">
                {t.sourceIs(item.source)}
              </a>
            </span>
          </li>
        );
      })}
    </ol>
  );

  const card = "bg-surface-container-lowest rounded-2xl p-3 flex flex-col gap-2";
  const heading = "text-[1.0625rem] font-semibold text-on-surface";

  return (
    <Page back="#/">
      <h1 className="text-[1.375rem] leading-[1.5625rem] text-on-surface flex items-center gap-2">
        <Icon name="checklist" className="text-primary" /> {t.planTitle}
      </h1>

      {alert ? (
        <section className="bg-warn-container border border-warn-border rounded-2xl p-3 flex flex-col gap-1">
          <p className="text-[1rem] leading-5 font-bold text-on-surface">{alertTitle(alert, t)}</p>
          <p className="text-[0.75rem] text-on-surface-variant flex flex-wrap items-center gap-x-2 gap-y-1">
            {t.minsAgo(minutesSince(alert.startedAt))}
            <AlertSource h={alert} className="text-on-warn-container" />
          </p>
        </section>
      ) : (
        <p className="text-[0.875rem]">{t.planNoAlert}</p>
      )}

      {/* Where they are: GPS (asked with a reason), else their area or ZIP, else "Where are you?". */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {locating && (
          <p className="text-[0.875rem] leading-5 flex items-start gap-2 bg-surface-container-lowest rounded-2xl p-3">
            <FIcon name="locate-fixed" size={20} className="shrink-0 text-primary mt-0.5" />
            <span>
              {t.locationReason} <span className="block text-on-surface-variant">{t.findingLocation}</span>
            </span>
          </p>
        )}
        {(needsWhere || typed) && (
          <form onSubmit={submitWhere} className={card}>
            <label htmlFor="where" className={heading}>
              {t.whereAreYou}
            </label>
            <div className="flex items-center gap-2 min-h-[2.875rem] px-3 rounded-xl border border-surface-variant">
              <FIcon name="search" size={18} className="text-on-surface-variant" />
              <input
                id="where"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder={typed?.label ?? "Spartan Village"}
                aria-describedby="where-help"
                className="flex-1 min-w-0 bg-transparent text-[0.875rem] focus:outline-none min-h-[2.75rem]"
              />
              <button type="submit" disabled={searching} aria-label={t.find} className="min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center text-primary">
                {searching ? <Icon name="hourglass_top" className="animate-pulse" /> : <FIcon name="arrow-right" size={18} />}
              </button>
            </div>
            <p id="where-help" className="text-[0.75rem] text-on-surface-variant">
              {t.whereAreYouHelp}
            </p>
            {whereError && <p className="text-[0.8125rem] text-error">{whereError}</p>}
          </form>
        )}
      </div>

      {alert && steps && !locating && (
        <>
          {/* Leslie's one-paragraph summary (Bedrock). Everything below works without it. */}
          <section aria-live="polite" className={card}>
            <p className="flex items-center gap-1.5 text-[0.875rem] text-primary">
              <FIcon name="sparkles" size={17} /> {t.leslieHelper}
            </p>
            {summary.state === "loading" && (
              <p role="status" className="text-[0.875rem] text-on-surface-variant flex items-center gap-2">
                <Icon name="hourglass_top" className="animate-pulse !text-[18px]" /> {t.planSummaryLoading}
              </p>
            )}
            {summaryText && (
              <>
                <p className="text-[0.875rem] leading-5">
                  <span className="sr-only">Leslie: </span>
                  {summaryText}
                </p>
                <button
                  type="button"
                  onClick={() => speak(summaryText, settings.lang)}
                  className="self-start inline-flex items-center gap-1 text-primary text-[0.8125rem] font-semibold min-h-[2.75rem]"
                >
                  <Icon name="volume_up" className="!text-[18px]" /> {t.readAloud}
                </button>
              </>
            )}
            {summary.state === "offline" && !summaryText && <p className="text-[0.875rem] text-on-surface-variant">{t.planSummaryOffline}</p>}
            {summary.state === "error" && <p className="text-[0.875rem] text-on-surface-variant">{t.planSummaryError}</p>}
            {summary.state === "needsNotice" && (
              <button
                type="button"
                onClick={() => ensureNotice(() => {})}
                className="self-start min-h-[2.75rem] px-3 rounded-xl bg-surface-container-low text-primary text-[0.875rem] font-semibold"
              >
                {t.getSummary}
              </button>
            )}
          </section>

          <section className={card} aria-labelledby="step1">
            <h2 id="step1" className={heading}>
              1. {t.planRightNow}
            </h2>
            {stepList(steps.rightNow)}
            <p className="text-[0.75rem] text-on-surface-variant">{t.planVetted}</p>
          </section>

          <section className={card} aria-labelledby="step2">
            <div className="flex items-center justify-between">
              <h2 id="step2" className={heading}>
                2. {t.planWhereToGo}
              </h2>
              {ranked.length > 0 && <p className="text-[0.6875rem] text-primary">{t.optionsOnMap(ranked.length)}</p>}
            </div>
            {fromLabel && <p className="text-[0.75rem] text-on-surface-variant">{t.planFrom(fromLabel)}</p>}
            {ranked.length > 0 ? (
              <>
                <HomeMap
                  places={ranked.map((x, i) => ({ r: x.resource, n: i + 1 }))}
                  selectedId={selected}
                  onSelect={setSelected}
                  situation={situation}
                  route={place ? route : null}
                  className="h-[15.625rem]"
                />
                {place ? (
                  <PlaceSheet
                    key={place.id}
                    r={place}
                    miles={origin ? distanceMiles(origin[0], origin[1], place.lat, place.lng) : null}
                    origin={origin}
                    flagged={flagged.has(place.id)}
                    onClose={() => setSelected(null)}
                    onRoute={setRoute}
                  />
                ) : (
                  ranked.map((x, i) => (
                    <PlaceRow
                      key={x.resource.id}
                      r={x.resource}
                      miles={x.miles}
                      n={i + 1}
                      highlighted={i === 0}
                      onClick={() => setSelected(x.resource.id)}
                      detail={x.nearHazard ? t.mayBeAffected : x.reasons.slice(0, 2).join(", ")}
                    />
                  ))
                )}
              </>
            ) : (
              <p className="text-[0.875rem]">{t.noResults}</p>
            )}
          </section>

          <section className={card} aria-labelledby="step3">
            <h2 id="step3" className={heading}>
              3. {t.planThen}
            </h2>
            {steps.then.filter((i) => !i.kind).length > 0 && stepList(steps.then.filter((i) => !i.kind))}
            {steps.then.some((i) => i.kind === "bring") && (
              <>
                <h3 className="text-[0.875rem] font-semibold text-primary flex items-center gap-1">
                  <Icon name="backpack" className="!text-[18px]" /> {t.planBring}
                </h3>
                {stepList(steps.then.filter((i) => i.kind === "bring"))}
              </>
            )}
            {steps.then.some((i) => i.kind === "call") && (
              <>
                <h3 className="text-[0.875rem] font-semibold text-primary flex items-center gap-1">
                  <FIcon name="phone" size={16} /> {t.planCall}
                </h3>
                {stepList(steps.then.filter((i) => i.kind === "call"))}
              </>
            )}
          </section>

          {/* Questions keep the plan's context: the live alert goes with every question, and Leslie gets the summary. */}
          <form onSubmit={askLeslie} className="bg-surface-container-lowest border border-surface-variant rounded-2xl min-h-[3.25rem] px-3 flex items-center gap-[9px]">
            <span aria-hidden="true" className="shrink-0 w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
              <FIcon name="sparkles" size={16} />
            </span>
            <label htmlFor="plan-ask" className="sr-only">
              {t.askLeslie}
            </label>
            <input
              id="plan-ask"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t.askAboutPlan}
              className="flex-1 min-w-0 bg-transparent text-[0.875rem] focus:outline-none min-h-[2.75rem]"
            />
            <button type="submit" aria-label={t.send} className="shrink-0 min-w-[2.75rem] min-h-[2.75rem] -mr-2 flex items-center justify-center text-primary">
              <Icon name="send" />
            </button>
          </form>
        </>
      )}
    </Page>
  );
}
