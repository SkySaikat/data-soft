# 13 · First-release implementation status

November 16, 2026 · Application v0.1.0

## Current milestone

A runnable, browser-based local lead workspace. The first milestone is database, business listing collection, filtering and selected analysis. The longer roadmap remains the target for subsequent releases.

| Feature | Current behavior |
| --- | --- |
| Lead storage | Actual SQLite database at `.data/data-soft.sqlite`, using Node's built-in SQLite API; data survives restart |
| Workspaces | 24 fictional sample records, isolated from live imports/collections |
| Dashboard | Search, state, city, industry, service flags, five estimated budget groups, qualification status, sorting and pagination |
| Business detail | Contacts, notes, evidence/source history, service flags, priority score, estimated and confirmed budgets |
| Confirmed budget | Explicit user entry with confirmation notes, recorder and timestamp, preserving an append-only history; no automatic inference |
| Manual leads | Add public/business research from the browser; unknown contact or budget is accepted |
| CSV | Import up to 1,000 rows/1.5 MB; downloadable template; invalid rows reject the batch; formula-safe export of filtered/selected records, up to 10,000 |
| Duplicate handling | Source record keys and normalized name/city/state/address; source history retained; shared domains do not force merges |
| Public directory | CMS NPPES organization search, state/city/name keyword, at most 50 records per run, explicit partial coverage |
| Generic directory | Permission-confirmed, robots-aware, one-page HTML JSON-LD business extraction, up to 100 entries, with a visible supported-format limit |
| Source library | Ready methods distinguished from candidates; BBB, Yellow Pages and chamber examples are not approved/enabled integrations |
| Research runs | Completed/partial/failed history, source, area, record counts and explanation |
| Local analysis | Deterministic research summary and template draft; explicit “not AI-generated” label; no model calls |
| Cloud AI | AI SDK 7/Gateway adapter, structured output, server-only secret, token limits, no retry, ledger reservations and monthly cap |
| Outreach | No email/SMS send, automated calls, form submission or social messages |

## Architectural choices for this milestone

The web/API layer follows the planned Next.js/TypeScript direction. PostgreSQL, Redis and browser workers would require additional services that are absent on this machine. SQLite makes the requested first slice immediately runnable, persistent and testable. The repository layer in `src/lib/db.ts` isolates persistence so a later PostgreSQL migration does not require rewriting the dashboard.

Current collection is bounded and synchronous. The browser waits for a small directory/API run; a global in-process lock prevents overlapping collections. There is no claim of durable background jobs or high-volume crawling yet. Redis/BullMQ workers, cancellation, pagination, retries, larger imports and geographic coverage cells are future work. Failed or capped runs stay visible as failed/partial.

Lead service flags come from manual/imported research. Fresh public-directory leads start with no established service needs and unknown budget. Estimated non-unknown bands require at least two distinct supplied evidence notes but remain unverified; this does not establish their independence or truth. Human review is still needed. The current priority score is a transparent prototype heuristic in `src/lib/domain.ts`, not a calibrated buying probability or the final 35/20/20/15/10 rubric. It rewards research completeness and service flags, not wealth or a minimum retainer.

## Directory formats and access

The generic listing connector supports HTML containing schema.org JSON-LD business records, including nested ItemList/graph structures. It extracts identity, category, locality, published website/email/phone when available and permitted, with source provenance. It does not scrape arbitrary visual directory layouts, execute JavaScript, paginate, or automatically visit each listed business's website yet. Other formats can be imported from an authorized CSV export.

The operator confirms directory access/reuse permission for each run. That attestation and robots checks do not replace a full contractual policy registry; formal policy versioning, terms snapshots, per-field rights and deletion propagation remain a later milestone. Selected restricted platform hosts are blocked by the public-page connector. A public page or source-library card is not bulk access permission.

The HTTP collector validates protocols/ports, rejects private/reserved network addresses, resolves and validates all addresses before connecting, pins the validated DNS answer for the request, revalidates redirects, bounds response sizes/timeouts, and constrains directory redirects to the reviewed origin. It does not carry logged-in browser sessions. Robots errors fail closed except a missing robots file; source permission is still independently required. Long crawl-delay requirements wait for a future background worker rather than being ignored.

## Run locally

```powershell
pnpm install
pnpm dev
```

