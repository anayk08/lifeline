import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { data } from "./data/resource";
import { askLeslie } from "./functions/ask-leslie/resource";
import { caseload } from "./functions/caseload/resource";
import { planRoutesFn } from "./functions/plan-routes/resource";

const backend = defineBackend({
  data,
  askLeslie,
  caseload,
  planRoutesFn,
});

const { region, account } = Stack.of(backend.data.resources.graphqlApi);

// Both functions call Claude through US cross-Region inference profiles, which can
// route to the model in any US Region, so the foundation-model ARN uses a wildcard Region.
for (const fn of [backend.askLeslie, backend.caseload]) {
  fn.resources.lambda.addToRolePolicy(
    new PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: [
        `arn:aws:bedrock:${region}:${account}:inference-profile/us.anthropic.*`,
        "arn:aws:bedrock:*::foundation-model/anthropic.*",
      ],
    }),
  );
}

// Amazon Location Service routes use the AWS-managed provider resource.
backend.planRoutesFn.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["geo-routes:CalculateRoutes"],
    resources: [`arn:aws:geo-routes:${region}::provider/default`],
  }),
);
