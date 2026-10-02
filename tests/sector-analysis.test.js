import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/store.js';
import {ResearchService,DEFAULT_MANDATE,validateAssessment} from '../server/research.js';
import {validateDiscovery,validateComparison,comparisonContext,parseSeeds} from '../server/sector-analysis.js';
import {createApp} from '../server/app.js';
// SYNTHETIC PROVIDER — every figure, source and company relationship below is a test fixture, not market data.
const cite=(url,title)=>({type:'url_citation',url,title});
const response=(text,annotations=[])=>({id:'resp-test',status:'completed',model:'test-model',usage:{input_tokens:10,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text,annotations}]}]});
const para=(text,sourceIds=['S1'])=>({text,sourceIds});
const asOfOf=input=>(input.match(/As of:? (\d{4}-\d{2}-\d{2})/)||[])[1];
const tickerOf=input=>{const m=input.match(/Company: (\{.*?\})\n/s);return m?JSON.parse(m[1]).ticker:null;};
const daysAgo=(asOf,n)=>new Date(Date.parse(asOf)-n*86400000).toISOString().slice(0,10);
const discoveryDraft=()=>({sectorDefinition:'SYNTHETIC sector definition.',candidates:[
 {name:'Vertiv',ticker:'vrt',exchange:'NYSE',listingCountry:'US',quoteCurrency:'USD',securityType:'Common',relevance:'Existing workspace company.',approximateMarketCap:null,marketCapCurrency:null,isSeed:false,confidence:'High',sourceIds:['S1']},
 {name:'Rheinmetall AG',ticker:'RHM',exchange:'XETRA',listingCountry:'DE',quoteCurrency:'EUR',securityType:'Common',relevance:'SYNTHETIC pure play.',approximateMarketCap:80000000000,marketCapCurrency:'EUR',isSeed:false,confidence:'High',sourceIds:['S2']},
 {name:'Broken',ticker:'BAD TICKER!',exchange:null,listingCountry:null,quoteCurrency:null,securityType:'Other',relevance:'Unusable ticker.',approximateMarketCap:null,marketCapCurrency:null,isSeed:false,confidence:'Low',sourceIds:[]},
 {name:'Rheinmetall duplicate',ticker:'rhm',exchange:'XETRA',listingCountry:'DE',quoteCurrency:'EUR',securityType:'Common',relevance:'Duplicate.',approximateMarketCap:null,marketCapCurrency:null,isSeed:false,confidence:'Low',sourceIds:[]},
 {name:'Extra One',ticker:'EX1',exchange:'LSE',listingCountry:'GB',quoteCurrency:'GBP',securityType:'Common',relevance:'SYNTHETIC extra.',approximateMarketCap:null,marketCapCurrency:null,isSeed:false,confidence:'Moderate',sourceIds:['S1']},
 {name:'Extra Two',ticker:'EX2',exchange:'LSE',listingCountry:'GB',quoteCurrency:'ZZZ',securityType:'Common',relevance:'SYNTHETIC overflow.',approximateMarketCap:null,marketCapCurrency:null,isSeed:false,confidence:'Low',sourceIds:['S1']}
],excluded:[{name:'Some ETF',reason:'Fund'}],notes:'SYNTHETIC notes.'});
const snapshotDraft=(ticker,asOf)=>({
 identity:{name:ticker+' Synthetic',ticker,exchange:'NYSE',listingCountry:'US',quoteCurrency:'USD',reportingCurrency:'USD',fiscalYearEnd:'December',securityType:'Common',sourceIds:['S2']},
 price:{value:50,currency:'USD',asOfDate:ticker==='VRT'?daysAgo(asOf,30):daysAgo(asOf,1),asOfTime:null,sourceId:'S1'},
 shares:{basicOutstanding:1000000000,dilutedOutstanding:null,asOfDate:daysAgo(asOf,40),basis:'Cover page',sourceId:'S2'},
 marketCap:{value:null,currency:null,asOfDate:null,sourceId:null},enterpriseValue:{value:null,currency:null,asOfDate:null,sourceId:null},
 financials:{periodLabel:'FY2025',periodType:'FY',periodEndDate:'2025-12-31',basis:'US GAAP',currency:'USD',revenue:5000000000,ebitda:1000000000,ebit:800000000,netIncome:600000000,dilutedEPS:0.6,operatingCashFlow:900000000,capitalExpenditure:200000000,freeCashFlow:700000000,totalDebt:1500000000,cashAndEquivalents:500000000,sourceIds:['S2']},
 growth:{revenueGrowthPct:15,epsGrowthPct:null,periodLabel:'FY2025',sourceIds:['S2']},history:[],
 consensus:{forwardEPS:0.8,forwardEPSPeriod:'FY2026',forwardRevenue:null,forwardRevenuePeriod:null,targetPrice:null,currency:'USD',asOfDate:daysAgo(asOf,3),sourceId:'S1'},
 operatingMetrics:[{name:'Backlog',value:9000000000,unit:'USD',periodLabel:'FY2025',sourceId:'S2'}],notes:'SYNTHETIC',missing:[]
});
const report=()=>({summary:para('SYNTHETIC summary.'),recommendation:'Consider',rationale:para('SYNTHETIC rationale.'),evidenceConfidence:'Moderate',businessQuality:para('SYNTHETIC business.'),financialAssessment:para('SYNTHETIC financials.',['S2']),valuationAssessment:para('SYNTHETIC valuation uses app multiples.',[]),bullCase:[para('SYNTHETIC bull.')],bearCase:[para('SYNTHETIC bear.',['S2'])],catalysts:[para('SYNTHETIC catalyst.')],changes:[],assumptions:['SYNTHETIC assumption'],missingEvidence:[],invalidationTriggers:['SYNTHETIC trigger'],nextSteps:['SYNTHETIC step']});
const comparisonDraft=(input,{omitLast=true}={})=>{
 const companies=JSON.parse(input.match(/Companies: (\[.*\])\nSource registry/s)[1]), registry=JSON.parse(input.split('Source registry: ')[1]);
 const ids=registry.slice(0,1).map(s=>s.id), rows=omitLast?companies.slice(0,-1):companies;
 return {sectorSummary:{text:'SYNTHETIC sector summary.',sourceIds:ids},ranking:rows.map((c,i)=>({ticker:c.ticker,rank:i+1,rating:'Consider',thesis:{text:`SYNTHETIC thesis for ${c.ticker}.`,sourceIds:ids},keyEvidence:[{text:'SYNTHETIC evidence.',sourceIds:ids}],valuation:{text:'SYNTHETIC valuation.',sourceIds:['bogus']},relativeAttractiveness:{text:'SYNTHETIC relative view.',sourceIds:[]},catalysts:['SYNTHETIC catalyst'],risks:['SYNTHETIC risk'],invalidation:['SYNTHETIC invalidation'],confidence:'Moderate',dataLimitations:[]})),preferredRationale:{text:'SYNTHETIC preferred rationale.',sourceIds:ids},sectorRisks:['SYNTHETIC sector risk'],assumptions:['SYNTHETIC assumption'],caveats:[]};
};
class Provider {
 constructor(opts={}){this.model='test-model';this.reasoningEffort='medium';this.calls=[];this.enabled=true;this.opts=opts;this.inflight=0;this.maxInflight=0;}
 configured(){return this.enabled;}
 async request(input){
  this.calls.push(input);this.inflight++;this.maxInflight=Math.max(this.maxInflight,this.inflight);
  try{
   if(this.opts.hook)await this.opts.hook(input,this);
   if(input.signal?.aborted)throw Object.assign(new Error('Research stopped'),{status:502});
   if(input.schema){
    if(input.schemaName==='sector_discovery')return response(JSON.stringify(discoveryDraft()));
    if(input.schemaName==='financial_snapshot')return response(JSON.stringify(snapshotDraft(tickerOf(input.input),asOfOf(input.input))));
    if(input.schemaName==='sector_comparison')return response(JSON.stringify(comparisonDraft(input.input,this.opts)));
    return response(JSON.stringify(report()));
   }
   return response('SYNTHETIC RESEARCH — not market data.',[cite('https://example.com/quote','SYNTHETIC quote'),cite('https://example.com/filing','SYNTHETIC filing')]);
  }finally{this.inflight--;}
 }
}
function setup(t,provider=new Provider(),options={concurrency:2}){
 const dir=mkdtempSync(join(tmpdir(),'sector-analysis-test-')),path=join(dir,'research.sqlite'),backups=join(dir,'backups');
 const store=new Store(path,backups),ai=new ResearchService(store,provider,options);t.after(()=>{ai.close();store.close();});
 return {dir,path,backups,store,ai,provider};
}
async function finished(ai,id,read='readAnalysis'){for(let i=0;i<600;i++){const a=ai[read](id);if(!['queued','running'].includes(a.status))return a;await new Promise(r=>setTimeout(r,5));}throw new Error('Did not finish');}

