# 02 · Industries, lead groups, and scoring

## Include broadly

Use a versioned category taxonomy with plain-language names, synonyms, optional NAICS mappings, and source-specific category mappings. Preserve the original category. One business can occupy several categories without becoming several leads.

| Category family | Examples | Common offer hypotheses |
| --- | --- | --- |
| Legal | Attorneys, law firms, immigration, family, estate, personal injury | Practice pages, local SEO, paid search, intake improvements |
| Healthcare | Physicians, dental practices, therapists, clinics, medical groups | Accessible websites, local discovery, appointment journeys |
| Trades | Electricians, plumbers, HVAC, roofers, pest control | Local SEO, search ads, call and inquiry conversion |
| Renovation and property services | Remodelers, builders, painters, landscapers, cleaners | Portfolio sites, service pages, local demand generation |
| Real estate | Agents, brokerages, property managers, commercial brokers | Agent/team sites, lead capture, content, campaigns |
| Auto | Repair, body shops, detailing, dealerships | Service pages, local search, appointment conversion |
| Hospitality | Restaurants, caterers, hotels, venues | Websites, local search, social content, booking journeys |
| Personal services | Salons, spas, gyms, fitness studios | Booking sites, local ads, retention content |
| Retail | Local shops, specialty stores, home goods | Store sites, ecommerce, local discovery |
| Professional and B2B | Accountants, consultants, IT firms, manufacturers | Positioning, web development, SEO, qualified inquiries |
| Other local businesses | Education, pet care, storage, moving, event services | Category-specific diagnosis and offer |

These are hypotheses to validate. Healthcare and legal campaign claims require additional review; collecting practice business information does not require collecting patient or case data.

## The dashboard boxes

Every account receives three independent classifications. Show the reason, evidence date, and classification version beside each.

1. **Service fit:** website, development, SEO, Google Ads, Meta ads, social media, multiple services, or insufficient evidence.
2. **Outreach priority:** high, medium, research next, or blocked by contact/source rules.
3. **Estimated monthly service budget:** unknown, under $5,000, $5,000–$10,000, $10,000–$25,000, or $25,000+.

Use half-open boundaries internally: `<5000`, `[5000,10000)`, `[10000,25000)`, `>=25000`. Currency is USD. Show one-time project suitability separately. An unknown account must remain visible and eligible for ordinary research.

Also show **confirmed budget** when provided by the prospect, including who stated it, when, what services it covers, recurring versus one-time, and whether it includes advertising spend. Confirmation overrides the hypothesis in the sales workflow but preserves its history for evaluation.

## Explainable first-release priority score

This is a 0–100 rule score, not a percentage chance of purchase. Missing evidence earns no points and an explicit unknown reason; it does not mean the business has no need.

| Dimension | Maximum | Suggested evidence |
| --- | --- | --- |
| Observed service opportunity | 35 | Missing first-party site after documented checks; broken business journey; clear service/booking page gap; reviewed mobile usability problem |
| Relevant business trigger | 20 | Dated location opening, new service, recruiting, or business announcement from a permitted source |
| Offer relevance | 20 | The issue matches a service we actually deliver and a usable category-specific offer |
| Contact readiness | 15 | Relevant publicly identified role and business contact route; verification where applicable |
| Freshness and evidence quality | 10 | Recent, attributable, consistent records and reviewed account identity |

Initial priority bands: high >=70, medium 45–69, research next <45. Blocked channel status overrides ability to send, not database inclusion. A small plumber can score higher than a large medical group.

Do not treat a missing tracking tag as proof of no marketing, a slow synthetic run as proven lost revenue, or absence from one source as evidence a business is closed. Cap repeated signals so one website problem cannot fill multiple score dimensions. Publish rule weights and reason codes.

## Budget estimation policy

Maintain `estimated_band`, `confidence`, `method_version`, `evidence_ids`, `estimated_at`, and `expires_at`. Confidence describes evidence quality, not probability that the account will purchase.

Initial conservative rules, to be calibrated with real sales conversations:

| Evidence | Default result |
| --- | --- |
| No credible scale or marketing budget information | Unknown |
| Self-reported sole operator or small team, single location, local service scope | Under $5k or $5k–$10k hypothesis; low confidence; never an automatic ceiling |
| Corroborated regional operation with several locations or a sizeable team | $5k–$10k or $10k–$25k hypothesis; low/medium confidence |
| Corroborated substantial regional/multi-location organization and evidence of an established marketing function | $10k–$25k hypothesis; medium confidence at most without spend evidence |
| Relevant disclosed agency budget or substantial recurring external marketing allocation, with current corroboration | Consider $25k+; review scope and evidence; never infer that all marketing spend is agency fees |
| Prospect states an actual budget | Store confirmed budget separately; preserve the prior estimate |

Require at least two independent relevant signals for an inferred non-unknown band; an explicit budget statement is its own confirmation path. “No independent signals” stays unknown even if the site looks expensive. Two directories repeating the same upstream estimate are one signal. Location count alone is insufficient. Never infer revenue from review count or put a revenue guess in an outreach message.

Revenue arithmetic can support a conversation, not prove a budget: $25k/month equals $300k/year in fees. At a hypothetical 3% allocation to agency fees, this represents $10m/year in revenue. Actual allocation and margins vary greatly; media costs add to total spend. This arithmetic is not an eligibility rule.

## Service affinity examples

- An identified local business with no verified website: web design research queue; all budget bands remain possible.
- A plumber with several service-area pages and a working inquiry form: investigate specific local search or ad needs before proposing a rebuild.
- A doctor with a broken appointment link: document the exact link and date; offer an appointment-journey review without health information.
- A real estate agent with a brokerage-provided page: check whether the agent controls budget and whether an independent site is allowed.
- A law firm with a dated expansion announcement: contact the appropriate marketing role about location/service visibility; avoid promising case outcomes.

## Learning over time

Capture human corrections and confirmed budgets. After enough representative labeled outcomes, compare scores against held qualified meetings and wins, and compare budget bands against confirmed comparable service budgets. Split evaluation by account, time, and industry to prevent duplicate-location leakage. Track unknown coverage, error, and overestimation. Keep uncalibrated ranks labeled as such; do not show invented “82% likely to buy” badges.
