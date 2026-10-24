import type { ReactNode } from "react";
import {
  CATEGORY_LABELS,
  daysSinceVerified,
  formatTime,
  isStale,
  openStatus,
  type OpenStatus,
  type Resource,
} from "../../shared/resources";
import { useApp } from "../lib/app";

export function Icon({ name, fill, className = "" }: { name: string; fill?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`icon ${fill ? "fill" : ""} ${className}`}>
      {name}
    </span>
  );
}

export const CATEGORY_EMOJI: Record<string, string> = {
  pharmacy: "💊",
  health: "🩺",
  food: "🍲",
  cooling: "❄️",
  charging: "🔌",
  shelter: "🛏️",
  water: "💧",
  ev_charging: "🚗",
};

/** `unconfirmed`: the team couldn't confirm the place is operating, so listed hours alone don't earn "Open now". */
export function StatusBadge({ status, solid, unconfirmed }: { status: OpenStatus; solid?: boolean; unconfirmed?: boolean }) {
  const { t } = useApp();
  if (status.state === "open" && !unconfirmed) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-label-sm ${
          solid ? "bg-open text-white" : "bg-open-container text-on-open-container"
        }`}
      >
        <Icon name="check_circle" fill className="!text-[18px]" />
        {t.openNow}
      </span>
    );
  }
  if (status.state === "closed") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-label-sm bg-surface-container text-on-surface-variant">
        <Icon name="schedule" className="!text-[18px]" />
        {t.closedNow}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-label-sm bg-secondary-container/30 bg-surface-container-high text-on-surface">
      <Icon name="call" className="!text-[18px]" />
      {t.hoursUnknown}
    </span>
  );
}

export function statusLine(status: OpenStatus, t: ReturnType<typeof useApp>["t"]): string {
  if (status.state === "open") return status.is24h ? t.open24 : status.closesAt ? t.until(formatTime(status.closesAt)) : t.openNow;
  if (status.state === "closed" && status.opensAt) return t.opensAt(formatTime(status.opensAt));
  return "";
}

export function VerifiedBadge({ r }: { r: Resource }) {
  const { t } = useApp();
  const stale = isStale(r);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-label-sm ${
        stale
          ? "border-secondary text-secondary"
          : "border-surface-variant bg-surface-container-low text-primary-container dark:text-primary"
      }`}
    >
      <Icon name={stale ? "warning" : "verified_user"} fill className={`!text-[16px] ${stale ? "" : "text-open"}`} />
      {stale ? t.needsRecheck : t.verified}
    </span>
  );
}

export function verifiedAgo(r: Resource, lang: string): string {
  const days = daysSinceVerified(r);
  const date = new Date(`${r.lastVerified}T12:00:00`);
  const fmt = new Intl.DateTimeFormat(lang, { month: "short", day: "numeric" }).format(date);
  return days === 0 ? fmt : `${fmt}`;
}

export function directionsUrl(r: Resource) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address)}`;
}

export function ResourceCard({
  r,
  miles,
  compact,
}: {
  r: Resource;
  miles: number | null;
  compact?: boolean;
}) {
  const { t, settings } = useApp();
  const status = openStatus(r);
  const line = statusLine(status, t);
  return (
    <a
      href={`#/place/${encodeURIComponent(r.id)}`}
      className="block bg-surface-container-lowest border-[1.5px] border-surface-variant rounded-2xl p-4 shadow-sm hover:border-primary-container focus:outline-none focus:ring-4 focus:ring-secondary-container active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <StatusBadge status={status} unconfirmed={r.status === "unknown"} />
        {miles !== null && (
          <span className="text-label-md text-on-surface-variant flex items-center gap-1">
            <Icon name="near_me" className="!text-[18px]" />
            {t.miAway(miles < 10 ? miles.toFixed(1) : miles.toFixed(0))}
          </span>
        )}
      </div>
      <h3 className="text-headline-md text-primary mt-2 flex items-start gap-2">
        <span aria-hidden="true">{CATEGORY_EMOJI[r.category]}</span>
        <span>{r.name}</span>
      </h3>
      {!compact && r.services.length > 0 && (
        <p className="text-body-md text-on-surface-variant mt-1 line-clamp-2">{r.services.slice(0, 4).join(" · ")}</p>
      )}
      <div className="mt-2 pt-2 border-t border-surface-variant flex items-center justify-between gap-2 text-label-sm text-on-surface-variant">
        <span className="flex items-center gap-1 min-w-0">
          <Icon name="location_on" className="!text-[18px] shrink-0" />
          <span className="truncate">{r.address.replace(/, San Jos[eé],? CA.*$/i, "")}</span>
        </span>
        <span className="shrink-0">{line}</span>
      </div>
      <p className="sr-only">
        {CATEGORY_LABELS[r.category]}. {t.checked(verifiedAgo(r, settings.lang))}
      </p>
    </a>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-space-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-headline-lg text-primary">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function PrimaryButton({ href, onClick, icon, children, external }: {
  href?: string;
  onClick?: () => void;
  icon?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls =
    "w-full min-h-[56px] px-space-md bg-secondary-container text-[#151c24] text-headline-md rounded-2xl flex items-center justify-center gap-2 shadow-sm border-2 border-primary-container active:scale-[0.98] transition-transform focus:outline-none focus:ring-4 focus:ring-secondary-container";
  return href ? (
    <a className={cls} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {icon && <Icon name={icon} />}
      {children}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
