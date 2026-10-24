import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import type { Lang } from "../../shared/resources";
import type { RouteResult } from "../../shared/routes";
import type { HazardFeed, LiveHazard } from "../../shared/hazards";
import type { PlanResult } from "../../shared/bedrock";
import type { LabeledPoint, SituationResult } from "../../shared/situation";

// amplify_outputs.json only exists once the backend is deployed. Loading it through a glob
// keeps the app building (and fully usable offline) without it.
const found = import.meta.glob<{ default: Record<string, unknown> }>("../../amplify_outputs.json", { eager: true });
const outputs = Object.values(found)[0]?.default;

// Two ways to reach Bedrock:
// - "amplify": the deployed Amplify backend (AppSync + Lambda), when amplify_outputs.json exists.
// - "local": the laptop server in server/index.ts, reached at /api through the Vite proxy.
const hasAmplify = Boolean(outputs);
export const backendMode: "amplify" | "local" = hasAmplify ? "amplify" : "local";
export const hasBackend = true;
if (outputs) Amplify.configure(outputs);

let client: ReturnType<typeof generateClient<Schema>> | null = null;
export function api() {
  if (!hasAmplify) throw new Error("Amplify backend not deployed");
  client ??= generateClient<Schema>();
  return client;
}

async function local<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: `Backend unreachable (${res.status})` }));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export interface LeslieAnswer {
  answer: string;
  resourceIds: string[];
  verified: boolean;
  language: Lang;
  situation: SituationResult | null;
}

export async function askLeslie(args: {
  question: string;
  language: Lang;
  zip?: string;
  lat?: number;
  lng?: number;
  history?: { role: "user" | "assistant"; text: string }[];
  /** Active alerts, so residents never have to say "there's an earthquake". */
  hazards?: LiveHazard[];
}): Promise<LeslieAnswer> {
  if (backendMode === "local") return local<LeslieAnswer>("leslie", args);
  const { data, errors } = await api().queries.askLeslie({
    question: args.question,
    language: args.language,
    zip: args.zip || undefined,
    lat: args.lat,
    lng: args.lng,
    history: args.history ? JSON.stringify(args.history) : undefined,
    hazards: args.hazards?.length ? JSON.stringify(args.hazards) : undefined,
  });
  if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "No answer");
  return {
    answer: data.answer,
    resourceIds: (data.resourceIds ?? []).filter((x): x is string => !!x),
    verified: data.verified,
    language: (data.language as Lang) ?? args.language,
    // a.json() fields arrive as a JSON string.
    situation: (typeof data.situation === "string" ? JSON.parse(data.situation) : data.situation) ?? null,
  };
}

export async function planRoutes(from: [number, number], to: [number, number], lang: Lang): Promise<RouteResult> {
  if (backendMode === "local") return local<RouteResult>("routes", { from, to, lang });
  const { data, errors } = await api().queries.planRoutes({
    fromLat: from[0],
    fromLng: from[1],
    toLat: to[0],
    toLng: to[1],
    lang,
  });
  if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "No routes returned");
  return (typeof data === "string" ? JSON.parse(data) : data) as RouteResult;
}

/** Live alerts (USGS, NWS, CAL FIRE), plus the simulated SJSU earthquake when demo mode is on. */
export async function getHazards(demo: string | null): Promise<HazardFeed> {
  if (backendMode === "local") {
    const res = await fetch(`/api/hazards${demo ? `?demo=${encodeURIComponent(demo)}` : ""}`);
    if (!res.ok) throw new Error(`Alerts unavailable (${res.status})`);
    return (await res.json()) as HazardFeed;
  }
  const { data, errors } = await api().queries.getHazards({ demo: demo ?? undefined });
  if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "No alerts returned");
  return (typeof data === "string" ? JSON.parse(data) : data) as HazardFeed;
}

/** Leslie's summary and chosen vetted steps for the "Your plan" view. */
export async function makePlan(args: {
  hazard: LiveHazard;
  language: Lang;
  lat?: number;
  lng?: number;
  originLabel?: string;
}): Promise<PlanResult> {
  if (backendMode === "local") return local<PlanResult>("plan", args);
  const { data, errors } = await api().queries.makePlan({ ...args, hazard: JSON.stringify(args.hazard) });
  if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "No plan returned");
  return (typeof data === "string" ? JSON.parse(data) : data) as PlanResult;
}

/** Turns "Spartan Village" into a point with Amazon Location place search (San José only). */
export async function findPlace(text: string): Promise<LabeledPoint | null> {
  if (backendMode === "local") return (await local<{ place: LabeledPoint | null }>("place", { text })).place;
  const { data, errors } = await api().queries.findPlace({ text });
  if (errors?.length) throw new Error(errors[0].message);
  const parsed = (typeof data === "string" ? JSON.parse(data) : data) as { place: LabeledPoint | null } | null;
  return parsed?.place ?? null;
}

const PENDING_FLAGS = "lifeline.pendingFlags";

/** Resident "this info is wrong" reports. Queued on the phone when offline and sent later. */
export async function reportProblem(resourceId: string, reason: string): Promise<"sent" | "queued"> {
  const item = { resourceId, reason };
  if (hasAmplify && navigator.onLine) {
    try {
      await api().models.Flag.create({ ...item, source: "resident", status: "open" });
      return "sent";
    } catch {
      /* fall through to queue */
    }
  }
  try {
    const q = JSON.parse(localStorage.getItem(PENDING_FLAGS) ?? "[]");
    q.push(item);
    localStorage.setItem(PENDING_FLAGS, JSON.stringify(q));
  } catch {
    /* ignore */
  }
  return "queued";
}

export async function flushPendingReports() {
  if (!hasAmplify || !navigator.onLine) return;
  let q: { resourceId: string; reason: string }[] = [];
  try {
    q = JSON.parse(localStorage.getItem(PENDING_FLAGS) ?? "[]");
  } catch {
    return;
  }
  const left = [];
  for (const item of q) {
    try {
      await api().models.Flag.create({ ...item, source: "resident", status: "open" });
    } catch {
      left.push(item);
    }
  }
  try {
    localStorage.setItem(PENDING_FLAGS, JSON.stringify(left));
  } catch {
    /* ignore */
  }
}
