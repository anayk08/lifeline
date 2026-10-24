import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { GeoPlacesClient } from "@aws-sdk/client-geo-places";
import type { AppSyncResolverEvent } from "aws-lambda";
import { env } from "$amplify/env/hazard-plan";
import { makePlan } from "../../../shared/bedrock";
import { getHazards } from "../../../shared/hazards";
import { findPlace } from "../../../shared/situation";

const bedrock = new BedrockRuntimeClient({});
const places = new GeoPlacesClient({});

// One Lambda behind three queries; AppSync says which one in fieldName.
// The alert cache lives in the warm Lambda, so feeds are fetched at most every 2 minutes per instance.
export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>) => {
  const args = event.arguments;
  switch (event.info.fieldName) {
    case "getHazards":
      return getHazards(typeof args.demo === "string" ? args.demo : null);
    case "makePlan":
      return makePlan(
        bedrock,
        {
          hazard: typeof args.hazard === "string" ? JSON.parse(args.hazard) : args.hazard,
          language: typeof args.language === "string" ? args.language : null,
          lat: typeof args.lat === "number" ? args.lat : null,
          lng: typeof args.lng === "number" ? args.lng : null,
          originLabel: typeof args.originLabel === "string" ? args.originLabel.slice(0, 80) : null,
        },
        env.MODEL_ID,
      );
    case "findPlace": {
      const text = String(args.text ?? "").trim().slice(0, 120);
      return { place: text ? await findPlace(places, text) : null };
    }
    default:
      throw new Error(`Unknown field ${event.info.fieldName}`);
  }
};
