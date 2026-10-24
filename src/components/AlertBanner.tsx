import { useEffect, useState } from "react";
import { byImportance, covers, type LiveHazard } from "../../shared/hazards";
import { readStore, useApp, writeStore } from "../lib/app";
import { alertTitle, minutesSince, timeOfDay } from "../lib/hazards";
import { FIcon, type FigmaIconName } from "./figma";
import { Icon } from "./ui";

const RESPONSES_KEY = "lifeline.alertResponses";
const RESPONSE_MS = 6 * 3_600_000;

type Answer = "yes" | "no";
type Responses = Record<string, { answer: Answer; until: number }>;

/**
 * The alert that matters for this person (a warning or worse covering their GPS, area or ZIP,
 * or anywhere in San José) and their Yes/No answer, which is remembered for 6 hours.
 */
export function useAlert() {
  const { hazards, origin } = useApp();
  const [responses, setResponses] = useState<Responses>(() => readStore(RESPONSES_KEY, {}));
  // Ticks once a minute so "12 min ago" stays current and old answers expire.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const alert = hazards.filter((h) => h.severity !== "info" && covers(h, origin)).sort(byImportance)[0] ?? null;
  const saved = alert ? responses[alert.id] : undefined;
  const answer: Answer | null = saved && saved.until > now ? saved.answer : null;

  const respond = (next: Answer | null) => {
    if (!alert) return;
    // Keep only answers that still matter, so the list never grows.
    const kept = Object.fromEntries(Object.entries(responses).filter(([id, v]) => id !== alert.id && v.until > now));
    const updated = next ? { ...kept, [alert.id]: { answer: next, until: now + RESPONSE_MS } } : kept;
    setResponses(updated);
    writeStore(RESPONSES_KEY, updated);
  };
  return { alert, answer, respond, now };
}

/** Source with a link, or the "Simulated demo" label. Every alert shows one. */
export function AlertSource({ h, className = "" }: { h: LiveHazard; className?: string }) {
  const { t } = useApp();
  if (h.source === "Simulated") {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-current font-bold ${className}`}>
        <Icon name="science" className="!text-[14px] !w-3.5" /> {t.simulatedDemo}
      </span>
    );
  }
  return (
    <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${className}`}>
      {t.sourceIs(h.source)}
    </a>
  );
}

const ALERT_ICON: Partial<Record<LiveHazard["type"], FigmaIconName>> = {
  extreme_heat: "thermometer-sun",
  flood: "droplets",
  power_outage: "battery-charging",
};

const typeLabel = (h: LiveHazard, names: Record<string, string>) => (names[h.type] ?? names.other).toUpperCase();

/** "Are you affected?" card above the map, or the short acknowledgement after answering. */
export default function AlertBanner({
  alert,
  answer,
  now,
  onAnswer,
}: {
  alert: LiveHazard;
  answer: Answer | null;
  now: number;
  onAnswer: (a: Answer | null) => void;
}) {
  const { t, settings, hazardsFresh, hazardsAt } = useApp();
  const simulated = alert.source === "Simulated";
  const label = simulated ? `${t.demoAlertLabel}` : `${t.liveAlertLabel} · ${alert.source.toUpperCase()}`;
  const age = (
    <>
      {t.minsAgo(minutesSince(alert.startedAt, now))}
      {!hazardsFresh && hazardsAt && <> · {t.asOf(timeOfDay(hazardsAt, settings.lang))}</>}
    </>
  );

  return (
    // The live region stays mounted so screen readers announce the card when it appears.
    <div aria-live="polite">
      {answer ? (
        <section className="alert-banner bg-warn-container border border-warn-border rounded-xl min-h-[3.5rem] px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-[0.625rem] font-bold text-on-warn-container">
              {simulated ? t.demoAlertLabel.split(" · ")[0] : t.liveAlertLabel} · {typeLabel(alert, t.alertNames)}
            </p>
            <p className="text-[0.8125rem] font-semibold text-on-surface">{answer === "yes" ? t.markedAffected : t.markedNotAffected}</p>
          </div>
          <button type="button" onClick={() => onAnswer(null)} className="text-[0.6875rem] font-semibold text-primary underline underline-offset-2 min-h-[2.75rem] px-1">
            {t.changeResponse}
          </button>
        </section>
      ) : (
        <section
          aria-labelledby="alert-title"
          className="alert-banner bg-warn-container border border-warn-border rounded-2xl p-3 flex flex-col gap-1.5"
        >
          <p className="flex items-center gap-1.5 text-[0.625rem] font-bold text-on-warn-container">
            {ALERT_ICON[alert.type] ? <FIcon name={ALERT_ICON[alert.type]!} size={16} /> : <Icon name="warning" className="!text-[16px] !w-4" />}
            {label}
          </p>
          <h2 id="alert-title" className="text-[1rem] leading-5 font-bold text-on-surface">
            {alertTitle(alert, t)}
          </h2>
          <p className="text-[0.75rem] leading-4 text-on-surface-variant flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{age}</span>
            <AlertSource h={alert} className="text-on-warn-container" />
          </p>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[0.875rem] font-semibold text-on-surface">{t.areYouAffected}</p>
            <div className="flex gap-2 min-w-[10.25rem] flex-1 max-w-[12rem]">
              <button
                type="button"
                onClick={() => onAnswer("yes")}
                className="flex-1 min-h-[3rem] rounded-xl bg-primary text-white text-[0.875rem] font-semibold"
              >
                {t.yes}
              </button>
              <button
                type="button"
                onClick={() => onAnswer("no")}
                className="flex-1 min-h-[3rem] rounded-xl bg-surface-container-low text-primary text-[0.875rem] font-semibold"
              >
                {t.no}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
