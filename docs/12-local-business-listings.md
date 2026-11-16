# 12 · Local business listings and directory collection

Added November 16, 2026 to make directory discovery an explicit product requirement.

## Requirement

Discover local businesses from the websites and directories where businesses are publicly listed, including owner-submitted listings and publisher/member directories. Combine these sources with business-owned websites, public records and licensed datasets. Support all local business sizes and categories without a minimum revenue or retainer requirement.

The intended flow is:

```text
state/city/category
  -> approved listing directory, membership directory, file or API
  -> listing record and business website link
  -> identity matching and duplicate resolution
  -> permitted business website/contact/service-page enrichment
  -> verified facts, service-fit groups and estimated budget groups
  -> selected contact verification and eligible reviewed outreach
```

Keep businesses with no website, no email, or unknown budget. Missing fields create research tasks, not automatic rejection.

## Source families to cover

| Family | What to look for | Useful contribution |
| --- | --- | --- |
| National and regional business listings | Category and city/state business directories, including owner-submitted pages | Broad names, categories, localities, business phone/website when published |
| Local chambers | Member directories for city, county, regional and neighborhood chambers | Local business discovery and membership/context clues |
| City/county and economic-development publishers | Business directories, business-district listings and usable open-data business records | Geographic coverage and businesses missed by national sources |
| Downtown, merchant and tourism associations | Tenant/merchant, shopping, dining, lodging and service directories | Neighborhood and visitor-facing business coverage |
| Trade and professional associations | Builder, contractor, real estate, medical, dental, legal and other member directories | Category-specific discovery; access/terms reviewed per association |
| Official licensing and registration publishers | Approved bulk files, public datasets and APIs | Identity/status corroboration and additional seeds; not a guarantee of an operating storefront |
| Licensed business data providers | Contracted national/local discovery datasets | Fill coverage gaps and provide allowed enrichment |
| Business-owned websites | Contact, about, services, locations, team and dated business announcements | Verify identity, collect business contact routes and identify service opportunities |

## Initial named candidate inventory

The following examples were identified from their own directory/product pages. **Candidate means a place to investigate; none of these directory rows is approved for automated collection by this plan.** Confirm access, storage, export, AI-processing and prospecting rights before enabling a connector. No bulk-access permission is inferred from a public page or search API.

| Candidate | Verified entry point | Intended investigation | Current status |
| --- | --- | --- | --- |
| Yellow Pages | [Business search](https://www.yellowpages.com/) | Broad local category/location listings; identify any suitable licensed feed/export or permitted access | Candidate; rights/access review needed |
| Better Business Bureau | [Business directory search](https://www.bbb.org/Search) | Category/location business discovery and available business website links; do not harvest complaint/review content for sales profiling | Candidate; rights/access review needed |
| Austin Chamber of Commerce | [Members and directory entry point](https://www.austinchamber.com/membership/our-members) | Representative local chamber membership directory for the Texas pilot | Candidate; publisher permission/access review needed |
| Greater Austin Asian Chamber of Commerce | [Member directory](https://members.austinasianchamber.org/directory/Find) | Representative searchable member listing/detail pages | Candidate; publisher permission/access review needed |
| Yelp | [Business Search API documentation](https://docs.developer.yelp.com/reference/v3_business_search) | Assess whether an available contracted product permits the intended lead storage/use; an API endpoint alone is insufficient | Disabled pending suitable rights; optional |
| Other city/county/downtown directories | Identify actual publishers for each pilot area | Catalog local sources, their coverage and supported access methods | Publisher discovery pending |
| Profession/trade directories | Identify actual associations for each pilot industry | Catalog relevant business/practice members without assuming a general scrape right | Publisher discovery pending |

These pages establish that directory/search entry points exist. They do not establish complete coverage, current contact accuracy, or permission to reuse their contents. A paid membership also does not automatically permit extracting a member list for marketing.

## Connector requirements

For each approved publisher, record a source owner, exact entry point, covered geography/categories, allowed fields, access method, reuse conditions, retention, request limits, attribution, and review expiry. Prefer an offered API, licensed feed, export or permissioned download. Use ordinary HTML parsing before a browser when public-page automation is permitted.

Store the source listing ID/URL, original business name/category/locality, business website, business phone/email only if actually published and allowed, retrieval date, and evidence origin. Distinguish the directory's own support/sales contacts from the listed business's contacts. A “send email” button can open a relay form rather than disclose an email; do not invent or extract a hidden address or submit promotional forms.

Follow the business website only after verifying its identity and checking access rules. Preserve both origins if a listing and first-party website disagree. Prefer reviewed recent evidence rather than silently overwriting a good contact with stale directory data.

Support pagination, export import, incremental refresh, deduplication, geographic/category mapping and partial-result reporting. Pause for denied access, login requirements or source limits. Never interpret a 50-result display cap as “only 50 businesses exist.” Do not use a directory's shared software platform as permission to crawl every organization running it.

## Expansion and success criteria

Maintain the directory catalog for every targeted state/metro and industry alongside the coverage ledger. Start by identifying national listing candidates, local chambers, municipal/district publishers and relevant professional associations in the pilot areas. Add approved connectors based on incremental unique-business yield, contact quality, coverage gaps and cost.

The pilot must demonstrate an approved directory-to-website flow independently of Google. Retain leads with missing websites and emails, merge duplicates from different publishers, and show source provenance on the account card. If permission is unavailable for a candidate, mark it unavailable/disabled and pursue another source; never present it as collected coverage.

Business listing discovery is ordinary automation. Reserve AI for selected interpretation/drafting after extraction; do not spend AI credits reading every directory listing.
