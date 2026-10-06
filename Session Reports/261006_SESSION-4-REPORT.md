# Session 4 Report — INVEST-IGATOR (release 1.5.0)

## Session Overview

- **Date:** 2026-10-06, after the owner's "proceed" following release 1.4.1.
- **Scope:** Session 4 of `docs/NEXT-SESSIONS-PLAN.md`: price and financials feeds modeled on STOCKER, a dated price-observation table filled daily after the close, feed-first snapshot collection, a per-stage model setting and an asset type on each record.
- **Outcome:** release **1.5.0** is live. Numbers now come from code calling feeds when keys are configured; the model researches what the feeds lack. The owner must run **Connect feeds.command** (Tiingo token, SEC EDGAR contact) for the feeds to switch on.

## Work Completed

1. **Feed layer** (`server/feeds/`): rate limiter with persisted daily usage; New York market calendar; text-first HTTP handling; Tiingo end-of-day prices; CoinGecko prices; SEC EDGAR company facts with a fiscal-year extractor (period-end keyed, restatements win, debt summed with a note, EBITDA derived, cover-page shares); `FeedService` with additive tables, a daily fetch from an in-process timer, a budget check and a manual refresh.
2. **Feed-first snapshots** in `server/research.js`: feed blocks and sources collected before the model search, the model told what is already collected (search narrowed to three tool calls), feed figures merged over the model's draft before normalization; runs record feed coverage.
3. **Per-stage model and effort** in the mandate (collect / extract / analyze), applied per call, recorded in usage, kept out of the model's context.
4. **Profiles**: asset type (Company, Fund, Crypto), feed symbol, CIK, CoinGecko id; Tiingo coverage status with a 30-day skip for symbols it lacks.
5. **UI**: feed status and refresh on Home; feed panel on Data & backups; Listing & feeds form on the company page; per-stage settings in the mandate form; feed coverage line on snapshots.
6. **Scripts**: `scripts/configure-feeds.js`; the upgrade script creates `Connect feeds.command`.
7. **Verification and release**: 71 automated tests, build, 26 browser checks; deployment; installed checks. Docs updated (`README.md`, `docs/API.md`, `docs/AI-RESEARCH.md`, `docs/ARCHITECTURE.md`, `docs/NEXT-SESSIONS-PLAN.md`, `TEST-RESULTS.md`, `HANDOFF.md`).

## Files Changed

| File | Change |
|---|---|
| `server/feeds/{index,rate-limiter,calendar,errors,tiingo,coingecko,edgar}.js` | New |
| `server/research.js`, `server/research-provider.js` | Feed-first snapshot stage; `stageSettings`; per-call model and effort overrides; usage `role` |
| `server/workflow.js`, `server/app.js`, `server/index.js` | Feed price in the overview; profile and feed status; feed routes; wiring; version 1.5.0 |
| `public/home.js`, `public/app.js`, `public/research-panel.js`, `public/styles.css` | Feed status and refresh, Data page panel, Listing & feeds form, per-stage settings, snapshot feed line |
| `scripts/configure-feeds.js`, `scripts/upgrade-ai.py` | New setup script; launcher creation |
| `tests/feeds.test.js`, `tests/fixtures/feeds.mjs`, `tests/browser-fixture-server.mjs`, `tests/browser-research.mjs` | New tests and fixtures; feed-enabled fixture; 3 new checks |
| Docs | Updated |

## Testing & Validation

| Check | Result |
|---|---|
| Automated tests | 71 passed |
| Build check | Passed |
| Browser suite | 26 passed, no page errors |
| Deployment of 1.5.0 | Workspace and revision unchanged; backups before and after |
| Installed check, both addresses | Passed (`verification/installed-ai-1.5.0.json`); error log empty |
| Live feed check | Not run: no Tiingo token or SEC contact configured yet |

No paid OpenAI calls were made by the agent.

## Issues Encountered

| Issue | Resolution |
|---|---|
| A 10-K's prior-year comparatives carry the filing's fiscal year, which would have overwritten the right year | Fiscal years keyed by period end |
| The budget check counted the per-minute pacing bucket and refused normal batches | Budget uses hourly and daily quotas; the minute bucket paces with a wait |
| Ten-company refresh paused for the minute window during the browser check | Pacing raised to 30 a minute |
| Feed sources shifted citation ids in two browser checks | Checks accept feed sources |

## Outstanding Items

- Owner: run **Connect feeds.command** on the server Mac (Tiingo token; SEC contact as name and email). Then the daily fetch starts, snapshots become feed first, and the next agent can run the bounded live before/after token measurement.
- FMP key accepted but unused.
- The owner asked for a dark-mode redesign of the home page (Project Signal brief); it follows as the next release.

## Next Steps

Home redesign (next release), then Session 5 (actual versus modeled performance, 1.6.0) and Session 6 (bulk ingestion, 1.7.0).
