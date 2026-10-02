# Investment Research — local MVP 1.3.0

Open **http://<lan-address>:5191** from your trusted home network, or **http://127.0.0.1:5191** on the server Mac. The watchlist is seeded with ETN, VRT, NVT, APH, PWR, FIX and ANET. Financial values start blank. No household account data was imported.

## AI research

Open **Research assistant** in the top bar for company research, a contrary-evidence review, recommendations, and persistent follow-up questions. Open **AI research** for the research inbox. Connect a server-side OpenAI API key using **Connect AI.command** in the installed app folder. New AI functionality is documented in `docs/AI-RESEARCH.md`, including usage limits, data sent externally, evidence review, and recovery. Live research requires a funded API project.

## Sector analysis

Open **Sector analysis** in navigation, enter a sector such as “European defense” or “semiconductor equipment”, optionally the companies you already know and any criteria, and choose **Start analysis**. The server discovers the listed companies (your named companies are always included and act as a starting point), adds missing ones to the watchlist with provenance, collects a dated financial and market snapshot for each, researches and challenges each company, then ranks them. The dashboard shows the ranked recommendations with thesis, valuation, catalysts, risks, invalidation triggers, confidence and data limitations, side-by-side financial snapshots, app-computed valuation multiples, growth and margins, operating metrics, sources and data-quality notes, with drill-down to the full research for each company. One analysis counts as one daily run but makes up to 3 + 5 × companies provider requests; the estimate is shown before you start. In the research assistant, **Research & recommend** now collects the same snapshot first by default, and **Financial snapshot only** collects it alone. See `docs/AI-RESEARCH.md` for the integrity rules (currency, period, share basis, freshness) and recommendation gating.

## Forward EPS research

In **Financial snapshots**, expand **Forward EPS** and choose **Research Forward EPS**. The agent researches an analyst estimate and prepares the value, fiscal period, accounting basis, provenance and source fields. Review the returned draft and choose **Fill Forward EPS fields**, then save the snapshot normally. Unknown publication dates remain blank; currency/share-basis conflicts are blocked.

## Everyday use

- Open a company to edit research, risks, disconfirming evidence and review reminders. Save research explicitly.
- Add evidence with a source title, optional ordinary HTTP/HTTPS link and publication/as-of dates. Unknown dates stay unknown. A correction is a new note referring to its predecessor.
- Add a manual snapshot. Enter actual currency units (not “millions”), source and period/basis for each metric. Negative EPS/FCF are valid; P/E is unavailable for nonpositive EPS. A copied/corrected snapshot is a new record.
- Build bear/base/bull assumptions against a selected snapshot. All three share target date, fiscal EPS period and share basis. The default target is 12 months after your chosen reference date. Scenarios with missing/nonpositive EPS have no chart. Out-of-order implied prices cannot be saved.
- Record Research, Watch, Pass or Revisit with selected evidence and a snapshot/scenario. Its full research/evidence/calculation basis is preserved. Correct it by adding another decision. These actions do not execute trades.
- Archive with confirmation; restore from the watchlist’s archived filter. All history remains.
- Conflicting edits show an error and retain your draft. Choose **Review latest saved version**, then discard your draft or **Reapply my draft** after review. Company reapply merges only the fields you changed; conflict checking applies to the whole workspace.
- Use **Data & backups** for JSON download, immediate server backup or validated restore. Imports replace the complete workspace after preview and typing `REPLACE WORKSPACE`; the app saves a database backup first.

## Installed locations

- Source repository: `~/.codex/.chatgpt-projects/g-p-6a9d61f2e3248191a56e46d334ad1c53/investment-research`
- Releases: `~/Desktop/_LOCAL APP DEVELOPMENT/FINANCIAL PLANNING/investment-research/releases/`
- Active release: `~/Desktop/_LOCAL APP DEVELOPMENT/FINANCIAL PLANNING/investment-research/current`
- Durable database: `~/Library/Application Support/InvestmentResearch/research.sqlite`
- SQLite WAL sidecars: same directory. Never independently copy or remove live WAL/SHM files.
- Backups: `~/Library/Application Support/InvestmentResearch/backups/`
- Service logs: `~/Library/Application Support/InvestmentResearch/logs/`
- LaunchAgents: `~/Library/LaunchAgents/com.investmentresearch.app.plist` and `com.investmentresearch.backup.plist`.

Data, logs and backups are outside the release and static assets. Upgrading or selecting an older compatible application release does not replace the database. The original brief, image, other apps and synced project sources remain untouched.

## Access

The owner explicitly confirmed **“Trusted home network; no login”** on September 6, 2026. The installed service binds only **127.0.0.1** and **<lan-address>** on port **5191**. It accepts socket peers from loopback and **<trusted-subnet>**, and validates the exact Host and write Origin for each address. Both pages and APIs use the same checks. Forwarded headers do not grant access. The research data and backups remain on the server Mac.

This is HTTP without application login or transport encryption; its protection is the owner-confirmed trusted home LAN. Every device on that subnet can read, edit, export and restore this single workspace. No router, public host, public IPv6 listener, tunnel, proxy or firewall change was made. This is not suitable for public or untrusted-network exposure. Port **3000** is not part of this app: open port **5191** directly.

