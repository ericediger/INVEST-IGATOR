# Verification — Investment Research 1.0.0

September 6, 2026. All numerical examples below are synthetic fixtures in disposable test databases, never seeded into the user workspace.

## Automated data/API checks

`npm test`: 15 tests passed, 0 failed.

- Exactly ETN, VRT, NVT, APH, PWR, FIX and ANET; no prices/scenarios/returns; seed setup does not reset edited research.
- Company create/edit/archive/restore, confirmation, retained revision history.
- SQLite close/reopen preserves the complete workspace and saved note. A separate integration test saves a note through HTTP, terminates the Node server process, restarts it against the same disposable data directory, and verifies the exact saved workspace and revision.
- $100 reference → bear $60/−40%, base $100/0%, bull $150/+50%; independent $130 analyst target/+30%.
- Missing/zero/negative EPS → unavailable P/E. Negative earnings and FCF valid; finite/positive/currency/unit/date/period validation enforced.
- Incomplete/nonpositive EPS scenario chart unavailable; inconsistent currencies/share bases and unordered complete comparisons rejected.
- Existing decisions and scenarios unchanged after newer prices/research; explicit recalculation appends a version.
- Conflicting revision rejected; restoration rotates the revision to prevent stale pre-restore writes.
- JSON roundtrip into a separate database preserves every record, ID, relationship and decision basis.
- Unsupported/malformed exports, duplicate/invalid IDs, invalid relationships, tampered decision calculations and executable URLs leave current records unchanged.
- Verified pre-restore backup recovers the exact prior workspace; simulated backup failure aborts replacement.
- SQLite online backup restored separately, integrity checked and compared with the source.
- Empty restored workspace stays empty after restart; newer database schema rejected by old code.
- HTTP tests exercise two independent clients, stale writes, Host and cross-site protections on both pages and APIs, unsafe mutation origins, protected non-static data/source paths, malformed/oversized imports, CSP and framing protection.

`npm run build`: passed. Production consists of syntax-checked native ES modules and static assets; no TypeScript or bundler is used.

Dependency installation via `npm ci`: passed. Audit at installation: 0 vulnerabilities. Express 4.22.2; the query-parser transitive dependency is pinned to its patched 6.16.0 release. Existing unrelated applications are unchanged.

## Browser checks

Pending. Built-in browser tool reported “No browser is available.” Explicit permission to use a separate Playwright browser was requested. Desktop/mobile, keyboard, 200% zoom, browser draft preservation, screenshots and browser console inspection are not yet claimed as verified.

## Installed-service checks

Passed against the installed release:

- HTTP workspace endpoint returned exactly the seven seeded companies, with no snapshots, scenarios or decisions.
- `launchctl kickstart -k` restarted only the app service; workspace and optimistic revision remained identical.
- The installed scheduled-backup job ran successfully on demand.
- Its SQLite backup restored into a new disposable directory using the documented `restore-database.js` command; integrity and workspace equality checks passed.
- Listener inspection confirmed `127.0.0.1:5191`, with no LAN/all-interface binding.
- Both LaunchAgent property lists passed `plutil -lint` and were bootstrapped successfully.

Installed URL: http://127.0.0.1:5191

Backup verified: `backup-2026-09-06T22-09-41-041Z-427dfe87-aa11-4f10-a94a-6b908ba8fe07.sqlite` in the documented persistent backups directory.

Browser acceptance remains the only uncompleted verification area; do not describe desktop/mobile/keyboard/zoom checks or screenshots as passed until the alternate-browser approval is received and those checks run.

## Release 1.0.1 — home-network access verification

Production syntax checks passed; **18 tests passed, 0 failed**. The expanded test suite covers explicit private-network configuration, rejection of public/all-interface/mismatched subnet settings, exact Host and peer-subnet allowlists, LAN-origin page/API reads and saving, shared data through both supported addresses, forged forwarding headers and cross-origin write rejection. Installed release 1.0.1 was verified through both http://<lan-address>:5191 and http://127.0.0.1:5191. The LAN page and API returned successfully, and the complete saved workspace matched its pre-update state. Listener inspection confirmed exactly those two IPv4 bindings on port 5191. A pre-update database backup was created and release 1.0.0 plus its prior service configuration were retained. The existing macOS firewall was found disabled; no firewall setting was changed. The earlier browser-tool limitation remains unchanged.

## Release 1.1.0 — AI research implementation

September 7, 2026 UTC. **32 tests passed, 0 failed** after a clean locked-dependency installation. The initial sandboxed run could not open temporary loopback servers; all tests subsequently passed with local-network execution allowed. `npm run build` and `git diff --check` passed. The dependency audit reported zero vulnerabilities; runtime dependency versions are unchanged.

New checks cover:

