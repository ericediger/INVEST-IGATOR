import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/store.js';
import {ResearchService,DEFAULT_MANDATE} from '../server/research.js';
import {WorkflowService} from '../server/workflow.js';
import {dispositionForRating,dispositionForStatus} from '../server/dispositions.js';
import {validateIntake,parseEntries} from '../server/intake.js';
import {createApp} from '../server/app.js';
// SYNTHETIC PROVIDER — every figure, source, listing and company below is a test fixture, not market data.
const cite=(url,title)=>({type:'url_citation',url,title});
const response=(text,annotations=[])=>({id:'resp-test',status:'completed',model:'test-model',usage:{input_tokens:10,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text,annotations}]}]});
const para=(text,sourceIds=['S1'])=>({text,sourceIds});
const asOfOf=input=>(input.match(/As of:? (\d{4}-\d{2}-\d{2})/)||[])[1];
const tickerOf=input=>{const m=input.match(/Company: (\{.*?\})\n/s);return m?JSON.parse(m[1]).ticker:null;};
const queriesOf=input=>JSON.parse(input.match(/Owner entries: (\[.*?\])\n/s)[1]);
const daysAgo=(asOf,n)=>new Date(Date.parse(asOf)-n*86400000).toISOString().slice(0,10);
const snapshotDraft=(ticker,asOf)=>({
 identity:{name:ticker+' Synthetic',ticker,exchange:'NYSE',listingCountry:'US',quoteCurrency:'USD',reportingCurrency:'USD',fiscalYearEnd:'December',securityType:'Common',sourceIds:['S2']},
 price:{value:50,currency:'USD',asOfDate:daysAgo(asOf,1),asOfTime:null,sourceId:'S1'},
 shares:{basicOutstanding:1000000000,dilutedOutstanding:null,asOfDate:daysAgo(asOf,40),basis:'Cover page',sourceId:'S2'},
 marketCap:{value:null,currency:null,asOfDate:null,sourceId:null},enterpriseValue:{value:null,currency:null,asOfDate:null,sourceId:null},
 financials:{periodLabel:'FY2025',periodType:'FY',periodEndDate:'2025-12-31',basis:'US GAAP',currency:'USD',revenue:5000000000,ebitda:1000000000,ebit:800000000,netIncome:600000000,dilutedEPS:0.6,operatingCashFlow:900000000,capitalExpenditure:200000000,freeCashFlow:700000000,totalDebt:1500000000,cashAndEquivalents:500000000,sourceIds:['S2']},
 growth:{revenueGrowthPct:15,epsGrowthPct:null,periodLabel:'FY2025',sourceIds:['S2']},history:[],
 consensus:{forwardEPS:0.8,forwardEPSPeriod:'FY2026',forwardRevenue:null,forwardRevenuePeriod:null,targetPrice:null,currency:'USD',asOfDate:daysAgo(asOf,3),sourceId:'S1'},
 operatingMetrics:[],notes:'SYNTHETIC',missing:[]
});
const report=rating=>({summary:para('SYNTHETIC summary.'),recommendation:rating,rationale:para('SYNTHETIC rationale.'),evidenceConfidence:'Moderate',businessQuality:para('SYNTHETIC business.'),financialAssessment:para('SYNTHETIC financials.',['S2']),valuationAssessment:para('SYNTHETIC valuation.',[]),bullCase:[para('SYNTHETIC bull.')],bearCase:[para('SYNTHETIC bear.',['S2'])],catalysts:[para('SYNTHETIC catalyst.')],changes:[],assumptions:['SYNTHETIC assumption'],missingEvidence:[],invalidationTriggers:['SYNTHETIC trigger'],nextSteps:['SYNTHETIC step']});
const candidate=(name,ticker,exchange,country,currency,confidence='High',extra={})=>({name,ticker,exchange,listingCountry:country,quoteCurrency:currency,securityType:'Common',description:`SYNTHETIC ${name}.`,confidence,sourceIds:['S1'],...extra});
const intakeDraft=queries=>({entries:queries.map(query=>{
 if(/synthetic peer/i.test(query)) return {query,status:'resolved',candidates:[candidate('Synthetic Peer Inc','syn','NYSE','US','usd','High',{description:'SYNTHETIC peer.'})],notes:''};
 if(/ambiguous/i.test(query)) return {query,status:'ambiguous',candidates:[candidate('Ambiguous Co plc','AMB','LSE','GB','GBP','Moderate'),candidate('Ambiguous Co AG','AMBD','XETRA','DE','EUR','Moderate')],notes:'Two listed companies share this name.'};
 if(/nowhere/i.test(query)) return {query,status:'unresolved',candidates:[],notes:'No listing found.'};
 if(/etf/i.test(query)) return {query,status:'not_a_company',candidates:[],notes:'An exchange-traded fund.'};
 if(/eaton/i.test(query)) return {query,status:'resolved',candidates:[candidate('Eaton Corporation plc','ETN','NYSE','IE','USD')],notes:''};
 if(/lowconf/i.test(query)) return {query,status:'resolved',candidates:[candidate('Low Confidence Co','LOW','NYSE','US','USD','Low')],notes:''};
 if(/badticker/i.test(query)) return {query,status:'resolved',candidates:[candidate('Broken','BAD TICKER!','NYSE','US','USD')],notes:''};
 return {query,status:'resolved',candidates:[candidate(query+' Corp',query.replace(/[^A-Za-z]/g,'').slice(0,4).toUpperCase(),'NYSE','US','USD')],notes:''};
}).filter(e=>!/dropme/i.test(e.query))});
class Provider {
 constructor(){this.model='test-model';this.reasoningEffort='medium';this.calls=[];this.enabled=true;this.rating='Watch';this.fail=false;this.gate=null;}
 configured(){return this.enabled;}
 async request(input){
  this.calls.push(input);
  if(this.gate&&!/Owner entries/.test(input.input))await this.gate; // holds company reviews so queued state is observable
  if(input.signal?.aborted)throw Object.assign(new Error('Research stopped'),{status:502});
  if(input.schema){
   if(input.schemaName==='financial_snapshot')return response(JSON.stringify(snapshotDraft(tickerOf(input.input),asOfOf(input.input))));
   if(input.schemaName==='intake_resolution')return response(JSON.stringify(intakeDraft(queriesOf(input.input))));
   if(this.fail)return response('{broken');
   return response(JSON.stringify(report(this.rating)));
  }
  return response('SYNTHETIC RESEARCH — not market data.',[cite('https://example.com/filing','SYNTHETIC filing'),cite('https://example.com/quote','SYNTHETIC quote')]);
 }
}
function setup(t,provider=new Provider()){
 const dir=mkdtempSync(join(tmpdir(),'workflow-test-')),store=new Store(join(dir,'research.sqlite'),join(dir,'backups'));
 const ai=new ResearchService(store,provider,{concurrency:2}),wf=new WorkflowService(store,ai);t.after(()=>{ai.close();store.close();});
 return {dir,store,ai,wf,provider,cid:store.read().workspace.companies[0].id};
}
async function finished(ai,id){for(let i=0;i<600;i++){const run=ai.read(id);if(!['queued','running'].includes(run.status))return run;await new Promise(r=>setTimeout(r,5));}throw new Error('Did not finish');}
const tick=()=>new Promise(r=>setTimeout(r,6));

