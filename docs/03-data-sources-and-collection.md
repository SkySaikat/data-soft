# 03 · Sources, collection, and nationwide coverage

## Source strategy

Combine broad business data, profession-specific public records, permitted business websites, and approved directories. No single source covers every profession and every operating business. A source's availability does not automatically establish permission for bulk reuse, AI processing, or outreach.

**Local business listing websites are a core discovery channel.** The software must discover businesses on sites where owners or publishers list local services, then enrich those records from the businesses' own websites and other approved sources. Directory discovery must work independently of Google Maps, Google Business Profiles, or any one national provider. See the [dedicated listing inventory and connector requirements](12-local-business-listings.md).

| Source | Intended use | Access and limitations | Release |
| --- | --- | --- | --- |
| Licensed U.S. business data | Broad cross-industry discovery; company identity and scale fields | API/export contract must allow our internal CRM, retention, enrichment, and intended prospecting | Pilot if an acceptable license fits the operating budget |
| Texas TDLR license files | Licensed trades and other covered professions | Use official download files; distinguish individual licensees from businesses | Pilot |
| Florida DBPR construction records | Contractor discovery and license status | Download layout and status codes require parsing; not every record is an active business | Pilot |
| CMS NPPES | Healthcare organizations and professional practice discovery | Use official API/download options; identify practice business details; avoid clinical endpoints and personal-only information | Pilot healthcare slice |
| Business-owned websites | Business contacts, services, locations, public team roles, dated announcements | Check source policy and robots directives; bounded crawl; no login or restricted access | Pilot |
| State real estate/medical/bar and other licensing sources | Profession-specific coverage beyond the initial downloads | Connector-by-connector verification of bulk access, usage terms, scope, and fields | Expansion |
| Local chambers and membership directories | City/region business discovery across categories | Review each publisher's automated access, member-data reuse and contact restrictions | Pilot: at least one approved directory |
| Public national/local listing websites | Discover businesses by category, city, state or ZIP; collect allowed listing fields and website links | Named directory candidates require source-specific API, export, license or public-page usage review | Pilot connector capability; expand approved sources |
| City/county, downtown and economic-development directories | Local shops, services, tenants and business clusters | Identify the publisher, actual geography, update frequency and permitted access/reuse | Initial catalog; expand by metro |
| Professional and trade member directories | Sector-specific business/practice discovery | Review directory-specific permission; membership does not establish willingness to buy | Initial catalog; expand by industry |
| Licensed search API | Locate first-party websites and fill research gaps | Provider terms must allow intended storage and use; search snippets are not authoritative business evidence | Optional |
| Existing agency contacts and inbound forms | First-party pipeline and permissions | Store origin and channel-specific consent | Pilot |

