# Next sessions plan — INVEST-IGATOR

Written 2026-10-02 after a read-only review of every project document, the source repository, the installed release and the live service. Revised the same day with the owner's answers (section 2) and research on the price feed and agent roles (section 5).

The app was renamed from "Investment Research" to INVEST-IGATOR on 2026-10-02, and Session 2A below was carried out the same day. `HANDOFF.md` is the starting point; this plan holds the detail behind its "Next steps".

## 1. What the review found (state before Session 2A)

| Item | Verified state |
|---|---|
| Live service | Version 1.3.1, healthy on `127.0.0.1:5191`; both LaunchAgents loaded |
| Source vs installed | Runtime, tests, scripts and dependencies are byte-identical. The only differences are two uncommitted documentation changes |
| Tests | `npm test` 53 passed, 0 failed; `npm run build` passed |
| Git | `main` at `4a476c4`; no remote; uncommitted: `README.md` (4 lines), `docs/WORKFLOW-ALIGNMENT.md` (new) |
| Workspace | 9 companies (ETN Watching, 8 Researching), 13 evidence notes, 0 manual snapshots, 0 scenarios, 0 decisions |
| Stored AI ratings | ETN Watch, ACM Watch, WSP Watch, VRT Research further, NVT Research further. APH, PWR, FIX and ANET have never been researched |

The code is not confused; only the documents are. Nothing needs repair or rollback.

### Why the app does not look updated

`ITERATIONS_260913.txt` was built as a separate **Sector analysis** page (releases 1.3.0 and 1.3.1). The home screen was not changed. Today the Watchlist still shows every company as "Not entered / Add a manual snapshot / No saved comparison", with the header "DATA-CENTER SUPPLY CHAIN", even for the five companies that have a stored AI rating and financial snapshot. The request said the recommendation should not be "buried inside the Research Assistant conversation"; for anything researched outside a sector analysis, it still is. Closing that gap is Session 3.

## 2. Owner decisions, 2026-10-02

1. **`ITERATIONS_260913.txt` is the last request the owner wrote.** The owner had not seen `WORKFLOW-ALIGNMENT.md`: it is the Codex agent's summary of a later conversation, stored in a hidden folder. A copy is now in this folder for reading. It is treated as a supporting note, not as an owner requirement. The requirements are `ITERATIONS_260913.txt` plus the decisions below.
2. **The owner holds no stock.** `Google_Finance_Portfolio.xlsx` is entirely a what-if list. The whole project prepares for investing. There is no holdings import; the file is a list of candidates to research.
3. **Workflow first.** The owner will add a few companies by hand to test it. Bulk ingestion of the what-if list comes last.
4. **Dispositions are applied automatically with an owner override, and there must be an "Invested" option.**
5. **Prices come from a quote feed and/or paid research calls**, taking ideas from the STOCKER app.
6. **Research the agent roles**: calling and extracting, entering, and analysis. Findings in section 5.
7. **Rename to INVEST-IGATOR**, both the folder and the application.

Still assumed, not confirmed: the main list shows only Watch and Invested companies, with Research and Declined on their own views (from the Codex note); equal weighting for the group figures.

## 3. Where the two agents collided, and the rule from now on

Three writes hit `HANDOFF.md` within 50 minutes on October 2 (Claude 14:40, Codex 14:58, Claude 15:27). It was patched rather than rewritten, so it reads as three voices. Remaining contradictions:

| Conflict | Where | Resolution |
|---|---|---|
| Import, move and merge described as unapproved; baseline named as a branch | `WORKFLOW-ALIGNMENT.md` | Merge done, move approved. "Import" is now bulk candidate ingestion, last |
| "`main` untouched", "six decisions open", "import blocked" | Session 1 report and log | Historical; leave as written |
| "Track what is held", holdings table, cost basis | `HANDOFF.md` item B, Claude memory | Wrong: the owner holds nothing |
| Three priority orders | Report, Codex note, handoff | Section 6 of this plan |
| Product-direction note untracked in a folder another tool may overwrite | `~/.codex/.chatgpt-projects/…` | Resolved in Session 2A: committed and moved |
| Claude memory loaded only when a thread started inside `investment-research/` | Two memory folders | Resolved in Session 2A: threads start in the project folder `INVEST-IGATOR/`, and the notes live in that folder's memory |

