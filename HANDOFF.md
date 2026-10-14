# HANDOFF — INVEST-IGATOR

Last updated: 2026-10-13 (publication to GitHub after a privacy scrub; release 1.5.2 deployed the same day). The state below is otherwise as of 2026-10-06 (Sessions 3 and 4: workflow releases 1.4.0 and 1.4.1, feeds release 1.5.0, home redesign 1.5.1). Rewritten whole; it replaces every earlier version of this file.

Read this file, then `docs/NEXT-SESSIONS-PLAN.md`. Working rules for agents are in `AGENTS.md`.

## What this project is

INVEST-IGATOR (called "Investment Research" until 2026-10-02) is a private, single-household investment research web app running on this Mac. The owner holds no stock; the app exists to prepare for investing. The owner adds a company by name or ticker; the app verifies the listing, collects a dated financial snapshot and a cited three-stage assessment through the OpenAI API, and files the company as Watch, Research or Declined. The owner can override any filing and is the only one who can mark a company Invested. Sector analysis (discovery, per-company research, ranked comparison) feeds the same records. The app keeps dated evidence, manual snapshots, bear/base/bull scenarios and a decision log. It never executes trades and does not judge personal suitability.

Owner's requirements, in order of authority:

1. `ITERATIONS_260913.txt` in the project folder: the last request the owner wrote.
2. The owner's decisions of 2026-10-02 and the answers of 2026-10-06 ("Proceed on all"), recorded in sections 2 and 7 of `docs/NEXT-SESSIONS-PLAN.md`.
3. The original brief `investment-research-app-brief__v008__2026-09-06.md` (historical; several of its exclusions have since been lifted by the owner).

`docs/WORKFLOW-ALIGNMENT.md` is an agent's note, not an owner requirement.

## Current state

- **Public demo and explainer (2026-10-13)**: GitHub Pages serves the repo root (`.nojekyll`, root `index.html` redirects to `demo/`). `demo/index.html` loads the unmodified front end from `public/` with `demo/demo-mode.js`, which answers `/api/*` from `demo/demo-data.json` (captured from a disposable copy of the server on fictional companies with a scripted provider) and an in-memory workspace; nothing is stored. `media/` holds the two-minute explainer and its poster, linked at the top of the README. The video pipeline lives outside this repo (EXPLAINER project, `videos/invest-igator/`).
- **Live version: 1.5.2**, activated 2026-10-13 on the server Mac with `scripts/upgrade-ai.py` from a fresh clone; server-side verification is in `TEST-RESULTS.md` (“Release 1.5.2 — deployment”). 1.5.2 changed only the install and verification scripts and docs; the app behaves as 1.5.1, activated 2026-10-06, the dark-interface home redesign requested by the owner (Project Signal brief): Invested and Watch sections, compact rows, Details disclosure, triggers from stored research.
- **Server Mac checkout**: `invest-igator/source` is a clone of the GitHub repository, re-synced to the rewritten `main` after the second rewrite. The checkout from before both rewrites (old history, no remote) is kept untouched as `invest-igator/source-before-2026-10-13`.
- **Feeds are dormant until the owner runs `Connect feeds.command`** (Tiingo token and SEC EDGAR contact). Then closes are fetched daily after 16:45 ET while the app runs, snapshots become feed first, and the bounded live token measurement can be run (`scripts/verify-live-sector.mjs … snapshot`). Open `http://127.0.0.1:5191` on this Mac or `http://<lan-address>:5191` on the trusted home LAN.
- **Home screen** (`#home`): an *Add companies* box (names or tickers); Invested and Watch as separate sections; Research, Declined and Archived as separate views. Each row: ticker and name, what the company does, disposition with who decides and assessed-ago (Stale after 30 days), one supporting line, one "what would move it" line; Details holds price, listing, multiples, why the rating, triggers, research actions and the decision control. The company page opens with the same research summary above the owner's notes.
- **Dispositions on the live data**: ETN, ACM, WSP and LITE are Watch (from their assessments); VRT and NVT are Research (Research further); APH, PWR, FIX and ANET are Research (never researched). Nothing is Declined or Invested; no override has been used.
- **The owner's first intake** (2026-10-06): “LUMENTUM” resolved to Lumentum Holdings Inc. (LITE, Nasdaq Global Select Market, USD) with a business description; its snapshot-first review completed as Watch in about six minutes. Its empty notes were filled from that assessment after 1.4.1 shipped. VRT, NVT, ACM and WSP still have empty notes; their company pages offer **Fill empty notes from this assessment**.
- Workspace: 10 companies, 14 evidence notes, 0 manual snapshots, 0 scenarios, 0 decisions.
- AI archive: 11 completed runs (8 company reviews, 1 intake, 1 discovery, 1 comparison) and 1 completed sector analysis.
- AI settings: model `gpt-6-astra`, medium reasoning, 12-month horizon, 10 runs a day, 6 companies per sector analysis, 2 concurrent jobs, prompt version 2.
- Verification on 2026-10-06: 71 automated tests, the build check and 26 browser checks passed; a rehearsal on a restored copy of the production backup matched expectations; the installed release passed `scripts/verify-ai-install.mjs` on both addresses after each release. Details in `TEST-RESULTS.md`.
- Git: `main` is at 1.5.2 plus the 2026-10-13 scrub commit. Remote `origin` is the **public** repository https://github.com/ericediger/INVEST-IGATOR; only `main` is pushed. History was rewritten twice on 2026-10-13 (first to remove the owner's name, then to remove every machine and network detail and to put all commits under the GitHub handle), so commit ids quoted in documents written before the second rewrite refer to earlier histories; the maps are in `docs/session-logs/2026-10-13-18-03.md` and `docs/session-logs/2026-10-13-20-12.md`. The server Mac's clone was re-synced to the rewritten `main` on 2026-10-13. Branches `session-2-invest-igator` and `session-3-workflow` are merged and can be deleted.

