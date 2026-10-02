// Standardized financial and market snapshot collected by the research agent and normalized locally.
// The model only reports cited figures; every derived value (net debt, market cap, EV, margins, multiples,
// growth) is calculated here so the arithmetic, currency and period checks are deterministic and auditable.
import {z} from 'zod';
import {parse} from './model.js';
import {clampOutput} from './bounds.js';

const CURRENCIES=new Set(Intl.supportedValuesOf('currency'));
const SNAPSHOT_BOUNDS={arrays:{operatingMetrics:12,history:5,missing:25,sourceIds:30},strings:{notes:4000,name:120,ticker:300,exchange:300,listingCountry:300,quoteCurrency:300,reportingCurrency:300,fiscalYearEnd:300,periodLabel:300,basis:300,currency:300,asOfDate:300,asOfTime:300,unit:300,forwardEPSPeriod:300,forwardRevenuePeriod:300,periodEndDate:300,sourceId:300,missing:300}};
const PERIOD_TYPES=['FY','TTM','H1','H2','Q1','Q2','Q3','Q4','Unknown'];
const SECURITY_TYPES=['Common','ADR','GDR','Other'];
const dateRe=/^\d{4}-\d{2}-\d{2}$/;
const validDate=v=>typeof v==='string'&&dateRe.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const num=z.number().finite().min(-1e15).max(1e15).nullable();
const str=z.string().max(300).nullable();
const ids=z.array(z.string().max(20)).max(30);
const block=shape=>z.object(shape).strict();
export const snapshotDraftSchema=block({
 identity:block({name:str,ticker:str,exchange:str,listingCountry:str,quoteCurrency:str,reportingCurrency:str,fiscalYearEnd:str,securityType:z.enum(SECURITY_TYPES),sourceIds:ids}),
 price:block({value:num,currency:str,asOfDate:str,asOfTime:str,sourceId:str}),
 shares:block({basicOutstanding:num,dilutedOutstanding:num,asOfDate:str,basis:str,sourceId:str}),
 marketCap:block({value:num,currency:str,asOfDate:str,sourceId:str}),
 enterpriseValue:block({value:num,currency:str,asOfDate:str,sourceId:str}),
 financials:block({periodLabel:str,periodType:z.enum(PERIOD_TYPES),periodEndDate:str,basis:str,currency:str,revenue:num,ebitda:num,ebit:num,netIncome:num,dilutedEPS:num,operatingCashFlow:num,capitalExpenditure:num,freeCashFlow:num,totalDebt:num,cashAndEquivalents:num,sourceIds:ids}),
 growth:block({revenueGrowthPct:num,epsGrowthPct:num,periodLabel:str,sourceIds:ids}),
 history:z.array(block({periodLabel:str,periodEndDate:str,revenue:num,ebitda:num,netIncome:num,freeCashFlow:num,sourceIds:ids})).max(5),
 consensus:block({forwardEPS:num,forwardEPSPeriod:str,forwardRevenue:num,forwardRevenuePeriod:str,targetPrice:num,currency:str,asOfDate:str,sourceId:str}),
 operatingMetrics:z.array(block({name:z.string().max(120),value:num,unit:str,periodLabel:str,sourceId:str})).max(12),
 notes:z.string().max(4000),
 missing:z.array(z.string().max(300)).max(25)
});
const N={type:['number','null']},S={type:['string','null']},IDS={type:'array',items:{type:'string'}};
const obj=props=>({type:'object',additionalProperties:false,properties:props,required:Object.keys(props)});
export const SNAPSHOT_JSON=obj({
 identity:obj({name:S,ticker:S,exchange:S,listingCountry:S,quoteCurrency:S,reportingCurrency:S,fiscalYearEnd:S,securityType:{type:'string',enum:SECURITY_TYPES},sourceIds:IDS}),
 price:obj({value:N,currency:S,asOfDate:S,asOfTime:S,sourceId:S}),
 shares:obj({basicOutstanding:N,dilutedOutstanding:N,asOfDate:S,basis:S,sourceId:S}),
 marketCap:obj({value:N,currency:S,asOfDate:S,sourceId:S}),
 enterpriseValue:obj({value:N,currency:S,asOfDate:S,sourceId:S}),
 financials:obj({periodLabel:S,periodType:{type:'string',enum:PERIOD_TYPES},periodEndDate:S,basis:S,currency:S,revenue:N,ebitda:N,ebit:N,netIncome:N,dilutedEPS:N,operatingCashFlow:N,capitalExpenditure:N,freeCashFlow:N,totalDebt:N,cashAndEquivalents:N,sourceIds:IDS}),
 growth:obj({revenueGrowthPct:N,epsGrowthPct:N,periodLabel:S,sourceIds:IDS}),
 history:{type:'array',items:obj({periodLabel:S,periodEndDate:S,revenue:N,ebitda:N,netIncome:N,freeCashFlow:N,sourceIds:IDS})},
 consensus:obj({forwardEPS:N,forwardEPSPeriod:S,forwardRevenue:N,forwardRevenuePeriod:S,targetPrice:N,currency:S,asOfDate:S,sourceId:S}),
 operatingMetrics:{type:'array',items:obj({name:{type:'string'},value:N,unit:S,periodLabel:S,sourceId:S})},
 notes:{type:'string'},
 missing:IDS
});

