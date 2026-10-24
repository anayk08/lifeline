// Works out the emergency a resident is describing ("earthquake around SJSU, I'm at
// Spartan Village") and turns the places they name into coordinates. Runs only where
// AWS credentials live (laptop server or Lambda), never in the browser.
import { ConverseCommand, type BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { SearchTextCommand, type GeoPlacesClient } from "@aws-sdk/client-geo-places";
import { closeEnough } from "./fuzzy";
import type { SituationHazard } from "./resources";

// Haiku 4.5 accepts a forced tool call and a temperature, so the result is always structured.
export const SITUATION_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";

export interface ExtractedSituation {
  hazardType: SituationHazard;
  hazardPlace: string | null;
  userPlace: string | null;
  needs: string[];
}

export interface LabeledPoint {
  label: string;
  lat: number;
  lng: number;
}

export interface SituationResult {
  hazardType: SituationHazard;
  hazardPoint: LabeledPoint | null;
  needs: string[];
  /** Where distances and routes start, and why. */
  origin: (LabeledPoint & { source: "stated" | "gps" | "zip" }) | null;
  /** Place names the resident gave that we couldn't find. */
  notFound: string[];
  flaggedIds: string[];
  /** How far the hazard reaches (a live alert's radius); 1 mile for a place the resident named. */
  hazardRadiusMiles?: number;
  /** The live alert the situation came from, so the app can show its source. */
  alert?: { id: string; title: string; source: string; sourceUrl: string; place?: string } | null;
}

const NONE: ExtractedSituation = { hazardType: "none", hazardPlace: null, userPlace: null, needs: [] };
const HAZARDS: SituationHazard[] = ["earthquake", "wildfire_smoke", "extreme_heat", "power_outage", "other", "none"];

const SITUATION_TOOL = {
  toolSpec: {
    name: "report_situation",
    description: "Report the emergency described in the resident's message.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          hazardType: {
            type: "string",
            enum: HAZARDS,
            description:
              "The emergency the resident is in: earthquake, wildfire_smoke (smoke or bad air), extreme_heat (heat wave), power_outage (power or electricity out), other (another emergency such as flood or fire), or none (no emergency mentioned).",
          },
          hazardPlace: {
            type: ["string", "null"],
            description: "The place the hazard is centered on, in the resident's words (e.g. \"SJSU\"), or null.",
          },
          userPlace: {
            type: ["string", "null"],
            description: "Where the resident says they are right now, in their words, or null. Not their destination.",
          },
          needs: {
            type: "array",
            items: { type: "string", enum: ["medical", "shelter", "water", "charging", "food", "cooling", "medicine", "other"] },
          },
        },
        required: ["hazardType", "hazardPlace", "userPlace", "needs"],
      },
    },
  },
};

export async function extractSituation(bedrock: BedrockRuntimeClient, question: string): Promise<ExtractedSituation> {
  const response = await bedrock.send(
    new ConverseCommand({
      modelId: SITUATION_MODEL,
      system: [
        {
          text: "Extract the emergency situation from a resident's message to a San José help app. The message may be in English, Spanish or Vietnamese, and people in an emergency often type fast: read misspellings generously (\"erthquake\" is an earthquake, \"no powr\" is a power outage). Copy place names as written, fixing only obvious spelling mistakes (\"Spartn Vilage\" -> \"Spartan Village\"); never add or guess a place that isn't in the message.",
        },
      ],
      messages: [{ role: "user", content: [{ text: question.slice(0, 1000) }] }],
      toolConfig: { tools: [SITUATION_TOOL], toolChoice: { tool: { name: "report_situation" } } },
      inferenceConfig: { maxTokens: 300, temperature: 0 },
    }),
  );
  const input = response.output?.message?.content?.find((c) => c.toolUse)?.toolUse?.input as
    | Partial<ExtractedSituation>
    | undefined;
  if (!input) return NONE;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
  return {
    hazardType: HAZARDS.includes(input.hazardType as SituationHazard) ? (input.hazardType as SituationHazard) : "none",
    hazardPlace: text(input.hazardPlace),
    userPlace: text(input.userPlace),
    needs: Array.isArray(input.needs) ? input.needs.filter((n) => typeof n === "string").slice(0, 6) : [],
  };
}

const SAN_JOSE_CENTER: [number, number] = [37.3382, -121.8863]; // [lat, lng]
const inSanJoseArea = (lat: number, lng: number) => lat > 37.12 && lat < 37.47 && lng > -122.05 && lng < -121.58;

// Words that appear in lots of place names, so sharing one proves nothing.
const GENERIC = new Set(
  "the and near around at on in of by san jose ca california street st avenue ave road rd drive dr blvd boulevard way lane park plaza center centre centro square building village north south east west downtown area calle".split(
    " ",
  ),
);
const distinctive = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !GENERIC.has(w)),
  );

/**
 * Finds a place the resident named, using Amazon Location place search biased to
 * San José. Only accepts a result inside the San José area that shares a distinctive
 * word with what they typed (typos allowed), so a made-up name never turns into a real location.
 */
export async function findPlace(geo: GeoPlacesClient, text: string): Promise<LabeledPoint | null> {
  const asked = distinctive(text);
  if (asked.size === 0) return null;
  const res = await geo.send(
    new SearchTextCommand({
      QueryText: text,
      BiasPosition: [SAN_JOSE_CENTER[1], SAN_JOSE_CENTER[0]],
      Filter: { IncludeCountries: ["USA"] },
      MaxResults: 5,
    }),
  );
  for (const item of res.ResultItems ?? []) {
    const [lng, lat] = item.Position ?? [];
    if (lat == null || lng == null || !inSanJoseArea(lat, lng)) continue;
    const words = [...distinctive(`${item.Title ?? ""} ${item.Address?.Label ?? ""}`)];
    // A shared word, allowing a few typos ("Spartn" still matches "Spartan").
    if ([...asked].some((w) => words.some((x) => closeEnough(w, x)))) return { label: text, lat, lng };
  }
  return null;
}
