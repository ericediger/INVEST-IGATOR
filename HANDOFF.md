# HANDOFF — INVEST-IGATOR

Last updated: 2026-10-06 (Session 3: intake, dispositions and the home screen, releases 1.4.0 and 1.4.1). Rewritten whole; it replaces every earlier version of this file.

Read this file, then `docs/NEXT-SESSIONS-PLAN.md`. Working rules for agents are in `AGENTS.md`.

## What this project is

INVEST-IGATOR (called "Investment Research" until 2026-10-02) is a private, single-household investment research web app running on this Mac. The owner holds no stock; the app exists to prepare for investing. The owner adds a company by name or ticker; the app verifies the listing, collects a dated financial snapshot and a cited three-stage assessment through the OpenAI API, and files the company as Watch, Research or Declined. The owner can override any filing and is the only one who can mark a company Invested. Sector analysis (discovery, per-company research, ranked comparison) feeds the same records. The app keeps dated evidence, manual snapshots, bear/base/bull scenarios and a decision log. It never executes trades and does not judge personal suitability.

Owner's requirements, in order of authority:

1. `ITERATIONS_260913.txt` in the project folder: the last request the owner wrote.
2. The owner's decisions of 2026-10-02 and the answers of 2026-10-06 ("Proceed on all"), recorded in sections 2 and 7 of `docs/NEXT-SESSIONS-PLAN.md`.
3. The original brief `investment-research-app-brief__v008__2026-09-06.md` (historical; several of its exclusions have since been lifted by the owner).

`docs/WORKFLOW-ALIGNMENT.md` is an agent's note, not an owner requirement.

## Current state

- **Live version: 1.4.1**, activated 2026-10-06 (1.4.0 earlier the same day). Open `http://127.0.0.1:5191` on this Mac or `http://<lan-address>:5191` on the trusted home LAN.
- **Home screen** (`#home`): an *Add companies* box (names or tickers), tiles and tabs for Watch & Invested / Research / Declined / Archived, and one row per company with its rating and date, one-line summary, latest dated price, forward P/E, EV/EBITDA, FCF yield, market cap, revenue growth, research progress and the disposition control. The company page opens with the same research summary above the owner's notes.
- **Dispositions on the live data**: ETN, ACM, WSP and LITE are Watch (from their assessments); VRT and NVT are Research (Research further); APH, PWR, FIX and ANET are Research (never researched). Nothing is Declined or Invested; no override has been used.
- **The owner's first intake** (2026-10-06): “LUMENTUM” resolved to Lumentum Holdings Inc. (LITE, Nasdaq Global Select Market, USD) with a business description; its snapshot-first review completed as Watch in about six minutes. Its empty notes were filled from that assessment after 1.4.1 shipped. VRT, NVT, ACM and WSP still have empty notes; their company pages offer **Fill empty notes from this assessment**.
- Workspace: 10 companies, 14 evidence notes, 0 manual snapshots, 0 scenarios, 0 decisions.
- AI archive: 11 completed runs (8 company reviews, 1 intake, 1 discovery, 1 comparison) and 1 completed sector analysis.
- AI settings: model `gpt-6-astra`, medium reasoning, 12-month horizon, 10 runs a day, 6 companies per sector analysis, 2 concurrent jobs, prompt version 2.
- Verification on 2026-10-06: 64 automated tests, the build check and 24 browser checks passed; a rehearsal on a restored copy of the production backup matched expectations; the installed release passed `scripts/verify-ai-install.mjs` on both addresses after each release. Details in `TEST-RESULTS.md`.
- Git: `main` is at release 1.4.1 (branches `session-2-invest-igator` and `session-3-workflow` are merged and can be deleted). No remote.

## Where everything lives

| What | Location |
|---|---|
| **Project folder (start threads here)** | `~/Desktop/_LOCAL APP DEVELOPMENT/INVEST-IGATOR/` |
| Owner's reference files | project folder: `ITERATIONS_260913.txt`, the v008 brief and its reference image, `Google_Finance_Portfolio.xlsx` (a what-if list, not holdings) |
| App folder | `INVEST-IGATOR/invest-igator/` |
| **Source repository (git, edit here)** | `INVEST-IGATOR/invest-igator/source/` |
| Installed releases (immutable, include `node_modules`) | `invest-igator/releases/1.0.0` … `1.4.0` |
| Active release | `invest-igator/current` (symlink → `releases/1.4.1`) |
| Key setup launcher | `invest-igator/Connect AI.command` |
| LaunchAgent backups | `invest-igator/service-config-backups/` |
| Database, backups, logs, API key | `~/Library/Application Support/InvestmentResearch/` |
| Services | LaunchAgents `com.investmentresearch.app` (port 5191, keep-alive) and `com.investmentresearch.backup` (daily 02:30) |
| Claude memory | `~/.claude/projects/-Users-<user>-Desktop--LOCAL-APP-DEVELOPMENT-INVEST-IGATOR/memory/` |
| Retired source copy | `~/.codex/.chatgpt-projects/g-p-6a9d61f2e3248191a56e46d334ad1c53/investment-research.moved-2026-10-02/`. Do not edit. 1.4.0 shipped from the new location, so it can be deleted |