test('a sector request runs discovery, company research with snapshots, and a ranked comparison without manual steps',async t=>{
 const {ai,store,provider}=setup(t);
 ai.saveSettings({...DEFAULT_MANDATE,maxCompanies:4},ai.settings().revision);
 const before=store.read().workspace;
 const created=ai.createAnalysis({sector:'European defense',seedCompanies:['ETN'],criteria:'Prefer primary listings.'});
 assert.equal(created.status,'queued');assert.equal(created.input.maxCompanies,4);assert.equal(created.estimatedRequests,23);
 assert.equal(ai.status().usedToday,1);assert.equal(ai.status().activeAnalysis.id,created.id);
 assert.throws(()=>ai.createAnalysis({sector:'Another sector'}),e=>e.status===409);
 const a=await finished(ai,created.id);
 assert.equal(a.status,'completed',a.error);assert.equal(a.stage,'Recommendation ready');assert.equal(a.phase,'comparison');
 // Discovery: seed retained from the workspace even though the model dropped it, ticker case normalized, bad/duplicate/overflow dropped.
 assert.deepEqual(a.companies.map(c=>c.ticker),['ETN','VRT','RHM','EX1']);
 assert.equal(a.companies.find(c=>c.ticker==='ETN').isSeed,true);assert.equal(a.companies.find(c=>c.ticker==='ETN').existing,true);
 assert.ok(a.discovery.excluded.some(e=>/Unusable ticker/.test(e.reason)));assert.ok(a.discovery.excluded.some(e=>/Beyond the 4-company limit/.test(e.reason)));
 assert.deepEqual(a.discovery.unresolvedSeeds,[]);
 // Discovered companies were added to the workspace with provenance; existing ones were reused.
 const after=store.read().workspace;
 assert.equal(after.companies.length,before.companies.length+2);
 const rhm=after.companies.find(c=>c.ticker==='RHM');assert.equal(rhm.exchange,'XETRA');assert.equal(rhm.currency,'EUR');assert.match(rhm.role,/European defense/);
 const ex1=after.companies.find(c=>c.ticker==='EX1');assert.equal(ex1.currency,'GBP');assert.equal(ex1.exchange,'LSE');
 assert.ok(after.evidence.some(e=>e.companyId===rhm.id&&e.author==='AI sector discovery'&&e.source.url==='https://example.com/filing'));
 assert.equal(after.companies.filter(c=>c.ticker==='ETN').length,1);
 // Each company run collected a normalized snapshot and a cited assessment: 2 discovery + 4×5 + 1 comparison provider requests.
 assert.equal(provider.calls.length,23);assert.equal(a.usage.requests,23);assert.equal(a.runs.length,6);
 for(const c of a.companies){assert.equal(c.status,'completed');assert.ok(c.snapshot);assert.equal(c.snapshot.marketCap.value,50000000000);assert.equal(c.snapshot.derived.multiples.peForward,62.5);assert.ok(c.report);assert.equal(c.report.catalysts.length,1);}
 // Consider gating: fresh app-collected price keeps Consider; a 30-day-old price is downgraded in both the company assessment and the ranking.
 assert.equal(a.companies.find(c=>c.ticker==='ETN').report.recommendation,'Consider');
 assert.equal(a.companies.find(c=>c.ticker==='VRT').report.recommendation,'Research further');
 const ranking=a.comparison.report.ranking;
 assert.deepEqual(ranking.map(r=>r.rank),[1,2,3,4]);assert.deepEqual(ranking.map(r=>r.ticker),['ETN','VRT','RHM','EX1']);
 assert.equal(ranking[0].rating,'Consider');assert.equal(ranking[1].rating,'Research further');assert.ok(ranking[1].dataLimitations[0].includes('downgraded'));
 assert.equal(ranking[3].requestedRating,null);assert.ok(ranking[3].dataLimitations[0].includes('omitted'));
 assert.deepEqual(ranking[0].valuation.sourceIds,[]);assert.equal(ranking[0].thesis.sourceIds[0],'A1');
 assert.ok(a.comparison.registry.length>=2);assert.ok(a.comparison.caveats.some(c=>/older than 7 days/.test(c)));
 // Traceability: each ranked company links to its company run, which appears in the company's own research history.
 for(const r of ranking){const run=ai.read(r.runId);assert.equal(run.companyId,r.companyId);assert.equal(run.analysisId,a.id);assert.equal(run.kind,'review');assert.equal(run.withSnapshot,true);assert.equal(run.context.analysis.sector,'European defense');}
 assert.equal(ai.list(rhm.id).length,1);assert.equal(ai.list(rhm.id)[0].analysisId,a.id);
 const inbox=ai.list();assert.ok(inbox.some(r=>r.kind==='discovery'&&r.ticker==='European defense'&&r.companyId===null));
 assert.equal(ai.listAnalyses()[0].topPick.ticker,'ETN');assert.equal(ai.export().analyses.length,1);assert.equal(ai.export().schemaVersion,2);
 assert.equal(ai.status().activeAnalysis,null);assert.equal(ai.status().usedToday,1);
 assert.throws(()=>ai.accept(a.comparison.runId,store.read().revision,false),/analysis archive/);
 const saved=ai.accept(ranking[0].runId,store.read().revision,false);assert.match(saved.workspace.evidence.at(-1).note,/Financial snapshot \(app-normalized\)/);
});

