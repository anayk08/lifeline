// Local Lifeline backend: runs on the laptop and calls Amazon Bedrock with the
// laptop's AWS sign-in (profile "lifeline"). Stand-in for the Amplify Lambdas while
// the event account can't create IAM roles. Start it with `npm run server`.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import { GeoRoutesClient } from "@aws-sdk/client-geo-routes";
import { askLeslie, triageCaseload } from "../shared/bedrock";
import { planRoutes } from "../shared/routes";

const PORT = Number(process.env.PORT ?? 8787);
const PROFILE = process.env.AWS_PROFILE ?? "lifeline";

const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: fromIni({ profile: PROFILE }),
});

const geo = new GeoRoutesClient({
  region: "us-east-1",
  credentials: fromIni({ profile: PROFILE }),
});

const MAX_BODY = 32 * 1024;

function point(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [lat, lng] = v.map(Number);
  // Keep routing to the San José area this app covers.
  return lat > 36.9 && lat < 37.7 && lng > -122.3 && lng < -121.4 ? [lat, lng] : null;
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("Request too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("Body must be JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    if (req.method === "GET" && req.url === "/api/health") return send(res, 200, { ok: true, profile: PROFILE });
    if (req.method !== "POST") return send(res, 404, { error: "Not found" });

    const body = await readJson(req);
    if (req.url === "/api/leslie") {
      const question = String(body.question ?? "").trim();
      if (!question) return send(res, 400, { error: "question is required" });
      const answer = await askLeslie(bedrock, {
        question,
        language: typeof body.language === "string" ? body.language : null,
        zip: typeof body.zip === "string" ? body.zip : null,
        lat: typeof body.lat === "number" ? body.lat : null,
        lng: typeof body.lng === "number" ? body.lng : null,
        history: body.history,
      });
      console.log(`leslie ${Date.now() - started}ms  "${question.slice(0, 60)}" -> ${answer.resourceIds.join(",") || "no citations"}`);
      return send(res, 200, answer);
    }
    if (req.url === "/api/routes") {
      const from = point(body.from);
      const to = point(body.to);
      if (!from || !to) return send(res, 400, { error: "from and to must be [lat, lng] in the San José area" });
      const result = await planRoutes(geo, from, to, typeof body.lang === "string" ? body.lang : "en");
      console.log(`routes ${Date.now() - started}ms  ${result.options.map((o) => `${o.kinds.join("+")} ${Math.round(o.seconds / 60)}min`).join(", ")}`);
      return send(res, 200, result);
    }
    if (req.url === "/api/triage") {
      const zips = Array.isArray(body.zips) ? body.zips.map(String) : [];
      const result = await triageCaseload(bedrock, zips, typeof body.scenario === "string" ? body.scenario : null);
      console.log(`triage ${Date.now() - started}ms  zips ${result.outageZips.join(",")} -> ${result.clients.length} clients`);
      return send(res, 200, result);
    }
    return send(res, 404, { error: "Not found" });
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    console.error(`error ${req.url}: ${message}`);
    const expired = /expired|token|credential/i.test(message);
    send(res, expired ? 401 : 500, {
      error: expired ? "AWS sign-in expired. Run: aws login --profile lifeline" : message,
    });
  }
});

// Only reachable from this laptop; the web app reaches it through the Vite proxy.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Lifeline local backend on http://127.0.0.1:${PORT} using AWS profile "${PROFILE}" (us-east-1)`);
});
