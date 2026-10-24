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
  distanceMiles,
  formatTime,
  rankForSituation,
  zipCenter,
  type Hazard,
  type SituationRanked,
} from "./resources";
import { extractSituation, findPlace, type ExtractedSituation, type SituationResult } from "./situation";
import { describeHazard, primaryHazard, sanitizeHazard, sanitizeHazards, situationHazard, type LiveHazard } from "./hazards";
import { allowedItems, planPlaces, planSteps } from "./plan";

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

function describe(
  { resource: r, miles, status, nearHazard, reasons }: SituationRanked,
  hazard: Hazard | null,
  hazardRadius = HAZARD_RADIUS_MILES,
): string {
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
    nearHazard ? `  MAY BE AFFECTED: within ${hazardRadius} mi of the hazard, tell them to call first` : "",
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
            description:
              "1 to 3 short plain-language sentences (under 60 words). No phone numbers, addresses or distances: the place cards show those. No markdown.",
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
  /** Active alerts the app knows about (live feeds or the demo), sent with every question. */
  hazards?: unknown;
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
          console.warn("place search failed:", (err as Error).message);
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

  const situation: SituationResult = {
    hazardType: extracted.hazardType,
    hazardPoint,
    needs: extracted.needs,
    origin,
    notFound,
    flaggedIds: [],
    hazardRadiusMiles: hazardPoint ? HAZARD_RADIUS_MILES : undefined,
    alert: null,
  };

  // A live alert sets the emergency and where it is, unless the resident clearly names a different one.
  const live = primaryHazard(sanitizeHazards(args.hazards), origin ? [origin.lat, origin.lng] : null);
  const liveType = live ? situationHazard(live.type) : null;
  if (live && (extracted.hazardType === "none" || extracted.hazardType === liveType)) {
    situation.hazardType = liveType!;
    situation.alert = { id: live.id, title: live.title, source: live.source, sourceUrl: live.sourceUrl, place: live.place };
    if (!hazardPoint && live.center) {
      situation.hazardPoint = { label: live.place ?? live.title, lat: live.center[0], lng: live.center[1] };
      situation.hazardRadiusMiles = live.radiusMiles;
    }
  }
  return { extracted, situation };
}

const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

function liveAlertText(alert: SituationResult["alert"], hazards: LiveHazard[]): string {
  const h = alert ? hazards.find((x) => x.id === alert.id) : null;
  if (!h) return "";
  const label = h.source === "Simulated" ? "SIMULATED DEMO alert (say it is a simulated demo)" : `Live alert from ${h.source}`;
  return `${label}: ${describeHazard(h)}, started about ${minutesAgo(h.startedAt)} minutes ago${
    h.center ? `, affecting about ${h.radiusMiles} miles around it` : ", covering the San José area"
  }. The resident did not have to mention it.`;
}

// Leslie's chat answers use Sonnet 5.5: in side-by-side tests it followed the "no addresses,
// distances or phone numbers" and "only claim what the listing says" rules where Haiku 4.5
// slipped (e.g. calling a hospital a phone-charging spot), at about the same speed.
export const ANSWER_MODEL = "us.anthropic.claude-sonnet-5-5";

