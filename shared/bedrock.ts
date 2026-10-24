// Bedrock calls for Leslie. Used by the Amplify Lambda handler and by the local
// laptop server (server/index.ts), so both behave the same.
// Never import this from the web app: it runs only where AWS credentials live.
import { ConverseCommand, type BedrockRuntimeClient, type Message } from "@aws-sdk/client-bedrock-runtime";
import type { GeoPlacesClient } from "@aws-sdk/client-geo-places";
import {
  BY_ID,
  HAZARD_RADIUS_MILES,
  RESOURCES,
  daysSinceVerified,
  formatTime,
  rankForSituation,
  zipCenter,
  type Hazard,
  type SituationRanked,
} from "./resources";
import { extractSituation, findPlace, type ExtractedSituation, type SituationResult } from "./situation";

export const LESLIE_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish", vi: "Vietnamese" };
const HAZARD_NAMES: Record<Hazard, string> = {
  earthquake: "Earthquake",
  wildfire_smoke: "Wildfire smoke",
  extreme_heat: "Extreme heat",
  power_outage: "Power outage",
};

const sanJoseNow = () =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" }).format(
    new Date(),
  );

function describe({ resource: r, miles, status, nearHazard, reasons }: SituationRanked, hazard: Hazard | null): string {
  const open =
    status.state === "unknown"
      ? "hours unknown, call ahead"
      : status.state === "open"
        ? status.is24h
          ? "OPEN NOW, 24 hours"
          : `OPEN NOW until ${formatTime(status.closesAt!)}`
        : `CLOSED now${status.opensAt ? `, opens ${status.opensDay ?? "today"} ${formatTime(status.opensAt)}` : ""}`;
  const risk = hazard ? r.hazardRisk?.[hazard] : null;
  return [
    `[${r.id}] ${r.name} (${r.category}${r.tags.length ? `; ${r.tags.join(", ")}` : ""})`,
    `  ${open}${miles !== null ? ` | ${miles.toFixed(1)} mi away` : ""}`,
    nearHazard ? `  MAY BE AFFECTED: within ${HAZARD_RADIUS_MILES} mi of the hazard, tell them to call first` : "",
    hazard ? `  ${HAZARD_NAMES[hazard]} risk: ${risk ?? "not rated"}` : "",
    reasons.length ? `  Why it may suit this situation: ${reasons.join(", ")}` : "",
    r.status !== "open" ? `  Operating status: ${r.status === "closed" ? "NOT OPEN TO THE PUBLIC" : "not confirmed, call first"}` : "",
    `  ${r.address}${r.phone ? ` | ${r.phone}` : " | no phone listed"}`,
    r.hoursNote ? `  Hours as listed: ${r.hoursNote}` : "",
    r.notes ? `  Notes: ${r.notes}` : "",
    r.services.length ? `  Services: ${r.services.join("; ")}` : "",
    r.languages.length ? `  Languages: ${r.languages.join(", ")}` : "  Languages: not listed",
    r.eligibility ? `  Eligibility: ${r.eligibility}` : "",
    r.transit ? `  Transit: ${r.transit}` : "",
    `  Verified ${daysSinceVerified(r)} days ago`,
  ]
    .filter(Boolean)
    .join("\n");
}

const RESPOND_TOOL = {
  toolSpec: {
    name: "respond",
    description: "Send the final answer to the resident.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          answer: {
            type: "string",
            description: "Short, plain-language answer (under 90 words). No markdown headings.",
          },
          resourceIds: {
            type: "array",
            items: { type: "string" },
            description: "IDs of the listings the answer relies on, most relevant first. Empty if none.",
          },
          verified: {
            type: "boolean",
            description: "true only if the answer is fully supported by the verified listings.",
          },
          language: { type: "string", enum: ["en", "es", "vi"] },
        },
        required: ["answer", "resourceIds", "verified", "language"],
      },
    },
  },
};

export interface LeslieClients {
  bedrock: BedrockRuntimeClient;
  geo: GeoPlacesClient;
}

