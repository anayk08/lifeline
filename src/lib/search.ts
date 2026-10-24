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

export function matchCategories(query: string): string[] {
  const hits = new Set<string>();
  for (const [re, cats] of SYNONYMS) if (re.test(query)) cats.forEach((c) => hits.add(c));
  return [...hits];
}

export function searchResources(list: Resource[], query: string): Resource[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const cats = matchCategories(q);
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  // When the query names a kind of place, a single stray word match isn't enough:
  // "cooling center" shouldn't pull in "Medical Center", or "charge my phone" a Tesla Supercharger.
  const minScore = cats.length ? 2 : 1;
  return list
    .map((r) => {
      const hay = `${r.name} ${r.services.join(" ")} ${r.address} ${r.zip} ${r.hoursNote ?? ""}`.toLowerCase();
      let score = 0;
      if (cats.includes(r.category)) score += 3;
      score += r.tags.filter((tag) => cats.includes(tag)).length * 2;
      score += words.filter((w) => hay.includes(w)).length;
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
