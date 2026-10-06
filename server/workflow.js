// Workflow: name-or-ticker intake, automatic dispositions with owner override and an owner-only Invested state, and the
// home-screen overview that joins workspace companies with their stored research. Dispositions live in an additive SQLite
// table; the workspace document stays at schema 1 and is written only through ordinary actions (company creation,
// a blank exchange or currency filled from a verified snapshot, provenance notes). No model output is written to the database.
import {z} from 'zod';
import {id,now,today,fail,parse,companyCopy} from './model.js';
import {rederiveGrowth} from './financial-snapshot.js';
import {dispositionForRating,dispositionForStatus,parseOverride,APP_DISPOSITIONS} from './dispositions.js';
import {intakeStage} from './intake.js';

const intakeInputSchema=z.object({entries:z.array(z.string().trim().min(1).max(80)).min(1).max(10)}).strict();
const chooseSchema=z.object({index:z.number().int().min(0).max(19),candidate:z.number().int().min(0).max(7).nullable()}).strict();

export class WorkflowService {
 constructor(store,research){
  this.store=store; this.db=store.db; this.research=research;
  this.db.exec(`CREATE TABLE IF NOT EXISTS dispositions (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, disposition TEXT NOT NULL, set_by TEXT NOT NULL, run_id TEXT, rating TEXT, previous TEXT, note TEXT NOT NULL, invested TEXT, created_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS dispositions_company ON dispositions(company_id,created_at);`);
  research.onRunFinished=runId=>this.afterRun(runId);
  this.backfill();
 }

