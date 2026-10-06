# Same-origin API — schema 1

Base: `http://<lan-address>:5191/api` on the approved trusted home LAN, or `http://127.0.0.1:5191/api` on the server. The socket-peer subnet and exact-host checks apply to the API and pages equally. No separately exposed agent endpoint. No direct database edits are needed for routine research updates.

Reads:

- `GET /workspace` → `{revision, workspace, today, access, version}`.
- `GET /export` → versioned complete JSON `{format:"investment-research", schemaVersion:1, exportedAt, workspace}`.
- `GET /health` → runtime availability and supported schema version.
- `GET /backups` → local backup filenames and sizes (no download route).

All POST requests require an Origin exactly matching the URL being used (`http://<lan-address>:5191` or `http://127.0.0.1:5191`), `Content-Type: application/json`, `X-Research-Request: 1`. Mutations/restore additionally require `If-Match: <revision from last read>`. Revisions are opaque random tokens; never predict/increment them. The maximum request body is 5 MB; workspace documents are limited to 4 MB so every saved workspace can be exported and restored within that request limit. The owner approved the trusted home LAN boundary without a login. Outside that boundary, protected authenticated HTTPS and a new access agreement are required. Cross-origin requests between the two allowed addresses are still rejected; serve the page and API from the same address.

`POST /actions` takes `{action, payload}` and returns the new `{revision,workspace}`. Server validation, immediate transactions, optimistic concurrency and history rules are shared by UI and programmatic writes.

| Action | Payload |
| --- | --- |
| `company.create` | Complete `companyInput` |
| `company.update` | Complete `companyInput` plus `companyId` (metadata/history are server-owned) |
| `company.archive` | `companyId`, `confirm:true` |
| `company.restore` | `companyId` |
| `evidence.add` | `companyId`, `note`, `source`, `asOfDate`, `author`, `supersedesId` |
| `snapshot.add` | `companyId` and complete `snapshotInput` |
| `scenario.add` | `companyId` and complete `scenarioInput` |
| `scenario.recalculate` | `companyId`, `scenarioId`; references latest snapshot by quote date, then entered time, and creates a new version with the old assumptions and target |
| `decision.add` | `companyId`, `action` (Research/Watch/Pass/Revisit), `date`, `rationale`, `evidenceIds`, `snapshotId`, `scenarioId`, `supersedesId` |

`companyInput`: ticker, name, exchange (blank if unverified), currency (ISO code or null), role, status (Researching/Watching/Passed), thesis, risks, disconfirming, reviewDate (YYYY-MM-DD or null), reviewTrigger. There is no hard-delete route.

`source`: `{title, url, publicationDate}`; title is required, URL is ordinary HTTP/HTTPS or null, date is YYYY-MM-DD or null. Unknown dates must not be replaced with the entry date.

`metric`: `{value, unit, currency, period, basis, source, kind}`. Value is finite number or null. Units are `currency/share` for price/EPS/target, `currency` for cash/debt/FCF, `percent` for growth/margin. Percent metrics have null currency; monetary metrics must match their snapshot currency. Kind is `Observed`, `Analyst estimate` or `User assumption`. Price must be positive. Sources, observation/estimate periods and bases are required for present metrics.

`snapshotInput`: quoteDate, quoteTime (HH:MM and optional timezone or blank if unknown), currency, shareBasis, price metric, forwardEPS, revenueGrowth, operatingMargin, debt, cash, freeCashFlow, analystTarget (each metric or null), supersedesId (earlier snapshot ID or null). Monetary quantities use full currency units, not scaled millions. Snapshot records are immutable; create a correction instead. The server adds ID, company ID, entered time and `Manual snapshot` provenance.

`scenarioInput`: referenceSnapshotId, referenceDate, targetDate, epsPeriod, basis, currency, shareBasis, rationale, bear/base/bull objects `{eps,pe,source}`, supersedesId. EPS and P/E allow null so incomplete assumptions can be saved; P/E must be positive when present. Nonpositive EPS yields unavailable earnings valuation. All three share period/date/currency/basis. Complete implied prices must be ordered bear ≤ base ≤ bull. Versions/created time/formula version are server-owned. Recalculation never modifies existing scenarios or decisions.

Decisions embed a full immutable copy of the company revision, selected evidence, snapshot, scenario, and calculated price returns with formula version 1. If a scenario is selected, its reference snapshot must be the decision's snapshot. Corrections are new records. Export validation checks these embedded copies against the preserved source versions and recalculated results.

`POST /restore/preview`: body is the export envelope. Returns `{digest, counts, revision}` after complete validation; it does not write. `POST /restore`: `{export:<same envelope>,digest:<preview digest>,confirmation:"REPLACE WORKSPACE"}` plus the preview revision in If-Match. Validation runs again; changed file/revision rejects; a verified pre-restore SQLite backup precedes atomic replacement. Stable IDs are retained; server revision is rotated to prevent stale clients from writing after restore. Merging is out of scope.