export const SNAPSHOT_SEARCH_PROMPT=`Collect a dated FINANCIAL AND MARKET SNAPSHOT for the selected listed company so it can be compared with peers on a consistent basis. Use web search. Prefer primary sources: the latest annual report or 10-K/20-F, the latest quarterly or half-year report, earnings releases and investor presentations for financial statement figures and share counts; use a reputable market-data or exchange page for the current share price and for analyst consensus. Verify the company identity, primary listing exchange, quote currency and reporting currency; note ADR/GDR listings separately from the primary listing.
Report, with a clickable citation and its date for each item:
1. Share price: value, currency, the exact date (and time/timezone if shown) the quote refers to. Never present an old price as current.
2. Shares outstanding: basic shares outstanding at the most recent date disclosed (for example the cover page of the latest filing) with the date and share class, and the diluted weighted-average share count for the latest period as a reference figure.
3. Market capitalization and enterprise value only if a source states them; otherwise leave them unavailable — the app derives them.
4. Latest financials: trailing twelve months if available from sources, otherwise the latest fiscal year; state the period label, period end date, accounting basis (IFRS, US GAAP, adjusted/non-GAAP), reporting currency, revenue, EBITDA, EBIT/operating income, net income attributable to shareholders, diluted EPS, operating cash flow, capital expenditure, free cash flow, total debt and cash and equivalents. Total debt is the balance-sheet total if stated; otherwise add the short-term debt, current portion of long-term debt and long-term debt lines from the same balance sheet date and say so in notes (exclude operating lease liabilities unless the company includes them in debt). Cash and equivalents is the cash and cash equivalents line; note if short-term investments are combined. If trailing-twelve-month cash-flow items are not published, leave those TTM fields unavailable and report the latest fiscal-year operating cash flow, capital expenditure and free cash flow in the history block. Use FULL currency units (e.g. 3274000000 for 3,274 million), never millions or billions.
5. Growth: revenue growth and EPS growth for the latest period versus the prior-year period, and revenue, EBITDA, net income and free cash flow for up to three prior fiscal years for historical growth and profitability.
6. Consensus: forward EPS and forward revenue with the fiscal period they refer to, the analyst price target if available, currency, and the date the consensus was reported. Only published analyst estimates; management guidance is not consensus.
7. Up to eight sector-specific operating metrics the market uses for this company (for example backlog, book-to-bill, order intake, same-store sales, net interest margin, CET1 ratio, subscribers, capacity, utilization) with units and period. Financial statement line items belong in the financials or history blocks, never here.
Distinguish observed facts from estimates. Do not compute ratios, convert currencies, annualize quarterly figures or infer missing values. If sources disagree, say which was used and why. Unknown items stay unknown. Do not claim a paywalled source was read.`;

