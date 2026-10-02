# HANDOFF — INVEST-IGATOR

Last updated: 2026-10-02 (Session 2: consolidation, relocation and rename). Rewritten whole; it replaces every earlier version of this file.

Read this file, then `docs/NEXT-SESSIONS-PLAN.md`. Working rules for agents are in `AGENTS.md`.

## What this project is

INVEST-IGATOR (called "Investment Research" until 2026-10-02) is a private, single-household investment research web app running on this Mac. The owner holds no stock; the app exists to prepare for investing. It keeps companies with dated evidence, financial snapshots, bear/base/bull scenarios and a decision log, and runs AI research through the OpenAI API: cited company reviews, follow-up questions, forward-EPS research, standardized financial snapshots and automated sector analysis with a ranked dashboard. It never executes trades and does not judge personal suitability.

Owner's requirements, in order of authority:

1. `ITERATIONS_260913.txt` in the project folder: the last request the owner wrote.
2. The owner's decisions of 2026-10-02, recorded in section 2 of `docs/NEXT-SESSIONS-PLAN.md`.
3. The original brief `investment-research-app-brief__v008__2026-09-06.md` (historical; several of its exclusions have since been lifted by the owner).

`docs/WORKFLOW-ALIGNMENT.md` is an agent's note, not an owner requirement.

## Current state

- **Live version: 1.3.2**, a rename-only release on top of 1.3.1. Open `http://127.0.0.1:5191` on this Mac or the trusted-LAN address in `README.md`.
- Workspace: 9 companies (ETN Watching; VRT, NVT, APH, PWR, FIX, ANET, ACM, WSP Researching), 13 evidence notes, 0 manual snapshots, 0 scenarios, 0 decisions.
- AI archive: 9 completed runs (7 company reviews, 1 discovery, 1 comparison) and 1 completed sector analysis. Stored ratings: ETN Watch, ACM Watch, WSP Watch, VRT Research further, NVT Research further. APH, PWR, FIX and ANET have never been researched.
- AI settings: model `gpt-6-astra`, medium reasoning, 12-month horizon, 10 runs a day, 6 companies per sector analysis, 2 concurrent jobs, prompt version 2.
- Verification on 2026-10-02: 53 automated tests, the build check and 18 browser checks passed on the 1.3.2 source.
- **The home screen has not caught up with the research.** The Watchlist shows every company as "Not entered / Add a manual snapshot", even those with a stored rating and financial snapshot. Ratings and snapshots are visible only in the assistant panel and on the Sector analysis page. Fixing this is Session 3.

## Where everything lives

| What | Location |
|---|---|
| **Project folder (start threads here)** | `~/Desktop/_LOCAL APP DEVELOPMENT/INVEST-IGATOR/` |
| Owner's reference files | project folder: `ITERATIONS_260913.txt`, the v008 brief and its reference image, `Google_Finance_Portfolio.xlsx` (a what-if list, not holdings) |
| App folder | `INVEST-IGATOR/invest-igator/` |
| **Source repository (git, edit here)** | `INVEST-IGATOR/invest-igator/source/` |
| Installed releases (immutable, include `node_modules`) | `invest-igator/releases/1.0.0` … `1.3.2` |
| Active release | `invest-igator/current` (symlink) |
| Key setup launcher | `invest-igator/Connect AI.command` |
| LaunchAgent backups | `invest-igator/service-config-backups/` |
| Database, backups, logs, API key | `~/Library/Application Support/InvestmentResearch/` |
| Services | LaunchAgents `com.investmentresearch.app` (port 5191, keep-alive) and `com.investmentresearch.backup` (daily 02:30) |
| Claude memory | `~/.claude/projects/-Users-<user>-Desktop--LOCAL-APP-DEVELOPMENT-INVEST-IGATOR/memory/` |
| Retired source copy | `~/.codex/.chatgpt-projects/g-p-6a9d61f2e3248191a56e46d334ad1c53/investment-research.moved-2026-10-02/`. Do not edit. Delete once a later session has shipped from the new location |

Names kept on purpose: the export format identifier `investment-research`, the data folder `InvestmentResearch`, the database file `research.sqlite`, the LaunchAgent labels and the `RESEARCH_*` environment variables. Renaming them touches stored data or the running service and gives the owner nothing visible.

Git: no remote. Session 2 work is on branch `session-2-invest-igator`; `main` is at `4a476c4` (release 1.3.1) until the owner asks for the merge. The branch `releases-1.1.0-to-1.3.1` is fully merged and can be deleted.

## Architecture in one page

