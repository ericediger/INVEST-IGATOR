# AI research — release 1.2.0

## Everyday use

1. Open **Research assistant** from the top bar, or **AI research** from navigation.
2. Select a company. The panel follows a company page when you navigate; other pages retain the selected company. It stays open until closed.
3. Review the **Research mandate & limits**. Defaults: company merits, a 12-month valuation horizon, and 10 runs per UTC day. Portfolio suitability is unknown.
4. Choose **Research & recommend**. The server gathers cited evidence, searches for counterevidence, then produces a structured assessment. The app remains usable while it runs.
5. Review the recommendation, source links, assumptions, evidence gaps and invalidation triggers. The saved basis shows exactly which app data and mandate were used.
6. Ask a follow-up with **Investigate question**. Each company retains its own history on the server. The four most recent completed runs are passed as dated conversation context.
7. Choose **Save reviewed assessment as evidence** to append an AI-authored evidence note. The assistant does not change your thesis, snapshots, scenarios, watchlist status or decision log. If company records changed after the run, explicit acknowledgment of the dated basis is required. Saving twice does not duplicate the note.

**Consider** requires both a saved reference quote no more than seven calendar days old and complete saved forward valuation scenarios. Without them, a requested Consider result is downgraded to **Research further** and the missing evidence is shown. Other recommendation categories are **Watch**, **Pass**, and **Research further**. These are company research opinions, not a test of personal suitability. Evidence confidence describes source support, not a probability of investment success.

The price range shown by the app uses its existing deterministic scenario calculations. AI is instructed not to invent prices, target prices or returns. The app does not import live quotes. Release 1.2.0 can research and fill Forward EPS fields for explicit review and snapshot saving. Financial statements discussed in the report must identify source, period, units and accounting basis; citation validation does not independently establish factual accuracy.

## Connect OpenAI privately

On the server Mac, open **Connect AI.command** in the installed `investment-research` folder. It runs `scripts/configure-ai.js` interactively. Create an API key in a funded OpenAI API project, set provider budget controls, and paste the key into the hidden terminal prompt. Input is not echoed. Do not paste the key into Codex chat or the LAN application.

The setup writes a private `openai-api-key` file (mode 0600) in `~/Library/Application Support/InvestmentResearch`. The server reads it when checking availability and making requests, so no restart is required. Choose **Recheck connection** after setup. “Connected” means a key is present; the first run verifies model access and billing. Keys that are readable by other accounts are ignored. The setup does not verify account billing or make a paid research call.

Developers can use `OPENAI_API_KEY`, or `OPENAI_API_KEY_FILE` pointing to a private file. For a disposable development server use `RESEARCH_DATA_DIR` when running `npm run configure-ai` to avoid configuring production. Never embed credentials in frontend code or commit a key. The default model is `gpt-6-astra` with explicit `medium` reasoning for every stage. `RESEARCH_AI_REASONING_EFFORT` can override the effort; `RESEARCH_AI_MODEL` can select another model supporting Responses web search and structured outputs. Different models can have different costs or API support.

## Data and usage

Starting research transmits the selected company's research fields, up to 20 recent evidence notes, latest/reference snapshots, selected scenario and deterministic calculations, up to three recent decisions, research mandate, and up to four recent AI runs to OpenAI. Material sent on each run is preserved in the local archive. Extremely large contexts are rejected before a provider request. Public web search is enabled for evidence and counterevidence gathering, and for follow-up questions.

API requests use `store:false`. This is not a claim of zero provider retention: the API account's applicable data controls still apply. The app's authoritative conversation history is local SQLite. No API key is returned to the browser, included in exports or logged.

A review makes at most three provider requests; the first two permit up to four web tool calls each. A question makes one request with up to four web tool calls. Each request caps output at 6,500 tokens and times out after four minutes. The UI's run limit includes questions, failed runs and cancellations, resets at 00:00 UTC, and is not a dollar spending cap. OpenAI billing and project controls remain necessary for cost management. Usage records show tokens reported by completed provider requests; failed/cancelled calls may have unreported billable usage.

One worker processes up to ten queued jobs in order, with at most one pending run per company. Stop aborts the local request and prevents late publication, but cannot guarantee reversal of provider charges. Server restarts mark queued/running work interrupted; there is no automatic retry. Closing the browser does not stop a job. Sleeping/shutting down the Mac can interrupt it. Scheduled monitoring and outbound notifications are not included in this release.

## Persistence and recovery

Three additive tables (`ai_settings`, `ai_runs`, `ai_accepted`) share the existing SQLite database. The workspace document/schema remain unchanged. AI updates do not rotate the company workspace revision; explicit evidence acceptance uses the existing optimistic check and commits the evidence and acceptance mapping in one database transaction.

