import { useEffect, useState } from "react";
import { byImportance, covers, type LiveHazard } from "../../shared/hazards";
import { go, readStore, useApp, writeStore } from "../lib/app";
import { alertTitle, minutesSince, timeOfDay } from "../lib/hazards";
import { Icon } from "./ui";

const DISMISSED_KEY = "lifeline.dismissedAlerts";
const DISMISS_MS = 6 * 3_600_000;

/** Source with a link, or the "Simulated demo" label. Every alert shows one. */
export function AlertSource({ h, className = "" }: { h: LiveHazard; className?: string }) {
  const { t } = useApp();
  if (h.source === "Simulated") {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-2 border-current font-bold ${className}`}>
        <Icon name="science" className="!text-[16px]" /> {t.simulatedDemo}
      </span>
    );
  }
  return (
    <a href={h.sourceUrl} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 ${className}`}>
      {t.sourceIs(h.source)}
    </a>
  );
}

/**
 * Shown above the search bar when a warning or critical alert covers the person's GPS location,
 * their saved ZIP, or (if neither is known) anywhere in San José.
 */
export default function AlertBanner() {
  const { t, settings, hazards, hazardsFresh, hazardsAt, origin } = useApp();
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => readStore(DISMISSED_KEY, {}));
  // Ticks once a minute so "12 min ago" stays current and expired dismissals fall away.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const alert = hazards
    .filter((h) => h.severity !== "info" && covers(h, origin) && !((dismissed[h.id] ?? 0) > now))
    .sort(byImportance)[0];

  const dismiss = (id: string) => {
    // Keep only dismissals that still matter, so the list never grows.
    const next = Object.fromEntries(Object.entries({ ...dismissed, [id]: now + DISMISS_MS }).filter(([, until]) => until > now));
    setDismissed(next);
    writeStore(DISMISSED_KEY, next);
  };

  return (
    // The live region stays mounted so screen readers announce the banner when it appears.
    <div aria-live="polite">
      {alert && (
        <section
          aria-labelledby="alert-title"
          className="alert-banner bg-error-container text-on-error-container border-2 border-error rounded-2xl p-3 flex flex-col gap-2 shadow-sm"
        >
          <p id="alert-title" className="text-label-lg flex items-start gap-2">
            <span aria-hidden="true" className="text-[1.4rem] leading-none">⚠️</span>
            <span>
              {alertTitle(alert, t)} · {t.minsAgo(minutesSince(alert.startedAt, now))}
              {!hazardsFresh && hazardsAt && <> · {t.asOf(timeOfDay(hazardsAt, settings.lang))}</>}
            </span>
          </p>
          <p className="text-label-sm flex flex-wrap items-center gap-2">
            <AlertSource h={alert} />
          </p>
          <p className="text-headline-md">{t.areYouAffected}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => go(`/plan?alert=${encodeURIComponent(alert.id)}`)}
              className="flex-1 min-w-[10rem] min-h-[56px] px-4 rounded-xl bg-error text-white text-headline-md flex items-center justify-center gap-2 border-2 border-error focus:outline-none focus:ring-4 focus:ring-secondary-container"
            >
              <Icon name="sos" fill /> {t.yesHelpMe}
            </button>
            <button
              type="button"
              onClick={() => dismiss(alert.id)}
              className="min-h-[48px] px-4 rounded-xl border-2 border-current text-label-md bg-transparent focus:outline-none focus:ring-4 focus:ring-secondary-container"
            >
              {t.notAffected}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