export async function askLeslie(clients: LeslieClients, args: LeslieArgs, modelId = ANSWER_MODEL): Promise<LeslieAnswer> {
  const { question, language } = args;
  const preferred = language && LANGUAGE_NAMES[language] ? language : "en";

  const { extracted, situation } = await workOutSituation(clients, args);
  const hazard = (["earthquake", "wildfire_smoke", "extreme_heat", "power_outage"] as const).find((h) => h === situation.hazardType) ?? null;
  const from: [number, number] | null = situation.origin ? [situation.origin.lat, situation.origin.lng] : null;
  const ranked = rankForSituation(RESOURCES, from, {
    hazardType: situation.hazardType,
    hazardPoint: situation.hazardPoint ? [situation.hazardPoint.lat, situation.hazardPoint.lng] : null,
    hazardRadiusMiles: situation.hazardRadiusMiles,
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
          liveAlertText(situation.alert, sanitizeHazards(args.hazards)),
          situation.needs.length ? `Needs mentioned: ${situation.needs.join(", ")}.` : "",
          situation.notFound.length ? `Couldn't find these places on the map: ${situation.notFound.join(", ")}.` : "",
        ]
          .filter(Boolean)
          .join(" ");

  const system = `You are Leslie, the assistant inside Lifeline, a verified resource finder for San José, California, used during disasters and emergencies such as earthquakes, wildfire smoke, heat waves and power outages. People may be scared, hurt, on a low battery, or reading in a second language.

People in an emergency type fast, so questions often have typos, missing words or mixed languages ("wher can i get laxitives", "farmacia open now?"). Work out what they meant and answer that; never refuse or ask them to retype because of spelling.

Rules you must follow:
1. Answer ONLY from the VERIFIED LISTINGS below. Never use outside knowledge about places, hours, phone numbers or services.
2. If the listings do not answer the question, say plainly that you don't have verified info for that (in the reply language), set verified=false, and suggest calling 211 (or 911 for an emergency).
3. Never give medical advice (dosing, diagnosis, whether to take or stop a medicine, how to treat symptoms). Say you can't give medical advice, point them to a pharmacist or clinic from the listings, and to 911 if it's an emergency. Practical logistics, like which pharmacy is open, are fine.
4. Never send people to a place marked NOT OPEN TO THE PUBLIC. If a place's operating status is not confirmed, say so and tell them to call first. "ev_charging" places charge electric cars only, never phones or medical devices; "backup-power" means the place has its own generator.
   Everyday over-the-counter items (laxatives, pain relievers, bandages, cold medicine, diapers, electrolytes) are sold at pharmacies, so you may point to open pharmacies for them, but say you can't confirm what is in stock and suggest tapping the place to call first.
5. The listings are already ranked for this situation: open places first, then safest and closest. Prefer the top of the list. The app shows every place you cite as a card with its address, phone number, distance, hours and directions, one tap away. So never write phone numbers, street addresses or distances, and only mention hours when they matter (for example it closes within the hour, or it's the only one open now). Mention eligibility limits when they exist.
6. If there is an emergency, name it in your first sentence (for example "For the earthquake near SJSU, ..."), and for each place you recommend give a short reason it suits this situation, using only facts from its listing (for example "open 24 hours, has backup power, low earthquake risk, outside the affected area"). For any place marked MAY BE AFFECTED, tell them to call before going. If someone may be hurt or in danger, start with "If anyone is hurt or in danger, call 911."
7. Reply in ${LANGUAGE_NAMES[preferred]} unless the question is clearly written in English, Spanish or Vietnamese, in which case reply in that language. Set "language" to the code you replied in.
8. Be brief and calm: 1 to 3 short sentences, plain text. Add what the cards can't say on their own:
   - the direct answer, with your top pick by name and why it's the best choice right now (open 24 hours, the only one open now, has backup power, outside the affected area; only facts from its listing);
   - how the other good options differ, in a few words, if that helps them choose (for example "the CVS on Story Rd is closer but opens at 10 AM");
   - one practical next step (tap the place to call ahead about stock, bring ID if eligibility requires it, what to do if it's closed).
   Don't open with filler like "Great question" and don't repeat the question.
   Never put distances ("2.7 mi"), street addresses or phone numbers in the answer, even in parentheses.
   Only mention that you can't give medical advice when they actually asked for it (dosing, symptoms, treatment).
10. Say a place is open now, or open 24 hours, only when its listing says exactly that. If it's closed now, say when it opens instead, and never group it with places that are open.
11. Recommend a place only for a need its own listing supports: charging only where the listing mentions outlets or charging, food only at food listings, and so on. Don't send people to a hospital or emergency room for non-medical needs, even if it's open 24 hours with backup power. If nothing verified fits, say so and suggest 211.
9. Always answer by calling the respond tool (rules 10 and 11 below still apply). List every listing you mention in resourceIds.

Current time in San José: ${sanJoseNow()}.
Situation: ${situationText}
${whereFrom}

VERIFIED LISTINGS, ranked for this situation (${ranked.length}):
${ranked.map((x) => describe(x, hazard, situation.hazardRadiusMiles)).join("\n")}`;

  const history = typeof args.history === "string" ? safeJson(args.history) : args.history;
  const prior: Message[] = Array.isArray(history)
    ? (history as { role: string; text: string }[])
        .slice(-6)
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text)
        .map((m) => ({ role: m.role as "user" | "assistant", content: [{ text: m.text.slice(0, 1500) }] }))
    : [];
  // Converse needs the conversation to start with a user turn.
  while (prior.length && prior[0].role !== "user") prior.shift();

  // Claude Sonnet 5.x and Opus 5.x on Bedrock reject a forced toolChoice and `temperature`,
  // so for them the prompt asks for the tool instead.
  const newerModel = /claude-(sonnet|opus)-5/.test(modelId);
  const response = await clients.bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [
        ...prior,
        { role: "user", content: [{ text: question.slice(0, 1000) + (newerModel ? "\n\n(Answer by calling the respond tool.)" : "") }] },
      ],
      toolConfig: { tools: [RESPOND_TOOL], toolChoice: newerModel ? { auto: {} } : { tool: { name: "respond" } } },
      inferenceConfig: newerModel ? { maxTokens: 700 } : { maxTokens: 700, temperature: 0.2 },
    }),
  );

  const input = (response.output?.message?.content?.find((c) => c.toolUse)?.toolUse?.input ?? {}) as {
    answer?: string;
    resourceIds?: string[];
    verified?: boolean;
    language?: string;
  };
  // Drop any ID the model made up, so every citation in the app points at a real listing.
  const answer = input.answer?.trim() ?? "";
  let resourceIds = (input.resourceIds ?? []).filter((id) => BY_ID.has(id));
  // Safety net: if the answer names places but forgot to cite them, find them by name so the
  // map and place cards still match what Leslie said.
  if (resourceIds.length === 0 && answer) resourceIds = placesNamedIn(answer);
  return {
    answer: answer || "Sorry, I couldn't answer that right now. Please call 211 for help.",
    resourceIds,
    verified: Boolean(input.verified) && resourceIds.length > 0,
    language: input.language && LANGUAGE_NAMES[input.language] ? input.language : preferred,
    situation,
  };
}

