// Bedrock calls for Leslie and Maria's caseload triage. Used by the Amplify Lambda
// handlers and by the local laptop server (server/index.ts), so both behave the same.
// Never import this from the web app: it runs only where AWS credentials live.
import { ConverseCommand, type BedrockRuntimeClient, type Message } from "@aws-sdk/client-bedrock-runtime";
import { TRIAGE_TOOL, cleanTriage, triagePrompt, type TriageResult, type TriagedClient } from "./caseload";
import {
  BY_ID,
  RESOURCES,
  daysSinceVerified,
  formatTime,
  rankResources,
  zipCenter,
  type Ranked,
} from "./resources";

export const LESLIE_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
export const TRIAGE_MODEL = "us.anthropic.claude-sonnet-5-5";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish", vi: "Vietnamese" };

const sanJoseNow = () =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" }).format(
    new Date(),
  );

function describe({ resource: r, miles, status }: Ranked): string {
  const open =
    status.state === "unknown"
      ? "hours unknown, call ahead"
      : status.state === "open"
        ? status.is24h
          ? "OPEN NOW, 24 hours"
          : `OPEN NOW until ${formatTime(status.closesAt!)}`
        : `CLOSED now${status.opensAt ? `, opens ${status.opensDay ?? "today"} ${formatTime(status.opensAt)}` : ""}`;
  return [
    `[${r.id}] ${r.name} (${r.category}${r.tags.length ? `; ${r.tags.join(", ")}` : ""})`,
    `  ${open}${miles !== null ? ` | ${miles.toFixed(1)} mi away` : ""}`,
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
}

export async function askLeslie(bedrock: BedrockRuntimeClient, args: LeslieArgs, modelId = LESLIE_MODEL): Promise<LeslieAnswer> {
  const { question, language, zip, lat, lng } = args;
  const preferred = language && LANGUAGE_NAMES[language] ? language : "en";
  const from: [number, number] | null = lat != null && lng != null ? [lat, lng] : zip ? zipCenter(zip) : null;
  const ranked = rankResources(RESOURCES, from);

  const system = `You are Leslie, the assistant inside Lifeline, a verified resource finder for San José, California, used during power outages and heat waves. People may be stressed, on a low battery, or reading in a second language.

Rules you must follow:
1. Answer ONLY from the VERIFIED LISTINGS below. Never use outside knowledge about places, hours, phone numbers or services.
2. If the listings do not answer the question, say plainly that you don't have verified info for that (in the reply language), set verified=false, and suggest calling 211 (or 911 for an emergency).
3. Never give medical advice (dosing, diagnosis, whether to take or stop a medicine, how to treat symptoms). Say you can't give medical advice, point them to a pharmacist or clinic from the listings, and to 911 if it's an emergency. Practical logistics, like which pharmacy is open, are fine.
4. Never send people to a place marked NOT OPEN TO THE PUBLIC. If a place's operating status is not confirmed, say so and tell them to call first. "ev_charging" places charge electric cars only, never phones or medical devices; "backup-power" means the place has its own generator.
5. Prefer places that are OPEN NOW and closest. Mention the place name, whether it's open and until when, the distance if known, and the address. Mention eligibility limits when they exist.
6. Reply in ${LANGUAGE_NAMES[preferred]} unless the question is clearly written in English, Spanish or Vietnamese, in which case reply in that language. Set "language" to the code you replied in.
7. Be brief and calm: 2 to 4 short sentences, or a short list of up to 3 places. Plain text only.
8. Always answer by calling the respond tool. List every listing you mention in resourceIds.

Current time in San José: ${sanJoseNow()}.
${from ? `The resident is ${lat != null ? "at their current GPS location" : `in ZIP ${zip}`}; distances are from there.` : "The resident's location is unknown, so don't claim distances."}

VERIFIED LISTINGS (${ranked.length}):
${ranked.map(describe).join("\n")}`;

  const history = typeof args.history === "string" ? safeJson(args.history) : args.history;
  const prior: Message[] = Array.isArray(history)
    ? (history as { role: string; text: string }[])
        .slice(-6)
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text)
        .map((m) => ({ role: m.role as "user" | "assistant", content: [{ text: m.text.slice(0, 1500) }] }))
    : [];
  // Converse needs the conversation to start with a user turn.
  while (prior.length && prior[0].role !== "user") prior.shift();

  const response = await bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [...prior, { role: "user", content: [{ text: question.slice(0, 1000) }] }],
      toolConfig: { tools: [RESPOND_TOOL], toolChoice: { tool: { name: "respond" } } },
      inferenceConfig: { maxTokens: 600, temperature: 0.2 },
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
  };
}

export async function triageCaseload(
  bedrock: BedrockRuntimeClient,
  zips: (string | null)[],
  scenario?: string | null,
  modelId = TRIAGE_MODEL,
): Promise<TriageResult> {
  const outageZips = [...new Set(zips.filter((z): z is string => /^\d{5}$/.test(z ?? "")))];
  if (outageZips.length === 0) throw new Error("Pick at least one outage ZIP code.");
  const { system, user } = triagePrompt(outageZips, scenario?.slice(0, 500) || "Unplanned power outage", sanJoseNow());

  const response = await bedrock.send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: `${user}\n\nSubmit your answer by calling submit_triage.` }] }],
      // Claude Sonnet 5.5 on Bedrock rejects a forced toolChoice, so the prompt asks for the tool instead.
      toolConfig: { tools: [TRIAGE_TOOL], toolChoice: { auto: {} } },
      // Newer Claude models on Bedrock reject `temperature`, so only the token limit is set.
      inferenceConfig: { maxTokens: 6000 },
    }),
  );
  const input = response.output?.message?.content?.find((c) => c.toolUse)?.toolUse?.input as
    | { summary?: string; clients?: TriagedClient[] }
    | undefined;
  if (!input) throw new Error("The model didn't return a triage.");
  return { ...cleanTriage(input, outageZips), generatedAt: new Date().toISOString(), model: modelId };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