export interface LeslieArgs {
  question: string;
  language?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  history?: unknown;
}

export interface LeslieAnswer {
  answer: string;
  resourceIds: string[];
  verified: boolean;
  language: string;
  situation: SituationResult;
}

/** Step 1: what is happening and where. Failures fall back to "no hazard, no stated place". */
async function workOutSituation(
  { bedrock, geo }: LeslieClients,
  args: LeslieArgs,
): Promise<{ extracted: ExtractedSituation; situation: SituationResult }> {
  let extracted: ExtractedSituation = { hazardType: "none", hazardPlace: null, userPlace: null, needs: [] };
  try {
    extracted = await extractSituation(bedrock, args.question);
  } catch (err) {
    console.warn("situation extraction failed:", (err as Error).message);
  }
  const find = (text: string | null) =>
    text
      ? findPlace(geo, text).catch((err) => {
          console.warn(`place search failed for "${text}":`, (err as Error).message);
          return null;
        })
      : Promise.resolve(null);
  const [hazardPoint, userPoint] = await Promise.all([find(extracted.hazardPlace), find(extracted.userPlace)]);

  // Where distances start: a place they told us, then GPS, then their saved ZIP.
  let origin: SituationResult["origin"] = null;
  if (userPoint) origin = { ...userPoint, source: "stated" };
  else if (args.lat != null && args.lng != null) origin = { label: "your location", lat: args.lat, lng: args.lng, source: "gps" };
  else if (args.zip && zipCenter(args.zip)) {
    const [lat, lng] = zipCenter(args.zip)!;
    origin = { label: `ZIP ${args.zip}`, lat, lng, source: "zip" };
  }

  const notFound = [
    ...new Set(
      [
        extracted.hazardPlace && !hazardPoint ? extracted.hazardPlace : null,
        extracted.userPlace && !userPoint ? extracted.userPlace : null,
      ].filter((x): x is string => !!x),
    ),
  ];

  return {
    extracted,
    situation: { hazardType: extracted.hazardType, hazardPoint, needs: extracted.needs, origin, notFound, flaggedIds: [] },
  };
}

