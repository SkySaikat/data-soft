# 08 · AI, automation, and operating costs

## Keep AI selective

Broad collection must not create an AI bill for every page and every business. The system remains useful with AI disabled: it can import, scrape permitted websites, deduplicate, classify obvious signals, score, filter, verify selected contacts, and prepare template drafts.

| Work | Default implementation | AI use |
| --- | --- | --- |
| State/category expansion and pagination | Versioned configuration and connector code | None |
| Downloads, HTML, public business contacts | API clients, parsers, structured data | None |
| Normalization and exact duplicates | Database constraints and rules | None |
| Ambiguous identity match | Rules plus human review | Optional suggestion only |
| Technical/site signals | Deterministic checks and reviewed observations | Optional interpretation of selected text |
| Service-fit and priority | Versioned rules | Optional explanation; cannot alter the stored evidence |
| Budget grouping | Conservative evidence rules, explicit unknown | Optional summary of evidence; cannot invent a budget |
| Email verification | Specialist verification provider | None |
| Drafting | Reviewed templates with facts | Optional rewriting for selected accounts |
| Scheduling, eligibility, opt-outs | Deterministic state machine | None |
| Reply interpretation | Pause on any reply first | Optional triage suggestion after the pause |
| Detailed proposals | Structured scope and price tables | Optional prose from reviewed discovery notes |

## Cost funnel

Import and deduplicate before paid enrichment. Extract useful website fields with ordinary requests before launching a browser. Research all permitted businesses as resources allow, but buy contact enrichment and use AI only when an account is selected for near-term outreach. Keep selection quotas across industries and all budget/unknown groups so larger businesses do not consume the whole research queue.

Planning example per 10,000 unique discovered accounts: up to 2,000 scheduled website checks in the current research window, perhaps 300 browser fallbacks, 200 selected contact verifications, and 100 personalized drafts. These are adjustable workload caps, not measured yield estimates. All 10,000 records remain searchable and later research windows can cover the rest.

Cache by source record/version, domain/content hash, contact verification time, and prompt/model version. Do not reuse stale verification or an expired source license. Recompute a budget estimate only when its evidence changes or expires.

## AI contract

Input: bounded allowed excerpts, evidence IDs, industry, selected service, verified business facts, and approved agency proof. Exclude unnecessary contact details, private data, credentials, and source fields not licensed for AI processing. Use a provider configuration appropriate for business data and contract requirements.

Output: schema-validated summary or draft, cited evidence IDs, uncertainty, and an `insufficient_evidence` option. Limit ordinary drafts to roughly 2,000 input and 250 output tokens; set a documented separate allowance for proposal sections. One bounded retry for invalid structure, then use a template or review queue. Log token usage and estimated/actual cost by task.

Treat scraped text as untrusted input, including instructions embedded in web pages. It cannot change the system prompt, policy, budget caps, source permissions, or tools. AI has no ability to send messages, alter suppression, change provider settings, or browse arbitrary URLs from this task. Unsupported claims, invented proof, unresolved variables, or references to guessed private business finances fail draft validation.

## Planning budget

The owner requested broad lead coverage regardless of prospect budget. That does not remove the earlier requirement to avoid wasting AI credits. These operating envelopes are planning assumptions, not current vendor quotes or authorized purchases.

| Item | Lean monthly planning allowance, USD |
| --- | --- |
| Web and worker hosting | $30–$100 |
| PostgreSQL | $0–$40 |
| Redis/queue hosting | $0–$20 |
| Private object storage | $0–$10 |
| Legitimate sender account and domain allocation | $10–$40 |
| Licensed source/search allowance | $0–$150; enterprise licensing can exceed this substantially |
| Selected contact verification | $10–$50 |
| Selective AI | $5–$25 |
| Monitoring | $0–$10 |
| Human calling provider allowance | $10–$40 |
| **Illustrative total** | **$65–$485/month** |

Exclude engineering time, salesperson time, legal/provider review, agency fulfillment, advertising, and large data licenses from that total. A public-data-only start reduces licensing spend but increases coverage gaps and connector effort. Vendor procurement must use fresh official quotes and the necessary rights; do not promise national completeness at this budget.

Suggested initial configuration: $600/month overall tool ceiling, $25/month AI ceiling, and separate daily provider quotas. The owner can change these before build/launch. Unused budget is not a reason to spend it. Enterprise source access or materially larger workloads require a new cost preview.

## Metering and stop behavior

Reserve maximum expected cost transactionally before each paid job. Settle actual cost afterward and release unused reservation. Aggregate by workspace, day, month, source and model. Block new jobs at the configured cap; alert at 80%. Fail closed if usage cannot be measured. Concurrent workers must share the same reservations so each cannot spend the full allowance independently.

Track cost per imported business, per unique account, per verified outreach-ready contact, per held qualified meeting, and per acquired client. Separate AI spend from verification, browser compute, source license, and human labor.

For transparent AI planning:

```text
draft_cost = input_tokens / 1,000,000 * configured_input_price
           + output_tokens / 1,000,000 * configured_output_price
total_cost = all tasks + allowed retries + any provider-specific charges
```

For example, 100 drafts at 2,000 input and 250 output tokens consume 200,000 input and 25,000 output tokens before retries. Apply the selected provider's verified prices at implementation time; no assumed rate here is a live model quote.
