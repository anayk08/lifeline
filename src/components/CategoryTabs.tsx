import { useApp } from "../lib/app";
import { FIcon, TABS } from "./figma";

/** The Figma filter tabs under the map: All, Medicine, Food, Shelter, Cool, Charging, Water. */
export default function CategoryTabs({ tab, onChange }: { tab: string; onChange: (key: string) => void }) {
  const { t } = useApp();
  return (
    <div role="group" aria-label={t.filterByType} className="flex gap-0.5 pt-1.5">
      {TABS.map(({ key, style }) => {
        const on = tab === key;
        const all = key === "all";
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on && !all ? "all" : key)}
            className={`relative flex-1 min-w-0 min-h-[3.25rem] rounded-[10px] flex flex-col items-center justify-center gap-[3px] text-[0.5625rem] leading-none ${
              on ? "cat-solid font-bold" : "cat-tint font-semibold"
            } ${on && !all ? "border-2 border-on-surface" : ""}`}
            style={on ? { background: all ? "var(--primary)" : style.pin, color: all ? "var(--on-primary)" : key === "charging" ? style.text : "#fff" } : { background: all ? "transparent" : style.tint, color: style.text }}
          >
            <FIcon name={style.icon} size={15} />
            <span className="truncate max-w-full px-0.5">{t.tabNames[key]}</span>
            {on && !all && (
              <span aria-hidden="true" className="absolute top-px right-px w-[11px] h-[11px] rounded-full bg-on-surface text-white flex items-center justify-center">
                <FIcon name="check" size={7} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

