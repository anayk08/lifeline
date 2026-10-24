// Settings rows for Help, About and Terms & Conditions, plus the version.
import { APP_BUILD, APP_VERSION } from "../config/business";
import { useApp } from "../lib/app";
import { Icon } from "./ui";

const linkRow =
  "flex items-center justify-between gap-2 min-h-[3rem] px-4 rounded-2xl border border-surface-variant bg-surface-container-lowest text-[0.9375rem]";

export default function SettingsExtras() {
  const { t, settings } = useApp();

  const links: [string, string][] = [
    ["help", t.helpFaq],
    ["about", t.aboutApp],
    ["legal/terms", t.termsConditions],
  ];

  return (
    <nav aria-labelledby="about-legal" className="flex flex-col gap-2">
      <h2 id="about-legal" className="text-label-lg text-primary flex items-center gap-1">
        <Icon name="info" /> {t.aboutLegal}
      </h2>
      {links.map(([to, label]) => (
        <a key={to} href={`#/${to}`} className={linkRow}>
          <span>
            {label}
            {to.startsWith("legal/") && settings.lang !== "en" && <span className="text-on-surface-variant"> {t.englishOnly}</span>}
          </span>
          <Icon name="chevron_right" />
        </a>
      ))}
      <p className="text-[0.8125rem] text-on-surface-variant text-center">{t.versionLine(APP_VERSION, APP_BUILD)}</p>
    </nav>
  );
}
