import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import type { TriageResult } from "../../shared/caseload";
import type { Lang } from "../../shared/resources";

// amplify_outputs.json only exists once the backend is deployed. Loading it through a glob
// keeps the app building (and fully usable offline) without it.
const found = import.meta.glob<{ default: Record<string, unknown> }>("../../amplify_outputs.json", { eager: true });
const outputs = Object.values(found)[0]?.default;

export const hasBackend = Boolean(outputs);
if (outputs) Amplify.configure(outputs);

let client: ReturnType<typeof generateClient<Schema>> | null = null;
export function api() {
  if (!hasBackend) throw new Error("Backend not deployed yet");
  client ??= generateClient<Schema>();
  return client;
}

export interface LeslieAnswer {
  answer: string;
  resourceIds: string[];
  verified: boolean;
  language: Lang;
}

export async function askLeslie(args: {
  question: string;
  language: Lang;
  zip?: string;
  lat?: number;
  lng?: number;
  history?: { role: "user" | "assistant"; text: string }[];
}): Promise<LeslieAnswer> {
  const { data, errors } = await api().queries.askLeslie({
    question: args.question,
    language: args.language,
    zip: args.zip || undefined,
    lat: args.lat,
    lng: args.lng,
    history: args.history ? JSON.stringify(args.history) : undefined,
  });
  if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "No answer");
  return {
    answer: data.answer,
    resourceIds: (data.resourceIds ?? []).filter((x): x is string => !!x),
    verified: data.verified,
    language: (data.language as Lang) ?? args.language,
  };
}

export async function triageCaseload(zips: string[], scenario: string): Promise<TriageResult> {
  const { data, errors } = await api().mutations.triageCaseload({ zips, scenario });
  if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? "No triage returned");
  // a.json() results arrive as a JSON string.
  return (typeof data === "string" ? JSON.parse(data) : data) as TriageResult;
}

const PENDING_FLAGS = "lifeline.pendingFlags";

/** Resident "this info is wrong" reports. Queued on the phone when offline and sent later. */
export async function reportProblem(resourceId: string, reason: string): Promise<"sent" | "queued"> {
  const item = { resourceId, reason };
  if (hasBackend && navigator.onLine) {
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
  if (!hasBackend || !navigator.onLine) return;
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
