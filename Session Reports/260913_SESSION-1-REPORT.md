# Session 1 Report — Investment Research

## Session Overview

- **Work date:** 2026-09-13. **Wrap-up date:** 2026-10-02.
- **Scope:** an in-depth review of the Investment Research app, followed by implementation of an automated sector research and recommendation workflow, a standardized financial snapshot, and an investment dashboard.
- **Outcome:** releases **1.3.0** and **1.3.1** were built, tested, deployed and verified. The owner ran the first production sector analysis the same day; reviewing it found one calculation bug, fixed in 1.3.1.
- **Numbering:** this is the first documented session. Releases 1.0.0 through 1.2.0 were built in earlier agent sessions without session reports.
- **Note on the thread:** the same conversation later moved to a different application (STRATEGOS). That work is out of scope here and is not part of this project.

## Work Completed

1. **Review of the existing system (1.2.0).** Traced the real implementation rather than labels: single Express process, one JSON workspace document in SQLite, per-company "Research & recommend" as three OpenAI calls run by a serial worker, manual financial data, no sector concept, no peer comparison, recommendation visible only in the assistant panel.
2. **Sector analysis orchestration.** A persisted `ai_analyses` record drives ordinary research runs: discovery → workspace matching or creation → one snapshot-first review per company → ranked comparison. Handles cancel, restart and failure from stored state.
3. **Standardized financial and market snapshot.** Two-call collection and extraction; strict local normalization; all derived values computed by the app; integrity flags for currency, units, period, share basis and freshness.
4. **Comparison and ranking.** No-search synthesis over collected reports and snapshots with a shared source registry; every company ranked once; Consider gated on a fresh price plus a computed multiple.
5. **Dashboard and UI.** New Sector analysis route with request form, history, and a dashboard: ranked recommendations, snapshot, valuation, growth and operating-metric tables, a bar comparison, per-company drill-down, sources, data quality and basis panels. The assistant panel gained snapshot collection, catalysts and a drill-down entry point.
6. **Worker concurrency** (default 2) and daily-limit accounting that counts an analysis once.
7. **Release 1.3.1.** Historical growth corrected to use only full fiscal years, with read-time re-derivation of stored snapshots.
8. **Wrap-up (2026-10-02).** Four release commits reconstructed on a branch, secrets and personal-data scrub, handoff, session log and this report.

## Technical Details

- **New server modules:** `server/financial-snapshot.js`, `server/sector-analysis.js`, `server/bounds.js`.
- **`server/research.js`:** new run kinds `snapshot`, `discovery`, `comparison`; `review` accepts `withSnapshot`; assessment gains `catalysts`; `ai_analyses` table and nullable `ai_runs.analysis_id` added in place; `advanceAnalysis` state machine invoked after each child run; worker runs up to `RESEARCH_AI_CONCURRENCY` jobs (default 2, max 4); prompt version 2.
- **`server/research-provider.js`:** configurable web-search tool-call cap and JSON schema name.
- **`server/app.js`:** routes `GET/POST /api/research/analyses`, `GET /api/research/analyses/:id`, `POST …/cancel`.
- **Snapshot integrity rules:** uncited values discarded; future dates rejected; no multiples across currencies, with unknown currency, or with suspected scaled units; price older than 7 days, period older than 200 days and consensus older than 90 days flagged; sourced market cap and EV cross-checked against derived values; market cap uses basic shares outstanding with the basis recorded.
- **Multiples computed by the app:** trailing and forward P/E, EV/EBITDA, EV/EBIT, EV/Revenue, FCF yield (fiscal-year fallback, labeled), net debt/EBITDA, upside to consensus target.
- **Workspace schema unchanged** (schema 1). AI archive export is schema 2 and includes analyses.

## Files Changed

Source repository (branch `releases-1.1.0-to-1.3.1`).

| File | Change |
|---|---|
| `server/research.js` | Rewritten: new kinds, analysis orchestrator, concurrency, limits, read-time re-derivation |
| `server/financial-snapshot.js` | New: schema, prompt, normalization, derived values, `rederiveGrowth`, summary text |
| `server/sector-analysis.js` | New: discovery and comparison schemas, prompts, validators, source registry |
| `server/bounds.js` | New: lenient truncation of over-long model output |
| `server/research-provider.js`, `server/app.js` | Provider options; analysis routes; version literal |
| `public/analysis.js` | New: sector analysis form, history, dashboard |
| `public/research-panel.js` | Snapshot rendering, snapshot-first review, catalysts, sector-run rows, `showRun` |
| `public/app.js`, `public/index.html`, `public/styles.css` | Route, navigation link, dashboard styles |
| `tests/financial-snapshot.test.js`, `tests/sector-analysis.test.js` | New: 15 tests |
| `tests/browser-fixture-server.mjs`, `tests/browser-research.mjs` | Synthetic provider for new schemas; 3 new checks; 2 race fixes |
| `scripts/verify-live-sector.mjs` | New: bounded live check |
| `README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/AI-RESEARCH.md`, `TEST-RESULTS.md` | Updated for 1.3.0 and 1.3.1 |
| `package.json` | Version 1.3.1 |
| `verification/` | Live-check records, installed-check record, dashboard screenshots |

