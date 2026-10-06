import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/store.js';
import {RateLimiter} from '../server/feeds/rate-limiter.js';
import {isTradingDay,lastTradingDayOnOrBefore,dailyFetchDue,newYork} from '../server/feeds/calendar.js';
import {fetchDailyPrices,tiingoSymbol} from '../server/feeds/tiingo.js';
import {extractFinancials,fetchTickerMap} from '../server/feeds/edgar.js';
import {fetchSimplePrices} from '../server/feeds/coingecko.js';
import {FeedService,mergeFeedDraft,feedSummary,readSecret} from '../server/feeds/index.js';
import {FeedError} from '../server/feeds/errors.js';
import {normalizeSnapshot} from '../server/financial-snapshot.js';
import {ResearchService,DEFAULT_MANDATE} from '../server/research.js';
import {WorkflowService} from '../server/workflow.js';
import {edgarFacts,fakeFetcher} from './fixtures/feeds.mjs';
// SYNTHETIC FIXTURES ONLY — no real market data, keys or filings.
const FIXED=new Date('2026-10-06T21:00:00Z'); // Tuesday 17:00 New York
function dataDir({tiingo=true,edgar=true}={}){const dir=mkdtempSync(join(tmpdir(),'feeds-test-'));if(tiingo)writeFileSync(join(dir,'tiingo-api-key'),'SYNTHETICTIINGOTOKEN0000000000000000\n',{mode:0o600});if(edgar)writeFileSync(join(dir,'edgar-contact'),'Test Owner test@example.com\n',{mode:0o600});return dir;}
// The default test clock advances seven seconds per reading so sliding windows move as they would in real time.
const ticking=(start=FIXED.getTime())=>{let t=start;return ()=>new Date(t+=7000);};
function setup(t,{keys={},fetcherOptions={},clock=ticking()}={}){
 const dir=mkdtempSync(join(tmpdir(),'feeds-store-')),store=new Store(join(dir,'research.sqlite'),join(dir,'backups')),calls=[],closers=[];
 const feeds=new FeedService(store,{dataDir:dataDir(keys),version:'test',fetcher:fakeFetcher({...fetcherOptions,calls}),clock});t.after(()=>{for(const c of closers.reverse()) c();feeds.close();store.close();});
 return {store,feeds,calls,closers,etn:store.read().workspace.companies[0]};
}
const company=(store,ticker,extra={})=>{const w=store.update(store.read().revision,'company.create',{ticker,name:ticker+' Synthetic',exchange:'NYSE',currency:'USD',role:'SYNTHETIC',status:'Researching',thesis:'',risks:'',disconfirming:'',reviewDate:null,reviewTrigger:'',...extra}).workspace;return w.companies.at(-1);};

test('rate limiter: minute, hour and day buckets, capacity for a budget check, and persisted daily usage',()=>{
 let t=Date.parse('2026-10-06T12:00:00Z');const saved={};
 const l=new RateLimiter({perMinute:2,perHour:3,perDay:4,now:()=>t,save:(day,count)=>{saved.day=day;saved.count=count;}});
 assert.equal(l.capacity(),3,'the budget check uses the hourly and daily quotas');l.recordCall();l.recordCall();assert.equal(l.canCall(),false,'the per-minute bucket paces calls');assert.deepEqual(l.remaining(),{minute:0,hour:1,day:2,usedToday:2});assert.equal(l.waitMs(),60001-0);
 t+=61000;assert.equal(l.capacity(),1);assert.equal(l.waitMs(),0);l.recordCall();assert.equal(l.canCall(),false);t+=3600001;assert.equal(l.capacity(),1);l.recordCall();assert.equal(l.remaining().day,0);assert.equal(l.canCall(),false);
 assert.deepEqual(saved,{day:'2026-10-06',count:4});
 const reloaded=new RateLimiter({perMinute:9,perHour:9,perDay:4,now:()=>t,load:()=>saved});assert.equal(reloaded.remaining().usedToday,4);assert.equal(reloaded.canCall(),false);
 t=Date.parse('2026-10-07T00:00:01Z');assert.equal(reloaded.remaining().usedToday,0);assert.equal(reloaded.canCall(),true);
});