- Three-stage evidence → counterevidence → structured recommendation orchestration with source registries and per-stage reported usage.
- Missing API key, daily usage limits, settings conflicts, duplicate pending runs and bounded provider requests.
- Source-reference validation and the recent-price/complete-scenario prerequisite for a Consider recommendation.
- Persistent company-specific conversations and absence of cross-company history in another company's requests.
- Reviewed evidence acceptance, changed-context acknowledgment, optimistic conflicts and idempotent acceptance; no automatic decision mutations.
- Cancellation and rejection of late results, malformed/provider errors without automatic retry, and restart interruption without duplicate paid calls.
- AI tables and acceptance mappings included in SQLite backup, archived history after workspace-only replacement, and orphaned-company acceptance rejection.
- Server-only API key handling, file permissions, source URL filtering, clickable citation conversion, request contract and HTTP access protections.

A consistent online copy of the installed database was created in a disposable directory. Initializing AI tables preserved the exact workspace and revision. A subsequent SQLite backup included the new tables and passed integrity checks. Production was not modified by this verification.

**Browser acceptance passed after the user authorized an alternative browser.** Eleven checks passed in an isolated headless Chrome session using a disposable test server and synthetic provider. Desktop (1440×1000), mobile (390×844), and a 720×500 CSS viewport equivalent to a 200% desktop layout had no horizontal overflow. Verified mounted panel navigation, per-company question drafts, completed cited assessments, saved basis, evidence acceptance preserving an unsaved main form, inbox/history after reload, source-link rendering and HTML escaping, settings conflict handling, Escape focus return, and absence of JavaScript errors. Screenshots were visually inspected. This is viewport emulation, not a claim of a physical mobile-device test or native browser zoom. Results and screenshots are under `verification/browser/`; rerun with `node tests/browser-research.mjs` after installing Playwright in a temporary directory (override `PLAYWRIGHT_MODULE_PATH` if necessary). The test uses the locally installed Google Chrome binary and never calls OpenAI.

**Live provider test:** not run. No OpenAI API key was present in the current environment or installed service configuration. Synthetic provider fixtures establish workflow behavior, not real-model research quality or account access.

The source is prepared and browser-verified as 1.1.0. Release activation is verified separately below. `scripts/upgrade-ai.py` creates a new release, backs up the installed database before switching, verifies workspace equality and research availability afterward, and reverts the application symlink if activation verification fails. The private key setup launcher is created during activation.

### Installed release verification

Release **1.1.0** was activated on September 7, 2026 UTC. The original 1.0.1 release remains available for application rollback. The complete saved workspace and its optimistic revision matched before and after activation. New AI tables were added without modifying existing research records.

Pre-upgrade backup: `backup-2026-09-07T03-05-20-603Z-996369d2-44ff-4b83-b0d9-f8348559c161.sqlite`.
Post-upgrade backup: `backup-2026-09-07T03-05-28-052Z-ee15b392-cf54-445e-bf0d-4c8d8efd7751.sqlite`.

Both existing addresses, `http://127.0.0.1:5191` and `http://<lan-address>:5191`, served version 1.1.0 and the research endpoints. An isolated browser session verified the installed setup prompt and empty research inbox with no JavaScript errors. Research controls are disabled because no API key is configured. No paid provider call or production research run was made. The key-setup launcher was created in the installed app folder and passed shell syntax validation. `verification/installed-ai.json` records the installed checks.


## Release 1.2.0 — agent-assisted Forward EPS

37 automated tests passed after adding EPS draft validation and two-stage provider orchestration checks. 15 browser checks passed, covering the new research action, complete field filling, preserving unrelated form data, unknown publication dates, currency conflict rejection, cancellation of replacement, normal snapshot saving, and a deliberate late-poll regression for history selection. The workspace/database schema and existing saved financial records are unchanged.

A bounded live integration check used public Eaton seed information in a disposable database with the configured OpenAI key. Two Responses requests succeeded, returning model `gpt-5.4-2026-03-05`. The lookup returned a sourced fiscal-year analyst estimate while leaving accounting basis, share basis and publication date unknown. The local validator was then adjusted to allow partial field filling with explicit missing-metadata warnings; the recorded live response was revalidated locally without another API call. This confirms actual provider access and extraction, not comprehensive financial-data accuracy. No production notes or financial records were changed by the live test. See `verification/live-eps.json`.

The requested model migration sets `gpt-6-astra` and explicit `reasoning.effort: "medium"` on every Responses request. Status and saved runs record the effort; historical runs retain their original model metadata. All 38 automated tests and source syntax checks passed, including search and structured-extraction request contracts. Official compatibility guidance: https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra.

A fresh live EPS run completed both web research and structured extraction using `gpt-6-astra` with `medium` reasoning, confirmed in both provider responses. It produced a fillable cited estimate with a publication date, leaving unsupported accounting/share-basis metadata unknown. The test used only seeded public company data and a disposable database; production records were not modified. Results: `verification/live-eps-gpt-6-astra.json`.

