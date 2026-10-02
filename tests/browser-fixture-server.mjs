// Disposable browser-test service. Never reads production data or calls OpenAI.
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/store.js';
import {ResearchService} from '../server/research.js';
import {createApp} from '../server/app.js';
const dir=mkdtempSync(join(tmpdir(),'research-browser-fixture-'));
const store=new Store(join(dir,'research.sqlite'),join(dir,'backups'));
const p=(text,sourceIds=['S1'])=>({text,sourceIds});
const report={summary:p('SYNTHETIC UI TEST — this is not investment research. The fixture supports a watch recommendation until valuation evidence is available.'),recommendation:'Watch',rationale:p('SYNTHETIC UI TEST — await verified financial inputs and a dated valuation.'),evidenceConfidence:'Low',businessQuality:p('SYNTHETIC UI TEST — business quality needs primary-source verification.'),financialAssessment:p('SYNTHETIC UI TEST — financial metrics are deliberately absent.'),valuationAssessment:p('No snapshot or calculated valuation is available.',[]),bullCase:[p('SYNTHETIC UI TEST — illustrative supporting evidence.')],bearCase:[p('SYNTHETIC UI TEST — illustrative counterevidence.',['S2'])],catalysts:[p('SYNTHETIC UI TEST — an illustrative dated catalyst.')],changes:[],assumptions:['SYNTHETIC UI TEST — assumptions need verification.'],missingEvidence:['A current price and valuation inputs are missing.'],invalidationTriggers:['SYNTHETIC UI TEST — review new contrary evidence.'],nextSteps:['Verify the source documents and add a dated snapshot.']};
const eps={value:7.25,period:'FY 2027 analyst consensus',periodEndDate:'2027-12-31',basis:'Adjusted diluted EPS',currency:'USD',shareBasis:'Diluted common share',kind:'Analyst estimate',sourceId:'S1',publicationDate:null,estimateAsOfDate:null,explanation:'SYNTHETIC UI TEST — an analyst estimate for form-fill verification only.',sourceExcerpt:'FY 2027 adjusted diluted EPS consensus is USD 7.25 per share.',missingFields:[]};
const daysAgo=(asOf,n)=>new Date(Date.parse(asOf)-n*86400000).toISOString().slice(0,10);
const snapshot=(ticker,asOf)=>({identity:{name:`${ticker} Synthetic Co`,ticker,exchange:'NYSE',listingCountry:'US',quoteCurrency:'USD',reportingCurrency:'USD',fiscalYearEnd:'December',securityType:'Common',sourceIds:['S2']},
 price:{value:ticker==='SYN'?40:123.45,currency:'USD',asOfDate:daysAgo(asOf,1),asOfTime:'16:00 ET',sourceId:'S1'},shares:{basicOutstanding:ticker==='SYN'?250000000:390000000,dilutedOutstanding:null,asOfDate:daysAgo(asOf,45),basis:'Cover page shares outstanding',sourceId:'S2'},
 marketCap:{value:null,currency:null,asOfDate:null,sourceId:null},enterpriseValue:{value:null,currency:null,asOfDate:null,sourceId:null},
 financials:{periodLabel:'TTM to Q2 2026',periodType:'TTM',periodEndDate:'2026-06-30',basis:'US GAAP',currency:'USD',revenue:ticker==='SYN'?4000000000:26000000000,ebitda:ticker==='SYN'?600000000:6200000000,ebit:ticker==='SYN'?450000000:5300000000,netIncome:ticker==='SYN'?300000000:4000000000,dilutedEPS:ticker==='SYN'?1.2:10.2,operatingCashFlow:ticker==='SYN'?500000000:4800000000,capitalExpenditure:ticker==='SYN'?150000000:900000000,freeCashFlow:null,totalDebt:ticker==='SYN'?900000000:9500000000,cashAndEquivalents:ticker==='SYN'?400000000:1800000000,sourceIds:['S2']},
 growth:{revenueGrowthPct:ticker==='SYN'?22:9,epsGrowthPct:15,periodLabel:'Q2 2026 YoY',sourceIds:['S2']},history:[{periodLabel:'FY2024',periodEndDate:'2024-12-31',revenue:ticker==='SYN'?2800000000:23000000000,ebitda:null,netIncome:null,freeCashFlow:null,sourceIds:['S2']},{periodLabel:'FY2025',periodEndDate:'2025-12-31',revenue:ticker==='SYN'?3500000000:25000000000,ebitda:null,netIncome:null,freeCashFlow:null,sourceIds:['S2']}],
 consensus:{forwardEPS:ticker==='SYN'?1.6:13.5,forwardEPSPeriod:'FY2026',forwardRevenue:null,forwardRevenuePeriod:null,targetPrice:ticker==='SYN'?48:140,currency:'USD',asOfDate:daysAgo(asOf,4),sourceId:'S1'},
 operatingMetrics:[{name:'Backlog',value:ticker==='SYN'?2500000000:12000000000,unit:'USD',periodLabel:'Q2 2026',sourceId:'S2'}],notes:'SYNTHETIC UI TEST snapshot.',missing:[]});
