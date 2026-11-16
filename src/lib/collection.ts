import { load } from "cheerio";
import Papa from "papaparse";
import robotsParser from "robots-parser";
import { leadInputSchema, normalize, STATES, type LeadInput } from "./domain";
import { safeFetch, validateRemoteUrl } from "./safe-fetch";

export function parseCsv(csv: string, sourceName: string, sourceUrl = "") {
  const parsed = Papa.parse<Record<string, string>>(
    csv.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
    },
  );
  if (parsed.errors.length)
    throw new Error(`CSV error: ${parsed.errors[0].message}`);
  if (
    !parsed.meta.fields?.includes("name") ||
    !parsed.meta.fields?.includes("state") ||
    !parsed.meta.fields?.includes("city")
  )
    throw new Error(
      "CSV needs name, city and state columns. Download the template for an example.",
    );
  if (parsed.data.length > 1000)
    throw new Error("Import up to 1,000 rows at a time.");
  const leads: LeadInput[] = [],
    errors: string[] = [];
  parsed.data.forEach((row, index) => {
    const result = leadInputSchema.safeParse({
      ...row,
      industry: row.industry || "Other",
      sourceName,
      sourceUrl,
      sourceRecordId: row.source_record_id || "",
      budget: row.budget || "unknown",
      budgetEvidence: (row.budget_evidence || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
      services: (row.services || "")
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (result.success) leads.push(result.data);
    else
      errors.push(
        `Row ${index + 2}: ${result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
  });
  if (errors.length)
    throw new Error(
      `${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n…and ${errors.length - 5} more invalid rows.` : ""} Nothing was imported.`,
    );
  if (!leads.length) throw new Error("The CSV has no business rows.");
  return leads;
}
type NpiRecord = {
  number: number;
  basic?: { organization_name?: string; name?: string; status?: string };
  addresses?: {
    address_purpose?: string;
    address_1?: string;
    city?: string;
    state?: string;
    telephone_number?: string;
  }[];
  taxonomies?: { primary?: boolean; desc?: string }[];
};
export function mapNppes(
  data: { results?: NpiRecord[]; Errors?: { description: string }[] },
  geography?: { state: string; city: string },
) {
  if (data.Errors?.length)
    throw new Error(data.Errors.map((e) => e.description).join(" "));
  const leads: LeadInput[] = [];
  for (const row of data.results || []) {
    const address =
      row.addresses?.find((a) => a.address_purpose === "LOCATION") ||
      row.addresses?.[0];
    if (!address || row.basic?.status === "D") continue;
    const taxonomy =
      row.taxonomies?.find((t) => t.primary)?.desc || row.taxonomies?.[0]?.desc;
    const parsed = leadInputSchema.safeParse({
      name: row.basic?.organization_name || row.basic?.name,
      industry: /dent/i.test(taxonomy || "") ? "Dental" : "Healthcare",
      city: address.city,
      state: address.state,
      address: address.address_1 || "",
      phone: address.telephone_number || "",
      notes: taxonomy
        ? `Public registry category: ${taxonomy}. Service needs and marketing budget have not been established.`
        : "Public organization listing. Service needs and marketing budget are unknown.",
      sourceName: "CMS NPPES",
      sourceUrl: `https://npiregistry.cms.hhs.gov/provider-view/${row.number}`,
      sourceRecordId: String(row.number),
    });
    if (
      parsed.success &&
      (!geography ||
        (parsed.data.state === geography.state &&
          (!geography.city ||
            normalize(parsed.data.city) === normalize(geography.city))))
    )
      leads.push(parsed.data);
  }
  return leads;
}
export async function collectNppes(
  state: string,
  city: string,
  keyword: string,
) {
  if (!STATES.some((s) => s.code === state))
    throw new Error("Choose a valid state.");
  const url = new URL("https://npiregistry.cms.hhs.gov/api/");
  url.search = new URLSearchParams({
    version: "2.1",
    enumeration_type: "NPI-2",
    state,
    limit: "50",
    ...(city ? { city } : {}),
    ...(keyword ? { organization_name: `${keyword}*` } : {}),
  }).toString();
  const response = await safeFetch(url.href, 4_000_000);
  if (response.status !== 200)
    throw new Error(
      `NPPES returned ${response.status}. No records were imported.`,
    );
  const data = JSON.parse(response.text);
  const leads = mapNppes(data, { state, city });
  return {
    leads,
    partial: (data.results?.length || 0) >= 50,
    message: `Retained ${leads.length} public organization listings with matching practice locations from ${data.results?.length || 0} API results. Mailing-only matches are excluded. This is a bounded sample, not complete geographic coverage. Emails and service needs require separate research.`,
  };
}
const BUSINESS_TYPES =
  /^(LocalBusiness|ProfessionalService|HomeAndConstructionBusiness|MedicalBusiness|MedicalOrganization|MedicalClinic|Physician|Dentist|Attorney|LegalService|Plumber|Electrician|HVACBusiness|GeneralContractor|RealEstateAgent|Restaurant|FoodEstablishment|Store|AutoRepair|HealthAndBeautyBusiness|Organization|Corporation)$/i;
export function extractDirectory(
  html: string,
  url: string,
  sourceName: string,
  defaultState: string,
  defaultCity: string,
) {
  const $ = load(html),
    leads: LeadInput[] = [];
  function visit(value: unknown, depth = 0) {
    if (
      !value ||
      typeof value !== "object" ||
      depth > 10 ||
      leads.length >= 100
    )
      return;
    if (Array.isArray(value)) {
      value.slice(0, 200).forEach((v) => visit(v, depth + 1));
      return;
    }
    const item = value as Record<string, unknown>;
    const types = Array.isArray(item["@type"])
      ? item["@type"]
      : [item["@type"]];
    if (types.some((t) => BUSINESS_TYPES.test(String(t)))) {
      const address = (
        item.address && typeof item.address === "object" ? item.address : {}
      ) as Record<string, unknown>;
      const stateValue = String(
        address.addressRegion || defaultState,
      ).toUpperCase();
      const state =
        STATES.find(
          (s) => s.code === stateValue || s.name.toUpperCase() === stateValue,
        )?.code || "";
      const type = String(types[0] || "");
      const industry = /plumb/i.test(type)
        ? "Plumbing"
        : /electric/i.test(type)
          ? "Electrical"
          : /dent/i.test(type)
            ? "Dental"
            : /medic|physic/i.test(type)
              ? "Healthcare"
              : /attorney|legal/i.test(type)
                ? "Legal"
                : /realestate/i.test(type)
                  ? "Real estate"
                  : /restaurant|food/i.test(type)
                    ? "Restaurants"
                    : /construction|contractor/i.test(type)
                      ? "Home renovation"
                      : "Other";
      let website = "";
      try {
        if (typeof item.url === "string")
          website = validateRemoteUrl(new URL(item.url, url).href).href;
      } catch {
        /* Invalid listing links are not followed. */
      }
      const email =
        typeof item.email === "string"
          ? item.email.replace(/^mailto:/i, "")
          : "";
      const result = leadInputSchema.safeParse({
        name: item.name,
        industry,
        city: String(address.addressLocality || defaultCity),
        state,
        address: String(address.streetAddress || ""),
        website,
        email,
        phone: typeof item.telephone === "string" ? item.telephone : "",
        sourceName,
        sourceUrl: url,
        sourceRecordId: String(item["@id"] || ""),
        notes:
          "Discovered in a structured business listing. Identity, contact accuracy and service needs require review.",
      });
      if (result.success) leads.push(result.data);
    }
    Object.values(item).forEach((v) => visit(v, depth + 1));
  }
  $("script[type='application/ld+json']").each((_, element) => {
    try {
      visit(JSON.parse($(element).text()));
    } catch {
      /* Ignore malformed structured blocks. */
    }
  });
  return [
    ...new Map(
      leads.map((l) => [[l.name, l.city, l.state, l.address].join("|"), l]),
    ).values(),
  ];
}
export async function collectDirectory(input: {
  url: string;
  sourceName: string;
  state: string;
  city: string;
  permissionConfirmed: boolean;
}) {
  if (!input.permissionConfirmed)
    throw new Error(
      "Confirm that this directory permits your intended automated collection and reuse.",
    );
  const url = validateRemoteUrl(input.url);
  if (
    /(^|\.)(google\.[a-z.]+|googleapis\.com|yelp\.com|facebook\.com|linkedin\.com|bbb\.org|yellowpages\.com)$/i.test(
      url.hostname,
    )
  )
    throw new Error(
      "This platform is not enabled for public-page scraping. Use an appropriately licensed export instead.",
    );
  const robotsUrl = new URL("/robots.txt", url).href;
  const robots = await safeFetch(robotsUrl, 250_000, 0, url.origin);
  if (![200, 404].includes(robots.status))
    throw new Error(
      `Cannot establish robots access (${robots.status}). Collection paused.`,
    );
  const policy = robotsParser(
    robotsUrl,
    robots.status === 200 ? robots.text : "",
  );
  if (policy.isAllowed(url.href, "DataSoftLocalResearch") === false)
    throw new Error(
      "This source's robots directives disallow this collection path.",
    );
  const crawlDelay = Math.max(
    2,
    policy.getCrawlDelay("DataSoftLocalResearch") || 0,
  );
  if (crawlDelay > 10)
    throw new Error(
      "This source requires a longer crawl delay. Use an export until background collection workers are available.",
    );
  await new Promise((resolve) => setTimeout(resolve, crawlDelay * 1000));
  const response = await safeFetch(url.href, 2_000_000, 0, url.origin);
  if (new URL(response.url).origin !== url.origin)
    throw new Error(
      "The directory redirected to a different origin. Review the new source before collecting.",
    );
  if (response.status !== 200)
    throw new Error(
      `Directory returned ${response.status}. Collection stopped.`,
    );
  if (!/html/i.test(response.contentType))
    throw new Error(
      "This connector expects an HTML directory with JSON-LD business listings. Use CSV import for exports.",
    );
  const leads = extractDirectory(
    response.text,
    response.url,
    input.sourceName,
    input.state,
    input.city,
  );
  if (!leads.length)
    throw new Error(
      "No usable structured business listings found. This first connector supports JSON-LD LocalBusiness records; use a permitted CSV export for other directory formats.",
    );
  return {
    leads,
    partial: true,
    message: `Read ${leads.length} business listings from one permitted page. Pagination, business website enrichment and browser rendering are not yet implemented; coverage is partial.`,
  };
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
}
export function exportLeadsCsv(leads: LeadInput[]) {
  return Papa.unparse(
    leads.map((l) =>
      Object.fromEntries(
        Object.entries({
          name: l.name,
          industry: l.industry,
          city: l.city,
          state: l.state,
          address: l.address,
          website: l.website,
          email: l.email,
          phone: l.phone,
          services: l.services.join("|"),
          budget: l.budget,
          budget_evidence: l.budgetEvidence.join("|"),
          source_name: l.sourceName,
          source_url: l.sourceUrl,
          source_license: l.sourceName.startsWith("OpenStreetMap")
            ? "© OpenStreetMap contributors; ODbL 1.0; https://www.openstreetmap.org/copyright"
            : "Check source-specific reuse terms",
          notes: l.notes,
        }).map(([k, v]) => [k, csvCell(v)]),
      ),
    ),
  );
}
export const CSV_TEMPLATE = `name,industry,city,state,address,website,email,phone,services,budget,budget_evidence,notes\nExample Business,Plumbing,Austin,TX,,https://example.com,,,web_design|local_seo,unknown,,Replace this example with business information you may use.\n`;
