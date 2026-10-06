// SYNTHETIC feed fixtures — none of these figures describe a real company. Shared by the feed tests and the browser fixture.
const fy=(start,end,val,filed,accn,fp='FY',form='10-K')=>({start,end,val,fy:Number(end.slice(0,4)),fp,form,filed,accn});
const inst=(end,val,filed,accn,fp='FY',form='10-K')=>({end,val,fy:Number(end.slice(0,4)),fp,form,filed,accn});
export const edgarFacts={cik:1234567,entityName:'Synthetic Filer Inc',facts:{
 dei:{EntityCommonStockSharesOutstanding:{units:{shares:[inst('2026-07-31',400000000,'2026-08-05','0001-26-000002','Q2','10-Q'),inst('2026-01-31',398000000,'2026-02-20','0001-26-000001')]}}},
 'us-gaap':{
  Revenues:{units:{USD:[fy('2025-01-01','2025-12-31',10000000000,'2026-02-20','0001-26-000001'),fy('2024-01-01','2024-12-31',9000000000,'2025-02-21','0001-25-000001'),{...fy('2024-01-01','2024-12-31',9050000000,'2026-02-20','0001-26-000001'),fy:2025},fy('2025-01-01','2025-06-30',4800000000,'2025-08-01','0001-25-000003','Q2','10-Q'),fy('2023-01-01','2023-12-31',8000000000,'2024-02-20','0001-24-000001')]}},
  OperatingIncomeLoss:{units:{USD:[fy('2025-01-01','2025-12-31',2000000000,'2026-02-20','0001-26-000001'),fy('2024-01-01','2024-12-31',1700000000,'2025-02-21','0001-25-000001'),fy('2023-01-01','2023-12-31',1500000000,'2024-02-20','0001-24-000001')]}},
  DepreciationDepletionAndAmortization:{units:{USD:[fy('2025-01-01','2025-12-31',500000000,'2026-02-20','0001-26-000001'),fy('2024-01-01','2024-12-31',450000000,'2025-02-21','0001-25-000001')]}},
  NetIncomeLoss:{units:{USD:[fy('2025-01-01','2025-12-31',1500000000,'2026-02-20','0001-26-000001'),fy('2024-01-01','2024-12-31',1200000000,'2025-02-21','0001-25-000001'),fy('2023-01-01','2023-12-31',1000000000,'2024-02-20','0001-24-000001')]}},
  EarningsPerShareDiluted:{units:{'USD/shares':[fy('2025-01-01','2025-12-31',3.66,'2026-02-20','0001-26-000001')]}},
  NetCashProvidedByUsedInOperatingActivities:{units:{USD:[fy('2025-01-01','2025-12-31',2200000000,'2026-02-20','0001-26-000001'),fy('2024-01-01','2024-12-31',1900000000,'2025-02-21','0001-25-000001')]}},
  PaymentsToAcquirePropertyPlantAndEquipment:{units:{USD:[fy('2025-01-01','2025-12-31',400000000,'2026-02-20','0001-26-000001'),fy('2024-01-01','2024-12-31',350000000,'2025-02-21','0001-25-000001')]}},
  CashAndCashEquivalentsAtCarryingValue:{units:{USD:[inst('2025-12-31',1000000000,'2026-02-20','0001-26-000001'),inst('2024-12-31',900000000,'2026-02-20','0001-26-000001'),inst('2026-06-30',1100000000,'2026-08-05','0001-26-000002','Q2','10-Q')]}},
  LongTermDebtNoncurrent:{units:{USD:[inst('2025-12-31',2500000000,'2026-02-20','0001-26-000001')]}},
  LongTermDebtCurrent:{units:{USD:[inst('2025-12-31',500000000,'2026-02-20','0001-26-000001')]}},
  WeightedAverageNumberOfDilutedSharesOutstanding:{units:{shares:[fy('2025-01-01','2025-12-31',410000000,'2026-02-20','0001-26-000001')]}}
 }}};
export const tickerMap={0:{cik_str:1234567,ticker:'ETN',title:'Synthetic Filer Inc'},1:{cik_str:7654321,ticker:'SYN',title:'Synthetic Peer Inc'}};
const bars=(endDate,close)=>{const d=new Date(endDate+'T00:00:00Z');return [1,0].map(n=>{const day=new Date(d.getTime()-n*86400000).toISOString().slice(0,10);return {date:day+'T00:00:00.000Z',close:close-n*0.5,high:close,low:close-1,open:close-0.5,volume:1000,adjClose:close-n*0.5,adjVolume:1000,divCash:0,splitFactor:1};});};
const text=(status,body)=>({status,ok:status>=200&&status<300,statusText:'',text:async()=>body});
const json=(body,status=200)=>text(status,JSON.stringify(body));
// Fake fetcher for Tiingo, SEC EDGAR and CoinGecko. Options control the Tiingo close and which symbols fail.
export function fakeFetcher({close=123.45,notFound=['ZZZ'],rateLimited=['RATE'],calls=[],requireContact=true}={}){
 return async (url,options={})=>{
  calls.push({url,headers:options.headers||{}});
  const u=new URL(url);
  if(u.hostname==='api.tiingo.com'){
   const m=u.pathname.match(/^\/tiingo\/daily\/([^/]+)\/prices$/); if(!m) return json({ticker:'X',name:'Synthetic',exchangeCode:'NYSE'});
   const symbol=decodeURIComponent(m[1]);
   if(notFound.includes(symbol)) return text(404,'Not found');
   if(rateLimited.includes(symbol)) return text(200,'You have exceeded your hourly rate limit of 50 requests. Please wait before making more requests.');
   if(symbol==='HTML') return text(200,'<html><body>Service Temporarily Unavailable</body></html>');
   return json(bars(u.searchParams.get('endDate'),close));
  }
  if(u.hostname==='www.sec.gov'||u.hostname==='data.sec.gov'){
   if(requireContact&&!/INVEST-IGATOR\/\S+ \(.+@.+\)/.test(options.headers?.['User-Agent']||'')) return text(403,'Undeclared automated tool');
   if(u.pathname==='/files/company_tickers.json') return json(tickerMap);
   if(u.pathname==='/api/xbrl/companyfacts/CIK0001234567.json') return json(edgarFacts);
   return text(404,'Not found');
  }
  if(u.hostname==='api.coingecko.com'){ const ids=(u.searchParams.get('ids')||'').split(','); const out={}; for(const i of ids) if(i==='bitcoin') out[i]={usd:60000.5,last_updated_at:Math.floor(Date.parse('2026-10-06T20:00:00Z')/1000)}; return json(out); }
  return text(500,'unexpected host');
 };
}
