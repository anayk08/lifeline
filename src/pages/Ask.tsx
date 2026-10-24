import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { BY_ID, RESOURCES, distanceMiles, rankForSituation, rankResources, type Lang } from "../../shared/resources";
import type { SituationResult } from "../../shared/situation";
import { Page } from "../components/Shell";
import { Icon, ResourceCard } from "../components/ui";
import { queryParam, useApp } from "../lib/app";
import { askLeslie, hasBackend } from "../lib/backend";
import { matchCategories, searchResources } from "../lib/search";
import { speak } from "../lib/speech";

// Leaflet is heavy, so the results map loads on first use (it is still precached for offline).
const AnswerMap = lazy(() => import("../components/AnswerMap"));

const MAX_PINS = 6;

// Needs Leslie picks out of the question, mapped to the kinds of places that meet them.
const NEED_KINDS: Record<string, string[]> = {
  medical: ["health", "pharmacy"],
  medicine: ["pharmacy", "health"],
  shelter: ["shelter", "cooling"],
  water: ["water"],
  charging: ["charging"],
  food: ["food"],
  cooling: ["cooling"],
};
const EMERGENCY_KINDS = ["health", "shelter", "pharmacy", "cooling", "charging", "food", "water"];

interface Turn {
  question: string;
  state: "loading" | "answered" | "offline" | "error";
  answer?: string;
  resourceIds: string[];
  verified?: boolean;
  language?: Lang;
  situation?: SituationResult | null;
}

