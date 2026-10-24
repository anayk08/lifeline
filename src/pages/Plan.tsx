import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import type { PlanResult } from "../../shared/bedrock";
import { primaryHazard, type LiveHazard } from "../../shared/hazards";
import { planPlaces, planSteps, type GuidanceItem } from "../../shared/plan";
import { zipCenter } from "../../shared/resources";
import { AlertSource } from "../components/AlertBanner";
import { Page } from "../components/Shell";
import { Icon } from "../components/ui";
import { go, queryParam, readStore, useApp, writeStore } from "../lib/app";
import { findPlace, makePlan } from "../lib/backend";
import { LAST_PLAN_KEY, LAST_POSITION_KEY, alertTitle, liveSituation, minutesSince, type SavedPlan } from "../lib/hazards";
import { speak } from "../lib/speech";

const AnswerMap = lazy(() => import("../components/AnswerMap"));

interface Position {
  lat: number;
  lng: number;
  /** A place the person typed; absent for GPS and ZIP. */
  label?: string;
  source: "gps" | "zip" | "stated";
}

type SummaryState = { state: "loading" } | { state: "ready"; plan: PlanResult } | { state: "offline" } | { state: "error" };

export default function Plan() {
  const { t, settings, online, gps, gpsError, requestGps, hazards } = useApp();
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
  const savedPlan = readStore<SavedPlan | null>(LAST_PLAN_KEY, null);

  // a. Ask for GPS once, with the reason on screen. Location is only used after "Yes, help me".
  useEffect(() => {
    if (!gps && !asked) {
      setAsked(true);
      requestGps();
    }
  }, [gps, asked, requestGps]);

  // Where the plan starts: a place they typed, then GPS, then the saved ZIP.
  const zipPoint = settings.zip ? zipCenter(settings.zip) : null;
  const position: Position | null = typed
    ? typed
    : gps
      ? { lat: gps[0], lng: gps[1], source: "gps" }
      : gpsError && zipPoint
        ? { lat: zipPoint[0], lng: zipPoint[1], source: "zip" }
        : null;
  const origin: [number, number] | null = position ? [position.lat, position.lng] : null;
  const needsWhere = !position && gpsError;
  const locating = !position && !gpsError;

  useEffect(() => {
    if (position) writeStore(LAST_POSITION_KEY, position);
  }, [position?.lat, position?.lng, position?.source]); // eslint-disable-line react-hooks/exhaustive-deps

  // The alert from the banner; if it's gone (offline reopen), the strongest one covering them, then the last plan's.
  const wanted = queryParam("alert");
  const alert: LiveHazard | null =
    hazards.find((h) => h.id === wanted) ?? primaryHazard(hazards, origin) ?? (savedPlan?.alert?.id === wanted ? savedPlan.alert : null);

  // b. Leslie's summary and step choice (online). Steps and places never wait for her.
  const alertId = alert?.id;
  useEffect(() => {
    if (!alert || locating) return;
    if (!online) return setSummary({ state: "offline" });
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
  }, [alertId, origin?.[0], origin?.[1], online, settings.lang, locating]);

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
  };

  const askLeslie = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (q) go(`/ask?q=${encodeURIComponent(q)}&ctx=plan`);
  };

  const fromLabel = position
    ? position.source === "stated"
      ? position.label!
      : position.source === "gps"
        ? t.yourLocation
        : `ZIP ${settings.zip}`
    : null;

  const stepList = (items: GuidanceItem[], start = 1) => (
    <ol className="flex flex-col gap-2" start={start}>
      {items.map((item, i) => (
        <li
          key={item.id}
          className={`flex gap-3 rounded-xl border-2 p-3 ${item.id === "call-911" ? "border-error bg-error-container text-on-error-container" : "border-surface-variant bg-surface-container-lowest"}`}
        >
          <span aria-hidden="true" className="shrink-0 w-8 h-8 rounded-full bg-primary-container text-white text-label-md flex items-center justify-center">
            {start + i}
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-body-lg">
              {item.text[settings.lang]}
              {item.id === "call-911" && (
                <a href="tel:911" className="ml-2 underline underline-offset-2 font-bold whitespace-nowrap">
                  911
                </a>
              )}
            </span>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-label-sm text-primary underline underline-offset-2 self-start">
              {t.sourceIs(item.source)}
            </a>
          </span>
        </li>
      ))}
    </ol>
  );

  return (
    <Page back="#/">
      <h1 className="text-headline-xl text-primary flex items-center gap-2">
        <Icon name="checklist" /> {t.planTitle}
      </h1>

      {alert ? (
        <section className="bg-error-container text-on-error-container border-2 border-error rounded-2xl p-3 flex flex-col gap-1">
          <p className="text-label-lg">
            <span aria-hidden="true">⚠️ </span>
            {alertTitle(alert, t)} · {t.minsAgo(minutesSince(alert.startedAt))}
          </p>
          <p className="text-label-sm">
            <AlertSource h={alert} />
          </p>
        </section>
      ) : (
        <p className="text-body-lg">{t.planNoAlert}</p>
      )}

      {/* Where they are: GPS (asked with a reason), else saved ZIP, else "Where are you?". */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {locating && (
          <p className="text-body-md flex items-start gap-2 bg-surface-container-low border border-surface-variant rounded-xl p-3">
            <Icon name="my_location" className="shrink-0 text-primary" />
            <span>
              {t.locationReason} <span className="block text-on-surface-variant">{t.findingLocation}</span>
            </span>
          </p>
        )}
        {(needsWhere || typed) && (
          <form onSubmit={submitWhere} className="flex flex-col gap-1">
            <label htmlFor="where" className="text-label-lg text-primary">
              {t.whereAreYou}
            </label>
            <div className="flex gap-2">
              <input
                id="where"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder={typed?.label ?? "Spartan Village"}
                aria-describedby="where-help"
                className="flex-1 min-h-[52px] px-3 rounded-xl border-2 border-primary-container bg-surface-container-lowest text-body-lg"
              />
              <button type="submit" disabled={searching} className="min-h-[52px] min-w-[72px] px-3 rounded-xl bg-primary-container text-white text-label-lg">
                {searching ? <Icon name="hourglass_top" className="animate-pulse" /> : t.find}
              </button>
            </div>
            <p id="where-help" className="text-label-sm text-on-surface-variant">
              {t.whereAreYouHelp}
            </p>
            {whereError && <p className="text-label-md text-error">{whereError}</p>}
          </form>
        )}
      </div>

      {alert && steps && !locating && (
        <>
          {/* Leslie's one-paragraph summary (Bedrock). Everything below works without it. */}
          <section aria-live="polite" className="bg-surface-container-low border border-surface-variant rounded-2xl p-3 flex flex-col gap-1">
            {summary.state === "loading" && (
              <p role="status" className="text-body-md flex items-center gap-2">
                <Icon name="hourglass_top" className="animate-pulse" /> {t.planSummaryLoading}
              </p>
            )}
            {summaryText && (
              <>
                <p className="text-body-lg">
                  <span className="sr-only">Leslie: </span>
                  {summaryText}
                </p>
                <button
                  type="button"
                  onClick={() => speak(summaryText, settings.lang)}
                  className="self-start inline-flex items-center gap-1 text-primary text-label-md min-h-[48px]"
                >
                  <Icon name="volume_up" className="text-secondary" /> {t.readAloud}
                </button>
              </>
            )}
            {summary.state === "offline" && !summaryText && <p className="text-body-md">{t.planSummaryOffline}</p>}
            {summary.state === "error" && <p className="text-body-md">{t.planSummaryError}</p>}
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="step1">
            <h2 id="step1" className="text-headline-lg text-primary">
              1. {t.planRightNow}
            </h2>
            {stepList(steps.rightNow)}
            <p className="text-label-sm text-on-surface-variant">{t.planVetted}</p>
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="step2">
            <h2 id="step2" className="text-headline-lg text-primary">
              2. {t.planWhereToGo}
            </h2>
            {fromLabel && <p className="text-label-sm text-on-surface-variant">{t.planFrom(fromLabel)}</p>}
            {ranked.length > 0 ? (
              <div className="h-[70vh] min-h-[480px] flex flex-col">
                <Suspense fallback={<p className="text-body-md">…</p>}>
                  <AnswerMap key={ranked.map((x) => x.resource.id).join(",")} ids={ranked.map((x) => x.resource.id)} situation={situation} />
                </Suspense>
              </div>
            ) : (
              <p className="text-body-md">{t.noResults}</p>
            )}
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="step3">
            <h2 id="step3" className="text-headline-lg text-primary">
              3. {t.planThen}
            </h2>
            {steps.then.filter((i) => !i.kind).length > 0 && stepList(steps.then.filter((i) => !i.kind))}
            {steps.then.some((i) => i.kind === "bring") && (
              <>
                <h3 className="text-label-lg text-primary flex items-center gap-1">
                  <Icon name="backpack" /> {t.planBring}
                </h3>
                {stepList(steps.then.filter((i) => i.kind === "bring"))}
              </>
            )}
            {steps.then.some((i) => i.kind === "call") && (
              <>
                <h3 className="text-label-lg text-primary flex items-center gap-1">
                  <Icon name="call" /> {t.planCall}
                </h3>
                {stepList(steps.then.filter((i) => i.kind === "call"))}
              </>
            )}
          </section>

          {/* Questions keep the plan's context: the live alert goes with every question, and Leslie gets the summary. */}
          <form onSubmit={askLeslie} className="flex items-center gap-2 bg-surface-container-lowest border-2 border-primary-container rounded-2xl shadow-md p-1.5">
            <label htmlFor="plan-ask" className="sr-only">
              {t.askLeslie}
            </label>
            <input
              id="plan-ask"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t.askAboutPlan}
              className="flex-1 bg-transparent px-2 py-2 text-body-md focus:outline-none min-h-[44px]"
            />
            <button type="submit" aria-label={t.send} className="min-h-[48px] min-w-[48px] rounded-xl bg-primary-container text-white flex items-center justify-center">
              <Icon name="send" />
            </button>
          </form>
        </>
      )}
    </Page>
  );
}
