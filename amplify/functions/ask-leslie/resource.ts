import { defineFunction } from "@aws-amplify/backend";

export const askLeslie = defineFunction({
  name: "ask-leslie",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 22,
  resourceGroupName: "data",
  environment: {
    // Same as ANSWER_MODEL in shared/bedrock.ts, so the laptop server and Lambda answer alike.
    MODEL_ID: "us.anthropic.claude-sonnet-5-5",
  },
});