Visit `http://127.0.0.1:3000`. The sidebar opens the lead explorer, collection screen, source library and AI studio. Choose sample/live using the top-right workspace selector. Manual additions, CSV imports and successful collection always target live records.

For a production-mode local server:

```powershell
pnpm build
pnpm start
```

During the initial build, a development server occupied port 3000, so the verified background production-mode app was launched at `http://127.0.0.1:3001/?workspace=live&view=leads`. Its process/port record is `.data/production-server.json`; output and error logs are `.data/production.log` and `.data/production-error.log`. To use that port manually, run `pnpm start --port 3001` after stopping the recorded process.

The server binds to `127.0.0.1`. This is a single-user local application, not a remotely deployed multi-tenant service. It rejects remote-host and cross-site API access; equivalent loopback hostnames on the same port are accepted because Next may canonicalize request URLs. Do not change its network binding or expose it with a tunnel until proper authentication, authorization and deployment controls are implemented.

The `.data` database, environment files, build outputs and dependencies are Git-ignored. Back up the SQLite file using a SQLite-aware backup while running, or stop the application before copying the database and associated WAL state. The sample/live boundary is a product data distinction, not a security boundary between users.

## Connect AI

Copy `.env.example` to `.env.local` and set:

```text
AI_GATEWAY_API_KEY=<server-only credential>
AI_MODEL=<current provider/model ID>
AI_INPUT_PRICE_PER_MILLION=<verified current USD input price>
AI_OUTPUT_PRICE_PER_MILLION=<verified current USD output price>
AI_MONTHLY_BUDGET_USD=25
```

Restart the server. Model discovery is available at `https://ai-gateway.vercel.sh/v1/models`; choose a current text model supporting structured output. No model is silently selected and no account/credential is created by this implementation.

On a lead's “Analysis & draft” tab, local mode stays available independently of cloud configuration. Cloud mode sends selected business research and minimal evidence, excluding contact email/phone, to the configured provider. Use it only for records whose source terms allow that processing. No tools, outbound messages, credential access or autonomous browsing are given to the model. Results remain human-review drafts and cannot alter budget confirmations or source records.

The ledger reserves an estimated upper cost before each request. Unknown failures retain the reservation; known token usage settles using configured rates. This is application-level estimated spend accounting, not a substitute for provider-enforced billing limits. Set a provider-side budget too. Incorrect prices, provider-specific charges and token accounting differences can make billed cost differ. Paid generation cannot be verified until valid credentials/model settings exist; absence of a key never triggers a paid request.

## Verification

`pnpm typecheck`, `pnpm test`, and `pnpm build` cover types, meaningful domain/data/security behavior and production compilation. The automated suite checks database persistence, duplicate resolution, source evidence, workspace isolation, combined filters, conservative budget rules and confirmation history, spending reservations, CSV validation/formula escaping, JSON-LD and NPPES mapping, private-network blocking, bounded request bodies and loopback/cross-origin behavior.

Browser verification checks the actual filter-to-API-to-database flow and the local-analysis/draft screen. Real public-directory availability can change; errors are shown instead of manufacturing successful results. The generic directory parser is verified with synthetic structured listing fixtures; no unapproved directory is scraped for a test.

Initial verification results: 18 automated tests passed, TypeScript passed, and the production build passed. The public directory flow returned 50 NPPES records and created 48 distinct live businesses; 24 fictional samples stayed separate. The first raw API sample also matched some mailing addresses, which is annotated in its run history. A correction now enforces requested practice geography; a second run retained 46 matching practice-location records from 50 responses and updated existing leads without creating duplicates. Public registry entries remain unverified sales leads, with unknown service needs and budget. The production-mode server reopened the database successfully; CSV export, local zero-credit analysis and sample-only confirmed-budget history were also exercised through the API.

## Next implementation priorities

1. Save editable research observations and service/budget hypotheses with explicit evidence review.
2. Add approved directory adapters for non-JSON-LD layouts, permissioned exports, pagination and a persistent source policy registry.
3. Add permitted first-party website enrichment and then isolated browser workers for dynamic pages.
4. Move collections into durable background jobs and add state/category/source coverage tracking.
5. Add specialist contact verification, suppression and reviewed outreach only after channel/provider gates are completed.
6. Add authentication, authorization and PostgreSQL before shared or remotely hosted access.