test('market calendar: weekends and NYSE holidays are not trading days; the daily fetch is due once after 16:45 New York time',()=>{
 assert.equal(isTradingDay('2026-10-06'),true);assert.equal(isTradingDay('2026-10-04'),false);assert.equal(isTradingDay('2026-11-26'),false);assert.equal(isTradingDay('2027-07-05'),false);
 assert.equal(lastTradingDayOnOrBefore('2026-10-04'),'2026-10-02');assert.equal(lastTradingDayOnOrBefore('2026-11-27'),'2026-11-27');assert.equal(lastTradingDayOnOrBefore('2026-11-26'),'2026-11-25');
 assert.equal(dailyFetchDue(new Date('2026-10-06T20:30:00Z')),null);assert.equal(dailyFetchDue(new Date('2026-10-06T20:46:00Z')),'2026-10-06');assert.equal(dailyFetchDue(new Date('2026-10-04T22:00:00Z')),null);
 assert.deepEqual(newYork(new Date('2026-10-06T21:00:00Z')),{date:'2026-10-06',minutes:17*60});
});

test('Tiingo: symbols map dots to dashes, bars are parsed and sorted, and HTTP 200 text bodies are feed errors, not parse errors',async()=>{
 const calls=[],fetcher=fakeFetcher({calls,close:200});
 assert.equal(tiingoSymbol('brk.b'),'BRK-B');
 const bars=await fetchDailyPrices(fetcher,'KEY','BRK.B',{startDate:'2026-09-24','endDate':'2026-10-06'});
 assert.ok(calls[0].url.includes('/tiingo/daily/BRK-B/prices?startDate=2026-09-24&endDate=2026-10-06'));assert.ok(!calls[0].url.includes('KEY=')&&calls[0].url.includes('token=KEY'));
 assert.deepEqual(bars.map(b=>[b.date,b.close]),[['2026-10-05',199.5],['2026-10-06',200]]);
 await assert.rejects(()=>fetchDailyPrices(fetcher,'KEY','RATE',{startDate:'2026-10-01',endDate:'2026-10-06'}),e=>e instanceof FeedError&&e.type==='RATE_LIMITED'&&/exceeded/.test(e.message));
 await assert.rejects(()=>fetchDailyPrices(fetcher,'KEY','ZZZ',{startDate:'2026-10-01',endDate:'2026-10-06'}),e=>e instanceof FeedError&&e.type==='NOT_FOUND');
 await assert.rejects(()=>fetchDailyPrices(fetcher,'KEY','HTML',{startDate:'2026-10-01',endDate:'2026-10-06'}),e=>e instanceof FeedError&&e.type==='PROVIDER_ERROR'&&/Service Temporarily/.test(e.message));
 const cg=await fetchSimplePrices(fetcher,['bitcoin','nothing']);assert.equal(cg.bitcoin.price,60000.5);assert.equal(cg.bitcoin.currency,'USD');assert.equal(cg.nothing,undefined);
});

test('SEC EDGAR: fiscal years keyed by period end with restatements winning, debt summed from lines with a note, EBITDA derived, cover-page shares, contact required',async()=>{
 const f=extractFinancials(edgarFacts);
 assert.equal(f.currency,'USD');assert.equal(f.basis,'US GAAP (XBRL as filed)');assert.equal(f.entityName,'Synthetic Filer Inc');
 assert.deepEqual(f.years.map(y=>y.periodLabel),['FY2025','FY2024','FY2023']);
 const y=f.years[0];assert.equal(y.periodEndDate,'2025-12-31');assert.equal(y.revenue,10000000000);assert.equal(y.ebit,2000000000);assert.equal(y.ebitda,2500000000);assert.equal(y.netIncome,1500000000);assert.equal(y.dilutedEPS,3.66);assert.equal(y.operatingCashFlow,2200000000);assert.equal(y.capitalExpenditure,400000000);assert.equal(y.totalDebt,3000000000);assert.equal(y.cashAndEquivalents,1000000000);assert.equal(y.dilutedShares,410000000);assert.equal(y.form,'10-K');assert.equal(y.accn,'0001-26-000001');
 assert.equal(f.years[1].revenue,9050000000,'the restated comparative from the later 10-K wins');assert.equal(f.years[1].cashAndEquivalents,900000000);assert.equal(f.years[1].ebitda,2150000000);assert.equal(f.years[2].ebitda,null);
 assert.deepEqual(f.sharesOutstanding,{value:400000000,asOf:'2026-07-31',form:'10-Q',accn:'0001-26-000002',filed:'2026-08-05'});
 assert.ok(f.notes.some(n=>/summed from 2 balance-sheet debt lines/.test(n)));assert.ok(f.notes.some(n=>/EBITDA = operating income/.test(n)));
 const calls=[];const map=await fetchTickerMap(fakeFetcher({calls}),'Test Owner test@example.com','test');assert.equal(map.ETN.cik,1234567);assert.match(calls[0].headers['User-Agent'],/^INVEST-IGATOR\/test \(Test Owner test@example.com\)$/);
 await assert.rejects(()=>fetchTickerMap(fakeFetcher(),'no-contact','test'),e=>e instanceof FeedError&&e.type==='AUTH');
 assert.deepEqual(extractFinancials({facts:{}}).years,[]);
});

