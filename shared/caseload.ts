// Caseload triage for Maria Tran (fictional case manager). Shared between the
// backend handler (which calls Bedrock) and the console (which renders results).
import clientsRaw from "./clients.json";
import {
  RESOURCES,
  formatTime,
  rankResources,
  zipCenter,
  type Category,
  type OpenStatus,
  type Resource,
} from "./resources";

export type Need =
  | "oxygen"
  | "insulin"
  | "mobility"
  | "dialysis"
  | "heat_risk"
  | "food"
  | "medical_device"
  | "lives_alone"
  | "limited_english";

export interface Client {
  id: string;
  name: string;
  age: number;
  zip: string;
  language: "en" | "es" | "vi";
  needs: Need[];
  notes: string;
  phone: string;
}

/** All client records are fictional demo data. */
export const CLIENTS = clientsRaw as Client[];

export const NEED_LABELS: Record<Need, string> = {
  oxygen: "Home oxygen",
  insulin: "Insulin (needs cold)",
  mobility: "Mobility / power wheelchair",
  dialysis: "Home dialysis",
  heat_risk: "Heat risk",
  food: "Food insecure",
  medical_device: "Powered medical device",
  lives_alone: "Lives alone",
  limited_english: "Limited English",
};

// Which kinds of open places can meet each need during an outage.
const NEED_CATEGORIES: Partial<Record<Need, Category[]>> = {
  oxygen: ["charging", "health"],
  insulin: ["pharmacy", "health"],
  mobility: ["charging"],
  dialysis: ["health", "charging"],
  heat_risk: ["cooling"],
  food: ["food"],
  medical_device: ["charging"],
};

export interface Candidate {
  resource: Resource;
  miles: number | null;
  status: OpenStatus;
  forNeed: Need;
}

/** Closest open (or unknown-hours) places outside the outage that can meet each of the client's needs. */
export function candidatesFor(client: Client, outageZips: Set<string>, perNeed = 2): Candidate[] {
  const from = zipCenter(client.zip);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const need of client.needs) {
    const cats = NEED_CATEGORIES[need];
    if (!cats) continue;
    const pool = RESOURCES.filter(
      (r) => !outageZips.has(r.zip) && (cats.includes(r.category) || cats.some((c) => r.tags.includes(c))),
    );
    for (const x of rankResources(pool, from)
      .filter((x) => x.status.state !== "closed")
      .slice(0, perNeed)) {
      if (seen.has(x.resource.id)) continue;
      seen.add(x.resource.id);
      out.push({ ...x, forNeed: need });
    }
  }
  return out;
}

const statusText = (s: OpenStatus) =>
  s.state === "unknown"
    ? "hours unknown, call first"
    : s.state === "open"
      ? s.is24h
        ? "open 24h"
        : `open until ${formatTime(s.closesAt!)}`
      : "closed";

export function triagePrompt(outageZips: string[], scenario: string, now: string) {
  const zips = new Set(outageZips);
  const lines = CLIENTS.map((c) => {
    const inOutage = zips.has(c.zip);
    const cands = inOutage ? candidatesFor(c, zips) : [];
    return [
      `CLIENT ${c.id}: ${c.name}, ${c.age}, ZIP ${c.zip}${inOutage ? " (INSIDE OUTAGE)" : " (outside outage)"}, language ${c.language}`,
      `  Needs: ${c.needs.map((n) => NEED_LABELS[n]).join(", ")}`,
      `  Notes: ${c.notes}`,
      ...cands.map(
        (x) =>
          `  option [${x.resource.id}] for ${NEED_LABELS[x.forNeed]}: ${x.resource.name}, ${x.resource.address}, ${x.miles?.toFixed(1)} mi, ${statusText(x.status)}${x.resource.phone ? `, ${x.resource.phone}` : ""}`,
      ),
      inOutage && cands.length === 0 ? "  option: none open outside the outage" : "",
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");

  const system = `You help Maria Tran, a San José case manager, during a power outage. She has ${CLIENTS.length} vulnerable clients and limited time. Decide who she must reach first, why, where each person should go, and draft the check-in message she will review and send.

Rules:
- Urgency levels: "critical" (life-sustaining equipment without power, e.g. oxygen or dialysis, especially if living alone), "high" (insulin spoiling, heat risk with no cooling, can't evacuate alone), "medium" (inside the outage but has a backup or support), "low" (outside the outage: just a courtesy check). Every client gets exactly one entry.
- Give a short, concrete reason Maria can act on (what fails, how soon, who else is there).
- For clients inside the outage, pick the single best option from that client's listed options (prefer open now, then closest, and the one that meets the most urgent need). Only use option IDs listed for that client. If none fit, use null and say so in the reason.
- Draft the check-in text in the client's language (en English, es Spanish, vi Vietnamese), warm and plain, at most 300 characters. Name the place and street address if you picked one, ask them to reply or call Maria, and mention 911 for emergencies. Sign it "- Maria". For clients outside the outage, write a short check-in only.
- recommendedAction: one short instruction for Maria, e.g. "Call now and arrange a ride", "Text check-in", "No action, monitor".
- Never give medical advice beyond pointing to the place and 911. Never invent places, hours or phone numbers.

Current time in San José: ${now}.`;

  const user = `Outage report: ${scenario}. Outage ZIP codes: ${outageZips.join(", ")}.

${lines}`;
  return { system, user };
}

export const TRIAGE_TOOL = {
  toolSpec: {
    name: "submit_triage",
    description: "Submit the triaged caseload, most urgent client first.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          summary: { type: "string", description: "2 sentences for Maria: who is most at risk and what to do first." },
          clients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                clientId: { type: "string" },
                urgency: { type: "string", enum: ["critical", "high", "medium", "low"] },
                reason: { type: "string" },
                resourceId: { type: ["string", "null"] },
                recommendedAction: { type: "string" },
                message: { type: "string" },
              },
              required: ["clientId", "urgency", "reason", "resourceId", "recommendedAction", "message"],
            },
          },
        },
        required: ["summary", "clients"],
      },
    },
  },
};

export interface TriagedClient {
  clientId: string;
  urgency: "critical" | "high" | "medium" | "low";
  reason: string;
  resourceId: string | null;
  recommendedAction: string;
  message: string;
}

export interface TriageResult {
  summary: string;
  clients: TriagedClient[];
  outageZips: string[];
  generatedAt: string;
  model: string;
}

const RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** Keeps only known clients and listing IDs that were actually offered, then sorts by urgency. */
export function cleanTriage(raw: { summary?: string; clients?: TriagedClient[] }, outageZips: string[]): Omit<TriageResult, "generatedAt" | "model"> {
  const zips = new Set(outageZips);
  const byId = new Map(CLIENTS.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const clients: TriagedClient[] = [];
  for (const t of raw.clients ?? []) {
    const c = byId.get(t.clientId);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    const allowed = new Set(zips.has(c.zip) ? candidatesFor(c, zips).map((x) => x.resource.id) : []);
    clients.push({
      clientId: c.id,
      urgency: t.urgency in RANK ? t.urgency : "medium",
      reason: String(t.reason ?? "").slice(0, 400),
      resourceId: t.resourceId && allowed.has(t.resourceId) ? t.resourceId : null,
      recommendedAction: String(t.recommendedAction ?? "").slice(0, 120),
      message: String(t.message ?? "").slice(0, 400),
    });
  }
  clients.sort((a, b) => RANK[a.urgency] - RANK[b.urgency]);
  return { summary: String(raw.summary ?? ""), clients, outageZips };
}
