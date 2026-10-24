import { useMemo } from "react";
import { RESOURCES, distanceMiles, rankResources } from "../../shared/resources";
import { TABS } from "../components/figma";
import PlaceRow from "../components/PlaceRow";
import { Page } from "../components/Shell";
import { go, useApp } from "../lib/app";
import { inCategory } from "../lib/search";

/** Every verified place (or one tab's worth), as Figma resource rows. */
export default function ListPage({ category }: { category: string }) {
  const { t, origin } = useApp();
  const tab = TABS.find((x) => x.key === category);
  const ranked = useMemo(() => {
    const list =
      category === "all"
        ? RESOURCES
        : tab?.categories
          ? RESOURCES.filter((r) => tab.categories!.includes(r.category))
          : RESOURCES.filter((r) => inCategory(r, category) || (category === "pharmacy" && r.category === "health"));
    return rankResources(list, origin);
  }, [category, origin, tab]);

  return (
    <Page back="#/">
      <div className="flex items-center justify-between min-h-[1.75rem]">
        <h1 className="text-[1.375rem] text-on-surface">{tab && category !== "all" ? t.nearbyIn(t.tabNames[category]) : t.allPlaces}</h1>
        <span className="text-[0.75rem] text-on-surface-variant">{t.results(ranked.length)}</span>
      </div>
      <p className="text-[0.75rem] leading-[1.0625rem] text-on-surface-variant">{t.verifiedNote}</p>
      {ranked.length === 0 && <p className="text-[0.875rem]">{t.noResults}</p>}
      <div className="flex flex-col">
        {ranked.map(({ resource: r }) => (
          <PlaceRow key={r.id} r={r} miles={origin ? distanceMiles(origin[0], origin[1], r.lat, r.lng) : null} onClick={() => go(`/place/${encodeURIComponent(r.id)}`)} />
        ))}
      </div>
    </Page>
  );
}
