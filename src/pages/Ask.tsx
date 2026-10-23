import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { BY_ID, RESOURCES, distanceMiles, rankResources, type Lang } from "../../shared/resources";
import { Page } from "../components/Shell";
import { Icon, ResourceCard } from "../components/ui";
import { queryParam, useApp } from "../lib/app";
import { askLeslie, hasBackend } from "../lib/backend";
import { matchCategories, searchResources } from "../lib/search";
import { speak } from "../lib/speech";

// Leaflet is heavy, so the results map loads on first use (it is still precached for offline).
const AnswerMap = lazy(() => import("../components/AnswerMap"));

const MAX_PINS = 6;

interface Turn {
  question: string;
  state: "loading" | "answered" | "offline" | "error";
  answer?: string;
  resourceIds: string[];
  verified?: boolean;
  language?: Lang;
}

export default function Ask() {
  const { t, settings, online, origin, gps } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const asked = useRef<string | null>(null);
  const latest = useRef<HTMLDivElement>(null);

  const localMatches = (q: string) =>
    rankResources(searchResources(RESOURCES, q), origin)
      .filter((x) => x.resource.status !== "closed")
      .slice(0, 3)
      .map((x) => x.resource.id);

  // Map pins: Leslie's citations first, then the nearest other open places of the same
  // kinds, so the resident has real choices. Places not open to the public never appear.
  const pinsFor = (turn: Turn): string[] => {
    const cited = turn.resourceIds.filter((id) => BY_ID.get(id)?.status !== "closed");
    const kinds = new Set([
      ...cited.map((id) => BY_ID.get(id)!.category),
      ...matchCategories(turn.question),
    ]);
    kinds.delete("ev_charging");
    if (kinds.size === 0) return cited;
    const extra = rankResources(
      RESOURCES.filter((r) => !cited.includes(r.id) && r.status !== "closed" && (kinds.has(r.category) || r.tags.some((x) => kinds.has(x)))),
      origin,
    )
      .filter((x) => x.status.state !== "closed")
      .map((x) => x.resource.id);
    return [...cited, ...extra].slice(0, MAX_PINS);
  };

  const ask = async (question: string) => {
    const idx = turns.length;
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

  return (
    <Page back="#/" tab="ask">
      {turns.length === 0 && (
        <p className="text-body-lg bg-surface-container-low rounded-xl p-3 border border-surface-variant">{t.leslieIntro}</p>
      )}

      {turns.map((turn, i) => {
        const isLatest = i === turns.length - 1;
        const pins = turn.state === "loading" ? [] : pinsFor(turn);
        return (
          <div key={i} ref={isLatest ? latest : undefined} className="flex flex-col gap-space-sm scroll-mt-20">
            <section className="bg-surface-container-low rounded-xl p-space-xs border border-surface-variant">
              <p className="text-label-sm text-on-surface-variant">{t.youAsked}</p>
              <p className="text-body-lg font-bold">{turn.question}</p>
            </section>

            {turn.state === "loading" && (
              <p role="status" className="text-body-lg text-on-surface-variant flex items-center gap-2">
                <Icon name="hourglass_top" className="animate-pulse" /> {t.leslieThinking}
              </p>
            )}

            {(turn.state === "offline" || turn.state === "error") && (
              <p role="status" className="text-body-lg flex gap-2">
                <Icon name={turn.state === "offline" ? "cloud_off" : "info"} className="text-secondary shrink-0" />
                {turn.state === "offline" ? t.leslieOffline : t.leslieError}
              </p>
            )}

            {turn.state === "answered" && (
              <section className="flex flex-col gap-1" aria-live="polite">
                <p className="text-label-sm text-on-surface-variant flex items-center gap-1">
                  <Icon name="psychology" className="!text-[18px]" /> Leslie
                  {turn.verified && (
                    <span className="ml-1 inline-flex items-center gap-1 text-on-open-container">
                      <Icon name="verified_user" fill className="!text-[16px]" /> {t.verified}
                    </span>
                  )}
                </p>
                <p className="text-[20px] leading-[30px] font-bold text-on-surface whitespace-pre-line">{turn.answer}</p>
                <button
                  type="button"
                  onClick={() => speak(turn.answer ?? "", turn.language ?? settings.lang)}
                  className="self-start inline-flex items-center gap-2 text-primary text-label-md hover:underline min-h-[44px]"
                >
                  <Icon name="volume_up" className="text-secondary" /> {t.readAloud}
                </button>
              </section>
            )}

            {isLatest && pins.length > 0 ? (
              <Suspense fallback={<p className="text-body-md">…</p>}>
                <AnswerMap key={pins.join(",")} ids={pins} />
              </Suspense>
            ) : (
              turn.resourceIds.map((id) => {
                const r = BY_ID.get(id);
                if (!r) return null;
                const miles = origin ? distanceMiles(origin[0], origin[1], r.lat, r.lng) : null;
                return <ResourceCard key={id} r={r} miles={miles} compact />;
              })
            )}

            {turn.state !== "loading" && (turn.verified === false || turn.resourceIds.length === 0) && (
              <div className="bg-surface-container-lowest border-[1.5px] border-surface-variant rounded-2xl p-space-sm flex gap-2">
                <Icon name="info" className="text-secondary shrink-0" />
                <div>
                  {turn.resourceIds.length === 0 && turn.state !== "answered" && <p className="text-body-md">{t.noVerified}</p>}
                  <a href="tel:211" className="inline-flex items-center gap-1.5 text-label-md text-primary underline underline-offset-4 decoration-2 min-h-[44px]">
                    <Icon name="call" /> {t.call211}
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="text-label-sm text-on-surface-variant">
        {t.emergencyLine}{" "}
        <a href="tel:911" className="text-error underline">
          911
        </a>
      </p>

      <form onSubmit={submit} className="fixed bottom-[84px] inset-x-0 max-w-md mx-auto px-gutter z-30">
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
      <div className="h-16" />
    </Page>
  );
}
