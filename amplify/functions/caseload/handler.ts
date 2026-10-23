import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/caseload";
import { TRIAGE_TOOL, cleanTriage, triagePrompt, type TriagedClient } from "../../../shared/caseload";

const bedrock = new BedrockRuntimeClient({});

export const handler: Schema["triageCaseload"]["functionHandler"] = async (event) => {
  const { zips, scenario } = event.arguments;
  const outageZips = [...new Set(zips.filter((z): z is string => /^\d{5}$/.test(z ?? "")))];
  if (outageZips.length === 0) throw new Error("Pick at least one outage ZIP code.");
  const now = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
  const { system, user } = triagePrompt(outageZips, scenario?.slice(0, 500) || "Unplanned power outage", now);

  const response = await bedrock.send(
    new ConverseCommand({
      modelId: env.MODEL_ID,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      toolConfig: { tools: [TRIAGE_TOOL], toolChoice: { tool: { name: "submit_triage" } } },
      inferenceConfig: { maxTokens: 6000, temperature: 0.2 },
    }),
  );
  const input = response.output?.message?.content?.find((c) => c.toolUse)?.toolUse?.input as
    | { summary?: string; clients?: TriagedClient[] }
    | undefined;
  if (!input) throw new Error("The model didn't return a triage.");
  return { ...cleanTriage(input, outageZips), generatedAt: new Date().toISOString(), model: env.MODEL_ID };
};
