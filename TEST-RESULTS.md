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
