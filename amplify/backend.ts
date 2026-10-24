import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { data } from "./data/resource";
import { askLeslie } from "./functions/ask-leslie/resource";
import { hazardPlan } from "./functions/hazard-plan/resource";
import { planRoutesFn } from "./functions/plan-routes/resource";

const backend = defineBackend({
  data,
  askLeslie,
  planRoutesFn,
  hazardPlan,
});

const { region, account } = Stack.of(backend.data.resources.graphqlApi);

// Leslie calls Claude through US cross-Region inference profiles, which can
// route to the model in any US Region, so the foundation-model ARN uses a wildcard Region.
backend.askLeslie.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["bedrock:InvokeModel"],
    resources: [
      `arn:aws:bedrock:${region}:${account}:inference-profile/us.anthropic.*`,
      "arn:aws:bedrock:*::foundation-model/anthropic.*",
    ],
  }),
);

// Leslie finds places the resident names ("SJSU", "Spartan Village") with Amazon Location place search.
backend.askLeslie.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["geo-places:SearchText"],
    resources: [`arn:aws:geo-places:${region}::provider/default`],
  }),
);

// Amazon Location Service routes use the AWS-managed provider resource.
backend.planRoutesFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["geo-routes:CalculateRoutes"],
    resources: [`arn:aws:geo-routes:${region}::provider/default`],
  }),
);

// The plan function writes Leslie's summary (Bedrock) and geocodes "Where are you?" (place search).
// Alert feeds are public HTTPS and need no permissions.
backend.hazardPlan.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["bedrock:InvokeModel"],
    resources: [
      `arn:aws:bedrock:${region}:${account}:inference-profile/us.anthropic.*`,
      "arn:aws:bedrock:*::foundation-model/anthropic.*",
    ],
  }),
);
backend.hazardPlan.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["geo-places:SearchText"],
    resources: [`arn:aws:geo-places:${region}::provider/default`],
  }),
);