test('rating and status mapping: Consider highlights Watch, Pass declines, missing data stays Research and never Declined',()=>{
 assert.deepEqual(dispositionForRating('Consider'),{disposition:'Watch',highlight:'Consider'});
 assert.deepEqual(dispositionForRating('Watch'),{disposition:'Watch',highlight:null});
 assert.deepEqual(dispositionForRating('Pass'),{disposition:'Declined',highlight:null});
 assert.deepEqual(dispositionForRating('Research further'),{disposition:'Research',highlight:null});
 for(const v of [null,undefined,'','Invested','Unknown']) assert.equal(dispositionForRating(v).disposition,'Research');
 assert.equal(dispositionForStatus('Watching'),'Watch');assert.equal(dispositionForStatus('Passed'),'Declined');assert.equal(dispositionForStatus('Researching'),'Research');assert.equal(dispositionForStatus(undefined),'Research');
 assert.deepEqual(parseEntries(' VRT, Rheinmetall;vrt\nSchneider Electric,, '),['VRT','Rheinmetall','vrt','Schneider Electric']);
});

test('a completed snapshot-first review files the company automatically, fills its blank listing and keeps the run basis intact',async t=>{
 const {ai,wf,store,cid}=setup(t);
 const before=wf.companyOverview(cid);assert.equal(before.disposition.value,'Research');assert.match(before.disposition.note,/company status/);assert.equal(before.assessment,null);assert.equal(before.price,null);
 const run=await finished(ai,ai.enqueue({companyId:cid,kind:'review',withSnapshot:true}).id);assert.equal(run.status,'completed',run.error);
 const e=wf.companyOverview(cid);
 assert.equal(e.disposition.value,'Watch');assert.equal(e.disposition.setBy,'app');assert.equal(e.disposition.runId,run.id);assert.equal(e.disposition.rating,'Watch');assert.equal(e.disposition.previous,'Research');assert.equal(e.disposition.highlight,null);
 assert.equal(e.assessment.runId,run.id);assert.equal(e.assessment.summary,'SYNTHETIC summary.');assert.deepEqual(e.assessment.detail.bearCase,['SYNTHETIC bear.']);
 assert.equal(e.price.source,'Research snapshot');assert.equal(e.price.value,50);assert.equal(e.price.ageDays,1);assert.equal(e.figures.multiples.peForward,62.5);assert.equal(e.figures.comparable,true);assert.equal(e.pending,null);
 const c=store.read().workspace.companies.find(x=>x.id===cid);assert.equal(c.exchange,'NYSE');assert.equal(c.currency,'USD');assert.equal(c.revision,2);assert.equal(c.history[0].exchange,'');
 assert.equal(ai.read(run.id).contextChanged,false);assert.equal(e.listing.fromResearch,false);assert.equal(e.listing.exchange,'NYSE');
 const o=wf.overview();assert.equal(o.counts.watch,1);assert.equal(o.counts.main,1);assert.equal(o.counts.research,6);assert.equal(o.counts.declined,0);assert.equal(o.counts.researching,0);
 // A second review re-confirms the basis without an owner change; only the owner's own edits mark the run's context as changed.
 const again=await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);assert.equal(wf.companyOverview(cid).disposition.runId,again.id);assert.equal(store.read().workspace.companies.find(x=>x.id===cid).revision,2);
});

