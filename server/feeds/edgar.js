// SEC EDGAR XBRL company facts: reported fiscal-year financials for US filers, free, no key. A contact in the User-Agent is
// mandatory under the SEC fair-access policy; the app refuses to call EDGAR without one. 10 requests a second allowed; the app
// makes at most one companyfacts request per company per day and caches the extracted figures.
import {FeedError,fetchText,parseJSON} from './errors.js';
export const EDGAR_LIMITS={perMinute:60,perHour:600,perDay:2000};
const TICKERS_URL='https://www.sec.gov/files/company_tickers.json';
export const factsURL=cik=>`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10,'0')}.json`;
export const filingIndexURL=(cik,accn)=>`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${String(accn).replace(/-/g,'')}/`;
export const edgarHeaders=(contact,version)=>({'User-Agent':`INVEST-IGATOR/${version} (${contact})`,'Accept':'application/json'});
export async function fetchTickerMap(fetcher,contact,version){
 const d=parseJSON(await fetchText(fetcher,TICKERS_URL,{headers:edgarHeaders(contact,version),provider:'SEC EDGAR',timeoutMs:30000}),'SEC EDGAR');
 const map={};
 for(const row of Object.values(d||{})) if(row&&row.ticker&&row.cik_str!=null) map[String(row.ticker).toUpperCase()]={cik:Number(row.cik_str),title:row.title||null};
 if(!Object.keys(map).length) throw new FeedError('SEC ticker list was empty','PROVIDER_ERROR','SEC EDGAR');
 return map;
}
export async function fetchCompanyFacts(fetcher,contact,version,cik){
 return parseJSON(await fetchText(fetcher,factsURL(cik),{headers:edgarHeaders(contact,version),provider:'SEC EDGAR',timeoutMs:45000}),'SEC EDGAR');
}
const ANNUAL_FORMS=new Set(['10-K','10-K/A','20-F','20-F/A','40-F','40-F/A']);
const TAGS={
 revenue:['Revenues','RevenueFromContractWithCustomerExcludingAssessedTax','SalesRevenueNet','RevenueFromContractWithCustomerIncludingAssessedTax','RevenuesNetOfInterestExpense'],
 ebit:['OperatingIncomeLoss'],
 netIncome:['NetIncomeLoss','ProfitLoss','NetIncomeLossAvailableToCommonStockholdersBasic'],
 dilutedEPS:['EarningsPerShareDiluted'],
 operatingCashFlow:['NetCashProvidedByUsedInOperatingActivities','NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
 capitalExpenditure:['PaymentsToAcquirePropertyPlantAndEquipment','PaymentsToAcquireProductiveAssets'],
 depreciation:['DepreciationDepletionAndAmortization','DepreciationAndAmortization','DepreciationAmortizationAndAccretionNet'],
 cash:['CashAndCashEquivalentsAtCarryingValue','CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
 debtTotal:['LongTermDebt','DebtLongtermAndShorttermCombinedAmount','LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities'],
 debtNoncurrent:['LongTermDebtNoncurrent','LongTermDebtAndCapitalLeaseObligations'],
 debtCurrent:['LongTermDebtCurrent','DebtCurrent','LongTermDebtAndCapitalLeaseObligationsCurrent'],
 shortTermBorrowings:['ShortTermBorrowings','CommercialPaper'],
 dilutedShares:['WeightedAverageNumberOfDilutedSharesOutstanding']
};
const DURATION=new Set(['revenue','ebit','netIncome','dilutedEPS','operatingCashFlow','capitalExpenditure','depreciation','dilutedShares']);
const days=(a,b)=>(Date.parse(b)-Date.parse(a))/86400000;
// Picks the fiscal-year value of a concept for each fiscal year: annual forms, fp FY, full-year duration (330–400 days) or an instant
// at the fiscal year end. Later filings for the same year win (restatements), so the latest reported figure is used.
function annualValues(facts,names,{instant=false}={}){
 const out=new Map(); let unit=null;
 for(const name of names){
  const concept=facts[name]; if(!concept||!concept.units) continue;
  for(const [u,rows] of Object.entries(concept.units)){
   for(const r of rows){
    if(!ANNUAL_FORMS.has(r.form)||r.fp!=='FY'||typeof r.val!=='number'||!r.end) continue;
    if(!instant){ if(!r.start) continue; const len=days(r.start,r.end); if(len<330||len>400) continue; }
    const key=r.end.slice(0,4), prev=out.get(key); // keyed by period end: a 10-K's prior-year comparatives carry the filing's fy, not their own
    if(!prev||(r.filed||'')>(prev.filed||'')||((r.filed||'')===(prev.filed||'')&&r.end>prev.end)) out.set(key,{value:r.val,end:r.end,start:r.start||null,filed:r.filed||null,accn:r.accn||null,form:r.form,unit:u,tag:name});
   }
   if(out.size&&!unit) unit=u;
  }
  if(out.size) break; // the first concept in preference order that has annual data is used throughout
 }
 return out;
}
// Extracts up to `years` fiscal years of reported financials and the latest cover-page share count.
export function extractFinancials(facts,{years=4}={}){
 const gaap=facts?.facts?.['us-gaap']||{}, ifrs=facts?.facts?.['ifrs-full']||{}, dei=facts?.facts?.dei||{};
 const source=Object.keys(gaap).length?gaap:ifrs, basis=Object.keys(gaap).length?'US GAAP (XBRL as filed)':Object.keys(ifrs).length?'IFRS (XBRL as filed)':null;
 const picked={}; for(const [k,names] of Object.entries(TAGS)) picked[k]=annualValues(source,names,{instant:!DURATION.has(k)});
 const fyKeys=[...new Set([...picked.revenue.keys(),...picked.netIncome.keys()])].sort().reverse().slice(0,years);
 const currency=[...picked.revenue.values()][0]?.unit||[...picked.netIncome.values()][0]?.unit||null;
 const notes=[];
 const rows=fyKeys.map(fy=>{
  const g=k=>picked[k].get(fy)?.value??null, end=picked.revenue.get(fy)?.end||picked.netIncome.get(fy)?.end||null, filed=picked.revenue.get(fy)||picked.netIncome.get(fy);
  let totalDebt=g('debtTotal'), debtNote=null;
  if(totalDebt===null){ const parts=[g('debtNoncurrent'),g('debtCurrent'),g('shortTermBorrowings')].filter(v=>v!==null); if(parts.length){totalDebt=parts.reduce((a,b)=>a+b,0);debtNote=`FY${fy} total debt summed from ${parts.length} balance-sheet debt lines (no total reported).`;} }
  const ebit=g('ebit'), da=g('depreciation'), ebitda=ebit!==null&&da!==null?ebit+da:null;
  if(debtNote) notes.push(debtNote);
  return {fiscalYear:String(fy),periodLabel:`FY${fy}`,periodEndDate:end,revenue:g('revenue'),ebit,ebitda,netIncome:g('netIncome'),dilutedEPS:g('dilutedEPS'),operatingCashFlow:g('operatingCashFlow'),capitalExpenditure:g('capitalExpenditure'),totalDebt,cashAndEquivalents:g('cash'),dilutedShares:g('dilutedShares'),form:filed?.form||null,filed:filed?.filed||null,accn:filed?.accn||null,ebitdaDerived:ebitda!==null};
 }).filter(r=>r.periodEndDate&&(r.revenue!==null||r.netIncome!==null));
 if(rows.some(r=>r.ebitdaDerived)) notes.push('EBITDA = operating income + depreciation and amortization from the filed facts (app-derived).');
 let sharesOutstanding=null;
 const cover=dei.EntityCommonStockSharesOutstanding?.units?.shares||[];
 for(const r of cover) if(typeof r.val==='number'&&r.val>0&&r.end&&(!sharesOutstanding||r.end>sharesOutstanding.asOf||(r.end===sharesOutstanding.asOf&&r.val>sharesOutstanding.value))) sharesOutstanding={value:r.val,asOf:r.end,form:r.form||null,accn:r.accn||null,filed:r.filed||null};
 // Several share classes appear as separate rows with the same end date; the loop keeps the largest, so note when more than one row shares the date.
 if(sharesOutstanding&&cover.filter(r=>r.end===sharesOutstanding.asOf).length>1) notes.push(`Cover-page shares outstanding: ${cover.filter(r=>r.end===sharesOutstanding.asOf).length} share-class rows at ${sharesOutstanding.asOf}; the largest single class was used.`);
 const fye=facts?.fiscalYearEnd||null;
 return {cik:facts?.cik??null,entityName:facts?.entityName||null,basis,currency,fiscalYearEnd:fye,years:rows,sharesOutstanding,notes};
}
