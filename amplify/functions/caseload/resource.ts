import { defineFunction } from "@aws-amplify/backend";

export const caseload = defineFunction({
  name: "caseload",
  entry: "./handler.ts",
  timeoutSeconds: 90,
  memoryMB: 1024,
  runtime: 22,
  resourceGroupName: "data",
  environment: {
    MODEL_ID: "us.anthropic.claude-sonnet-5-5",
  },
});