test('a Consider assessment files as Watch with a highlight, Pass declines, and a failed run changes nothing',async t=>{
 const provider=new Provider();provider.rating='Consider';const {ai,wf,cid}=setup(t,provider);
 await finished(ai,ai.enqueue({companyId:cid,kind:'review',withSnapshot:true}).id);
 let e=wf.companyOverview(cid);assert.equal(e.disposition.value,'Watch');assert.equal(e.disposition.highlight,'Consider');assert.equal(e.assessment.rating,'Consider');
 provider.rating='Pass';await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);
 e=wf.companyOverview(cid);assert.equal(e.disposition.value,'Declined');assert.equal(e.disposition.previous,'Watch');assert.equal(wf.overview().counts.declined,1);
 provider.fail=true;const bad=await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);assert.equal(bad.status,'failed');
 e=wf.companyOverview(cid);assert.equal(e.disposition.value,'Declined');assert.equal(wf.history(cid).length,3);
});

test('an owner setting sticks across a disagreeing assessment, shows a notice, and can be released to the app',async t=>{
 const {ai,wf,cid}=setup(t);
 let e=wf.setDisposition({companyId:cid,disposition:'Declined',note:'Not for me'});
 assert.equal(e.disposition.value,'Declined');assert.equal(e.disposition.setBy,'owner');assert.equal(e.disposition.note,'Not for me');assert.equal(e.notice,null);
 await tick();const run=await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);
 e=wf.companyOverview(cid);assert.equal(e.disposition.value,'Declined');assert.equal(e.disposition.setBy,'owner');assert.equal(e.notice.suggested,'Watch');assert.equal(e.notice.runId,run.id);assert.match(e.notice.text,/stands until you release it/);
 assert.equal(wf.history(cid).length,2);
 e=wf.setDisposition({companyId:cid,disposition:'auto'});assert.equal(e.disposition.value,'Watch');assert.equal(e.disposition.setBy,'app');assert.equal(e.disposition.runId,run.id);assert.equal(e.notice,null);assert.match(e.disposition.note,/released/);
 assert.throws(()=>wf.setDisposition({companyId:'00000000-0000-4000-8000-000000000000',disposition:'Watch'}),e=>e.status===404);
});