Rules for two agents:

- **One agent holds the pen.** Write `Working: <agent>, <date>` on line 2 of `HANDOFF.md` when starting; remove it when finished.
- **Git is the arbiter.** After the move, the handoff, reports and logs live in the repository. Commit before stopping. A dirty tree at the start means the other agent is mid-task: stop and ask.
- **One instruction file.** `AGENTS.md` holds the working rules; `CLAUDE.md` imports it.
- **History is append-only.** The handoff is rewritten whole at each wrap-up; reports and logs are never edited afterwards.

## 4. Dispositions, including Invested

One disposition per company, replacing the three vocabularies in the code today (company status Researching / Watching / Passed; AI rating Consider / Watch / Pass / Research further; decision action Research / Watch / Pass / Revisit).

| Disposition | Set by | Meaning | Where it shows |
|---|---|---|---|
| Research | App (default for anything new or with too little evidence) | Not enough yet to decide | Research queue |
| Watch | App, from the latest assessment | Researched and worth following | Main list |
| Declined | App, from the latest assessment | Researched and not attractive on the evidence | Declined view; history kept |
| **Invested** | **Owner only** | The owner has put money in | Main list, marked |

- Mapping from AI ratings: Consider → Watch with a "Consider" highlight; Watch → Watch; Research further → Research; Pass → Declined. Existing statuses map the same way. Archived runs keep their original labels.
- The app never sets or removes Invested. Setting it records the date and the entry price, with amount or quantity optional. That date and price become the baseline for that company's actual performance.
- Every automatic change records the assessment that caused it and the previous value. An owner override sticks until the owner releases it; a newer assessment that disagrees is shown as a notice, not applied.
- Missing data produces Research, never Declined.
- Listing verification, data quality and job progress are shown separately from disposition.

## 5. Research: agent roles and the price feed

### What a company review costs today

Measured from the stored October 1 Vertiv review (one company, five requests, all on one model with web search where noted):

| Stage | Role | Input tokens | Share |
|---|---|---|---|
| 1. Collect financial and market data (web search) | Calling | 60,546 | 39% |
| 2. Normalize the snapshot | Extracting | 5,356 | 3% |
| 3. Gather evidence (web search) | Research | 42,125 | 27% |
| 4. Challenge the thesis (web search) | Research | 33,583 | 22% |
| 5. Assess and recommend | Analysis | 13,748 | 9% |

The analysis is the cheapest part. Two fifths of the cost is a language model searching the web for numbers that a data feed returns exactly, for free, in one call. The model is also conservative there and often leaves fields empty, which is why multiples are frequently unavailable.

### Recommended split