const bad=v=>v===null||v===undefined;
export function normalizeSnapshot(raw,sources,asOf){
 const warnings=[];
 const d=parse(snapshotDraftSchema,clampOutput(raw,SNAPSHOT_BOUNDS,warnings)), allowed=new Set(sources.map(s=>s.id)), missing=[...new Set(d.missing)];
 const cite=(id,label)=>{ if(id===null) return {ok:false,id:null,reason:`${label}: no source was cited; the value was discarded.`}; if(allowed.has(id)) return {ok:true,id}; return {ok:false,id:null,reason:`${label}: cited source ${id} was not in the research registry; the value was discarded.`}; };
 const cites=(list,label)=>{ const valid=list.filter(i=>allowed.has(i)); if(list.length&&!valid.length) warnings.push(`${label}: no cited source was in the research registry; the values were discarded.`); else if(!list.length) warnings.push(`${label}: no source was cited; the values were discarded.`); return valid; };
 const date=(v,label,{future=false}={})=>{ if(bad(v)) return null; if(!validDate(v)){warnings.push(`${label}: invalid date “${v}” ignored.`);return null;} if(!future&&v>asOf){warnings.push(`${label}: date ${v} is after the research date ${asOf} and was ignored.`);return null;} return v; };
 const currency=(v,label)=>{ if(bad(v)) return null; const c=v.trim().toUpperCase(); if(!CURRENCIES.has(c)){warnings.push(`${label}: unrecognized currency “${v}” ignored.`);return null;} return c; };
 const ageDays=v=>v?Math.round((Date.parse(asOf)-Date.parse(v))/86400000):null;
 const valued=(value,source,label)=>{ if(bad(value)) return {value:null,sourceId:null}; const c=cite(source,label); if(!c.ok){warnings.push(c.reason);return {value:null,sourceId:null};} return {value,sourceId:c.id}; };

 const identity={name:d.identity.name,ticker:d.identity.ticker?d.identity.ticker.trim().toUpperCase():null,exchange:d.identity.exchange,listingCountry:d.identity.listingCountry,quoteCurrency:currency(d.identity.quoteCurrency,'Quote currency'),reportingCurrency:currency(d.identity.reportingCurrency,'Reporting currency'),fiscalYearEnd:d.identity.fiscalYearEnd,securityType:d.identity.securityType,sourceIds:d.identity.sourceIds.filter(i=>allowed.has(i))};

 const p=valued(d.price.value,d.price.sourceId,'Share price');
 const price={value:p.value>0?p.value:null,currency:currency(d.price.currency,'Share price currency'),asOfDate:date(d.price.asOfDate,'Share price date'),asOfTime:d.price.asOfTime,sourceId:p.sourceId,ageDays:null};
 if(p.value!==null&&!(p.value>0)){warnings.push('Share price must be positive; the reported value was discarded.');price.sourceId=null;}
 if(price.value!==null&&!price.asOfDate){warnings.push('Share price has no quote date; its freshness is unknown.');}
 if(price.value!==null&&!price.currency){warnings.push('Share price has no currency; valuation multiples were not computed.');}
 price.ageDays=ageDays(price.asOfDate);
 if(price.ageDays!==null&&price.ageDays>7) warnings.push(`Share price is ${price.ageDays} calendar days old (as of ${price.asOfDate}).`);
 if(identity.quoteCurrency&&price.currency&&identity.quoteCurrency!==price.currency) warnings.push(`Quote currency ${identity.quoteCurrency} differs from the share price currency ${price.currency}; the price currency was used.`);

 const sh=cite(d.shares.sourceId,'Shares outstanding');
 const shares={basicOutstanding:null,dilutedOutstanding:null,asOfDate:date(d.shares.asOfDate,'Share count date'),basis:d.shares.basis,sourceId:null};
 if(d.shares.basicOutstanding!==null||d.shares.dilutedOutstanding!==null){ if(sh.ok){shares.basicOutstanding=d.shares.basicOutstanding>0?d.shares.basicOutstanding:null;shares.dilutedOutstanding=d.shares.dilutedOutstanding>0?d.shares.dilutedOutstanding:null;shares.sourceId=sh.id;} else warnings.push(sh.reason); }
 for(const k of ['basicOutstanding','dilutedOutstanding']) if(shares[k]!==null&&shares[k]<1e5){warnings.push(`${k==='basicOutstanding'?'Basic':'Diluted'} share count ${shares[k]} looks scaled (fewer than 100,000 shares); it was not used for derived values.`);shares[k]=null;}

 const mc=valued(d.marketCap.value,d.marketCap.sourceId,'Market capitalization');
 const marketCap={value:mc.value>0?mc.value:null,currency:currency(d.marketCap.currency,'Market cap currency'),asOfDate:date(d.marketCap.asOfDate,'Market cap date'),sourceId:mc.sourceId,derived:false,derivedValue:null};
 const ev=valued(d.enterpriseValue.value,d.enterpriseValue.sourceId,'Enterprise value');
 const enterpriseValue={value:ev.value,currency:currency(d.enterpriseValue.currency,'Enterprise value currency'),asOfDate:date(d.enterpriseValue.asOfDate,'Enterprise value date'),sourceId:ev.sourceId,derived:false,derivedValue:null};

 const f=d.financials, fIds=cites(f.sourceIds,'Financial statements');
 const keys=['revenue','ebitda','ebit','netIncome','dilutedEPS','operatingCashFlow','capitalExpenditure','freeCashFlow','totalDebt','cashAndEquivalents'];
 const financials={periodLabel:f.periodLabel,periodType:f.periodType,periodEndDate:date(f.periodEndDate,'Financial period end'),basis:f.basis,currency:currency(f.currency,'Financial statement currency'),sourceIds:fIds,periodAgeDays:null,scaledUnitsSuspected:false};
 for(const k of keys) financials[k]=fIds.length?f[k]:null;
 financials.periodAgeDays=ageDays(financials.periodEndDate);
 if(financials.revenue!==null&&Math.abs(financials.revenue)<1e5){financials.scaledUnitsSuspected=true;warnings.push('Revenue is below 100,000 currency units; figures may be in millions rather than full units. Derived multiples were not computed.');}
 if(financials.revenue!==null&&!financials.currency) warnings.push('Financial statement currency is unknown; multiples and cross-company comparison were not computed.');
 if(financials.revenue!==null&&!financials.periodEndDate) warnings.push('Financial period end date is unknown; period consistency with peers cannot be verified.');
 if(financials.periodAgeDays!==null&&financials.periodAgeDays>200) warnings.push(`Latest financial period ended ${financials.periodAgeDays} days ago (${financials.periodEndDate}); newer results may exist.`);
 if(financials.periodType==='Unknown'&&financials.revenue!==null) warnings.push('Financial period type (fiscal year vs trailing twelve months) was not stated.');
 if(identity.reportingCurrency&&financials.currency&&identity.reportingCurrency!==financials.currency) warnings.push(`Reporting currency ${identity.reportingCurrency} differs from the financial statement currency ${financials.currency}; the statement currency was used.`);
 if(financials.freeCashFlow===null&&financials.operatingCashFlow!==null&&financials.capitalExpenditure!==null){financials.freeCashFlow=financials.operatingCashFlow-Math.abs(financials.capitalExpenditure);financials.freeCashFlowDerived=true;} else financials.freeCashFlowDerived=false;

 const gIds=d.growth.sourceIds.filter(i=>allowed.has(i));
 const growth={revenueGrowthPct:gIds.length?d.growth.revenueGrowthPct:null,epsGrowthPct:gIds.length?d.growth.epsGrowthPct:null,periodLabel:d.growth.periodLabel,sourceIds:gIds};
 if(!gIds.length&&(d.growth.revenueGrowthPct!==null||d.growth.epsGrowthPct!==null)) warnings.push('Growth figures had no cited source and were discarded.');

 const history=d.history.map(h=>{const hIds=h.sourceIds.filter(i=>allowed.has(i));return {periodLabel:h.periodLabel,periodEndDate:date(h.periodEndDate,'Historical period end'),revenue:hIds.length?h.revenue:null,ebitda:hIds.length?h.ebitda:null,netIncome:hIds.length?h.netIncome:null,freeCashFlow:hIds.length?h.freeCashFlow:null,sourceIds:hIds};}).filter(h=>h.revenue!==null||h.ebitda!==null||h.netIncome!==null||h.freeCashFlow!==null).sort((a,b)=>String(a.periodEndDate||a.periodLabel).localeCompare(String(b.periodEndDate||b.periodLabel)));
 if(d.history.length&&!history.length) warnings.push('Historical periods had no cited source and were discarded.');

 const c=cite(d.consensus.sourceId,'Consensus estimates'), hasConsensus=[d.consensus.forwardEPS,d.consensus.forwardRevenue,d.consensus.targetPrice].some(v=>v!==null);
 const consensus={forwardEPS:null,forwardEPSPeriod:d.consensus.forwardEPSPeriod,forwardRevenue:null,forwardRevenuePeriod:d.consensus.forwardRevenuePeriod,targetPrice:null,currency:currency(d.consensus.currency,'Consensus currency'),asOfDate:date(d.consensus.asOfDate,'Consensus date'),sourceId:null,ageDays:null};
 if(hasConsensus){ if(c.ok){consensus.forwardEPS=d.consensus.forwardEPS;consensus.forwardRevenue=d.consensus.forwardRevenue;consensus.targetPrice=d.consensus.targetPrice>0?d.consensus.targetPrice:null;consensus.sourceId=c.id;} else warnings.push(c.reason); }
 consensus.ageDays=ageDays(consensus.asOfDate);
 if(consensus.forwardEPS!==null&&!consensus.forwardEPSPeriod) warnings.push('Forward EPS consensus has no stated fiscal period.');
 if(consensus.ageDays!==null&&consensus.ageDays>90) warnings.push(`Consensus estimates are ${consensus.ageDays} days old.`);

 const operatingMetrics=d.operatingMetrics.flatMap(m=>{const cm=cite(m.sourceId,`Operating metric ${m.name}`);if(m.value===null)return [];if(!cm.ok){warnings.push(cm.reason);return [];}return [{name:m.name,value:m.value,unit:m.unit,periodLabel:m.periodLabel,sourceId:cm.id}];});

 // Derived values: computed locally, never taken from the model.
 const derived={netDebt:null,marketCapDerived:null,marketCapBasis:null,enterpriseValueDerived:null,margins:{ebitda:null,ebit:null,net:null,fcf:null},multiples:{peTrailing:null,peForward:null,evEbitda:null,evEbit:null,evRevenue:null,fcfYield:null,netDebtEbitda:null,priceToTarget:null},fcfYieldBasis:null,historicalGrowth:{revenueCagrPct:null,years:null,from:null,to:null},revenueGrowthPct:growth.revenueGrowthPct,revenueGrowthSource:growth.revenueGrowthPct!==null?'reported':null};
 const usable=!financials.scaledUnitsSuspected&&financials.currency;
 if(usable&&financials.totalDebt!==null&&financials.cashAndEquivalents!==null) derived.netDebt=financials.totalDebt-financials.cashAndEquivalents;
 const shareCount=shares.basicOutstanding??shares.dilutedOutstanding;
 if(price.value!==null&&shareCount!==null){derived.marketCapDerived=price.value*shareCount;derived.marketCapBasis=shares.basicOutstanding!==null?'basic shares outstanding':'diluted shares';}
 if(marketCap.value===null&&derived.marketCapDerived!==null){marketCap.value=derived.marketCapDerived;marketCap.currency=price.currency;marketCap.asOfDate=price.asOfDate;marketCap.derived=true;}
 else if(marketCap.value!==null&&derived.marketCapDerived!==null){ const diff=Math.abs(marketCap.value-derived.marketCapDerived)/derived.marketCapDerived; if(diff>0.2) warnings.push(`Sourced market cap differs from price × ${derived.marketCapBasis} by ${(diff*100).toFixed(0)}%; the sourced value was retained. Check share basis and dates.`); marketCap.derivedValue=derived.marketCapDerived; }
 if(marketCap.value!==null&&!marketCap.currency){marketCap.currency=price.currency;}
 const sameCurrency=marketCap.value!==null&&marketCap.currency&&financials.currency&&marketCap.currency===financials.currency;
 if(usable&&sameCurrency&&derived.netDebt!==null) derived.enterpriseValueDerived=marketCap.value+derived.netDebt;
 if(enterpriseValue.value===null&&derived.enterpriseValueDerived!==null){enterpriseValue.value=derived.enterpriseValueDerived;enterpriseValue.currency=marketCap.currency;enterpriseValue.asOfDate=marketCap.asOfDate;enterpriseValue.derived=true;}
 else if(enterpriseValue.value!==null&&derived.enterpriseValueDerived!==null){enterpriseValue.derivedValue=derived.enterpriseValueDerived;const diff=Math.abs(enterpriseValue.value-derived.enterpriseValueDerived)/Math.abs(derived.enterpriseValueDerived||1);if(diff>0.25) warnings.push(`Sourced enterprise value differs from market cap + net debt by ${(diff*100).toFixed(0)}%; the sourced value was retained (minority interests, preferred equity or dates may differ).`);}
 if(enterpriseValue.value!==null&&!enterpriseValue.currency) enterpriseValue.currency=marketCap.currency||financials.currency;
 const currencyMismatch=!!(price.currency&&financials.currency&&price.currency!==financials.currency);
 if(currencyMismatch) warnings.push(`Share price is quoted in ${price.currency} but financial statements are in ${financials.currency}. Cross-currency multiples were not computed; compare peers on margins and growth or convert explicitly.`);
 if(usable&&financials.revenue>0){ for(const [k,v] of [['ebitda',financials.ebitda],['ebit',financials.ebit],['net',financials.netIncome],['fcf',financials.freeCashFlow]]) if(v!==null) derived.margins[k]=v/financials.revenue*100; }
 const m=derived.multiples;
 if(usable&&!currencyMismatch&&price.value!==null&&price.currency){
  if(financials.dilutedEPS>0) m.peTrailing=price.value/financials.dilutedEPS;
  if(consensus.forwardEPS>0&&consensus.currency&&consensus.currency===price.currency) m.peForward=price.value/consensus.forwardEPS;
  else if(consensus.forwardEPS>0&&consensus.currency&&consensus.currency!==price.currency) warnings.push(`Forward EPS consensus is in ${consensus.currency} while the price is in ${price.currency}; forward P/E was not computed.`);
  if(consensus.targetPrice>0&&(!consensus.currency||consensus.currency===price.currency)) m.priceToTarget=(consensus.targetPrice/price.value-1)*100;
 }
 if(usable&&sameCurrency&&enterpriseValue.value!==null&&enterpriseValue.currency===financials.currency){ if(financials.ebitda>0) m.evEbitda=enterpriseValue.value/financials.ebitda; if(financials.ebit>0) m.evEbit=enterpriseValue.value/financials.ebit; if(financials.revenue>0) m.evRevenue=enterpriseValue.value/financials.revenue; }
 if(usable&&sameCurrency&&marketCap.value>0){
  if(financials.freeCashFlow!==null){m.fcfYield=financials.freeCashFlow/marketCap.value*100;derived.fcfYieldBasis=`${financials.periodLabel||'latest period'} free cash flow`;}
  else { const h=[...history].reverse().find(h=>h.freeCashFlow!==null); if(h){m.fcfYield=h.freeCashFlow/marketCap.value*100;derived.fcfYieldBasis=`${h.periodLabel||h.periodEndDate} free cash flow (latest fiscal year; TTM unavailable)`;warnings.push(`FCF yield uses ${h.periodLabel||h.periodEndDate} free cash flow because trailing-twelve-month free cash flow was not reported.`);} }
 }
 if(usable&&derived.netDebt!==null&&financials.ebitda>0) m.netDebtEbitda=derived.netDebt/financials.ebitda;
 const rev=history.filter(h=>h.revenue>0);
 if(rev.length>=2){ const first=rev[0],last=rev.at(-1),years=rev.length-1; derived.historicalGrowth={revenueCagrPct:(Math.pow(last.revenue/first.revenue,1/years)-1)*100,years,from:first.periodLabel,to:last.periodLabel}; if(derived.revenueGrowthPct===null){derived.revenueGrowthPct=(last.revenue/rev.at(-2).revenue-1)*100;derived.revenueGrowthSource=`derived from ${rev.at(-2).periodLabel} to ${last.periodLabel}`;} }
 for(const [k,v] of Object.entries(m)) if(v!==null&&!Number.isFinite(v)) m[k]=null;

 const labels={price:'Share price',shares:'Shares outstanding',marketCap:'Market capitalization',enterpriseValue:'Enterprise value',revenue:'Revenue',ebitda:'EBITDA',ebit:'EBIT',netIncome:'Net income',freeCashFlow:'Free cash flow',netDebt:'Net debt',forwardEPS:'Forward EPS consensus',revenueGrowth:'Revenue growth'};
 const have={price:price.value,shares:shareCount,marketCap:marketCap.value,enterpriseValue:enterpriseValue.value,revenue:financials.revenue,ebitda:financials.ebitda,ebit:financials.ebit,netIncome:financials.netIncome,freeCashFlow:financials.freeCashFlow,netDebt:derived.netDebt,forwardEPS:consensus.forwardEPS,revenueGrowth:derived.revenueGrowthPct};
 for(const [k,label] of Object.entries(labels)) if(have[k]===null&&!missing.some(x=>x.toLowerCase().includes(label.toLowerCase()))) missing.push(label);
 const comparable=price.value!==null&&financials.revenue!==null&&!!financials.currency&&!financials.scaledUnitsSuspected;
 const quality={warnings,missing,priceAgeDays:price.ageDays,periodAgeDays:financials.periodAgeDays,currencyMismatch,scaledUnitsSuspected:financials.scaledUnitsSuspected,comparable,shareBasisUsed:derived.marketCapBasis,freshPrice:price.value!==null&&price.ageDays!==null&&price.ageDays<=7,hasValuationMultiple:Object.values(m).some(v=>v!==null)};
 return {identity,price,shares,marketCap,enterpriseValue,financials,growth,history,consensus,operatingMetrics,derived,notes:d.notes,quality,asOf};
}

