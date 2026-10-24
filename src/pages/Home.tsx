import { useState, type FormEvent } from "react";
import { RESOURCES } from "../../shared/resources";
import { Page } from "../components/Shell";
import { Icon } from "../components/ui";
import { go, useApp } from "../lib/app";
import { useSpeechInput } from "../lib/speech";

export default function Home() {
  const { t, online, settings, gps, requestGps } = useApp();
  const [query, setQuery] = useState("");
  const speech = useSpeechInput(settings.lang, (text) => {
    setQuery(text);
    go(`/ask?q=${encodeURIComponent(text)}`);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) go(`/ask?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <Page tab="ask">
      <section className="w-full bg-surface-container-low border border-surface-variant rounded-xl p-2.5 flex items-center gap-2">
        <Icon name="offline_bolt" className="text-primary !text-[20px]" />
        <span className="text-label-sm text-on-surface-variant">
          {t.offlineReady} · {t.offlineReadyDetail(RESOURCES.length)}
        </span>
      </section>

      <form onSubmit={submit} role="search">
        <label htmlFor="q" className="block text-headline-lg text-primary mb-2">
          {t.whatDoYouNeed}
        </label>
        <div className="relative flex items-center bg-surface-container-lowest border-2 border-primary-container dark:border-surface-variant rounded-2xl shadow-sm overflow-hidden focus-within:ring-4 focus-within:ring-secondary-container">
          <span className="pl-4 pr-2 text-on-surface-variant">
            <Icon name="search" className="!text-[26px]" />
          </span>
          <input
            id="q"
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full py-4 bg-transparent border-0 text-body-lg text-on-surface placeholder:text-outline focus:outline-none min-h-[56px]"
          />
          {speech.supported && (
            <button
              type="button"
              onClick={speech.start}
              aria-label={t.speak}
              className={`mr-2 flex items-center gap-1.5 px-3 py-2 border rounded-xl text-label-md min-h-[48px] focus:outline-none focus:ring-2 focus:ring-secondary-container ${
                speech.listening
                  ? "bg-secondary-container border-secondary text-[#151c24]"
                  : "bg-surface-container border-surface-variant text-primary"
              }`}
            >
              <Icon name="mic" fill className="text-secondary" />
              <span>{t.speak}</span>
            </button>
          )}
        </div>
        <p className="mt-2 text-label-sm text-on-surface-variant flex items-center gap-1">
          <Icon name="psychology" className="!text-[18px]" /> {online ? t.leslieHint : t.leslieHintOffline}
        </p>
      </form>

      <p className="text-body-lg text-on-surface px-1">
        {t.emergencyLine}{" "}
        <a href="tel:911" className="text-label-lg text-error underline decoration-2 underline-offset-4">
          911 {t.tapToDial}
        </a>
        . {t.infoLine}{" "}
        <a href="tel:211" className="text-label-lg text-primary underline decoration-2 underline-offset-4">
          211 {t.tapToDial}
        </a>
        .
      </p>

      {/* Leslie answers "what's open near me", so Home only offers location (for routes) and the full list. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!gps && (
          <button
            type="button"
            onClick={requestGps}
            className="text-label-md text-primary underline underline-offset-4 flex items-center gap-1 min-h-[44px]"
          >
            <Icon name="my_location" /> {t.useLocation}
          </button>
        )}
        <a href="#/list/all" className="text-label-md text-primary underline underline-offset-4 min-h-[44px] flex items-center gap-1">
          {t.allPlaces} ({RESOURCES.length}) <Icon name="chevron_right" />
        </a>
      </div>
    </Page>
  );
}