The existing online SQLite backups include both the original workspace and all AI tables. **Download AI archive** is a complete JSON archive for inspection/export; it has no import route. The ordinary workspace JSON export includes accepted AI notes, but not conversations or pending research. To recover complete AI history, restore a SQLite backup into a new directory using the existing recovery script and verified whole-database recovery procedure. Workspace-only JSON restores preserve existing AI history; assessments for missing companies remain archived and cannot be accepted. Changed company bases require review.

Application rollback to 1.0.1 leaves the additive AI tables intact. That release cannot display them. Do not overwrite a live database or independently copy SQLite WAL sidecars.

## Verification boundary

Tests use clearly labeled synthetic provider responses and temporary databases. They verify the request contract, three-stage orchestration, reference validation, recommendation gating, isolation, cancellation, persistence, backup inclusion, acceptance transactions, daily limits, error handling and existing access checks. They do not establish real-model research quality, current model access, or actual account billing. A live cited review must be checked after connecting a key.

## Official API references consulted

- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/reference/typescript/resources/responses/methods/create
- https://developers.openai.com/api/docs/models/gpt-6-astra


## Agent-assisted Forward EPS (1.2.0)

Expand **Forward EPS** in a company's financial snapshot form and choose **Research Forward EPS**. A first web-search call looks for a directly published analyst point estimate, identifying fiscal year versus next-twelve-month estimates, accounting basis, currency, share basis and dates. A second structured-output call prepares the fields. This consumes one daily run, at most two model requests, and up to four web tool calls. The existing snapshot currency/share basis and requested EPS period are sent as context; the agent must verify them.

The stored draft includes the original supporting source reference, a short supporting passage, source publication date and estimate as-of date independently (both nullable), gaps and any stale-estimate warning. The source title and URL come from the returned citation registry, not invented metadata. Company guidance, historical actual EPS, midpoint calculations, currency conversions and inferred EPS from a price/P-E ratio are excluded. If a usable analyst estimate is unavailable, the draft explains the missing evidence. It does not manufacture a value.

**Fill Forward EPS fields** requires a sourced value, currency and fiscal period. An unstated share basis remains unknown and carries an explicit warning to confirm compatibility before saving. It fills value, period, basis, Analyst estimate provenance, source title/URL and publication date. Unknown basis/publication dates stay blank; required missing basis must be supplied before a snapshot can be saved. Known currency and share basis populate the shared snapshot fields only if blank; conflicting known entries block filling. Unknown share basis stays blank when no snapshot basis is entered. Replacing existing EPS fields requires review in the normal confirmation dialog. Price, quote date, other metrics and other form inputs are preserved.

Filling makes an unsaved form draft. **Save new snapshot** uses the existing snapshot validation and append-only history. The original AI draft remains in the research archive and is included in subsequent company conversation context. The workspace schema is unchanged: the legacy persisted snapshot provenance string remains `Manual snapshot`, denoting an explicitly saved form; the metric remains labeled `Analyst estimate`, and its source is preserved. This is not automatic valuation scenario generation or automatic investment decision recording.

## Sector analysis (1.3.0)

Open **Sector analysis** in navigation. Enter a sector or industry, optionally the companies you already know (names or tickers) and any criteria or constraints, and choose **Start analysis**. The server then runs, without further prompting:

1. **Discovery** (2 requests): a web search for the listed companies in that sector, applying your criteria as data, followed by structured extraction. Named companies are always included and serve as the starting point, not the boundary; the model may add pure plays and diversified companies. Funds, private companies and unusable tickers are excluded and listed under *Not analyzed*. The list is capped at the mandate's **Companies per sector analysis** (default 6, maximum 10), named companies first.
2. **Workspace matching**: selected candidates are matched to existing watchlist companies by ticker; new ones are created with status *Researching*, the discovered exchange and quote currency, a role describing the sector relevance, and a dated evidence note attributed to *AI sector discovery*. Archived companies are not analyzed; a named archived company must be restored first.
3. **Company research** (5 requests each, up to the configured concurrency in parallel): a financial and market snapshot (search + extraction), evidence gathering, counter-evidence, and the structured assessment, which now includes catalysts. Each company run is an ordinary research run in that company's history, marked as part of the analysis.
4. **Comparison** (1 request, no web search): the ranking is produced only from the collected assessments and app-normalized snapshots, citing a shared source registry (`A1…`). It gives each company a rating, thesis, key evidence, valuation view, relative attractiveness, catalysts, risks, invalidation triggers, confidence and data limitations, plus the reason the leaders rank first, sector risks, assumptions and caveats.

A 6-company analysis makes up to 33 provider requests and can take tens of minutes; the estimate is shown before you start. It counts as **one** daily run. Only one analysis runs at a time; **Stop analysis** cancels queued and running company research and keeps completed results. The dashboard updates automatically and can be left and reopened from Sector analysis or the AI research inbox.

