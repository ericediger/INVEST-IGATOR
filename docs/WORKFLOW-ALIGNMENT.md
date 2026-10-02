# Workflow alignment — October 2, 2026

> **Status, added later on October 2:** this is the Codex agent's summary of a conversation; the owner had not seen it and it is not an owner requirement. Three things in it are out of date: the merge to `main`, the repository move and the candidate-list ingestion were approved the same day; the owner holds no stock, so there is no "portfolio import"; and the owner added an owner-set **Invested** disposition. The code-evidence table below is accurate for 1.3.1. Current direction: `HANDOFF.md` and `docs/NEXT-SESSIONS-PLAN.md`. The app is now named INVEST-IGATOR.

This is a reconciliation of the installed application, the project handoff written by the other thread, and the owner's latest use-case discussion. It records the next product direction; it does not claim those changes have shipped. The original v008 brief and historical session reports remain historical references.

## Confirmed product direction

The owner brings a company name, ticker, several companies, or a sector. The assistant gathers the research; the platform analyzes it and determines a clear disposition. The owner should not have to supply the research fields manually before asking for research.

- Research should cover company identity, verified listing/exchange, quote/reporting currency, sector and supply-chain role, financial evidence, investment thesis, valuation, risks, disconfirming evidence and relevant catalysts, with sources, dates and explicit gaps.
- Use the disposition vocabulary **Watch, Research, Declined** consistently. Keep verification, confidence and job progress separate from disposition. Missing information is a reason for further research, not proof that the company should be declined.
- The **Watchlist contains Watch companies only**. Provide separate access to the research queue and declined companies without deleting their history.
- Make the main dashboard scannable, with a group summary and company contributions, then drill down into readable assessments, financials, sources and calculations. Existing edit forms should remain available as secondary controls.
- Show **both actual price performance and remaining modeled upside/downside**, for the group and each company. The owner explicitly requested both so market movement can be compared with the research case.
- Preserve earlier dated assessments and forecasts. Evaluate an old forecast against its own reference price, horizon and assumptions; do not replace it with today's forecast when judging the earlier assessment.

The prior conversation established this direction. No application changes implementing it were made in that conversation.

## Proposed defaults and unresolved choices

- An equally weighted research basket was proposed, so the dashboard need not depend on holdings. Weighting is a proposed default, not a record of actual ownership.
- The platform should determine the disposition, but whether to apply it automatically with an owner override or present it for approval has not been answered explicitly. Preserve the distinction between an AI assessment and an owner-recorded decision in either case.
- Both performance and modeled potential are confirmed. The comparison period, watch-entry versus common-calendar baseline, and treatment of membership changes are not yet specified. A common selected period is appropriate for comparing contributions; watch-entry returns can be shown separately with their dates.
- Actual price change is not dividend-inclusive total return. Price observations must have a date, listing, currency and compatible share/split basis. Missing or incompatible observations are unavailable, never zero.
- Remaining modeled returns use the latest suitable dated price and a named scenario version/target date. An analyst consensus target is a separate estimate, not an app-generated bear/base/bull model.
- Aggregate only explicitly eligible observations; show coverage, dates and weighting. When comparing two group bars, use the same eligible membership or clearly expose any difference. Do not average share prices across currencies or present local-currency price changes as a converted household return.
- Begin with dated observations collected on demand. The discussion did not approve a new live feed, scheduled paid research, broker integration or portfolio import.

## What the code actually implements

Audit baseline: source branch `releases-1.1.0-to-1.3.1`, commit `4a476c4`; installed `current` resolves to `releases/1.3.1`. All 19 files across `server/`, `public/`, `package.json` and `package-lock.json` match byte-for-byte, with no additional installed runtime files.

