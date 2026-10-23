import { defineFunction } from "@aws-amplify/backend";

export const askLeslie = defineFunction({
  name: "ask-leslie",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 22,
  resourceGroupName: "data",
  environment: {
    MODEL_ID: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  },
});