test('daily close fetch stores dated observations, marks symbols Tiingo lacks, refuses a plan over the quota, and persists usage across restarts',async t=>{
 const {store,feeds,etn,calls}=setup(t);
 const zzz=company(store,'ZZZ'),wsp=company(store,'WSP',{exchange:'Toronto Stock Exchange (TSX)',currency:'CAD'});
 assert.equal(feeds.tiingoEligible(wsp),false,'non-US listings are not sent to Tiingo');
 const r=await feeds.refreshPrices({kind:'manual'});
 assert.equal(r.requests,8);assert.equal(r.updated,7);assert.equal(r.failed,1);assert.deepEqual(r.details.find(d=>d.ticker==='ZZZ'),{ticker:'ZZZ',outcome:'failed',reason:'Tiingo: not found'});
 assert.deepEqual(feeds.latestPrice(etn.id),{...feeds.latestPrice(etn.id),date:'2026-10-06',close:123.45,currency:'USD',source:'Tiingo close'});assert.equal(feeds.priceHistory(etn.id).length,2);
 assert.equal(feeds.profile(zzz.id).feedStatus,'not_found');assert.equal(feeds.tiingoEligible(zzz),false);
 const again=await feeds.refreshPrices({kind:'manual'});assert.equal(again.requests,7,'the missing symbol is skipped for 30 days');
 assert.equal(feeds.status().usage.tiingo.usedToday,15);assert.equal(feeds.status().companiesWithPrices,7);assert.equal(feeds.status().lastFetch.updated,7);
 feeds.limiters.tiingo.perHour=16;
 await assert.rejects(()=>feeds.refreshPrices({kind:'manual'}),e=>e.status===429&&/needs 7 Tiingo requests but only 1 remain/.test(e.message));
 const restarted=new FeedService(store,{dataDir:feeds.dataDir,version:'test',fetcher:fakeFetcher(),clock:ticking()});t.after(()=>restarted.close());
 assert.equal(restarted.status().usage.tiingo.usedToday,15,'daily usage survives a restart');
 // The scheduled fetch runs once per trading day after the close and not again.
 const fresh=setup(t,{clock:ticking(Date.parse('2026-10-06T20:50:00Z'))});const first=await fresh.feeds.runScheduled();assert.equal(first.kind,'daily');assert.equal(await fresh.feeds.runScheduled(),null);assert.equal(fresh.feeds.status().dailyDoneToday,true);
 const early=setup(t,{clock:ticking(Date.parse('2026-10-06T18:00:00Z'))});assert.equal(await early.feeds.runScheduled(),null);
 const noKey=setup(t,{keys:{tiingo:false}});await assert.rejects(()=>noKey.feeds.refreshPrices(),e=>e.status===503);assert.equal(await noKey.feeds.runScheduled(),null);assert.equal(noKey.feeds.status().keys.tiingo,false);
 const perm=mkdtempSync(join(tmpdir(),'feeds-perm-'));writeFileSync(join(perm,'tiingo-api-key'),'x'.repeat(30),{mode:0o644});assert.equal(readSecret(perm,'tiingo-api-key',null),'','world-readable key files are ignored');
});