Release 1.2.0 was activated successfully on September 7, 2026 UTC. The first activation rolled back because one evidence note was saved during installation; no data was reverted. After comparing that difference and verifying the staged runtime files, activation was retried against the current workspace. Exact workspace/revision equality passed, including the new note. Pre-upgrade backup: `backup-2026-09-07T03-44-55-190Z-ae2aadc8-83a9-478b-ae24-78211cac3129.sqlite`. Post-upgrade backup: `backup-2026-09-07T03-44-56-349Z-fd461d61-3f23-4af6-9983-594883874f98.sqlite`.

Final verification: all 38 automated tests, 15 isolated browser checks, source syntax checks, and installed browser checks passed. Both configured addresses serve 1.2.0 and report `gpt-6-astra` / `medium`. The installed panel displays the model and effort, and the Forward EPS research action is present. Installed verification did not start paid research. See `verification/installed-ai-1.2.0.json`.

## Release 1.3.0 — automated sector analysis, financial snapshots and dashboard

September 13, 2026. **51 automated tests passed, 0 failed** (`npm test`), including 13 new tests in `tests/financial-snapshot.test.js` and `tests/sector-analysis.test.js`; `npm run build` syntax checks passed. All fixtures are synthetic and labeled; no real market data is embedded in tests.

New automated coverage:

- Snapshot normalization: local derivation of net debt, market cap (price × basic shares, basis recorded), enterprise value, margins, growth/CAGR and multiples; cross-currency price/statement mixes block multiples but keep margins; suspected scaled units, uncited values, stale prices, future dates and old consensus are flagged or discarded; sourced market cap/EV cross-checked against derived values; invalid drafts rejected; empty drafts produce an all-missing, non-comparable snapshot.
- Orchestration end to end with a synthetic provider: sector request → discovery (seed retained even when the model drops it, ticker case normalized, unusable/duplicate/overflow candidates excluded) → workspace companies reused or created with provenance evidence → snapshot-first company reviews → ranked comparison; exactly 2 + 5 × companies + 1 provider requests; Consider gating on fresh app-collected prices in both the company assessment and the ranking; omitted companies appended; citation remapping onto the shared registry; traceability from ranking entries to company runs; inbox and archive exposure; one daily run per analysis.
- Concurrency (two company runs in flight with the default, one with concurrency 1), stopping an analysis (child runs cancelled, comparison never started), restart interruption with completed company research preserved, provider failures failing the analysis without retry, duplicate active analysis rejection, daily-limit accounting, standalone snapshot runs and snapshot-first reviews, validator edge cases, and HTTP routes with the existing origin protections.

**Browser acceptance: 18 checks passed** in isolated headless Chrome against the synthetic fixture service (`node tests/browser-research.mjs`, Playwright installed in a temporary directory via `PLAYWRIGHT_MODULE_PATH`). The 15 earlier checks still pass with snapshot-first reviews; three new checks cover starting a sector analysis from the form (request estimate shown), the dashboard rendering ranked recommendations, snapshot/valuation/growth tables and the bar comparison after completion, discovered companies added to the workspace with provenance, drill-down opening the company research with its snapshot and catalysts in the assistant, analysis history and inbox links, and no horizontal overflow at 1440×1000 and 390×844. A mobile overflow found during this pass (the chart-metric picker) was fixed before the final run. Screenshots: `verification/browser/sector-dashboard.png`, `verification/browser/mobile-sector-dashboard.png`.

**Database compatibility:** today's scheduled production backup was restored into a disposable directory with `scripts/restore-database.js` and served by the 1.3.0 code on port 5192. The workspace (7 companies), both existing completed research runs and their reports loaded unchanged; the `analysis_id` column and `ai_analyses` table were added in place; status, inbox, export (archive schema 2) and static assets responded correctly; the process stopped cleanly. Production was not modified.

**Live provider checks (bounded, disposable database, production untouched):** `scripts/verify-live-sector.mjs` ran against the configured key with `gpt-6-astra` / `medium` reasoning.

- Run 1 (4 requests, `verification/live-sector-gpt-6-astra.json`): sector discovery for “European defense” seeded with “Rheinmetall” completed and selected five primary listings (RHM, BA., HAG, LDO, HO) with a sector definition, dated market-cap sources and an exclusion list. It exposed three defects that were fixed and covered by new tests: the Eaton snapshot failed because the model returned 35 operating metrics against a hard cap of 12 (model output is now bounded with a recorded warning instead of failing the run); “Rheinmetall” was reported unresolved although “Rheinmetall AG” was selected as the seed (seeds now match by partial name); and Saab was dropped because its Stockholm share-class ticker “SAAB B” contains a space (now normalized to SAAB-B).
- Run 2 (2 requests): the Eaton snapshot completed and was comparable (price USD 425.37 as of 2026-09-11, basic shares 388.4m from the 10-Q, sourced market cap within 0.01% of price × shares, trailing P/E 43.3×, forward P/E 31.4×, consensus target and three fiscal years of history), but the model placed debt, cash and cash-flow lines under operating metrics out of caution, leaving net debt and EV multiples empty. The collection and extraction prompts were tightened (disclosed debt lines may be summed and must be declared; statement items never belong in operating metrics; at most eight sector KPIs), and EV/EBIT plus a labeled fiscal-year free-cash-flow-yield fallback were added.
- Run 3 (2 requests, `verification/live-sector-gpt-6-astra-snapshot.json`, 67,369 reported tokens): the Eaton snapshot completed with sourced enterprise value USD 185.84bn, EV/EBITDA 28.0×, EV/EBIT 34.0×, EV/Revenue 6.2×, FCF yield 2.4%, forward P/E 31.4×, EBITDA margin 22.1%, revenue growth +21% (Q2 2026), 8.8% two-year revenue CAGR, and five sector operating metrics (orders and backlog growth by segment). The model left net income, diluted EPS and total debt null where the vendor definitions could not be verified, listed those gaps explicitly, and the app flagged the vendor TTM period end as unknown. This confirms real-model compatibility of the snapshot schema and the discovery flow; it does not establish comprehensive accuracy, and a full multi-company live sector analysis (up to 33 requests for six companies) has not been run.