### Financial and market snapshot

Every analyzed company (and any company where you choose **Financial snapshot only** or leave **Collect a financial & market snapshot first** ticked) gets a standardized snapshot: identity and listing, quote and reporting currency, dated share price, basic and diluted shares, market capitalization, enterprise value, the latest fiscal-year or trailing-twelve-month financials with accounting basis, growth and up to three prior years, consensus estimates with periods, sector-specific operating metrics, and data period, source and freshness for each item. The model reports only cited figures in full currency units; the app discards uncited values, rejects future dates, and computes net debt, market cap (price × basic shares outstanding, with the basis recorded), enterprise value, margins, growth and valuation multiples itself. Sourced market caps and enterprise values are cross-checked against the derived figures and flagged when they differ materially. Multiples computed: trailing and forward P/E, EV/EBITDA, EV/EBIT, EV/Revenue, free-cash-flow yield (from the latest fiscal year when trailing-twelve-month cash flow is unavailable, labeled as such), net debt/EBITDA and upside to the consensus target. The model may add disclosed balance-sheet debt lines to reach total debt and must say so; every other derivation is the app's.

Integrity rules: multiples are not computed when the price and the statements are in different currencies, when revenue is implausibly small (likely millions rather than units) or when currencies are unknown; prices older than 7 days, periods older than 200 days and consensus older than 90 days are flagged; peer comparisons note mixed period types (FY vs TTM), unconverted currencies, stale prices and non-comparable snapshots. Historical revenue growth and CAGR use only observations at least a full year apart; partial or undated periods are excluded and named in a warning, and this rule is re-applied to stored snapshots when they are read. Snapshots are research records; they do not create manual financial snapshots or valuation scenarios.

### Recommendation gating

**Consider** requires either the existing basis (a saved reference quote no more than seven days old and complete forward scenarios) or an app-collected snapshot whose price is no more than seven days old and which yielded at least one computed multiple; in the latter case the assessment records that no user scenario was saved. In the ranking, a requested Consider without that basis is downgraded to Research further with an explicit data limitation. Ratings remain company research opinions, not personal suitability.

### Data, limits and recovery

Each analyzed company's saved notes, evidence, snapshots, scenarios, decisions and recent AI history are sent to OpenAI as for a normal review. Discovery sends the sector, named companies, criteria and the names/tickers of active watchlist companies. `ai_analyses` is an additive table; `ai_runs` gains an `analysis_id` column on first start. Backups include both. **Download AI archive** now includes analyses (archive schema 2). Server restarts mark a running analysis interrupted; completed company research inside it is preserved and visible on the dashboard. Rolling back to 1.2.0 leaves the new table and column in place; that release ignores them.

`scripts/verify-live-sector.mjs` runs a bounded live check (one Eaton financial snapshot and one sector discovery, four requests, disposable database). Synthetic fixtures verify orchestration, gating, cancellation, restart, limits, HTTP protection and the dashboard; they do not establish real-model research quality.

## Home screen workflow (1.4.0)

**Add companies.** On **Home**, type one or more company names or tickers (comma-separated, up to 10) and choose **Add & research**. One research run verifies the listings: a web search identifies each company's primary listing, exchange, quote currency and a one-line description, and a structured extraction returns them with citations. The app normalizes tickers, checks currencies against the ISO list, and matches the workspace. Verified companies are added with the exchange, currency and description from the research and a dated provenance note (author *Company intake*), filed as **Research**, and each gets a snapshot-first review queued automatically (5 provider requests, one daily run per company). A name that could mean more than one listed company shows the candidates under the box; choose one or skip it. Funds, indexes, private companies and names that cannot be verified are listed as not added, with the reason, and a link to the manual form. Entries that already match a company in the workspace are recognized without a provider call: an unresearched one is researched, a researched one is reported as such.

**Dispositions.** Every company has one disposition: **Research** (not enough yet to decide), **Watch** (researched and worth following), **Declined** (researched and not attractive on the evidence) or **Invested** (the owner has put money in). The app applies the first three from the latest completed assessment: Consider → Watch with a *Consider* highlight, Watch → Watch, Research further → Research, Pass → Declined. Missing data always gives Research, never Declined. Each automatic change records the assessment that caused it and the previous value. Companies with stored assessments were filed on first start; companies without one took their old status.

**Your setting wins.** The disposition control on each row (and on the company page) offers *App decides*, Research, Watch, Declined and Invested…. A value you set stays until you choose *App decides* again; a newer assessment that disagrees is shown as a notice under the control, not applied. **Invested** is yours alone: the app never sets or removes it. Marking a company Invested records the entry date, entry price and currency (quantity, amount and a note are optional); these become the baseline for that company's actual performance in a later release. Recording Invested does not place a trade.

