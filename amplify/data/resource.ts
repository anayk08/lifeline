import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { askLeslie } from "../functions/ask-leslie/resource";
import { planRoutesFn } from "../functions/plan-routes/resource";

const schema = a.schema({
  // One citation-backed answer from Leslie, the resident assistant.
  LeslieAnswer: a.customType({
    answer: a.string().required(),
    resourceIds: a.string().array().required(),
    verified: a.boolean().required(),
    language: a.string().required(),
  }),

  askLeslie: a
    .query()
    .arguments({
      question: a.string().required(),
      language: a.string(),
      zip: a.string(),
      lat: a.float(),
      lng: a.float(),
      history: a.json(),
    })
    .returns(a.ref("LeslieAnswer"))
    .handler(a.handler.function(askLeslie))
    .authorization((allow) => [allow.publicApiKey()]),

  // Walking and driving options from the resident to a place (Amazon Location Service).
  planRoutes: a
    .query()
    .arguments({
      fromLat: a.float().required(),
      fromLng: a.float().required(),
      toLat: a.float().required(),
      toLng: a.float().required(),
      lang: a.string(),
    })
    .returns(a.json())
    .handler(a.handler.function(planRoutesFn))
    .authorization((allow) => [allow.publicApiKey()]),

  // A listing that needs a human to re-check it, reported by a resident.
  Flag: a
    .model({
      resourceId: a.string().required(),
      reason: a.string().required(),
      source: a.enum(["agent", "resident"]),
      status: a.enum(["open", "resolved"]),
    })
    .authorization((allow) => [allow.publicApiKey().to(["create", "read"])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