After these fixes: **52 automated tests passed** and the **18 browser checks passed twice consecutively**; a race in the drill-down browser check (asserting before the selected run had rendered) was fixed by waiting for the run id.

### Installed release verification

Release **1.3.0** was activated on September 13, 2026 UTC with `scripts/upgrade-ai.py`; release 1.2.0 remains available for application rollback. Pre-upgrade backup: `backup-2026-09-13T22-12-07-413Z-c9e9ce1b-76e7-4d8d-9460-aee9184f4c77.sqlite`; post-upgrade backup: `backup-2026-09-13T22-12-12-558Z-31c933a4-47b0-40f6-977f-c3bc81245d44.sqlite`. The workspace and its revision matched before and after activation. Both `http://127.0.0.1:5191` and `http://<lan-address>:5191` serve version 1.3.0, report `gpt-6-astra` / `medium`, a configured key, the three existing completed research runs, an empty analysis list, and the new navigation and `analysis.js` asset; the error log is empty. `scripts/verify-ai-install.mjs` passed on both addresses (`verification/installed-ai-1.3.0.json`), and an isolated browser session rendered the installed Sector analysis page with the request estimate and an enabled start button without making a paid call (`verification/browser/installed-sector-analysis.png`). No production research run or sector analysis was started.

## Release 1.3.1 — historical-growth correction after the first owner-run sector analysis

September 13, 2026. The owner ran the first production sector analysis (“infrastructure consulting and professional services…”, seeded with AECOM, 2 companies): discovery, two snapshot-first reviews and the ranked comparison completed in about six and a half minutes with 13 provider requests (354,570 input / 32,989 output reported tokens). Reviewing the stored result exposed one calculation defect: the model placed a partial period (Q3 FY2026 for AECOM, H1 2026 for WSP) in the history block and the app's revenue CAGR treated every history entry as a full year, producing −37% and −22% “CAGRs”. The comparison stage had already declined to use those figures, but the dashboard displayed them.

Fix: historical growth now uses only observations at least a full year apart (52/53-week years count as whole years), excludes and names partial or undated periods in a warning, derives year-over-year growth only from adjacent annual observations, and the extraction prompt asks for completed fiscal years only. The correction is applied to stored snapshots at read time (`rederiveGrowth`), so the owner's existing analysis displays corrected values without rewriting archived provider output. Long accounting-basis notes are no longer truncated at 300 characters. **53 automated tests passed** (new coverage for mixed-period history and re-derivation of a stored snapshot); **18 browser checks passed**. Screenshots of the owner's analysis before the fix: `verification/browser/real-analysis-desktop.png`, `real-analysis-mobile.png` (no horizontal overflow at either width, no JavaScript errors).

## Release 1.3.2 — rename to INVEST-IGATOR, repository relocation and folder rename

October 2, 2026. No behavior change. The user-visible name, sidebar mark, icon, setup prompts and download filenames changed from "Investment Research" to INVEST-IGATOR. The export format identifier `investment-research`, the data folder, the LaunchAgent labels and the `RESEARCH_*` settings were deliberately left unchanged. Deploy and install scripts now locate the app folder from their own position.

Before deployment, from the relocated repository (`invest-igator/source`, then still under its old folder names): **53 automated tests passed**, the build check passed, and the **18 browser checks passed** with the synthetic provider (Playwright 1.55.0 in a scratch folder, installed Google Chrome, no paid calls).

### Installed release verification

Release **1.3.2** was activated with `scripts/upgrade-ai.py`; release 1.3.1 remains available for application rollback. Pre-upgrade backup: `backup-2026-10-02T21-18-06-605Z-623dccbd-b152-4481-a54c-9759c8ae0e4e.sqlite`; post-upgrade backup: `backup-2026-10-02T21-18-26-547Z-5a883df0-9a04-4a30-862d-d10c9666566f.sqlite`. The workspace and its revision (`d0f0f668-83ea-4f9f-854c-cef94bbc323a`) matched before and after. `scripts/verify-ai-install.mjs` passed on both addresses (version 1.3.2, key present, 9 research runs, no page errors, no paid calls); record in `verification/installed-ai-1.3.2.json`. The service error log was empty.

