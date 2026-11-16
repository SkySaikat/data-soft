# Data Soft: U.S. local business lead and sales platform

Planning package v1.1 · November 16, 2026

## Run the first application release

The first working local application is implemented in this repository. Requires Node.js 24+ and pnpm.

```powershell
pnpm install
pnpm dev
```

Open [the local dashboard](http://127.0.0.1:3000). For a production-mode local server, use `pnpm build` followed by `pnpm start`.

Available now: persistent SQLite lead database, separate sample/live workspaces, location/industry/service/budget filters, search, pagination, lead detail and provenance, CSV import/export, manual entry, lead qualification, evidence-backed confirmed budgets, collection history, a bounded public NPPES organization connector, a permission-gated single-page JSON-LD listing connector, local analysis/drafts, and an optional cloud AI adapter.

The 24 sample businesses are fictional and clearly labeled. Imports and collections go into the separate live workspace. Real collected businesses start with unknown service needs and budgets unless attributable research supports them.

Cloud AI requires `.env.local` settings copied from [.env.example](.env.example): a server-only AI Gateway key, model ID, verified token prices, and spending cap. Local analysis needs no key and spends no AI credits. No messages are sent by this release.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` for checks. See [implementation status and architecture decisions](docs/13-implementation-status.md) for the exact supported collection formats, local access boundary, and next milestones. The broader documents below describe the target system; their later features are not all implemented yet.

## What we are building

An internal platform for our web and digital marketing agency that discovers local businesses throughout the United States, collects permitted business information, identifies service opportunities, organizes prospects into useful groups, and supports personalized proposals, email, and human cold calling.

**Collect broadly; prioritize intelligently.** Lawyers, doctors, electricians, plumbers, renovators, real estate agents, restaurants, retailers, and other local businesses belong in the database. Revenue and ability to pay $25,000/month are not admission requirements. We can sell one service, a smaller engagement, or a larger growth retainer.

The dashboard will separate:

| View | What it answers |
| --- | --- |
| Service fit | Which businesses appear to need web design, development, SEO, ads, or social media help? |
| Priority | Which businesses should we research or contact next, based on observed needs and contact readiness? |
| Estimated budget | Unknown, under $5k, $5k–$10k, $10k–$25k, or $25k+ monthly service-fee hypothesis, with evidence and confidence |
| Confirmed budget | What a prospect actually tells us; separate from every estimate |
| Coverage | Which industries and locations we have searched, through which sources, and how recently |

“Likely to buy” starts as an explainable ranking, not a proven purchase probability. Public information cannot establish willingness to pay. No software can guarantee finding every U.S. business or placing every email in the inbox.

## Read the plan

1. [Product, scope, and commercial strategy](docs/01-product-and-business-plan.md)
2. [Industries, lead groups, and scoring](docs/02-segmentation-and-scoring.md)
3. [Sources, scraping, and nationwide coverage](docs/03-data-sources-and-collection.md)
4. [Architecture, automation, and workflow](docs/04-system-architecture.md)
5. [Data model, API, and screen structure](docs/05-data-model-api-and-screens.md)
6. [Outreach, proposals, and message templates](docs/06-outreach-and-proposal-playbook.md)
7. [Email delivery, calling, SMS, and data rules](docs/07-deliverability-and-channel-rules.md)
8. [AI boundaries, operating budget, and spending controls](docs/08-ai-and-operating-costs.md)
9. [Implementation roadmap and acceptance tests](docs/09-build-roadmap-and-acceptance.md)
10. [Daily operations, metrics, and launch checklist](docs/10-operations-metrics-and-launch.md)
11. [Verified references, assumptions, and decisions](docs/11-research-and-decisions.md)
12. [Local business listings, directory candidates, and collection requirements](docs/12-local-business-listings.md)
13. [First-release implementation status and operating instructions](docs/13-implementation-status.md)

## Where the business data comes from

The discovery plan covers public business listing websites, local chamber member directories, city/county and downtown business directories, professional/trade directories, official public records, and licensed national business datasets. For each usable listing, follow its business website link to collect and verify relevant business contact details, services, locations, and website improvement opportunities where that access is permitted. A business without a website remains in the lead database.

Directory connectors are a core discovery requirement. Named sites such as Yellow Pages, BBB, and local chamber directories are research candidates; their public visibility does not establish bulk collection or reuse rights. The [listing-source inventory](docs/12-local-business-listings.md) distinguishes candidates from approved connectors. Google Maps and Google Business Profiles are not required to discover leads.

## Recommended starting point

Build an exportable lead database first, then collection workers, segmentation, contact verification, proposal drafting, and controlled outreach. Start with six industries in Texas and Florida to validate extraction and sales relevance; keep all states and industries configurable from the beginning. Expand source coverage after the pilot, rather than assuming two successful connectors cover the country.

Google Maps is excluded as a bulk extraction dependency because its platform terms restrict exporting and saving Maps content. A scraping vendor does not automatically supply reuse rights. Use official downloads, licensed business data, approved directories, and permitted company websites instead. See [Google's restrictions](https://cloud.google.com/maps-platform/terms).

The original planning phase did not collect prospects, purchase providers or send messages. Implementation now lives alongside these plans; refer to document 13 for current application behavior. Source-library candidates are not enabled scraping integrations.
