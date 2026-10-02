# Working rules for agents — INVEST-IGATOR

These rules apply to every coding agent (Claude, Codex or any other) working on this project. `CLAUDE.md` imports this file; do not keep a second copy.

## Start of a thread

1. Start in the project folder `~/Desktop/_LOCAL APP DEVELOPMENT/INVEST-IGATOR/`.
2. Read `invest-igator/source/HANDOFF.md`, then `invest-igator/source/docs/NEXT-SESSIONS-PLAN.md`.
3. Run `git status` in `invest-igator/source/`. If the tree is dirty, or line 2 of `HANDOFF.md` says another agent is working, stop and ask the owner. Do not edit around someone else's unfinished work.

## One agent at a time

- When you start changing files, write `Working: <agent>, <date>` on line 2 of `HANDOFF.md`. Remove it when you finish.
- Commit before you stop. Git is how the next agent sees what you did.
- `HANDOFF.md` is rewritten as a whole at each wrap-up, in one voice. Do not append corrections to it.
- Session reports (`Session Reports/`) and session logs (`docs/session-logs/`) are never edited after they are written. Corrections go in the next report.

## Where things are

| What | Location |
|---|---|
| Source (git, edit here) | `invest-igator/source/` |
| Installed releases (immutable) | `invest-igator/releases/<version>/` |
| Active release | `invest-igator/current` (symlink) |
| Database, backups, logs, API key | `~/Library/Application Support/InvestmentResearch/` |
| Services | LaunchAgents `com.investmentresearch.app` (port 5191) and `com.investmentresearch.backup` |
| Owner's reference files | project folder: `ITERATIONS_260913.txt`, the v008 brief, the reference image, `Google_Finance_Portfolio.xlsx` |

Never edit `current` or any `releases/<version>` folder. Never read, print or copy API key values.

## Changing and releasing

1. Edit only in `invest-igator/source/`. Bump the version in `package.json` and the literal in `server/app.js`.
2. Verify: `npm test`, `npm run build`, then the browser suite with Playwright 1.55.0 installed in a scratch folder: `PLAYWRIGHT_MODULE_PATH=<scratch>/node_modules/playwright/index.mjs node tests/browser-research.mjs`. It uses the installed Google Chrome and a synthetic provider and makes no paid calls.
3. Deploy with `python3 scripts/upgrade-ai.py` from `source/`. It backs up the database, copies the tree to `releases/<version>`, swaps `current`, restarts the app, checks the workspace is unchanged and rolls back on failure.
4. Afterwards confirm `/api/workspace` reports the new version and append the results to `TEST-RESULTS.md`.

## Limits that need the owner

- Paid OpenAI research: small bounded checks in a disposable database are acceptable (`scripts/verify-live-eps.mjs`, `scripts/verify-live-sector.mjs`). Never start a multi-company live analysis unasked.
- Never invent prices, forecasts, ratings or decisions to fill a screen. Missing data is shown as missing.
- The owner holds no stock. `Google_Finance_Portfolio.xlsx` is a what-if list of research candidates. Never describe it as holdings. Only the owner marks a company Invested.
- The app never executes trades and does not judge personal suitability.
- Names kept on purpose: the export format identifier `investment-research`, the data folder `InvestmentResearch`, the LaunchAgent labels and the `RESEARCH_*` environment variables. Changing any of them affects stored data or the running service and needs the owner's approval.