test('company research runs concurrently up to the configured limit while each company keeps a single pending run',async t=>{
 const provider=new Provider({hook:async()=>{await new Promise(r=>setTimeout(r,8));}});
 const {ai}=setup(t,provider,{concurrency:2});
 ai.saveSettings({...DEFAULT_MANDATE,maxCompanies:4},ai.settings().revision);
 const a=await finished(ai,ai.createAnalysis({sector:'SYNTHETIC sector'}).id);
 assert.equal(a.status,'completed',a.error);assert.equal(provider.maxInflight,2);
 const serial=new Provider({hook:async()=>{await new Promise(r=>setTimeout(r,3));}});const {ai:one}=setup(t,serial,{concurrency:1});
 one.saveSettings({...DEFAULT_MANDATE,maxCompanies:2},one.settings().revision);
 const b=await finished(one,one.createAnalysis({sector:'SYNTHETIC sector'}).id);assert.equal(b.status,'completed',b.error);assert.equal(serial.maxInflight,1);
});

test('stopping an analysis cancels its pending company research and never starts the comparison',async t=>{
 let release,held;const provider=new Provider({hook:async(input,p)=>{if(p.calls.length===3){held=new Promise(r=>release=r);await held;}}});
 const {ai}=setup(t,provider,{concurrency:1});
 ai.saveSettings({...DEFAULT_MANDATE,maxCompanies:3},ai.settings().revision);
 const created=ai.createAnalysis({sector:'SYNTHETIC sector'});
 for(let i=0;i<200&&!held;i++)await new Promise(r=>setTimeout(r,5));
 assert.ok(held);const running=ai.readAnalysis(created.id);assert.equal(running.status,'running');assert.equal(running.phase,'companies');assert.equal(running.companies.length,3);
 const stopped=ai.cancelAnalysis(created.id);assert.equal(stopped.status,'cancelled');
 release();await new Promise(r=>setTimeout(r,30));
 const final=ai.readAnalysis(created.id);assert.equal(final.status,'cancelled');
 assert.ok(final.runs.filter(r=>r.kind==='review').every(r=>r.status==='cancelled'));assert.ok(!final.runs.some(r=>r.kind==='comparison'));
 assert.equal(final.comparison,null);assert.equal(ai.status().activeAnalysis,null);
 assert.equal(ai.cancelAnalysis(created.id).status,'cancelled');
});

