# Investment Research 1.0 — architecture

Source of truth: investment-research-app-brief__v008__2026-09-06.md (immutable reference). This application does not use the household financial files.

Inspected the server Mac (macOS), local app README/package manifests, project AGENTS.md, and existing launchd backup convention. Existing local apps use Node 20, Express and better-sqlite3. No reverse proxy or protected remote route was established. The owner confirmed this local server is suitable. The application binds **127.0.0.1 only**, with exact Host checks and same-origin write protection. It is available to browsers on this Mac, not the LAN or internet. The operating-system account and loopback boundary provide local access; there is no claim of remote authentication. No existing app, database, port binding or service is replaced.

A separate Node/Express service serves a small accessible browser application and same-origin JSON API. SQLite WAL on local disk is authoritative. A single versioned workspace document makes complete-workspace transactions and portable restoration straightforward at household scale. SQLite stores a random optimistic revision alongside the document; all mutations compare it inside an immediate transaction. Snapshots, scenarios, decisions and company/evidence history are append-only through ordinary API routes. Complete restore is the only replacing operation.

All numerical data starts null/absent. Only the seven specified companies and their explicitly carried-forward source notes are seeded, once when the database is first initialized. Empty restored workspaces remain empty after restart.

Backups use the SQLite online backup API, not filesystem copies of live WAL databases. Pre-restore backups are made under a write transaction before replacement. Retention: latest 30 scheduled/manual backups; pre-restore backups retained until the owner explicitly removes them. Daily launchd backup follows the existing Mac convention. Backups are on this machine; off-machine disaster recovery is an explicit limitation.

Official guidance checked September 6, 2026:
- https://www.sqlite.org/wal.html — WAL requires all processes on the same host; do not deploy on network storage.
- https://www.sqlite.org/backup.html — consistent online database backups.
- https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md — synchronous transactions and backup API.
- https://expressjs.com/en/advanced/best-practice-security/ — untrusted input and production security.

## Release 1.0.1 — confirmed home-network access

The owner confirmed “Trusted home network; no login.” The installed app now binds to 127.0.0.1 and the specific private IPv4 address <lan-address>, accepting peers only in loopback or <trusted-subnet>. Each request must use an exact configured Host; writes must match that Host's Origin. No proxy trust, wildcard origin, public listener, router or firewall change is introduced. Access is deliberately shared with every trusted LAN device, with no app login or TLS. The UI reports the active boundary and identifies the server as the data location. This supersedes the initial loopback-only installation note above. Schema and persistence are unchanged.

## Release 1.1.0 — AI research service

The existing Express process now owns an optional OpenAI-backed research service. Additive SQLite tables hold settings, queued/running/completed research, captured company context, provider source references, token usage, and accepted-evidence mappings. A single in-process worker performs web research, a separate counterevidence search, and structured assessment. Follow-up questions perform their own web search with bounded company-specific history. HTTP requests enqueue durable jobs and return immediately; the browser polls progress.

The persistent right panel is mounted outside the main route-rendering element. Company page navigation updates its focus; the inbox offers historical run selection. No model-generated HTML executes. Citations are rendered from HTTP(S) source references returned by the API. Accepting a report appends an AI-authored evidence note using the same workspace revision checks as manual edits, with an idempotency mapping committed in the same SQLite transaction.

No scheduler, trade execution, portfolio suitability analysis or automatic financial snapshot ingestion is included. The first release operates on demand; see `AI-RESEARCH.md` for setup, transmission scope, usage bounds and recovery semantics.
