import type { ReactNode } from "react";
import { useApp } from "../lib/app";
import { LifelineMark } from "./figma";
import { Icon } from "./ui";

export function TopBar({ back }: { back?: string }) {
  const { t, online, settings } = useApp();
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between w-full min-h-[3.25rem] px-gutter bg-surface">
      {back ? (
        <a
          href={back === "history" ? "#/" : back}
          onClick={(e) => {
            // Go back to wherever the resident came from (Home, the map or a plan) when there is history.
            if (back === "history" && window.history.length > 1) {
              e.preventDefault();
              window.history.back();
            }
          }}
          className="inline-flex items-center gap-1 text-primary text-[0.9375rem] font-semibold min-h-[3rem] pr-2 rounded-lg"
        >
          <Icon name="arrow_back" />
          {t.back}
        </a>
      ) : (
        <a href="#/" className="flex items-center gap-[0.5625rem] min-h-[3rem]">
          <LifelineMark />
          <span className="text-[1.5rem] font-bold text-on-surface">Lifeline</span>
        </a>
      )}
      <div className="flex items-center gap-1.5">
        {settings.demo && (
          <span className="px-2.5 py-1.5 rounded-full bg-surface-container-low text-primary text-[0.6875rem] font-semibold">{t.sjsuDemo}</span>
        )}
        <span
          role="status"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[0.6875rem] font-semibold ${
            online ? "sr-only" : "bg-error-container text-on-error-container"
          }`}
        >
          <span aria-hidden="true" className={`w-2 h-2 rounded-full ${online ? "bg-open" : "bg-error"}`} />
          {online ? t.online : t.offline}
        </span>
        <a
          href="#/settings"
          aria-label={t.settings}
          className="inline-flex items-center justify-center rounded-xl text-on-surface-variant min-h-[2.75rem] min-w-[2.75rem] hover:bg-surface-container"
        >
          <Icon name="settings" />
        </a>
      </div>
    </header>
  );
}

export function Page({ children, back, wide }: { children: ReactNode; back?: string; wide?: boolean }) {
  const { online, t } = useApp();
  return (
    <div className={`w-full ${wide ? "max-w-5xl" : "max-w-md"} mx-auto min-h-screen flex flex-col bg-surface relative`}>
      {/* Hash routing owns the URL fragment, so the skip link moves focus instead of linking to #main. */}
      <button
        type="button"
        onClick={() => document.getElementById("main")?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-3 focus:rounded-xl focus:bg-surface-container-lowest text-label-md"
      >
        {t.skipToContent}
      </button>
      <TopBar back={back} />
      {!online && (
        <div role="status" className="bg-primary text-white px-gutter py-1.5 text-[0.75rem] font-semibold flex items-center gap-2">
          <Icon name="cloud_off" className="!text-[18px]" />
          {t.workingOffline}
        </div>
      )}
      <main id="main" tabIndex={-1} className="flex-1 flex flex-col px-gutter pt-2 pb-8 gap-1.5 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