/** Listings whose name (or the part before a parenthesis, e.g. "Walgreens") appears in the text, in order of mention. */
function placesNamedIn(text: string): string[] {
  const lower = text.toLowerCase();
  const found: { id: string; at: number }[] = [];
  for (const r of RESOURCES) {
    if (r.status === "closed") continue;
    const full = r.name.toLowerCase();
    const short = full.replace(/\s*\(.*\)\s*$/, "");
    // A short name like "CVS Pharmacy" matches many stores, so only use it when it's unique.
    const shortIsUnique = RESOURCES.filter((x) => x.name.toLowerCase().startsWith(short)).length === 1;
    const at = lower.indexOf(full) >= 0 ? lower.indexOf(full) : shortIsUnique && short.length > 6 ? lower.indexOf(short) : -1;
    if (at >= 0 && !found.some((f) => BY_ID.get(f.id)!.name === r.name)) found.push({ id: r.id, at });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.id).slice(0, 6);
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ---- "Your plan" -------------------------------------------------------------

export interface PlanArgs {
  hazard: unknown;
  language?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** How the origin was found: "gps", "zip" or a place the person typed. */
  originLabel?: string | null;
}

export interface PlanResult {
  summary: string;
  rightNow: string[];
  then: string[];
  placeIds: string[];
  language: string;
}

/**
 * Leslie's one-paragraph summary for the plan, plus which vetted steps to show and in what order.
 * Steps come only from safety-guidance.json: the tool's enums list the allowed ids, and anything
 * else is dropped. Places are ranked by the same shared code the app uses offline.
 */
export async function makePlan(bedrock: BedrockRuntimeClient, args: PlanArgs, modelId = LESLIE_MODEL): Promise<PlanResult> {
  const hazard = sanitizeHazard(args.hazard);
  if (!hazard) throw new Error("hazard is required");
  const language = args.language && LANGUAGE_NAMES[args.language] ? args.language : "en";
  const from: [number, number] | null = args.lat != null && args.lng != null ? [args.lat, args.lng] : null;
  const places = planPlaces(hazard, from);
  const allowed = allowedItems(hazard.type);
  const defaults = planSteps(hazard.type);
  const item = (i: { id: string; text: Record<string, string> }) => `${i.id}: ${i.text.en}`;

  const tool = {
    toolSpec: {
      name: "make_plan",
      description: "Return the resident's plan.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: `One short paragraph (under 80 words) in ${LANGUAGE_NAMES[language]}: what happened, where the resident is relative to it, and why these places. Plain text.`,
            },
            rightNow: {
              type: "array",
              items: { type: "string", enum: [...allowed.rightNow.keys()] },
              description: "3 to 5 safety step ids for right now, most important first.",
            },
            then: {
              type: "array",
              items: { type: "string", enum: [...allowed.then.keys()] },
              description: "3 to 6 step ids for what to bring and who to call, most important first.",
            },
          },
          required: ["summary", "rightNow", "then"],
        },
      },
    },
  };

  const system = `You are Leslie, inside Lifeline, a verified resource finder for San José. Someone pressed "Yes, I'm affected" on an alert. Build their plan.
Rules: Write the summary only from the facts below. ${hazard.source === "Simulated" ? 'This alert is a SIMULATED DEMO: say "simulated" in the summary.' : `Name the source (${hazard.source}).`} Never give medical advice. Don't invent places, distances or steps. Choose steps only from the lists by id; pick what fits this person best.

Alert: ${describeHazard(hazard)} (${hazard.severity}), started about ${minutesAgo(hazard.startedAt)} minutes ago${hazard.center ? `, affecting about ${hazard.radiusMiles} miles around it` : ", covering the San José area"}.
Resident: ${from ? `at ${args.originLabel ?? "their location"}${hazard.center ? `, ${distanceMiles(from[0], from[1], hazard.center[0], hazard.center[1]).toFixed(1)} miles from the center` : ""}` : "location unknown, so don't claim distances"}.
Places chosen for them (already ranked):
${places.map((x) => describe(x, hazard.type === "earthquake" || hazard.type === "extreme_heat" || hazard.type === "wildfire_smoke" || hazard.type === "power_outage" ? hazard.type : null, hazard.radiusMiles)).join("\n") || "none found"}

Right-now steps you may choose from:
${[...allowed.rightNow.values()].map(item).join("\n")}

Then steps (bring / call) you may choose from:
${[...allowed.then.values()].map(item).join("\n")}`;

  const response = await bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: "Make my plan." }] }],
      toolConfig: { tools: [tool], toolChoice: { tool: { name: "make_plan" } } },
      inferenceConfig: { maxTokens: 600, temperature: 0.2 },
    }),
  );
  const input = (response.output?.message?.content?.find((c) => c.toolUse)?.toolUse?.input ?? {}) as {
    summary?: string;
    rightNow?: string[];
    then?: string[];
  };
  // planSteps drops unknown ids and falls back to the vetted default when too few remain.
  const steps = planSteps(hazard.type, { rightNow: input.rightNow, then: input.then });
  return {
    summary: input.summary?.trim() || "",
    rightNow: steps.rightNow.map((i) => i.id),
    then: steps.then.length ? steps.then.map((i) => i.id) : defaults.then.map((i) => i.id),
    placeIds: places.map((x) => x.resource.id),
    language,
  };
}
