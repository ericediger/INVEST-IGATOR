# Verification — Investment Research 1.0.0

September 6, 2026. All numerical examples below are synthetic fixtures in disposable test databases, never seeded into the user workspace.

## Automated data/API checks

`npm test`: 14 tests passed, 0 failed.

- Exactly ETN, VRT, NVT, APH, PWR, FIX and ANET; no prices/scenarios/returns; seed setup does not reset edited research.
- Company create/edit/archive/restore, confirmation, retained revision history.
- SQLite close/reopen preserves the complete workspace and saved note.
- $100 reference → bear $60/−40%, base $100/0%, bull $150/+50%; independent $130 analyst target/+30%.
- Missing/zero/negative EPS → unavailable P/E. Negative earnings and FCF valid; finite/positive/currency/unit/date/period validation enforced.
- Incomplete/nonpositive EPS scenario chart unavailable; inconsistent currencies/share bases and unordered complete comparisons rejected.
- Existing decisions and scenarios unchanged after newer prices/research; explicit recalculation appends a version.
- Conflicting revision rejected; restoration rotates the revision to prevent stale pre-restore writes.
- JSON roundtrip into a separate database preserves every record, ID, relationship and decision basis.
- Unsupported/malformed exports, duplicate/invalid IDs, invalid relationships, tampered decision calculations and executable URLs leave current records unchanged.
- Verified pre-restore backup recovers the exact prior workspace; simulated backup failure aborts replacement.
- SQLite online backup restored separately, integrity checked and compared with the source.
- Empty restored workspace stays empty after restart; newer database schema rejected by old code.
- HTTP tests exercise two independent clients, stale writes, Host and cross-site protections on both pages and APIs, unsafe mutation origins, protected non-static data/source paths, malformed/oversized imports, CSP and framing protection.

`npm run build`: passed. Production consists of syntax-checked native ES modules and static assets; no TypeScript or bundler is used.

Dependency installation via `npm ci`: passed. Audit at installation: 0 vulnerabilities. Express 4.22.2; the query-parser transitive dependency is pinned to its patched 6.16.0 release. Existing unrelated applications are unchanged.

## Browser checks

Pending. Built-in browser tool reported “No browser is available.” Explicit permission to use a separate Playwright browser was requested. Desktop/mobile, keyboard, 200% zoom, browser draft preservation, screenshots and browser console inspection are not yet claimed as verified.

## Installed-service checks

Pending installation verification. See the operating guide for intended local access, service and backup configuration.