Names kept on purpose: the export format identifier `investment-research`, the data folder `InvestmentResearch`, the database file `research.sqlite`, the LaunchAgent labels and the `RESEARCH_*` environment variables. Renaming them touches stored data or the running service and gives the owner nothing visible.

## Architecture in one page

Node 20, Express, better-sqlite3, zod. Vanilla ES-module frontend, no bundler. One process serves the page and a same-origin JSON API.

- **Workspace data**: one versioned JSON document in SQLite (`workspace` table, schema 1) with optimistic revisions. Collections: companies, evidence, snapshots, scenarios, decisions. Append-only history. The legacy `status` field is still stored (hidden in the form); the disposition replaces it in the UI.
- **AI tables** (additive): `ai_settings`, `ai_runs` (with `analysis_id`), `ai_accepted`, `ai_analyses`. **Workflow table** (additive, 1.4.0): `dispositions`, append-only rows; the latest row per company is current.
- **Server** (`server/`): `index.js` entry, `app.js` routes, `access.js` host and origin policy, `store.js` persistence and backups, `model.js` schemas and valuation math, `research.js` job queue and sector-analysis orchestrator (run kinds review, question, forward_eps, snapshot, discovery, comparison, intake; `startRun` applies the key, daily-limit and queue checks; `onRunFinished` hook), `research-provider.js` OpenAI Responses adapter, `financial-snapshot.js` snapshot normalization and derived multiples, `sector-analysis.js` discovery and comparison, `intake.js` listing resolution and validation, `dispositions.js` mapping and override validation, `workflow.js` the `WorkflowService` (dispositions, intake orchestration, listing fill-in, home overview), `forward-eps.js`, `bounds.js`.
- **Frontend** (`public/`): `app.js` (routes, company pages, manual forms), `home.js` (intake, lists, disposition control, company research summary), `research-panel.js` (assistant panel, inbox), `analysis.js` (sector analysis form, history, dashboard), `styles.css`.
- **Provider requests per run**: review 3 (5 with snapshot), question 1, forward EPS 2, snapshot 2, discovery 2, comparison 1, intake 2 (0 when every entry already matches a workspace company). A sector analysis makes 2 + 5 × companies + 1 requests and counts as one daily run. An intake counts as one daily run plus one run per company it researches.

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
| 4 | Price and financials feeds modeled on STOCKER (Tiingo, SEC EDGAR, CoinGecko; rate limiter and budget check); feed-first data collection; per-stage model setting; asset type on each record | 1.5.0 |
| 5 | Actual price performance alongside modeled upside and downside; Invested companies measured from their entry date and price | 1.6.0 |
| 6 | Bulk ingestion of the what-if list as research candidates | 1.7.0 |

The owner should now try the home screen: type a company name or ticker, watch it get verified, researched and filed, and try an override. The first real intake will show how well the model resolves names. Waiting for the owner before Session 4: which Tiingo and FMP keys may be shared with this app, and whether the daily price fetch may run from the existing backup LaunchAgent schedule.

## Known issues and limits

- The intake's listing verification depends on the model with web search (2 requests). A data feed (Session 4) would make it deterministic and free. Until then a wrong identification is possible; the provenance note on each added company says what was verified and the owner can archive a mistake.
- Dispositions follow the company assessment; the sector ranking's rating (which can be downgraded for a stale price) stays on the dashboard only.
- Fill-in writes only blank fields. VRT's exchange and currency and the notes of VRT, NVT, ACM and WSP are still blank (their research predates the fill-in); the home screen shows VRT's listing “from research”, and each company page offers to fill the notes from the stored assessment.
- Prices on the home screen are the latest research or manual snapshot, dated and aged; there is no feed yet, so they go stale.
- No multi-company live analysis beyond the owner's 2-company run has been reviewed. The model often leaves net income, diluted EPS and total debt empty. AECOM's "revenue growth −14% (reported)" deserves a manual check.
- Restarting the service interrupts running research (including intake and the reviews it queued); there is no automatic retry.
- Backups are on this Mac only. The backup job leaves `.partial-shm` and `.partial-wal` files behind (harmless).
- Docs and scripts contain the owner's first name, a private LAN address and local paths. Review before ever adding a git remote.

## Session history

| Session | Date | Releases | Report |
|---|---|---|---|
| Earlier agent sessions (no reports) | 2026-09-06 to 09-07 | 1.0.0, 1.0.1, 1.1.0, 1.2.0 | `TEST-RESULTS.md` |
| 1 | 2026-09-13 (wrap-up 2026-10-02) | 1.3.0, 1.3.1 | `Session Reports/260913_SESSION-1-REPORT.md` |
| 2 | 2026-10-02 | 1.3.2 | `Session Reports/261002_SESSION-2-REPORT.md` |
| 3 | 2026-10-06 | 1.4.0, 1.4.1 | `Session Reports/261006_SESSION-3-REPORT.md`, `261006_SESSION-3B-REPORT.md` |

The Session 1 report and its session log were written before the owner's October 2 decisions. Where they say `main` is untouched, the import is blocked or holdings will be imported, this file is correct and they are not.
