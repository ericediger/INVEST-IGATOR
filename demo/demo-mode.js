/* ===== DEMO MODE — the real INVEST-IGATOR front end on an in-memory workspace with fictional sample data. =====
   The page loads the unmodified files from ../public/. This script replaces window.fetch for /api/* only: every
   response comes from demo-data.json (captured from a disposable copy of the server running a scripted stand-in
   for the OpenAI provider and a fake price feed) or from the in-memory state below. Nothing is stored anywhere;
   reload the page and the sample workspace is back. No real company is described. */
(() => {
  const realFetch = window.fetch.bind(window);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const today = () => new Date().toISOString().slice(0, 10);
  const days = (date) => (date ? Math.max(0, Math.round((Date.parse(today()) - Date.parse(date)) / 86400000)) : null);
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  const DEMO = 'Demo mode: ';
  let S = null;

  const ready = realFetch(new URL('demo-data.json', document.baseURI)).then((r) => r.json()).then((d) => {
    S = {
      ws: clone(d.workspace), overview: clone(d.overview), intakes: [], status: clone(d.status),
      runs: clone(d.runs), runDetail: clone(d.runDetail), analyses: clone(d.analyses), analysisDetail: clone(d.analysisDetail),
      feeds: clone(d.feeds), prices: clone(d.prices), after: d.after, timers: [],
    };
    S.ws.access = 'Demo';
    S.ws.accessDescription = 'Public demo: fictional sample data held in memory. Nothing is stored and no key is needed.';
    S.ws.version = '1.5.1 · demo';
    banner();
  });

  function banner() {
    const b = document.createElement('div');
    b.id = 'demo-banner';
    b.innerHTML = 'Public demo · fictional companies, scripted research, nothing is saved · <a href="https://github.com/ericediger/INVEST-IGATOR">INVEST-IGATOR on GitHub</a>';
    b.style.cssText = 'position:sticky;top:0;z-index:50;font-size:13px;padding:7px 16px;text-align:center;background:#17322a;color:#a3e6c4;border-bottom:1px solid #2b342e;font-weight:600';
    document.body.prepend(b);
  }

  // ---- workspace ----
  const W = () => S.ws.workspace;
  const bump = () => { S.ws.revision = uuid(); return { revision: S.ws.revision, workspace: W() }; };
  const company = (id) => W().companies.find((c) => c.id === id) || fail('Company not found', 404);
  const entry = (id) => S.overview.companies.find((c) => c.id === id) || fail('Company not found', 404);
  const copy = (c) => { const { history, ...rest } = c; return clone(rest); };
  const results = (scenario, snapshot) => {
    if (!scenario || !snapshot || !(snapshot.price.value > 0)) return null;
    const out = {};
    for (const k of ['bear', 'base', 'bull']) { const s = scenario[k]; if (!(s.eps > 0) || !(s.pe > 0)) return null; const price = s.eps * s.pe; out[k] = { price, priceReturn: (price / snapshot.price.value - 1) * 100 }; }
    if (out.bear.price > out.base.price || out.base.price > out.bull.price) fail('Bear implied price must be ≤ base, and base ≤ bull. Correct assumptions before saving.');
    return out;
  };
  function syncEntry(c) {
    const e = S.overview.companies.find((x) => x.id === c.id);
    if (!e) return;
    Object.assign(e, { ticker: c.ticker, name: c.name, role: c.role, archivedAt: c.archivedAt, reviewDate: c.reviewDate, status: c.status, notes: { thesis: !!c.thesis, risks: !!c.risks, disconfirming: !!c.disconfirming } });
    e.listing = { exchange: c.exchange || e.listing.exchange, currency: c.currency || e.listing.currency, fromResearch: e.listing.fromResearch };
    e.manualSnapshots = W().snapshots.filter((s) => s.companyId === c.id).length;
    e.scenarios = W().scenarios.filter((s) => s.companyId === c.id).length;
    e.decisions = W().decisions.filter((s) => s.companyId === c.id).length;
  }
  function newEntry(c) {
    return { id: c.id, ticker: c.ticker, name: c.name, role: c.role, archivedAt: null, reviewDate: c.reviewDate, status: c.status, listing: { exchange: c.exchange || '', currency: c.currency || null, fromResearch: false }, profile: { assetType: 'Company', feedSymbol: '', cik: null, coingeckoId: '', feedStatus: null, feedStatusAt: null, updatedAt: now() }, feedPrice: null, freshness: { assessmentAgeDays: null, priceAgeDays: null, stale: false, priceStale: false }, notes: { thesis: !!c.thesis, risks: !!c.risks, disconfirming: !!c.disconfirming }, disposition: { value: 'Research', setBy: 'app', since: now(), runId: null, rating: null, previous: null, note: 'No assessment yet.', invested: null, highlight: null }, notice: null, assessment: null, price: null, figures: null, pending: null, manualSnapshots: 0, scenarios: 0, decisions: 0 };
  }
  function mutate(action, payload) {
    if (!payload || typeof payload !== 'object') fail('An object payload is required');
    const stamp = now(), w = W();
    if (action === 'company.create') {
      const c = { ...payload, ticker: String(payload.ticker || '').toUpperCase(), id: uuid(), revision: 1, archivedAt: null, createdAt: stamp, updatedAt: stamp, history: [] };
      if (!c.ticker || !c.name || !c.role) fail('Ticker, name and what the company does are required.');
      w.companies.push(c); S.overview.companies.push(newEntry(c)); return;
    }
    const c = company(payload.companyId), { companyId, ...input } = payload;
    if (action === 'company.update' || action === 'company.archive' || action === 'company.restore') {
      c.history.push(copy(c));
      if (action === 'company.update') Object.assign(c, input, { ticker: String(input.ticker || c.ticker).toUpperCase() });
      Object.assign(c, { revision: c.revision + 1, updatedAt: stamp });
      if (action === 'company.archive') c.archivedAt = stamp;
      if (action === 'company.restore') c.archivedAt = null;
    } else if (action === 'evidence.add') w.evidence.push({ ...input, id: uuid(), companyId, enteredAt: stamp });
    else if (action === 'snapshot.add') w.snapshots.push({ ...input, id: uuid(), companyId, enteredAt: stamp, provenance: 'Manual snapshot' });
    else if (action === 'scenario.add' || action === 'scenario.recalculate') {
      let s;
      if (action === 'scenario.recalculate') {
        const old = w.scenarios.find((x) => x.id === input.scenarioId) || fail('Scenario not found');
        const latest = w.snapshots.filter((x) => x.companyId === companyId).sort((a, b) => a.quoteDate.localeCompare(b.quoteDate)).at(-1) || fail('Add a snapshot first');
        const { id, companyId: _c, version, createdAt, formulaVersion, ...rest } = old;
        s = { ...rest, referenceSnapshotId: latest.id, supersedesId: old.id };
      } else s = input;
      const ref = w.snapshots.find((x) => x.id === s.referenceSnapshotId) || fail('Reference snapshot not found');
      results(s, ref);
      const version = w.scenarios.filter((x) => x.companyId === companyId).length + 1;
      w.scenarios.push({ ...s, id: uuid(), companyId, version, createdAt: stamp, formulaVersion: 1 });
    } else if (action === 'decision.add') {
      const snapshot = input.snapshotId ? w.snapshots.find((x) => x.id === input.snapshotId) : null, scenario = input.scenarioId ? w.scenarios.find((x) => x.id === input.scenarioId) : null;
      w.decisions.push({ ...input, id: uuid(), companyId, createdAt: stamp, basis: { company: copy(c), evidence: (input.evidenceIds || []).map((i) => w.evidence.find((e) => e.id === i)).filter(Boolean), snapshot, scenario, calculations: results(scenario, snapshot), formulaVersion: 1 } });
    } else fail('Unknown action', 404);
    syncEntry(c);
  }

  // ---- research ----
  const runList = (companyId) => S.runs.filter((r) => !companyId || r.companyId === companyId).map((r) => ({ ...r, acceptedEvidenceId: S.runDetail[r.id]?.acceptedEvidenceId || null }));
  function accept(id) {
    const run = S.runDetail[id] || fail('Run not found', 404);
    if (run.acceptedEvidenceId) return { evidenceId: run.acceptedEvidenceId, ...bump() };
    if (!run.companyId || !run.report) fail('Only a completed company assessment can be saved as evidence.');
    const r = run.report, text = [`AI assessment · ${r.recommendation} · evidence confidence ${r.evidenceConfidence}`, r.summary.text, `Why: ${r.rationale.text}`, `Challenges: ${r.bearCase.map((p) => p.text).join(' ')}`, '(Scripted demo assessment; no real company is described.)'].join('\n\n');
    W().evidence.push({ id: uuid(), companyId: run.companyId, note: text, source: { title: `AI assessment · ${run.context.company.ticker} · ${run.createdAt.slice(0, 10)}`, url: run.sources[0]?.url || null, publicationDate: null }, asOfDate: run.context.asOf, author: 'AI research · reviewed by user', supersedesId: null, enteredAt: now() });
    run.acceptedEvidenceId = W().evidence.at(-1).id;
    const e = S.overview.companies.find((x) => x.id === run.companyId); if (e?.assessment?.runId === id) e.assessment.accepted = true;
    return { evidenceId: run.acceptedEvidenceId, ...bump() };
  }

  // ---- workflow ----
  const autoFor = (rating) => ({ Consider: 'Watch', Watch: 'Watch', Pass: 'Declined' })[rating] || 'Research';
  function setDisposition(body) {
    const e = entry(body.companyId), d = e.disposition, previous = d.value;
    if (body.disposition === 'auto') {
      const a = e.assessment;
      e.disposition = { value: autoFor(a?.rating), setBy: 'app', since: now(), runId: a?.runId || null, rating: a?.rating || null, previous, note: a ? `You released your setting; applied from the ${a.rating} assessment of ${a.asOf}.` : 'You released your setting; no assessment yet.', invested: null, highlight: a?.rating === 'Consider' ? 'Consider' : null };
    } else {
      if (body.disposition === 'Invested') { const i = body.invested || {}; if (!i.date || !(i.price > 0) || !i.currency) fail('Marking a company Invested needs the entry date and the entry price.'); if (i.date > today()) fail('The entry date cannot be in the future.'); }
      e.disposition = { value: body.disposition, setBy: 'owner', since: now(), runId: null, rating: null, previous, note: body.note || (body.disposition === 'Invested' ? body.invested.note : '') || 'Set by you.', invested: body.disposition === 'Invested' ? { ...body.invested, note: body.invested.note || '' } : null, highlight: null };
    }
    e.notice = null;
    return e;
  }
  function fillNotes(companyId) {
    const e = entry(companyId), c = company(companyId), a = e.assessment || fail('No assessment to fill from.');
    const d = a.detail, line = `\n\nFrom the research assessment of ${a.asOf} (scripted demo).`;
    if (!c.thesis) c.thesis = `${a.summary}\n\n${d.rationale}${line}`;
    if (!c.risks) c.risks = `${d.bearCase.map((t) => `• ${t}`).join('\n')}${line}`;
    if (!c.disconfirming) c.disconfirming = `${[...d.invalidationTriggers, ...d.missingEvidence].map((t) => `• ${t}`).join('\n')}${line}`;
    c.revision += 1; c.updatedAt = now(); bump(); syncEntry(c); return e;
  }
  // Adds a company captured in the "after" state of the demo server (HLTR or NRDL): workspace record, overview entry, runs, prices.
  function addCaptured(ticker, { pendingFirst = true } = {}) {
    const A = S.after, wc = A.workspace.workspace.companies.find((c) => c.ticker === ticker), oe = A.overview.companies.find((c) => c.ticker === ticker);
    if (!wc || !oe || W().companies.some((c) => c.id === wc.id)) return W().companies.find((c) => c.ticker === ticker)?.id || null;
    W().companies.push(clone(wc)); for (const ev of A.workspace.workspace.evidence) if (ev.companyId === wc.id) W().evidence.push(clone(ev));
    bump();
    const done = clone(oe), runs = A.runs.filter((r) => r.companyId === wc.id);
    const final = () => { const i = S.overview.companies.findIndex((c) => c.id === wc.id); if (i >= 0) S.overview.companies[i] = done; for (const r of runs) { if (!S.runs.some((x) => x.id === r.id)) S.runs.unshift(clone(r)); S.runDetail[r.id] = clone(A.runDetail[r.id]); } S.prices[wc.id] = clone(A.prices[wc.id] || []); };
    if (!pendingFirst) { S.overview.companies.push(done); final(); return wc.id; }
    const e = { ...newEntry(wc), listing: clone(oe.listing), pending: { runId: runs[0]?.id || uuid(), kind: 'review', status: 'running', stage: '1 of 5 · Collecting financial and market data', createdAt: now() } };
    S.overview.companies.push(e);
    S.timers.push(setTimeout(() => { e.pending.stage = '3 of 5 · Gathering evidence'; }, 2500), setTimeout(final, 5000));
    return wc.id;
  }
  function startIntake(entries) {
    const list = [...new Set((entries || []).map((s) => String(s).trim()).filter(Boolean))].slice(0, 10);
    if (!list.length) fail('Enter at least one company name or ticker.');
    const intake = { id: uuid(), status: 'running', stage: '1 of 2 · Verifying listings', createdAt: now(), updatedAt: now(), error: null, entries: list.map((query) => ({ query, status: 'pending', match: null, candidates: [], notes: '', existingCompanyId: null, created: false, companyId: null, reviewRunId: null, outcome: null })) };
    S.intakes.unshift(intake);
    const captured = S.after.intakes.intakes[0].entries;
    S.timers.push(setTimeout(() => { intake.stage = '2 of 2 · Preparing the company list'; intake.updatedAt = now(); }, 1400));
    S.timers.push(setTimeout(() => {
      intake.entries = intake.entries.map((e) => {
        if (/helios/i.test(e.query)) {
          const existing = W().companies.find((c) => c.ticker === 'HLTR');
          if (existing) return { ...clone(captured[0]), query: e.query, status: 'existing', existingCompanyId: existing.id, companyId: existing.id, created: false, outcome: 'already_listed' };
          const id = addCaptured('HLTR');
          return { ...clone(captured[0]), query: e.query, companyId: id, outcome: 'research_queued' };
        }
        if (/nordlicht/i.test(e.query)) return { query: e.query, status: 'ambiguous', match: null, candidates: clone(captured[1].candidates), notes: captured[1].notes, existingCompanyId: null, created: false, companyId: null, reviewRunId: null, outcome: null };
        return { ...e, status: 'unresolved', notes: 'Demo mode: verifying a listing needs the research key the real app uses. Try “Helios Transformers” or “Nordlicht Energie” to see the scripted flow.' };
      });
      const n = intake.entries.filter((e) => e.status === 'resolved').length, amb = intake.entries.filter((e) => e.status === 'ambiguous').length;
      intake.status = 'completed'; intake.stage = `${n} ${n === 1 ? 'company' : 'companies'} identified${amb ? ` · ${amb} needs your choice` : ''}`; intake.updatedAt = now();
    }, 3000));
    return intake;
  }
  function choose(intakeId, body) {
    const intake = S.intakes.find((i) => i.id === intakeId) || fail('Intake not found', 404), e = intake.entries[body.index] || fail('Entry not found', 404);
    if (e.status !== 'ambiguous' || e.outcome) fail('This entry no longer needs a choice.');
    if (body.candidate === null || body.candidate === undefined) { e.outcome = 'dismissed'; e.outcomeNote = 'Skipped by you.'; return intake; }
    const cand = e.candidates[body.candidate] || fail('Candidate not found', 404);
    let id = cand.ticker === 'NRDL' ? addCaptured('NRDL') : null;
    if (!id) { mutate('company.create', { ticker: cand.ticker, name: cand.name, exchange: cand.exchange || '', currency: cand.quoteCurrency || null, role: cand.description || 'Added by name or ticker', status: 'Researching', thesis: '', risks: '', disconfirming: '', reviewDate: null, reviewTrigger: '' }); id = W().companies.at(-1).id; }
    Object.assign(e, { status: 'resolved', match: cand, chosenBy: 'owner', created: true, companyId: id, outcome: cand.ticker === 'NRDL' ? 'research_queued' : 'added' });
    return intake;
  }
  function overview() {
    for (const e of S.overview.companies) {
      const a = days(e.assessment?.asOf), p = days(e.price?.asOfDate);
      e.freshness = { assessmentAgeDays: a, priceAgeDays: p, stale: a != null && a > 30, priceStale: p != null && p > 7 };
      if (e.price) e.price.ageDays = p;
    }
    const cs = S.overview.companies, live = cs.filter((c) => !c.archivedAt);
    return { today: today(), companies: cs, counts: { main: live.filter((c) => ['Watch', 'Invested'].includes(c.disposition.value)).length, watch: live.filter((c) => c.disposition.value === 'Watch').length, invested: live.filter((c) => c.disposition.value === 'Invested').length, research: live.filter((c) => c.disposition.value === 'Research').length, declined: live.filter((c) => c.disposition.value === 'Declined').length, archived: cs.length - live.length, researching: cs.filter((c) => c.pending).length }, intakes: S.intakes, feeds: S.overview.feeds };
  }

  // ---- router ----
  function route(method, path, q, body, ifMatch) {
    const post = method === 'POST';
    if (path === 'workspace') return json({ ...S.ws, today: today() });
    if (path === 'health') return json({ ok: true, schemaVersion: 1 });
    if (path === 'export') return json({ format: 'investment-research', schemaVersion: 1, exportedAt: now(), workspace: W() });
    if (path === 'backups') return json({ backups: [] });
    if (path === 'backup') return json({ error: DEMO + 'nothing is stored, so there is nothing to back up. The installed app writes a verified SQLite backup here.' }, 400);
    if (path === 'restore/preview' || path === 'restore') return json({ error: DEMO + 'importing a workspace is disabled. The installed app previews the file, backs up the database and then replaces the workspace.' }, 400);
    if (path === 'actions' && post) { if (ifMatch && ifMatch !== S.ws.revision) fail('This workspace changed in another session. Reload or review and reapply your draft.', 409); mutate(body.action, body.payload); return json(bump()); }
    if (path === 'research/status') return json(S.status);
    if (path === 'research/runs' && !post) return json({ runs: runList(q.get('companyId')) });
    if (path === 'research/runs' && post) return json({ error: DEMO + 'live research sends the company to OpenAI and needs the key the installed app holds. Every company here already carries a scripted assessment; open it from Home or the inbox.' }, 400);
    let m;
    if ((m = path.match(/^research\/runs\/([^/]+)$/))) return json(S.runDetail[m[1]] ? { ...S.runDetail[m[1]], acceptedEvidenceId: S.runDetail[m[1]].acceptedEvidenceId || null } : fail('Run not found', 404));
    if ((m = path.match(/^research\/runs\/([^/]+)\/cancel$/))) return json(S.runDetail[m[1]] || fail('Run not found', 404));
    if ((m = path.match(/^research\/runs\/([^/]+)\/accept$/))) return json(accept(m[1]));
    if (path === 'research/settings' && post) { if (ifMatch && ifMatch !== S.status.settings.revision) fail('The mandate changed in another session. Reload it first.', 409); S.status.settings = { ...S.status.settings, ...body, revision: uuid() }; return json(S.status.settings); }
    if (path === 'research/export') return json({ format: 'investment-research-ai-archive', schemaVersion: 2, exportedAt: now(), settings: S.status.settings, runs: Object.values(S.runDetail), analyses: Object.values(S.analysisDetail) });
    if (path === 'research/analyses' && !post) return json({ analyses: S.analyses });
    if (path === 'research/analyses' && post) return json({ error: DEMO + 'a sector analysis makes 3 + 5 × companies research requests and needs the OpenAI key. The completed “Data-center power and cooling” analysis below shows the result.' }, 400);
    if ((m = path.match(/^research\/analyses\/([^/]+)$/))) return json(S.analysisDetail[m[1]] || fail('Analysis not found', 404));
    if ((m = path.match(/^research\/analyses\/([^/]+)\/cancel$/))) return json({ error: DEMO + 'this analysis has already completed.' }, 400);
    if (path === 'workflow/overview') return json(overview());
    if (path === 'workflow/intakes') return json({ intakes: S.intakes });
    if (path === 'workflow/intake' && post) return json(startIntake(body.entries), 202);
    if ((m = path.match(/^workflow\/intake\/([^/]+)\/choose$/))) return json(choose(m[1], body));
    if (path === 'workflow/dispositions' && post) return json(setDisposition(body));
    if (path === 'workflow/notes' && post) return json(fillNotes(body.companyId));
    if (path === 'feeds/status') return json(S.feeds);
    if ((m = path.match(/^feeds\/prices\/([^/]+)$/))) return json({ prices: S.prices[m[1]] || [] });
    if (path === 'feeds/refresh' && post) return json({ requests: 0, updated: 0, failed: 0, skipped: S.overview.companies.length, details: [], note: DEMO + 'prices are fixed sample values.' });
    if (path === 'feeds/profile' && post) { const e = entry(body.companyId); e.profile = { ...e.profile, assetType: body.assetType || e.profile.assetType, feedSymbol: body.feedSymbol || '', coingeckoId: body.coingeckoId || '', updatedAt: now() }; return json(e.profile); }
    return json({ error: 'Not found' }, 404);
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const u = new URL(url, location.href);
    if (!u.pathname.startsWith('/api/')) return realFetch(input, init);
    await ready;
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { return json({ error: 'Invalid JSON' }, 400); }
    const headers = init.headers || {};
    try { return route(method, u.pathname.slice(5), u.searchParams, body, headers['If-Match']); } catch (e) { return json({ error: e.message || 'Demo error' }, e.status || 400); }
  };
})();
