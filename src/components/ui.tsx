import type { ReactNode } from "react";
import {
  daysSinceVerified,
  formatTime,
  isStale,
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

export function PrimaryButton({ href, onClick, icon, children, external }: {
  href?: string;
  onClick?: () => void;
  icon?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls =
    "w-full min-h-[3rem] px-space-md bg-primary text-white text-[0.9375rem] font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform";
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