test('Invested is set only by the owner, needs an entry date and price, and is never changed by an assessment',async t=>{
 const {ai,wf,provider,cid}=setup(t);
 assert.throws(()=>wf.setDisposition({companyId:cid,disposition:'Invested'}),/entry date and the entry price/);
 assert.throws(()=>wf.setDisposition({companyId:cid,disposition:'Invested',invested:{date:'2999-01-01',price:10,currency:'USD'}}),/future/);
 assert.throws(()=>wf.setDisposition({companyId:cid,disposition:'Invested',invested:{date:'2026-01-01',price:0,currency:'USD'}}));
 assert.throws(()=>wf.setDisposition({companyId:cid,disposition:'Watch',invested:{date:'2026-01-01',price:10,currency:'USD'}}),/only when marking/);
 assert.throws(()=>wf.record({companyId:cid,disposition:'Invested',setBy:'app'}),/never marks/);
 let e=wf.setDisposition({companyId:cid,disposition:'Invested',invested:{date:'2026-01-02',price:101.5,currency:'USD',quantity:10,note:'Test entry'}});
 assert.equal(e.disposition.value,'Invested');assert.equal(e.disposition.setBy,'owner');assert.deepEqual(e.disposition.invested,{date:'2026-01-02',price:101.5,currency:'USD',amount:null,quantity:10,note:'Test entry'});assert.equal(e.disposition.note,'Test entry');
 provider.rating='Pass';await tick();await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);
 e=wf.companyOverview(cid);assert.equal(e.disposition.value,'Invested');assert.equal(e.notice.suggested,'Declined');
 const o=wf.overview();assert.equal(o.counts.invested,1);assert.equal(o.counts.main,1);assert.equal(o.counts.declined,0);
});

test('startup backfill maps stored assessments and legacy statuses once, without touching the workspace',async t=>{
 const provider=new Provider();provider.rating='Research further';
 const dir=mkdtempSync(join(tmpdir(),'workflow-backfill-')),store=new Store(join(dir,'research.sqlite'),join(dir,'backups')),ai=new ResearchService(store,provider,{concurrency:2});t.after(()=>{ai.close();store.close();});
 const w=store.read().workspace,etn=w.companies[0],vrt=w.companies[1];
 const {id,history,revision,archivedAt,createdAt,updatedAt,...input}=etn;store.update(store.read().revision,'company.update',{companyId:etn.id,...input,status:'Watching'});
 await finished(ai,ai.enqueue({companyId:vrt.id,kind:'review'}).id);
 const before=store.read(),wf=new WorkflowService(store,ai);
 assert.deepEqual(store.read(),before);
 const o=wf.overview(),by=tk=>o.companies.find(c=>c.ticker===tk);
 assert.equal(by('ETN').disposition.value,'Watch');assert.match(by('ETN').disposition.note,/status “Watching”/);
 assert.equal(by('VRT').disposition.value,'Research');assert.equal(by('VRT').disposition.rating,'Research further');assert.match(by('VRT').disposition.note,/assessment/);
 assert.equal(by('NVT').disposition.value,'Research');assert.equal(o.counts.main,1);assert.equal(o.counts.research,6);
 const again=new WorkflowService(store,ai);assert.equal(again.history(etn.id).length,1);assert.equal(again.history(vrt.id).length,1);
});

test('intake validation: tickers normalized, unusable tickers dropped, low confidence asks, dropped entries unresolved, workspace matches flagged',()=>{
 const sources=[{id:'S1',url:'https://example.com/a',title:'A'}];
 const existing=[{id:'c1',ticker:'ETN',name:'Eaton',exchange:'NYSE',currency:'USD',archivedAt:null}];
 const out=validateIntake(intakeDraft(['Synthetic Peer','Ambiguous Co','Nowhere Inc','Fixture ETF','Eaton plc','LowConf','BadTicker','DropMe']),sources,{queries:['Synthetic Peer','Ambiguous Co','Nowhere Inc','Fixture ETF','Eaton plc','LowConf','BadTicker','DropMe'],existing});
 assert.deepEqual(out.map(e=>e.status),['resolved','ambiguous','unresolved','not_a_company','existing','ambiguous','unresolved','unresolved']);
 assert.equal(out[0].match.ticker,'SYN');assert.equal(out[0].match.quoteCurrency,'USD');assert.deepEqual(out[0].match.sourceIds,['S1']);
 assert.equal(out[1].candidates.length,2);assert.equal(out[1].match,null);
 assert.equal(out[4].existingCompanyId,'c1');assert.match(out[6].notes,/not a usable ticker/);assert.match(out[7].notes,/no result/);
});

