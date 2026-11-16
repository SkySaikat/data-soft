# 05 · Data model, API, and screens

## Important distinctions

A source record is not necessarily a business. A business can have multiple locations and contacts. A published phone number is not SMS consent. A verified email is not permission to send. A budget estimate is not a confirmed budget. Model these separately.

## Core tables

All business data tables include workspace scope, IDs, creation/update times, and appropriate access restrictions.

| Entity | Main fields and relationships |
| --- | --- |
| `organizations` | Name, legal name, DBA, domain, categories, operating status, parent ID, ownership/buying-authority notes |
| `locations` | Organization ID, business address, service areas, time zone, source links; residential-address flag |
| `people` | Business name/role, linked organizations, public professional provenance; no unrelated personal profiling |
| `contact_points` | Organization/person ID, email/phone/URL, normalized value, business-purpose classification, source, last seen |
| `source_policies` | Terms, license, allowed fields/uses, AI/export flags, retention, limits, review/expiry state |
| `source_records` | Source ID/key and family, listing URL, original directory category/location, listed business website, import/search cell, retrieval time, allowed payload reference, match state |
| `evidence` | Fact key/value, source record or URL, excerpt/hash, observation time, extractor version, retention deadline |
| `field_provenance` | Entity/field/value version to evidence IDs and source restrictions; supports field removal and downstream invalidation |
| `signals` | Signal code, service affinity, evidence IDs, severity, human verification, expiry |
| `score_snapshots` | Versioned priority score, dimension totals, reason codes, evidence quality, computed time |
| `budget_estimates` | Monthly service-fee band, USD, confidence, method/version, evidence, expiry, review state |
| `budget_confirmations` | Stated amount/range, currency, recurring/project period, services, media inclusion, speaker, dated evidence |
| `verification_checks` | Contact ID, provider, raw/mapped result, checked time, expiry, cost; append-only history |
| `channel_permissions` | Contact/channel, permission basis, consent proof where required, jurisdiction/rules review, scope, expiry/revocation |
| `coverage_cells` | Geography/category/source/version, cursor, run state, partial-result reason, timestamps and counts |
| `discovery_runs` | Search configuration, expected/actual cost, limits, owner, state and checkpoints |
| `campaigns` | Industry/offer selection, sender, schedule, reviewed templates, touch/cost caps, state |
| `enrollments` | Organization/contact/campaign, current step, eligibility snapshot, pause/stop reason |
| `messages` | Draft versions, evidence IDs, content hash, reviewer, send key, provider ID, thread ID, state |
| `message_events` | External event ID, type, occurrence/receipt times, delivery/reply/bounce/complaint data |
| `suppressions` | Email/phone/person/account scope, keyed lookup token, reason, source, effective time; tightly restricted |
| `call_tasks` | Business number, local time window, screening/rules state, human owner, disposition |
| `opportunities` | Need, authority, budget, timing, stage, service scope, owner, recurring fee and project fee separately |
| `proposals` | Opportunity, version, line items, assumptions, media exclusions, review, accepted version |
| `jobs`, `outbox`, `usage_ledger`, `audit_log` | Durable work, queue publishing, reserved/actual spend, attributable changes |

## Constraints and indexing

Use unique source identity keys such as `(workspace_id, source_id, source_record_id)`. Source identifiers must not collapse unrelated records from different datasets. Index normalized email/phone lookup tokens, canonical domain, name/locality search, industry/state filters, pipeline stage, due jobs, suppression lookup, and evidence expiry.

Use explicit relationship records for shared contacts and branches. A domain is not a unique company identifier. Preserve business-relevant email syntax; normalize domains and provider-appropriate comparisons without silently rewriting the address used for delivery.

Prevent overlapping active sequences to the same contact and, by default, the same account. Household or shared-phone ambiguity requires review. Enforce dispatch-key uniqueness in the database. Restrict budget band values and require evidence for non-unknown inferred bands.