## Where everything lives

| What | Location |
|---|---|
| **Project folder (start threads here)** | `~/Desktop/_LOCAL APP DEVELOPMENT/INVEST-IGATOR/` |
| Owner's reference files | project folder: `ITERATIONS_260913.txt`, the v008 brief and its reference image, `Google_Finance_Portfolio.xlsx` (a what-if list, not holdings) |
| App folder | `INVEST-IGATOR/invest-igator/` |
| **Source repository (git, edit here)** | `INVEST-IGATOR/invest-igator/source/` |
| Installed releases (immutable, include `node_modules`) | `invest-igator/releases/1.0.0` … `1.5.2` |
| Active release | `invest-igator/current` (symlink → `releases/1.5.2`) |
| Key setup launchers | `invest-igator/Connect AI.command` (OpenAI), `invest-igator/Connect feeds.command` (Tiingo, SEC EDGAR contact, optional FMP) |
| LaunchAgent backups | `invest-igator/service-config-backups/` |
| Database, backups, logs, API key | `~/Library/Application Support/InvestmentResearch/` |
| Services | LaunchAgents `com.investmentresearch.app` (port 5191, keep-alive) and `com.investmentresearch.backup` (daily 02:30) |
| Claude memory | `~/.claude/projects/-Users-<user>-Desktop--LOCAL-APP-DEVELOPMENT-INVEST-IGATOR/memory/` |
| Retired source copy | `~/.codex/.chatgpt-projects/g-p-6a9d61f2e3248191a56e46d334ad1c53/investment-research.moved-2026-10-02/`. Do not edit. 1.4.0 shipped from the new location, so it can be deleted |

Names kept on purpose: the export format identifier `investment-research`, the data folder `InvestmentResearch`, the database file `research.sqlite`, the LaunchAgent labels and the `RESEARCH_*` environment variables. Renaming them touches stored data or the running service and gives the owner nothing visible.

## Architecture in one page

Node 20, Express, better-sqlite3, zod. Vanilla ES-module frontend, no bundler. One process serves the page and a same-origin JSON API.

