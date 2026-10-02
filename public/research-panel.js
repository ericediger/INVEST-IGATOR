const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=s=>new Date(s).toLocaleString();
const KIND_LABELS={review:'Assessment',forward_eps:'Forward EPS',snapshot:'Financial snapshot',discovery:'Sector discovery',comparison:'Sector ranking'};
const runLabel=r=>KIND_LABELS[r.kind]||r.question.slice(0,45);
const fmtMoney=v=>{const a=Math.abs(v);return a>=1e9?(v/1e9).toFixed(2)+'bn':a>=1e6?(v/1e6).toFixed(1)+'m':a>=1e3?(v/1e3).toFixed(1)+'k':v.toFixed(2);};
export function snapshotHTML(s,sources){
 const src=id=>id?cites([id],sources):'';const srcs=ids=>cites(ids||[],sources);
 const money=(v,c)=>v==null?'n/a':`${c?esc(c)+' ':''}${fmtMoney(v)}`;const x=v=>v==null?'n/a':v.toFixed(1)+'×';const pct=v=>v==null?'n/a':(v>0?'+':'')+v.toFixed(1)+'%';
 const f=s.financials,m=s.derived.multiples,g=s.derived.historicalGrowth;
 const rows=[
  ['Share price',s.price.value==null?'n/a':`${esc(s.price.currency||'')} ${s.price.value} · ${esc(s.price.asOfDate||'date unknown')}${s.price.ageDays!=null?` (${s.price.ageDays} days old)`:''} ${src(s.price.sourceId)}`],
  ['Shares outstanding',`${s.shares.basicOutstanding!=null?s.shares.basicOutstanding.toLocaleString():'n/a'} basic · ${s.shares.dilutedOutstanding!=null?s.shares.dilutedOutstanding.toLocaleString():'n/a'} diluted · ${esc(s.shares.asOfDate||'date unknown')} · ${esc(s.shares.basis||'basis unstated')} ${src(s.shares.sourceId)}`],
  ['Market cap',`${money(s.marketCap.value,s.marketCap.currency)}${s.marketCap.derived?' · app-derived: price × '+esc(s.derived.marketCapBasis):' '+src(s.marketCap.sourceId)}`],
  ['Enterprise value',`${money(s.enterpriseValue.value,s.enterpriseValue.currency)}${s.enterpriseValue.derived?' · app-derived: market cap + net debt':' '+src(s.enterpriseValue.sourceId)}`],
  ['Financial period',`${esc(f.periodLabel||'unknown')} · ${esc(f.periodType)} · ended ${esc(f.periodEndDate||'unknown')} · ${esc(f.basis||'basis unstated')} · ${esc(f.currency||'currency unknown')} ${srcs(f.sourceIds)}`],
  ['Revenue',money(f.revenue,f.currency)],['EBITDA',money(f.ebitda,f.currency)],['EBIT',money(f.ebit,f.currency)],['Net income',money(f.netIncome,f.currency)],['Diluted EPS',f.dilutedEPS==null?'n/a':`${esc(f.currency||'')} ${f.dilutedEPS}`],
  ['Free cash flow',`${money(f.freeCashFlow,f.currency)}${f.freeCashFlowDerived?' · app-derived: operating cash flow − capex':''}`],['Net debt',`${money(s.derived.netDebt,f.currency)} · app-derived`],
  ['Margins (app-derived)',`EBITDA ${pct(s.derived.margins.ebitda)} · EBIT ${pct(s.derived.margins.ebit)} · net ${pct(s.derived.margins.net)} · FCF ${pct(s.derived.margins.fcf)}`],
  ['Growth',`Revenue ${pct(s.derived.revenueGrowthPct)}${s.derived.revenueGrowthSource?' ('+esc(s.derived.revenueGrowthSource)+')':''} · EPS ${pct(s.growth.epsGrowthPct)}${g.revenueCagrPct!=null?` · revenue CAGR ${pct(g.revenueCagrPct)} over ${g.years} years`:''}`],
  ['Consensus',`Forward EPS ${s.consensus.forwardEPS??'n/a'} ${esc(s.consensus.currency||'')} (${esc(s.consensus.forwardEPSPeriod||'period unstated')}) · target ${s.consensus.targetPrice??'n/a'} · as of ${esc(s.consensus.asOfDate||'unknown')} ${src(s.consensus.sourceId)}`],
  ['Multiples (app-computed)',`Trailing P/E ${x(m.peTrailing)} · Forward P/E ${x(m.peForward)} · EV/EBITDA ${x(m.evEbitda)} · EV/EBIT ${x(m.evEbit)} · EV/Revenue ${x(m.evRevenue)} · FCF yield ${pct(m.fcfYield)}${s.derived.fcfYieldBasis?' ('+esc(s.derived.fcfYieldBasis)+')':''} · Net debt/EBITDA ${x(m.netDebtEbitda)} · Upside to target ${pct(m.priceToTarget)}`],
  ...(s.operatingMetrics.length?[['Operating metrics',s.operatingMetrics.map(o=>`${esc(o.name)} ${o.value.toLocaleString()}${o.unit?' '+esc(o.unit):''}${o.periodLabel?' ('+esc(o.periodLabel)+')':''} ${src(o.sourceId)}`).join('<br>')]]:[])
 ];
 return `<dl class="ai-field-review">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>${s.quality.warnings.length?`<details><summary>Data quality warnings · ${s.quality.warnings.length}</summary>${stringList(s.quality.warnings)}</details>`:''}${s.quality.missing.length?`<details><summary>Missing data · ${s.quality.missing.length}</summary>${stringList(s.quality.missing)}</details>`:''}${s.notes?`<p class="hint">${esc(s.notes)}</p>`:''}`;
}
let workspace=null, selected='', open=false, status=null, current=null, runs=[], pollBusy=false, pending=false, inboxToken=0,viewSequence=0;
let draftByCompany={},settingsRevision=null,settingsDirty=false;
try {open=localStorage.getItem('research-open')==='true';selected=localStorage.getItem('research-company')||'';}catch{}
async function api(path,body,revision){const r=await fetch('/api/research/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-Research-Request':'1',...(revision?{'If-Match':revision}:{})}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error||'Research is unavailable.');return data;}
const link=s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.id)} · ${esc(s.title)}</a>`;
const cites=(ids,sources)=>ids.map(id=>{const s=sources.find(s=>s.id===id);return s?`<a class="ai-cite" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">[${esc(id)}]</a>`:'';}).join(' ');
const para=(p,sources)=>`<p class="note">${esc(p.text)} ${cites(p.sourceIds,sources)}</p>`;
const stringList=items=>`<ul>${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`;
function linkedText(text,sources){
 const pattern=/\[([^\]\n]{1,500})\]\((https?:\/\/[^\s)]+)\)/g;let html='',at=0,m;
 while((m=pattern.exec(text))){html+=esc(text.slice(at,m.index));let url;try{url=new URL(m[2]).href;}catch{}
  html+=sources.some(s=>s.url===url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(m[1])}</a>`:esc(m[0]);at=pattern.lastIndex;
 }return html+esc(text.slice(at));
}
function showError(e){$('#ai-feedback').textContent=e.message||e;$('#ai-feedback').hidden=false;}
function setOpen(value){open=value;$('#research-panel').hidden=!value;document.body.classList.toggle('research-open',value);$('#research-toggle').setAttribute('aria-expanded',String(value));try{localStorage.setItem('research-open',String(value));}catch{}if(value){poll();$('#ai-company').focus();}}
function rememberDraft(){if(selected)draftByCompany[selected]=$('#ai-question').value;}
function selectCompany(value){viewSequence++;rememberDraft();selected=value;current=null;runs=[];$('#ai-question').value=draftByCompany[selected]||'';$('#ai-result').innerHTML='<p class="hint">Loading company research…</p>';try{localStorage.setItem('research-company',value);}catch{}poll();}
function install(){
 const toggle=document.createElement('button');toggle.id='research-toggle';toggle.type='button';toggle.textContent='Research assistant';toggle.setAttribute('aria-controls','research-panel');toggle.setAttribute('aria-expanded','false');$('.topbar').append(toggle);
 const pane=document.createElement('aside');pane.id='research-panel';pane.className='research-panel';pane.setAttribute('aria-label','AI research assistant');pane.hidden=true;
 pane.innerHTML=`<div class="ai-head"><div><p class="eyebrow">RESEARCH ASSISTANT</p><h2>Evidence to conviction</h2></div><button id="ai-close" type="button" aria-label="Close research assistant">×</button></div>
 <div class="ai-body"><label for="ai-company">Company in focus</label><select id="ai-company"></select>
 <p id="ai-connection" class="hint" role="status">Checking research connection…</p>
 <details id="ai-settings"><summary>Research mandate & limits</summary><form id="ai-settings-form"><p class="hint">Company merits. Portfolio suitability is not assessed.</p><label for="ai-horizon">Valuation horizon (months)</label><input id="ai-horizon" type="number" min="3" max="60" required><label for="ai-criteria">Investment criteria</label><textarea id="ai-criteria" minlength="20" maxlength="3000" required></textarea><label for="ai-limit">Maximum runs per day</label><input id="ai-limit" type="number" min="1" max="30" required><label for="ai-max-companies">Companies per sector analysis</label><input id="ai-max-companies" type="number" min="2" max="10" required><p class="hint">Includes questions, sector analyses and failed runs. Resets at 00:00 UTC. A review uses up to 3 model requests (5 with a financial snapshot); a financial snapshot 2; EPS research 2; a question 1. A sector analysis counts as one run but makes up to 3 + 5 × companies requests, each with up to 4–6 web tool calls. These are usage limits, not a dollar budget.</p><div class="actions"><button type="submit">Save mandate</button><button type="button" id="ai-settings-reload">Reload saved mandate</button></div><p id="ai-settings-feedback" role="status"></p></form></details>
 <div id="ai-setup" class="ai-callout" hidden><strong>Connect research</strong><p>Open “Connect AI.command” in the INVEST-IGATOR app folder on the server Mac to add your OpenAI API key privately. Then choose Recheck connection.</p><button id="ai-recheck" type="button">Recheck connection</button></div>
 <p class="hint">Starting a run sends this company’s saved notes, evidence, snapshots, scenarios, recent decisions and recent AI conversation to OpenAI. The service searches the public web. Up to 20 recent evidence notes are included.</p>
 <label class="check"><input type="checkbox" id="ai-with-snapshot" checked> Collect a financial &amp; market snapshot first (2 extra requests)</label>
 <div class="actions"><button id="ai-review" type="button" class="primary">Research & recommend</button><button id="ai-snapshot" type="button">Financial snapshot only</button></div>
 <p class="hint">For a whole sector, use <a href="#analysis">Sector analysis</a>: one request discovers the companies, researches each one and ranks them.</p>
 <form id="ai-question-form"><label for="ai-question">Direct the research</label><textarea id="ai-question" maxlength="3000" placeholder="What would weaken this company’s investment case?" required></textarea><div class="actions"><button type="submit" id="ai-ask">Investigate question</button><a href="#research">All research</a></div></form>
 <p id="ai-feedback" class="error" role="alert" hidden></p>
 <label for="ai-history">Saved research & conversation</label><select id="ai-history"><option value="">No research yet</option></select>
 <div id="ai-result" aria-live="polite"><div class="ai-empty"><span class="ai-orbit">↗</span><h3>Build an evidence-backed view</h3><p>Research the company, test the thesis, and see what supports a recommendation.</p></div></div></div>`;
 $('.shell').append(pane);
 toggle.onclick=()=>setOpen(!open);$('#ai-close').onclick=()=>{setOpen(false);toggle.focus();};$('#ai-company').onchange=e=>selectCompany(e.target.value);
 $('#ai-recheck').onclick=()=>poll();$('#ai-review').onclick=()=>start('review',null,{withSnapshot:$('#ai-with-snapshot').checked});$('#ai-snapshot').onclick=()=>start('snapshot');$('#ai-question-form').onsubmit=e=>{e.preventDefault();start('question');};
 $('#ai-history').onchange=async e=>{const sequence=++viewSequence,cid=selected,runId=e.target.value;try{const loaded=await api('runs/'+runId);if(sequence!==viewSequence||cid!==selected)return;viewSequence++;current=loaded;renderRun();}catch(err){showError(err);}};
 $('#ai-settings-form').oninput=()=>{settingsDirty=true;};
 $('#ai-settings-reload').onclick=()=>{settingsDirty=false;poll();};
 $('#ai-settings-form').onsubmit=async e=>{
  e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
  try{const saved=await api('settings',{horizonMonths:Number($('#ai-horizon').value),criteria:$('#ai-criteria').value,dailyLimit:Number($('#ai-limit').value),maxCompanies:Number($('#ai-max-companies').value)},settingsRevision);status.settings=saved;settingsRevision=saved.revision;settingsDirty=false;$('#ai-settings-feedback').textContent='Saved. New runs will use this mandate.';}
  catch(err){$('#ai-settings-feedback').textContent=err.message;}finally{b.disabled=false;}
 };
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&pane.contains(document.activeElement)){setOpen(false);toggle.focus();}});
 window.addEventListener('research-saved',()=>poll());
 setOpen(open);setInterval(()=>{if(open||location.hash==='#research')poll();},2500);
}
function fillCompanies(){if(!workspace)return;$('#ai-company').innerHTML=workspace.companies.map(c=>`<option value="${c.id}">${esc(c.ticker)} · ${esc(c.name)}${c.archivedAt?' · Archived':''}</option>`).join('');$('#ai-company').value=selected;}
export function syncResearchPanel(state){
 if(!$('#research-panel'))install();workspace=state.workspace;
 const route=location.hash.split('/'), cid=route[0]==='#company'?route[1]:null;
 const next=cid&&workspace.companies.some(c=>c.id===cid)?cid:workspace.companies.some(c=>c.id===selected)?selected:workspace.companies.find(c=>!c.archivedAt)?.id||workspace.companies[0]?.id||'';
 if(next!==selected)selectCompany(next);fillCompanies();if(!status)poll();
}
async function start(kind,metricRequest,extra={}){
 if(pending||!selected)return;pending=true;buttons();$('#ai-feedback').hidden=true;
 try {const run=await api('runs',{companyId:selected,kind,question:kind==='question'?$('#ai-question').value:'',...(metricRequest?{metricRequest}:{}),...extra});
  if(run.companyId===selected){viewSequence++;current=run;if(kind==='question'){$('#ai-question').value='';draftByCompany[selected]='';}renderRun();}await poll();
 }catch(e){showError(e);}finally{pending=false;buttons();}
}
function buttons(){const archived=workspace?.companies.find(c=>c.id===selected)?.archivedAt;const busy=pending||runs.some(r=>['queued','running'].includes(r.status));const disabled=!status?.configured||!selected||!!archived||busy||status.usedToday>=status.settings.dailyLimit;$('#ai-review').disabled=disabled;$('#ai-ask').disabled=disabled;$('#ai-snapshot').disabled=disabled;}
async function poll(){
 if(pollBusy||!$('#research-panel'))return;pollBusy=true;const cid=selected,sequence=viewSequence;
 try{
  const [info,list]=await Promise.all([api('status'),cid?api('runs?companyId='+encodeURIComponent(cid)):Promise.resolve({runs:[]})]);
  const first=!status;status=info;$('#ai-connection').textContent=`${info.configured?'API key configured':'AI connection needed'} · ${info.model}${info.reasoningEffort?' · '+info.reasoningEffort+' reasoning':''} · ${info.usedToday}/${info.settings.dailyLimit} runs today`;
  $('#ai-setup').hidden=info.configured;
  if(first||!settingsDirty){settingsRevision=info.settings.revision;$('#ai-horizon').value=info.settings.horizonMonths;$('#ai-criteria').value=info.settings.criteria;$('#ai-limit').value=info.settings.dailyLimit;$('#ai-max-companies').value=info.settings.maxCompanies;}
  if(cid!==selected||sequence!==viewSequence)return;runs=list.runs;
  const history=$('#ai-history');history.innerHTML=runs.length?runs.map(r=>`<option value="${r.id}">${esc(runLabel(r))} · ${stamp(r.createdAt)} · ${esc(r.status)}</option>`).join(''):'<option value="">No research yet</option>';
  if(!current&&runs.length){const loaded=await api('runs/'+runs[0].id);if(cid!==selected||sequence!==viewSequence)return;current=loaded;}
  else if(current){const latest=await api('runs/'+current.id);if(cid!==selected||sequence!==viewSequence)return;if(latest.updatedAt!==current.updatedAt||latest.acceptedEvidenceId!==current.acceptedEvidenceId||latest.contextChanged!==current.contextChanged){current=latest;renderRun();}}
  if(current&&cid===selected){history.value=current.id;if($('#ai-result').dataset.run!==current.id)renderRun();}
  else if(!runs.length)$('#ai-result').innerHTML='<div class="ai-empty"><span class="ai-orbit">↗</span><h3>Build an evidence-backed view</h3><p>Start a review to collect sources, challenge the thesis, and produce a recommendation.</p></div>';
  if(location.hash==='#research')await renderResearchInbox();buttons();
 }catch(e){showError(e);}finally{pollBusy=false;if(cid!==selected)setTimeout(poll,0);}
}
function renderRun(){
 if(!current)return;const j=current,out=$('#ai-result');out.dataset.run=j.id;
 if(!j.companyId){out.innerHTML=`<p class="meta">${esc(j.context.analysis?.sector||'Sector analysis')} · ${stamp(j.createdAt)}</p><div class="ai-callout"><strong>${esc(runLabel(j))} · ${esc(j.status)}</strong><p>${esc(j.stage)}</p>${j.analysisId?`<p><a href="#analysis/${esc(j.analysisId)}">Open the sector dashboard</a></p>`:''}</div>`;return;}
 const meta=`<p class="meta">${esc(j.context.company.ticker)} · ${stamp(j.createdAt)}${j.analysisId?` · <a href="#analysis/${esc(j.analysisId)}">part of a sector analysis</a>`:''}<br>${j.context.mandate.horizonMonths}-month horizon · Company merits only</p>`;
 if(['queued','running'].includes(j.status)){out.innerHTML=meta+`<div class="ai-callout"><strong role="status">${esc(j.stage)}</strong><p>You can leave this page. Work continues while the server is running.</p><button id="ai-cancel" type="button">Stop research</button></div>`;$('#ai-cancel').onclick=async()=>{try{current=await api('runs/'+j.id+'/cancel',{});renderRun();await poll();}catch(e){showError(e);}};return;}
 if(j.status!=='completed'){out.innerHTML=meta+`<div class="ai-callout"><strong>${esc(j.stage)}</strong><p>${esc(j.error||'A new run is needed to continue. Previous research and saved notes are preserved.')}</p><p class="hint">No automatic retry was made. Provider usage may still be charged.</p></div>`;return;}
 const sources=`<details><summary>Sources · ${j.sources.length}</summary><p class="hint">Collected during this run. Publication dates are unknown unless stated in the assessment. Citation checks establish source provenance, not factual correctness.</p><ol class="ai-sources">${j.sources.map(s=>`<li>${link(s)}</li>`).join('')}</ol></details>`;
 const context=`<details><summary>Research basis & usage</summary><p class="hint">${esc(j.model)}${j.reasoningEffort?` · ${esc(j.reasoningEffort)} reasoning`:""} · prompt version ${j.promptVersion} · ${j.usage.reduce((n,u)=>n+u.inputTokens+u.outputTokens,0).toLocaleString()} reported tokens. This is not a dollar cost.</p>${j.context.omittedEvidenceCount?`<p>${j.context.omittedEvidenceCount} older evidence notes were outside this run’s context.</p>`:''}<pre>${esc(JSON.stringify(j.context,null,2))}</pre></details>`;
 if(j.kind==='snapshot'){
  const s=j.snapshot;
  out.innerHTML=meta+`<div class="ai-verdict"><span class="eyebrow">FINANCIAL &amp; MARKET SNAPSHOT</span><h2>${esc(s.identity.ticker||j.context.company.ticker)}</h2><span class="badge ${s.quality.comparable?'':'warning'}">${s.quality.comparable?'Comparable basis':'Incomplete data'}</span><p>${esc(s.identity.name||'')}${s.identity.exchange?' · '+esc(s.identity.exchange):''} · as of ${esc(s.asOf)}</p></div>${snapshotHTML(s,j.sources)}<p class="hint">Figures are cited from public sources and normalized by the app; derived values are app calculations. This does not create a saved manual snapshot; enter one in Financial snapshots if you want it in valuation scenarios.</p>${sources}${context}`;return;
 }
 if(j.kind==='forward_eps'){
  const d=j.epsDraft;
  const rows=[['Forward EPS',d.value===null?'Not verified':`${d.currency||'Currency unknown'} ${d.value} / share`],['Fiscal period',d.period||'Unknown'],['Period end',d.periodEndDate||'Unknown'],['Basis',d.basis||'Unknown'],['Provenance',d.kind],['Share basis',d.shareBasis||'Unknown'],['Source title',d.source?.title||'Unknown'],['Publication date',d.publicationDate||'Unknown'],['Estimate as of',d.estimateAsOfDate||'Unknown']];
  out.innerHTML=meta+`<div class="ai-verdict"><span class="eyebrow">FORWARD EPS · DRAFT</span><h2>${d.value===null?'Not verified':esc(d.value)}</h2><p>${esc(d.explanation)}</p></div><dl class="ai-field-review">${rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${d.source?`<p>${link({...d.source,id:d.sourceId})}</p>`:''}${d.sourceExcerpt?`<blockquote class="note">${esc(d.sourceExcerpt)}</blockquote>`:''}${d.warnings.map(w=>`<p class="ai-callout">${esc(w)}</p>`).join('')}${d.missingFields.length?`<details open><summary>Unknown / missing fields</summary>${stringList(d.missingFields)}</details>`:''}
  ${d.canFill?`<button id="ai-fill-eps" type="button" class="primary">Fill Forward EPS fields</button><p class="hint">Fills the open snapshot form for ${esc(j.context.company.ticker)}. Review the values and save the snapshot when ready. Unknown fields stay blank.</p>`:'<p class="ai-callout">A sourced value, fiscal period and currency are needed before the agent can fill this field.</p>'}
  <p><a href="#company/${j.companyId}/snapshots">Open financial snapshots</a></p><p id="ai-fill-feedback" role="status"></p>${sources}${context}`;
  if($('#ai-fill-eps'))$('#ai-fill-eps').onclick=async e=>{
   const b=e.target;b.disabled=true;
   const result=await new Promise(resolve=>window.dispatchEvent(new CustomEvent('ai-forward-eps-selected',{detail:{companyId:j.companyId,draft:d,runId:j.id,onApplied:resolve}})));
   if(result.ok){$('#ai-fill-feedback').textContent='Fields filled. Review and save the snapshot.';if(innerWidth<=1180)setOpen(false);}
   else $('#ai-fill-feedback').textContent=result.error;
   b.disabled=false;
  };return;
 }
 if(j.kind==='question'){out.innerHTML=meta+`<h3>${esc(j.question)}</h3><div class="note">${linkedText(j.answer,j.sources)}</div>`+sources+context;return;}
 const r=j.report,computed=j.context.calculations,ref=j.context.referenceSnapshot;
 out.innerHTML=meta+`<div class="ai-verdict"><span class="eyebrow">AI RECOMMENDATION · ${j.acceptedEvidenceId?'REVIEWED EVIDENCE':'DRAFT'}</span><h2>${esc(r.recommendation)}</h2><span class="badge">Evidence confidence: ${esc(r.evidenceConfidence)}</span>${para(r.summary,j.sources)}</div><h3>Why this recommendation</h3>${para(r.rationale,j.sources)}
 <details open><summary>Business & financial assessment</summary>${para(r.businessQuality,j.sources)}${para(r.financialAssessment,j.sources)}</details>
 <details open><summary>Valuation</summary>${para(r.valuationAssessment,j.sources)}${computed?`<p class="hint">Saved scenario calculations · ${esc(ref.currency)} · reference ${esc(ref.quoteDate)} · target ${esc(j.context.scenario.targetDate)}</p><div class="ai-valuations">${['bear','base','bull'].map(k=>`<div><small>${k}</small><strong>${computed[k].price.toFixed(2)}</strong><small>${computed[k].priceReturn.toFixed(1)}%</small></div>`).join('')}</div>`:'<div class="ai-callout">Valuation incomplete. Add a dated snapshot and bear/base/bull assumptions for a calculated price range.</div>'}</details>
 ${j.snapshot?`<details open><summary>Financial &amp; market snapshot · collected this run · ${j.snapshot.quality.comparable?'comparable':'incomplete'}</summary>${snapshotHTML(j.snapshot,j.sources)}</details>`:''}
 ${[['bullCase','What supports the case'],['bearCase','What challenges the case'],['catalysts','Catalysts'],['changes','What changed']].map(([k,label])=>(r[k]||[]).length?`<details open><summary>${label}</summary>${r[k].map(p=>para(p,j.sources)).join('')}</details>`:'').join('')}
 ${[['assumptions','Assumptions'],['missingEvidence','Missing evidence'],['invalidationTriggers','What would change the recommendation'],['nextSteps','Next research actions']].map(([k,label])=>r[k].length?`<details><summary>${label}</summary>${stringList(r[k])}</details>`:'').join('')}
 ${sources}${context}
 ${j.contextChanged&&!j.acceptedEvidenceId?'<p class="ai-callout">Company research has changed since this assessment. Review its saved basis before accepting it.</p>':''}
 ${j.acceptedEvidenceId?'<p class="success">Saved to company evidence. Your decision log is unchanged.</p>':j.orphaned?'<p class="hint">This company is no longer in the workspace.</p>':`<div class="ai-accept">${j.contextChanged?'<label class="check"><input type="checkbox" id="ai-acknowledge"> I reviewed the changes and want to save this dated assessment.</label>':''}<button id="ai-accept" type="button">Save reviewed assessment as evidence</button><p class="hint">Adds a dated AI evidence note. You record your own investment decision separately.</p></div>`}`;
 if($('#ai-accept'))$('#ai-accept').onclick=async e=>{
  const b=e.target;b.disabled=true;
  try{const response=await fetch('/api/workspace'),latest=await response.json();if(!response.ok)throw new Error('Could not load the current workspace.');
   const saved=await api('runs/'+j.id+'/accept',{acknowledgeChanged:$('#ai-acknowledge')?.checked||false},latest.revision);
   current=await api('runs/'+j.id);renderRun();window.dispatchEvent(new CustomEvent('ai-evidence-saved',{detail:saved}));
  }catch(err){showError(err);b.disabled=false;}
 };
}
export async function renderResearchInbox(){
 const token=++inboxToken;const data=await api('runs');if(location.hash!=='#research'||token!==inboxToken)return;
 const target=$('#ai-inbox-rows');if(!target)return;
 const html=data.runs.length?data.runs.map(r=>`<article class="company-row ai-inbox-row"><div><strong>${esc(r.ticker)}</strong><p class="role">${r.kind==='review'?'Company assessment':r.kind==='question'?esc(r.question.slice(0,120)):esc(runLabel(r))}${r.analysisId&&r.companyId?' · sector analysis':''}</p><small>${stamp(r.createdAt)}</small></div><div><span class="badge">${esc(r.recommendation||r.status)}</span><small>${esc(r.stage)}</small>${r.acceptedEvidenceId?'<small>Saved as evidence</small>':''}</div>${r.companyId?`<button type="button" data-ai-run="${r.id}" data-company="${r.companyId}">Open research</button>`:`<a class="button" href="#analysis/${esc(r.analysisId)}">Open dashboard</a>`}</article>`).join(''):'<div class="empty"><h2>Your research inbox</h2><p>Completed assessments and follow-up answers will appear here.</p><button type="button" id="ai-inbox-start">Open research assistant</button></div>';
 if(target.innerHTML!==html){target.innerHTML=html;target.querySelectorAll('[data-ai-run]').forEach(b=>b.onclick=()=>showRun(b.dataset.company,b.dataset.aiRun).catch(showError));if($('#ai-inbox-start'))$('#ai-inbox-start').onclick=()=>setOpen(true);}
}

export async function researchForwardEPS(companyId,metricRequest){
 if(selected!==companyId)selectCompany(companyId);fillCompanies();setOpen(true);await start('forward_eps',metricRequest);
}
// Opens a specific saved run for its company in the panel (used by the inbox and the sector dashboard drill-down).
export async function showRun(companyId,runId){
 if(!$('#research-panel'))return;if(selected!==companyId)selectCompany(companyId);fillCompanies();
 const loaded=await api('runs/'+runId);if(selected!==companyId)return;viewSequence++;current=loaded;renderRun();setOpen(true);$('#ai-result').scrollIntoView({block:'start'});
}