### Folder rename

With both LaunchAgents stopped: `FINANCIAL PLANNING` → `INVEST-IGATOR` and `investment-research` → `invest-igator`; the `current` link, `Connect AI.command` and the two LaunchAgent paths were repointed; the previous LaunchAgent files were saved in `service-config-backups/` (`*.before-rename-2026-10-02.plist`). Pre-rename backup: `backup-2026-10-02T21-20-13-846Z-848231b3-6497-4be4-a894-4088fc91ad1c.sqlite`. After restart: version 1.3.2 on both addresses, workspace and revision identical, 9 companies and 13 evidence notes. The backup LaunchAgent was triggered from its new path and produced `backup-2026-10-02T21-20-37-394Z-f0254b20-dec9-4a4c-a6af-4a21b21eb930.sqlite` with an empty error log. From the renamed location: 53 automated tests and the build check passed again. The browser suite was not rerun after the folder rename; no source file changed between the two.

## Release 1.4.0 — intake, dispositions and the home screen

October 6, 2026. Session 3 of the plan: a name-or-ticker intake box on the home screen, automatic Research / Watch / Declined dispositions with an owner override and an owner-only Invested state, and the stored research (rating, summary, dated price, app-computed multiples) shown on the home screen and on each company page. The old watchlist, its “DATA-CENTER SUPPLY CHAIN” header and the “Supply-chain role” wording were replaced. Workspace schema unchanged (1); dispositions are an additive SQLite table.

**Automated tests: 63 passed, 0 failed** (`npm test`; 53 existing plus 10 new in `tests/workflow.test.js`), **build check passed**. The new tests cover: the rating and status mapping (Consider → Watch with highlight, Pass → Declined, anything missing → Research, never Declined); a completed snapshot-first review filing the company automatically with the run id, rating and previous value recorded, filling a blank exchange and currency on the record as a new revision and leaving the run's research basis unchanged; a failed run changing nothing; an owner setting that sticks across a disagreeing assessment, produces a notice and can be released; Invested requiring an entry date and price (future dates and app-set Invested rejected) and surviving a later Pass assessment; startup backfill from stored assessments and legacy statuses without a workspace write and without duplicating rows on restart; intake validation (ticker normalization, unusable tickers dropped, low confidence treated as ambiguous, entries the model dropped reported as unresolved, workspace matches flagged); the intake flow end to end (verification run, company creation with provenance note, Research disposition, snapshot-first review queued automatically, ambiguous entry decided by the owner, dismissed entry adding nothing, an already-researched company recognized without a provider call, daily-run accounting of one intake plus one review per company); intake at the daily limit still adding the company and recording that research did not start; an archived match being restored; and the workflow HTTP routes with the existing origin protections. One intermittent failure was seen in a single run that overlapped with another server process on this Mac; five further consecutive runs passed and the failing test could not be identified.

**Browser acceptance: 23 checks passed** in isolated headless Chrome against the synthetic fixture service (`node tests/browser-research.mjs`, Playwright 1.55.0 in a scratch folder via `PLAYWRIGHT_MODULE_PATH`, installed Google Chrome, no paid calls). The 18 earlier checks still pass. Five new checks: the home screen shows the stored assessment, dated price, multiples and automatic disposition for a researched company and keeps it out of the Research tab; intake verifies listings, adds the company with research queued, asks about an ambiguous name and files the result automatically once its review completes; owner overrides (Declined sticks and moves the company to its tab, Invested records the entry date, price and quantity, releasing returns the app value); the company page shows the research summary with figures, challenges and the disposition control, the status select is gone and the role label reads “What the company does”; and the mobile home screen fits a 390-pixel viewport. A real defect was found and fixed during this pass: companies created on the server (by intake or sector analysis) were unknown to the browser's cached workspace, so their pages showed “Company not found” until a reload; the app now re-reads the workspace when the overview lists a new company or a company route misses. Screenshots: `verification/browser/home-desktop.png`, `home-mobile.png`.

**Rehearsal on real data (production untouched):** today's scheduled backup was restored into a disposable directory with `scripts/restore-database.js` and served by the 1.4.0 code on port 5192 without an API key. The backfill filed ETN, ACM and WSP as Watch from their stored assessments, VRT and NVT as Research from their Research further assessments, and APH, PWR, FIX and ANET as Research from their old status; prices (ETN USD 431.41 as of 2026-09-28, VRT USD 246.21 as of 2026-10-01, ACM USD 63.53 and WSP CAD 180.17 as of 2026-09-11) and forward P/E (31.8×, 36.5×, 15.9×, 15.7×) came from the stored snapshots; VRT's blank listing showed NYSE / USD from its research snapshot; the workspace revision was unchanged after the overview was read.

