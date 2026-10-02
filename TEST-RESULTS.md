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