test('a server restart marks a running analysis interrupted and preserves completed company research',async t=>{
 let seen=0;const provider=new Provider({hook:async(input,p)=>{if(p.calls.length>=8)await new Promise(()=>{});}});
 const {ai,store}=setup(t,provider,{concurrency:1});
 ai.saveSettings({...DEFAULT_MANDATE,maxCompanies:2},ai.settings().revision);
 const created=ai.createAnalysis({sector:'SYNTHETIC sector'});
 for(let i=0;i<300;i++){seen=provider.calls.length;if(seen>=8)break;await new Promise(r=>setTimeout(r,5));}
 assert.ok(seen>=8);
 const restarted=new ResearchService(store,provider,{concurrency:1});
 try{
  const a=restarted.readAnalysis(created.id);assert.equal(a.status,'interrupted');assert.match(a.error,/server stopped/i);
  assert.equal(a.companies[0].status,'completed');assert.ok(a.companies[0].report);assert.equal(a.companies[1].status,'interrupted');
  assert.equal(restarted.status().usedToday,1);
 }finally{restarted.close();}
});

test('daily limit counts an analysis once; provider failures fail the analysis without automatic retry',async t=>{
 const {ai}=setup(t);
 ai.saveSettings({...DEFAULT_MANDATE,dailyLimit:1,maxCompanies:2},ai.settings().revision);
 const a=await finished(ai,ai.createAnalysis({sector:'SYNTHETIC sector'}).id);assert.equal(a.status,'completed',a.error);
 assert.throws(()=>ai.createAnalysis({sector:'SYNTHETIC sector'}),e=>e.status===429);
 const broken=new Provider();broken.request=async input=>{broken.calls.push(input);if(input.schemaName==='sector_discovery')return response('{broken');return response('SYNTHETIC',[cite('https://example.com/a','A')]);};
 const {ai:failing}=setup(t,broken);
 const b=await finished(failing,failing.createAnalysis({sector:'SYNTHETIC sector'}).id);
 assert.equal(b.status,'failed');assert.match(b.error,/unreadable company list/);assert.equal(broken.calls.length,2);assert.equal(b.companies.length,0);
 assert.throws(()=>failing.createAnalysis({sector:'x'}),/at least 2/);
});