### Installed release verification

Release **1.4.0** was activated with `scripts/upgrade-ai.py`; release 1.3.2 remains available for application rollback. Pre-upgrade backup: `backup-2026-10-06T18-56-04-618Z-bfab53eb-45ac-457b-be73-c8f37edd46b4.sqlite`; post-upgrade backup: `backup-2026-10-06T18-56-09-674Z-31a7b74e-0073-41c4-aace-9149851c9fc7.sqlite`. The workspace and its revision (`d0f0f668-83ea-4f9f-854c-cef94bbc323a`) matched before and after. Both `http://127.0.0.1:5191` and `http://<lan-address>:5191` serve version 1.4.0 with the key present and the 9 existing research runs. `scripts/verify-ai-install.mjs` passed on both addresses (`verification/installed-ai-1.4.0.json`, no page errors). An isolated headless session opened the installed Home: the main list shows ACM, ETN and WSP (Watch), the Research tab the other six, with no horizontal overflow at 1440 or 390 pixels and no JavaScript errors (`verification/browser/installed-home-1.4.0.png`, `installed-home-mobile-1.4.0.png`). The app error log is empty. No production research run was started and no paid call was made.

## Release 1.4.1 — progress indicator and research filling empty notes

October 6, 2026, after the owner's first real intake (Lumentum → LITE, Nasdaq Global Select Market, USD, review completed as Watch in about six minutes). Two problems reported by the owner: research progress was not visible (the disabled assistant buttons showed a “wait” cursor and nothing explained what was happening), and the thesis, risks and disconfirming-evidence fields stayed empty after research.

Changes: a progress bar with the current step parsed from the stage text (“3 of 5 · Gathering evidence”), minutes elapsed and the typical duration, shown on the home row, the company page, the intake status and the research assistant; the assistant explains why its buttons are disabled and offers to stop the run; disabled buttons no longer use the wait cursor. When a review completes, the app now fills the record's **empty** thesis (assessment summary), risks (bear case) and disconfirming evidence (invalidation triggers) with an attribution line, in the same revision that fills a blank exchange or currency, and re-stamps the run's basis; the owner's own text is never overwritten. A **Fill empty notes from this assessment** button (`POST /api/workflow/notes`) does the same from a stored assessment without a new run.

**Automated tests: 64 passed, 0 failed** (two consecutive runs), **build check passed**. New coverage: blank notes filled with attribution and owner text left alone; a hand-cleared note refilled from the stored assessment with the run basis re-stamped; the notes route (409 without an assessment); `pending` carrying timestamps. Fixed in the suite: the workflow HTTP test had bound the same port (5198) as the sector-analysis HTTP test, which explains the intermittent failure noted for 1.4.0; it now uses 5199.

**Browser acceptance: 24 checks passed**, no page errors. New check: a running review shows the progress bar with its step on the home row, and the assistant's buttons are disabled with an explanation while the run is in progress, then return. The acceptance check now verifies that the review filled the record's empty thesis and risks while preserving the owner's unsaved draft in the form.

### Installed release verification

Release **1.4.1** was activated with `scripts/upgrade-ai.py` after the owner's Lumentum review had completed (the script refuses to run while research is in progress); release 1.4.0 remains available for rollback. Pre-upgrade backup: `backup-2026-10-06T20-14-46-076Z-1703551d-18d3-4f85-b96e-b3757eff7384.sqlite`; post-upgrade backup: `backup-2026-10-06T20-14-50-837Z-00740bd4-986d-4203-9e41-0e5cf199eef2.sqlite`. Workspace and revision matched before and after. Both addresses serve 1.4.1; `scripts/verify-ai-install.mjs` passed (`verification/installed-ai-1.4.1.json`); the error log is empty. Lumentum's empty notes were then filled from its stored assessment through the new route at the owner's request (one new revision of the record; the previous blank version is in its history). No paid call was made by the agent.

## Release 1.5.0 — price and financials feeds, feed-first snapshots, per-stage models

October 6, 2026, Session 4 of the plan. New `server/feeds/` layer ported in plain JavaScript from STOCKER's market-data package: a sliding-window rate limiter with a persisted day bucket, a New York market calendar with NYSE holidays through 2027, text-first HTTP handling (Tiingo answers rate limits with HTTP 200 and a plain-text body), Tiingo end-of-day prices, CoinGecko simple prices and SEC EDGAR XBRL company facts with a fiscal-year extractor. `FeedService` owns additive tables (usage, price observations, company profiles, cache, fetch log), fetches closes once per trading day after 16:45 ET from an in-process timer, refuses a plan over the hourly or daily quota, and supplies feed blocks to snapshot runs. Snapshot collection is feed first: feed sources enter the run's registry, the model is told what is already collected and searches with a lower tool-call cap, and feed figures override the model's before the unchanged normalization. The mandate gains per-stage model and effort settings (collect / extract / analyze). Companies gain an asset type and feed symbol. Keys are stored privately through `Connect feeds.command`.