const discovery={sectorDefinition:'SYNTHETIC UI TEST — a fixture sector definition.',candidates:[{name:'Eaton',ticker:'ETN',exchange:'NYSE',listingCountry:'US',quoteCurrency:'USD',securityType:'Common',relevance:'SYNTHETIC seed company.',approximateMarketCap:null,marketCapCurrency:null,isSeed:true,confidence:'High',sourceIds:['S1']},{name:'Synthetic Peer Inc',ticker:'SYN',exchange:'NYSE',listingCountry:'US',quoteCurrency:'USD',securityType:'Common',relevance:'SYNTHETIC discovered peer.',approximateMarketCap:10000000000,marketCapCurrency:'USD',isSeed:false,confidence:'Moderate',sourceIds:['S2']},{name:'Overflow Co',ticker:'OVF',exchange:'NYSE',listingCountry:'US',quoteCurrency:'USD',securityType:'Common',relevance:'SYNTHETIC overflow.',approximateMarketCap:null,marketCapCurrency:null,isSeed:false,confidence:'Low',sourceIds:[]}],excluded:[{name:'Fixture ETF',reason:'Fund, not a company.'}],notes:'SYNTHETIC UI TEST notes.'};
const comparison=input=>{const companies=JSON.parse(input.match(/Companies: (\[.*\])\nSource registry/s)[1]),registry=JSON.parse(input.split('Source registry: ')[1]),ids=[registry[0].id];
 return {sectorSummary:{text:'SYNTHETIC UI TEST — sector summary for dashboard verification.',sourceIds:ids},ranking:companies.map((c,i)=>({ticker:c.ticker,rank:i+1,rating:i===0?'Consider':'Watch',thesis:{text:`SYNTHETIC UI TEST — thesis for ${c.ticker}.`,sourceIds:ids},keyEvidence:[{text:'SYNTHETIC UI TEST — key evidence.',sourceIds:ids}],valuation:{text:'SYNTHETIC UI TEST — valuation view quoting app multiples.',sourceIds:[]},relativeAttractiveness:{text:`SYNTHETIC UI TEST — ${c.ticker} versus peers.`,sourceIds:[]},catalysts:['SYNTHETIC catalyst'],risks:['SYNTHETIC risk'],invalidation:['SYNTHETIC invalidation trigger'],confidence:'Moderate',dataLimitations:[]})),preferredRationale:{text:'SYNTHETIC UI TEST — why the leader ranks first.',sourceIds:ids},sectorRisks:['SYNTHETIC sector risk'],assumptions:['SYNTHETIC assumption'],caveats:['SYNTHETIC caveat']};};
let calls=0;
const provider={model:'SYNTHETIC-browser-fixture',configured:()=>true,async request(input){
 await new Promise(r=>setTimeout(r,250));calls++;
 if(input.signal?.aborted)throw new Error('Test cancellation');
 const url=calls%2?'https://example.com/filing':'https://example.com/challenge';
 let text,annotations=[];
 if(input.schema){
  if(input.schemaName==='forward_eps')text=JSON.stringify(eps);
  else if(input.schemaName==='sector_discovery')text=JSON.stringify(discovery);
  else if(input.schemaName==='financial_snapshot'){const ticker=JSON.parse(input.input.match(/Company: (\{.*?\})\n/s)[1]).ticker,asOf=input.input.match(/As of: (\d{4}-\d{2}-\d{2})/)[1];text=JSON.stringify(snapshot(ticker,asOf));}
  else if(input.schemaName==='sector_comparison')text=JSON.stringify(comparison(input.input));
  else text=JSON.stringify(report);
 } else {text=`SYNTHETIC UI TEST — a cited answer. [Fixture source](${url}) <script>window.fixtureXSS=1</script>`;annotations=[{type:'url_citation',url:'https://example.com/filing',title:'SYNTHETIC source'},{type:'url_citation',url:'https://example.com/challenge',title:'SYNTHETIC challenge source'}];}
 return {id:`fixture-${calls}`,model:this.model,status:'completed',usage:{input_tokens:10,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text,annotations}]}]};
}};
const research=new ResearchService(store,provider,{concurrency:2}),root='http://127.0.0.1:5197';
const server=createApp(store,{origin:root,research}).listen(5197,'127.0.0.1',()=>console.log('Browser fixture ready'));
process.on('SIGTERM',()=>{research.close();server.close(()=>{store.close();process.exit(0);});});