## Example account card

```json
{
  "display_name": "Example Local Services",
  "example_only": true,
  "industry": "plumbing",
  "state": "TX",
  "service_fit": ["web_design", "local_seo"],
  "priority_score": 76,
  "priority_label": "high",
  "purchase_probability": null,
  "budget_estimate": {
    "monthly_service_fee_band": "unknown",
    "confidence": "insufficient_evidence",
    "evidence_ids": []
  },
  "confirmed_budget": null,
  "email_status": "not_verified",
  "email_eligibility": "blocked_pending_checks",
  "sms_consent": "not_obtained"
}
```

A high-priority prospect can have an unknown budget. That is a supported outcome, not an error.

## Internal API outline

| Route | Purpose and control |
| --- | --- |
| `POST /api/discovery-runs/preview` | Return source plan, gaps, expected workload/cost; no collection |
| `POST /api/discovery-runs` | Create bounded run after source/usage checks |
| `GET /api/accounts` | Paginated filters by industry, geography, score, service, budget, freshness and contact state |
| `GET /api/accounts/:id` | Account, branches, evidence, contacts, restrictions and sales activity |
| `POST /api/accounts/:id/refresh` | Re-check allowed source information with limits |
| `POST /api/accounts/:id/budget-confirmations` | Add dated prospect-stated budget; preserve estimate history |
| `POST /api/contacts/:id/verify` | Policy-aware, cached paid verification |
| `POST /api/drafts` | Create template/AI draft using allowed evidence |
| `POST /api/drafts/:id/review` | Review exact content version; edits invalidate review |
| `POST /api/campaigns/:id/enrollments` | Enroll eligible contacts with duplicate and touch checks |
| `POST /api/campaigns/:id/pause` | Cancel pending dispatches for that campaign |
| `POST /api/outreach/stop` | Persist global stop and halt dispatch |
| `POST /api/suppressions` | Immediate opt-out/do-not-contact; cancel related work |
| `POST /api/webhooks/:provider` | Signed, deduplicated external events |
| `POST /api/unsubscribe/:token` | Unauthenticated signed-token one-click unsubscribe, idempotent |
| `GET /unsubscribe/:token` | Human-facing no-login opt-out page; GET alone does not execute the header one-click action |
| `POST /api/exports` | Audited, source-permitted fields; omit suppressed contact data from outreach exports |
| `GET /api/metrics` | Coverage, data quality, spend and sales funnel |

Use authentication, authorization, schema validation, pagination, rate limits, and idempotency keys for appropriate mutations. Unsubscribe and webhook endpoints use their own token/signature validation. Do not expose raw personal data through public lookup endpoints.

## Screens to build

1. **Overview:** new accounts, service-fit and budget boxes, unknown counts, contact-ready counts, meetings and spending.
2. **Business explorer:** saved filters, map-free geography selectors, bulk review, export, merge candidates and exclusion reasons.
3. **Account detail:** evidence beside every service observation and estimate, contact routes, entity relationships, confirmed budgets and history.
4. **Coverage:** state/category/source matrix with partial runs and missing connectors; directory catalog by region/industry, candidate/approved access state and incremental unique-business yield.
5. **Research runs:** preview, start, pause, cursor progress, failures and cost breakdown.
6. **Draft review:** source observation, chosen offer, subject/body, footer, eligibility and exact version approval.
7. **Campaigns and inbox:** sequence state, replies, human owner, stops and delivery signals.
8. **Calling queue:** eligible business numbers, prospect local time, relevant notes, dispositions and do-not-call action.
9. **Sales pipeline:** interested, discovery scheduled, qualified, proposal, negotiation, won/lost/nurture; recurring and project values separate.
10. **Settings:** source policies, provider capabilities, channel rules, templates, limits, access and audit.

Keep “estimated” visible in every budget label and export column. Do not mix marketing spend, agency fees, revenue, and project prices in one sortable money column.
