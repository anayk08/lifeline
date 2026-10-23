import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/ask-leslie";
import { askLeslie } from "../../../shared/bedrock";

const bedrock = new BedrockRuntimeClient({});

export const handler: Schema["askLeslie"]["functionHandler"] = (event) =>
  askLeslie(bedrock, event.arguments, env.MODEL_ID);
