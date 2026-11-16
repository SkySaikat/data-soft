# 09 · Build roadmap and acceptance

## Delivery approach

Ship a useful research/export product before enabling external outreach. Estimates below assume one experienced developer and a responsive agency owner. Roughly 4–6 weeks may be reasonable for a bounded internal MVP; source licensing, connector complexity, provider clearance, and legal/channel configuration can extend it. Nationwide depth is an ongoing expansion program, not a six-week completeness promise.

## Phase 0: decisions and fixtures · 1–2 development days

- Confirm agency identity, real sender details, postal address, service catalog, portfolio proof and delivery capacity.
- Seed all 50 states plus D.C., initial industry taxonomy, budget groups and explicit unknown values.
- Inventory source policies; verify initial TDLR, DBPR, healthcare and licensed/permissioned discovery paths.
- Catalog public business listing sites, chamber member directories, city/downtown directories and trade/professional directories. Review at least one directory candidate for the pilot; see [document 12](12-local-business-listings.md).
- Create synthetic fixtures for six pilot industries and examples of branches, sole proprietors, shared domains and duplicate source records.
- Record provisional spending limits and source/AI/privacy constraints.

Exit: approved internal configuration and fixtures. Missing email provider or agency address blocks sending later, not research product development.

## Phase 1: searchable database · 3–5 days

- Scaffold dashboard, database migrations, authentication, roles, local services and fake providers.
- Build organization/location/contact models, provenance, manual CSV import with field mapping, merge review, and audited export.
- Add industry/geography filters, service groups, unknown budget view, confirmed-budget form and basic pipeline.

Exit: import at least 1,000 synthetic/permitted records; re-import creates no duplicate source identities; all score/budget states remain filterable; exports obey source restrictions and omit suppressed outreach contacts.

## Phase 2: discovery and website collection · 4–6 days

- Build policy registry, coverage cells, preview, worker queues, spending reservations and run checkpoints.
- Implement initial official-file connectors and one permitted broad discovery path when available.
- Implement a directory adapter with listing/detail extraction, source-specific pagination/export support and business-website handoff. Run at least one approved real directory in the pilot; if no candidate is approved, deliver/test the capability on synthetic fixtures and record the live-directory pilot gate as incomplete.
- Add identity matching, bounded HTTP extraction and isolated browser fallback.
- Track partial results, blocked sources, missing websites and uncertain business matches.

Exit: a pilot across six industries in selected Texas/Florida areas produces attributable records or explicit documented gaps. Every collected field links to a source; run restarts do not multiply records; disallowed/expired sources cannot run; browser/network restrictions hold.

Directory pilot gate: an approved listing source successfully supplies attributable business records and website handoffs. Synthetic tests establish adapter behavior but do not establish live-source coverage; record that distinction explicitly.

## Phase 3: useful grouping and drafts · 3–5 days

- Implement versioned service affinity, priority rules, budget estimates and evidence display.
- Add selected contact verification and freshness controls.
- Build template drafts, optional AI summaries/drafts, schema validation and exact-version review.
- Keep low-budget and unknown-budget accounts in research and outreach selection.

Exit: human review of 100 varied records confirms useful classifications and exposes errors. Unsupported budget estimates become unknown. AI-off mode still completes discovery, grouping, verification and template drafting.

## Phase 4: safe outreach and calling tasks · 4–6 days

- Select a transport/provider that permits the intended use and has the needed inbound/stop capabilities.
- Add sequences, dispatch locks, final eligibility checks, outbox, provider reconciliation, authenticated webhooks and inbound recovery.
- Implement central suppression, body opt-out, one-click headers, campaign/global stop switches and complaint controls.
- Add human call tasks with recipient time zone and applicable screening rules. Keep SMS and recorded/AI calling off.

Exit: the complete flow passes with fake providers and our own test recipients. External prospecting remains disabled until the [launch checklist](10-operations-metrics-and-launch.md) passes.

## Phase 5: measured pilot and expansion · ongoing

- Begin with a small reviewed account sample distributed across industries and budget/unknown groups.
- Evaluate real replies, qualification, confirmed budget and record accuracy before raising volumes.
- Add sources/state coverage based on measured gaps and cost.
- Improve proposal generation and delivery handoff using actual discovery calls.

Exit for scaling: stable data quality, working stop behavior, permitted healthy delivery, and enough relevant conversations to justify more volume. A large scrape count alone is insufficient.

## Prioritized implementation backlog