test('standalone financial snapshot and snapshot-first reviews reuse the company research queue',async t=>{
 const {ai,store,provider}=setup(t);const cid=store.read().workspace.companies[0].id;
 const snap=await finished(ai,ai.enqueue({companyId:cid,kind:'snapshot'}).id,'read');
 assert.equal(snap.status,'completed');assert.equal(snap.stage,'Financial snapshot ready');assert.equal(provider.calls.length,2);assert.equal(snap.snapshot.identity.ticker,'ETN');assert.equal(snap.snapshot.enterpriseValue.value,51000000000);
 assert.throws(()=>ai.accept(snap.id,store.read().revision,false),/Only a completed assessment/);
 const review=await finished(ai,ai.enqueue({companyId:cid,kind:'review',withSnapshot:true}).id,'read');
 assert.equal(review.status,'completed');assert.equal(provider.calls.length,7);assert.equal(review.usage.length,5);assert.ok(review.snapshot);assert.equal(review.report.recommendation,'Consider');
 assert.ok(review.report.missingEvidence.some(m=>/relies on the app-collected financial snapshot/.test(m)));
 assert.match(provider.calls[4].input,/App-normalized financial snapshot collected this run/);
 assert.equal(review.history.at(-1).snapshot.split('\n')[0].startsWith('Identity: ETN Synthetic'),true);
 assert.equal(ai.status().usedToday,2);
});

