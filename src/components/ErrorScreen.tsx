import { useApp } from "../lib/app";
import { LifelineMark } from "./figma";

/** The crash screen (and the maintenance notice): what happened, what to do, and 911. */
export default function ErrorScreen({ maintenance }: { maintenance?: boolean }) {
  const { t } = useApp();
  return (
    <main className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-center gap-4 px-gutter bg-surface">
      <LifelineMark size={40} />
      <h1 className="text-[1.375rem] leading-7 font-semibold text-on-surface">{maintenance ? t.maintenanceTitle : t.errorTitle}</h1>
      <p className="text-[0.9375rem] text-on-surface-variant">{maintenance ? t.maintenanceBody : t.errorBody}</p>
      <p className="text-[0.9375rem] text-on-surface">
        {t.emergencyLine}{" "}
        <a href="tel:911" className="font-semibold text-error underline underline-offset-2">
          911
        </a>
        . {t.infoLine}{" "}
        <a href="tel:211" className="font-semibold text-primary underline underline-offset-2">
          211
        </a>
        .
      </p>
      {!maintenance && (
        <button
          type="button"
          onClick={() => {
            window.location.hash = "#/";
            window.location.reload();
          }}
          className="min-h-[3rem] rounded-xl bg-primary text-white text-[0.9375rem] font-semibold"
        >
          {t.reload}
        </button>
      )}
    </main>
  );
}
