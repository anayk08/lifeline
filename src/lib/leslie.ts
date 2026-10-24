// Leslie's conversation, shared by Home and the full-screen map: asking (with live alerts and
// the plan's context), the offline fallback, and which places each answer puts on the map.
import { useCallback, useEffect, useRef, useState } from "react";
import { primaryHazard } from "../../shared/hazards";
import { BY_ID, RESOURCES, rankForSituation, rankResources, type Lang } from "../../shared/resources";
import type { SituationResult } from "../../shared/situation";
import { queryParam, useApp } from "./app";
import { askLeslie, hasBackend } from "./backend";
import { liveSituation, planHistory } from "./hazards";
import { matchCategories, searchResources } from "./search";
import { speak } from "./speech";

const MAX_PINS = 6;

// Needs Leslie picks out of the question, mapped to the kinds of places that meet them.
const NEED_KINDS: Record<string, string[]> = {
  medical: ["health", "pharmacy"],
  medicine: ["pharmacy", "health"],
  shelter: ["shelter", "cooling"],
  water: ["water"],
  charging: ["charging"],
  food: ["food"],
  cooling: ["cooling"],
};
const EMERGENCY_KINDS = ["health", "shelter", "pharmacy", "cooling", "charging", "food", "water"];

export interface Turn {
  question: string;
  state: "loading" | "answered" | "offline" | "error";
  answer?: string;
  resourceIds: string[];
  verified?: boolean;
  language?: Lang;
  situation?: SituationResult | null;
}

export function useLeslie() {
  const { settings, online, origin, originSource, gps, hazards } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  // Without Leslie, the strongest live alert covering the person still shapes the ranking and the map.
  const live = primaryHazard(hazards, origin);
  const fallbackSituation = liveSituation(live, origin, settings.zip, originSource === "gps", originSource === "area" ? settings.area?.label : undefined);

  const localMatches = (q: string) =>
    rankResources(searchResources(RESOURCES, q), origin)
      .filter((x) => x.resource.status !== "closed")
      .slice(0, 3)
      .map((x) => x.resource.id);

  // Map pins: Leslie's citations first, then other open places of the same kinds, ranked
  // the same way Leslie ranks them for this emergency, so the map matches her answer.
  // Places not open to the public never appear.
  const pinsFor = (turn: Turn): string[] => {
    const cited = turn.resourceIds.filter((id) => BY_ID.get(id)?.status !== "closed");
    const s = turn.situation ?? fallbackSituation;
    const kinds = new Set<string>([
      ...cited.map((id) => BY_ID.get(id)!.category),
      ...matchCategories(turn.question),
      ...(s?.needs ?? []).flatMap((n) => NEED_KINDS[n] ?? []),
    ]);
    // "What are my options?" in an emergency: offer every kind of place that helps.
    if (s && s.hazardType !== "none" && kinds.size === 0) EMERGENCY_KINDS.forEach((k) => kinds.add(k));
    kinds.delete("ev_charging");
    if (kinds.size === 0) return cited;
    const from: [number, number] | null = s?.origin ? [s.origin.lat, s.origin.lng] : origin;
    const extra = rankForSituation(
      RESOURCES.filter((r) => !cited.includes(r.id) && r.status !== "closed" && (kinds.has(r.category) || r.tags.some((x) => kinds.has(x)))),
      from,
      s
        ? {
            hazardType: s.hazardType,
            hazardPoint: s.hazardPoint ? [s.hazardPoint.lat, s.hazardPoint.lng] : null,
            hazardRadiusMiles: s.hazardRadiusMiles,
            needs: s.needs,
          }
        : null,
    ).filter((x) => x.status.state !== "closed");
    const pins = [...cited, ...extra.map((x) => x.resource.id)].slice(0, MAX_PINS);
    // Places near the hazard rank low, but people should still see them marked "call first".
    const nearHazard = extra
      .filter((x) => x.nearHazard && !pins.includes(x.resource.id))
      .sort((a, b) => (a.miles ?? 0) - (b.miles ?? 0))
      .slice(0, 2)
      .map((x) => x.resource.id);
    return [...pins, ...nearHazard];
  };

  const ask = async (question: string) => {
    const idx = turns.length;
    const history = [
      // A question from the plan view starts with the plan's summary, so Leslie keeps its context.
      ...(queryParam("ctx") === "plan" ? planHistory() : []),
      ...turns
        .filter((x) => x.state === "answered")
        .flatMap((x) => [
          { role: "user" as const, text: x.question },
          { role: "assistant" as const, text: x.answer ?? "" },
        ]),
    ];

    if (!online || !hasBackend) {
      setTurns((ts) => [...ts, { question, state: "offline", resourceIds: localMatches(question) }]);
      return;
    }
    setTurns((ts) => [...ts, { question, state: "loading", resourceIds: [] }]);
    try {
      const res = await askLeslie({
        question,
        language: settings.lang,
        zip: settings.zip,
        lat: (gps ?? origin)?.[0],
        lng: (gps ?? origin)?.[1],
        history,
        hazards,
      });
      setTurns((ts) => ts.map((x, i) => (i === idx ? { ...x, state: "answered", ...res } : x)));
      if (settings.autoRead) speak(res.answer, res.language);
    } catch {
      setTurns((ts) => ts.map((x, i) => (i === idx ? { ...x, state: "error", resourceIds: localMatches(question) } : x)));
    }
  };

  const reset = useCallback(() => setTurns([]), []);

  // A question passed in the address (#/?q=... or #/ask?q=...) is asked once on arrival.
  const asked = useRef<string | null>(null);
  useEffect(() => {
    const q = queryParam("q");
    if (q && asked.current !== q) {
      asked.current = q;
      ask(q);
    }
    // ask is stable enough for a one-time initial question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = turns[turns.length - 1] ?? null;
  return { turns, current, ask, reset, pinsFor, situationFor: (turn: Turn) => turn.situation ?? fallbackSituation };
}
