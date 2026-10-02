import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSnapshot,snapshotSummary,rederiveGrowth} from '../server/financial-snapshot.js';
// SYNTHETIC FIXTURES ONLY — none of these figures describe a real company.
const sources=[{id:'S1',url:'https://example.com/quote',title:'SYNTHETIC quote'},{id:'S2',url:'https://example.com/10q',title:'SYNTHETIC filing'},{id:'S3',url:'https://example.com/consensus',title:'SYNTHETIC consensus'}];
const asOf='2026-09-13';
const draft=()=>({
 identity:{name:'Synthetic Corp',ticker:'syn',exchange:'NYSE',listingCountry:'US',quoteCurrency:'usd',reportingCurrency:'USD',fiscalYearEnd:'December',securityType:'Common',sourceIds:['S2']},
 price:{value:100,currency:'USD',asOfDate:'2026-09-12',asOfTime:'16:00 ET',sourceId:'S1'},
 shares:{basicOutstanding:400000000,dilutedOutstanding:410000000,asOfDate:'2026-07-31',basis:'Common shares outstanding (cover page)',sourceId:'S2'},
 marketCap:{value:null,currency:null,asOfDate:null,sourceId:null},
 enterpriseValue:{value:null,currency:null,asOfDate:null,sourceId:null},
 financials:{periodLabel:'TTM to Q2 2026',periodType:'TTM',periodEndDate:'2026-06-30',basis:'US GAAP',currency:'USD',revenue:10000000000,ebitda:2500000000,ebit:2000000000,netIncome:1500000000,dilutedEPS:3.66,operatingCashFlow:2200000000,capitalExpenditure:400000000,freeCashFlow:null,totalDebt:3000000000,cashAndEquivalents:1000000000,sourceIds:['S2']},
 growth:{revenueGrowthPct:null,epsGrowthPct:12,periodLabel:'Q2 2026 YoY',sourceIds:['S2']},
 history:[{periodLabel:'FY2023',periodEndDate:'2023-12-31',revenue:8000000000,ebitda:1800000000,netIncome:1000000000,freeCashFlow:900000000,sourceIds:['S2']},{periodLabel:'FY2025',periodEndDate:'2025-12-31',revenue:9680000000,ebitda:2300000000,netIncome:1400000000,freeCashFlow:1500000000,sourceIds:['S2']},{periodLabel:'FY2024',periodEndDate:'2024-12-31',revenue:8800000000,ebitda:2000000000,netIncome:1200000000,freeCashFlow:1100000000,sourceIds:['S2']}],
 consensus:{forwardEPS:4,forwardEPSPeriod:'FY2026',forwardRevenue:11000000000,forwardRevenuePeriod:'FY2026',targetPrice:120,currency:'USD',asOfDate:'2026-09-01',sourceId:'S3'},
 operatingMetrics:[{name:'Backlog',value:12000000000,unit:'USD',periodLabel:'Q2 2026',sourceId:'S2'},{name:'Uncited metric',value:5,unit:'x',periodLabel:null,sourceId:null}],
 notes:'Synthetic.',missing:[]
});
const near=(a,b)=>Math.abs(a-b)<1e-9;

