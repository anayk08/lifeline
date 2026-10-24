import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { GeoPlacesClient } from "@aws-sdk/client-geo-places";
import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/ask-leslie";
import { askLeslie } from "../../../shared/bedrock";

const clients = { bedrock: new BedrockRuntimeClient({}), geo: new GeoPlacesClient({}) };

export const handler: Schema["askLeslie"]["functionHandler"] = (event) =>
  askLeslie(clients, event.arguments, env.MODEL_ID);
