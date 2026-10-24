// Pieces shared by both maps (the Map tab and the map under Leslie's answers).
import L from "leaflet";
import { Circle, Marker, Tooltip } from "react-leaflet";
import type { Category } from "../../shared/resources";
import { useApp } from "../lib/app";
import { CATEGORY_EMOJI } from "./ui";

// One color per kind of help, used for pins, filter chips and the key.
export const CATEGORY_COLOR: Record<Category, string> = {
  pharmacy: "#d6336c",
  health: "#c92a2a",
  food: "#e8590c",
  cooling: "#1c7ed6",
  charging: "#7048e8",
  shelter: "#2b8a3e",
  water: "#0c8599",
  ev_charging: "#495057",
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_COLOR) as Category[];

const YOU_BLUE = "#1971c2";

/** A map pin ("you are here") with a shaded ring showing how precise the fix is. */
export function LocationPointer({
  at,
  label,
  accuracyMeters,
  contrast,
}: {
  at: [number, number];
  label: string;
  accuracyMeters?: number | null;
  contrast: boolean;
}) {
  const color = contrast ? "#000" : YOU_BLUE;
  const icon = L.divIcon({
    className: "pin",
    iconSize: [34, 46],
    // The tip of the pin sits exactly on the location.
    iconAnchor: [17, 44],
    html: `<svg width="34" height="46" viewBox="0 0 34 46" aria-hidden="true"><path d="M17 1C8.2 1 1 8 1 16.7 1 28.5 17 45 17 45s16-16.5 16-28.3C33 8 25.8 1 17 1z" fill="${color}" stroke="#fff" stroke-width="3"/><circle cx="17" cy="16.5" r="6.5" fill="#fff"/></svg>`,
  });
  return (
    <>
      {accuracyMeters != null && accuracyMeters > 0 && accuracyMeters < 2000 && (
        <Circle
          center={at}
          radius={accuracyMeters}
          pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.12 }}
          interactive={false}
        />
      )}
      <Marker position={at} icon={icon} zIndexOffset={2000} keyboard={false} interactive={false}>
        <Tooltip permanent direction="top" offset={[0, -44]} className="you-label">
          {label}
        </Tooltip>
      </Marker>
    </>
  );
}

/**
 * One toggle chip per kind of place (emblem + name + color). Tapping a chip shows or
 * hides that kind; "All" shows everything again.
 */
export function CategoryFilter({
  categories,
  hidden,
  onChange,
  counts,
}: {
  categories: Category[];
  hidden: Set<Category>;
  onChange: (next: Set<Category>) => void;
  counts?: Partial<Record<Category, number>>;
}) {
  const { t, settings } = useApp();
  const contrast = settings.highContrast;
  const toggle = (c: Category) => {
    const next = new Set(hidden);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange(next);
  };
  return (
    <div role="group" aria-label={t.filterByType} className="flex gap-1.5 overflow-x-auto -mx-gutter px-gutter pb-1">
      <button
        type="button"
        aria-pressed={hidden.size === 0}
        onClick={() => onChange(new Set())}
        className={`shrink-0 px-3 min-h-[44px] rounded-full border-2 text-label-sm ${
          hidden.size === 0 ? "bg-primary-container text-white border-primary-container" : "bg-surface-container-lowest border-surface-variant"
        }`}
      >
        {t.filterAll}
      </button>
      {categories.map((c) => {
        const on = !hidden.has(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(c)}
            className={`shrink-0 pl-1.5 pr-3 min-h-[44px] rounded-full border-2 text-label-sm flex items-center gap-1.5 ${
              on ? "bg-surface-container-lowest" : "bg-surface-container opacity-60 line-through"
            }`}
            style={{ borderColor: on ? (contrast ? "var(--on-surface)" : CATEGORY_COLOR[c]) : "var(--surface-variant)" }}
          >
            <span
              aria-hidden="true"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[15px]"
              style={{ background: contrast ? "#fff" : CATEGORY_COLOR[c], border: contrast ? "2px solid #000" : undefined }}
            >
              {CATEGORY_EMOJI[c]}
            </span>
            {t.categoryNames[c] ?? c}
            {counts?.[c] != null && <span className="text-on-surface-variant">{counts[c]}</span>}
          </button>
        );
      })}
    </div>
  );
}
