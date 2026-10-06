// Home (1.5.1): add companies by name or ticker; Invested and Watch as separate sections; one compact row per company
// (ticker and name, what it does, disposition and who decides, the line that supports it, freshness) with everything else
// one step down behind "Details": figures, what would move it, research actions and the decision control.
// Research, Declined and Archived are separate views. Data: /api/workflow/overview.
import {showRun,progressHTML} from './research-panel.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=s=>s?new Date(s).toLocaleString():'—';
const big=v=>{const a=Math.abs(v);return a>=1e9?(v/1e9).toFixed(2)+'bn':a>=1e6?(v/1e6).toFixed(1)+'m':a>=1e3?(v/1e3).toFixed(1)+'k':v.toFixed(2);};
const money=(v,c)=>v==null?'n/a':`${c?esc(c)+' ':''}${big(v)}`;
const x=v=>v==null?'n/a':v.toFixed(1)+'×';
const pct=v=>v==null?'n/a':(v>0?'+':'')+v.toFixed(1)+'%';
const priceText=p=>p?`${esc(p.currency||'')} ${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(p.value)}`:'No price yet';
const ago=d=>d==null?'':d===0?'today':d===1?'yesterday':`${d} days ago`;
const statusClass=s=>({completed:'consider',running:'watching',queued:'watching',failed:'danger',cancelled:'passed',interrupted:'warning'})[s]||'';
export const dispositionClass=d=>({Watch:'watching',Invested:'invested',Declined:'passed',Research:'further'})[d]||'';
export const ratingClass=r=>({Consider:'consider',Watch:'watching',Pass:'passed','Research further':'further'})[r]||'';
const autoFor=r=>({Consider:'Watch',Watch:'Watch',Pass:'Declined'})[r]||'Research';
const clip=(t,n)=>{t=String(t||'').trim();return t.length>n?t.slice(0,n-1).trimEnd()+'…':t;};
const VIEWS={
 main:{label:'Watch & Invested',test:e=>!e.archivedAt&&['Watch','Invested'].includes(e.disposition.value)},
 research:{label:'Research',test:e=>!e.archivedAt&&e.disposition.value==='Research',empty:'No companies are waiting for research.',lead:'Not enough evidence yet to file these as Watch or Declined. Research fills in what is missing.'},
 declined:{label:'Declined',test:e=>!e.archivedAt&&e.disposition.value==='Declined',empty:'No companies have been declined.',lead:'Researched and not attractive on the evidence, or set aside by you. History is kept.'},
 archived:{label:'Archived',test:e=>!!e.archivedAt,empty:'No archived companies.',lead:'Removed from the active lists. Research and history remain; restore from the company page.'}
};
let ui={confirm:async()=>true,toast:()=>{},today:()=>new Date().toISOString().slice(0,10)}, token=0, timer=null, overview=null, editing=null, currentView='main', openRows=new Set();
export function initHome(handlers){ui={...ui,...handlers};}
export function stopHomePolling(){token++;clearTimeout(timer);editing=null;openRows=new Set();}
async function api(path,body,base='workflow'){const r=await fetch(`/api/${base}/${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-Research-Request':'1'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error||'The server is unavailable.');return data;}
export const parseEntries=text=>[...new Set(String(text||'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean))].slice(0,10);

// ---- shared pieces ----
export function dispositionBadge(e){const d=e.disposition;return `<span class="badge ${dispositionClass(d.value)}">${esc(d.value)}</span>${d.highlight?`<span class="badge consider">${esc(d.highlight)}</span>`:''}${d.setBy==='owner'?'<span class="badge owner">Set by you</span>':''}${e.freshness?.stale?'<span class="badge warning">Stale</span>':''}`;}
const investedText=d=>d.invested?`Entered ${esc(d.invested.date)} at ${esc(d.invested.currency)} ${esc(d.invested.price)}${d.invested.quantity?` · ${esc(d.invested.quantity)} shares`:''}${d.invested.amount?` · ${esc(d.invested.currency)} ${esc(big(d.invested.amount))}`:''}`:'';
function controlHTML(e){
 const d=e.disposition,auto=autoFor(e.assessment?.rating),value=d.setBy==='owner'?d.value:'auto';
 return `<label class="disp-label">Who decides<select class="disp-select" data-company="${e.id}" aria-label="Disposition for ${esc(e.ticker)}"><option value="auto" ${value==='auto'?'selected':''}>App decides (${esc(auto)})</option>${['Research','Watch','Declined','Invested'].map(v=>`<option value="${v}" ${value===v?'selected':''}>${v==='Invested'?'Invested…':'I set: '+v}</option>`).join('')}</select></label>${e.notice?`<p class="home-notice">${esc(e.notice.text)}</p>`:''}<div class="invested-slot"></div>`;
}
function investedForm(e){const i=e.disposition.invested||{};return `<form class="invested-form"><p class="hint">Only you mark a company Invested. The entry date and price become the baseline for its performance; quantity and amount are optional. This records your decision; it does not place a trade.</p><div class="grid"><div class="field"><label>Entry date<input name="date" type="date" required max="${esc(ui.today())}" value="${esc(i.date||ui.today())}"></label></div><div class="field"><label>Entry price per share<input name="price" type="number" step="any" min="0" required value="${esc(i.price??'')}"></label></div><div class="field"><label>Currency<input name="currency" required maxlength="3" value="${esc(i.currency||e.listing.currency||e.price?.currency||'')}" placeholder="USD"></label></div><div class="field"><label>Quantity <small>— optional</small><input name="quantity" type="number" step="any" min="0" value="${esc(i.quantity??'')}"></label></div><div class="field"><label>Amount <small>— optional</small><input name="amount" type="number" step="any" min="0" value="${esc(i.amount??'')}"></label></div><div class="field"><label>Note <small>— optional</small><input name="note" maxlength="2000" value="${esc(i.note||'')}"></label></div></div><div class="actions"><button class="primary" type="submit">Mark Invested</button><button type="button" class="cancel-invested">Cancel</button></div><p class="error" role="alert" hidden></p></form>`;}
// Wires disposition selects, Invested forms, research buttons and fill-notes buttons inside root. onChanged reloads the caller's view.
export function bindControls(root,entriesById,onChanged){
 root.querySelectorAll('.disp-select').forEach(sel=>sel.onchange=async()=>{
  const e=entriesById[sel.dataset.company],value=sel.value,slot=sel.closest('.row-controls,.home-disposition,.summary-disposition').querySelector('.invested-slot');
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
// What would move the company, drawn only from the stored assessment and snapshot. Nothing is invented: each list is the
// model's own cited material (evidence still missing, dated catalysts, next steps, invalidation triggers) or Street consensus.
export function triggers(e){
 const a=e.assessment,d=a?.detail,c=e.figures?.consensus,out=[];
 if(!a)return out;
 const v=e.disposition.value;
 if(v==='Watch'||v==='Declined'){ if(d.missingEvidence.length)out.push({title:'Evidence still needed before a stronger view',items:d.missingEvidence}); if(d.catalysts.length)out.push({title:'Catalysts to watch',items:d.catalysts}); }
 if(v==='Invested'){ if(d.invalidationTriggers.length)out.push({title:'What would change the view',items:d.invalidationTriggers}); if(d.catalysts.length)out.push({title:'Catalysts to watch',items:d.catalysts}); }
 if(v==='Research'){ if(d.nextSteps.length)out.push({title:'Research still needed',items:d.nextSteps}); if(d.missingEvidence.length)out.push({title:'Evidence missing',items:d.missingEvidence}); }
 if(v!=='Research'&&d.nextSteps.length)out.push({title:'Next research steps',items:d.nextSteps});
 if(c&&c.targetPrice!=null)out.push({title:'Street consensus target (not the app’s view)',items:[`${c.currency||''} ${c.targetPrice}${c.upsidePct!=null?` (${pct(c.upsidePct)} versus the snapshot price)`:''}${c.asOfDate?`, as of ${c.asOfDate}`:''}.`]});
 return out;
}
export function triggersHTML(e,{limit=null}={}){
 const groups=triggers(e);if(!groups.length)return '';
 return `<div class="row-triggers">${groups.map(g=>`<h4>${esc(g.title)}</h4><ul>${(limit?g.items.slice(0,limit):g.items).map(t=>`<li>${esc(t)}</li>`).join('')}${limit&&g.items.length>limit?`<li class="muted">${g.items.length-limit} more in the full research.</li>`:''}</ul>`).join('')}</div>`;
}
function nextLine(e){
 const a=e.assessment;if(!a)return '';const d=a.detail,v=e.disposition.value;
 const pick=v==='Invested'?d.invalidationTriggers[0]:v==='Research'?d.nextSteps[0]:d.missingEvidence[0]||d.catalysts[0];
 if(!pick)return '';
 const label=v==='Invested'?'Would change the view':v==='Research'?'Next':'To move from Watch';
 const more=(v==='Invested'?d.invalidationTriggers.length:v==='Research'?d.nextSteps.length:d.missingEvidence.length+d.catalysts.length)-1;
 return `<p class="row-next"><strong>${label}:</strong> ${esc(clip(pick,180))}${more>0?` <span class="muted">(+${more} in details)</span>`:''}</p>`;
}
function figuresHTML(e){
 const p=e.price,f=e.figures;
 const price=p?`<div><b>${priceText(p)}</b>${esc(p.asOfDate||'date unknown')} · ${esc(p.source)}${e.freshness?.priceStale?' · <span class="badge warning">price stale</span>':''}</div>`:'<div><b>No price yet</b>Research or the price feed will add one.</div>';
 const listing=`<div><b>${esc(e.listing.exchange||'Exchange not verified')}</b>${esc(e.listing.currency||'Currency unknown')}${e.listing.fromResearch?' · from research':''}</div>`;
 const multiples=f?`<div><b>Fwd P/E ${x(f.multiples.peForward)}</b>EV/EBITDA ${x(f.multiples.evEbitda)} · FCF yield ${pct(f.multiples.fcfYield)}</div><div><b>Market cap ${money(f.marketCap,f.marketCapCurrency)}</b>Revenue growth ${pct(f.revenueGrowthPct)}${f.comparable?'':' · <span class="badge warning">incomplete data</span>'}</div>`:'<div><b>No financial snapshot yet</b>Collected with the next research run.</div>';
 return `<div class="home-figures"><div class="figure-grid">${price}${listing}${multiples}</div></div>`;
}
function rowHTML(e){
 const a=e.assessment,d=e.disposition,pending=e.pending,open=openRows.has(e.id);
 const who=d.setBy==='owner'?'You decide':'App decides';
 const fresh=a?`assessed ${ago(e.freshness.assessmentAgeDays)}`:'not researched';
 const why=d.setBy==='owner'&&d.note&&d.note!=='Set by you.'?`<p class="row-why owner-note">Your note: ${esc(clip(d.note,260))}</p>`:a?`<p class="row-why">${esc(clip(a.summary,320))}</p>`:'<p class="row-why muted">No assessment yet. Start research to collect a dated snapshot and a cited view.</p>';
 const progress=pending?progressHTML({...pending,id:pending.runId}):'';
 const detail=`<div class="row-body"><div>${figuresHTML(e)}${a?`<h4>Why ${esc(a.rating)} · ${esc(a.asOf)} · evidence ${esc(a.confidence.toLowerCase())}</h4><ul><li>${esc(a.detail.rationale)}</li><li>${esc(a.detail.valuation)}</li></ul>`:''}<div class="row-controls">${a?`<button type="button" data-run="${esc(a.runId)}" data-company="${e.id}">Open full research</button>`:''}${!pending&&!e.archivedAt?`<button type="button" data-start-research="${e.id}">${a?'Research again':'Start research'}</button>`:''}<a href="#company/${e.id}/overview">Company page</a></div>${e.archivedAt?'':`<div class="row-controls">${controlHTML(e)}</div>`}${d.invested?`<p class="hint">${investedText(d)}</p>`:''}</div><div>${triggersHTML(e,{limit:3})||'<p class="muted">No stored triggers yet.</p>'}</div></div>`;
 return `<article class="company-row home-row" data-id="${e.id}" data-ticker="${esc(e.ticker)}"><div class="row-head"><div class="row-title"><a class="company-name" href="#company/${e.id}/overview"><span class="ticker">${esc(e.ticker)}</span>${esc(e.name)}</a><p class="row-sector">${esc(clip(e.role,160))}</p></div><div class="home-disposition">${dispositionBadge(e)}<small>${who} · ${fresh}${a?.analysisId?' · sector analysis':''}</small></div></div>${why}${progress||nextLine(e)}<details class="row-details" ${open?'open':''} data-row="${e.id}"><summary>${open?'Hide details':'Details'}</summary>${detail}</details></article>`;
}
// ---- intake status ----
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
 const show=overview.intakes.filter(i=>['queued','running'].includes(i.status)||i.entries.some(e=>e.status==='ambiguous'&&!e.outcome)||Date.now()-Date.parse(i.createdAt)<3600000).slice(0,3);
 target.innerHTML=show.map(i=>`<div class="intake-run"><p class="meta">${stamp(i.createdAt)} · <span class="badge ${statusClass(i.status)}">${esc(i.status)}</span> ${esc(i.stage)}${i.error?` · <span class="error-text">${esc(i.error)}</span>`:''}</p>${['queued','running'].includes(i.status)?progressHTML({kind:'intake',status:i.status,stage:i.stage,createdAt:i.createdAt}):''}<ul class="intake-entries">${i.entries.map((e,idx)=>entryHTML(i,e,idx)).join('')}</ul></div>`).join('');
 target.querySelectorAll('[data-choose]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api(`intake/${b.dataset.intake}/choose`,{index:Number(b.dataset.index),candidate:b.dataset.candidate===''?null:Number(b.dataset.candidate)});ui.toast(b.dataset.candidate===''?'Entry skipped':'Company added; research queued');reload();}catch(err){b.disabled=false;ui.toast(err.message);}});
}
function feedsLineHTML(f){
 if(!f)return '';
 if(!f.keys.tiingo)return `<p><strong>Price feed not connected.</strong> Open “Connect feeds.command” in the app folder on the server Mac to add a Tiingo token and the SEC EDGAR contact. Until then prices and financials come from web research.</p>`;
 const last=f.lastFetch?`last fetch ${stamp(f.lastFetch.startedAt)} (${f.lastFetch.updated} updated${f.lastFetch.failed?`, ${f.lastFetch.failed} failed`:''})`:'no fetch yet';
 return `<p><strong>Prices:</strong> Tiingo closes for ${f.companiesWithPrices} ${f.companiesWithPrices===1?'company':'companies'} · ${last} · ${f.dailyDoneToday?'today’s close fetched':'fetched daily after 16:45 ET while the app runs'} · ${f.usage.tiingo.hour} hourly Tiingo requests left${f.keys.edgar?' · SEC EDGAR financials on':' · SEC EDGAR contact missing (financials from web research)'} <button type="button" class="link-button" id="feeds-refresh" ${f.busy?'disabled':''}>${f.busy?'Fetching…':'Refresh prices now'}</button></p>`;
}
// ---- drawing ----
function sectionHTML(title,rows,{lead='',empty='',quiet=false}={}){
 return `<section class="home-section"><div class="home-section-head"><h2>${esc(title)} <small>${rows.length}</small></h2>${lead?`<small>${esc(lead)}</small>`:''}</div>${rows.length?rows.map(rowHTML).join(''):quiet?`<p class="quiet-empty">${esc(empty)}</p>`:`<div class="empty">${esc(empty)}</div>`}</section>`;
}
function drawRows(){
 if(editing||!overview||!$('#home-rows'))return;
 const q=($('#home-search')?.value||'').toLowerCase(),match=e=>(e.name+' '+e.ticker).toLowerCase().includes(q),byTicker=(a,b)=>a.ticker.localeCompare(b.ticker);
 const target=$('#home-rows');
 if(currentView==='main'){
  const invested=overview.companies.filter(e=>!e.archivedAt&&e.disposition.value==='Invested').filter(match).sort(byTicker);
  const watch=overview.companies.filter(e=>!e.archivedAt&&e.disposition.value==='Watch').filter(match).sort(byTicker);
  target.innerHTML=sectionHTML('Invested',invested,{lead:'Your own entries. Only you mark a company Invested.',empty:q?'No matching Invested companies.':'Nothing marked Invested yet. Mark one from its details or its company page.',quiet:true})+sectionHTML('Watch',watch,{lead:'Researched and worth following. Each row says what would move it.',empty:q?'No matching Watch companies.':'Nothing filed as Watch yet. Add a company above, or open the Research view.'});
 } else {
  const v=VIEWS[currentView],rows=overview.companies.filter(v.test).filter(match).sort(byTicker);
  target.innerHTML=sectionHTML(v.label,rows,{lead:v.lead,empty:q?'No matching companies.':v.empty});
 }
 target.querySelectorAll('details.row-details').forEach(dt=>dt.addEventListener('toggle',()=>{if(dt.open)openRows.add(dt.dataset.row);else openRows.delete(dt.dataset.row);dt.querySelector('summary').textContent=dt.open?'Hide details':'Details';}));
 bindControls(target,Object.fromEntries(overview.companies.map(e=>[e.id,e])),()=>reload());
}
function draw(){
 if(!overview||!$('#home-rows'))return;
 $('#home-tabs').innerHTML=Object.entries(VIEWS).map(([k,v])=>`<a href="#home${k==='main'?'':'/'+k}" class="${k===currentView?'active':''}" ${k===currentView?'aria-current="page"':''}>${v.label} <small>${overview.companies.filter(v.test).length}</small></a>`).join('');
 if($('#feeds-line')){$('#feeds-line').innerHTML=feedsLineHTML(overview.feeds);const b=$('#feeds-refresh');if(b)b.onclick=async()=>{b.disabled=true;b.textContent='Fetching…';try{const r=await api('refresh',{},'feeds');ui.toast(`Prices refreshed: ${r.updated} updated${r.failed?`, ${r.failed} failed`:''}${r.skipped?`, ${r.skipped} skipped`:''}`);}catch(err){ui.toast(err.message);}reload();};}
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
 main.innerHTML=`<div class="page-head"><div><p class="eyebrow">Research candidates</p><h1>Home</h1><p>Add a company. The assistant verifies the listing, researches it and files it as Watch, Research or Declined. Only you mark a company Invested.</p></div><div class="actions"><a class="button" href="#new">Add without research</a></div></div>
 <section class="panel intake-panel"><h2>Add companies</h2><form id="intake-form"><div class="intake-row"><label for="intake-entries" class="sr-only">Company names or tickers</label><input id="intake-entries" name="entries" placeholder="Rheinmetall, VRT, Schneider Electric" maxlength="800" required autocomplete="off"><button class="primary" type="submit" id="intake-submit">Add &amp; research</button></div><p class="hint">Names or tickers, separated by commas (up to 10). Verifying listings uses 1 research run; each company researched uses 1 more. You will be asked when a name could mean more than one listed company.</p><p id="intake-feedback" class="error" role="alert" hidden></p></form><div id="intake-status"></div></section>
 <nav class="home-views" aria-label="Company lists" id="home-tabs"></nav>
 <div class="filters home-filters"><div class="field"><label for="home-search">Search companies</label><input id="home-search" type="search" placeholder="Name or ticker"></div></div>
 <div id="home-rows"><p class="muted">Loading research…</p></div>
 <div id="feeds-line" class="feeds-line"></div>
 <p class="footnote">Dispositions follow the latest assessment unless you set one yourself; a newer assessment that disagrees is shown as a notice, never applied over your setting. Stale means the assessment is older than 30 days. Nothing here implies ownership or executes a trade.</p>`;
 $('#intake-form').onsubmit=async e=>{e.preventDefault();const entries=parseEntries($('#intake-entries').value),b=$('#intake-submit');if(!entries.length)return;b.disabled=true;$('#intake-feedback').hidden=true;
  try{await api('intake',{entries});$('#intake-entries').value='';ui.toast('Verifying listings…');await load(mine);}catch(err){$('#intake-feedback').textContent=err.message;$('#intake-feedback').hidden=false;}finally{b.disabled=false;}};
 $('#home-search').addEventListener('input',drawRows);
 await load(mine);
}
// Research summary panel for a company page: latest assessment, figures, what would move it, actions and the decision control.
export async function companySummary(el,companyId){
 try{
  const data=await api('overview'),e=data.companies.find(c=>c.id===companyId);if(!e||!el.isConnected)return;
  const a=e.assessment,f=e.figures,p=e.price;
  el.innerHTML=`<section class="panel research-summary"><div class="inline-heading"><h2>Research summary</h2><div class="actions">${dispositionBadge(e)}${a?`<span class="badge ${ratingClass(a.rating)}">${esc(a.rating)}</span>`:''}</div></div>
  ${a?`<p class="meta">Assessment ${esc(a.asOf)} (${ago(e.freshness.assessmentAgeDays)}) · evidence confidence ${esc(a.confidence)} · ${esc(a.model)} · ${a.sources} sources${a.analysisId?` · <a href="#analysis/${esc(a.analysisId)}">sector dashboard</a>`:''}${a.accepted?' · saved as evidence':''}</p><p class="note">${esc(a.summary)}</p>`:'<p class="muted">Not researched yet. Start research to collect a dated financial snapshot and a cited assessment; the company is then filed automatically.</p>'}
  ${e.pending?progressHTML({...e.pending,id:e.pending.runId}):''}
  <div class="grid summary-grid"><div><h3>Key figures</h3>${f?`<dl class="ai-field-review"><div><dt>Share price</dt><dd>${priceText(p)}${p?` · ${esc(p.asOfDate||'date unknown')} · ${esc(p.source)}${e.freshness.priceStale?' · stale':''}`:''}</dd></div><div><dt>Market cap</dt><dd>${money(f.marketCap,f.marketCapCurrency)}</dd></div><div><dt>Forward P/E · trailing P/E</dt><dd>${x(f.multiples.peForward)} · ${x(f.multiples.peTrailing)}</dd></div><div><dt>EV/EBITDA · EV/Revenue</dt><dd>${x(f.multiples.evEbitda)} · ${x(f.multiples.evRevenue)}</dd></div><div><dt>FCF yield · net debt/EBITDA</dt><dd>${pct(f.multiples.fcfYield)} · ${x(f.multiples.netDebtEbitda)}</dd></div><div><dt>Revenue growth · EBITDA margin</dt><dd>${pct(f.revenueGrowthPct)} · ${pct(f.margins.ebitda)}</dd></div><div><dt>Data quality</dt><dd>${f.comparable?'Comparable basis':'Incomplete data'} · ${f.warnings} warnings · ${f.missing} missing · ${esc(f.periodLabel||'period unknown')} (${esc(f.periodType)})</dd></div></dl>`:`<p class="muted">${p?`Latest price ${priceText(p)} (${esc(p.source)}, ${esc(p.asOfDate)}).`:'No financial snapshot yet.'}</p>`}</div>
  <div>${a?`<h3>What challenges the case</h3><ul>${a.detail.bearCase.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>${triggersHTML(e)}`:''}</div></div>
  <div class="actions">${a?`<button type="button" data-run="${esc(a.runId)}" data-company="${e.id}">Open full research</button>`:''}${!e.pending&&!e.archivedAt?`<button type="button" data-start-research="${e.id}">${a?'Research again':'Start research'}</button>`:''}${a&&!e.archivedAt&&(!e.notes.thesis||!e.notes.risks||!e.notes.disconfirming)?`<button type="button" data-fill-notes="${e.id}">Fill empty notes from this assessment</button>`:''}<a href="#company/${e.id}/snapshots">Financial snapshots</a></div>${a&&(!e.notes.thesis||!e.notes.risks||!e.notes.disconfirming)?'<p class="hint">Your thesis, risks or disconfirming-evidence notes are empty. New research fills empty notes automatically with an attribution line; this button does the same from the assessment already stored, without a new run.</p>':''}
  <div class="home-disposition summary-disposition">${e.disposition.invested?`<small>${investedText(e.disposition)}</small>`:''}${e.archivedAt?'<small>Archived company.</small>':controlHTML(e)}</div>
  ${e.profile?`<form class="feed-profile" id="feed-profile"><h3>Listing &amp; feeds</h3><div class="feed-profile-row"><label>Asset type<select name="assetType">${['Company','Fund','Crypto'].map(v=>`<option value="${v}" ${e.profile.assetType===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Price feed symbol <small>— blank uses the ticker</small><input name="feedSymbol" maxlength="24" value="${esc(e.profile.feedSymbol||'')}" placeholder="${esc(e.ticker)}"></label><label class="feed-coingecko" ${e.profile.assetType==='Crypto'?'':'hidden'}>CoinGecko id<input name="coingeckoId" maxlength="80" value="${esc(e.profile.coingeckoId||'')}" placeholder="bitcoin"></label><button type="submit">Save listing settings</button></div><p class="hint">${e.feedPrice?`Latest feed close ${esc(e.feedPrice.currency)} ${esc(e.feedPrice.value)} on ${esc(e.feedPrice.asOfDate)} (${esc(e.feedPrice.source)}).`:'No feed price stored yet.'}${e.profile.feedStatus==='not_found'?' Tiingo does not list this symbol; it is skipped for 30 days unless the symbol changes.':''}${e.profile.cik?` SEC CIK ${esc(e.profile.cik)}.`:''}</p></form>`:''}</section>`;
  bindControls(el,{[e.id]:e},()=>companySummary(el,companyId));
  const fp=el.querySelector('#feed-profile');
  if(fp){fp.querySelector('[name=assetType]').onchange=ev=>{fp.querySelector('.feed-coingecko').hidden=ev.target.value!=='Crypto';};fp.onsubmit=async ev=>{ev.preventDefault();const d=new FormData(fp),b=fp.querySelector('button');b.disabled=true;try{await api('profile',{companyId:e.id,assetType:d.get('assetType'),feedSymbol:String(d.get('feedSymbol')||'').trim(),coingeckoId:String(d.get('coingeckoId')||'').trim().toLowerCase()},'feeds');ui.toast('Listing and feed settings saved');companySummary(el,companyId);}catch(err){b.disabled=false;ui.toast(err.message);}};}
 }catch(err){el.innerHTML=`<div class="error">${esc(err.message)}</div>`;}
}