Project root (outside git): `HANDOFF.md`, `Session Reports/260913_SESSION-1-REPORT.md`, `docs/session-logs/2026-10-02-14-38.md`.

## Testing & Validation

| Check | Result |
|---|---|
| Automated tests (`npm test`) | 53 passed, 0 failed (38 before the session) |
| Syntax check (`npm run build`) | Passed |
| Browser suite, synthetic provider | 18 checks passed, including desktop and mobile dashboard without horizontal overflow |
| Boot against a copy of the production backup | Legacy runs and reports loaded unchanged; schema migrated in place |
| Installed service, both addresses | Version 1.3.1, key present, existing runs intact, error log empty |
| Installed browser check (`verify-ai-install.mjs`) | Passed, no paid calls |

Live provider checks, disposable database, production untouched:

| Run | Requests | Reported tokens | Result |
|---|---|---|---|
| Discovery ("European defense") + Eaton snapshot | 4 | 134,726 | Discovery selected 5 primary listings; snapshot failed on an array cap |
| Eaton snapshot after fixes | 2 | 71,044 | Completed, comparable; EV multiples empty |
| Eaton snapshot after prompt refinement | 2 | 67,369 | Completed with sourced EV, EV/EBITDA 28.0×, EV/EBIT 34.0×, forward P/E 31.4× |

Owner's production sector analysis (2 companies): 13 requests, 354,570 input and 32,989 output tokens, about 6.5 minutes, completed with a ranked result.

Backups created by the two deployments: `backup-2026-09-13T22-12-07-413Z…`, `…22-12-12-558Z…` (1.3.0) and `backup-2026-09-13T22-36-49-874Z…`, `…22-36-55-867Z…` (1.3.1).

## Issues Encountered

| Issue | Resolution |
|---|---|
| Temp Playwright install was stripped | Reinstalled in a scratch folder; path passed via `PLAYWRIGHT_MODULE_PATH` |
| Mobile dashboard overflowed horizontally | Chart-metric picker now wraps; stat tiles wrap |
| Live snapshot failed: model returned 35 operating metrics against a cap of 12 | Model output is truncated with a recorded warning instead of failing |
| Seed "Rheinmetall" reported unresolved though "Rheinmetall AG" was selected | Seeds match by partial name |
| Saab dropped because ticker "SAAB B" contains a space | Share-class tickers normalized to `SAAB-B` |
| Model parked debt, cash and cash-flow lines under operating metrics | Prompts tightened; debt lines may be summed and declared; EV/EBIT and FCF-yield fallback added |
| Two browser-test races (scroll during re-render; assert before selected run rendered) | Tests wait for the run id; scroll made tolerant |
| Revenue CAGR treated partial periods as full years (−37%, −22% in the owner's analysis) | Fixed in 1.3.1; stored snapshots re-derived at read time |
| Wrap-up: all 1.1.0–1.3.1 work was uncommitted | One commit per release reconstructed from the installed snapshots, on a new branch |

## Wrap-up Record (2026-10-02)

- **Scrub:** 51 files scanned. Secret patterns: 7 hits, all false positives (the words "key-setup" and "key-present", a key-format check, synthetic test keys, two URLs containing "key-statistics"). No emails, SSN patterns, env files, key files or databases. Docs and scripts contain the owner's first name, a private LAN address and local paths, which predate this session and stay local because the repo has no remote. **Status: PASS.**
- **Commits:** `5e3eea2` (1.1.0), `a6551b5` (1.2.0), `e2d717e` (1.3.0), `4a476c4` (1.3.1) on branch `releases-1.1.0-to-1.3.1`. Working tree identical to the last commit. `main` untouched at `f127ebf`. Nothing pushed.
- **Memory-keeper:** not available in this session; skipped. Claude project memory was updated instead.

## Outstanding Items

- Owner decisions: daily-limit accounting, automatic company creation, Consider gating, concurrency default, merge to `main`, repository location.
- No full 6-company live analysis reviewed yet.
- AI snapshots do not feed manual snapshots or scenarios.
- Model conservatism leaves some snapshot fields empty.
- Hardcoded data-center wording in the watchlist UI.
- Off-machine backup; stray backup sidecar files.

## Next Steps

1. Portfolio import for about 100 holdings (stocks, ETFs, crypto): get the file layout from the owner, confirm the scope change against the original brief, then build an additive holdings table with a preview-then-confirm import.
2. Move or clone the source repository into this project and add a `CLAUDE.md`.
3. Resolve the open decisions; fast-forward `main`.
4. Run and review a full live sector analysis; tune snapshot prompts.
5. Prefill the manual snapshot form from an AI snapshot.
6. Generalize watchlist wording.
7. Encrypted off-machine backup.