| Requirement | Current behavior and evidence | Remaining work |
| --- | --- | --- |
| Company/name/ticker intake | `public/research-panel.js` selects an existing company; `public/app.js` requires ticker, company name and role to create one. `server/research.js` accepts a company ID for a review. | Add minimal company/list intake with source-backed identity resolution; ask about genuinely ambiguous listings. |
| Sector intake and full research | `createAnalysis`, `advanceAnalysis` and `ensureCompanies` in `server/research.js` orchestrate discovery, snapshot-first reviews and comparison. | Reuse this pipeline and its durable queue for consistent intake and outcomes. |
| Complete company research | Reviews already gather supporting/challenging evidence and financial snapshots. Discovery can set exchange, currency and sector relevance on newly created companies. `accept()` saves only an evidence note; it does not populate existing research fields. | Structured, sourced profile updates with revision/conflict handling and retention of earlier evidence. A field being nonempty must not itself imply verification. |
| One disposition vocabulary | `server/model.js` stores Researching/Watching/Passed; AI schemas use Consider/Watch/Pass/Research further; manual decisions use Research/Watch/Pass/Revisit. These are separate today. | Define an explicit mapping and a current disposition record with reason, provenance and assessment reference. Preserve historical labels in archived records. |
| Watch-only list | `watchlist()` in `public/app.js` defaults to every active company and all statuses; the header count also counts all active companies. | Watch-only membership/counts plus separate Research and Declined views. Remove hardcoded data-center framing for the general research workflow. |
| Main research dashboard | `public/analysis.js` renders each saved sector analysis, with rankings and comparison bars for selected financial metrics. | A cross-sector watched-group dashboard with scannable company summaries. Existing financial-metric bars are not price-performance or group-return calculations. |
| Actual price performance | Dated observations exist inside manual and AI snapshots, but no watch-basket return series or contribution calculation exists. | Persist/identify suitable baseline and later observations; define membership, timing and weighting; calculate and test returns locally. |
| Modeled potential | `server/model.js` calculates saved manual EPS × P/E scenarios. The watchlist reads manual snapshots/scenarios; AI snapshots remain in AI history. | Connect sourced research and explicitly labeled assumptions to saved scenario versions. Use the current suitable price for remaining potential while preserving original calculations. |
| Earlier decisions/forecasts | Manual scenarios and decisions preserve earlier versions and bases. AI runs retain context, reports and sources. | Link new profile/disposition and performance records to those archives; expose original forecast versus later outcome without rewriting either. |

## Live state checked during this audit

The home-network page and `/api/health`, `/api/workspace`, `/api/research/runs`, `/api/research/analyses` all returned HTTP 200. Version 1.3.1 contains:

- 9 companies: 8 Researching, 1 Watching.
- 13 evidence notes; 0 manual snapshots, 0 saved scenarios, 0 manual decisions.
- 9 completed AI runs; 1 completed sector analysis; no queued/running work in those responses.

These counts match the earlier handoff and explain the apparent contradiction: companies have AI assessments while the main watchlist's manual financial/scenario columns remain empty. Do not manufacture return bars or silently change dispositions to fill those gaps.

## Reconciled implementation order

1. Resolve the existing label/status split and define sourced profile/disposition storage, immutable assessment references and handling of manual overrides.
2. Add company/list intake and connect completed research to the company assessment and disposition using the existing queue. Preserve sector discovery and financial-integrity checks.
3. Build the Watch-only dashboard and separate Research/Declined views, with readable company assessment drill-down.
4. Add dated actual-price observations, versioned valuation assumptions, and both group/company comparisons. Test dates, missing coverage, weighting, listing/currency/share basis, negative returns and original forecast preservation before displaying results.
5. Verify with synthetic provider and price fixtures, browser tests and a disposable restored database, then deploy through the existing backup/release switch procedure.

The other handoff's portfolio-import request remains a separate recorded request, pending its file/scope decisions. It is not a prerequisite for this research basket. Repository relocation, merging to main, provider-budget policy and off-machine backups remain separate operational items; this reconciliation neither executes them nor treats them as approved.

## Verification and boundaries

- Fresh `npm test`: **53 passed, 0 failed**. The first sandboxed attempt passed 48 and failed five network-dependent tests with `listen EPERM`; rerunning with local test-server permissions passed all 53. Tests use synthetic providers and disposable data.
- Fresh `npm run build`: passed production syntax checks.
- Source/installed runtime comparison: 19 files matched; no extra installed runtime files.
- Read-only LAN checks: five endpoints passed as described above.
- The 18 browser checks recorded for 1.3.1 are historical results, not a new browser run in this audit.
- No runtime code, deployment, production records, paid research, release pointers, repository location or branch history changed during this reconciliation. Source README and project handoff were updated to point to this document; the original session report remains intact.
