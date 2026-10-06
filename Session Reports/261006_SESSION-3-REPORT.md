# Session 3 Report — INVEST-IGATOR

## Session Overview

- **Date:** 2026-10-06.
- **Scope:** Session 3 of `docs/NEXT-SESSIONS-PLAN.md`, started when the owner answered "Proceed on all": merge the Session 2 branch, then build and ship the research workflow — a name-or-ticker intake on the home screen, automatic Research / Watch / Declined dispositions with an owner override and an owner-only Invested state, and the stored research shown on the home screen and company pages.
- **Outcome:** release **1.4.0** is live. The owner's existing research now appears on the home screen without any paid call: ETN, ACM and WSP as Watch; VRT and NVT as Research; the four never-researched companies as Research. No research data changed; the workspace revision is the same as on 2026-10-02.

## Work Completed

1. **Housekeeping.** `session-2-invest-igator` fast-forwarded into `main`; the fully merged `releases-1.1.0-to-1.3.1` branch deleted; work done on `session-3-workflow` and merged into `main` at the end.
2. **Dispositions** (`server/dispositions.js`, `server/workflow.js`). An additive append-only `dispositions` table. The app files a company from its latest completed assessment (Consider → Watch with a Consider highlight, Watch → Watch, Research further → Research, Pass → Declined; anything missing → Research, never Declined), recording the run, the rating and the previous value. An owner setting stands until released; a newer disagreeing assessment becomes a notice. Invested is owner-only and records entry date, price and currency, with quantity, amount and a note optional. On first start, companies without a disposition were backfilled from their stored assessment or legacy status without writing the workspace.
3. **Intake** (`server/intake.js`, run kind `intake` in `server/research.js`). One run verifies the owner's entries with a web search and a strict JSON extraction; the app normalizes tickers, checks currencies, matches the workspace and classifies each entry as resolved, existing, ambiguous, unresolved or not a company. Verified companies are created with the exchange, currency and description from the research plus a provenance note (author *Company intake*), filed as Research, and a snapshot-first review is queued for each. Ambiguous entries show their candidates for the owner to choose; entries already in the workspace need no provider call.
4. **Research updates the record.** When a run carries a snapshot, a blank exchange or currency on the company record is filled from the verified snapshot identity as a new revision, and the run's fingerprint is re-stamped so the fill-in does not read as an owner change. Nothing already entered is overwritten.
5. **Home screen** (`public/home.js`). Intake box with per-entry status and choice buttons; tiles; tabs for Watch & Invested, Research, Declined and Archived; rows with rating and date, one-line summary, dated price with age and source, forward P/E, EV/EBITDA, FCF yield, market cap, revenue growth, research progress and the disposition control with an inline Invested form; polling while research runs. The company page opens with the same research summary (key figures, what challenges the case, what would change the view, catalysts) above the owner's notes. "DATA-CENTER SUPPLY CHAIN" and "Supply-chain role" are gone; the status select is hidden (the field stays in the record).
6. **API** (`server/app.js`): `GET /api/workflow/overview`, `GET /api/workflow/intakes`, `POST /api/workflow/intake`, `POST /api/workflow/intake/:id/choose`, `POST /api/workflow/dispositions`, all behind the existing origin protections. `ResearchService` gained `startRun` (shared limit checks), `onRunFinished` and `restampFingerprint`.
7. **Verification and release.** 63 automated tests, build check, 23 browser checks; rehearsal on a restored production backup; deployment with `scripts/upgrade-ai.py`; installed checks on both addresses. Documentation updated (`README.md`, `docs/API.md`, `docs/AI-RESEARCH.md`, `docs/ARCHITECTURE.md`, `docs/NEXT-SESSIONS-PLAN.md`, `TEST-RESULTS.md`, `HANDOFF.md`).

## Files Changed

| File | Change |
|---|---|
| `server/workflow.js`, `server/dispositions.js`, `server/intake.js` | New: workflow service, disposition mapping and override validation, intake resolution |
| `server/research.js` | `intake` run kind, `startRun`, `origin`/`extra` on run documents, `onRunFinished` hook, `restampFingerprint`, exported `companyFingerprint`, intake label in the inbox |
| `server/app.js`, `server/index.js` | Workflow routes; version literal 1.4.0; service wiring |
| `public/home.js` | New: home screen, intake UI, disposition control, company research summary |
| `public/app.js` | Home routing (`#watchlist` → `#home`), company page summary, hidden status field, wording, workspace re-read when server-created companies appear |
| `public/index.html`, `public/research-panel.js`, `public/styles.css` | Navigation, intake run labels and links, styles |
| `tests/workflow.test.js` | New: 10 tests |
| `tests/browser-fixture-server.mjs`, `tests/browser-research.mjs` | Intake fixture, workflow wiring, 5 new checks, failure diagnostics |
| `package.json`, `package-lock.json` | Version 1.4.0 |
| Docs, `TEST-RESULTS.md`, `HANDOFF.md`, `verification/` | Updated; new screenshots and `installed-ai-1.4.0.json` |

Outside the repository: `releases/1.4.0` created and `current` repointed by the upgrade script; two database backups.

## Testing & Validation

| Check | Result |
|---|---|
| Automated tests | 63 passed, 0 failed (one intermittent failure in a run overlapping another server process; five further runs clean) |
| Build check | Passed |
| Browser suite, synthetic provider | 23 passed (18 existing + 5 new), no page errors |
| Rehearsal on restored production backup (port 5192, no key) | Dispositions, prices and multiples as expected; workspace revision unchanged |
| Deployment of 1.4.0 | Workspace and revision unchanged; backups before and after |
| Installed check, both addresses | Passed (`verification/installed-ai-1.4.0.json`); Home renders the real data on desktop and mobile; error log empty |

No paid OpenAI calls were made in this session.

## Issues Encountered

| Issue | Resolution |
|---|---|
| Companies created on the server (intake, sector analysis) were unknown to the browser's cached workspace; their pages showed "Company not found" until a reload | The app re-reads the workspace when the overview lists a new company or a company route misses |
| Filling exchange and currency after a run would have marked that run's research basis as changed, forcing an acknowledgment before saving it as evidence | The run's fingerprint is re-stamped after the app's own fill-in |
| Duplicate intake entries differing only by case kept the last spelling | First spelling kept |
| A browser check waited for a field inside the closed research panel | Check corrected |

## Outstanding Items

- Owner: try the intake box and an override; tell the next agent which Tiingo and FMP keys may be shared and whether the daily price fetch may use the backup LaunchAgent's schedule (Session 4).
- VRT's record still has a blank exchange and currency (its snapshot predates 1.4.0); the home screen shows them "from research" until its next run.
- Delete `~/.codex/.chatgpt-projects/…/investment-research.moved-2026-10-02` (1.4.0 shipped from the new location) and the merged branches `session-2-invest-igator` and `session-3-workflow`.
- Backlog unchanged: off-machine backup, backup sidecar files, full live sector review.

## Next Steps

Session 4 (release 1.5.0): price and financials feeds modeled on STOCKER, feed-first snapshot collection, per-stage model setting, asset type on each record. See `docs/NEXT-SESSIONS-PLAN.md`.