test('discovery and comparison validators enforce seeds, limits, archived companies, ranking coverage and citations',()=>{
 const sources=[{id:'S1',url:'https://example.com/a',title:'A'}];
 const existing=[{id:'c1',ticker:'ETN',name:'Eaton',exchange:'NYSE',currency:'USD',archivedAt:null},{id:'c2',ticker:'OLD',name:'Archived Co',exchange:'',currency:null,archivedAt:'2026-01-01T00:00:00.000Z'}];
 const d=validateDiscovery(discoveryDraft(),sources,{seeds:['Eaton','Unknown Corp'],maxCompanies:3,existing});
 assert.deepEqual(d.candidates.map(c=>c.ticker),['ETN','VRT','RHM']);assert.equal(d.candidates[0].companyId,'c1');assert.deepEqual(d.unresolvedSeeds,['Unknown Corp']);
 // Seeds resolve by partial name (“Rheinmetall” → “Rheinmetall AG”); share-class tickers with spaces are normalized; verbose output is bounded, not rejected.
 const live={...discoveryDraft(),candidates:[{...discoveryDraft().candidates[1],isSeed:true},{name:'Saab AB (publ)',ticker:'SAAB B',exchange:'Nasdaq Stockholm',listingCountry:'SE',quoteCurrency:'SEK',securityType:'Common',relevance:'x'.repeat(2000),approximateMarketCap:null,marketCapCurrency:null,isSeed:false,confidence:'High',sourceIds:['S1']}]};
 const r2=validateDiscovery(live,sources,{seeds:['Rheinmetall'],maxCompanies:6,existing:[]});
 assert.deepEqual(r2.unresolvedSeeds,[]);assert.deepEqual(r2.candidates.map(c=>c.ticker),['RHM','SAAB-B']);assert.equal(r2.candidates[1].relevance.length,1500);assert.match(r2.notes,/relevance: shortened/);
 assert.throws(()=>validateDiscovery(discoveryDraft(),sources,{seeds:['OLD'],maxCompanies:3,existing}),e=>e.status===409);
 assert.throws(()=>validateDiscovery({...discoveryDraft(),candidates:[]},sources,{seeds:[],maxCompanies:3,existing}),e=>e.status===502);
 assert.deepEqual(parseSeeds(' Eaton, VRT;\nRheinmetall , '),['Eaton','VRT','Rheinmetall']);
 const snapshot=(ticker,fresh)=>({quality:{freshPrice:fresh,hasValuationMultiple:true,priceAgeDays:fresh?1:20,comparable:true},financials:{periodType:'FY',currency:'USD'},price:{asOfDate:'2026-09-12'}});
 const companies=[{ticker:'AAA',companyId:'a',runId:'ra',name:'A',snapshot:snapshot('AAA',true)},{ticker:'BBB',companyId:'b',runId:'rb',name:'B',snapshot:snapshot('BBB',false)},{ticker:'CCC',companyId:'c',runId:'rc',name:'C',snapshot:null}];
 const raw={sectorSummary:para('S',['A1']),ranking:[{ticker:'bbb',rank:2,rating:'Consider',thesis:para('t',['A1','zzz']),keyEvidence:[],valuation:para('v',[]),relativeAttractiveness:para('r',[]),catalysts:[],risks:[],invalidation:[],confidence:'High',dataLimitations:[]},{ticker:'AAA',rank:1,rating:'Consider',thesis:para('t',['A1']),keyEvidence:[],valuation:para('v',[]),relativeAttractiveness:para('r',[]),catalysts:[],risks:[],invalidation:[],confidence:'High',dataLimitations:[]},{ticker:'ZZZ',rank:3,rating:'Pass',thesis:para('t',[]),keyEvidence:[],valuation:para('v',[]),relativeAttractiveness:para('r',[]),catalysts:[],risks:[],invalidation:[],confidence:'Low',dataLimitations:[]}],preferredRationale:para('p',['A1']),sectorRisks:[],assumptions:[],caveats:[]};
 const r=validateComparison(raw,[{id:'A1',url:'https://example.com/a',title:'A'}],companies);
 assert.deepEqual(r.ranking.map(x=>[x.ticker,x.rank,x.rating]),[['AAA',1,'Consider'],['BBB',2,'Research further'],['CCC',3,'Research further']]);
 assert.deepEqual(r.ranking[1].thesis.sourceIds,['A1']);assert.equal(r.ranking[2].requestedRating,null);
 assert.throws(()=>validateComparison({...raw,sectorSummary:para('S',[]),ranking:raw.ranking.map(x=>({...x,thesis:para('t',[])}))},[{id:'A1'}],companies),/cited no sources/);
 const verbose={...raw,ranking:raw.ranking.map(x=>({...x,keyEvidence:Array.from({length:9},()=>para('e',['A1'])),risks:Array.from({length:12},(_,i)=>`risk ${i}`)})),caveats:['model caveat']};
 const bounded=validateComparison(verbose,[{id:'A1',url:'https://example.com/a',title:'A'}],companies);
 assert.equal(bounded.ranking[0].keyEvidence.length,6);assert.equal(bounded.ranking[0].risks.length,8);assert.ok(bounded.caveats.some(c=>/keyEvidence: kept 6 of 9/.test(c)));assert.equal(bounded.caveats[0],'model caveat');
 const long=report();long.bullCase=Array.from({length:7},()=>para('b'));long.summary=para('s'.repeat(3000));
 const assessed=validateAssessment(long,[{id:'S1'},{id:'S2'}],{asOf:'2026-09-13',referenceSnapshot:null,calculations:null,scenario:null});
 assert.equal(assessed.bullCase.length,5);assert.equal(assessed.summary.text.length,2500);assert.ok(assessed.missingEvidence.some(m=>/Model output bounded/.test(m)));
 const ctx=comparisonContext([{companyId:'a',ticker:'AAA',name:'A',runId:'ra',report:report(),snapshot:null,sources:[{id:'S1',url:'https://example.com/a',title:'A'},{id:'S2',url:'https://example.com/b',title:'B'}]},{companyId:'b',ticker:'BBB',name:'B',runId:'rb',report:report(),snapshot:null,sources:[{id:'S1',url:'https://example.com/b',title:'B'}]}]);
 assert.deepEqual(ctx.registry.map(s=>s.id),['A1','A2']);assert.deepEqual(ctx.companies[1].report.summary.sourceIds,['A2']);assert.ok(ctx.caveats.some(c=>/No financial snapshot/.test(c)));
});

