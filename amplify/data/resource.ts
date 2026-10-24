import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { askLeslie } from "../functions/ask-leslie/resource";
import { hazardPlan } from "../functions/hazard-plan/resource";
import { planRoutesFn } from "../functions/plan-routes/resource";

const schema = a.schema({
  // One citation-backed answer from Leslie, the resident assistant.
  LeslieAnswer: a.customType({
    answer: a.string().required(),
    resourceIds: a.string().array().required(),
    verified: a.boolean().required(),
    language: a.string().required(),
    // The emergency Leslie worked out, where distances start, and listings near the hazard.
    situation: a.json(),
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
      // Active live alerts the app knows about, so Leslie uses them without being told.
      hazards: a.json(),
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

  // Live alerts from USGS, the National Weather Service and CAL FIRE (same code as the laptop server).
  getHazards: a
    .query()
    .arguments({ demo: a.string() })
    .returns(a.json())
    .handler(a.handler.function(hazardPlan))
    .authorization((allow) => [allow.publicApiKey()]),

  // Leslie's summary and chosen vetted steps for the "Your plan" view.
  makePlan: a
    .query()
    .arguments({
      hazard: a.json().required(),
      language: a.string(),
      lat: a.float(),
      lng: a.float(),
      originLabel: a.string(),
    })
    .returns(a.json())
    .handler(a.handler.function(hazardPlan))
    .authorization((allow) => [allow.publicApiKey()]),

  // "Where are you?" for people without GPS (Amazon Location place search, San José only).
  findPlace: a
    .query()
    .arguments({ text: a.string().required() })
    .returns(a.json())
    .handler(a.handler.function(hazardPlan))
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