- **Workspace data**: one versioned JSON document in SQLite (`workspace` table, schema 1) with optimistic revisions. Collections: companies, evidence, snapshots, scenarios, decisions. Append-only history. The legacy `status` field is still stored (hidden in the form); the disposition replaces it in the UI.
- **AI tables** (additive): `ai_settings`, `ai_runs` (with `analysis_id`), `ai_accepted`, `ai_analyses`. **Workflow table** (additive, 1.4.0): `dispositions`, append-only rows; the latest row per company is current. **Feed tables** (additive, 1.5.0): `price_observations`, `company_profile`, `feed_usage`, `feed_cache`, `feed_log`.
- **Server** (`server/`): `index.js` entry, `app.js` routes, `access.js` host and origin policy, `store.js` persistence and backups, `model.js` schemas and valuation math, `research.js` job queue and sector-analysis orchestrator (run kinds review, question, forward_eps, snapshot, discovery, comparison, intake; `startRun` applies the key, daily-limit and queue checks; `onRunFinished` hook), `research-provider.js` OpenAI Responses adapter, `financial-snapshot.js` snapshot normalization and derived multiples, `sector-analysis.js` discovery and comparison, `intake.js` listing resolution and validation, `dispositions.js` mapping and override validation, `workflow.js` the `WorkflowService` (dispositions, intake orchestration, record fill-in, home overview), `feeds/` (`index.js` FeedService, `rate-limiter.js`, `calendar.js`, `errors.js`, `tiingo.js`, `edgar.js`, `coingecko.js`), `forward-eps.js`, `bounds.js`.
- **Frontend** (`public/`): `app.js` (routes, company pages, manual forms), `home.js` (intake, Invested and Watch sections, rows with Details, triggers, company research summary), `research-panel.js` (assistant panel, inbox), `analysis.js` (sector analysis form, history, dashboard), `styles.css` (dark token system for every page).
- **Provider requests per run**: review 3 (5 with snapshot), question 1, forward EPS 2, snapshot 2, discovery 2, comparison 1, intake 2 (0 when every entry already matches a workspace company). With feeds connected a snapshot also makes up to one Tiingo and two SEC EDGAR requests (cached a day), and the search call is capped at three tool calls. A sector analysis makes 2 + 5 × companies + 1 requests and counts as one daily run. An intake counts as one daily run plus one run per company it researches.

Reference docs: `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/AI-RESEARCH.md`, `TEST-RESULTS.md`.

## How to work on it

See `AGENTS.md` for the full rules. In short: edit only in `source/`, bump the version in `package.json` (both root entries of `package-lock.json` too) and `server/app.js`, run `npm test`, `npm run build` and the browser suite (Playwright 1.55.0 installed in a scratch folder with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, passed through `PLAYWRIGHT_MODULE_PATH`), deploy with `python3 scripts/upgrade-ai.py`, commit before stopping. Rollback: point `current` at the previous release and restart `com.investmentresearch.app`; the database is never downgraded (1.3.2 ignores the `dispositions` table and the `intake` runs).

## Design decisions in force

- Analyses are a persisted state machine driving ordinary research runs on one job queue; intake is a run kind that the workflow service completes.
- The model reports only cited figures; the app computes every derived value. The workflow writes to the workspace only what is blank on a company record: exchange and currency from the verified snapshot, and (1.4.1) the thesis, risks and disconfirming-evidence notes from the assessment with an attribution line. It never overwrites the owner's words. It also writes provenance evidence notes and new companies.
- Dispositions are derived from the latest completed **company** assessment (Consider → Watch with a Consider highlight, Watch → Watch, Research further → Research, Pass → Declined; missing → Research, never Declined), not from the sector ranking. Every automatic change records the run, the rating and the previous value.
- An owner setting stands until the owner releases it; a newer disagreeing assessment is a notice, never a change. The app never sets Invested. Invested records the entry date, price and currency; quantity and amount are optional.
- Intake asks the owner only when a name could mean more than one listed company (or the identification is low confidence); unresolved names, funds and indexes add nothing.
- The research summary shown on the home screen and company page is derived from the stored assessment. The owner's thesis, risks and disconfirming-evidence fields are the owner's notes: research seeds them only while they are empty, and the attribution line shows what came from research.
- No multiples across currencies or with suspected scaled units; stale prices, old periods and old consensus are flagged. Model output is bounded leniently rather than failing a paid run.
- Workspace schema stays at version 1; new features use additive tables so rollback stays possible. Backfill never writes the workspace, so the release health check (workspace identical before and after) keeps working.
- Operational defaults left as shipped: a sector analysis counts as one daily run; discovery and intake add companies automatically with a provenance note; a Consider rating may rest on a fresh AI-collected price plus a computed multiple; worker concurrency is 2.