`POST /backup` with `{}`: online SQLite backup and integrity check; returns `{backup:<filename>}`. No revision needed because it does not edit research.

Errors: 400 invalid data; 403 access/origin blocked; 404 unknown resource; 409 conflict (reload, compare and explicitly reapply); 413 body too large; 500 unavailable save/backup. The client must keep drafts after any unsuccessful write. Do not retry a conflicting full company record blindly. For a proposed research update, fetch the record and revision, validate the proposed fields, apply only approved changes, send the complete resulting company input with If-Match, and inspect the returned state.

The executable schema definitions in `server/model.js` are authoritative and strict. JSON exports expose every documented field, so an agent can inspect the exact shape without ad hoc SQL.

## AI research (1.1.0)

All routes inherit the existing Host, peer-network, Origin and JSON mutation protections.

- `GET /api/research/status`: key-present status (never key), configured model, mandate revision, daily usage.
- `POST /api/research/settings`: `{horizonMonths, criteria, dailyLimit}`, with settings revision in `If-Match`.
- `POST /api/research/runs`: `{companyId, kind: "review"|"question"|"forward_eps", question?: string, metricRequest?: {currency: string|null, shareBasis: string, period: string}}` → 202 and persisted job. Request returns before provider work.
- `GET /api/research/runs?companyId=<uuid>`: latest 100 runs; omit companyId for inbox.
- `GET /api/research/runs/:id`: immutable captured context and completed content, status, source registry, usage and current-context comparison.
- `POST /api/research/runs/:id/cancel`: `{}`. Queued/running → cancelled, abort request, no late result publication.
- `POST /api/research/runs/:id/accept`: `{acknowledgeChanged?: boolean}` and current workspace `If-Match`. Adds evidence once; never adds a decision.
- `GET /api/research/export`: complete, read-only AI archive JSON (separate from workspace JSON).

Runs progress queued → running → completed/failed/cancelled. Queued/running runs found on service restart become interrupted; retry is a new, user-started run. Research notes and financial workspace do not change during provider work.

Forward EPS runs return a persisted `epsDraft` with nullable fields, validated source reference, missing fields and a `canFill` flag. They do not mutate snapshots. The user applies the draft to the form and submits the existing `snapshot.add` action.

## Sector analysis and financial snapshots (1.3.0)

All routes inherit the existing Host, peer-network, Origin and JSON mutation protections.

- `POST /api/research/runs` accepts two additional forms. `kind: "snapshot"` collects a standardized financial and market snapshot for the company (2 provider requests) and returns it as `snapshot` on the run. `kind: "review"` accepts `withSnapshot: true` to collect the snapshot first and pass it to the three review stages (5 provider requests). Assessments now include `catalysts` (cited paragraphs).
- `POST /api/research/analyses`: `{sector, seedCompanies?: string[], criteria?: string, maxCompanies?: 2–10}` → 202 and a persisted analysis. Counts as one daily run. Rejected while another analysis is queued or running (409), when the daily limit is reached (429), or without a server key (503).
- `GET /api/research/analyses`: newest first; sector, status, stage, companies with ratings, top pick.
- `GET /api/research/analyses/:id`: the complete analysis document: `input`, `mandate`, `phase` (`discovery` → `companies` → `comparison`), `status` (`queued`/`running`/`completed`/`failed`/`cancelled`/`interrupted`), live `stage`, `discovery` (sector definition, excluded candidates, unresolved seeds, sources), `companies[]` (each with `companyId`, `runId`, `status`, `report`, `snapshot`, `sources`, `error`), `comparison` (`registry` of shared sources `A1…`, `caveats`, `report` with `ranking[]`), `runs[]` summaries, aggregated `usage` and `progress`.
- `POST /api/research/analyses/:id/cancel`: `{}`. Cancels queued/running child runs; completed company research is kept.
- `GET /api/research/runs` inbox rows now include `analysisId`; sector-scoped runs (`discovery`, `comparison`) have `companyId: null` and use the sector name as `ticker`.
- `POST /api/research/settings` accepts `maxCompanies` (2–10, default 6).
- `GET /api/research/export` archive is `schemaVersion: 2` and adds `analyses`.

Financial snapshot document (`snapshot` on a run, `companies[].snapshot` on an analysis): `identity` (name, ticker, exchange, listing country, quote currency, reporting currency, fiscal year end, security type), `price` (value, currency, as-of date/time, source, age in days), `shares` (basic/diluted outstanding, date, basis), `marketCap` and `enterpriseValue` (sourced or `derived: true`), `financials` (period label/type/end date, accounting basis, currency, revenue, EBITDA, EBIT, net income, diluted EPS, operating cash flow, capex, free cash flow, total debt, cash), `growth`, `history[]`, `consensus` (forward EPS/revenue with periods, target price, date), `operatingMetrics[]`, `derived` (net debt, market cap/EV cross-checks, margins, multiples, historical growth) and `quality` (warnings, missing, price/period age, currency mismatch, scaled-unit suspicion, comparability, share basis used). Monetary values are full currency units. Only figures with a valid citation from the run's source registry are kept; everything in `derived` is computed by the server, never by the model.