test('derived values, multiples, margins and growth are computed locally from cited figures',()=>{
 const s=normalizeSnapshot(draft(),sources,asOf);
 assert.equal(s.identity.ticker,'SYN');assert.equal(s.identity.quoteCurrency,'USD');
 assert.equal(s.derived.netDebt,2000000000);
 assert.equal(s.marketCap.value,40000000000);assert.equal(s.marketCap.derived,true);assert.equal(s.derived.marketCapBasis,'basic shares outstanding');
 assert.equal(s.enterpriseValue.value,42000000000);assert.equal(s.enterpriseValue.derived,true);
 assert.equal(s.financials.freeCashFlow,1800000000);assert.equal(s.financials.freeCashFlowDerived,true);
 const m=s.derived.multiples;
 assert.ok(near(m.peTrailing,100/3.66));assert.equal(m.peForward,25);assert.ok(near(m.evEbitda,16.8));assert.ok(near(m.evEbit,21));assert.ok(near(m.evRevenue,4.2));assert.ok(near(m.fcfYield,4.5));assert.equal(s.derived.fcfYieldBasis,'TTM to Q2 2026 free cash flow');assert.ok(near(m.netDebtEbitda,0.8));assert.ok(near(m.priceToTarget,20));
 const noTTM=draft();noTTM.financials.freeCashFlow=null;noTTM.financials.operatingCashFlow=null;noTTM.financials.capitalExpenditure=null;
 const t=normalizeSnapshot(noTTM,sources,asOf);assert.ok(near(t.derived.multiples.fcfYield,3.75));assert.match(t.derived.fcfYieldBasis,/FY2025 free cash flow \(latest fiscal year/);assert.ok(t.quality.warnings.some(w=>/FCF yield uses FY2025/.test(w)));assert.equal(t.derived.margins.fcf,null);
 assert.equal(s.derived.margins.ebitda,25);assert.equal(s.derived.margins.net,15);assert.equal(s.derived.margins.fcf,18);
 assert.equal(s.history.map(h=>h.periodLabel).join(','),'FY2023,FY2024,FY2025');
 assert.ok(near(s.derived.revenueGrowthPct,10));assert.match(s.derived.revenueGrowthSource,/derived from FY2024 to FY2025/);
 assert.ok(near(s.derived.historicalGrowth.revenueCagrPct,10));assert.equal(s.derived.historicalGrowth.years,2);
 assert.equal(s.price.ageDays,1);assert.equal(s.quality.freshPrice,true);assert.equal(s.quality.hasValuationMultiple,true);assert.equal(s.quality.comparable,true);assert.equal(s.quality.currencyMismatch,false);
 assert.equal(s.operatingMetrics.length,1);assert.ok(s.quality.warnings.some(w=>w.includes('Uncited metric')));
 assert.deepEqual(s.quality.missing,[]);
 const text=snapshotSummary(s);assert.match(text,/USD 40.00bn/);assert.match(text,/forward P\/E 25.0×/);assert.match(text,/app-derived/);
});

test('cross-currency price and statements block multiples but keep margins and growth',()=>{
 const d=draft();d.financials.currency='EUR';d.identity.reportingCurrency='EUR';
 const s=normalizeSnapshot(d,sources,asOf);
 assert.equal(s.quality.currencyMismatch,true);
 for(const k of ['peTrailing','peForward','evEbitda','evRevenue','fcfYield'])assert.equal(s.derived.multiples[k],null,k);
 assert.equal(s.derived.multiples.netDebtEbitda,0.8);assert.equal(s.derived.margins.ebitda,25);assert.equal(s.enterpriseValue.value,null);
 assert.ok(s.quality.warnings.some(w=>/quoted in USD but financial statements are in EUR/.test(w)));
});

test('suspected scaled units, uncited values, stale prices and future dates are flagged and excluded',()=>{
 const d=draft();d.financials.revenue=10000;d.price.sourceId='S9';d.price.asOfDate='2027-01-01';d.consensus.asOfDate='2026-05-01';d.shares.basicOutstanding=400;
 const s=normalizeSnapshot(d,sources,asOf);
 assert.equal(s.price.value,null);assert.ok(s.quality.warnings.some(w=>/Share price: cited source S9/.test(w)));
 assert.equal(s.financials.scaledUnitsSuspected,true);assert.equal(s.derived.multiples.evEbitda,null);assert.equal(s.quality.comparable,false);
 assert.equal(s.shares.basicOutstanding,null);assert.equal(s.marketCap.value,null);
 assert.ok(s.quality.warnings.some(w=>/Consensus estimates are 135 days old/.test(w)));
 assert.ok(s.quality.missing.includes('Share price'));assert.ok(s.quality.missing.includes('Market capitalization'));
 const stale=draft();stale.price.asOfDate='2026-08-01';const t=normalizeSnapshot(stale,sources,asOf);
 assert.equal(t.quality.freshPrice,false);assert.ok(t.quality.warnings.some(w=>/43 calendar days old/.test(w)));
});

test('sourced market cap and enterprise value are retained but cross-checked against derived values',()=>{
 const d=draft();d.marketCap={value:60000000000,currency:'USD',asOfDate:'2026-09-12',sourceId:'S1'};d.enterpriseValue={value:61000000000,currency:'USD',asOfDate:'2026-09-12',sourceId:'S1'};
 const s=normalizeSnapshot(d,sources,asOf);
 assert.equal(s.marketCap.value,60000000000);assert.equal(s.marketCap.derived,false);assert.equal(s.marketCap.derivedValue,40000000000);
 assert.ok(s.quality.warnings.some(w=>/Sourced market cap differs from price × basic shares outstanding by 50%/.test(w)));
 assert.equal(s.enterpriseValue.value,61000000000);assert.equal(s.enterpriseValue.derivedValue,62000000000);
 assert.ok(near(s.derived.multiples.evEbitda,24.4));assert.ok(near(s.derived.multiples.fcfYield,3));
});

test('historical growth uses full fiscal years only; partial periods are excluded and stored snapshots can be re-derived',()=>{
 const d=draft();d.growth.revenueGrowthPct=null;
 d.history=[{periodLabel:'FY2024',periodEndDate:'2024-12-31',revenue:8800000000,ebitda:null,netIncome:null,freeCashFlow:null,sourceIds:['S2']},{periodLabel:'FY2025',periodEndDate:'2025-12-31',revenue:9680000000,ebitda:null,netIncome:null,freeCashFlow:null,sourceIds:['S2']},{periodLabel:'H1 2026',periodEndDate:'2026-06-30',revenue:5200000000,ebitda:null,netIncome:null,freeCashFlow:null,sourceIds:['S2']},{periodLabel:'Undated',periodEndDate:null,revenue:1000,ebitda:null,netIncome:null,freeCashFlow:null,sourceIds:['S2']}];
 const s=normalizeSnapshot(d,sources,asOf);
 assert.ok(near(s.derived.historicalGrowth.revenueCagrPct,10));assert.equal(s.derived.historicalGrowth.years,1);assert.equal(s.derived.historicalGrowth.to,'FY2025');
 assert.ok(near(s.derived.revenueGrowthPct,10));assert.match(s.derived.revenueGrowthSource,/derived from FY2024 to FY2025/);
 assert.ok(s.quality.warnings.some(w=>/Historical growth excludes periods.*H1 2026, Undated/.test(w)));
 // A stored snapshot derived under the old rule (every entry treated as a year) is corrected without touching model-reported figures.
 const stale={...s,derived:{...s.derived,historicalGrowth:{revenueCagrPct:-37,years:3,from:'FY2023',to:'Q3 FY2026'},revenueGrowthPct:-14,revenueGrowthSource:'derived from FY2025 to Q3 FY2026'},quality:{...s.quality,warnings:[]}};
 const fixed=rederiveGrowth(stale);assert.ok(near(fixed.derived.historicalGrowth.revenueCagrPct,10));assert.ok(near(fixed.derived.revenueGrowthPct,10));assert.equal(fixed.history,s.history);assert.deepEqual(rederiveGrowth(fixed).derived,fixed.derived);
 const reported={...stale,growth:{...stale.growth,revenueGrowthPct:21}};assert.equal(rederiveGrowth(reported).derived.revenueGrowthPct,21);assert.equal(rederiveGrowth(reported).derived.revenueGrowthSource,'reported');
});

test('over-long model output is bounded with a warning instead of failing the run',()=>{
 const d=draft();d.operatingMetrics=Array.from({length:15},(_,i)=>({name:`Metric ${i}`,value:i+1,unit:'x',periodLabel:'Q2 2026',sourceId:'S2'}));d.history=Array.from({length:7},(_,i)=>({periodLabel:`FY${2019+i}`,periodEndDate:`${2019+i}-12-31`,revenue:1e9*(i+1),ebitda:null,netIncome:null,freeCashFlow:null,sourceIds:['S2']}));d.notes='n'.repeat(5000);
 const s=normalizeSnapshot(d,sources,asOf);
 assert.equal(s.operatingMetrics.length,12);assert.equal(s.history.length,5);assert.equal(s.notes.length,4000);
 assert.ok(s.quality.warnings.some(w=>/operatingMetrics: kept 12 of 15/.test(w)));assert.ok(s.quality.warnings.some(w=>/history: kept 5 of 7/.test(w)));assert.ok(s.quality.warnings.some(w=>/notes: shortened/.test(w)));
 assert.equal(s.derived.historicalGrowth.years,4);
});

test('invalid drafts are rejected and empty drafts normalize to an all-missing snapshot',()=>{
 assert.throws(()=>normalizeSnapshot({...draft(),identity:{...draft().identity,securityType:'Fund'}},sources,asOf));
 assert.throws(()=>normalizeSnapshot({...draft(),financials:{...draft().financials,revenue:'10bn'}},sources,asOf));
 const empty=draft();for(const k of ['price','shares','marketCap','enterpriseValue','financials','growth','consensus'])for(const f of Object.keys(empty[k]))empty[k][f]=Array.isArray(empty[k][f])?[]:f==='securityType'?'Other':f==='periodType'?'Unknown':null;empty.history=[];empty.operatingMetrics=[];
 const s=normalizeSnapshot(empty,sources,asOf);assert.equal(s.quality.comparable,false);assert.equal(s.quality.freshPrice,false);assert.ok(s.quality.missing.length>=10);assert.match(snapshotSummary(s),/unavailable/);
});