test('feed-first collection supplies the price, fiscal-year financials, history and shares with feed sources; the normalizer derives the rest',async t=>{
 const {store,feeds,etn,calls}=setup(t);
 const feed=await feeds.collect(etn,'2026-10-06');
 assert.deepEqual(feed.coverage,{price:true,financials:true});assert.equal(feed.requests,3,'one Tiingo request, the ticker list and the company facts');
 assert.deepEqual(feed.sources.map(s=>s.id),['F1','F2','F3']);assert.ok(feed.sources[0].url.includes('tiingo.com'));assert.ok(feed.sources[1].url.includes('companyfacts/CIK0001234567'));assert.ok(feed.sources[2].url.includes('/Archives/edgar/data/1234567/000126000001/'));
 assert.deepEqual(feed.price,{value:123.45,currency:'USD',asOfDate:'2026-10-06',asOfTime:'market close',sourceId:'F1'});
 assert.equal(feed.financials.revenue,10000000000);assert.equal(feed.financials.periodType,'FY');assert.deepEqual(feed.financials.sourceIds,['F2','F3']);assert.equal(feed.financials.capitalExpenditure,400000000);
 assert.deepEqual(feed.history.map(h=>[h.periodLabel,h.revenue,h.freeCashFlow]),[['FY2023',8000000000,null],['FY2024',9050000000,1550000000],['FY2025',10000000000,1800000000]]);
 assert.equal(feed.shares.basicOutstanding,400000000);assert.equal(feed.shares.dilutedOutstanding,410000000);
 assert.ok(feed.notes.some(n=>/summed from 2 balance-sheet/.test(n)));
 const second=await feeds.collect(etn,'2026-10-06');assert.equal(second.requests,0,'stored close and cached facts need no new requests');
 // Merge into an empty model draft and normalize: the app derives market cap, net debt, EV, multiples and growth from feed figures.
 const empty={identity:{name:null,ticker:null,exchange:null,listingCountry:null,quoteCurrency:null,reportingCurrency:null,fiscalYearEnd:null,securityType:'Common',sourceIds:[]},price:{value:null,currency:null,asOfDate:null,asOfTime:null,sourceId:null},shares:{basicOutstanding:null,dilutedOutstanding:null,asOfDate:null,basis:null,sourceId:null},marketCap:{value:null,currency:null,asOfDate:null,sourceId:null},enterpriseValue:{value:null,currency:null,asOfDate:null,sourceId:null},financials:{periodLabel:null,periodType:'Unknown',periodEndDate:null,basis:null,currency:null,revenue:null,ebitda:null,ebit:null,netIncome:null,dilutedEPS:null,operatingCashFlow:null,capitalExpenditure:null,freeCashFlow:null,totalDebt:null,cashAndEquivalents:null,sourceIds:[]},growth:{revenueGrowthPct:null,epsGrowthPct:null,periodLabel:null,sourceIds:[]},history:[],consensus:{forwardEPS:null,forwardEPSPeriod:null,forwardRevenue:null,forwardRevenuePeriod:null,targetPrice:null,currency:null,asOfDate:null,sourceId:null},operatingMetrics:[],notes:'model notes',missing:[]};
 const s=normalizeSnapshot(mergeFeedDraft(empty,feed),feed.sources,'2026-10-06');
 assert.equal(s.price.value,123.45);assert.equal(s.price.ageDays,0);assert.equal(s.marketCap.value,123.45*400000000);assert.equal(s.marketCap.derived,true);assert.equal(s.derived.netDebt,2000000000);assert.equal(s.enterpriseValue.value,123.45*400000000+2000000000);
 assert.ok(Math.abs(s.derived.multiples.peTrailing-123.45/3.66)<1e-9);assert.ok(Math.abs(s.derived.multiples.evEbitda-(123.45*400000000+2000000000)/2500000000)<1e-9);assert.equal(s.financials.freeCashFlow,1800000000);assert.equal(s.financials.freeCashFlowDerived,true);
 assert.ok(Math.abs(s.derived.revenueGrowthPct-(10000000000/9050000000-1)*100)<1e-9);assert.equal(s.derived.historicalGrowth.years,2);assert.equal(s.quality.comparable,true);assert.equal(s.quality.freshPrice,true);
 assert.match(s.notes,/model notes/);assert.match(s.notes,/summed from 2 balance-sheet/);
 assert.match(feedSummary(feed),/Share price USD 123.45 at the 2026-10-06 close \[F1\]/);assert.match(feedSummary(feed),/revenue 10000000000/);
 // Without an EDGAR contact the financials fall back to web research and the note says so; a non-filer is skipped.
 const noContact=setup(t,{keys:{edgar:false}});const partial=await noContact.feeds.collect(noContact.etn,'2026-10-06');assert.deepEqual(partial.coverage,{price:true,financials:false});assert.ok(partial.notes.some(n=>/No SEC EDGAR contact/.test(n)));assert.equal(feedSummary(partial)?.includes('Fiscal-year'),false);
 const other=company(store,'NOTF');const skipped=await feeds.collect(other,'2026-10-06');assert.ok(skipped.notes.some(n=>/not an SEC filer/.test(n)));assert.equal(skipped.coverage.financials,false);assert.equal(skipped.coverage.price,true);
 assert.equal(feedSummary(null),null);
});

