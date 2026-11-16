# 11 · Research, assumptions, and decisions

## Research status

Official references checked November 16, 2026. Recheck relevant source terms, contracts, provider policies, legal requirements and pricing before implementation procurement or activation. This is an engineering and operating plan, not a jurisdiction-specific legal opinion.

| Topic | Primary reference | Planning implication |
| --- | --- | --- |
| Google Maps | [Platform terms](https://cloud.google.com/maps-platform/terms) | Exclude bulk CRM harvesting; see source plan for details |
| Texas licensing | [Official file download page](https://www.tdlr.texas.gov/LicenseSearch/licfile.asp) | Initial public-record connector candidate; validate file schema and uses |
| Florida construction | [Public records](https://www2.myfloridalicense.com/construction-industry/public-records/), [disclaimer](https://www2.myfloridalicense.com/public-records-read-medisclaimer/) | Parse documented files/status; confirm business identity |
| Healthcare discovery | [CMS NPPES dissemination](https://www.cms.gov/medicare/regulations-guidance/administrative-simplification/data-dissemination) | Official API/download path; practice business data only |
| Broad licensed coverage | [Data Axle APIs](https://www.data-axle.com/data-solutions/apis/) | Procurement candidate; no license or quote obtained |
| Commercial email | [FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) | Requirements summarized in channel rules |
| Calling | [FTC telemarketing guide](https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule), [FCC consent clarification](https://docs.fcc.gov/public/attachments/DA-25-496A1.pdf) | Configure actual use-case/jurisdiction rules before activation |
| Gmail receiving requirements | [Sender guidelines](https://support.google.com/mail/answer/81126?hl=en), [FAQ](https://support.google.com/mail/answer/14229414) | Authentication and complaint controls; no inbox guarantee |
| Yahoo receiving requirements | [Sender practices](https://senders.yahooinc.com/best-practices/) | Include in provider launch review |
| Outlook receiving requirements | [Microsoft sender requirements](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730) | Include in authentication/recipient testing |
| Sending-service restrictions | [Google Workspace AUP](https://workspace.google.com/terms/use_policy/) | Do not assume transport permits unsolicited campaigns |
| Contact verification | [Hunter verification FAQ](https://help.hunter.io/en/articles/15899247-email-verification-faqs) | Treat verifier output as time-bound technical evidence |
| Future SMS | [Twilio policy](https://www.twilio.com/en-us/legal/messaging-policy), [10DLC](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc) | Separate consent and provider registration workflow |
| Privacy applicability | [CPPA business guide](https://cppa.ca.gov/pdf/business_comply.pdf) | Review applicable obligations rather than assume public data is unrestricted |
| Technical tools | [Next.js](https://nextjs.org/docs), [BullMQ](https://docs.bullmq.io/), [Cheerio](https://cheerio.js.org/docs/intro/), [Playwright](https://playwright.dev/docs/intro) | Proposed stack; pin versions and verify contracts during build |

Some research paths returned fetch errors or rate limits; no blocked endpoint is a required runtime dependency. The final linked Data Axle API page was discoverable after an older business-data path failed. Yahoo's best-practices page appeared in search results, while a subsequent direct fetch was rate-limited; re-open its full current requirements at provider setup. No source contract, export license, or sending authorization has been purchased or established by this research.

## Accepted product decisions

- Broad local-business collection across U.S. industries; no minimum revenue, fee, or business-size filter.
- Separate service-fit priority, estimated budget, confirmed budget, and channel eligibility.
- Keep all five budget groups, including unknown; allow smaller one-time and recurring offers.
- Prefer deterministic collection and processing; selectively use AI for bounded tasks.
- Use permitted official/licensed sources and business websites; no reliance on restricted Maps harvesting.
- Ship internal research/export before messaging activation; future SMS requires its own consent workflow.

## Assumptions to validate

State rollout order, score weights, budget mapping, package prices, workload caps, funnel percentages, staffing and timeline are proposed starting points. None is a measured performance claim. Software operating allowances are estimates, not vendor quotations. No fact discovered in public sources can establish a private business's willingness to buy.

## Implementation decisions still open

| Decision | Practical default | When it must be resolved |
| --- | --- | --- |
| Agency brand, address and proof | Configuration placeholders only | Before real drafts can be dispatched |
| Broad business dataset | Trial/sample plus rights review; public-data paths remain usable | Before enabling that connector |
| Additional profession/state sources | Verify actual bulk access and permissions individually | Before promising coverage in those cells |
| Email transport | Adapter disabled/fake until permitted provider selected | Before external email |
| Calling service and rules | Human tasks only, no recording | Before calling from the platform |
| AI provider/model | Replaceable, hard caps, template fallback | Before paid model calls |
| Hosting and purchased services | Local development first, measured resource needs | Before deployment/procurement |
| Mandatory records retention | Applicable-law/contract policy alongside product defaults | Before relevant channel activation |
| Final service pricing and staff | Scope and margin review; separate media | Before quoting a binding proposal |

These are configuration/procurement decisions for implementation, not unanswered questions that prevent completing this planning package.
