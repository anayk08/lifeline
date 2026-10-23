import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/caseload";
import { triageCaseload } from "../../../shared/bedrock";

const bedrock = new BedrockRuntimeClient({});

export const handler: Schema["triageCaseload"]["functionHandler"] = (event) =>
  triageCaseload(bedrock, event.arguments.zips, event.arguments.scenario, env.MODEL_ID);