| Role | Who does it | Notes |
|---|---|---|
| **Calling and extracting: numbers** | Code calling data feeds. No model | Prices, price history, shares, reported financials. Deterministic: same question, same answer |
| **Calling and extracting: what feeds lack** | Model with web search, narrow prompt | Consensus estimates and targets, non-US listings, sector operating metrics. Fallback only, and every figure still needs a citation |
| **Calling and extracting: narrative evidence** | Model with web search (today's stages 3 and 4) | Thesis evidence and counter-evidence. Unchanged |
| **Entering** | Code only | Validation, units, currency, periods, derived multiples, database writes. No model writes to the database. This is already the app's rule in `financial-snapshot.js`; extend it to profile fields and dispositions |
| **Analysis** | Model without web search, reading only stored, normalized data and cited evidence | Produces the assessment and proposes the disposition. Already how the sector comparison stage works. Deserves the strongest reasoning setting because it is the cheapest stage |

Consequences:

- Add a per-stage model setting (today one model and one effort level serve every stage). Extraction can run on a cheaper setting; analysis on the strongest. Measure before and after on a bounded live check.
- STOCKER's `packages/advisor` already has adapters for two model providers. Using a second provider for the analysis stage is possible but sends research content to another company, so it is an owner decision, not a default.
- Refreshing prices for the performance view through research calls would cost about 60,000 tokens per company per refresh. Through a feed it is one free request for the whole list.

### Price and fundamentals feeds

STOCKER's `packages/market-data` is the model: a provider interface, a rate limiter with per-minute, per-hour and per-day buckets, a fallback chain, a market calendar, and a budget check that refuses a polling plan that would exceed the daily quota. Its own notes record what failed: Stooq was dropped as unreliable; FMP's free tier has no price history; Tiingo returns HTTP 200 with a text body when rate limited; the rate limiter is per process.

| Need | Source | Cost and limits | Gaps |
|---|---|---|---|
| Daily closing prices and history, US stocks and ETFs | Tiingo (STOCKER's history provider; the owner already has a key) | Free: 50 requests an hour, 1,000 a day, 500 symbols a month. One batch request covers the whole list | No Toronto listing (WSP). No fundamentals on the free tier |
| Reported financials, US filers | SEC EDGAR `companyfacts` | Free, no key. 10 requests a second; a contact User-Agent header is mandatory | US filers only. Raw XBRL tags need mapping; no estimates |
| Crypto prices | CoinGecko (as STOCKER) | Free tier, no key | Close price only; 365 days of history |
| Search, profile, backup quote | FMP (the owner already has a key) | Free: 250 requests a day | Which estimate endpoints the free plan includes must be checked in the account, not assumed |
| Consensus estimates, targets, non-US prices | Paid research call, narrow | As today | Stays model-collected and cited |

Design choices for this app:

- Port the small pieces into this app as plain JavaScript (Tiingo and CoinGecko providers, the rate limiter, the budget check). Do not call STOCKER's API: that would make this app depend on another service that has been down for months at a time.
- Daily closing prices only, fetched once after the close. No intraday polling. That keeps usage near one request a day and leaves STOCKER's share of the same Tiingo key alone.
- Keys go in the app's private data folder through a setup command like `Connect AI.command`. No agent reads or copies key values.
- Every stored price carries date, source, listing and currency. A failed fetch keeps the last good price with its date; it is never replaced by zero or shown as fresh.
- The what-if list is about half funds. Funds and crypto have no earnings, so company research does not apply to them: they get price tracking and a short profile only. Asset type is set at intake.

## 6. Sessions

Each session ends with tests passing, a commit, a rewritten `HANDOFF.md` and a session report. Sessions 3 to 6 each ship one release through `scripts/upgrade-ai.py` (database backup, immutable release folder, health check, automatic rollback).

### Session 2A — Consolidate, relocate and rename (done 2026-10-02, release 1.3.2)

- The two loose documents were committed before anything moved. The repository was copied with its history to `invest-igator/source/` and verified there (53 tests, build, 18 browser checks). The old copy in the Codex folder was renamed `investment-research.moved-2026-10-02` and left a pointer.
- The handoff, session reports, session logs and this plan now live in the repository. `HANDOFF.md` was rewritten in one voice. `AGENTS.md` holds the working rules; `CLAUDE.md` imports it.
- **Rename.** Folder `FINANCIAL PLANNING` became `INVEST-IGATOR`; `investment-research` became `invest-igator`. The app shows INVEST-IGATOR in the browser title, sidebar, icon, setup prompts and download filenames (release 1.3.2, no behavior change). The LaunchAgents and the `current` link were repointed with the service stopped and the database backed up.
- Deliberately not renamed: the export format identifier `investment-research` (older exports must still restore), the data folder `~/Library/Application Support/InvestmentResearch`, the database file, the LaunchAgent labels and the `RESEARCH_*` settings.
- Deploy scripts now find the app folder from their own location, so a future folder rename needs only the LaunchAgents and the `current` link repointed.
- Work is on branch `session-2-invest-igator`; merging to `main` waits for the owner.

### Session 3 — Workflow: intake, dispositions, home screen (release 1.4.0)

The session the owner tests by adding a few companies by hand.

- **Intake**: a box on the home screen that takes a company name, a ticker or several. Each is resolved to a verified listing and queued for research with no further prompting. Ask only when a listing is ambiguous. Sector analysis stays as it is and feeds the same records.
- **Dispositions** as in section 4, applied automatically, with override and the Invested option. Additive storage; workspace schema stays at 1 so rollback works.
- **Research updates the company record**: thesis, risks, disconfirming evidence, exchange and currency become sourced, revisable fields instead of one evidence note.
- **Home screen**: Watch and Invested companies, each row showing the rating, a one-line thesis, the latest price with its date and the main multiples from the stored snapshot. Research and Declined on their own views with counts. Drill-down to the full assessment, financials and sources. The manual forms remain as secondary controls.
- Replace "DATA-CENTER SUPPLY CHAIN" and "Supply-chain role" wording.
- The five companies with stored assessments populate immediately at no cost. APH, PWR, FIX and ANET show as Research until the owner runs them.
- Tests: mapping, override persistence, Invested never set automatically, missing data gives Research, intake ambiguity; browser checks on desktop and mobile.

### Session 4 — Data feeds and the agent split (release 1.5.0)

- Tiingo daily prices and history, CoinGecko, SEC EDGAR financials, with the rate limiter and budget check from section 5. Private key setup command.
- A dated price-observation table filled once a day after the close for every active company.
- Snapshot collection becomes feed first; the model call is the fallback for what the feed lacks. Per-stage model setting.
- Asset type (company, fund, crypto) on each record.
- One bounded live check before and after, in a disposable database, to measure the token saving.
- Tests with recorded provider fixtures, including rate-limit and bad-body cases from STOCKER's notes.

### Session 5 — Actual performance and modeled potential (release 1.6.0)

- Actual price change per company and for the equally weighted Watch and Invested group, with coverage and dates. For Invested companies, change since the owner's entry date and price.
- Remaining modeled upside and downside from saved scenario versions against the latest price. Consensus-target upside stays a separately labeled figure.
- Prefill scenarios from the collected snapshot, since no scenarios exist today.
- Earlier forecasts preserved and judged against their own reference price and horizon.
- Missing or incompatible observations show as unavailable, never zero; no averaging across currencies.

### Session 6 — Bulk ingestion of the what-if list (release 1.7.0)

- Source: `Google_Finance_Portfolio.xlsx`, sheet `Holdings`: 107 rows, 86 unique symbols, eight lists, US dollars, captured 2026-09-06. 21 symbols appear in two lists; three rows have no quantity; one crypto row (`XRP / USD`); only ACM overlaps the current companies.
- Preview then confirm: symbols de-duplicated, list names kept as tags, asset type shown and editable, nothing written until confirmed.
- Everything enters as Research. Nothing is marked Invested. What-if quantities are kept as labeled hypothetical amounts and never described as holdings.
- Funds and crypto get price tracking and a short profile only.
- Research on the company rows runs as a budgeted batch: a cost estimate before starting, a cap per day, resumable. At today's cost a full review is about 155,000 input tokens per company, so the batch size is the owner's call.

### Backlog, not scheduled

- Encrypted off-machine backup.
- The backup script leaves `.partial-shm` and `.partial-wal` files behind (74 of 110 files in the backups folder).
- Review of a full six-company live sector analysis.
- The four operational defaults from Session 1 (daily-limit accounting, automatic company creation, Consider gating, concurrency of 2): leave as shipped unless one causes a problem.

## 7. Still to confirm with the owner

1. Main list shows only Watch and Invested, with Research and Declined on separate views?
2. When marking Invested: is date and entry price enough, or should amount be required?
3. Is a second model provider for the analysis stage acceptable, or should everything stay with the current one?
4. Which agent runs which session? Either works under the rules in section 3.
5. Merge branch `session-2-invest-igator` into `main`?