**Automated tests: 71 passed, 0 failed**, **build check passed**. New `tests/feeds.test.js` (7 tests) with synthetic fixtures (`tests/fixtures/feeds.mjs`): rate-limiter buckets, budget capacity and persisted daily usage; calendar (weekends, holidays, the 16:45 ET due rule); Tiingo symbol mapping, bar parsing, HTTP 200 text bodies classified as rate-limit or provider errors rather than parse errors, 404 as not found; EDGAR extraction (fiscal years keyed by period end so a 10-K's restated comparative lands in the right year, total debt summed from balance-sheet lines with a note, EBITDA derived from operating income plus D&A, cover-page shares, contact required in the User-Agent); the daily fetch storing dated observations, marking symbols Tiingo lacks and skipping them for 30 days, refusing a plan over the quota, persisting usage across a restart, running once per trading day and not before the close or without a key, ignoring world-readable key files; feed-first collection with feed sources and the normalizer deriving market cap, net debt, EV, multiples and growth from feed figures; and a snapshot run end to end (feed figures override the model's, feed sources cited as S1–S3, the search call narrowed to three tool calls with the collected data in its prompt, the home overview showing the Tiingo close), plus per-stage settings reaching the provider for the matching role, recorded in usage, kept out of the model's context, and profile rules (crypto needs a CoinGecko id; a changed feed symbol clears a not-found mark).

