import { defineFunction } from "@aws-amplify/backend";

export const planRoutesFn = defineFunction({
  name: "plan-routes",
  entry: "./handler.ts",
  timeoutSeconds: 20,
  memoryMB: 512,
  runtime: 22,
  resourceGroupName: "data",
});
