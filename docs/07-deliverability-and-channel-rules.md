# 07 · Deliverability and channel rules

## What the system can control

It can improve relevance, verify business contact information, authenticate our mail, limit sending, honor opt-outs, and stop campaigns when delivery signals deteriorate. It cannot guarantee inbox placement, valid contact information forever, or that a recipient welcomes an unsolicited offer.

Collection permission, lawful marketing, provider permission, technical deliverability, and recipient interest are separate checks. Passing one does not pass the others.

## Contact quality pipeline

1. Prefer relevant public business contacts from the business itself or a licensed provider with usable provenance.
2. Parse and normalize addresses with an appropriate email library; check the domain and mail routing. A missing MX record goes to review rather than an overconfident universal “invalid” conclusion.
3. Avoid bulk email-pattern guessing. A contact finder may be evaluated only with source rights and verification; do not brute-force addresses or send test campaigns to guess which exist.
4. Use a specialist verifier only for contacts selected for near-term outreach. Save raw result, mapped result, date, cost, and expiry.
5. Default automated eligibility requires a recent `valid` result plus the other channel checks. Accept-all, unknown, blocked, unverified, and stale results stay out of automated sequences. Invalid/disposable results are blocked.
6. Review generic role inboxes for relevance. Exclude emergency, patient-care, abuse, privacy, and unrelated support addresses from sales campaigns. A public free-mail address can be a legitimate sole-trader business contact; handle it with the same provenance, provider, and eligibility review rather than blanket rejection.

Accept-all domains can accept nonexistent addresses, and verifiers cannot guarantee delivery. Our policy is deliberately more conservative than a vendor's confidence suggestion. [Hunter verification FAQ](https://help.hunter.io/en/articles/15899247-email-verification-faqs).

## Sender setup

Use a clearly branded domain or transparent subdomain, real named senders, a working website, and monitored replies. Separate client operations/transactional mail from prospecting infrastructure where practical, while recognizing reputation can cross subdomains and shared domains. Do not use deceptive lookalikes or disposable domain rotation.

