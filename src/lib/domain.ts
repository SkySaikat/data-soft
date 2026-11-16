import { z } from "zod";

export const SERVICES = {
  web_design: "Web design",
  web_development: "Development",
  local_seo: "Local SEO",
  google_ads: "Google Ads",
  meta_ads: "Meta ads",
  social_media: "Social media",
} as const;
export type Service = keyof typeof SERVICES;
export const BUDGETS = {
  unknown: "Unknown",
  under_5k: "Under $5k",
  "5k_10k": "$5k–$10k",
  "10k_25k": "$10k–$25k",
  "25k_plus": "$25k+",
} as const;
export type Budget = keyof typeof BUDGETS;
export const INDUSTRIES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Home renovation",
  "Legal",
  "Healthcare",
  "Dental",
  "Real estate",
  "Restaurants",
  "Retail",
  "Auto services",
  "Landscaping",
  "Cleaning",
  "Beauty & wellness",
  "Professional services",
  "Other",
];
export const STATES =
  "AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming"
    .split("|")
    .map((s) => {
      const [code, name] = s.split(":");
      return { code, name };
    });
export const serviceSchema = z.enum(
  Object.keys(SERVICES) as [Service, ...Service[]],
);
export const budgetSchema = z.enum(
  Object.keys(BUDGETS) as [Budget, ...Budget[]],
);
const optionalUrl = z
  .union([
    z.literal(""),
    z
      .url()
      .max(2048)
      .refine((v) => /^https?:\/\//i.test(v), "Use an http or https URL"),
  ])
  .default("");
export const leadInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  industry: z.string().trim().min(1).max(80).default("Other"),
  city: z.string().trim().min(1).max(120),
  state: z
    .string()
    .toUpperCase()
    .refine(
      (v) => STATES.some((s) => s.code === v),
      "Choose a U.S. state or D.C.",
    ),
  address: z.string().trim().max(250).default(""),
  website: optionalUrl,
  email: z.union([z.literal(""), z.email().max(254)]).default(""),
  phone: z.string().trim().max(50).default(""),
  services: z.array(serviceSchema).max(6).default([]),
  budget: budgetSchema.default("unknown"),
  budgetEvidence: z.array(z.string().trim().min(3).max(500)).max(8).default([]),
  notes: z.string().trim().max(4000).default(""),
  sourceName: z.string().trim().min(2).max(160).default("Manual entry"),
  sourceUrl: optionalUrl,
  sourceRecordId: z.string().max(200).default(""),
});
export type LeadInput = z.infer<typeof leadInputSchema>;
export type Workspace = "demo" | "live";
export type LeadStatus = "new" | "reviewing" | "qualified" | "not_a_fit";
export type Evidence = {
  sourceName: string;
  sourceUrl: string;
  observedAt: string;
  detail: string;
};
export type Lead = LeadInput & {
  id: string;
  workspace: Workspace;
  score: number;
  status: LeadStatus;
  budgetConfidence: string;
  confirmedBudget: number | null;
  createdAt: string;
  updatedAt: string;
  evidence: Evidence[];
  contacts?: PublicContact[];
  emailSuppressed?: boolean;
};
export type PublicContact = { id: string; leadId: string; kind: "email" | "phone"; value: string; sourceUrl: string; foundAt: string; status: "publicly_listed" | "imported"; e164: string; phoneType: string };
export type WorkJob = { id: string; kind: string; status: string; payload: Record<string, unknown>; progress: number; total: number; message: string; result: Record<string,unknown> | null; createdAt: string; updatedAt: string };
export type OutboundMessage = { id: string; leadId: string; recipient: string; subject: string; body: string; status: string; providerId: string; error: string; createdAt: string; sentAt: string | null };
export type Source = {
  id: string;
  name: string;
  family: string;
  url: string;
  status: string;
  description: string;
  imported: number;
};
export type CollectionRun = {
  id: string;
  source: string;
  state: string;
  city: string;
  status: string;
  imported: number;
  updated: number;
  message: string;
  createdAt: string;
};
export type Filters = {
  q?: string;
  state?: string;
  city?: string;
  industry?: string;
  service?: string;
  budget?: string;
  status?: string;
  sort?: string;
  page?: string;
  ids?: string;
  pageSize?: string;
};
export type LeadPage = {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    total: number;
    highPriority: number;
    industries: number;
    contactable: number;
    budgets: Record<Budget, number>;
  };
  industries: string[];
  cities: string[];
};

export function workspaceOf(value: unknown): Workspace {
  return value === "live" ? "live" : "demo";
}
export function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function identityKey(
  lead: Pick<LeadInput, "name" | "city" | "state" | "address">,
) {
  return [lead.name, lead.city, lead.state, lead.address]
    .map(normalize)
    .join("|");
}
export function scoreLead(lead: LeadInput) {
  return Math.min(
    100,
    10 +
      Math.min(lead.services.length * 12, 35) +
      (lead.notes ? 15 : 0) +
      (lead.website ? 10 : 0) +
      (lead.email || lead.phone ? 15 : 0) +
      (lead.sourceUrl ? 10 : 0),
  );
}
export function conservativeBudget(
  input: LeadInput,
): Pick<Lead, "budget" | "budgetConfidence"> {
  const uniqueEvidence = new Set(
    input.budgetEvidence.map((s) => s.trim().toLowerCase()),
  );
  return input.budget !== "unknown" && uniqueEvidence.size >= 2
    ? { budget: input.budget, budgetConfidence: "Unverified estimate" }
    : { budget: "unknown", budgetConfidence: "Insufficient evidence" };
}
export function localAnalysis(lead: Lead) {
  return {
    summary: `${lead.name} is a ${lead.industry.toLowerCase()} business in ${lead.city}, ${lead.state}. ${lead.notes || "Research its business website to establish a specific service opportunity."}`,
    opportunities: lead.services.map((s) => ({
      service: SERVICES[s],
      reason:
        "This service was flagged in the imported or manually entered research. Confirm the need with the business before proposing work.",
    })),
    nextStep:
      lead.email || lead.phone
        ? "Verify the business contact and source rights, then review a relevant first message."
        : "Find and verify a business contact route. Keep this account in the database while research continues.",
    budgetNote:
      lead.budget === "unknown"
        ? "Budget is unknown. Ask about scope and budget during discovery."
        : `${BUDGETS[lead.budget]}/month is an unverified service-fee estimate, not willingness to pay. Confirm it in discovery.`,
    draft: `Hi ${lead.name} team,\n\nI'm [your name] from [agency]. We help local ${lead.industry.toLowerCase()} businesses with ${lead.services.length ? SERVICES[lead.services[0]].toLowerCase() : "websites and digital marketing"}.\n\nWould a brief conversation about your current priorities be useful?\n\n[Your name]\n[Agency and valid postal address]\nBusiness advertisement. Reply unsubscribe to opt out.`,
  };
}
