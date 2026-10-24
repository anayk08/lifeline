import { Page } from "../components/Shell";
import { useApp } from "../lib/app";

/** Shown for an address the app doesn't know (an old or mistyped link). */
export default function NotFound() {
  const { t } = useApp();
  return (
    <Page back="#/">
      <div className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col gap-3">
        <h1 className="text-[1.375rem] leading-7 font-semibold text-on-surface">{t.notFoundTitle}</h1>
        <p className="text-[0.9375rem] text-on-surface-variant">{t.notFoundBody}</p>
        <a href="#/" className="min-h-[2.75rem] rounded-xl bg-primary text-white text-[0.9375rem] font-semibold flex items-center justify-center">
          {t.goHome}
        </a>
      </div>
    </Page>
  );
}
