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