test('analysis HTTP routes inherit origin protection and return jobs immediately',async t=>{
 const {ai}=setup(t);ai.saveSettings({...DEFAULT_MANDATE,maxCompanies:2},ai.settings().revision);
 const root='http://127.0.0.1:5198',app=createApp(ai.store,{origin:root,research:ai}),server=app.listen(5198,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const headers={Origin:root,'Content-Type':'application/json','X-Research-Request':'1'};
 let res=await fetch(root+'/api/research/analyses',{method:'POST',headers,body:JSON.stringify({sector:'SYNTHETIC sector',seedCompanies:['ETN'],criteria:''})});assert.equal(res.status,202);const created=await res.json();assert.equal(created.status,'queued');
 res=await fetch(root+'/api/research/analyses',{method:'POST',headers:{...headers,Origin:'https://attacker.example'},body:'{}'});assert.equal(res.status,403);
 res=await fetch(root+'/api/research/analyses/'+created.id+'/cancel',{method:'POST',headers:{...headers,Origin:'https://attacker.example'},body:'{}'});assert.equal(res.status,403);
 await finished(ai,created.id);
 res=await fetch(root+'/api/research/analyses');assert.equal(res.status,200);const list=await res.json();assert.equal(list.analyses.length,1);assert.equal(list.analyses[0].status,'completed');
 res=await fetch(root+'/api/research/analyses/'+created.id);const a=await res.json();assert.equal(a.comparison.report.ranking.length,2);assert.equal(a.progress.completed,4);assert.equal(a.progress.total,4);
 res=await fetch(root+'/api/research/analyses/nope');assert.equal(res.status,404);
 res=await fetch(root+'/api/research/status');assert.equal((await res.json()).promptVersion,2);
});