Our baseline requires SPF, DKIM, DMARC alignment, TLS, and valid provider-managed DNS/PTR setup where applicable. Test authentication on messages received by independent test accounts; configure DMARC reporting and move toward enforcement after legitimate senders are inventoried. Marketing messages include a visible opt-out and standards-based one-click unsubscribe headers when supported. These are internal baseline requirements informed by [Gmail sender guidance](https://support.google.com/mail/answer/81126?hl=en), [Yahoo sender guidance](https://senders.yahooinc.com/best-practices/), and [Microsoft's Outlook sender requirements](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730).

Authentication and a good-looking email do not establish permission or ensure delivery. Test inboxes provide diagnostic evidence, not proof of general inbox placement. Recipient-specific filtering and reputation remain outside our control.

## Provider selection is a launch dependency

Do not assume Google Workspace, Microsoft 365, an SMTP API, or an outreach tool allows our intended unsolicited campaigns. Google Workspace's AUP restricts unsolicited mass email. Small batch sizes do not automatically resolve provider restrictions. [Current Workspace AUP](https://workspace.google.com/terms/use_policy/).

Before enabling an adapter, record the applicable policy/contract, allowed recipient acquisition method, message type, country, throughput, unsubscribe support, complaint visibility, inbound reply integration, and any required provider clearance. An intermediary's marketing claim does not override the underlying mailbox/transport rules. If the intended campaign is disallowed, keep it disabled and use permitted outreach, human calling, referrals, inbound marketing, or consent acquisition. Do not relabel prospecting mail as transactional mail.

## Volume and stop controls

Initial planning configuration: one legitimate sender, 5 reviewed prospecting emails/day in the first small pilot; only consider 10, then 20/day after healthy results and provider clearance. These numbers are internal experiment limits, not provider allowances or guaranteed-safe thresholds. Count first touches and follow-ups together; apply domain-wide and workspace-wide limits. Do not add mailboxes to evade enforcement or complaints. Fake engagement and automated warmup exchanges are excluded.

| Signal | Initial internal response |
| --- | --- |
| Any complaint in the small pilot | Pause and inspect targeting, permission, and content |
| Hard bounce | Suppress address immediately |
| Two hard bounces in a pilot batch, or rolling hard-bounce rate >=2% with at least 100 attempted messages | Pause affected source/campaign and investigate |
| Provider-reported spam rate >=0.1% | Pause prospecting and investigate; do not wait for 0.3% |
| Any provider warning, auth regression, or unusual block | Pause affected sender and fix before resuming |
| Reply/opt-out synchronization failure or stale provider connection | Pause dispatch until inbound state is current |

Google recommends staying below 0.1% user-reported spam and avoiding 0.3% or higher. Its Postmaster rate has a provider-specific denominator; our overall complaint count is not the same metric. Low-volume accounts may have no dashboard data, which means unknown, not zero complaints. [Gmail FAQ](https://support.google.com/mail/answer/14229414).

## U.S. commercial email baseline

The FTC's CAN-SPAM guide covers B2B commercial mail too. Use truthful sender information and subjects, clearly identify the commercial nature, include a valid physical postal address and an easy opt-out, and supervise vendors acting for us. Keep opt-out mechanisms functional for at least 30 days after a message and honor requests within 10 business days. [FTC guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).

Our implementation target is stronger: persist an opt-out on receipt, stop queued activity immediately, and propagate it to connected tools within 60 seconds under normal operation. Reply-based opt-outs and no-login web opt-outs both work. The one-click header endpoint uses an idempotent POST; link-scanner GET requests must not accidentally execute that header action.

## Calls and SMS

MVP calls are human initiated to identified business lines after screening and review of applicable federal, state, recipient-location, seller, and caller rules. Business-call exemptions are limited; a business listing can contain a personal mobile number. A general B2B label is not sufficient eligibility. Use a default 9 a.m.–5 p.m. recipient-local weekday window, narrowed by applicable requirements. Unknown time zone or number classification goes to review. Screen relevant DNC lists, including internal requests, and use an internal screening-refresh ceiling of 30 days or stricter rules where applicable. [FTC telemarketing guide](https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule).

Keep SMS disabled for scraped contacts. Enable future SMS only with documented channel-specific consent, an approved provider use case, required registration, working opt-outs, and applicable legal review. A public phone number or registration alone is not consent. No prerecorded/AI voice calls in this release. See [FCC consent guidance](https://docs.fcc.gov/public/attachments/DA-25-496A1.pdf), [Twilio messaging policy](https://www.twilio.com/en-us/legal/messaging-policy), and [A2P 10DLC documentation](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc).

## Privacy, deletion, and retention

Store business-relevant information, provenance, and only necessary professional contact information. Exclude patient information, private case details, home addresses used only personally, sensitive traits, and unrelated personal profiles. Assess applicable state privacy obligations, vendor contracts, and seller/caller jurisdiction before launch; foreign operation does not remove U.S. recipient requirements. Use the [CPPA applicability guidance](https://cppa.ca.gov/pdf/business_comply.pdf) as one review input, not a nationwide conclusion.

Provisional product defaults: raw website material up to 30 days if allowed, research evidence up to 90 days, unengaged lead review after 12 months, and minimal suppression records while needed to prevent recontact. Contractual source limits and applicable legal records duties override these defaults. Determine mandatory communication/consent record retention before activating each channel; do not apply a blanket 90-day deletion to those records.

For deletion requests, suppress first, then remove applicable contact data, evidence, derived scores, drafts, exports, and processor copies under a documented process. Retain only justified minimum restricted records where required or necessary to honor opt-outs. Use keyed normalized lookup tokens for suppression; backups have a defined expiry and restoration must replay deletions/suppressions. Never sell or export an opted-out address for fresh marketing.
