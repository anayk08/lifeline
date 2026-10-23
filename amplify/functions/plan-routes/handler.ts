import { GeoRoutesClient } from "@aws-sdk/client-geo-routes";
import type { Schema } from "../../data/resource";
import { planRoutes } from "../../../shared/routes";

const geo = new GeoRoutesClient({});

export const handler: Schema["planRoutes"]["functionHandler"] = (event) => {
  const { fromLat, fromLng, toLat, toLng, lang } = event.arguments;
  return planRoutes(geo, [fromLat, fromLng], [toLat, toLng], lang ?? "en");
};