// Synthetic research provider: the snapshot extraction returns a draft that the feed should override; the assessment is a plain Watch.
const para=(text,sourceIds=['S1'])=>({text,sourceIds});
const response=(text,annotations=[])=>({id:'resp',status:'completed',model:'test-model',usage:{input_tokens:10,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text,annotations}]}]});
class Provider{
 constructor(){this.model='test-model';this.reasoningEffort='medium';this.calls=[];}
 configured(){return true;}
 async request(input){this.calls.push(input);
  if(input.schema){
   if(input.schemaName==='financial_snapshot')return response(JSON.stringify({identity:{name:'Model Name',ticker:'ETN',exchange:'NYSE',listingCountry:'US',quoteCurrency:'USD',reportingCurrency:'USD',fiscalYearEnd:'December',securityType:'Common',sourceIds:['S4']},price:{value:999,currency:'USD',asOfDate:'2026-10-01',asOfTime:null,sourceId:'S4'},shares:{basicOutstanding:1,dilutedOutstanding:null,asOfDate:null,basis:null,sourceId:null},marketCap:{value:null,currency:null,asOfDate:null,sourceId:null},enterpriseValue:{value:null,currency:null,asOfDate:null,sourceId:null},financials:{periodLabel:'TTM',periodType:'TTM',periodEndDate:'2026-06-30',basis:'model',currency:'USD',revenue:1,ebitda:1,ebit:1,netIncome:1,dilutedEPS:1,operatingCashFlow:1,capitalExpenditure:1,freeCashFlow:1,totalDebt:1,cashAndEquivalents:1,sourceIds:['S4']},growth:{revenueGrowthPct:null,epsGrowthPct:null,periodLabel:null,sourceIds:[]},history:[],consensus:{forwardEPS:5,forwardEPSPeriod:'FY2026',forwardRevenue:null,forwardRevenuePeriod:null,targetPrice:150,currency:'USD',asOfDate:'2026-10-03',sourceId:'S4'},operatingMetrics:[],notes:'model notes',missing:[]}));
   return response(JSON.stringify({summary:para('SYNTHETIC summary.'),recommendation:'Watch',rationale:para('SYNTHETIC rationale.'),evidenceConfidence:'Moderate',businessQuality:para('SYNTHETIC business.'),financialAssessment:para('SYNTHETIC financials.'),valuationAssessment:para('SYNTHETIC valuation.',[]),bullCase:[para('SYNTHETIC bull.')],bearCase:[para('SYNTHETIC bear.',['S4'])],catalysts:[],changes:[],assumptions:['a'],missingEvidence:[],invalidationTriggers:['t'],nextSteps:['n']}));
  }
  return response('SYNTHETIC RESEARCH — not market data.',[{type:'url_citation',url:'https://example.com/consensus',title:'SYNTHETIC consensus'},{type:'url_citation',url:'https://example.com/filing',title:'SYNTHETIC filing'}]);
 }
}
async function finished(ai,id){for(let i=0;i<600;i++){const run=ai.read(id);if(!['queued','running'].includes(run.status))return run;await new Promise(r=>setTimeout(r,5));}throw new Error('Did not finish');}