test('intake verifies listings, adds companies with provenance, files them as Research and queues snapshot-first reviews',async t=>{
 const {ai,wf,store,provider,cid}=setup(t);ai.saveSettings({...DEFAULT_MANDATE,dailyLimit:30},ai.settings().revision);
 const before=store.read().workspace;
 assert.throws(()=>wf.intake({entries:[]}));
 let release;provider.gate=new Promise(r=>release=r);
 const intake=wf.intake({entries:['Synthetic Peer','Ambiguous Co','Nowhere Inc','Fixture ETF','ETN','synthetic peer']});
 assert.equal(intake.status,'queued');assert.equal(intake.entries.length,5);assert.equal(intake.entries[4].status,'existing');assert.equal(intake.entries[0].status,'pending');
 const run=await finished(ai,intake.id);assert.equal(run.status,'completed',run.error);assert.equal(provider.calls.filter(c=>c.schemaName==='intake_resolution').length,1);
 const view=wf.listIntakes()[0],by=q=>view.entries.find(e=>e.query===q);
 assert.equal(view.id,intake.id);assert.match(view.stage,/2 companies identified · 1 needs your choice · 2 not added/);
 assert.equal(by('Synthetic Peer').status,'resolved');assert.equal(by('Synthetic Peer').match.ticker,'SYN');assert.equal(by('Synthetic Peer').outcome,'research_queued');assert.ok(by('Synthetic Peer').companyId);assert.equal(by('Synthetic Peer').created,true);
 assert.equal(by('Ambiguous Co').status,'ambiguous');assert.equal(by('Ambiguous Co').candidates.length,2);assert.equal(by('Ambiguous Co').companyId,undefined);
 assert.equal(by('Nowhere Inc').status,'unresolved');assert.equal(by('Fixture ETF').status,'not_a_company');
 assert.equal(by('ETN').status,'existing');assert.equal(by('ETN').outcome,'research_queued');assert.equal(by('ETN').companyId,cid);
 const after=store.read().workspace;assert.equal(after.companies.length,before.companies.length+1);
 const syn=after.companies.find(c=>c.ticker==='SYN');assert.equal(syn.exchange,'NYSE');assert.equal(syn.currency,'USD');assert.equal(syn.role,'SYNTHETIC peer.');assert.equal(syn.status,'Researching');
 assert.ok(after.evidence.some(e=>e.companyId===syn.id&&e.author==='Company intake'&&e.source.url==='https://example.com/filing'&&/Synthetic Peer/.test(e.note)));
 let s=wf.companyOverview(syn.id);assert.equal(s.disposition.value,'Research');assert.match(s.disposition.note,/Synthetic Peer/);assert.ok(s.pending);assert.equal(s.pending.kind,'review');assert.equal(wf.overview().counts.researching,2);
 release();provider.gate=null;
 await finished(ai,by('Synthetic Peer').reviewRunId);await finished(ai,by('ETN').reviewRunId);
 assert.equal(wf.companyOverview(syn.id).disposition.value,'Watch');assert.equal(wf.companyOverview(cid).disposition.value,'Watch');
 const synRun=ai.read(by('Synthetic Peer').reviewRunId);assert.equal(synRun.withSnapshot,true);assert.deepEqual(synRun.origin,{kind:'intake',runId:intake.id,query:'Synthetic Peer'});assert.ok(synRun.snapshot);
 // The owner chooses one of the ambiguous listings; the choice is final.
 const chosen=wf.chooseListing(intake.id,{index:1,candidate:1}),amb=chosen.entries[1];
 assert.equal(amb.status,'resolved');assert.equal(amb.match.ticker,'AMBD');assert.equal(amb.chosenBy,'owner');assert.equal(amb.outcome,'research_queued');
 assert.throws(()=>wf.chooseListing(intake.id,{index:1,candidate:0}),e=>e.status===409);assert.throws(()=>wf.chooseListing(intake.id,{index:2,candidate:0}),e=>e.status===409);
 const ambd=store.read().workspace.companies.find(c=>c.ticker==='AMBD');assert.ok(ambd);assert.equal(ambd.currency,'EUR');assert.equal(ambd.exchange,'XETRA');
 await finished(ai,amb.reviewRunId);assert.equal(wf.companyOverview(ambd.id).disposition.value,'Watch');
 assert.equal(ai.status().usedToday,4); // the intake plus three reviews
 // An entry that already matches a researched company is recognized without a provider call and is not re-run.
 const calls=provider.calls.length,second=wf.intake({entries:['Eaton']});await finished(ai,second.id);
 const e2=wf.listIntakes()[0].entries[0];assert.equal(e2.status,'existing');assert.equal(e2.outcome,'already_researched');assert.match(e2.outcomeNote,/Watch/);assert.equal(provider.calls.length,calls);
 assert.ok(ai.list().some(r=>r.kind==='intake'&&r.companyId===null&&r.ticker==='Synthetic Peer, Ambiguous Co, Nowhere Inc, Fixture ETF, ETN'));
 // Dismissing an ambiguous entry adds nothing.
 const third=wf.intake({entries:['Ambiguous Co']});await finished(ai,third.id);
 const dismissed=wf.chooseListing(third.id,{index:0,candidate:null}).entries[0];assert.equal(dismissed.outcome,'dismissed');assert.equal(store.read().workspace.companies.filter(c=>/^AMB/.test(c.ticker)).length,1);
});

