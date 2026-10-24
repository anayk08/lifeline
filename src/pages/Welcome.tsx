import { RESOURCES, type Lang } from "../../shared/resources";
import { LifelineMark } from "../components/figma";
import LegalFooter from "../components/LegalFooter";
import { Icon, PrimaryButton } from "../components/ui";
import { useApp } from "../lib/app";
import { LANG_NAMES } from "../lib/i18n";

export default function Welcome() {
  const { t, settings, update, requestGps } = useApp();
  return (
    <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between px-gutter py-space-xl bg-surface">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center gap-[0.5625rem]">
          <LifelineMark size={40} />
          <span className="text-[1.75rem] font-bold text-on-surface">{t.welcomeTitle}</span>
        </div>
        <p className="text-headline-md text-on-surface">{t.appTagline}</p>
        <p className="text-body-lg text-on-surface-variant">{t.welcomeBody}</p>
        <p className="text-label-md text-on-open-container bg-open-container rounded-xl px-3 py-2 flex items-center gap-2">
          <Icon name="offline_bolt" /> {t.offlineReadyDetail(RESOURCES.length)}
        </p>

        <fieldset className="flex flex-col gap-2 mt-space-sm">
          <legend className="text-label-lg text-primary mb-2">{t.chooseLanguage}</legend>
          {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => update({ lang: l })}
              aria-pressed={settings.lang === l}
              className={`min-h-[56px] px-4 rounded-2xl border-2 text-body-lg text-left flex items-center justify-between ${
                settings.lang === l ? "border-primary-container bg-surface-container-low font-bold" : "border-surface-variant bg-surface-container-lowest"
              }`}
            >
              {LANG_NAMES[l]}
              {settings.lang === l && <Icon name="check_circle" fill className="text-open" />}
            </button>
          ))}
        </fieldset>

        {/* Offered up front so people who need them don't have to find Settings first. */}
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">{t.accessibility}</legend>
          {(
            [
              ["highContrast", "visibility", t.highContrast],
              ["largeText", "text_increase", t.largeText],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={settings[key]}
              onClick={() => update({ [key]: !settings[key] })}
              className={`min-h-[48px] px-4 rounded-xl border-2 text-label-md flex items-center gap-2 ${
                settings[key] ? "border-primary-container bg-surface-container-low" : "border-surface-variant"
              }`}
            >
              <Icon name={icon} /> {label}
              {settings[key] && <Icon name="check" />}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="flex flex-col gap-3 mt-space-lg">
        <PrimaryButton
          icon="my_location"
          onClick={() => {
            requestGps();
            update({ onboarded: true });
          }}
        >
          {t.getStarted}
        </PrimaryButton>
        <button type="button" onClick={() => update({ onboarded: true })} className="text-label-md text-on-surface-variant underline underline-offset-4 min-h-[44px]">
          {t.skipLocation}
        </button>
        <LegalFooter />
      </div>
    </div>
  );
}
