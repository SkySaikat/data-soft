import { unzipSync, strFromU8 } from "fflate";
import { repository, type Repository } from "./db";
import { leadInputSchema, normalize, STATES, type LeadInput } from "./domain";
import { safeFetch, validateRemoteUrl } from "./safe-fetch";

export const OSM_ATTRIBUTION =
  "© OpenStreetMap contributors · ODbL 1.0 · https://www.openstreetmap.org/copyright";
type Place = { state: string; name: string; lat: number; lon: number };
export function parsePlaces(text: string): Place[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift()!;
  const delimiter = header.includes("\t") ? "\t" : "|";
  const headers = header.split(delimiter).map((s) => s.trim());
  const index = (key: string) => headers.indexOf(key);
  if (["USPS", "NAME", "INTPTLAT", "INTPTLONG"].some((key) => index(key) < 0))
    throw new Error("Unexpected Census gazetteer format.");
  return lines
    .map((line) => {
      const row = line.split(delimiter);
      return {
        state: row[index("USPS")].trim(),
        name: row[index("NAME")].trim(),
        lat: Number(row[index("INTPTLAT")]),
        lon: Number(row[index("INTPTLONG")]),
      };
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}
export async function cityCenter(
  state: string,
  city: string,
  repo: Repository = repository(),
): Promise<Place> {
  if (!STATES.some((s) => s.code === state) || !city.trim())
    throw new Error(
      "Choose a state and enter a city for local business searches.",
    );
  let places = repo.cacheGet<Place[]>("census-2025-places");
  if (!places) {
    const response = await safeFetch(
      "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip",
      4_000_000,
      0,
      undefined,
      { timeoutMs: 30000 },
    );
    if (response.status !== 200)
      throw new Error(
        `Census city list returned ${response.status}. Try later; no place-search scraping is used.`,
      );
    const files = unzipSync(response.body, {
      filter: (file) =>
        file.name.endsWith(".txt") && file.originalSize < 20_000_000,
    });
    const data = Object.values(files)[0];
    if (!data) throw new Error("City gazetteer archive has no supported file.");
    places = parsePlaces(strFromU8(data));
    repo.cacheSet("census-2025-places", places, 180 * 86400);
  }
  const clean = (name: string) =>
    normalize(
      name.replace(/ (city|town|village|borough|municipality|CDP)$/i, ""),
    );
  const exact = places.filter(
    (p) => p.state === state && normalize(p.name) === normalize(city),
  );
  const matches = exact.length
    ? exact
    : places.filter((p) => p.state === state && clean(p.name) === clean(city));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1)
    throw new Error(
      `Several places match. Use the full place name: ${matches.map((p) => p.name).join(", ")}`,
    );
  throw new Error(
    `No Census place matched ${city}, ${state}. Use an incorporated city or a Census-designated place name.`,
  );
}
const TAGS: Record<string, string[]> = {
  Plumbing: ['["craft"="plumber"]'],
  Electrical: ['["craft"="electrician"]'],
  Legal: ['["office"="lawyer"]'],
  "Real estate": ['["office"="estate_agent"]'],
  HVAC: ['["craft"~"^(hvac|air_conditioning)$"]'],
  "Home renovation": [
    '["craft"~"^(builder|carpenter|painter|roofer|tiler|plasterer)$"]',
  ],
  Restaurants: ['["amenity"~"^(restaurant|cafe|fast_food|bar)$"]'],
  Retail: ['["shop"]'],
  "Auto services": ['["shop"~"^(car_repair|car|car_parts|tyres)$"]'],
  Dental: ['["amenity"="dentist"]'],
  Healthcare: ['["healthcare"]', '["amenity"~"^(doctors|clinic)$"]'],
  Landscaping: ['["craft"="gardener"]'],
  Cleaning: ['["craft"="cleaning"]'],
  "Beauty & wellness": ['["shop"~"^(hairdresser|beauty|massage)$"]'],
  "Professional services": ['["office"]'],
};
export function osmQuery(
  place: Place,
  industry: string,
  radiusKm: number,
  limit: number,
) {
  const clauses =
    industry === "all"
      ? [
          '["shop"]',
          '["craft"]',
          '["office"]',
          '["amenity"~"^(restaurant|cafe|dentist|doctors|clinic|veterinary|pharmacy)$"]',
        ]
      : TAGS[industry];
  if (!clauses)
    throw new Error(
      "This category is not yet mapped. Choose All local businesses or an available category.",
    );
  return `[out:json][timeout:20][maxsize:16777216];(${clauses.map((tags) => `nwr(around:${Math.round(radiusKm * 1000)},${place.lat},${place.lon})["name"]${tags};`).join("")});out tags center ${limit};`;
}
export type OsmElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};
function category(tags: Record<string, string>, fallback: string) {
  if (tags.craft === "plumber") return "Plumbing";
  if (tags.craft === "electrician") return "Electrical";
  if (tags.office === "lawyer") return "Legal";
  if (tags.office === "estate_agent") return "Real estate";
  if (tags.amenity === "dentist") return "Dental";
  if (tags.healthcare || ["doctors", "clinic"].includes(tags.amenity))
    return "Healthcare";
  if (["restaurant", "cafe", "fast_food", "bar"].includes(tags.amenity))
    return "Restaurants";
  if (["car_repair", "car_parts", "tyres", "car"].includes(tags.shop))
    return "Auto services";
  if (tags.shop) return "Retail";
  if (tags.craft) return fallback === "all" ? "Home renovation" : fallback;
  if (tags.office) return "Professional services";
  return "Other";
}
function publicWebsite(value: string) {
  try {
    return validateRemoteUrl(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    ).href;
  } catch {
    return "";
  }
}
export function mapOsm(
  elements: OsmElement[],
  state: string,
  city: string,
  industry: string,
): LeadInput[] {
  const leads: LeadInput[] = [];
  for (const element of elements) {
    const tags = element.tags || {};
    if (
      !tags.name ||
      ["yes", "demolished", "disused"].includes(tags.disused) ||
      tags["disused:name"]
    )
      continue;
    const region = (tags["addr:state"] || state).toUpperCase();
    if (region !== state) continue;
    const email = (tags["contact:email"] || tags.email || "")
      .split(/[;,]/)[0]
      .trim()
      .replace(/^mailto:/i, "");
    const parsed = leadInputSchema.safeParse({
      name: tags.name,
      industry: category(tags, industry),
      city: tags["addr:city"] || `${city} area`,
      state,
      website: publicWebsite(
        tags["contact:website"] || tags.website || tags.url || "",
      ),
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
      phone: (tags["contact:phone"] || tags.phone || "").slice(0, 50),
      address: [tags["addr:housenumber"], tags["addr:street"]]
        .filter(Boolean)
        .join(" "),
      sourceName: "OpenStreetMap contributors (ODbL 1.0)",
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      sourceRecordId: `${element.type}/${element.id}`,
      notes: `Public ${industry === "all" ? "business" : industry.toLowerCase()} listing from a city-center radius search; city boundaries and contact details require review. ${OSM_ATTRIBUTION}`,
    });
    if (parsed.success) leads.push(parsed.data);
  }
  return leads;
}
export async function collectOsm(
  input: {
    state: string;
    city: string;
    industry: string;
    radiusKm: number;
    limit: number;
  },
  repo: Repository = repository(),
) {
  const place = await cityCenter(input.state, input.city, repo);
  const query = osmQuery(place, input.industry, input.radiusKm, input.limit),
    cacheKey = `osm:${query}`;
  const cached = repo.cacheGet<OsmElement[]>(cacheKey);
  let elements = cached;
  if (!elements) {
    const endpoint =
      process.env.OVERPASS_API_URL || "https://overpass.private.coffee/api/interpreter";
    let acquired = repo.acquireLock("overpass-cooldown", 10000);
    for (let attempt = 0; !acquired && attempt < 48; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      acquired = repo.acquireLock("overpass-cooldown", 10000);
    }
    if (!acquired)
      throw new Error("Public directory is busy; retry this job later.");
    repo.takeQuota(
      `osm:${new Date().toISOString().slice(0, 10)}`,
      Number(process.env.OSM_DAILY_QUERY_LIMIT || 20),
    );
    const url = new URL(endpoint);
    const response = await safeFetch(url.href, 8_000_000, 0, url.origin, {
      timeoutMs:30000, method:"POST",body:new URLSearchParams({data:query}).toString(),headers:{"Content-Type":"application/x-www-form-urlencoded"},
    });
    if (response.status !== 200)
      throw new Error(
        `Business directory returned ${response.status}. No endpoint rotation or automatic retries; try later.`,
      );
    const result = JSON.parse(response.text);
    if (result.remark)
      throw new Error(
        `Directory query was incomplete: ${String(result.remark).slice(0, 200)}`,
      );
    elements = result.elements || [];
    repo.cacheSet(cacheKey, elements, 3600);
  }
  const leads = mapOsm(elements!, input.state, input.city, input.industry);
  return {
    leads,
    partial: true,
    message: `${leads.length} businesses from ${input.radiusKm} km around ${place.name}; bounded to ${input.limit} map records. This is partial directory coverage, not all local businesses. ${OSM_ATTRIBUTION}`,
  };
}
