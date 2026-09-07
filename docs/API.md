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
