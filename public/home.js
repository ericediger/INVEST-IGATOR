// Home: name-or-ticker intake, the Watch & Invested list with Research, Declined and Archived views, automatic dispositions with
// owner override (Invested is owner-only), and the research summary shown on each company page. Data: /api/workflow/overview.
import {showRun,progressHTML} from './research-panel.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=s=>s?new Date(s).toLocaleString():'—';
const big=v=>{const a=Math.abs(v);return a>=1e9?(v/1e9).toFixed(2)+'bn':a>=1e6?(v/1e6).toFixed(1)+'m':a>=1e3?(v/1e3).toFixed(1)+'k':v.toFixed(2);};
const money=(v,c)=>v==null?'n/a':`${c?esc(c)+' ':''}${big(v)}`;
const x=v=>v==null?'n/a':v.toFixed(1)+'×';
const pct=v=>v==null?'n/a':(v>0?'+':'')+v.toFixed(1)+'%';
const priceText=p=>p?`${esc(p.currency||'')} ${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(p.value)}`:'No price yet';
const statusClass=s=>({completed:'consider',running:'watching',queued:'watching',failed:'danger',cancelled:'passed',interrupted:'warning'})[s]||'';
export const dispositionClass=d=>({Watch:'watching',Invested:'invested',Declined:'passed',Research:'further'})[d]||'';
export const ratingClass=r=>({Consider:'consider',Watch:'watching',Pass:'passed','Research further':'further'})[r]||'';
const autoFor=r=>({Consider:'Watch',Watch:'Watch',Pass:'Declined'})[r]||'Research';
const VIEWS={
 main:{label:'Watch & Invested',test:e=>!e.archivedAt&&['Watch','Invested'].includes(e.disposition.value),empty:'Nothing is filed as Watch or Invested yet. Add a company above, or open the Research list.'},
 research:{label:'Research',test:e=>!e.archivedAt&&e.disposition.value==='Research',empty:'No companies are waiting for research.'},
 declined:{label:'Declined',test:e=>!e.archivedAt&&e.disposition.value==='Declined',empty:'No companies have been declined.'},
 archived:{label:'Archived',test:e=>!!e.archivedAt,empty:'No archived companies.'}
};
let ui={confirm:async()=>true,toast:()=>{},today:()=>new Date().toISOString().slice(0,10)}, token=0, timer=null, overview=null, editing=null, currentView='main';
export function initHome(handlers){ui={...ui,...handlers};}
export function stopHomePolling(){token++;clearTimeout(timer);editing=null;}
async function api(path,body,base='workflow'){const r=await fetch(`/api/${base}/${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-Research-Request':'1'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error||'The server is unavailable.');return data;}
export const parseEntries=text=>[...new Set(String(text||'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean))].slice(0,10);

export function dispositionBadge(e){const d=e.disposition;return `<span class="badge ${dispositionClass(d.value)}">${esc(d.value)}</span>${d.highlight?`<span class="badge consider">${esc(d.highlight)}</span>`:''}${d.setBy==='owner'?'<span class="badge owner">Set by you</span>':''}`;}
const investedText=d=>d.invested?`<small>Entered ${esc(d.invested.date)} at ${esc(d.invested.currency)} ${esc(d.invested.price)}${d.invested.quantity?` · ${esc(d.invested.quantity)} shares`:''}${d.invested.amount?` · ${esc(d.invested.currency)} ${esc(big(d.invested.amount))}`:''}</small>`:'';
function controlHTML(e){
 const d=e.disposition,auto=autoFor(e.assessment?.rating),value=d.setBy==='owner'?d.value:'auto';
 return `<label class="disp-label">Disposition<select class="disp-select" data-company="${e.id}" aria-label="Disposition for ${esc(e.ticker)}"><option value="auto" ${value==='auto'?'selected':''}>App decides (${esc(auto)})</option>${['Research','Watch','Declined','Invested'].map(v=>`<option value="${v}" ${value===v?'selected':''}>${v==='Invested'?'Invested…':v}</option>`).join('')}</select></label>${e.notice?`<p class="home-notice">${esc(e.notice.text)}</p>`:''}<div class="invested-slot"></div>`;
}
function investedForm(e){const i=e.disposition.invested||{};return `<form class="invested-form"><p class="hint">Only you mark a company Invested. The entry date and price become the baseline for its performance; quantity and amount are optional. This records your decision; it does not place a trade.</p><div class="grid"><div class="field"><label>Entry date<input name="date" type="date" required max="${esc(ui.today())}" value="${esc(i.date||ui.today())}"></label></div><div class="field"><label>Entry price per share<input name="price" type="number" step="any" min="0" required value="${esc(i.price??'')}"></label></div><div class="field"><label>Currency<input name="currency" required maxlength="3" value="${esc(i.currency||e.listing.currency||e.price?.currency||'')}" placeholder="USD"></label></div><div class="field"><label>Quantity <small>— optional</small><input name="quantity" type="number" step="any" min="0" value="${esc(i.quantity??'')}"></label></div><div class="field"><label>Amount <small>— optional</small><input name="amount" type="number" step="any" min="0" value="${esc(i.amount??'')}"></label></div><div class="field"><label>Note <small>— optional</small><input name="note" maxlength="2000" value="${esc(i.note||'')}"></label></div></div><div class="actions"><button class="primary" type="submit">Mark Invested</button><button type="button" class="cancel-invested">Cancel</button></div><p class="error" role="alert" hidden></p></form>`;}
// Wires disposition selects, Invested forms, full-research and start-research buttons inside root. onChanged reloads the caller's view.
export function bindControls(root,entriesById,onChanged){
 root.querySelectorAll('.disp-select').forEach(sel=>sel.onchange=async()=>{
  const e=entriesById[sel.dataset.company],value=sel.value,slot=sel.closest('.home-disposition').querySelector('.invested-slot');
  if(value==='Invested'){
   editing=e.id;slot.innerHTML=investedForm(e);const form=slot.querySelector('form');form.querySelector('input[name=price]').focus();
   form.querySelector('.cancel-invested').onclick=()=>{editing=null;slot.innerHTML='';sel.value=e.disposition.setBy==='owner'?e.disposition.value:'auto';};
   form.onsubmit=async ev=>{ev.preventDefault();const d=new FormData(form),num=k=>d.get(k)===''?null:Number(d.get(k)),b=form.querySelector('[type=submit]');b.disabled=true;
    try{const updated=await api('dispositions',{companyId:e.id,disposition:'Invested',invested:{date:d.get('date'),price:Number(d.get('price')),currency:String(d.get('currency')).trim().toUpperCase(),amount:num('amount'),quantity:num('quantity'),note:String(d.get('note')||'')}});editing=null;ui.toast(`${updated.ticker} marked Invested`);onChanged(updated);}
    catch(err){b.disabled=false;const p=form.querySelector('.error');p.textContent=err.message;p.hidden=false;}};
   return;
  }
  sel.disabled=true;
  try{const updated=await api('dispositions',{companyId:e.id,disposition:value});ui.toast(value==='auto'?`${updated.ticker}: the app decides again (${updated.disposition.value})`:`${updated.ticker} filed as ${value}`);onChanged(updated);}
  catch(err){sel.disabled=false;ui.toast(err.message);}
 });
 root.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>showRun(b.dataset.company,b.dataset.run).catch(e=>ui.toast(e.message)));
 root.querySelectorAll('[data-start-research]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('runs',{companyId:b.dataset.startResearch,kind:'review',withSnapshot:true},'research');ui.toast('Research started');onChanged(null);}catch(err){b.disabled=false;ui.toast(err.message);}});
 root.querySelectorAll('[data-fill-notes]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const updated=await api('notes',{companyId:b.dataset.fillNotes});ui.toast('Notes filled from the latest assessment');await ui.refreshWorkspace?.().catch(()=>{});onChanged(updated);}catch(err){b.disabled=false;ui.toast(err.message);}});
}
function rowHTML(e){
 const a=e.assessment,p=e.price,f=e.figures,pending=e.pending;
 const assess=a?`<div class="home-rating"><span class="badge ${ratingClass(a.rating)}">${esc(a.rating)}</span><small>${esc(a.asOf)} · evidence ${esc(a.confidence.toLowerCase())}${a.analysisId?' · sector analysis':''}</small></div><p class="thesis">${esc(a.summary.length>190?a.summary.slice(0,189).trimEnd()+'…':a.summary)}</p>`:'<p class="thesis muted">Not researched yet.</p>';
 const progress=pending?progressHTML({...pending,id:pending.runId}):'';
 const start=!pending&&!e.archivedAt?`<button type="button" class="link-button" data-start-research="${e.id}">${a?'Research again':'Start research'}</button>`:'';
 const figures=f?`<small>Fwd P/E ${x(f.multiples.peForward)} · EV/EBITDA ${x(f.multiples.evEbitda)} · FCF yield ${pct(f.multiples.fcfYield)}</small><small>Market cap ${money(f.marketCap,f.marketCapCurrency)} · revenue growth ${pct(f.revenueGrowthPct)}${f.comparable?'':' · <span class="badge warning">incomplete data</span>'}</small>`:'<small>No financial snapshot yet.</small>';
 return `<article class="company-row home-row" data-id="${e.id}" data-ticker="${esc(e.ticker)}"><div><a class="company-name" href="#company/${e.id}/overview"><span class="ticker">${esc(e.ticker)}</span>${esc(e.name)}</a><p class="role">${esc(e.role)}</p><small>${esc(e.listing.exchange||'Exchange not verified')} · ${esc(e.listing.currency||'Currency unknown')}${e.listing.fromResearch?' · from research':''}</small></div><div class="home-assessment">${assess}${progress}<div class="actions">${a?`<button type="button" class="link-button" data-run="${esc(a.runId)}" data-company="${e.id}">Full research</button>`:''}${start}</div></div><div class="home-figures"><strong>${priceText(p)}</strong><small>${p?`${esc(p.asOfDate||'date unknown')}${p.ageDays!=null?` · ${p.ageDays} days old`:''} · ${esc(p.source)}${p.ageDays>7?' <span class="badge warning">stale</span>':''}`:'Research collects a dated price and snapshot.'}</small>${figures}</div><div class="home-disposition">${dispositionBadge(e)}${investedText(e.disposition)}${e.archivedAt?'<small>Archived</small>':controlHTML(e)}</div></article>`;
}
const outcomeText=e=>({research_queued:'Research queued.',research_not_started:`Added; research not started: ${e.outcomeNote||''}`,already_researched:e.outcomeNote||'Already researched.',failed:e.outcomeNote||'Could not be added.'})[e.outcome]||(e.outcome?'':'Adding…');
function entryHTML(i,e,idx){
 const company=e.companyId?overview.companies.find(c=>c.id===e.companyId):null,link=company?`<a href="#company/${company.id}/overview">${esc(company.ticker)} · ${esc(company.name)}</a>`:'';
 if(e.status==='pending')return `<li><span class="badge watching">verifying</span> <strong>${esc(e.query)}</strong></li>`;
 if(e.status==='ambiguous'&&!e.outcome)return `<li><span class="badge warning">choose</span> <strong>${esc(e.query)}</strong> could be more than one listing: ${e.candidates.map((c,ci)=>`<button type="button" data-choose data-intake="${i.id}" data-index="${idx}" data-candidate="${ci}">${esc(c.name)} · ${esc(c.ticker)}${c.exchange?' · '+esc(c.exchange):''}${c.quoteCurrency?' · '+esc(c.quoteCurrency):''}</button>`).join(' ')} <button type="button" class="link-button" data-choose data-intake="${i.id}" data-index="${idx}" data-candidate="">None of these</button>${e.notes?`<small>${esc(e.notes)}</small>`:''}</li>`;
 if(['resolved','existing'].includes(e.status))return `<li><span class="badge consider">${e.status==='existing'?'already listed':'added'}</span> <strong>${esc(e.query)}</strong> → ${link||esc(e.match?.name||'')}${e.match?.exchange?` <small>${esc(e.match.exchange)}${e.match.quoteCurrency?' · '+esc(e.match.quoteCurrency):''}</small>`:''} <small>${esc(outcomeText(e))}</small></li>`;
 return `<li><span class="badge passed">${e.status==='not_a_company'?'not a company':e.outcome==='dismissed'?'skipped':'not found'}</span> <strong>${esc(e.query)}</strong> <small>${esc(e.outcomeNote||e.notes||'')}</small> <a href="#new">Add manually</a></li>`;
}
function drawIntakes(){
 const target=$('#intake-status');if(!target)return;
 const show=overview.intakes.filter(i=>['queued','running'].includes(i.status)||i.entries.some(e=>e.status==='ambiguous'&&!e.outcome)||Date.now()-Date.parse(i.createdAt)<2*86400000).slice(0,5);
 target.innerHTML=show.map(i=>`<div class="intake-run"><p class="meta">${stamp(i.createdAt)} · <span class="badge ${statusClass(i.status)}">${esc(i.status)}</span> ${esc(i.stage)}${i.error?` · <span class="error-text">${esc(i.error)}</span>`:''}</p>${['queued','running'].includes(i.status)?progressHTML({kind:'intake',status:i.status,stage:i.stage,createdAt:i.createdAt}):''}<ul class="intake-entries">${i.entries.map((e,idx)=>entryHTML(i,e,idx)).join('')}</ul></div>`).join('');
 target.querySelectorAll('[data-choose]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api(`intake/${b.dataset.intake}/choose`,{index:Number(b.dataset.index),candidate:b.dataset.candidate===''?null:Number(b.dataset.candidate)});ui.toast(b.dataset.candidate===''?'Entry skipped':'Company added; research queued');reload();}catch(err){b.disabled=false;ui.toast(err.message);}});
}
function drawRows(){
 if(editing||!overview||!$('#home-rows'))return;
 const view=VIEWS[currentView],q=($('#home-search')?.value||'').toLowerCase(),order={Invested:0,Watch:1,Research:2,Declined:3};
 const rows=overview.companies.filter(view.test).filter(e=>(e.name+' '+e.ticker).toLowerCase().includes(q)).sort((a,b)=>(order[a.disposition.value]-order[b.disposition.value])||a.ticker.localeCompare(b.ticker));
 const target=$('#home-rows');target.innerHTML=rows.length?rows.map(rowHTML).join(''):`<div class="empty">${q?'No matching companies.':esc(view.empty)}</div>`;
 bindControls(target,Object.fromEntries(overview.companies.map(e=>[e.id,e])),()=>reload());
}
function draw(){
 if(!overview||!$('#home-rows'))return;
 const c=overview.counts;
 $('#home-summary').innerHTML=`<div><strong>${c.watch}</strong><small>Watch</small></div><div><strong>${c.invested}</strong><small>Invested</small></div><div><strong>${c.research}</strong><small>Research${c.researching?` · ${c.researching} running`:''}</small></div><div><strong>${c.declined}</strong><small>Declined</small></div>`;
 $('#home-tabs').innerHTML=Object.entries(VIEWS).map(([k,v])=>`<a href="#home${k==='main'?'':'/'+k}" class="${k===currentView?'active':''}" ${k===currentView?'aria-current="page"':''}>${v.label} <small>${overview.companies.filter(v.test).length}</small></a>`).join('');
 drawIntakes();drawRows();
}
async function load(mine){
 try{const data=await api('overview');if(mine!==token)return;overview=data;if(ui.hasCompany&&data.companies.some(c=>!ui.hasCompany(c.id)))await ui.refreshWorkspace?.().catch(()=>{});if(mine!==token)return;draw();}
 catch(e){if(mine!==token)return;if($('#home-rows'))$('#home-rows').innerHTML=`<div class="error">${esc(e.message)}</div>`;}
 const busy=overview&&(overview.companies.some(c=>c.pending)||overview.intakes.some(i=>['queued','running'].includes(i.status)));
 clearTimeout(timer);if(busy&&mine===token)timer=setTimeout(()=>load(mine),2500);
}
const reload=()=>load(token);
export async function renderHome(main,view='main'){
 const mine=++token;currentView=VIEWS[view]?view:'main';editing=null;
 main.innerHTML=`<div class="page-head"><div><p class="eyebrow">RESEARCH CANDIDATES</p><h1>Home</h1><p>Add a company by name or ticker. The assistant verifies the listing, collects a dated financial snapshot, researches the case and files the company as Watch, Research or Declined. Only you mark a company Invested.</p></div><div class="actions"><a class="button" href="/api/export">Export</a><a class="button" href="#new">Add manually</a></div></div>
 <section class="panel intake-panel"><h2>Add companies</h2><form id="intake-form"><div class="intake-row"><label for="intake-entries" class="sr-only">Company names or tickers</label><input id="intake-entries" name="entries" placeholder="Rheinmetall, VRT, Schneider Electric" maxlength="800" required autocomplete="off"><button class="primary" type="submit" id="intake-submit">Add &amp; research</button></div><p class="hint">Names or tickers, separated by commas (up to 10). Verifying the listings uses 1 research run; each new company then uses 1 run (5 provider requests) for its financial snapshot and assessment. If a name could mean more than one listed company, you will be asked to choose.</p><p id="intake-feedback" class="error" role="alert" hidden></p></form><div id="intake-status"></div></section>
 <div class="summary home-summary" id="home-summary"></div><nav class="tabs" aria-label="Company lists" id="home-tabs"></nav>
 <div class="filters home-filters"><div class="field"><label for="home-search">Search companies</label><input id="home-search" type="search" placeholder="Name or ticker"></div></div><div id="home-rows"><p>Loading research…</p></div>
 <p class="footnote">Dispositions follow the latest assessment automatically unless you set one yourself; a newer assessment that disagrees is shown as a notice and never applied over your setting. Nothing here implies ownership or executes a trade.</p>`;
 $('#intake-form').onsubmit=async e=>{e.preventDefault();const entries=parseEntries($('#intake-entries').value),b=$('#intake-submit');if(!entries.length)return;b.disabled=true;$('#intake-feedback').hidden=true;
  try{await api('intake',{entries});$('#intake-entries').value='';ui.toast('Verifying listings…');await load(mine);}catch(err){$('#intake-feedback').textContent=err.message;$('#intake-feedback').hidden=false;}finally{b.disabled=false;}};
 $('#home-search').addEventListener('input',drawRows);
 await load(mine);
}
// Research summary panel for a company page: latest assessment, key figures, what challenges the case, and the disposition control.
export async function companySummary(el,companyId){
 try{
  const data=await api('overview'),e=data.companies.find(c=>c.id===companyId);if(!e||!el.isConnected)return;
  const a=e.assessment,f=e.figures,p=e.price;
  el.innerHTML=`<section class="panel research-summary"><div class="inline-heading"><h2>Research summary</h2><div class="actions">${dispositionBadge(e)}${a?`<span class="badge ${ratingClass(a.rating)}">${esc(a.rating)}</span>`:''}</div></div>
  ${a?`<p class="meta">Assessment ${esc(a.asOf)} · evidence confidence ${esc(a.confidence)} · ${esc(a.model)} · ${a.sources} sources${a.analysisId?` · <a href="#analysis/${esc(a.analysisId)}">sector dashboard</a>`:''}${a.accepted?' · saved as evidence':''}</p><p class="note">${esc(a.summary)}</p>`:'<p class="muted">Not researched yet. Start research to collect a dated financial snapshot and a cited assessment; the company is then filed automatically.</p>'}
  ${e.pending?progressHTML({...e.pending,id:e.pending.runId}):''}
  <div class="grid summary-grid"><div><h3>Key figures</h3>${f?`<dl class="ai-field-review"><div><dt>Share price</dt><dd>${priceText(p)}${p?` · ${esc(p.asOfDate||'date unknown')} · ${esc(p.source)}`:''}</dd></div><div><dt>Market cap</dt><dd>${money(f.marketCap,f.marketCapCurrency)}</dd></div><div><dt>Forward P/E · trailing P/E</dt><dd>${x(f.multiples.peForward)} · ${x(f.multiples.peTrailing)}</dd></div><div><dt>EV/EBITDA · EV/Revenue</dt><dd>${x(f.multiples.evEbitda)} · ${x(f.multiples.evRevenue)}</dd></div><div><dt>FCF yield · net debt/EBITDA</dt><dd>${pct(f.multiples.fcfYield)} · ${x(f.multiples.netDebtEbitda)}</dd></div><div><dt>Revenue growth · EBITDA margin</dt><dd>${pct(f.revenueGrowthPct)} · ${pct(f.margins.ebitda)}</dd></div><div><dt>Data quality</dt><dd>${f.comparable?'Comparable basis':'Incomplete data'} · ${f.warnings} warnings · ${f.missing} missing · ${esc(f.periodLabel||'period unknown')} (${esc(f.periodType)})</dd></div></dl>`:`<p class="muted">${p?`Latest price ${priceText(p)} (${esc(p.source)}, ${esc(p.asOfDate)}).`:'No financial snapshot yet.'}</p>`}</div>
  <div>${a?`<h3>What challenges the case</h3><ul>${a.detail.bearCase.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><h3>What would change the view</h3><ul>${a.detail.invalidationTriggers.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>${a.detail.catalysts.length?`<h3>Catalysts</h3><ul>${a.detail.catalysts.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}`:''}</div></div>
  <div class="actions">${a?`<button type="button" data-run="${esc(a.runId)}" data-company="${e.id}">Open full research</button>`:''}${!e.pending&&!e.archivedAt?`<button type="button" data-start-research="${e.id}">${a?'Research again':'Start research'}</button>`:''}${a&&!e.archivedAt&&(!e.notes.thesis||!e.notes.risks||!e.notes.disconfirming)?`<button type="button" data-fill-notes="${e.id}">Fill empty notes from this assessment</button>`:''}<a href="#company/${e.id}/snapshots">Financial snapshots</a></div>${a&&(!e.notes.thesis||!e.notes.risks||!e.notes.disconfirming)?'<p class="hint">Your thesis, risks or disconfirming-evidence notes are empty. New research fills empty notes automatically with an attribution line; this button does the same from the assessment already stored, without a new run.</p>':''}
  <div class="home-disposition summary-disposition">${investedText(e.disposition)}${e.archivedAt?'<small>Archived company.</small>':controlHTML(e)}</div></section>`;
  bindControls(el,{[e.id]:e},()=>companySummary(el,companyId));
 }catch(err){el.innerHTML=`<div class="error">${esc(err.message)}</div>`;}
}
