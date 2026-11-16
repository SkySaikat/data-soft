# 10 · Operations, metrics, and launch

## Daily operating loop

1. Check inbound synchronization, opt-outs, complaints, bounces, provider warnings, source status and spending. Resolve stop conditions before new dispatch.
2. Run bounded discovery/refresh in selected coverage gaps. Review duplicate candidates and business identity failures.
3. Select accounts across industries and budget groups, including unknown; verify relevant business contacts for near-term activity.
4. Review evidence, offer fit and draft content. Use each prospect's local business hours for outreach and call tasks.
5. Respond to interested prospects promptly during staffed hours. Capture needs, authority, confirmed budget and timing.
6. Review pipeline and delivery capacity. Prepare relevant proposals and hand won work to a named owner.

Suggested initial daily time allocation: 20–30 minutes on data and system health, 60–90 minutes on research/review, and a dedicated block for calls, replies and discovery. These are staffing assumptions, not a claim that the entire process runs unattended.

## Metrics that matter

| Area | Measure |
| --- | --- |
| Coverage | Configured state/category cells searched, partial/blocked/stale cells, approved source coverage |
| Database | Raw imports, unique organizations, branches, duplicates, identity-review rate |
| Data quality | Business match accuracy, contact provenance, freshness, missing fields, reviewed extraction errors |
| Grouping | Service-fit coverage, unknown budget share, human overrides, confirmed-vs-estimated budget outcomes |
| Outreach readiness | Eligible contacts by channel; blocked reasons and stale verifications |
| Delivery | Attempted, provider accepted, hard/soft bounces, blocks, complaints, inbound sync lag |
| Engagement | Unique human replies, positive replies, opt-outs, relevant referrals |
| Sales | Booked/held/qualified meetings, proposals, wins, losses, time to close |
| Economics | Cash and fully loaded acquisition cost, recurring service revenue, one-time revenue, delivery margin, retention |

Provider acceptance is not inbox delivery. An inferred “delivered” count means accepted messages minus known failures and must be labeled as an estimate. Open rates are not a decision KPI; tracking pixels are off by default. Deduplicate auto-replies and count funnel outcomes by unique contact/account cohort. Report one-time projects separately from recurring revenue and exclude client media spend from agency revenue.

## Illustrative sales funnel

This is planning arithmetic, not an industry benchmark or forecast. Assume 1,000 unique contacts actually receive an initial message, one per independent account, and outcomes mature over the sales cycle.

| Step | Assumption | Expected count |
| --- | --- | --- |
| Unique human replies | 4% of contacted accounts | 40 |
| Positive replies | 1.5% of contacted accounts; subset of replies | 15 |
| Meetings booked | 1% of contacted accounts; subset of positives | 10 |
| Meetings held | 75% of booked | 7.5 |
| Qualified opportunities | 60% of held | 4.5 |
| Won clients | 20% of qualified | 0.9 |

Under those assumptions, three expected wins require about 3,334 contacted accounts over time. This is not a monthly target or a reason to force sending volume. With one sender capped at 20 campaign emails per business day and up to three emails/contact, steady-state capacity could be only about 6–7 new contacts/day, depending on replies and stops. Database growth and sending capacity must be planned separately.

Measure actual performance by industry, service offer, budget estimate/unknown group, evidence type, and channel. Do not cut a category based on a handful of emails. Price mix also matters: two $5k/month clients plus one $25k/month client represent $35k/month in recurring fees if those are the signed scopes, before expenses and churn; three website projects are not recurring revenue.

## Weekly decisions

- Which sources produce accurate unique businesses at a reasonable fully loaded cost?
- Which observations and offers lead to relevant conversations?
- Are low-budget or unknown accounts being unintentionally neglected?
- Which budget hypotheses are overstated or unsupported?
- What geography/category gaps remain, and is another approved source worth the effort?
- Can the agency deliver the work it is selling profitably and on time?

## Launch gates

Before external outreach, finish these concrete items:

- [ ] Agency identity, actual postal address, sender website, authorized proof, service scopes and proposal terms are configured.
- [ ] Each active source has documented permission, allowed fields/uses, retention, attribution and current review.
- [ ] The sending provider permits the intended acquisition method and campaign; authentication, unsubscribe, inbound events and limits are verified.
- [ ] Applicable email, privacy, calling, DNC, recording and retention rules are documented for each enabled channel and target jurisdiction.
- [ ] All required acceptance tests in document 09 pass, including suppression races and ambiguous send recovery.
- [ ] Our own recipient tests demonstrate real replies, opt-out processing and authenticated messages end to end.
- [ ] Daily/monthly caps, billing alerts, backup restore and global stop have been exercised.
- [ ] A person owns daily inbox monitoring and opt-outs; stale synchronization pauses dispatch.
- [ ] Pilot account sample, exact draft versions and chosen offers have been reviewed.
- [ ] SMS, recording and prerecorded/AI voice remain off unless their separate requirements are completed.

Research and internal exports can ship before these messaging gates, subject to source/privacy rules. Failed gates leave the relevant channel disabled and give a concrete reason in the dashboard.
