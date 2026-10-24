import { defineFunction } from "@aws-amplify/backend";

// Serves getHazards, makePlan and findPlace, which share the alert and plan code.
export const hazardPlan = defineFunction({
  name: "hazard-plan",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  memoryMB: 512,
  runtime: 22,
  resourceGroupName: "data",
  environment: {
    MODEL_ID: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  },
});
