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
