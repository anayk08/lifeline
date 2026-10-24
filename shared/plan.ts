// The "Your plan" view: vetted safety steps for the hazard, the top places for the
// situation, and (online) Leslie's one-paragraph summary. Steps come only from
// safety-guidance.json; Bedrock may choose and order them, never write new ones.
import guidance from "./safety-guidance.json";
import type { AlertType, LiveHazard } from "./hazards";
import { situationHazard } from "./hazards";
import { RESOURCES, openStatus, rankForSituation, type Category, type Lang, type SituationRanked } from "./resources";

export interface GuidanceItem {
  id: string;
  text: Record<Lang, string>;
  source: string;
  url: string;
  kind?: "bring" | "call";
}

interface HazardGuidance {
  rightNow: GuidanceItem[];
  then: GuidanceItem[];
}

const ALWAYS = guidance.always as GuidanceItem[];
const COMMON_THEN = guidance.then as GuidanceItem[];
const BY_HAZARD = guidance.hazards as Record<AlertType, HazardGuidance>;

export function guidanceFor(type: AlertType): HazardGuidance {
  return BY_HAZARD[type] ?? BY_HAZARD.other;
}

/** Every item Leslie may pick for this hazard, keyed by id. */
export function allowedItems(type: AlertType) {
  const g = guidanceFor(type);
  return {
    rightNow: new Map(g.rightNow.map((i) => [i.id, i])),
    then: new Map([...g.then, ...COMMON_THEN].map((i) => [i.id, i])),
  };
}

export interface PlanSteps {
  rightNow: GuidanceItem[];
  then: GuidanceItem[];
}

const DEFAULT_THEN = ["bring-medicine", "bring-phone", "bring-water-food", "call-211", "call-family-text"];

/**
 * The steps to show. "Call 911 if hurt or trapped" always comes first. With Leslie's picks,
 * uses them (unknown ids are dropped); otherwise the vetted default order.
 */
export function planSteps(type: AlertType, picks?: { rightNow?: string[]; then?: string[] } | null): PlanSteps {
  const allowed = allowedItems(type);
  const g = guidanceFor(type);
  const pick = (ids: string[] | undefined, from: Map<string, GuidanceItem>) =>
    [...new Set(ids ?? [])].map((id) => from.get(id)).filter((i): i is GuidanceItem => !!i);

  let rightNow = pick(picks?.rightNow, allowed.rightNow).slice(0, 5);
  if (rightNow.length < 3) rightNow = g.rightNow.slice(0, 4);
  let then = pick(picks?.then, allowed.then).slice(0, 6);
  if (then.length < 2) then = [...g.then, ...pick(DEFAULT_THEN, allowed.then)].slice(0, 6);
  return { rightNow: [...ALWAYS, ...rightNow], then };
}

// ---- Where to go -------------------------------------------------------------

/** Kinds of places that help in each emergency. Car chargers never do. */
const HELPFUL: Record<AlertType, Category[]> = {
  earthquake: ["shelter", "health", "water", "food", "charging", "pharmacy"],
  extreme_heat: ["cooling", "water", "health", "shelter"],
  wildfire_smoke: ["cooling", "shelter", "health", "pharmacy"],
  wildfire_risk: ["shelter", "charging", "water", "health"],
  wildfire: ["shelter", "health", "water", "cooling"],
  flood: ["shelter", "health", "food", "water"],
  power_outage: ["charging", "health", "cooling", "pharmacy", "shelter"],
  other: ["shelter", "health", "water", "food", "charging", "cooling", "pharmacy"],
};

/** The top places for this alert from where the person is, ranked the same way Leslie ranks them. */
export function planPlaces(hazard: LiveHazard, from: [number, number] | null, count = 3, date = new Date()): SituationRanked[] {
  const kinds = new Set<Category>(HELPFUL[hazard.type] ?? HELPFUL.other);
  return rankForSituation(
    RESOURCES.filter((r) => kinds.has(r.category) && r.status !== "closed"),
    from,
    { hazardType: situationHazard(hazard.type), hazardPoint: hazard.center, hazardRadiusMiles: hazard.radiusMiles },
    date,
  )
    .filter((x) => openStatus(x.resource, date).state !== "closed")
    .slice(0, count);
}
