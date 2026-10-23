import type { ReactNode } from "react";
import { useApp } from "../lib/app";
import { Icon } from "./ui";

export function TopBar({ back }: { back?: string }) {
  const { t, online } = useApp();
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between w-full min-h-[56px] px-gutter bg-surface-container-lowest shadow-sm">
      <div className="flex items-center gap-2">
        {back ? (
          <a
            href={back === "history" ? "#/" : back}
            onClick={(e) => {
              // Go back to wherever the resident came from (list, map or Leslie) when there is history.
              if (back === "history" && window.history.length > 1) {
                e.preventDefault();
                window.history.back();
              }
            }}
            className="inline-flex items-center gap-1 text-primary text-label-md min-h-[48px] pr-2 rounded-lg focus:outline-none focus:ring-4 focus:ring-secondary-container"
          >
            <Icon name="arrow_back" />
            {t.back}
          </a>
        ) : (
          <a href="#/" className="flex items-center gap-2 min-h-[48px]">
            <Icon name="emergency" fill className="text-primary !text-[28px]" />
            <span className="text-headline-md text-primary tracking-tight">Lifeline</span>
          </a>
        )}
        <span
          role="status"
          className={`ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-label-sm min-h-[32px] ${
            online
              ? "bg-surface-container border-surface-variant text-on-open-container"
              : "bg-error-container border-error text-on-error-container"
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full inline-block ${online ? "bg-open" : "bg-error"}`} />
          {online ? t.online : t.offline}
        </span>
      </div>
      <a
        href="#/settings"
        aria-label={t.settings}
        className="inline-flex items-center gap-1 px-2.5 rounded-xl text-on-surface-variant text-label-md min-h-[48px] min-w-[48px] justify-center hover:bg-surface-container-high focus:outline-none focus:ring-4 focus:ring-secondary-container"
      >
        <Icon name="settings" />
        <span className="hidden min-[380px]:inline">{t.settings}</span>
      </a>
    </header>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center min-h-[56px] min-w-[88px] px-space-md py-1 rounded-xl text-label-md transition-all focus:outline-none focus:ring-4 focus:ring-secondary-container active:scale-[0.97] ${
        active ? "bg-primary-container text-white ring-2 ring-secondary-container" : "text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      <Icon name={icon} fill={active} />
      <span>{label}</span>
    </a>
  );
}

export function BottomNav({ tab }: { tab: "ask" | "map" }) {
  const { t } = useApp();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 inset-x-0 z-40 max-w-md mx-auto flex justify-around items-center px-gutter pt-2 pb-safe bg-surface-container-lowest shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
    >
      <NavItem href="#/" icon="help" label={t.ask} active={tab === "ask"} />
      <NavItem href="#/map" icon="map" label={t.map} active={tab === "map"} />
    </nav>
  );
}

export function Page({
  children,
  back,
  tab,
  wide,
}: {
  children: ReactNode;
  back?: string;
  tab?: "ask" | "map";
  wide?: boolean;
}) {
  const { online, t } = useApp();
  return (
    <div className={`w-full ${wide ? "max-w-5xl" : "max-w-md"} mx-auto min-h-screen flex flex-col bg-surface relative`}>
      {/* Hash routing owns the URL fragment, so the skip link moves focus instead of linking to #main. */}
      <button
        type="button"
        onClick={() => document.getElementById("main")?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-3 focus:rounded-xl focus:bg-secondary-container focus:text-[#151c24] text-label-md"
      >
        {t.skipToContent}
      </button>
      <TopBar back={back} />
      {!online && (
        <div role="status" className="bg-primary-container text-white px-gutter py-1.5 text-label-sm flex items-center gap-2">
          <Icon name="cloud_off" className="!text-[18px]" />
          {t.workingOffline}
        </div>
      )}
      <main
        id="main"
        tabIndex={-1}
        className={`flex-1 flex flex-col px-gutter pt-space-sm gap-space-md focus:outline-none ${tab ? "pb-28" : "pb-10"}`}
      >
        {children}
      </main>
      {tab && <BottomNav tab={tab} />}
    </div>
  );
}
