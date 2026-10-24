// Shared building blocks for the legal and info pages, in the app's Figma style.
import type { ReactNode } from "react";
import { BUSINESS, isPlaceholder } from "../config/business";

/** A business value, highlighted while it's still a {{PLACEHOLDER}} so it can't be missed. */
export function Biz({ k }: { k: keyof typeof BUSINESS }) {
  const value = BUSINESS[k];
  if (isPlaceholder(value)) {
    return <mark className="bg-warn-container text-on-warn-container rounded px-1 font-mono text-[0.8125rem]">{value}</mark>;
  }
  if (k === "SUPPORT_EMAIL") {
    return (
      <a href={`mailto:${value}`} className="text-primary underline underline-offset-2">
        {value}
      </a>
    );
  }
  if (k === "SUPPORT_URL") {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
        {value}
      </a>
    );
  }
  return <>{value}</>;
}

export function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 text-[0.9375rem] leading-6 text-on-surface">
      <h1 className="text-[1.375rem] leading-7 font-semibold text-on-surface">{title}</h1>
      {children}
    </article>
  );
}

export function Updated() {
  return (
    <p className="text-[0.8125rem] text-on-surface-variant">
      Effective date: <Biz k="EFFECTIVE_DATE" />
    </p>
  );
}

export function H({ children }: { children: ReactNode }) {
  return <h2 className="text-[1.0625rem] font-semibold text-on-surface mt-3">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 flex flex-col gap-1.5">{children}</ul>;
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="bg-surface-container-lowest border border-surface-variant rounded-2xl p-3 flex flex-col gap-1.5">{children}</div>;
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 break-words">
      {children}
    </a>
  );
}

export function In({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a href={`#/${to}`} className="text-primary underline underline-offset-2">
      {children}
    </a>
  );
}

/** A labeled row in a table of data uses (what, sent to, when, why). */
export function DataRow({ what, to, when, why }: { what: ReactNode; to: ReactNode; when: ReactNode; why: ReactNode }) {
  return (
    <Card>
      <p className="font-semibold">{what}</p>
      <p className="text-[0.875rem]">
        <span className="text-on-surface-variant">Sent to: </span>
        {to}
      </p>
      <p className="text-[0.875rem]">
        <span className="text-on-surface-variant">When: </span>
        {when}
      </p>
      <p className="text-[0.875rem]">
        <span className="text-on-surface-variant">Why: </span>
        {why}
      </p>
    </Card>
  );
}