export async function askLeslie(clients: LeslieClients, args: LeslieArgs, modelId = LESLIE_MODEL): Promise<LeslieAnswer> {
  const { question, language } = args;
  const preferred = language && LANGUAGE_NAMES[language] ? language : "en";

  const { extracted, situation } = await workOutSituation(clients, args);
  const hazard = (["earthquake", "wildfire_smoke", "extreme_heat", "power_outage"] as const).find((h) => h === situation.hazardType) ?? null;
  const from: [number, number] | null = situation.origin ? [situation.origin.lat, situation.origin.lng] : null;
  const ranked = rankForSituation(RESOURCES, from, {
    hazardType: situation.hazardType,
    hazardPoint: situation.hazardPoint ? [situation.hazardPoint.lat, situation.hazardPoint.lng] : null,
    needs: situation.needs,
  });
  situation.flaggedIds = ranked.filter((x) => x.nearHazard).map((x) => x.resource.id);

  const whereFrom = situation.origin
    ? situation.origin.source === "stated"
      ? `The resident says they are at ${situation.origin.label}; distances are from there.`
      : situation.origin.source === "gps"
        ? "Distances are from the resident's current GPS location."
        : `Distances are from the center of ZIP ${args.zip}.`
    : "The resident's location is unknown, so don't claim distances.";

  const situationText =
    situation.hazardType === "none"
      ? "No emergency was mentioned."
      : [
          `Emergency: ${hazard ? HAZARD_NAMES[hazard] : "an emergency (" + (extracted.hazardPlace ?? "unspecified") + ")"}${
            situation.hazardPoint ? `, centered on ${situation.hazardPoint.label}` : extracted.hazardPlace ? ` near ${extracted.hazardPlace}` : ""
          }.`,
          situation.needs.length ? `Needs mentioned: ${situation.needs.join(", ")}.` : "",
          situation.notFound.length ? `Couldn't find these places on the map: ${situation.notFound.join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join(" ");

  const system = `You are Leslie, the assistant inside Lifeline, a verified resource finder for San José, California, used during disasters and emergencies such as earthquakes, wildfire smoke, heat waves and power outages. People may be scared, hurt, on a low battery, or reading in a second language.

Rules you must follow:
1. Answer ONLY from the VERIFIED LISTINGS below. Never use outside knowledge about places, hours, phone numbers or services.
2. If the listings do not answer the question, say plainly that you don't have verified info for that (in the reply language), set verified=false, and suggest calling 211 (or 911 for an emergency).
3. Never give medical advice (dosing, diagnosis, whether to take or stop a medicine, how to treat symptoms). Say you can't give medical advice, point them to a pharmacist or clinic from the listings, and to 911 if it's an emergency. Practical logistics, like which pharmacy is open, are fine.
4. Never send people to a place marked NOT OPEN TO THE PUBLIC. If a place's operating status is not confirmed, say so and tell them to call first. "ev_charging" places charge electric cars only, never phones or medical devices; "backup-power" means the place has its own generator.
   Everyday over-the-counter items (laxatives, pain relievers, bandages, cold medicine, diapers, electrolytes) are sold at pharmacies, so you may point to open pharmacies for them, but say you can't confirm what is in stock and suggest calling first.
5. The listings are already ranked for this situation: open places first, then safest and closest. Prefer the top of the list. Mention the place name, whether it's open and until when, the distance if known, and the address. Mention eligibility limits when they exist.
6. If there is an emergency, name it in your first sentence (for example "For the earthquake near SJSU, ..."), and for each place you recommend give a short reason it suits this situation, using only facts from its listing (for example "open 24 hours, has backup power, low earthquake risk, outside the affected area"). For any place marked MAY BE AFFECTED, tell them to call before going. If someone may be hurt or in danger, start with "If anyone is hurt or in danger, call 911."
7. Reply in ${LANGUAGE_NAMES[preferred]} unless the question is clearly written in English, Spanish or Vietnamese, in which case reply in that language. Set "language" to the code you replied in.
8. Be brief and calm: 2 to 4 short sentences, or a short list of up to 3 places. Plain text only.
9. Always answer by calling the respond tool. List every listing you mention in resourceIds.

Current time in San José: ${sanJoseNow()}.
Situation: ${situationText}
${whereFrom}

VERIFIED LISTINGS, ranked for this situation (${ranked.length}):
${ranked.map((x) => describe(x, hazard)).join("\n")}`;

  const history = typeof args.history === "string" ? safeJson(args.history) : args.history;
  const prior: Message[] = Array.isArray(history)
    ? (history as { role: string; text: string }[])
        .slice(-6)
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text)
        .map((m) => ({ role: m.role as "user" | "assistant", content: [{ text: m.text.slice(0, 1500) }] }))
    : [];
  // Converse needs the conversation to start with a user turn.
  while (prior.length && prior[0].role !== "user") prior.shift();

  const response = await clients.bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [...prior, { role: "user", content: [{ text: question.slice(0, 1000) }] }],
      toolConfig: { tools: [RESPOND_TOOL], toolChoice: { tool: { name: "respond" } } },
      inferenceConfig: { maxTokens: 700, temperature: 0.2 },
    }),
  );

  const input = (response.output?.message?.content?.find((c) => c.toolUse)?.toolUse?.input ?? {}) as {
    answer?: string;
    resourceIds?: string[];
    verified?: boolean;
    language?: string;
  };
  // Drop any ID the model made up, so every citation in the app points at a real listing.
  const resourceIds = (input.resourceIds ?? []).filter((id) => BY_ID.has(id));
  return {
    answer: input.answer?.trim() || "Sorry, I couldn't answer that right now. Please call 211 for help.",
    resourceIds,
    verified: Boolean(input.verified) && resourceIds.length > 0,
    language: input.language && LANGUAGE_NAMES[input.language] ? input.language : preferred,
    situation,
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
