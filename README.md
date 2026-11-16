# Data Soft: U.S. local business lead and sales platform

Planning package v1.0 · November 16, 2026

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

## Recommended starting point

Build an exportable lead database first, then collection workers, segmentation, contact verification, proposal drafting, and controlled outreach. Start with six industries in Texas and Florida to validate extraction and sales relevance; keep all states and industries configurable from the beginning. Expand source coverage after the pilot, rather than assuming two successful connectors cover the country.

Google Maps is excluded as a bulk extraction dependency because its platform terms restrict exporting and saving Maps content. A scraping vendor does not automatically supply reuse rights. Use official downloads, licensed business data, approved directories, and permitted company websites instead. See [Google's restrictions](https://cloud.google.com/maps-platform/terms).

All files here are plans. No application has been built, no prospect data collected, no provider purchased, and no messages sent as part of this planning task.
