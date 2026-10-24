import { useState } from "react";
import {
  BY_ID,
  DAYS,
  distanceMiles,
  formatTime,
  openStatus,
  sanJoseNow,
  type DayKey,
} from "../../shared/resources";
import { Page } from "../components/Shell";
import { CATEGORY_EMOJI, Icon, PrimaryButton, StatusBadge, VerifiedBadge, directionsUrl, statusLine, verifiedAgo } from "../components/ui";
import { useApp } from "../lib/app";
import { reportProblem } from "../lib/backend";

const LANG_LABEL: Record<string, string> = {
  en: "English",
  es: "Español",
  vi: "Tiếng Việt",
  zh: "中文",
  tl: "Tagalog",
  ko: "한국어",
  pa: "ਪੰਜਾਬੀ",
  hi: "हिन्दी",
  ru: "Русский",
  fa: "فارسی",
  ar: "العربية",
  pt: "Português",
  ja: "日本語",
};

export default function Place({ id }: { id: string }) {
  const { t, origin, settings } = useApp();
  const [reportState, setReportState] = useState<"idle" | "open" | "sent" | "queued">("idle");
  const [reason, setReason] = useState("");
  const r = BY_ID.get(id);
  if (!r) {
    return (
      <Page back="#/">
        <p className="text-body-lg">{t.noResults}</p>
      </Page>
    );
  }
  const status = openStatus(r);
  const miles = origin ? distanceMiles(origin[0], origin[1], r.lat, r.lng) : null;
  const today = sanJoseNow().day;
  const dayName = (d: DayKey) =>
    new Intl.DateTimeFormat(settings.lang, { weekday: "long" }).format(
      new Date(Date.UTC(2026, 9, 18 + DAYS.indexOf(d), 12)), // Oct 18 2026 is a Sunday
    );

  const submitReport = async () => {
    const res = await reportProblem(r.id, reason.trim() || "Resident says the listing is wrong");
    setReportState(res);
  };

  return (
    <Page back="history">
      <article className="flex flex-col gap-space-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={status} solid unconfirmed={r.status === "unknown"} />
          <VerifiedBadge r={r} />
          {miles !== null && (
            <span className="text-label-sm text-on-surface-variant ml-auto">{t.miAway(miles.toFixed(1))}</span>
          )}
        </div>
        <h1 className="text-headline-xl text-primary flex gap-2">
          <span aria-hidden="true">{CATEGORY_EMOJI[r.category]}</span>
          {r.name}
        </h1>
        {statusLine(status, t) && <p className="text-body-lg text-on-surface">{statusLine(status, t)}</p>}
        {r.status !== "open" && (
          <p className="text-body-md bg-error-container text-on-error-container rounded-xl p-3 flex gap-2">
            <Icon name="warning" className="shrink-0" />
            {r.status === "closed" ? t.notPublic : t.statusUnconfirmed}
          </p>
        )}
        {r.notes && <p className="text-body-lg text-on-surface">{r.notes}</p>}
        {r.hoursNote && (
          <p className="text-body-md bg-surface-container-low border border-surface-variant rounded-xl p-3 flex gap-2">
            <Icon name="info" className="text-secondary shrink-0" />
            {r.hoursNote}
          </p>
        )}

        <div className="flex flex-col gap-1 border-y border-surface-variant py-2">
          {r.phone && (
            <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 text-primary text-body-lg underline underline-offset-4 decoration-2 min-h-[44px]">
              <Icon name="call" /> {r.phone.replace(/^\+1-?/, "")}
            </a>
          )}
          <a href={directionsUrl(r)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-on-surface text-body-lg underline underline-offset-4 min-h-[44px]">
            <Icon name="location_on" className="text-error" /> {r.address}
          </a>
        </div>

        <PrimaryButton href={directionsUrl(r)} external icon="directions">
          {t.directions}
        </PrimaryButton>

        {r.hours && (
          <section>
            <h2 className="text-headline-md text-primary mb-1">{t.hours}</h2>
            <table className="w-full text-body-md">
              <tbody>
                {DAYS.map((d) => {
                  const ranges = r.hours?.[d] ?? [];
                  return (
                    <tr key={d} className={d === today ? "font-bold bg-surface-container-low" : ""}>
                      <td className="py-1.5 pl-2 capitalize">{dayName(d)}</td>
                      <td className="py-1.5 pr-2 text-right">
                        {ranges.length === 0
                          ? "—"
                          : ranges
                              .map(([o, c]) => (o === "00:00" && c >= "24:00" ? t.open24 : `${formatTime(o)} – ${formatTime(c)}`))
                              .join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {r.services.length > 0 && (
          <section>
            <h2 className="text-headline-md text-primary mb-1">{t.services}</h2>
            <ul className="flex flex-wrap gap-2">
              {r.services.map((s) => (
                <li key={s} className="px-3 py-1.5 rounded-xl bg-surface-container text-body-md">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid grid-cols-1 gap-2">
          {r.tags.includes("backup-power") && (
            <p className="text-body-md flex items-center gap-2">
              <Icon name="bolt" fill className="text-secondary" /> {t.backupPower}
            </p>
          )}
          {r.transit && (
            <p className="text-body-md flex items-center gap-2">
              <Icon name="directions" className="text-primary" /> {r.transit}
            </p>
          )}
          {r.languages.length > 0 && (
            <div>
              <h2 className="text-label-lg text-primary">{t.languages}</h2>
              <p className="text-body-md">{r.languages.map((l) => LANG_LABEL[l] ?? l.toUpperCase()).join(" · ")}</p>
            </div>
          )}
          {r.eligibility && (
            <div>
              <h2 className="text-label-lg text-primary">{t.eligibility}</h2>
              <p className="text-body-md">{r.eligibility}</p>
            </div>
          )}
        </section>

        <p className="text-label-sm text-on-surface-variant border-t border-surface-variant pt-2">
          {t.source}:{" "}
          <a href={r.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">
            {new URL(r.source).hostname.replace(/^www\./, "")}
          </a>
          . {t.checked(verifiedAgo(r, settings.lang))}.
        </p>

        {reportState === "idle" && (
          <button
            type="button"
            onClick={() => setReportState("open")}
            className="self-start inline-flex items-center gap-1 text-label-md text-on-surface-variant underline underline-offset-4 min-h-[44px]"
          >
            <Icon name="flag" /> {t.reportProblem}
          </button>
        )}
        {reportState === "open" && (
          <div className="flex flex-col gap-2 bg-surface-container-low rounded-xl p-3">
            <label htmlFor="reason" className="text-label-md">
              {t.reportProblem}
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={300}
              className="rounded-xl border border-surface-variant bg-surface-container-lowest p-2 text-body-md"
            />
            <button
              type="button"
              onClick={submitReport}
              className="self-start px-4 min-h-[48px] rounded-xl bg-primary-container text-white text-label-md"
            >
              {t.send}
            </button>
          </div>
        )}
        {(reportState === "sent" || reportState === "queued") && (
          <p role="status" className="text-body-md text-on-open-container bg-open-container rounded-xl p-3">
            {reportState === "sent" ? t.reported : t.reportQueued}
          </p>
        )}
      </article>
    </Page>
  );
}
