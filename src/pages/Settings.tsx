import { RESOURCES, ZIP_CENTERS, type Lang } from "../../shared/resources";
import { Page } from "../components/Shell";
import { Icon } from "../components/ui";
import { useApp } from "../lib/app";
import { LANG_NAMES } from "../lib/i18n";

export default function Settings() {
  const { t, settings, update, gps, requestGps, gpsError } = useApp();
  const newest = RESOURCES.reduce((a, r) => (r.lastVerified > a ? r.lastVerified : a), "");

  return (
    <Page back="#/">
      <h1 className="text-headline-xl text-primary">{t.settingsTitle}</h1>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label-lg text-primary mb-1 flex items-center gap-1">
          <Icon name="language" /> {t.language}
        </legend>
        {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
          <label
            key={l}
            className={`flex items-center gap-3 min-h-[56px] px-4 rounded-2xl border-[1.5px] cursor-pointer ${
              settings.lang === l ? "border-primary-container bg-surface-container-low" : "border-surface-variant bg-surface-container-lowest"
            }`}
          >
            <input type="radio" name="lang" checked={settings.lang === l} onChange={() => update({ lang: l })} className="w-5 h-5 accent-[#0b1f3a]" />
            <span className="text-body-lg">{LANG_NAMES[l]}</span>
          </label>
        ))}
      </fieldset>

      <section className="flex flex-col gap-2">
        <label htmlFor="zip" className="text-label-lg text-primary flex items-center gap-1">
          <Icon name="home" /> {t.homeZip}
        </label>
        <input
          id="zip"
          inputMode="numeric"
          maxLength={5}
          list="zips"
          value={settings.zip}
          onChange={(e) => update({ zip: e.target.value.replace(/\D/g, "").slice(0, 5) })}
          className="min-h-[56px] px-4 rounded-2xl border-[1.5px] border-surface-variant bg-surface-container-lowest text-body-lg"
          placeholder="95112"
        />
        <datalist id="zips">
          {Object.keys(ZIP_CENTERS).map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <p className="text-body-md text-on-surface-variant">{t.homeZipHelp}</p>
        <button
          type="button"
          onClick={requestGps}
          className="self-start inline-flex items-center gap-2 min-h-[48px] px-4 rounded-xl border border-surface-variant bg-surface-container text-label-md"
        >
          <Icon name="my_location" /> {gps ? t.locationOn : t.useLocation}
        </button>
        {gpsError && <p className="text-label-sm text-error">GPS unavailable. Use your ZIP code instead.</p>}
      </section>

      <label className="flex items-center justify-between gap-3 min-h-[64px] px-4 rounded-2xl border-[1.5px] border-surface-variant bg-surface-container-lowest cursor-pointer">
        <span className="flex flex-col">
          <span className="text-label-lg flex items-center gap-1">
            <Icon name="battery_saver" /> {t.batterySaver}
          </span>
          <span className="text-body-md text-on-surface-variant">{t.batterySaverHelp}</span>
        </span>
        <input
          type="checkbox"
          checked={settings.batterySaver}
          onChange={(e) => update({ batterySaver: e.target.checked })}
          className="w-6 h-6 accent-[#ffad2e] shrink-0"
        />
      </label>

      <section className="bg-surface-container-low rounded-2xl p-4 border border-surface-variant flex flex-col gap-1">
        <h2 className="text-label-lg text-primary flex items-center gap-1">
          <Icon name="offline_bolt" /> {t.offlineData}
        </h2>
        <p className="text-body-md">{t.offlineReadyDetail(RESOURCES.length)}.</p>
        {newest && <p className="text-body-md">{t.checked(newest)}</p>}
        <p className="text-body-md text-on-surface-variant">{t.aboutData}</p>
      </section>

      <a href="#/caseload" className="text-label-md text-primary underline underline-offset-4 flex items-center gap-1 min-h-[44px]">
        <Icon name="groups" /> {t.caseload} (case manager view)
      </a>
    </Page>
  );
}
