import { useMemo } from "react";
import { RESOURCES, rankResources } from "../../shared/resources";
import { Page } from "../components/Shell";
import { ResourceCard, Section } from "../components/ui";
import { useApp } from "../lib/app";
import { inCategory } from "../lib/search";

export default function ListPage({ category }: { category: string }) {
  const { t, origin } = useApp();
  const titles: Record<string, string> = {
    pharmacy: t.medicine,
    food: t.food,
    cooling: t.stayCool,
    charging: t.charge,
    all: t.allPlaces,
  };
  const ranked = useMemo(() => {
    const list =
      category === "all"
        ? RESOURCES
        : RESOURCES.filter((r) => inCategory(r, category) || (category === "pharmacy" && r.category === "health"));
    return rankResources(list, origin);
  }, [category, origin]);

  return (
    <Page back="#/" tab="ask">
      <Section title={titles[category] ?? t.allPlaces} aside={<span className="text-label-sm text-on-surface-variant">{ranked.length}</span>}>
        {ranked.length === 0 && <p className="text-body-lg">{t.noResults}</p>}
        {ranked.map(({ resource, miles }) => (
          <ResourceCard key={resource.id} r={resource} miles={miles} />
        ))}
      </Section>
    </Page>
  );
}
