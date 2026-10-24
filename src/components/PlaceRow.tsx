import { openStatus, type Resource } from "../../shared/resources";
import { useApp } from "../lib/app";
import { CATEGORY_STYLE, FIcon } from "./figma";
import { statusLine } from "./ui";

/** A place row: category symbol, name, kind · distance · status. */
export default function PlaceRow({ r, miles, n, onClick, highlighted, detail }: { r: Resource; miles: number | null; n?: number; onClick: () => void; highlighted?: boolean; detail?: string }) {
  const { t } = useApp();
  const style = CATEGORY_STYLE[r.category];
  const status = statusLine(openStatus(r), t);
  const numbered = n != null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2.5 ${
        numbered ? `bg-surface rounded-[10px] px-2 py-2 min-h-[3.25rem] ${highlighted ? "border-[1.5px]" : "border border-surface-variant"}` : "min-h-[2.75rem] py-1.5 border-b border-surface-variant"
      }`}
      style={numbered && highlighted ? { borderColor: style.pin } : undefined}
    >
      {numbered ? (
        <span aria-hidden="true" className="cat-solid shrink-0 w-[1.625rem] h-[1.625rem] rounded-full text-white text-[0.75rem] font-bold flex items-center justify-center" style={{ background: style.pin }}>
          {n}
        </span>
      ) : (
        <span aria-hidden="true" className="cat-tint shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: style.tint, color: style.text }}>
          <FIcon name={style.icon} size={18} />
        </span>
      )}
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[0.8125rem] leading-4 font-semibold text-on-surface">{r.name}</span>
        <span className="text-[0.6875rem] leading-[0.8125rem] text-on-surface-variant">
          {t.categoryNames[r.category] ?? r.category}
          {miles !== null && ` · ${miles < 10 ? miles.toFixed(1) : miles.toFixed(0)} mi`}
          {status && ` · ${status}`}
          {r.status === "unknown" && ` · ${t.hoursUnknown}`}
        </span>
        {detail && <span className="text-[0.6875rem] leading-[0.8125rem] text-on-surface-variant">{detail}</span>}
      </span>
      <FIcon name="chevron-right" size={numbered ? 14 : 16} className="text-on-surface" />
    </button>
  );
}

