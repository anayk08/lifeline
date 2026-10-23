// Walking and driving routes from Amazon Location Service, summarized into the
// options residents pick from. Runs only where AWS credentials live (laptop server
// or Lambda), never in the browser.
import { CalculateRoutesCommand, type GeoRoutesClient } from "@aws-sdk/client-geo-routes";

export type RouteKind = "fastest_walk" | "easiest_walk" | "fastest_drive";

export interface RouteStep {
  text: string;
  meters: number;
}

export interface RouteOption {
  kinds: RouteKind[]; // one route can be both the fastest and the easiest walk
  mode: "walk" | "drive";
  meters: number;
  seconds: number;
  turns: number;
  climbMeters: number; // total uphill, walking only
  steps: RouteStep[];
  line: [number, number][]; // [lat, lng]
}

export interface RouteResult {
  options: RouteOption[];
  source: "amazon-location";
}

const LANGS: Record<string, string> = { en: "en", es: "es", vi: "vi" };

interface Leg {
  Geometry?: { LineString?: number[][] };
  PedestrianLegDetails?: LegDetails;
  VehicleLegDetails?: LegDetails;
}
interface LegDetails {
  Summary?: { Overview?: { Distance?: number; Duration?: number } };
  TravelSteps?: { Type?: string; Distance?: number; Instruction?: string }[];
}

function summarize(legs: Leg[], mode: "walk" | "drive"): Omit<RouteOption, "kinds"> {
  let meters = 0;
  let seconds = 0;
  let climb = 0;
  const steps: RouteStep[] = [];
  const line: [number, number][] = [];
  for (const leg of legs) {
    const d = (mode === "walk" ? leg.PedestrianLegDetails : leg.VehicleLegDetails) ?? {};
    meters += d.Summary?.Overview?.Distance ?? 0;
    seconds += d.Summary?.Overview?.Duration ?? 0;
    for (const s of d.TravelSteps ?? []) {
      if (s.Instruction) steps.push({ text: s.Instruction, meters: s.Distance ?? 0 });
    }
    const pts = leg.Geometry?.LineString ?? [];
    pts.forEach((p, i) => {
      line.push([p[1], p[0]]);
      // LineString points are [lng, lat, elevation] when Elevation is requested.
      if (i > 0 && p.length > 2 && pts[i - 1].length > 2) climb += Math.max(0, p[2] - pts[i - 1][2]);
    });
  }
  // "Depart" and "Arrive" aren't decisions the walker has to make.
  const turns = Math.max(0, steps.length - 2);
  return { mode, meters, seconds, turns, climbMeters: Math.round(climb), steps, line };
}

export async function planRoutes(
  geo: GeoRoutesClient,
  from: [number, number],
  to: [number, number],
  lang = "en",
): Promise<RouteResult> {
  const base = {
    Origin: [from[1], from[0]],
    Destination: [to[1], to[0]],
    DepartNow: true,
    LegGeometryFormat: "Simple" as const,
    InstructionsMeasurementSystem: "Imperial" as const,
    Languages: [LANGS[lang] ?? "en"],
  };
  const [walk, drive] = await Promise.all([
    geo.send(
      new CalculateRoutesCommand({
        ...base,
        TravelMode: "Pedestrian",
        MaxAlternatives: 2,
        LegAdditionalFeatures: ["Summary", "TravelStepInstructions", "Elevation"],
      }),
    ),
    geo.send(
      new CalculateRoutesCommand({
        ...base,
        TravelMode: "Car",
        LegAdditionalFeatures: ["Summary", "TravelStepInstructions"],
      }),
    ),
  ]);

  const walks = (walk.Routes ?? []).map((r) => summarize((r.Legs ?? []) as Leg[], "walk")).filter((r) => r.meters > 0);
  const drives = (drive.Routes ?? []).map((r) => summarize((r.Legs ?? []) as Leg[], "drive")).filter((r) => r.meters > 0);

  const options: RouteOption[] = [];
  if (walks.length) {
    const fastest = walks.reduce((a, b) => (b.seconds < a.seconds ? b : a));
    // Easiest = least uphill, then fewest turns, so it's gentle and simple to follow.
    const easiest = walks.reduce((a, b) =>
      b.climbMeters < a.climbMeters || (b.climbMeters === a.climbMeters && b.turns < a.turns) ? b : a,
    );
    if (fastest === easiest) options.push({ ...fastest, kinds: ["fastest_walk", "easiest_walk"] });
    else options.push({ ...fastest, kinds: ["fastest_walk"] }, { ...easiest, kinds: ["easiest_walk"] });
  }
  if (drives.length) {
    const fastest = drives.reduce((a, b) => (b.seconds < a.seconds ? b : a));
    options.push({ ...fastest, kinds: ["fastest_drive"] });
  }
  return { options, source: "amazon-location" };
}
