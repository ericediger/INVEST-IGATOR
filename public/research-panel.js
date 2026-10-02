const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=s=>new Date(s).toLocaleString();
let workspace=null, selected='', open=false, status=null, current=null, runs=[], pollBusy=false, pending=false, inboxToken=0;
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
function selectCompany(value){rememberDraft();selected=value;current=null;runs=[];$('#ai-question').value=draftByCompany[selected]||'';$('#ai-result').innerHTML='<p class="hint">Loading company research…</p>';try{localStorage.setItem('research-company',value);}catch{}poll();}
function install(){
 const toggle=document.createElement('button');toggle.id='research-toggle';toggle.type='button';toggle.textContent='Research assistant';toggle.setAttribute('aria-controls','research-panel');toggle.setAttribute('aria-expanded','false');$('.topbar').append(toggle);
 const pane=document.createElement('aside');pane.id='research-panel';pane.className='research-panel';pane.setAttribute('aria-label','AI research assistant');pane.hidden=true;
 pane.innerHTML=`<div class="ai-head"><div><p class="eyebrow">RESEARCH ASSISTANT</p><h2>Evidence to conviction</h2></div><button id="ai-close" type="button" aria-label="Close research assistant">×</button></div>
 <div class="ai-body"><label for="ai-company">Company in focus</label><select id="ai-company"></select>
 <p id="ai-connection" class="hint" role="status">Checking research connection…</p>
 <details id="ai-settings"><summary>Research mandate & limits</summary><form id="ai-settings-form"><p class="hint">Company merits. Portfolio suitability is not assessed.</p><label for="ai-horizon">Valuation horizon (months)</label><input id="ai-horizon" type="number" min="3" max="60" required><label for="ai-criteria">Investment criteria</label><textarea id="ai-criteria" minlength="20" maxlength="3000" required></textarea><label for="ai-limit">Maximum runs per day</label><input id="ai-limit" type="number" min="1" max="30" required><p class="hint">Includes questions and failed runs. Resets at 00:00 UTC. Each review uses up to 3 model requests and 8 web tool calls; a question uses 1 request and up to 4 web tool calls. These are usage limits, not a dollar budget.</p><div class="actions"><button type="submit">Save mandate</button><button type="button" id="ai-settings-reload">Reload saved mandate</button></div><p id="ai-settings-feedback" role="status"></p></form></details>
 <div id="ai-setup" class="ai-callout" hidden><strong>Connect research</strong><p>Open “Connect AI.command” in the Investment Research app folder on the server Mac to add your OpenAI API key privately. Then choose Recheck connection.</p><button id="ai-recheck" type="button">Recheck connection</button></div>
 <p class="hint">Starting a run sends this company’s saved notes, evidence, snapshots, scenarios, recent decisions and recent AI conversation to OpenAI. The service searches the public web. Up to 20 recent evidence notes are included.</p>
 <button id="ai-review" type="button" class="primary">Research & recommend</button>
 <form id="ai-question-form"><label for="ai-question">Direct the research</label><textarea id="ai-question" maxlength="3000" placeholder="What would weaken this company’s investment case?" required></textarea><div class="actions"><button type="submit" id="ai-ask">Investigate question</button><a href="#research">All research</a></div></form>
 <p id="ai-feedback" class="error" role="alert" hidden></p>
 <label for="ai-history">Saved research & conversation</label><select id="ai-history"><option value="">No research yet</option></select>
 <div id="ai-result" aria-live="polite"><div class="ai-empty"><span class="ai-orbit">↗</span><h3>Build an evidence-backed view</h3><p>Research the company, test the thesis, and see what supports a recommendation.</p></div></div></div>`;
 $('.shell').append(pane);
 toggle.onclick=()=>setOpen(!open);$('#ai-close').onclick=()=>{setOpen(false);toggle.focus();};$('#ai-company').onchange=e=>selectCompany(e.target.value);
 $('#ai-recheck').onclick=()=>poll();$('#ai-review').onclick=()=>start('review');$('#ai-question-form').onsubmit=e=>{e.preventDefault();start('question');};
 $('#ai-history').onchange=async e=>{try{current=await api('runs/'+e.target.value);renderRun();}catch(err){showError(err);}};
 $('#ai-settings-form').oninput=()=>{settingsDirty=true;};
 $('#ai-settings-reload').onclick=()=>{settingsDirty=false;poll();};
 $('#ai-settings-form').onsubmit=async e=>{
  e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
  try{const saved=await api('settings',{horizonMonths:Number($('#ai-horizon').value),criteria:$('#ai-criteria').value,dailyLimit:Number($('#ai-limit').value)},settingsRevision);status.settings=saved;settingsRevision=saved.revision;settingsDirty=false;$('#ai-settings-feedback').textContent='Saved. New runs will use this mandate.';}
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
async function start(kind){
 if(pending||!selected)return;pending=true;buttons();$('#ai-feedback').hidden=true;
 try {const run=await api('runs',{companyId:selected,kind,question:kind==='question'?$('#ai-question').value:''});
  if(run.companyId===selected){current=run;if(kind==='question'){$('#ai-question').value='';draftByCompany[selected]='';}renderRun();}await poll();
 }catch(e){showError(e);}finally{pending=false;buttons();}
}
function buttons(){const archived=workspace?.companies.find(c=>c.id===selected)?.archivedAt;const busy=pending||runs.some(r=>['queued','running'].includes(r.status));const disabled=!status?.configured||!selected||!!archived||busy||status.usedToday>=status.settings.dailyLimit;$('#ai-review').disabled=disabled;$('#ai-ask').disabled=disabled;}
async function poll(){
 if(pollBusy||!$('#research-panel'))return;pollBusy=true;const cid=selected;
 try{
  const [info,list]=await Promise.all([api('status'),cid?api('runs?companyId='+encodeURIComponent(cid)):Promise.resolve({runs:[]})]);
  const first=!status;status=info;$('#ai-connection').textContent=`${info.configured?'API key configured':'AI connection needed'} · ${info.usedToday}/${info.settings.dailyLimit} runs today`;
  $('#ai-setup').hidden=info.configured;
  if(first||!settingsDirty){settingsRevision=info.settings.revision;$('#ai-horizon').value=info.settings.horizonMonths;$('#ai-criteria').value=info.settings.criteria;$('#ai-limit').value=info.settings.dailyLimit;}
  if(cid!==selected)return;runs=list.runs;
  const history=$('#ai-history');history.innerHTML=runs.length?runs.map(r=>`<option value="${r.id}">${r.kind==='review'?'Assessment':esc(r.question.slice(0,45))} · ${stamp(r.createdAt)} · ${esc(r.status)}</option>`).join(''):'<option value="">No research yet</option>';
  if(!current&&runs.length){const loaded=await api('runs/'+runs[0].id);if(cid!==selected)return;current=loaded;}
  else if(current){const latest=await api('runs/'+current.id);if(cid!==selected)return;if(latest.updatedAt!==current.updatedAt||latest.acceptedEvidenceId!==current.acceptedEvidenceId||latest.contextChanged!==current.contextChanged){current=latest;renderRun();}}
  if(current&&cid===selected){history.value=current.id;if($('#ai-result').dataset.run!==current.id)renderRun();}
  else if(!runs.length)$('#ai-result').innerHTML='<div class="ai-empty"><span class="ai-orbit">↗</span><h3>Build an evidence-backed view</h3><p>Start a review to collect sources, challenge the thesis, and produce a recommendation.</p></div>';
  if(location.hash==='#research')await renderResearchInbox();buttons();
 }catch(e){showError(e);}finally{pollBusy=false;if(cid!==selected)setTimeout(poll,0);}
}
function renderRun(){
 if(!current)return;const j=current,out=$('#ai-result');out.dataset.run=j.id;
 const meta=`<p class="meta">${esc(j.context.company.ticker)} · ${stamp(j.createdAt)}<br>${j.context.mandate.horizonMonths}-month horizon · Company merits only</p>`;
 if(['queued','running'].includes(j.status)){out.innerHTML=meta+`<div class="ai-callout"><strong role="status">${esc(j.stage)}</strong><p>You can leave this page. Work continues while the server is running.</p><button id="ai-cancel" type="button">Stop research</button></div>`;$('#ai-cancel').onclick=async()=>{try{current=await api('runs/'+j.id+'/cancel',{});renderRun();await poll();}catch(e){showError(e);}};return;}
 if(j.status!=='completed'){out.innerHTML=meta+`<div class="ai-callout"><strong>${esc(j.stage)}</strong><p>${esc(j.error||'A new run is needed to continue. Previous research and saved notes are preserved.')}</p><p class="hint">No automatic retry was made. Provider usage may still be charged.</p></div>`;return;}
 const sources=`<details><summary>Sources · ${j.sources.length}</summary><p class="hint">Collected during this run. Publication dates are unknown unless stated in the assessment. Citation checks establish source provenance, not factual correctness.</p><ol class="ai-sources">${j.sources.map(s=>`<li>${link(s)}</li>`).join('')}</ol></details>`;
 const context=`<details><summary>Research basis & usage</summary><p class="hint">${esc(j.model)} · prompt version ${j.promptVersion} · ${j.usage.reduce((n,u)=>n+u.inputTokens+u.outputTokens,0).toLocaleString()} reported tokens. This is not a dollar cost.</p>${j.context.omittedEvidenceCount?`<p>${j.context.omittedEvidenceCount} older evidence notes were outside this run’s context.</p>`:''}<pre>${esc(JSON.stringify(j.context,null,2))}</pre></details>`;
 if(j.kind==='question'){out.innerHTML=meta+`<h3>${esc(j.question)}</h3><div class="note">${linkedText(j.answer,j.sources)}</div>`+sources+context;return;}
 const r=j.report,computed=j.context.calculations,ref=j.context.referenceSnapshot;
 out.innerHTML=meta+`<div class="ai-verdict"><span class="eyebrow">AI RECOMMENDATION · ${j.acceptedEvidenceId?'REVIEWED EVIDENCE':'DRAFT'}</span><h2>${esc(r.recommendation)}</h2><span class="badge">Evidence confidence: ${esc(r.evidenceConfidence)}</span>${para(r.summary,j.sources)}</div><h3>Why this recommendation</h3>${para(r.rationale,j.sources)}
 <details open><summary>Business & financial assessment</summary>${para(r.businessQuality,j.sources)}${para(r.financialAssessment,j.sources)}</details>
 <details open><summary>Valuation</summary>${para(r.valuationAssessment,j.sources)}${computed?`<p class="hint">Saved scenario calculations · ${esc(ref.currency)} · reference ${esc(ref.quoteDate)} · target ${esc(j.context.scenario.targetDate)}</p><div class="ai-valuations">${['bear','base','bull'].map(k=>`<div><small>${k}</small><strong>${computed[k].price.toFixed(2)}</strong><small>${computed[k].priceReturn.toFixed(1)}%</small></div>`).join('')}</div>`:'<div class="ai-callout">Valuation incomplete. Add a dated snapshot and bear/base/bull assumptions for a calculated price range.</div>'}</details>
 ${[['bullCase','What supports the case'],['bearCase','What challenges the case'],['changes','What changed']].map(([k,label])=>r[k].length?`<details open><summary>${label}</summary>${r[k].map(p=>para(p,j.sources)).join('')}</details>`:'').join('')}
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
 const html=data.runs.length?data.runs.map(r=>`<article class="company-row ai-inbox-row"><div><strong>${esc(r.ticker)}</strong><p class="role">${r.kind==='review'?'Company assessment':esc(r.question.slice(0,120))}</p><small>${stamp(r.createdAt)}</small></div><div><span class="badge">${esc(r.recommendation||r.status)}</span><small>${esc(r.stage)}</small>${r.acceptedEvidenceId?'<small>Saved as evidence</small>':''}</div><button type="button" data-ai-run="${r.id}" data-company="${r.companyId}">Open research</button></article>`).join(''):'<div class="empty"><h2>Your research inbox</h2><p>Completed assessments and follow-up answers will appear here.</p><button type="button" id="ai-inbox-start">Open research assistant</button></div>';
 if(target.innerHTML!==html){target.innerHTML=html;target.querySelectorAll('[data-ai-run]').forEach(b=>b.onclick=async()=>{try{selectCompany(b.dataset.company);fillCompanies();current=await api('runs/'+b.dataset.aiRun);renderRun();setOpen(true);}catch(e){showError(e);}});if($('#ai-inbox-start'))$('#ai-inbox-start').onclick=()=>setOpen(true);}
}