test('intake at the daily limit still adds the company and records that research did not start; archived matches are restored',async t=>{
 const {ai,wf,store}=setup(t);ai.saveSettings({...DEFAULT_MANDATE,dailyLimit:1},ai.settings().revision);
 const intake=wf.intake({entries:['Synthetic Peer']});await finished(ai,intake.id);
 const e=wf.listIntakes()[0].entries[0];assert.equal(e.status,'resolved');assert.equal(e.outcome,'research_not_started');assert.match(e.outcomeNote,/Daily research limit/);
 const syn=store.read().workspace.companies.find(c=>c.ticker==='SYN');assert.ok(syn);assert.equal(wf.companyOverview(syn.id).disposition.value,'Research');assert.equal(wf.companyOverview(syn.id).pending,null);
 assert.throws(()=>wf.intake({entries:['Another']}),e=>e.status===429);
 ai.saveSettings({...DEFAULT_MANDATE,dailyLimit:30},ai.settings().revision);
 store.update(store.read().revision,'company.archive',{companyId:syn.id,confirm:true});
 const again=wf.intake({entries:['Synthetic Peer']});await finished(ai,again.id);
 const r=wf.listIntakes()[0].entries[0];assert.equal(r.status,'existing');assert.equal(r.restored,true);assert.equal(r.companyId,syn.id);assert.equal(store.read().workspace.companies.find(c=>c.id===syn.id).archivedAt,null);
 const p=new Provider();p.enabled=false;const other=setup(t,p);assert.throws(()=>other.wf.intake({entries:['X']}),e=>e.status===503);
});

test('workflow HTTP routes return the overview, accept intake and overrides, and keep the origin protections',async t=>{
 const {ai,wf,store,cid}=setup(t);const root='http://127.0.0.1:5198',app=createApp(store,{origin:root,research:ai,workflow:wf}),server=app.listen(5198,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const headers={Origin:root,'Content-Type':'application/json','X-Research-Request':'1'};
 let res=await fetch(root+'/api/workflow/overview');assert.equal(res.status,200);const o=await res.json();assert.equal(o.companies.length,7);assert.equal(o.counts.research,7);assert.deepEqual(o.intakes,[]);assert.match(o.today,/^\d{4}-\d{2}-\d{2}$/);
 res=await fetch(root+'/api/workflow/dispositions',{method:'POST',headers,body:JSON.stringify({companyId:cid,disposition:'Watch'})});assert.equal(res.status,200);assert.equal((await res.json()).disposition.value,'Watch');
 res=await fetch(root+'/api/workflow/dispositions',{method:'POST',headers,body:JSON.stringify({companyId:cid,disposition:'Invested'})});assert.equal(res.status,400);
 res=await fetch(root+'/api/workflow/intake',{method:'POST',headers,body:JSON.stringify({entries:['Synthetic Peer']})});assert.equal(res.status,202);const intake=await res.json();assert.equal(intake.entries[0].status,'pending');await finished(ai,intake.id);
 res=await fetch(root+'/api/workflow/intakes');assert.equal((await res.json()).intakes[0].entries[0].outcome,'research_queued');
 for(const path of ['/api/workflow/intake','/api/workflow/dispositions','/api/workflow/intake/x/choose'])assert.equal((await fetch(root+path,{method:'POST',headers:{...headers,Origin:'https://attacker.example'},body:'{}'})).status,403);
 res=await fetch(root+'/api/workflow/intake/'+intake.id+'/choose',{method:'POST',headers,body:JSON.stringify({index:0,candidate:0})});assert.equal(res.status,409);
 res=await fetch(root+'/api/workflow/intake/nope/choose',{method:'POST',headers,body:JSON.stringify({index:0,candidate:0})});assert.equal(res.status,404);
});
