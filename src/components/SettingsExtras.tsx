// Settings rows for trust and data rights: legal links, version, download or delete this
// device's data, and turning the AI and map services back off.
import { useState } from "react";
import { APP_BUILD, APP_VERSION } from "../config/business";
import { useApp } from "../lib/app";
import { Icon } from "./ui";

const PREFIX = "lifeline.";

/** Every value Lifeline saved in this browser, for "Download my data". */
function collectData(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(key);
      try {
        out[key] = raw ? JSON.parse(raw) : raw;
      } catch {
        out[key] = raw;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

function download() {
  const data = { exportedAt: new Date().toISOString(), app: `Lifeline ${APP_VERSION} (${APP_BUILD})`, browserStorage: collectData() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `lifeline-my-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Removes saved data, offline copies and the service worker, then restarts the app. */
async function deleteAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
  try {
    if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* nothing cached */
  }
  window.location.replace(`${window.location.pathname}#/`);
  window.location.reload();
}

const linkRow =
  "flex items-center justify-between gap-2 min-h-[3rem] px-4 rounded-2xl border border-surface-variant bg-surface-container-lowest text-[0.9375rem]";

export default function SettingsExtras() {
  const { t, settings, update } = useApp();
  const [confirming, setConfirming] = useState(false);

  const legal: [string, string][] = [
    ["help", t.helpFaq],
    ["about", t.aboutApp],
    ["legal/privacy", t.privacyPolicy],
    ["legal/terms", t.termsOfUse],
    ["legal/disclaimer", t.disclaimer],
    ["legal/cookies", t.cookiesStorage],
    ["legal/accessibility", t.accessibilityStatement],
    ["legal/licenses", t.licenses],
  ];

  return (
    <>
      <section aria-labelledby="your-data" className="flex flex-col gap-2">
        <h2 id="your-data" className="text-label-lg text-primary flex items-center gap-1">
          <Icon name="shield" /> {t.yourData}
        </h2>
        <p className="text-body-md text-on-surface-variant">{t.yourDataHelp}</p>
        {settings.dataNotice && (
          <button type="button" onClick={() => update({ dataNotice: false })} className={`${linkRow} text-left`}>
            <span className="flex flex-col">
              <span className="font-semibold">{t.dataNoticeReset}</span>
              <span className="text-[0.8125rem] text-on-surface-variant">{t.dataNoticeResetHelp}</span>
            </span>
          </button>
        )}
        <button type="button" onClick={download} className={linkRow}>
          {t.downloadData} <Icon name="arrow_forward" />
        </button>
        {confirming ? (
          <div role="alertdialog" aria-labelledby="delete-q" className="flex flex-col gap-2 rounded-2xl border-2 border-error bg-error-container p-3">
            <p id="delete-q" className="text-[0.9375rem] text-on-error-container">
              {t.deleteConfirm}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={deleteAll} className="flex-1 min-h-[2.75rem] rounded-xl bg-error text-white font-semibold">
                {t.deleteYes}
              </button>
              <button type="button" autoFocus onClick={() => setConfirming(false)} className="flex-1 min-h-[2.75rem] rounded-xl bg-surface-container-lowest font-semibold">
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={`${linkRow} text-error`}>
            {t.deleteData} <Icon name="close" />
          </button>
        )}
        <a href="#/legal/data-deletion" className={linkRow}>
          {t.deleteRequest} <Icon name="chevron_right" />
        </a>
      </section>

      <nav aria-labelledby="about-legal" className="flex flex-col gap-2">
        <h2 id="about-legal" className="text-label-lg text-primary flex items-center gap-1">
          <Icon name="info" /> {t.aboutLegal}
        </h2>
        {legal.map(([to, label]) => (
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
    </>
  );
}