test('a snapshot run is feed first: feed figures override the model, feed sources are cited, the search is narrowed, and the home overview shows the feed close',async t=>{
 const {store,feeds,etn,closers}=setup(t),provider=new Provider();
 const ai=new ResearchService(store,provider,{concurrency:1,feeds}),wf=new WorkflowService(store,ai,{feeds});closers.push(()=>ai.close());
 const run=await finished(ai,ai.enqueue({companyId:etn.id,kind:'snapshot'}).id);
 assert.equal(run.status,'completed',run.error);
 const s=run.snapshot;assert.equal(s.price.value,123.45);assert.equal(s.price.asOfDate,'2026-10-06');assert.equal(s.financials.revenue,10000000000);assert.equal(s.financials.periodType,'FY');assert.equal(s.shares.basicOutstanding,400000000);assert.equal(s.consensus.forwardEPS,5,'what the feeds lack still comes from the model');assert.equal(s.identity.name,'Model Name');
 assert.deepEqual(run.feed.coverage,{price:true,financials:true});assert.deepEqual(run.feed.sourceIds,['S1','S2','S3']);
 assert.equal(run.sources[0].url,'https://www.tiingo.com/ETN/overview');assert.ok(run.sources[1].url.includes('sec.gov'));assert.equal(run.sources.length,5);
 assert.equal(s.price.sourceId,'S1');assert.deepEqual(s.financials.sourceIds,['S2','S3']);assert.equal(s.history.length,3);
 const search=provider.calls[0];assert.equal(search.maxToolCalls,3);assert.match(search.input,/App-collected data from feeds/);assert.match(search.input,/Share price USD 123.45/);assert.match(provider.calls[1].input,/tiingo.com/);
 const e=wf.companyOverview(etn.id);assert.equal(e.price.source,'Tiingo close');assert.equal(e.price.value,123.45);assert.equal(e.feedPrice.asOfDate,'2026-10-06');assert.equal(e.profile.assetType,'Company');assert.equal(e.profile.cik,1234567);
 assert.equal(wf.overview().feeds.keys.tiingo,true);
 // Per-stage model settings reach the provider for the matching role and are recorded in usage; the default stays for other stages.
 ai.saveSettings({...DEFAULT_MANDATE,stageSettings:{collect:{model:null,effort:'low'},extract:{model:'test-extract',effort:null},analyze:{model:'test-strong',effort:'high'}}},ai.settings().revision);
 assert.equal(ai.settings().stageSettings.analyze.model,'test-strong');assert.equal(ai.status().model,'test-model');
 provider.calls=[];const review=await finished(ai,ai.enqueue({companyId:etn.id,kind:'review',withSnapshot:true}).id);assert.equal(review.status,'completed',review.error);
 assert.deepEqual(provider.calls.map(c=>[c.model,c.reasoningEffort]),[[null,'low'],['test-extract',null],[null,'low'],[null,'low'],['test-strong','high']]);
 assert.deepEqual(review.usage.map(u=>u.role),['collect','extract','collect','collect','analyze']);assert.equal(review.usage[4].model,'test-model','the fixture echoes its own model name');assert.equal(review.usage[4].reasoningEffort,'high');
 assert.equal(JSON.stringify(review.context.mandate).includes('stageSettings'),false,'stage settings are not sent to the model');
 assert.throws(()=>ai.saveSettings({...DEFAULT_MANDATE,stageSettings:{analyze:{model:null,effort:'extreme'}}},ai.settings().revision));
 // Profiles: a crypto record needs a CoinGecko id; a changed feed symbol clears a not-found mark.
 assert.throws(()=>feeds.setProfile({companyId:etn.id,assetType:'Crypto',feedSymbol:'',coingeckoId:''}),/CoinGecko id/);
 feeds.markFeedStatus(etn.id,'not_found');assert.equal(feeds.setProfile({companyId:etn.id,assetType:'Company',feedSymbol:'ETN-X',coingeckoId:''}).feedStatus,null);assert.equal(feeds.symbolFor(etn),'ETN-X');
});
