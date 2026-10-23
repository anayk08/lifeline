// Imports Soup's published Google Sheet into data/resources.json.
// Usage: npm run import-data            (fetches the published CSV)
//        node scripts/import-sheet.mjs path/to/file.csv
//
// Rules: never invent data. Unparseable or "listed as" hours become unknown (null),
// missing phones/languages/services stay empty, and every row keeps Soup's source
// (its Google Maps place) and last-verified date. Problems are printed at the end.
import { readFileSync, writeFileSync } from "node:fs";

const SHEET_CSV =
  "https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vTJYCzW4T7VlcRqc6rHGicc4z7PfouSb4puAOZq_dqZhmP0BENd94nQhXZdblcMVvoHERzYx53MFo6m/pub?gid=0&single=true&output=csv";
const OUT = new URL("../data/resources.json", import.meta.url);

const CATEGORY = {
  hospital: "health",
  pharmacy: "pharmacy",
  shelter: "shelter",
  food: "food",
  water: "water",
  cooling_center: "cooling",
  charging: "charging",
};
const DAY_COLUMNS = [
  ["mon", "monday"],
  ["tue", "tuesday"],
  ["wed", "wednesday"],
  ["thu", "thursday"],
  ["fri", "friday"],
  ["sat", "saturday"],
  ["sun", "sunday"],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

function to24(t) {
  const m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

/** "10:00 AM–1:30 PM, 2:00 PM–8:00 PM" -> [["10:00","13:30"],["14:00","20:00"]]; undefined if unclear. */
function parseDay(cell) {
  const v = cell.trim();
  if (/^open 24 hours$/i.test(v)) return [["00:00", "24:00"]];
  if (/^closed$/i.test(v)) return [];
  const ranges = v.split(",").map((part) => {
    const [a, b] = part.split(/[–-]/);
    const o = a && to24(a);
    let c = b && to24(b);
    if (c === "00:00") c = "24:00";
    return o && c ? [o, c] : null;
  });
  return ranges.length && ranges.every(Boolean) ? ranges : undefined;
}

const csv = process.argv[2]
  ? readFileSync(process.argv[2], "utf8")
  : await fetch(SHEET_CSV).then((r) => {
      if (!r.ok) throw new Error(`Sheet download failed: ${r.status}`);
      return r.text();
    });

const rows = parseCsv(csv);
const problems = [];
const seenPlaces = new Map();
const resources = [];

for (const row of rows) {
  const id = row.id;
  const issues = [];
  const category = CATEGORY[row.type];
  if (!category) {
    problems.push(`${id || "(no id)"} ${row.name}: unknown type "${row.type}", skipped`);
    continue;
  }

  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 37.1 || lat > 37.5 || lng < -122.1 || lng > -121.6) {
    problems.push(`${id} ${row.name}: missing or out-of-area coordinates, skipped`);
    continue;
  }

  const zip = row.address.match(/\b(9\d{4})\b(?!.*\b9\d{4}\b)/)?.[1] ?? "";
  if (!zip) issues.push("no ZIP in address");

  // Hours: keep only days Soup gave clear times for. "Listed as 24 hours" or "unclear" stays unknown.
  let hours = {};
  const unclearDays = [];
  for (const [key, col] of DAY_COLUMNS) {
    const parsed = parseDay(row[col] ?? "");
    if (parsed) hours[key] = parsed;
    else unclearDays.push(key);
  }
  if (unclearDays.length === 7) {
    hours = null;
    issues.push(`hours unknown ("${row.hours}")`);
  } else if (unclearDays.length) {
    issues.push(`hours unclear on ${unclearDays.join(", ")}`);
  }

  const is24h = hours && DAY_COLUMNS.every(([k]) => hours[k]?.[0]?.[0] === "00:00" && hours[k][0][1] === "24:00");
  const tags = [];
  if (is24h) tags.push("24h");
  if (row.has_backup_power === "yes") tags.push("backup-power");
  if (row.wheelchair_accessible === "yes") tags.push("wheelchair");
  if (row.pets_allowed === "yes") tags.push("pets");
  // Soup's "charging" rows are mostly EV fast chargers, which can't charge a phone or a medical device.
  const ev = category === "charging" && /supercharger|electrify america|ionna|chargepoint|\bEV\b/i.test(`${row.name} ${row.notes}`);
  if (ev) tags.push("ev");

  if (!row.phone) issues.push("no phone");
  if (row.status === "closed") issues.push(`marked closed: ${row.notes}`);
  if (row.status === "unknown") issues.push("operating status unconfirmed");
  if (ev) issues.push("EV car charger, not phone or device charging");

  if (row.place_id) {
    const dup = seenPlaces.get(row.place_id);
    if (dup) issues.push(`same place as ${dup}`);
    else seenPlaces.set(row.place_id, id);
  }

  const lastVerified = row.last_verified.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastVerified)) issues.push("no last-verified date");

  resources.push({
    id,
    name: row.name,
    category: ev ? "ev_charging" : category,
    tags,
    address: row.address,
    zip,
    lat,
    lng,
    phone: row.phone || null,
    hours,
    hoursNote: hours === null || unclearDays.length ? row.hours || null : null,
    services: [],
    languages: [],
    eligibility: null,
    notes: row.notes || null,
    status: ["open", "closed", "unknown"].includes(row.status) ? row.status : "unknown",
    outageRisk: row.power_outage || null,
    transit: row.transit || null,
    source: row.place_id ? `https://www.google.com/maps/place/?q=place_id:${row.place_id}` : SHEET_CSV,
    lastVerified,
  });
  if (issues.length) problems.push(`${id} ${row.name}: ${issues.join("; ")}`);
}

writeFileSync(OUT, JSON.stringify(resources, null, 2) + "\n");

const byCat = resources.reduce((a, r) => ((a[r.category] = (a[r.category] ?? 0) + 1), a), {});
console.log(`Rows in sheet: ${rows.length}. Written: ${resources.length} -> data/resources.json`);
console.log("By category:", byCat);
console.log(`\nRows with problems (${problems.length}):`);
for (const p of problems) console.log(` - ${p}`);
