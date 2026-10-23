import { useEffect, useRef, useState, type FormEvent } from "react";
import { BY_ID, RESOURCES, distanceMiles, rankResources, type Lang } from "../../shared/resources";
import { Page } from "../components/Shell";
import { Icon, PrimaryButton, ResourceCard, directionsUrl } from "../components/ui";
import { queryParam, useApp } from "../lib/app";
import { askLeslie, hasBackend } from "../lib/backend";
import { searchResources } from "../lib/search";
import { speak } from "../lib/speech";

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
  const bottom = useRef<HTMLDivElement>(null);

  const localMatches = (q: string) =>
    rankResources(searchResources(RESOURCES, q), origin)
      .slice(0, 3)
      .map((x) => x.resource.id);

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

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: settings.batterySaver ? "auto" : "smooth", block: "end" });
  }, [turns, settings.batterySaver]);

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

      {turns.map((turn, i) => (
        <div key={i} className="flex flex-col gap-space-sm">
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
            <p className="text-body-lg flex gap-2">
              <Icon name={turn.state === "offline" ? "cloud_off" : "info"} className="text-secondary shrink-0" />
              {turn.state === "offline" ? t.leslieOffline : t.leslieError}
            </p>
          )}

          {turn.state === "answered" && (
            <section className="flex flex-col gap-1">
              <p className="text-label-sm text-on-surface-variant flex items-center gap-1">
                <Icon name="psychology" className="!text-[18px]" /> Leslie
                {turn.verified && (
                  <span className="ml-1 inline-flex items-center gap-1 text-on-open-container">
                    <Icon name="verified_user" fill className="!text-[16px]" /> {t.verified}
                  </span>
                )}
              </p>
              <h1 className="text-headline-md text-on-surface leading-snug whitespace-pre-line">{turn.answer}</h1>
              <button
                type="button"
                onClick={() => speak(turn.answer ?? "", turn.language ?? settings.lang)}
                className="self-start inline-flex items-center gap-2 text-primary text-label-md hover:underline min-h-[44px]"
              >
                <Icon name="volume_up" className="text-secondary" /> {t.readAloud}
              </button>
            </section>
          )}

          {turn.resourceIds.map((id, j) => {
            const r = BY_ID.get(id);
            if (!r) return null;
            const miles = origin ? distanceMiles(origin[0], origin[1], r.lat, r.lng) : null;
            return (
              <div key={id} className="flex flex-col gap-2">
                <ResourceCard r={r} miles={miles} compact={j > 0} />
                {j === 0 && turn.state === "answered" && (
                  <PrimaryButton href={directionsUrl(r)} external icon="directions">
                    {t.directions}
                  </PrimaryButton>
                )}
              </div>
            );
          })}

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
      ))}

      <p className="text-label-sm text-on-surface-variant">
        {t.emergencyLine}{" "}
        <a href="tel:911" className="text-error underline">
          911
        </a>
      </p>

      <div ref={bottom} />

      <form onSubmit={submit} className="fixed bottom-[84px] inset-x-0 max-w-md mx-auto px-gutter z-30">
        <div className="flex items-center gap-2 bg-surface-container-lowest border-2 border-primary-container dark:border-surface-variant rounded-2xl shadow-md p-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={turns.length ? t.followUp : t.searchPlaceholder}
            aria-label={t.askLeslie}
            className="flex-1 bg-transparent px-2 py-2 text-body-md focus:outline-none min-h-[44px]"
          />
          <button type="submit" aria-label={t.send} className="min-h-[44px] min-w-[44px] rounded-xl bg-primary-container text-white flex items-center justify-center">
            <Icon name="send" />
          </button>
        </div>
      </form>
      <div className="h-16" />
    </Page>
  );
}