## Next steps

Full detail in `docs/NEXT-SESSIONS-PLAN.md`.

| Session | Work | Release |
|---|---|---|
| 5 | Actual price performance alongside modeled upside and downside; Invested companies measured from their entry date and price | 1.6.0 |
| 6 | Bulk ingestion of the what-if list as research candidates | 1.7.0 |

The owner has tried the intake (Lumentum → LITE, Watch) and asked for the redesign, shipped as 1.5.1. Next for the owner: review the redesign and run `Connect feeds.command` so prices and financials come from feeds. Sessions 5 and 6 follow.

## Known issues and limits

- The intake's listing verification still depends on the model with web search (2 requests); Tiingo metadata could confirm US listings in a later release. A wrong identification is possible; the provenance note on each added company says what was verified and the owner can archive a mistake.
- Feeds cover US listings (Tiingo) and SEC filers (EDGAR). WSP (TSX) and other non-US companies keep web-research prices and financials. Crypto needs a CoinGecko id set on the company page. FMP is stored but unused.
- The daily fetch runs only while the app is running (launchd keeps it running while the owner is logged in); it catches up at the first minute-check after 16:45 ET.
- Dispositions follow the company assessment; the sector ranking's rating (which can be downgraded for a stale price) stays on the dashboard only.
- Fill-in writes only blank fields. VRT's exchange and currency and the notes of VRT, NVT, ACM and WSP are still blank (their research predates the fill-in); the home screen shows VRT's listing “from research”, and each company page offers to fill the notes from the stored assessment.
- Prices on the home screen are the latest research or manual snapshot, dated and aged; there is no feed yet, so they go stale.
- No multi-company live analysis beyond the owner's 2-company run has been reviewed. The model often leaves net income, diluted EPS and total debt empty. AECOM's "revenue growth −14% (reported)" deserves a manual check.
- Restarting the service interrupts running research (including intake and the reviews it queued); there is no automatic retry.
- Backups are on this Mac only. The backup job leaves `.partial-shm` and `.partial-wal` files behind (harmless).
- The repository is public since 2026-10-13. Two history rewrites that day removed the owner's name, the server's LAN address and subnet (now `<lan-address>` / `<trusted-subnet>` in documents and records, and a fictitious 172.20.30.0/24 in `tests/access.test.js`), the install account's home paths (now `~`), the server's hostname, OpenAI response ids in verification records and the original author identities. Keep every future commit free of personal data, machine names, addresses and keys, including session reports and verification outputs. `scripts/verify-ai-install.mjs` checks the real addresses but records any non-loopback one as `<lan-address>`.
- `tests/feeds.test.js` pins the fixture day (2026-10-06) for the two feeds tests that also read the real date, so all 71 tests pass on any day. On an Apple-silicon Mac, run the suite in a scratch copy after `npm ci`: this checkout's `node_modules` holds Intel binaries for better-sqlite3.

## Session history

| Session | Date | Releases | Report |
|---|---|---|---|
| Earlier agent sessions (no reports) | 2026-09-06 to 09-07 | 1.0.0, 1.0.1, 1.1.0, 1.2.0 | `TEST-RESULTS.md` |
| 1 | 2026-09-13 (wrap-up 2026-10-02) | 1.3.0, 1.3.1 | `Session Reports/260913_SESSION-1-REPORT.md` |
| 2 | 2026-10-02 | 1.3.2 | `Session Reports/261002_SESSION-2-REPORT.md` |
| 3 | 2026-10-06 | 1.4.0, 1.4.1 | `Session Reports/261006_SESSION-3-REPORT.md`, `261006_SESSION-3B-REPORT.md` |
| 4 | 2026-10-06 | 1.5.0, 1.5.1 | `Session Reports/261006_SESSION-4-REPORT.md`, `261006_SESSION-4B-REPORT.md` |

The Session 1 report and its session log were written before the owner's October 2 decisions. Where they say `main` is untouched, the import is blocked or holdings will be imported, this file is correct and they are not.
