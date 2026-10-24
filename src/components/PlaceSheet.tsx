// The place card from the Figma "Resource detail" screens: status, address, routes
// (Amazon Location), maps links and Call. Routes are drawn on the map through onRoute.
import { useEffect, useState } from "react";
import { CATEGORY_LABELS, formatTime, openStatus, type Resource } from "../../shared/resources";
import type { RouteKind, RouteOption, RouteResult } from "../../shared/routes";
import { useApp } from "../lib/app";
import { planRoutes } from "../lib/backend";
import { useDataNotice } from "../lib/dataNotice";
import { mapsLink } from "../lib/maps";
import { CATEGORY_STYLE, FIcon } from "./figma";
import type { RouteLine } from "./HomeMap";
import { Icon, verifiedAgo } from "./ui";

export const ROUTE_COLOR: Record<RouteKind, string> = {
  fastest_walk: "#1971c2",
  easiest_walk: "#2f9e44",
  fastest_drive: "#e8590c",
};
const minutesOf = (o: RouteOption) => Math.max(1, Math.round(o.seconds / 60));
const milesOf = (o: RouteOption) => (o.meters / 1609.34).toFixed(1);

type RouteState = RouteResult | "loading" | "error" | null;

export default function PlaceSheet({
  r,
  miles,
  origin,
  flagged,
  onClose,
  onRoute,
  primary,
}: {
  r: Resource;
  miles: number | null;
  origin: [number, number] | null;
  /** Inside an alert area: "May be affected — call first". */
  flagged?: boolean;
  onClose: () => void;
  onRoute?: (line: RouteLine | null) => void;
  primary?: { label: string; onClick: () => void };
}) {
  const { t, settings, online } = useApp();
  const ensureNotice = useDataNotice();
  const style = CATEGORY_STYLE[r.category];
  const status = openStatus(r);
  const unconfirmed = r.status === "unknown";
  const [routes, setRoutes] = useState<RouteState>(null);
  const [chosen, setChosen] = useState(0);
  const [showSteps, setShowSteps] = useState(false);

  // Real routes from where the person is, when there's a signal.
  useEffect(() => {
    if (!origin || !online || !settings.dataNotice) return;
    let cancelled = false;
    setRoutes("loading");
    setChosen(0);
    setShowSteps(false);
    planRoutes(origin, [r.lat, r.lng], settings.lang)
      .then((res) => !cancelled && setRoutes(res))
      .catch(() => !cancelled && setRoutes("error"));
    return () => {
      cancelled = true;
    };
    // Compared by value so routes aren't refetched on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id, origin?.[0], origin?.[1], online, settings.lang, settings.dataNotice]);

  const options = routes && typeof routes === "object" ? routes.options : [];
  const option = options[chosen];
  useEffect(() => {
    onRoute?.(option ? { points: option.line, color: ROUTE_COLOR[option.kinds[0]], dashed: option.mode === "walk" } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option]);
  useEffect(() => () => onRoute?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const kindLabel = (k: RouteKind) => (k === "fastest_walk" ? t.fastestWalk : k === "easiest_walk" ? t.easiestWalk : t.fastestDrive);
  const mapsUrl = mapsLink(r, origin, option?.mode === "drive" ? "drive" : "walk");
  const phone = r.phone?.replace(/[^\d+]/g, "");

  return (
    <article
      aria-labelledby={`sheet-${r.id}`}
      className="bg-surface-container-lowest border border-surface-variant rounded-2xl px-4 pt-2.5 pb-4 flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between">
        <span className="w-[1.125rem]" />
        <span aria-hidden="true" className="w-8 h-1 rounded-full bg-surface-variant" />
        <button type="button" onClick={onClose} aria-label={t.close} className="w-11 h-11 -m-2 rounded-full flex items-center justify-center">
          <span className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-on-surface">
            <FIcon name="x" size={12} />
          </span>
        </button>
      </div>

      <p className="flex items-center gap-1.5 text-[0.75rem] text-on-surface-variant">
        <span className="cat-tint inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-semibold" style={{ background: style.tint, color: style.text }}>
          <FIcon name={style.icon} size={12} /> {t.categoryNames[r.category] ?? CATEGORY_LABELS[r.category]}
        </span>
        {miles !== null && t.miAwayShort(miles < 10 ? miles.toFixed(1) : miles.toFixed(0))}
      </p>

      <h2 id={`sheet-${r.id}`} className="text-[1.25rem] leading-6 font-bold text-on-surface">
        {r.name}
      </h2>
      <p className="flex items-center gap-1.5 text-[0.8125rem] leading-[1.125rem] text-on-surface-variant">
        <FIcon name="map-pin" size={12} /> {r.address}
      </p>

      <p className="flex flex-wrap items-center gap-2 text-[0.75rem] text-on-surface-variant">
        {status.state === "open" && !unconfirmed && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-open-container text-on-open-container font-bold">
            <FIcon name="check" size={12} /> {t.openNow}
          </span>
        )}
        {status.state === "closed" && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-error-container text-on-error-container font-bold">
            <FIcon name="clock-3" size={12} /> {t.closedNow}
          </span>
        )}
        {(status.state === "unknown" || unconfirmed) && status.state !== "closed" && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-warn-container text-on-warn-container font-bold">
            <FIcon name="phone" size={12} /> {t.hoursUnknown}
          </span>
        )}
        <span>
          {status.state === "open"
            ? status.is24h
              ? t.open24
              : status.closesAt
                ? t.until(formatTime(status.closesAt))
                : ""
            : status.opensAt
              ? t.opensAt(formatTime(status.opensAt))
              : r.hoursNote ?? ""}
        </span>
        {r.tags.includes("wheelchair") && (
          <span title={t.wheelchair}>
            <span aria-hidden="true">♿</span>
            <span className="sr-only">{t.wheelchair}</span>
          </span>
        )}
        {r.tags.includes("backup-power") && (
          <span className="inline-flex items-center gap-1">
            <Icon name="bolt" className="!text-[16px] !w-4" /> {t.backupPower}
          </span>
        )}
      </p>

      {flagged && (
        <p className="text-[0.75rem] font-bold bg-error-container text-on-error-container border border-error rounded-lg px-2 py-1.5 flex items-center gap-1.5">
          <Icon name="warning" className="!text-[16px] !w-4" /> {t.mayBeAffected}
        </p>
      )}
      {r.status !== "open" && (
        <p className="text-[0.75rem] font-bold bg-error-container text-on-error-container rounded-lg px-2 py-1.5">
          {r.status === "closed" ? t.notPublic : t.statusUnconfirmed}
        </p>
      )}
      <p className="bg-warn-container text-on-warn-container rounded-lg px-2 py-1.5 flex gap-1.5 items-start text-[0.6875rem] leading-[0.9375rem]">
        <FIcon name="info-link" size={13} className="mt-px" />
        <span>
          {r.notes ? `${r.notes} ` : ""}
          {t.checkedOn(verifiedAgo(r, settings.lang))}
        </span>
      </p>
      {r.transit && (
        <p className="text-[0.75rem] text-on-surface-variant flex items-center gap-1.5">
          <span aria-hidden="true">🚌</span> {r.transit}
        </p>
      )}

      {/* Real routes (needs a signal and a starting point). */}
      {!origin && <p className="text-[0.8125rem] text-on-surface-variant">{t.setLocationForRoutes}</p>}
      {origin && !online && <p className="text-[0.8125rem] text-on-surface-variant">{t.routesNeedSignal}</p>}
      {/* Routes send both locations to Amazon Location, so they wait for the data notice. */}
      {origin && online && !settings.dataNotice && (
        <button
          type="button"
          onClick={() => ensureNotice(() => {})}
          className="self-start min-h-[2.75rem] px-3 rounded-xl bg-surface-container-low text-primary text-[0.875rem] font-semibold flex items-center gap-2"
        >
          <FIcon name="navigation" size={16} /> {t.showRoutes}
        </button>
      )}
      {origin && online && routes === "loading" && (
        <p role="status" className="text-[0.8125rem] text-on-surface-variant flex items-center gap-1.5">
          <Icon name="hourglass_top" className="animate-pulse !text-[16px] !w-4" /> {t.routesLoading}
        </p>
      )}
      {origin && online && routes === "error" && <p className="text-[0.8125rem] text-on-surface-variant">{t.routeError}</p>}
      {options.length > 0 && (
        <div role="radiogroup" aria-label={t.howToGetThere} className="grid grid-cols-3 gap-1.5 mt-1">
          {options.map((o, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === chosen}
              aria-label={`${o.kinds.map(kindLabel).join(", ")}: ${t.minutes(minutesOf(o))}, ${milesOf(o)} mi`}
              onClick={() => {
                setChosen(i);
                setShowSteps(false);
              }}
              className={`text-left rounded-xl border-2 px-2 py-1 min-h-[3rem] ${i === chosen ? "bg-surface-container-low" : "bg-surface-container-lowest"}`}
              style={{ borderColor: i === chosen ? (settings.highContrast ? "var(--on-surface)" : ROUTE_COLOR[o.kinds[0]]) : "var(--surface-variant)" }}
            >
              <span className="block text-[0.875rem] font-bold whitespace-nowrap">
                <span aria-hidden="true">{o.mode === "walk" ? "🚶 " : "🚗 "}</span>
                {t.minutes(minutesOf(o))}
              </span>
              <span className="block text-[0.6875rem] leading-[0.875rem] text-on-surface-variant">
                {o.kinds.length > 1 ? t.fastestEasiest : kindLabel(o.kinds[0])}
              </span>
            </button>
          ))}
        </div>
      )}
      {option && (
        <p className="text-[0.75rem] text-on-surface-variant">
          {milesOf(option)} mi
          {option.mode === "walk" && <> · {option.climbMeters * 3.28 < 15 ? t.flat : t.climb(Math.round(option.climbMeters * 3.28))}</>} · {t.turns(option.turns)}
        </p>
      )}
      {option && showSteps && (
        <ol className="list-decimal pl-5 flex flex-col gap-1 text-[0.8125rem]">
          {option.steps.map((s, i) => (
            <li key={i}>{s.text}</li>
          ))}
        </ol>
      )}

      <div className="h-px bg-surface-variant my-1" />
      {/* One button: the phone's own maps app (Apple Maps on iPhone, the default app on Android). */}
      <a
        href={mapsUrl}
        {...(mapsUrl.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="min-h-[2.75rem] rounded-xl border border-surface-variant bg-surface-container-lowest text-primary text-[0.875rem] font-semibold flex items-center justify-center gap-2"
      >
        <FIcon name="map-pin" size={16} /> {t.openInMaps}
      </a>
      <div className="flex gap-2">
        {option && (
          <button
            type="button"
            aria-expanded={showSteps}
            onClick={() => setShowSteps((s) => !s)}
            className="flex-1 min-h-[2.75rem] rounded-xl bg-primary text-white text-[0.875rem] font-semibold flex items-center justify-center gap-2"
          >
            <FIcon name="navigation" size={16} /> {showSteps ? t.hideSteps : t.directions}
          </button>
        )}
        {phone && (
          <a href={`tel:${phone}`} className="flex-1 min-h-[2.75rem] rounded-xl bg-surface-container-low text-primary text-[0.875rem] font-semibold flex items-center justify-center gap-2">
            <FIcon name="phone" size={16} /> {t.call}
          </a>
        )}
      </div>
      {primary && (
        <button type="button" onClick={primary.onClick} className="min-h-[2.75rem] rounded-xl bg-primary text-white text-[0.875rem] font-semibold">
          {primary.label}
        </button>
      )}
      <a href={`#/place/${encodeURIComponent(r.id)}`} className="self-center text-[0.75rem] font-semibold text-primary underline underline-offset-2 min-h-[2.75rem] flex items-center">
        {t.moreDetails}
      </a>
    </article>
  );
}