 // ---- disposition storage (append-only; the latest row per company is current) ----
 rowView(r){ return r?{id:r.id,companyId:r.company_id,disposition:r.disposition,setBy:r.set_by,runId:r.run_id,rating:r.rating,previous:r.previous,note:r.note,invested:r.invested?JSON.parse(r.invested):null,createdAt:r.created_at}:null; }
 current(companyId){ return this.rowView(this.db.prepare('SELECT * FROM dispositions WHERE company_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(companyId)); }
 currentAll(){ const out=new Map(); for(const r of this.db.prepare('SELECT * FROM dispositions ORDER BY created_at,rowid').all()) out.set(r.company_id,this.rowView(r)); return out; }
 history(companyId){ return this.db.prepare('SELECT * FROM dispositions WHERE company_id=? ORDER BY created_at,rowid').all(companyId).map(r=>this.rowView(r)); }
 record({companyId,disposition,setBy,runId=null,rating=null,note='',invested=null}){
  if(setBy==='app'&&!APP_DISPOSITIONS.includes(disposition)) fail('The app never marks a company Invested.',500);
  if(disposition==='Invested'&&!invested) fail('Marking a company Invested needs the entry date and the entry price.');
  const previous=this.current(companyId)?.disposition??null;
  const row={id:id(),company_id:companyId,disposition,set_by:setBy,run_id:runId,rating,previous,note,invested:disposition==='Invested'?JSON.stringify(invested):null,created_at:now()};
  this.db.prepare('INSERT INTO dispositions VALUES (@id,@company_id,@disposition,@set_by,@run_id,@rating,@previous,@note,@invested,@created_at)').run(row);
  return this.rowView(row);
 }
 // Companies without a disposition get one from their latest stored assessment, otherwise from the legacy status. No workspace write.
 backfill(){
  const have=this.currentAll();
  for(const c of this.store.read().workspace.companies){
   if(have.has(c.id)) continue;
   const a=this.latestAssessment(c.id);
   if(a) this.record({companyId:c.id,disposition:dispositionForRating(a.rating).disposition,setBy:'app',runId:a.runId,rating:a.rating,note:`Initial disposition from the ${a.rating} assessment of ${a.asOf}.`});
   else this.record({companyId:c.id,disposition:dispositionForStatus(c.status),setBy:'app',note:`Initial disposition from the company status “${c.status}”.`});
  }
 }

 // ---- research lookups ----
 latestAssessment(companyId){
  const row=this.db.prepare("SELECT id,created_at,analysis_id,document FROM ai_runs WHERE company_id=? AND kind='review' AND status='completed' ORDER BY created_at DESC,rowid DESC LIMIT 1").get(companyId);
  if(!row) return null; const j=JSON.parse(row.document), r=j.report; if(!r) return null;
  return {runId:row.id,analysisId:row.analysis_id||null,createdAt:row.created_at,asOf:j.context.asOf,rating:r.recommendation,confidence:r.evidenceConfidence,summary:r.summary.text,model:j.model,sources:(j.sources||[]).length,accepted:!!this.db.prepare('SELECT run_id FROM ai_accepted WHERE run_id=?').get(row.id),detail:{bullCase:r.bullCase.map(p=>p.text),bearCase:r.bearCase.map(p=>p.text),catalysts:(r.catalysts||[]).map(p=>p.text),invalidationTriggers:r.invalidationTriggers,missingEvidence:r.missingEvidence,nextSteps:r.nextSteps}};
 }
 latestSnapshot(companyId){
  for(const row of this.db.prepare("SELECT id,created_at,document FROM ai_runs WHERE company_id=? AND status='completed' AND kind IN ('review','snapshot') ORDER BY created_at DESC,rowid DESC LIMIT 10").all(companyId)){
   const j=JSON.parse(row.document); if(j.snapshot) return {runId:row.id,createdAt:row.created_at,snapshot:rederiveGrowth(j.snapshot)};
  }
  return null;
 }
 pendingRun(companyId){ const r=this.db.prepare("SELECT id,kind,status,stage FROM ai_runs WHERE company_id=? AND status IN ('queued','running') ORDER BY created_at LIMIT 1").get(companyId); return r?{runId:r.id,kind:r.kind,status:r.status,stage:r.stage}:null; }

 // ---- after a run finishes ----
 afterRun(runId){
  const row=this.db.prepare('SELECT id,kind,status,company_id,document FROM ai_runs WHERE id=?').get(runId); if(!row||row.status!=='completed') return;
  const doc=JSON.parse(row.document);
  if(row.kind==='intake') return this.completeIntake(runId,doc);
  if(!row.company_id) return;
  if(doc.snapshot) this.fillListing(runId,row.company_id,doc.snapshot);
  if(row.kind==='review'&&doc.report) this.applyAssessment(runId,row.company_id,doc);
 }
 applyAssessment(runId,companyId,doc){
  const rating=doc.report.recommendation, {disposition}=dispositionForRating(rating), current=this.current(companyId);
  if(current?.setBy==='owner') return; // the owner's setting stands; a disagreeing assessment is shown as a notice, not applied
  if(current?.runId===runId) return;
  this.record({companyId,disposition,setBy:'app',runId,rating,note:`Applied from the ${rating} assessment of ${doc.context.asOf}.`});
 }
 // Fills a blank exchange or currency on the company record from the verified snapshot identity (never overwrites), then
 // re-stamps this run's fingerprint so the app's own fill-in does not read as an owner change to the research basis.
 fillListing(runId,companyId,snapshot){
  const exchange=(snapshot.identity?.exchange||'').trim(), currency=snapshot.identity?.quoteCurrency||snapshot.price?.currency||null;
  for(let attempt=0;attempt<3;attempt++){
   const {revision,workspace}=this.store.read(), c=workspace.companies.find(x=>x.id===companyId); if(!c||c.archivedAt) return;
   const next={exchange:c.exchange||exchange,currency:c.currency||currency};
   if(next.exchange===c.exchange&&next.currency===c.currency) return;
   const {id:_,revision:__,archivedAt,createdAt,updatedAt,...input}=companyCopy(c);
   try { this.store.update(revision,'company.update',{companyId,...input,...next}); this.research.restampFingerprint(runId,companyId); return; }
   catch(error){ if(error.status!==409){console.error('Listing fill-in skipped:',error.status?error.message:error.name);return;} }
  }
 }

 // ---- intake ----
 intake(value){
  if(!this.research.provider.configured()) fail('Connect an OpenAI API key on the server to run research.',503);
  const {entries}=parse(intakeInputSchema,value), seen=new Set(), unique=entries.filter(e=>{const k=e.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
  const active=this.store.read().workspace.companies.filter(c=>!c.archivedAt);
  const prepared=unique.map(query=>{
   const m=active.find(c=>c.ticker===query.toUpperCase()||c.name.trim().toLowerCase()===query.toLowerCase());
   return m?{query,status:'existing',match:{name:m.name,ticker:m.ticker,exchange:m.exchange,listingCountry:null,quoteCurrency:m.currency,securityType:'Common',description:m.role,confidence:'High',sourceIds:[],existingCompanyId:m.id,archived:false},candidates:[],notes:'Already in the workspace.',existingCompanyId:m.id}
           :{query,status:'pending',match:null,candidates:[],notes:'',existingCompanyId:null};
  });
  const run=this.research.startRun({kind:'intake',context:{intake:{label:unique.join(', ').slice(0,120),queries:prepared.filter(p=>p.status==='pending').map(p=>p.query)},existingCompanies:active.map(c=>({ticker:c.ticker,name:c.name,exchange:c.exchange}))},extra:{resolution:{entries:prepared}}});
  return this.intakeView(run);
 }
 intakeView(run){ return {id:run.id,status:run.status,stage:run.stage,createdAt:run.createdAt,updatedAt:run.updatedAt,error:run.error||null,entries:(run.resolution?.entries||[]).map(e=>({...e,match:e.match?{...e.match,archived:undefined}:null,candidates:(e.candidates||[]).map(({archived,...c})=>c)}))}; }
 listIntakes(limit=8){ return this.db.prepare("SELECT id FROM ai_runs WHERE kind='intake' ORDER BY created_at DESC,rowid DESC LIMIT ?").all(limit).map(r=>this.intakeView(this.research.read(r.id))); }
 completeIntake(runId,doc){
  const resolution=doc.resolution; if(!resolution) return;
  let changed=false;
  for(const entry of resolution.entries){
   if(entry.outcome||!['resolved','existing'].includes(entry.status)) continue;
   this.admit(entry,runId,doc.sources||[]); changed=true;
  }
  if(changed) this.research.patch(runId,{resolution},'completed',intakeStage(resolution));
 }
 // Admits one identified listing: reuse or create the company, give it a Research disposition and queue a snapshot-first review.
 admit(entry,runId,sources){
  try {
   const companyId=this.ensureCompany(entry,runId,sources); entry.companyId=companyId;
   const assessed=this.latestAssessment(companyId);
   if(entry.status==='existing'&&assessed){ entry.outcome='already_researched'; entry.outcomeNote=`Already researched (${assessed.rating}, ${assessed.asOf}).`; return; }
   if(!this.current(companyId)) this.record({companyId,disposition:'Research',setBy:'app',runId,note:`Added from the entry “${entry.query}”.`});
   try { const run=this.research.startRun({companyId,kind:'review',withSnapshot:true,origin:{kind:'intake',runId,query:entry.query}}); entry.reviewRunId=run.id; entry.outcome='research_queued'; }
   catch(error){ entry.outcome='research_not_started'; entry.outcomeNote=error.status?error.message:'Research could not be started.'; }
  } catch(error){ entry.outcome='failed'; entry.outcomeNote=error.status?error.message:'The company could not be added.'; }
 }
 ensureCompany(entry,runId,sources){
  const m=entry.match;
  for(let attempt=0;attempt<3;attempt++){
   const {revision,workspace}=this.store.read();
   const existing=workspace.companies.find(c=>c.id===(entry.existingCompanyId||m.existingCompanyId))||workspace.companies.find(c=>c.ticker===m.ticker&&!c.archivedAt)||workspace.companies.find(c=>c.ticker===m.ticker);
   if(existing){
    if(!existing.archivedAt) return existing.id;
    try { this.store.update(revision,'company.restore',{companyId:existing.id}); entry.restored=true; return existing.id; } catch(error){ if(error.status!==409) throw error; continue; }
   }
   try {
    const created=this.store.update(revision,'company.create',{ticker:m.ticker,name:m.name,exchange:m.exchange||'',currency:m.quoteCurrency||null,role:(m.description||'Added by name or ticker').slice(0,300),status:'Researching',thesis:'',risks:'',disconfirming:'',reviewDate:null,reviewTrigger:''});
    const companyId=created.workspace.companies.at(-1).id, first=sources.find(s=>(m.sourceIds||[]).includes(s.id));
    this.store.update(created.revision,'evidence.add',{companyId,note:`Added on ${today()} from the entry “${entry.query}”. Listing verified by research: ${m.name} (${m.ticker}${m.exchange?', '+m.exchange:''}${m.quoteCurrency?', '+m.quoteCurrency:''}). ${m.description||''}`.trim(),source:{title:first?first.title:'Company intake',url:first?first.url:null,publicationDate:null},asOfDate:today(),author:'Company intake',supersedesId:null});
    entry.created=true; return companyId;
   } catch(error){ if(error.status!==409) throw error; }
  }
  fail(`Could not add ${m.ticker} after concurrent edits. Try again.`,409);
 }
 chooseListing(runId,value){
  const {index,candidate}=parse(chooseSchema,value), run=this.research.read(runId);
  if(run.kind!=='intake') fail('Not an intake run.',404);
  if(run.status!=='completed') fail('Wait for the listing check to finish.',409);
  const resolution=run.resolution, entry=resolution?.entries[index];
  if(!entry||entry.status!=='ambiguous'||entry.outcome) fail('This entry no longer needs a choice.',409);
  if(candidate===null){ entry.outcome='dismissed'; entry.outcomeNote='You chose not to add this entry.'; }
  else {
   const c=entry.candidates[candidate]; if(!c) fail('Unknown listing choice.');
   entry.match=c; entry.status=c.existingCompanyId?'existing':'resolved'; entry.existingCompanyId=c.existingCompanyId||null; entry.chosenBy='owner';
   this.admit(entry,runId,run.sources||[]);
  }
  this.research.patch(runId,{resolution},'completed',intakeStage(resolution));
  return this.intakeView(this.research.read(runId));
 }

 // ---- owner override ----
 setDisposition(value){
  const o=parseOverride(value,today()), company=this.store.read().workspace.companies.find(c=>c.id===o.companyId); if(!company) fail('Company not found',404);
  if(o.disposition==='auto'){
   const a=this.latestAssessment(company.id), {disposition}=dispositionForRating(a?.rating);
   this.record({companyId:company.id,disposition,setBy:'app',runId:a?.runId||null,rating:a?.rating||null,note:a?`You released your setting; applied from the ${a.rating} assessment of ${a.asOf}.`:'You released your setting; no assessment yet.'});
  } else this.record({companyId:company.id,disposition:o.disposition,setBy:'owner',note:o.note||(o.disposition==='Invested'?o.invested.note:'')||'Set by you.',invested:o.disposition==='Invested'?o.invested:null});
  return this.companyOverview(company.id);
 }

 // ---- overview for the home screen and company pages ----
 overview(){
  const {workspace}=this.store.read(), current=this.currentAll(), day=today();
  const companies=workspace.companies.map(c=>this.entry(c,current.get(c.id)||null,workspace,day));
  const active=companies.filter(e=>!e.archivedAt), count=d=>active.filter(e=>e.disposition.value===d).length;
  return {today:day,companies,counts:{main:count('Watch')+count('Invested'),watch:count('Watch'),invested:count('Invested'),research:count('Research'),declined:count('Declined'),archived:companies.length-active.length,researching:active.filter(e=>e.pending).length},intakes:this.listIntakes()};
 }
 companyOverview(companyId){ const {workspace}=this.store.read(), c=workspace.companies.find(x=>x.id===companyId); if(!c) fail('Company not found',404); return this.entry(c,this.current(companyId),workspace,today()); }
 entry(c,row,workspace,day){
  const assessment=this.latestAssessment(c.id), snap=this.latestSnapshot(c.id), pending=this.pendingRun(c.id), s=snap?.snapshot||null;
  const manual=workspace.snapshots.filter(x=>x.companyId===c.id).sort((a,b)=>a.quoteDate.localeCompare(b.quoteDate)||a.enteredAt.localeCompare(b.enteredAt)).at(-1)||null;
  const age=d=>d?Math.round((Date.parse(day)-Date.parse(d))/86400000):null;
  const aiPrice=s&&s.price.value!=null?{value:s.price.value,currency:s.price.currency,asOfDate:s.price.asOfDate,source:'Research snapshot',runId:snap.runId}:null;
  const manualPrice=manual?{value:manual.price.value,currency:manual.currency,asOfDate:manual.quoteDate,source:'Manual snapshot',snapshotId:manual.id}:null;
  const price=[aiPrice,manualPrice].filter(Boolean).sort((a,b)=>String(b.asOfDate||'').localeCompare(String(a.asOfDate||'')))[0]||null;
  if(price) price.ageDays=age(price.asOfDate);
  const figures=s?{runId:snap.runId,asOf:s.asOf,comparable:s.quality.comparable,warnings:s.quality.warnings.length,missing:s.quality.missing.length,currency:s.financials.currency,marketCap:s.marketCap.value,marketCapCurrency:s.marketCap.currency,multiples:s.derived.multiples,margins:s.derived.margins,revenueGrowthPct:s.derived.revenueGrowthPct,revenueGrowthSource:s.derived.revenueGrowthSource,netDebt:s.derived.netDebt,periodLabel:s.financials.periodLabel,periodType:s.financials.periodType}:null;
  const disposition=row?{value:row.disposition,setBy:row.setBy,since:row.createdAt,runId:row.runId,rating:row.rating,previous:row.previous,note:row.note,invested:row.invested,highlight:row.setBy==='app'&&row.rating==='Consider'?'Consider':null}
                       :{value:'Research',setBy:'app',since:null,runId:null,rating:null,previous:null,note:'No assessment yet.',invested:null,highlight:null};
  let notice=null;
  if(row?.setBy==='owner'&&assessment&&assessment.createdAt>row.createdAt){
   const mapped=dispositionForRating(assessment.rating).disposition;
   if(mapped!==row.disposition) notice={suggested:mapped,rating:assessment.rating,asOf:assessment.asOf,runId:assessment.runId,text:`The ${assessment.rating} assessment of ${assessment.asOf} would file this company as ${mapped}. Your ${row.disposition} setting stands until you release it.`};
  }
  const listing={exchange:c.exchange||s?.identity.exchange||'',currency:c.currency||s?.identity.quoteCurrency||s?.price.currency||null};
  listing.fromResearch=listing.exchange!==c.exchange||listing.currency!==c.currency;
  return {id:c.id,ticker:c.ticker,name:c.name,role:c.role,archivedAt:c.archivedAt,reviewDate:c.reviewDate,status:c.status,listing,disposition,notice,assessment,price,figures,pending,manualSnapshots:workspace.snapshots.filter(x=>x.companyId===c.id).length,scenarios:workspace.scenarios.filter(x=>x.companyId===c.id).length,decisions:workspace.decisions.filter(x=>x.companyId===c.id).length};
 }
}