Verified entry points: [TDLR download files](https://www.tdlr.texas.gov/LicenseSearch/licfile.asp), [Florida construction records](https://www2.myfloridalicense.com/construction-industry/public-records/), [DBPR disclaimer](https://www2.myfloridalicense.com/public-records-read-medisclaimer/), [NPPES dissemination](https://www.cms.gov/medicare/regulations-guidance/administrative-simplification/data-dissemination), and [Data Axle's API offering](https://www.data-axle.com/data-solutions/apis/). A vendor's API page establishes product availability, not our contracted usage rights.

TDLR and DBPR are discovery seeds, not ready-made email lists. DBPR's construction license file layout does not promise an email column. License-holder addresses may be residential. Match records to independently verified business entities and business contact routes before outreach.

NPPES includes downloadable monthly and incremental data, organizational names and practice-location reference files. Start with a bounded sample; stream larger files instead of loading the full national file into memory. An NPI is not a marketing qualification or proof that several practices share one owner. Do not use clinical messaging endpoints as sales addresses. [CMS source](https://www.cms.gov/medicare/regulations-guidance/administrative-simplification/data-dissemination).

## Listing discovery followed by website enrichment

1. Select an approved directory and the state/city/category cells it actually supports.
2. Use its permitted API, export, feed, or bounded public-page traversal. Read listing/detail pages and pagination only within the approved scope; stop at source caps and record partial coverage.
3. Extract only allowed fields: listing ID/URL, business name, listed category, city/state, business address/phone, business website, and published business email where actually present. Missing email is a normal outcome.
4. Preserve the directory name, retrieval date, original values, listing status and upstream provenance if known. A self-submitted listing is a lead clue, not independent confirmation of every claim.
5. Match the record to existing organizations/locations. Merge evidence while retaining source restrictions; do not send a new message because the same business appeared on another directory.
6. Follow the business-owned website when available and permitted. Verify identity and extract relevant contact/about/service/location information using the website algorithm below.
7. If a website is absent, blocked or ambiguous, retain the listing-derived lead with that status. Continue permitted verification or human research without inventing contact information.
8. Verify a selected email separately, apply service/budget grouping, and check channel eligibility before outreach. Appearing in a public directory does not itself grant marketing consent.

For example, a permitted chamber listing could identify a plumber and its website; the website could provide a business contact address and a service-page observation. Both sources remain attached to the account. If another permitted directory lists the same plumber, update the existing account instead of generating a second sequence. This is an illustrative workflow, not a report of collected data.

## Google Maps and restricted sources

Do not implement automated Maps browsing or Places API exports as the CRM's lead harvesting source. Maps Platform restrictions include exporting content, saving business names/addresses/reviews, and using the services in a listings/directory service or advertising product. API access or a third-party scraper subscription does not itself authorize these uses. Any future Maps display needs a separate permitted-purpose and terms review. [Google Maps Platform terms, section 3.2.3](https://cloud.google.com/maps-platform/terms).

Do not substitute scraped Google search results, Yelp, LinkedIn, Facebook, or another restricted platform without checking its terms and access rights. Keep those connectors disabled until a permitted integration exists. The browser component still has a useful role on permitted public business websites.

Google Business Profile APIs are oriented toward managing Business Profile/location information. Treat authorized client-profile management as a separate future service integration, not an assumed national prospect feed. [Google Business Profile API overview](https://support.google.com/business/answer/6333473?hl=en).

## Source policy registry

Every connector has a versioned record containing:

```text
source_id, source_family, owner, entry_url, access_method, scope
geographies, categories, listing_url_pattern, pagination_or_export_method
terms_url, reviewed_at, review_due_at, decision, decision_reason
permitted_fields, storage_ttl, export_allowed, ai_processing_allowed
outreach_use_allowed, license_reference, attribution_requirements
rate_limit, concurrency_limit, robots_policy, deletion_requirements
```

`unknown`, expired, or denied policy means no automated collection from that source. This is an internal product control. Respecting robots.txt is an additional control, not a substitute for permission or a legal conclusion. A mixed-source record retains field-level restrictions; a permissive source does not erase another source's restrictions.

## Website collection algorithm

1. Resolve a candidate domain from a permitted source or licensed search result.
2. Confirm it matches the business using name, locality, phone, address, and official links. Redirects to unrelated or parked domains require review.
3. Check source policy and robots directives; record outcome.
4. Fetch homepage HTML over HTTPS where available; parse structured data, visible links, `mailto:` and `tel:` contacts, and relevant business text with ordinary code.
5. Visit a bounded selection of contact, about/team, service, location, booking, and announcement pages. Start at 8 pages and a 10 MB total response budget per site.
6. Use Playwright only if necessary business content is unavailable in the static response and the source permits automated browser access. Start with at most 2 rendered pages per account and 2 concurrent browser contexts per worker.
7. Capture minimal evidence: URL, fetched time, relevant excerpt or allowed screenshot, selector, parser version, and content hash. Avoid storing a whole site indefinitely.
8. Normalize, link evidence to facts, and enqueue review when identity or contact ownership is ambiguous.

Default crawl pace: one active request per host, at least two seconds between requests, stricter limits when specified, and `Retry-After` handling. On 401/403, CAPTCHA, login requirement, or explicit denial, stop that path. On 429, back off and obey the server; repeated failures pause the connector. Do not rotate identities or proxies to get around blocks.

Block submission of contact forms, newsletter signups, chats, and purchases during research. Forms can be documented as contact routes; bulk promotional form submission is outside the outreach workflow.

## Deduplication and identity

- Normalize names, postal data, phone format, URL redirects, and registered domains; preserve originals.
- Prefer stable source IDs and strong combinations of business identifiers for exact matches.
- Use fuzzy name/address matches only as candidates for review.
- Separate organizations, brands, branches, franchise operators, practitioners, and people.
- A shared domain or phone is a match signal, not a globally unique account key. Brokerages, franchises, and multi-practice sites often share infrastructure.
- Record buying authority and parent relationships. Avoid contacting every branch about a centrally purchased service.
- Re-importing the same source file must update records without generating duplicate leads or outreach.

## Nationwide coverage plan

Maintain a coverage ledger keyed by `state + county/metro + category + source + connector_version`. Track planned, running, completed, partial, unavailable, blocked, and stale states; cursor, last successful run, raw count, unique accounts, missing fields, and cost.

First validate six categories: legal, medical practices, electricians, plumbers, renovation, and real estate, across selected Texas and Florida metros. Then add Georgia, North Carolina, Arizona, and the remaining states in measured waves. This is a rollout order, not a restriction on eventual coverage or a claim about the best markets.

For every state/category, decide whether an approved broad source covers it, a specific connector is needed, or the cell remains a documented gap. Do not fan out every possible ZIP/category/source combination blindly. Use bulk files, source-supported pagination, geographic tiling only where licensed, and incremental refresh. Mark capped or truncated API results partial and subdivide only when permitted.

Keep a directory catalog for each region and industry: national listings, local chambers, city/downtown directories and professional/trade directories. Expand the catalog alongside public-record connectors. Track each directory's incremental unique businesses and valid business website/contact yield so duplicate-heavy sources do not consume the whole collection budget.

Coverage metrics describe our configured search coverage and source yields. “All 51 geography rows processed” does not mean all U.S. businesses were found.

## Freshness defaults

Refresh business identity and license status every 30–90 days depending on source; website evidence every 30 days or before using a specific observation; contact verification within 7 days of first outreach; budget hypotheses every 90 days or on new evidence. A source license's shorter retention or refresh rule takes precedence. Removal requests trigger immediate suppression and the documented deletion process.