Node 20, Express, better-sqlite3, zod. Vanilla ES-module frontend, no bundler. One process serves the page and a same-origin JSON API.

- **Workspace data**: one versioned JSON document in SQLite (`workspace` table, schema 1) with optimistic revisions. Collections: companies, evidence, snapshots, scenarios, decisions. Append-only history.
- **AI tables** (additive): `ai_settings`, `ai_runs` (with `analysis_id`), `ai_accepted`, `ai_analyses`.
- **Server** (`server/`): `index.js` entry, `app.js` routes, `access.js` host and origin policy, `store.js` persistence and backups, `model.js` schemas and valuation math, `research.js` job queue and sector-analysis orchestrator, `research-provider.js` OpenAI Responses adapter, `financial-snapshot.js` snapshot normalization and derived multiples, `sector-analysis.js` discovery and comparison, `forward-eps.js`, `bounds.js`.
- **Frontend** (`public/`): `app.js` (routes, watchlist, company pages), `research-panel.js` (assistant panel, inbox), `analysis.js` (sector analysis form, history, dashboard), `styles.css`.
- **Provider requests per run**: review 3 (5 with snapshot), question 1, forward EPS 2, snapshot 2, discovery 2, comparison 1. A sector analysis makes 2 + 5 × companies + 1 requests and counts as one daily run.

Reference docs: `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/AI-RESEARCH.md`, `TEST-RESULTS.md`.

## How to work on it

See `AGENTS.md` for the full rules. In short: edit only in `source/`, bump the version in `package.json` and `server/app.js`, run `npm test`, `npm run build` and the browser suite, deploy with `python3 scripts/upgrade-ai.py`, commit before stopping. Rollback: point `current` at the previous release and restart `com.investmentresearch.app`; the database is never downgraded.

## Design decisions in force

- Analyses are a persisted state machine driving ordinary research runs on one job queue.
- The model reports only cited figures; the app computes every derived value.
- No multiples across currencies or with suspected scaled units; stale prices, old periods and old consensus are flagged.
- Model output is bounded leniently (truncate and warn) rather than failing a paid run.
- Workspace schema stays at version 1; new features use additive tables so rollback stays possible.
- Operational defaults chosen in Session 1 and left as shipped: a sector analysis counts as one daily run; discovery adds companies automatically with a provenance note; a Consider rating may rest on a fresh AI-collected price plus a computed multiple; worker concurrency is 2.

## Next steps

Full detail in `docs/NEXT-SESSIONS-PLAN.md`.

| Session | Work | Release |
|---|---|---|
| 3 | Name or ticker intake; automatic Research / Watch / Declined with owner override and an owner-set Invested; ratings and snapshots on the home screen | 1.4.0 |
| 4 | Price and financials feeds modeled on STOCKER; feed-first data collection; per-stage model setting | 1.5.0 |
| 5 | Actual price performance alongside modeled upside and downside | 1.6.0 |
| 6 | Bulk ingestion of the what-if list as research candidates | 1.7.0 |

Waiting for the owner: whether the main list shows only Watch and Invested; whether marking Invested needs an amount; whether a second model provider may be used for analysis; merging `session-2-invest-igator` into `main`.

## Known issues and limits

- No multi-company live analysis beyond the owner's 2-company run has been reviewed. A 6-company run is about 33 requests and a million tokens.
- The model often leaves net income, diluted EPS and total debt empty, so some multiples are unavailable. Feeds in Session 4 address this.
- AECOM shows "revenue growth −14% (reported)", a cited vendor figure that deserves a manual check.
- Restarting the service interrupts running research; there is no automatic retry.
- Backups are on this Mac only. The backup job leaves `.partial-shm` and `.partial-wal` files behind (harmless).
- Docs and scripts contain the owner's first name, a private LAN address and local paths. Review before ever adding a git remote.

## Session history

| Session | Date | Releases | Report |
|---|---|---|---|
| Earlier agent sessions (no reports) | 2026-09-06 to 09-07 | 1.0.0, 1.0.1, 1.1.0, 1.2.0 | `TEST-RESULTS.md` |
| 1 | 2026-09-13 (wrap-up 2026-10-02) | 1.3.0, 1.3.1 | `Session Reports/260913_SESSION-1-REPORT.md` |
| 2 | 2026-10-02 | 1.3.2 | `Session Reports/261002_SESSION-2-REPORT.md` |

The Session 1 report and its session log were written before the owner's October 2 decisions. Where they say `main` is untouched, the import is blocked or holdings will be imported, this file is correct and they are not.