The app LaunchAgent opts in with `RESEARCH_LAN_ADDRESS=<lan-address>` and `RESEARCH_TRUSTED_SUBNET=<trusted-subnet>`. Without these settings the code remains loopback-only. The configured address must exist on the server; if DHCP changes it, use the server's loopback URL while updating the agreed LAN address and subnet in the LaunchAgent. It fails closed instead of falling back to an all-interface listener. Reserve this address in your router if an existing reservation does not already do so.

## Start, stop and restart

The application starts when the installing user logs in and launchd restarts it if it exits. It runs independently of Codex. It is unavailable while this Mac is asleep, shut down or the user is logged out. Do not start a second process on the same port.

```sh
# Inspect
launchctl print gui/$(id -u)/com.investmentresearch.app

# Restart the installed app
launchctl kickstart -k gui/$(id -u)/com.investmentresearch.app

# Stop (until explicitly started again or next login)
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.investmentresearch.app.plist

# Start after stopping
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.investmentresearch.app.plist
```

For a disposable development workspace, run `npm ci`, `npm test`, `npm run build`, then `RESEARCH_DATA_DIR=/absolute/disposable/data PORT=5192 npm start` from a source checkout. Production needs only Node and the locked dependencies; the browser uses native ES modules, with no bundler or spreadsheet dependency.

## Backups and restore

A launchd job runs at **02:30 local time daily** (runs after wake if the scheduled time was missed while sleeping). It uses SQLite's online backup API and verifies database integrity before publishing the backup. The latest 30 scheduled/manual backups are kept. Pre-restore backups have `pre-restore-` names and are retained separately. Failures leave earlier backups intact and are written to the backup error log.

Run a backup immediately from **Data & backups**, or:

```sh
launchctl kickstart gui/$(id -u)/com.investmentresearch.backup
```

JSON restoration is the normal recovery workflow: choose a previous JSON export in **Data & backups**, inspect the counts, and type the replacement confirmation. Failed validation, unsupported schema, duplicate IDs, invalid references and imports over 5 MB do not change existing records. A concurrent edit after preview requires a fresh preview. Source schema version is 1, unrelated to brief v008.

To verify a SQLite backup without touching production:

```sh
cd '~/Desktop/_LOCAL APP DEVELOPMENT/FINANCIAL PLANNING/investment-research/current'
node scripts/restore-database.js '/absolute/backup.sqlite' '/absolute/new-disposable-directory'
RESEARCH_DATA_DIR='/absolute/new-disposable-directory' PORT=5192 npm start
```

The restore command rejects an existing target directory, checks SQLite integrity, validates all relationships and compares the recovered workspace. Open http://127.0.0.1:5192 to inspect it and export JSON. Restore that JSON through the production UI. Stop the temporary process after inspection.

If the production database cannot start, stop the app, **preserve/rename the entire production data directory**, restore into a new data directory with the command above, and update the app and backup LaunchAgents to the recovered directory before starting. Never overwrite a live database. Keep the damaged directory for investigation. Restoring an older backup necessarily loses changes newer than that backup; obtain the owner's agreement first.

All automatic backups are currently on the same Mac. They protect against accidental edits/replacement and some database failures, not loss of the machine or disk. An encrypted off-machine copy remains a future owner-controlled backup arrangement.

## Update and rollback

1. Work in a separate source checkout; do not edit `current` in place. Increment the application version. Keep `package-lock.json`.
2. Run `npm ci`, `npm test`, `npm run build` and the browser suite. Test any migration on a restored disposable database first. Back up the live app before switching releases.
3. Copy the tested application and installed production dependencies into a **new** `releases/<version>` directory. Preserve the previous release. Do not copy runtime data into it.
4. Change the `current` symlink to the new release and restart only `com.investmentresearch.app`. Verify `/api/health`, watchlist, saving and backup creation. The app and backup jobs both resolve `current`.
5. To roll back the application, point `current` to the previous release and restart that same job. Leave the data directory untouched. Version 1.0.0 reads database/workspace schema 1 and refuses a newer database schema. If a future version migrates the schema, code rollback is allowed only if compatible; otherwise a separately approved backup recovery is required. Never silently downgrade the data.

Release 1.0.0 is retained as the previous loopback-only version. To roll back from 1.0.1, stop the app job, restore its saved 1.0.0 plist from `service-config-backups/`, point `current` at `releases/1.0.0`, and bootstrap that app job. Data and the backup job remain in place. Remote access will cease when reverting to the loopback-only release.

Use an atomic symlink replacement (`current.next` → `current`) so the active path is never partially copied. `scripts/install-local.py` is for first install only; it refuses to replace an existing release or LaunchAgent.

## Scope and limits

Manual financial snapshots remain the basis for valuation scenarios and decisions; AI-collected financial snapshots are cited research records with app-computed derived values, not a market-data feed. Optional AI company research, sector analysis and recommendations use paid OpenAI API requests and web search after a server key is configured. No live quote feed, correlations, actual portfolio/holdings/performance, broker connections, public sharing or notifications. Review dates and triggers are displayed, not pushed as alerts. Currency and listing start unknown; users must verify them. Manual source links are stored for provenance; AI runs use web search and retain returned citations. Source provenance checks do not establish factual correctness. Evidence is plain text, not rich HTML. Arithmetic uses finite JavaScript numbers with no intermediate rounding; display rounds to four fractional digits. Single-household workspace, modest concurrency, 4 MB workspace / 5 MB request/import limit and whole-workspace conflict checks. Daily age calculations use America/New_York calendar dates.

See `docs/API.md`, `docs/ARCHITECTURE.md` and `TEST-RESULTS.md` for engineering details and actual verification.