export default function Ask() {
  const { t, settings, online, origin, gps } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const asked = useRef<string | null>(null);
  const latest = useRef<HTMLDivElement>(null);

  const localMatches = (q: string) =>
    rankResources(searchResources(RESOURCES, q), origin)
      .filter((x) => x.resource.status !== "closed")
      .slice(0, 3)
      .map((x) => x.resource.id);

  // Map pins: Leslie's citations first, then other open places of the same kinds, ranked
  // the same way Leslie ranks them for this emergency, so the map matches her answer.
  // Places not open to the public never appear.
  const pinsFor = (turn: Turn): string[] => {
    const cited = turn.resourceIds.filter((id) => BY_ID.get(id)?.status !== "closed");
    const s = turn.situation;
    const kinds = new Set<string>([
      ...cited.map((id) => BY_ID.get(id)!.category),
      ...matchCategories(turn.question),
      ...(s?.needs ?? []).flatMap((n) => NEED_KINDS[n] ?? []),
    ]);
    // "What are my options?" in an emergency: offer every kind of place that helps.
    if (s && s.hazardType !== "none" && kinds.size === 0) EMERGENCY_KINDS.forEach((k) => kinds.add(k));
    kinds.delete("ev_charging");
    if (kinds.size === 0) return cited;
    const from: [number, number] | null = s?.origin ? [s.origin.lat, s.origin.lng] : origin;
    const extra = rankForSituation(
      RESOURCES.filter((r) => !cited.includes(r.id) && r.status !== "closed" && (kinds.has(r.category) || r.tags.some((x) => kinds.has(x)))),
      from,
      s ? { hazardType: s.hazardType, hazardPoint: s.hazardPoint ? [s.hazardPoint.lat, s.hazardPoint.lng] : null, needs: s.needs } : null,
    )
      .filter((x) => x.status.state !== "closed");
    const pins = [...cited, ...extra.map((x) => x.resource.id)].slice(0, MAX_PINS);
    // Places near the hazard rank low, but people should still see them marked "call first".
    const nearHazard = extra
      .filter((x) => x.nearHazard && !pins.includes(x.resource.id))
      .sort((a, b) => (a.miles ?? 0) - (b.miles ?? 0))
      .slice(0, 2)
      .map((x) => x.resource.id);
    return [...pins, ...nearHazard];
  };

  const ask = async (question: string) => {
    const idx = turns.length;
    setExpanded(false);
    const history = turns
      .filter((x) => x.state === "answered")
      .flatMap((x) => [
        { role: "user" as const, text: x.question },
        { role: "assistant" as const, text: x.answer ?? "" },
      ]);

    if (!online || !hasBackend) {
      setTurns((ts) => [...ts, { question, state: "offline", resourceIds: localMatches(question) }]);
      return;
    }
    setTurns((ts) => [...ts, { question, state: "loading", resourceIds: [] }]);
    try {
      const res = await askLeslie({
        question,
        language: settings.lang,
        zip: settings.zip,
        lat: gps?.[0],
        lng: gps?.[1],
        history,
      });
      setTurns((ts) => ts.map((x, i) => (i === idx ? { ...x, state: "answered", ...res } : x)));
      if (settings.autoRead) speak(res.answer, res.language);
    } catch {
      setTurns((ts) => ts.map((x, i) => (i === idx ? { ...x, state: "error", resourceIds: localMatches(question) } : x)));
    }
  };

  useEffect(() => {
    const q = queryParam("q");
    if (q && asked.current !== q) {
      asked.current = q;
      ask(q);
    }
    // ask is stable enough for a one-time initial question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bring the newest question to the top so the answer and its map are in view.
  useEffect(() => {
    latest.current?.scrollIntoView({ behavior: settings.reduceMotion ? "auto" : "smooth", block: "start" });
  }, [turns.length, settings.reduceMotion]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q) return;
    setDraft("");
    ask(q);
  };

  const askBox = (
    <form onSubmit={submit} className="shrink-0">
      <div className="flex items-center gap-2 bg-surface-container-lowest border-2 border-primary-container dark:border-surface-variant rounded-2xl shadow-md p-1.5">
        <label htmlFor="ask-input" className="sr-only">
          {t.askLeslie}
        </label>
        <input
          id="ask-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={turns.length ? t.followUp : t.searchPlaceholder}
          className="flex-1 bg-transparent px-2 py-2 text-body-md focus:outline-none min-h-[44px]"
        />
        <button type="submit" aria-label={t.send} className="min-h-[48px] min-w-[48px] rounded-xl bg-primary-container text-white flex items-center justify-center">
          <Icon name="send" />
        </button>
      </div>
    </form>
  );

  const question = (turn: Turn) => (
    <p className="text-label-md text-on-surface-variant shrink-0">
      <span className="sr-only">{t.youAsked} </span>
      <span aria-hidden="true">“</span>
      {turn.question}
      <span aria-hidden="true">”</span>
    </p>
  );

  const current = turns[turns.length - 1];
  const pins = current && current.state !== "loading" ? pinsFor(current) : [];

  return (
    <Page back="#/" tab="ask">
      {turns.length === 0 && (
        <>
          <p className="text-body-lg bg-surface-container-low rounded-xl p-3 border border-surface-variant">{t.leslieIntro}</p>
          <p className="text-label-sm text-on-surface-variant">
            {t.emergencyLine}{" "}
            <a href="tel:911" className="text-error underline">
              911
            </a>
          </p>
          {askBox}
        </>
      )}

      {/* Earlier questions stay above, scrolled out of view. */}
      {turns.slice(0, -1).map((turn, i) => (
        <div key={i} className="flex flex-col gap-2 border-b border-surface-variant pb-3">
          {question(turn)}
          {turn.answer && <p className="text-body-md text-on-surface">{turn.answer}</p>}
          {turn.resourceIds.map((id) => {
            const r = BY_ID.get(id);
            if (!r) return null;
            const miles = origin ? distanceMiles(origin[0], origin[1], r.lat, r.lng) : null;
            return <ResourceCard key={id} r={r} miles={miles} compact />;
          })}
        </div>
      ))}

      {/* The newest answer fills the screen: answer on top, map below, follow-up box at the bottom. */}
      {current && (
        <div ref={latest} className="flex flex-col gap-2 h-[calc(100dvh-184px)] min-h-[520px] scroll-mt-16">
          {question(current)}

          {current.state === "loading" && (
            <p role="status" className="text-body-lg text-on-surface-variant flex items-center gap-2">
              <Icon name="hourglass_top" className="animate-pulse" /> {t.leslieThinking}
            </p>
          )}

          {(current.state === "offline" || current.state === "error") && (
            <p role="status" className="text-body-md flex gap-2 shrink-0">
              <Icon name={current.state === "offline" ? "cloud_off" : "info"} className="text-secondary shrink-0" />
              {current.state === "offline" ? t.leslieOffline : t.leslieError}
            </p>
          )}

          {current.state === "answered" && (
            <section className="flex flex-col shrink-0" aria-live="polite">
              <p className={`text-body-lg font-bold text-on-surface whitespace-pre-line ${expanded ? "" : "line-clamp-3"}`}>
                <span className="sr-only">Leslie: </span>
                {current.answer}
              </p>
              <div className="flex flex-wrap items-center gap-x-3">
                {(current.answer?.length ?? 0) > 120 && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((x) => !x)}
                    className="text-label-md text-primary underline underline-offset-4 min-h-[44px]"
                  >
                    {expanded ? t.showLess : t.showMore}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => speak(current.answer ?? "", current.language ?? settings.lang)}
                  className="inline-flex items-center gap-1 text-primary text-label-md hover:underline min-h-[44px]"
                >
                  <Icon name="volume_up" className="text-secondary" /> {t.listen}
                </button>
                {!current.verified && (
                  <a href="tel:211" className="inline-flex items-center gap-1 text-label-md text-primary underline underline-offset-4 min-h-[44px]">
                    <Icon name="call" /> 211
                  </a>
                )}
                <a href="tel:911" className="inline-flex items-center gap-1 text-label-md text-error underline underline-offset-4 min-h-[44px]">
                  <Icon name="emergency" /> 911
                </a>
              </div>
            </section>
          )}

          {current.state !== "loading" && pins.length === 0 && (
            <div className="bg-surface-container-lowest border-[1.5px] border-surface-variant rounded-2xl p-space-sm flex gap-2 shrink-0">
              <Icon name="info" className="text-secondary shrink-0" />
              <div>
                <p className="text-body-md">{t.noVerified}</p>
                <a href="tel:211" className="inline-flex items-center gap-1.5 text-label-md text-primary underline underline-offset-4 decoration-2 min-h-[44px]">
                  <Icon name="call" /> {t.call211}
                </a>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0">
            {pins.length > 0 && (
              <Suspense fallback={<p className="text-body-md">…</p>}>
                <AnswerMap key={pins.join(",")} ids={pins} situation={current.situation ?? null} />
              </Suspense>
            )}
          </div>

          {askBox}
        </div>
      )}
    </Page>
  );
}