| ID | Priority | Deliverable | Dependency |
| --- | --- | --- | --- |
| DS-01 | P0 | Schema, authentication and access boundaries | Phase 0 configuration |
| DS-02 | P0 | Source registry and field provenance | DS-01 |
| DS-03 | P0 | Import, identity matching and merge review | DS-02 |
| DS-04 | P0 | Explorer, broad category/geography filters and exports | DS-03 |
| DS-05 | P0 | Durable jobs, outbox, run caps and spend ledger | DS-01 |
| DS-06 | P0 | Official-file connectors and coverage ledger | DS-02, DS-05 |
| DS-07 | P0 | Bounded website fetch and browser isolation | DS-02, DS-05 |
| DS-08 | P0 | Service scores, budget hypotheses and confirmations | DS-03, DS-07 |
| DS-09 | P0 | Verification and independent channel eligibility | DS-03, provider selection |
| DS-10 | P0 | Template drafts, evidence and reviewed versions | DS-08 |
| DS-11 | P0 | Suppression, unsubscribe and stop controls | DS-01, DS-05 |
| DS-12 | P0 | Provider dispatch, reply sync and reconciliation | DS-09, DS-10, DS-11 |
| DS-13 | P0 | Human calling queue and rule configuration | DS-09, DS-11 |
| DS-14 | P0 | Opportunities, confirmed scope, reviewed proposals | DS-04, DS-10 |
| DS-15 | P1 | Selective AI adapter and evaluation | DS-10 |
| DS-16 | P1 | Delivery/coverage/sales metrics and alerts | DS-06, DS-12, DS-14 |
| DS-17 | P1 | More approved sources, categories and states | Pilot findings |
| DS-18 | P2 | External CRM integration and consented SMS | Proven need, permitted provider and channel setup |
| DS-19 | P0 | Directory catalog, listing/detail adapter, business-website handoff and approved-directory pilot | DS-02, DS-03, DS-05; source approval |

## Required meaningful acceptance tests

Use synthetic records and fake transport for automation; use our own recipients for live provider checks. Do not use real prospects as test fixtures.

1. **Broad inclusion:** a solo electrician, a doctor with unknown revenue, a real estate agent, a small restaurant and a regional law firm all enter the database. No revenue/retainer filter rejects them.
2. **Independent boxes:** high service-fit/unknown budget and low service-fit/high estimated budget both display correctly; nothing labels a score as purchase probability.
3. **Evidence:** an unsupported location/revenue/budget claim fails validation; confirmed prospect budget retains its source and does not overwrite estimate history.
4. **Identity:** a repeated source import is idempotent; unrelated branches/operators on one domain are not automatically merged; a reviewed merge preserves history and restrictions.
5. **Source controls:** unknown/expired permissions block collection; disallowed fields cannot enter AI or exports; removal invalidates dependent drafts and estimates.
6. **Crawler limits:** robots denial, 403, 429 and login pages behave correctly; private-IP redirects, IPv6 local targets, DNS rebinding and browser subresources cannot reach internal services.
7. **Budget controls:** concurrent jobs cannot exceed a shared paid limit; AI-disabled mode works; stale cache does not bypass source/verification expiry.
8. **Verification:** invalid, catch-all, unknown and stale contacts cannot enter automated email dispatch under default policy.
9. **Last-moment stop:** an unsubscribe arriving after scheduling but before dispatch prevents the provider call, including through a second campaign/import.
10. **Replies and sync:** a reply stops follow-ups before classification; inbound sync outage pauses sending; webhook replay/out-of-order events do not reopen a stopped sequence.
11. **Ambiguous delivery:** simulate a timeout after provider acceptance; retries reconcile or require review and do not send a duplicate automatically.
12. **Content integrity:** an edit invalidates review; unresolved placeholders, false threading, missing address/disclosure or broken opt-out block dispatch.
13. **Global control:** stop switch halts all pending sends; opt-out survives restart and backup restoration; no new mailbox/campaign bypasses it.
14. **Channel separation:** a public phone number without consent cannot receive SMS; an unscreened/unknown-time-zone number cannot become an eligible call task.
15. **Recovery and access:** restore a backup, replay suppression/deletion changes, and prove unauthorized roles cannot read/export another workspace or retrieve secrets.
16. **Directory-to-website flow:** approved listing records produce traceable leads; permitted website enrichment adds separate evidence; a duplicate from another directory updates the same business; missing websites/emails do not drop leads; capped pagination stays partial; the flow works with all Google discovery integrations disabled.

Benchmark representative imports and browser jobs before assigning production throughput. Record memory, latency, error rates and dollar cost; no unmeasured “millions of leads per day” target belongs in the release promise.