**Browser acceptance: 26 checks passed**, no page errors. The fixture now runs with synthetic feed keys and a fake fetcher. New checks: the mandate form saves and reloads per-stage settings; Data & backups shows the feed status, Home refreshes Tiingo closes on demand (toast, then the row's price labeled “Tiingo close”), and the company page saves listing and feed settings. Two existing checks were widened for feed-first runs (the price label may read “Tiingo close”; the first citation may be a feed source), and a nested collapsible required a stricter selector. During this pass the per-minute pacing was raised from 10 to 30 Tiingo requests because a ten-company refresh otherwise waited for the window to roll over; Tiingo's own quotas are hourly and daily.

### Installed release verification

Release **1.5.0** was activated with `scripts/upgrade-ai.py` with no research running; release 1.4.1 remains available for rollback. Pre-upgrade backup: `backup-2026-10-06T20-44-40-981Z-addfca26-b860-451b-a8fc-f34b5b669b93.sqlite`; post-upgrade backup: `backup-2026-10-06T20-44-46-155Z-6866ce01-0b2e-4547-b78d-4e378559694a.sqlite`. Workspace and revision matched before and after. Both addresses serve 1.5.0; `scripts/verify-ai-install.mjs` passed (`verification/installed-ai-1.5.0.json`); the error log is empty. `Connect feeds.command` was created in the app folder. The feed status on the installed release reports no Tiingo key and no SEC contact, so prices and financials continue to come from research until the owner runs the setup; the daily fetch therefore has not run. The bounded live before/after token measurement waits for the keys (see the plan).

## Release 1.5.1 — home redesign (dark interface)

October 6, 2026, at the owner's request (Project Signal brief): a dark token-based interface across the app and a rebuilt Home. Invested and Watch are separate sections; each row shows the ticker and name, what the company does, the disposition with who decides and when it was assessed (Stale after 30 days), one supporting line and, for Watch companies, one line on what would move it; Details holds price, listing and multiples, why the rating, the full triggers drawn from the stored assessment (evidence still needed, catalysts, next steps, Street consensus target), Open full research, Research again and the decision control. Research, Declined and Archived are separate views. The overview gained `freshness`, `figures.consensus` and the assessment's rationale and valuation text. No server behavior changed otherwise.

**Automated tests: 71 passed, 0 failed**, **build check passed**. **Browser acceptance: 26 checks passed**, no page errors, no horizontal overflow at 1440 or 390 pixels. Checks were updated for the new structure: the Home check verifies the Invested section comes first, the decider and freshness text, the absence of a Stale mark on a fresh assessment, and that opening Details reveals the decision control and the “Evidence still needed” triggers; the override check opens Details before each control and verifies the Invested entry text and “You decide” in the row. Two layout faults found from screenshots were fixed before release (the view switcher inherited the sidebar's vertical nav rules; the company-page decision control inherited right alignment). Screenshots: `verification/browser/home-desktop.png`, `home-mobile.png`, `desktop-assessment.png`, `sector-dashboard.png`.

### Installed release verification

Release **1.5.1** was activated with `scripts/upgrade-ai.py`; 1.5.0 remains available for rollback. Pre-upgrade backup: `backup-2026-10-06T20-58-39-898Z-b70835fc-badf-4a30-b4b8-efa4581df41a.sqlite`; post-upgrade backup: `backup-2026-10-06T20-58-45-571Z-5da76de4-3da1-4bcc-aaa2-4ae12f9615eb.sqlite`. Workspace and revision unchanged. Both addresses serve 1.5.1; `scripts/verify-ai-install.mjs` passed (`verification/installed-ai-1.5.1.json`); error log empty. An isolated headless session opened the installed Home: Watch lists ACM, ETN, LITE and WSP, Invested is empty, Details opened for LITE, no overflow on desktop or phone (`verification/browser/installed-home-1.5.1.png`, `installed-home-mobile-1.5.1.png`). No research was started and no paid call made.

## Source verification for 1.5.2 (2026-10-13, not deployed)

Change: the install and verification scripts were made machine-independent (`scripts/install-local.py`, `scripts/verify-local.py`, `scripts/enable-trusted-lan.py`, `scripts/verify-ai-install.mjs`) and `docs/API.md`, `docs/ARCHITECTURE.md` and `README.md` were generalized. No application code changed except the version literal. Verified on a different, Apple-silicon Mac in a scratch copy with freshly installed dependencies, because this checkout's `node_modules` holds Intel binaries for better-sqlite3.

- `npm test`: 69 of 71 passed. The two failures are tests 23 and 25 in `tests/feeds.test.js` and are clock-dependent: they expect the fixture's latest close to be dated 2026-10-06, the day they were written, while the fixture follows the real clock (2026-10-13 today). They do not touch the changed files.
- `npm run build`: passed.
- Browser suite (`tests/browser-research.mjs`, Playwright 1.55.0, installed Google Chrome, synthetic provider): 26 passed, 0 errors. Screenshots in `verification/browser/` were not refreshed.
- Python scripts: `py_compile` passed; the LaunchAgent-reading and address-validation logic was exercised against sample loopback and LAN plists. The scripts were not run against a live service, because none is installed on the verifying Mac.
- Not deployed: the live service remains 1.5.1. Deploy with `python3 scripts/upgrade-ai.py` from `source/` on the server Mac, then run `node scripts/verify-ai-install.mjs`, which now reads the addresses from the installed LaunchAgent.

## Privacy scrub of the repository (2026-10-13, no release)

Every machine and network detail was removed from the repository and its full history (see `docs/session-logs/2026-10-13-20-12.md`): the records above now show `<lan-address>` where the server's address was, and `tests/access.test.js` uses a fictitious network. Verified in a scratch copy with freshly installed dependencies: `npm test` 69 of 71 (the same two clock-dependent feeds tests as for 1.5.2), `tests/access.test.js` 3 of 3, build check passed. No application code changed and nothing was deployed.

## Release 1.5.2 — deployment (2026-10-13)

The GitHub history was rewritten on 2026-10-13, so the old checkout was not pulled into: `invest-igator/source` was renamed to `invest-igator/source-before-2026-10-13` (clean tree, `main` at the old-history 1.5.1 commit) and the repository https://github.com/ericediger/INVEST-IGATOR was cloned as `invest-igator/source` at the release 1.5.2 commit (`0dfecda` in the current history). `npm ci` installed dependencies on the server Mac (Node 20.11.0); better-sqlite3 loads. Before deploying, `scripts/upgrade-ai.py` was compared with the old checkout (identical), and the only non-documentation code change from 1.5.1 is the version literal in `server/app.js`.

- `npm test`: 69 of 71 passed. The failures are tests 23 and 25 in `tests/feeds.test.js`, the clock-dependent fixtures described under “Source verification for 1.5.2”; the old 1.5.1 checkout fails the same two tests today.
- `npm run build`: passed.
- Browser suite (`tests/browser-research.mjs`, Playwright 1.55.0 in a scratch folder, installed Google Chrome, synthetic provider): 26 passed, 0 errors. The screenshots it rewrote were restored to their committed versions.

### Installed release verification

Release **1.5.2** was activated with `python3 scripts/upgrade-ai.py`; 1.5.1 remains available for rollback. Pre-upgrade backup: `backup-2026-10-13T23-49-21-773Z-3a397a91-7445-42d3-a136-29ca7b8a302b.sqlite`; post-upgrade backup: `backup-2026-10-13T23-49-26-267Z-d76b86cd-3b6e-44d1-9074-4209822166fd.sqlite`. The script reported the workspace preserved and the API key present. `/api/workspace` reports version 1.5.2 with 10 companies, 14 evidence notes, 0 snapshots, 0 scenarios and 0 decisions (unchanged). `node scripts/verify-ai-install.mjs` passed, reading both addresses from the installed LaunchAgent: loopback and the trusted-LAN address both serve 1.5.2, key configured, `gpt-6-astra` at medium reasoning, 11 research runs; installed browser check passed with no page errors (`verification/installed-ai-1.5.2.json`). `app-error.log` is empty. No research was started and no paid call was made.

After the second history rewrite (“Privacy scrub of the repository” above), the server Mac's clone was re-synced: `git fetch origin`, then only this entry's commit was rebased onto the rewritten `main` (the other commits ahead were old-history copies of rewritten commits). The verification record carries `<lan-address>` in place of the server's address, as the scrub requires.