## Workflow: intake, dispositions and the home overview (1.4.0)

All routes inherit the existing Host, peer-network, Origin and JSON mutation protections. Dispositions live in an additive `dispositions` table; the workspace document is still schema 1.

- `GET /api/workflow/overview` → `{today, companies[], counts, intakes[]}`. Each company entry joins the workspace record with its stored research: `listing` (exchange and currency, taken from the latest research snapshot when the record is blank, flagged `fromResearch`), `disposition` (`value` Research/Watch/Declined/Invested, `setBy` app/owner, `since`, `runId`, `rating`, `previous`, `note`, `invested`, `highlight` “Consider” when the app filed a Consider rating as Watch), `notice` (set when the owner's setting disagrees with a newer assessment: `suggested`, `rating`, `asOf`, `runId`, `text`), `assessment` (latest completed review: `runId`, `analysisId`, `asOf`, `rating`, `confidence`, `summary`, `model`, `sources`, `accepted`, `detail` with bull/bear cases, catalysts, invalidation triggers, missing evidence and next steps), `price` (the newer of the research-snapshot price and the latest manual snapshot, with `asOfDate`, `ageDays` and `source`), `figures` (market cap, multiples, margins, growth and data-quality counts from the latest research snapshot), `pending` (queued or running run), and counts of manual snapshots, scenarios and decisions. `counts` gives `main` (Watch + Invested), `watch`, `invested`, `research`, `declined`, `archived` and `researching`. `intakes` lists the latest intake runs.
- `POST /api/workflow/intake`: `{entries: string[]}` (1–10 names or tickers) → 202 and the intake run. Entries that already match a workspace ticker or name are recognized without a provider call. The run makes 2 provider requests (web search, structured extraction) for the remaining entries and counts as one daily run. When it completes, each verified listing is reused or created in the workspace with a provenance evidence note (author `Company intake`), filed as Research, and a snapshot-first review is queued for it (one daily run each; if the daily limit is reached the company is still added and the entry says research did not start). Ambiguous entries wait for the owner; unresolved entries and funds add nothing. Rejected without a server key (503) or at the daily limit (429).
- `GET /api/workflow/intakes` → `{intakes[]}`: `id`, `status`, `stage`, `createdAt`, `entries[]` (`query`, `status` pending/resolved/existing/ambiguous/unresolved/not_a_company, `match`, `candidates[]`, `notes`, `companyId`, `reviewRunId`, `outcome` research_queued/research_not_started/already_researched/dismissed/failed, `outcomeNote`).
- `POST /api/workflow/intake/:id/choose`: `{index, candidate}` picks one listing for an ambiguous entry (`candidate: null` dismisses it). The chosen company is added and researched as above. 409 once the entry has been decided.
- `POST /api/workflow/notes` (1.4.1): `{companyId}` fills the company's blank thesis, risks and disconfirming-evidence notes (and a blank exchange or currency) from its latest stored assessment, without a new run. 409 when no completed assessment exists. Returns the company's overview entry.
- `POST /api/workflow/dispositions`: `{companyId, disposition: "auto"|"Research"|"Watch"|"Declined"|"Invested", note?, invested?}`. `auto` releases the owner's setting and re-derives the disposition from the latest assessment. Any other value is an owner setting that stays until released; a later assessment that disagrees produces a `notice`, never a change. `Invested` requires `invested: {date, price, currency, amount?, quantity?, note?}`; the date cannot be in the future. The app never sets Invested. Returns the company's overview entry.

Automatic filing: when a `review` run completes with a report, the app maps its rating (Consider → Watch with a Consider highlight, Watch → Watch, Research further → Research, Pass → Declined; anything missing → Research, never Declined) and records a disposition row with the run id, the rating and the previous value, unless the owner's setting is in force. When a run completes, the app fills what is blank on the company record and never overwrites what the owner wrote: exchange and currency from the verified snapshot identity, and (1.4.1) the thesis from the assessment summary, risks from the bear case and disconfirming evidence from the invalidation triggers, each ending in an attribution line naming the assessment date and rating. This is one ordinary `company.update` revision, and the run's research fingerprint is re-stamped so the fill-in does not count as an owner change. Overview entries carry `notes: {thesis, risks, disconfirming}` booleans, and `pending` includes `createdAt` and `updatedAt` so clients can show elapsed time. On first start, companies without a disposition are backfilled from their latest stored assessment, otherwise from the legacy status (Researching → Research, Watching → Watch, Passed → Declined); the workspace is not written during backfill.