export const money=(v,c)=>{ if(v===null||v===undefined) return 'n/a'; const a=Math.abs(v); const s=a>=1e9?`${(v/1e9).toFixed(2)}bn`:a>=1e6?`${(v/1e6).toFixed(1)}m`:a>=1e3?`${(v/1e3).toFixed(1)}k`:v.toFixed(2); return c?`${c} ${s}`:s; };
const x=v=>v===null||v===undefined?'n/a':`${v.toFixed(1)}×`;
const pct=v=>v===null||v===undefined?'n/a':`${v>0?'+':''}${v.toFixed(1)}%`;
export function snapshotSummary(s){
 if(!s) return 'No financial snapshot was collected.';
 const f=s.financials,m=s.derived.multiples,src=id=>id?` [${id}]`:'';
 return [
  `Identity: ${s.identity.name||'?'} (${s.identity.ticker||'?'}, ${s.identity.exchange||'exchange unknown'}, ${s.identity.securityType}); quote currency ${s.identity.quoteCurrency||s.price.currency||'unknown'}; reporting currency ${s.identity.reportingCurrency||f.currency||'unknown'}; fiscal year end ${s.identity.fiscalYearEnd||'unknown'}.`,
  `Share price: ${s.price.value!==null?`${s.price.currency||'?'} ${s.price.value} as of ${s.price.asOfDate||'unknown date'}${s.price.asOfTime?' '+s.price.asOfTime:''} (${s.price.ageDays===null?'age unknown':s.price.ageDays+' days old'})`:'unavailable'}${src(s.price.sourceId)}.`,
  `Shares: basic outstanding ${s.shares.basicOutstanding!==null?s.shares.basicOutstanding.toLocaleString('en-US'):'n/a'}; diluted ${s.shares.dilutedOutstanding!==null?s.shares.dilutedOutstanding.toLocaleString('en-US'):'n/a'}; as of ${s.shares.asOfDate||'unknown'}; basis ${s.shares.basis||'unstated'}${src(s.shares.sourceId)}.`,
  `Market cap: ${money(s.marketCap.value,s.marketCap.currency)}${s.marketCap.derived?` (app-derived: price × ${s.derived.marketCapBasis})`:s.marketCap.sourceId?src(s.marketCap.sourceId):''}. Enterprise value: ${money(s.enterpriseValue.value,s.enterpriseValue.currency)}${s.enterpriseValue.derived?' (app-derived: market cap + net debt)':src(s.enterpriseValue.sourceId)}.`,
  `Financials (${f.periodLabel||'period unknown'}, ${f.periodType}, ended ${f.periodEndDate||'unknown'}, ${f.basis||'basis unstated'}, ${f.currency||'currency unknown'}): revenue ${money(f.revenue)}; EBITDA ${money(f.ebitda)}; EBIT ${money(f.ebit)}; net income ${money(f.netIncome)}; diluted EPS ${f.dilutedEPS??'n/a'}; operating cash flow ${money(f.operatingCashFlow)}; capex ${money(f.capitalExpenditure)}; free cash flow ${money(f.freeCashFlow)}${f.freeCashFlowDerived?' (app-derived: OCF − capex)':''}; total debt ${money(f.totalDebt)}; cash ${money(f.cashAndEquivalents)}; net debt ${money(s.derived.netDebt)} (app-derived)${f.sourceIds.length?` [${f.sourceIds.join(', ')}]`:''}.`,
  `Margins (app-derived): EBITDA ${pct(s.derived.margins.ebitda)}, EBIT ${pct(s.derived.margins.ebit)}, net ${pct(s.derived.margins.net)}, FCF ${pct(s.derived.margins.fcf)}.`,
  `Growth: revenue ${pct(s.derived.revenueGrowthPct)}${s.derived.revenueGrowthSource?` (${s.derived.revenueGrowthSource}${s.growth.periodLabel?', '+s.growth.periodLabel:''})`:''}; EPS ${pct(s.growth.epsGrowthPct)}; revenue CAGR ${s.derived.historicalGrowth.revenueCagrPct!==null?`${pct(s.derived.historicalGrowth.revenueCagrPct)} over ${s.derived.historicalGrowth.years} years (${s.derived.historicalGrowth.from} → ${s.derived.historicalGrowth.to})`:'n/a'}. History: ${s.history.length?s.history.map(h=>`${h.periodLabel||h.periodEndDate}: revenue ${money(h.revenue)}, EBITDA ${money(h.ebitda)}, net income ${money(h.netIncome)}, FCF ${money(h.freeCashFlow)}`).join('; '):'none'}.`,
  `Consensus: forward EPS ${s.consensus.forwardEPS??'n/a'} ${s.consensus.currency||''} (${s.consensus.forwardEPSPeriod||'period unstated'}); forward revenue ${money(s.consensus.forwardRevenue,s.consensus.currency)} (${s.consensus.forwardRevenuePeriod||'period unstated'}); target price ${s.consensus.targetPrice??'n/a'}; as of ${s.consensus.asOfDate||'unknown'}${src(s.consensus.sourceId)}.`,
  `Valuation multiples (app-computed, ${s.price.asOfDate||'price date unknown'} price vs ${f.periodLabel||'latest'} financials): trailing P/E ${x(m.peTrailing)}; forward P/E ${x(m.peForward)}; EV/EBITDA ${x(m.evEbitda)}; EV/EBIT ${x(m.evEbit)}; EV/Revenue ${x(m.evRevenue)}; FCF yield ${pct(m.fcfYield)}${s.derived.fcfYieldBasis?` (${s.derived.fcfYieldBasis})`:''}; net debt/EBITDA ${x(m.netDebtEbitda)}; upside to consensus target ${pct(m.priceToTarget)}.`,
  `Operating metrics: ${s.operatingMetrics.length?s.operatingMetrics.map(o=>`${o.name} ${o.value}${o.unit?' '+o.unit:''}${o.periodLabel?' ('+o.periodLabel+')':''}${src(o.sourceId)}`).join('; '):'none reported'}.`,
  `Data quality: ${s.quality.comparable?'comparable':'NOT fully comparable'}; warnings: ${s.quality.warnings.length?s.quality.warnings.join(' | '):'none'}; missing: ${s.quality.missing.length?s.quality.missing.join(', '):'none'}. Notes: ${s.notes||'none'}`
 ].join('\n');
}