**What the home screen shows.** The main list holds Watch and Invested companies; Research, Declined and Archived have their own tabs with counts. Each row shows the exchange and currency (taken from the research snapshot when the record is blank, marked *from research*), the latest rating with its date and evidence confidence, a one-line summary of the assessment, the latest dated price (the research snapshot or a manual snapshot, whichever is newer, with its age), the main app-computed multiples (forward P/E, EV/EBITDA, free-cash-flow yield, market cap, revenue growth), the research progress while a run is queued or running, and the disposition. *Full research* opens the assessment, financial snapshot and sources in the assistant; *Start research* / *Research again* queues a snapshot-first review. The company page opens with the same research summary (key figures, what challenges the case, what would change the view, catalysts) above your own notes.

**Research fills what is empty (1.4.1).** When a review completes, the app fills the company record's empty fields and leaves everything you wrote alone: exchange and currency from the verified snapshot identity; the investment thesis from the assessment's summary; risks from its bear case; disconfirming evidence from its invalidation triggers. Each filled note ends with an attribution line naming the assessment date and rating, so you can see what came from research and rewrite it in your own words. This is a new revision of the record (the earlier version stays in its history), and the run's saved basis is re-stamped so the fill-in does not read as a change you made. For a company that already has an assessment but empty notes, the company page offers **Fill empty notes from this assessment**, which does the same from the stored assessment without a new run.

**Progress (1.4.1).** While research runs, the home row, the company page and the research assistant show a progress bar with the current step (for example "3 of 5 · Gathering evidence"), the minutes elapsed and the typical duration (a full review usually takes 5–10 minutes). The assistant's buttons are disabled while that company has a run in progress; a note above them says so and offers to stop the run.

**Usage.** An intake counts as one daily run plus one run per company it researches. Verifying listings sends only the entries you typed and the names, tickers and exchanges of active workspace companies to OpenAI.

## Price and financials feeds (1.5.0)

**Why.** Measured on a stored review, two fifths of the tokens went to a language model searching the web for numbers that a data feed returns exactly, for free, in one call. From 1.5.0 the numbers come from code calling feeds; the model searches only for what the feeds lack and does the analysis.

**Connect.** Open **Connect feeds.command** in the INVEST-IGATOR app folder on the server Mac. It asks for a Tiingo API token (end-of-day prices, free tier), the contact the SEC requires in every EDGAR request (your name and email), and an optional Financial Modeling Prep key (stored for later, not used yet). Everything is saved privately in the app's data folder, like the OpenAI key; nothing is shown in the browser. **Data & backups** shows what is connected, today's usage against the quotas and the last fetch.

**Daily closes.** While the app is running, it fetches the closing price for every US-listed company and fund once per New York trading day after 16:45 ET (one Tiingo request per company), and the CoinGecko price for crypto records. Each stored price carries its date, source and currency. If a fetch fails, the last good price stays with its date; nothing is replaced by zero or shown as fresh. **Refresh prices now** on Home does the same on demand; it refuses when the plan would exceed the remaining hourly or daily quota. Home rows and company pages show the newest dated price from any source (feed, research snapshot or manual snapshot), labeled.

**Feed-first snapshots.** Before the model searches for a financial snapshot, the app collects the latest close and the fiscal-year financials from SEC EDGAR's XBRL company facts (revenue, operating income, EBITDA as operating income plus depreciation and amortization, net income, diluted EPS, operating cash flow, capex, total debt, cash, diluted shares, up to four fiscal years, and the latest cover-page share count). The model is told these are already collected and cited, so its web search concentrates on identity, trailing-twelve-month figures if published, consensus estimates, target price and operating metrics, with a lower tool-call cap. Feed figures override the model's; the app derives everything else as before. The snapshot panel says which parts came from feeds. Non-US listings (for example WSP on the TSX) and companies the SEC list does not cover fall back to web research, with the reason noted.

**Asset type and feed symbol.** On the company page, *Listing & feeds* sets the asset type (Company, Fund or Crypto), an optional price-feed symbol when it differs from the ticker, and the CoinGecko id for crypto records. Funds and crypto get price tracking; company research and SEC financials apply to companies.

**Model per stage.** In the research mandate, *Model and reasoning per stage* lets collecting and extracting run on a lighter model or effort while the analysis stays on the strongest. Blank means the configured default. Each run's usage record shows the model and effort actually used for each stage.

**Limits.** Tiingo free tier: 50 requests an hour, 1,000 a day, 500 symbols a month; the app makes one request per company per day plus one when a snapshot needs today's close. SEC EDGAR: free, no key, contact required; at most one company-facts request per company per day, cached. CoinGecko: free tier, close price only. The daily fetch runs only while the app is running; it catches up the first time it checks after 16:45 ET.
