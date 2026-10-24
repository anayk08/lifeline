import { useEffect, useRef } from "react";
import { useApp } from "../lib/app";
import { FIcon } from "./figma";

/** The data notice itself: what is sent where, with Continue and Not now. */
export default function DataNoticeDialog({ onContinue, onNotNow }: { onContinue: () => void; onNotNow: () => void }) {
  const { t } = useApp();
  const first = useRef<HTMLButtonElement>(null);

  // Focus the first choice, and let Escape mean "Not now".
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onNotNow();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNotNow]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-title"
        aria-describedby="notice-body"
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-surface-container-lowest rounded-2xl p-4 flex flex-col gap-3 shadow-xl"
      >
        <h2 id="notice-title" className="flex items-center gap-2 text-[1.125rem] font-semibold text-on-surface">
          <FIcon name="sparkles" size={18} className="text-primary" /> {t.noticeTitle}
        </h2>
        <div id="notice-body" className="flex flex-col gap-2 text-[0.875rem] leading-5 text-on-surface">
          <p>{t.noticeIntro}</p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>{t.noticeAI}</li>
            <li>{t.noticePlaces}</li>
            <li>{t.noticeVoice}</li>
            <li>{t.noticeTiles}</li>
          </ul>
          <p className="text-on-surface-variant">{t.noticeLocal}</p>
          <a href="#/legal/privacy" onClick={onNotNow} className="self-start text-primary underline underline-offset-2 min-h-[2.75rem] inline-flex items-center">
            {t.privacyPolicy}
          </a>
        </div>
        <div className="flex gap-2">
          <button ref={first} type="button" onClick={onContinue} className="flex-1 min-h-[3rem] rounded-xl bg-primary text-white text-[0.9375rem] font-semibold">
            {t.noticeContinue}
          </button>
          <button type="button" onClick={onNotNow} className="flex-1 min-h-[3rem] rounded-xl bg-surface-container-low text-primary text-[0.9375rem] font-semibold">
            {t.noticeNotNow}
          </button>
        </div>
      </div>
    </div>
  );
}
