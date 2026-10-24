import { closeEnough, words } from "../../shared/fuzzy";
import type { Category, Resource } from "../../shared/resources";

// Words people actually type (in English, Spanish and Vietnamese) mapped to the
// categories and tags in the dataset. Used for offline search and as a fallback
// when Leslie can't be reached.
const SYNONYMS: [RegExp, (Category | string)[]][] = [
  [/pharm|medic|meds?\b|prescri|insulin|refill|drug|farmac|medicin|receta|insulina|thuốc|nhà thuốc/i, ["pharmacy", "health"]],
  // Everyday items a pharmacy sells, so "where can I find laxatives?" maps to pharmacies.
  [/laxativ|stool soft|tylenol|advil|ibuprofen|acetaminophen|aspirin|pain reliev|bandage|first aid|cold medicine|cough|allergy|antacid|diaper|thermometer|sunscreen|electrolyte|laxante|curita|vendaj|pañal|jarabe|thuốc nhuận tràng|thuốc giảm đau|băng cá nhân|tã/i, ["pharmacy"]],
  [/clinic|doctor|nurse|health|cl[ií]nica|m[eé]dico|salud|bác sĩ|phòng khám|sức khỏe/i, ["health"]],
  [/food|\beat|meal|pantry|hungry|grocer|comida|despensa|hambre|comer|thức ăn|đồ ăn|bữa ăn|đói/i, ["food"]],
  [/cool|heat|hot|a\/?c\b|air.?cond|calor|fresco|enfri|aire|mát|nóng|máy lạnh/i, ["cooling"]],
  [/charg|phone|battery|power|outlet|electric|cargar|bater[ií]a|enchufe|luz|sạc|pin|điện/i, ["charging"]],
  // Car chargers only when someone asks about a car; they can't charge a phone or a medical device.
  [/\bev\b|electric (car|vehicle)|car charg|charge my car|tesla|carro el[eé]ctrico|auto el[eé]ctrico|xe điện/i, ["ev_charging"]],
  [/wi-?fi|internet|wifi|mạng/i, ["wifi"]],
  [/water|drink|agua|nước/i, ["water"]],
  [/shelter|sleep|bed|stay|refugio|dormir|chỗ ở|ngủ/i, ["shelter"]],
  [/restroom|bathroom|toilet|ba[nñ]o|nhà vệ sinh/i, ["restroom"]],
  [/wheelchair|accessib|silla de ruedas|xe lăn/i, ["wheelchair"]],
  [/24|all night|overnight|toda la noche|cả đêm/i, ["24h"]],
];

// The same ideas as single words, compared with typo tolerance ("pharmcy", "laxitives",
// "shleter", "comidaa"). Accents are stripped before comparing, so Vietnamese words are
// listed without them.
const KEYWORDS: Record<string, (Category | string)[]> = {};
const addKeywords = (list: string, cats: (Category | string)[]) => list.split(" ").forEach((w) => (KEYWORDS[w] = cats));
addKeywords("pharmacy pharmacist medicine medicines medication medications prescription prescriptions insulin refill drugstore farmacia medicina medicinas receta insulina thuoc", ["pharmacy", "health"]);
addKeywords("laxative laxatives tylenol advil ibuprofen acetaminophen aspirin bandage bandages antacid diaper diapers thermometer sunscreen electrolytes allergy cough laxante pastillas", ["pharmacy"]);
addKeywords("clinic hospital doctor nurse health injured injury urgent clinica medico salud hospital", ["health"]);
addKeywords("food meal meals pantry hungry groceries grocery comida despensa hambre comer", ["food"]);
addKeywords("cooling cool heat hot conditioning conditioned calor fresco", ["cooling"]);
addKeywords("charge charging charger phone battery outlet electricity cargar bateria enchufe", ["charging"]);
addKeywords("water drink drinking agua nuoc", ["water"]);
addKeywords("shelter sleep stay refugio dormir", ["shelter"]);
addKeywords("restroom bathroom toilet", ["restroom"]);
addKeywords("wheelchair accessible", ["wheelchair"]);
const KEYWORD_LIST = Object.keys(KEYWORDS);

export function matchCategories(query: string): string[] {
  const hits = new Set<string>();
  for (const [re, cats] of SYNONYMS) if (re.test(query)) cats.forEach((c) => hits.add(c));
  // Typos: compare each typed word against the keyword list.
  for (const w of words(query)) {
    if (w.length < 4) continue;
    const hit = KEYWORD_LIST.find((k) => closeEnough(w, k));
    if (hit) KEYWORDS[hit].forEach((c) => hits.add(c));
  }
  return [...hits];
}

export function searchResources(list: Resource[], query: string): Resource[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const cats = matchCategories(q);
  const typed = words(q).filter((w) => w.length > 2);
  // When the query names a kind of place, a single stray word match isn't enough:
  // "cooling center" shouldn't pull in "Medical Center", or "charge my phone" a Tesla Supercharger.
  const minScore = cats.length ? 2 : 1;
  return list
    .map((r) => {
      const hay = `${r.name} ${r.services.join(" ")} ${r.address} ${r.zip} ${r.hoursNote ?? ""}`.toLowerCase();
      const nameWords = words(r.name);
      let score = 0;
      if (cats.includes(r.category)) score += 3;
      score += r.tags.filter((tag) => cats.includes(tag)).length * 2;
      // Exact words anywhere in the listing, or a misspelled place name ("walgren", "rosevelt").
      score += typed.filter((w) => hay.includes(w) || nameWords.some((n) => closeEnough(w, n))).length;
      if (hay.includes(q)) score += 3;
      return { r, score };
    })
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
}

export function inCategory(r: Resource, cat: string): boolean {
  return r.category === cat || r.tags.includes(cat);
}
