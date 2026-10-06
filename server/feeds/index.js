// FeedService: keys, rate limits with persisted daily usage, a dated price-observation table filled once a day after the close,
// a per-company feed profile (asset type, feed symbol, CIK, CoinGecko id), and feed-first data collection for financial snapshots.
// Numbers come from code calling data feeds; the model is the fallback for what the feeds lack. Every stored price carries its
// date, source and currency; a failed fetch keeps the last good price with its date and is never replaced by zero.
import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {z} from 'zod';
import {id,now,fail,parse} from '../model.js';
import {RateLimiter} from './rate-limiter.js';
import {dailyFetchDue,lastTradingDayOnOrBefore,newYork} from './calendar.js';
import {TIINGO_LIMITS,tiingoSymbol,fetchDailyPrices,tiingoSourceURL} from './tiingo.js';
import {COINGECKO_LIMITS,fetchSimplePrices,coingeckoSourceURL} from './coingecko.js';
import {EDGAR_LIMITS,fetchTickerMap,fetchCompanyFacts,extractFinancials,factsURL,filingIndexURL} from './edgar.js';
import {FeedError} from './errors.js';

export const ASSET_TYPES=['Company','Fund','Crypto'];
const profileSchema=z.object({companyId:z.string().uuid(),assetType:z.enum(ASSET_TYPES),feedSymbol:z.string().trim().max(24).regex(/^[A-Za-z0-9.^-]*$/).default(''),coingeckoId:z.string().trim().max(80).regex(/^[a-z0-9-]*$/).default('')}).strict();
export function readSecret(dataDir,name,envName){
 if(envName&&process.env[envName]?.trim()) return process.env[envName].trim();
 const path=join(dataDir,name);
 try { const st=statSync(path); if(!st.isFile()||st.size>4096||(st.mode&0o077)) return ''; return readFileSync(path,'utf8').trim(); } catch { return ''; }
}
const US_EXCHANGE=/nyse|nasdaq|new york stock|amex|american stock|nyse arca|bats|cboe|otc/i;

export class FeedService {
 constructor(store,{dataDir,version='0',fetcher=globalThis.fetch,clock=()=>new Date(),schedule=false}={}){
  this.store=store; this.db=store.db; this.dataDir=dataDir; this.version=version; this.fetcher=fetcher; this.clock=clock; this.timer=null; this.busy=false;
  this.db.exec(`CREATE TABLE IF NOT EXISTS feed_usage (provider TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(provider,day));
   CREATE TABLE IF NOT EXISTS price_observations (company_id TEXT NOT NULL, date TEXT NOT NULL, source TEXT NOT NULL, close REAL NOT NULL, adj_close REAL, currency TEXT NOT NULL, fetched_at TEXT NOT NULL, PRIMARY KEY(company_id,date,source));
   CREATE INDEX IF NOT EXISTS price_observations_company ON price_observations(company_id,date);
   CREATE TABLE IF NOT EXISTS company_profile (company_id TEXT PRIMARY KEY, asset_type TEXT NOT NULL, feed_symbol TEXT NOT NULL, cik INTEGER, coingecko_id TEXT NOT NULL, feed_status TEXT, feed_status_at TEXT, updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS feed_cache (key TEXT PRIMARY KEY, fetched_at TEXT NOT NULL, body TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS feed_log (id TEXT PRIMARY KEY, kind TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, requests INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '');`);
  const usage=provider=>({load:()=>{const r=this.db.prepare('SELECT day,count FROM feed_usage WHERE provider=? ORDER BY day DESC LIMIT 1').get(provider);return r||null;},save:(day,count)=>this.db.prepare('INSERT INTO feed_usage VALUES (?,?,?) ON CONFLICT(provider,day) DO UPDATE SET count=excluded.count').run(provider,day,count),now:()=>this.clock().getTime()});
  this.limiters={tiingo:new RateLimiter({...TIINGO_LIMITS,...usage('tiingo')}),coingecko:new RateLimiter({...COINGECKO_LIMITS,...usage('coingecko')}),edgar:new RateLimiter({...EDGAR_LIMITS,...usage('edgar')})};
  if(schedule) this.timer=setInterval(()=>{this.runScheduled().catch(error=>console.error('Daily price fetch failed:',error.message));},60000);
 }
 close(){ if(this.timer) clearInterval(this.timer); }
 // ---- keys ----
 keys(){ return {tiingo:!!readSecret(this.dataDir,'tiingo-api-key','TIINGO_API_KEY'),edgar:!!readSecret(this.dataDir,'edgar-contact','RESEARCH_EDGAR_CONTACT'),fmp:!!readSecret(this.dataDir,'fmp-api-key','FMP_API_KEY')}; }
 tiingoKey(){ return readSecret(this.dataDir,'tiingo-api-key','TIINGO_API_KEY'); }
 edgarContact(){ return readSecret(this.dataDir,'edgar-contact','RESEARCH_EDGAR_CONTACT'); }
 // ---- profiles ----
 profile(companyId){ const r=this.db.prepare('SELECT * FROM company_profile WHERE company_id=?').get(companyId); return r?{assetType:r.asset_type,feedSymbol:r.feed_symbol,cik:r.cik,coingeckoId:r.coingecko_id,feedStatus:r.feed_status,feedStatusAt:r.feed_status_at,updatedAt:r.updated_at}:{assetType:'Company',feedSymbol:'',cik:null,coingeckoId:'',feedStatus:null,feedStatusAt:null,updatedAt:null}; }
 setProfile(value){
  const p=parse(profileSchema,value), c=this.store.read().workspace.companies.find(x=>x.id===p.companyId); if(!c) fail('Company not found',404);
  if(p.assetType==='Crypto'&&!p.coingeckoId) fail('A CoinGecko id (for example “bitcoin”) is needed to track a crypto price.');
  const cur=this.profile(p.companyId), feedSymbol=tiingoSymbol(p.feedSymbol||''), reset=feedSymbol!==cur.feedSymbol;
  this.db.prepare('INSERT INTO company_profile (company_id,asset_type,feed_symbol,cik,coingecko_id,feed_status,feed_status_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET asset_type=excluded.asset_type,feed_symbol=excluded.feed_symbol,cik=excluded.cik,coingecko_id=excluded.coingecko_id,feed_status=excluded.feed_status,feed_status_at=excluded.feed_status_at,updated_at=excluded.updated_at').run(p.companyId,p.assetType,feedSymbol,cur.cik,p.coingeckoId,reset?null:cur.feedStatus,reset?null:cur.feedStatusAt,now());
  return this.profile(p.companyId);
 }
 markFeedStatus(companyId,status){ const cur=this.profile(companyId); this.db.prepare('INSERT INTO company_profile (company_id,asset_type,feed_symbol,cik,coingecko_id,feed_status,feed_status_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET feed_status=excluded.feed_status,feed_status_at=excluded.feed_status_at,updated_at=excluded.updated_at').run(companyId,cur.assetType,cur.feedSymbol,cur.cik,cur.coingeckoId,status,now(),now()); }
 setCik(companyId,cik){ const cur=this.profile(companyId); this.db.prepare('INSERT INTO company_profile (company_id,asset_type,feed_symbol,cik,coingecko_id,feed_status,feed_status_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET cik=excluded.cik,updated_at=excluded.updated_at').run(companyId,cur.assetType,cur.feedSymbol,cik,cur.coingeckoId,cur.feedStatus,cur.feedStatusAt,now()); }
 symbolFor(company){ const p=this.profile(company.id); return p.feedSymbol||tiingoSymbol(company.ticker); }
 // A company is eligible for Tiingo when it is a company or fund with a US-looking (or unverified) listing and Tiingo has not reported the symbol missing in the last 30 days.
 tiingoEligible(company){ const p=this.profile(company.id); if(p.assetType==='Crypto') return false; if(p.feedStatus==='not_found'&&p.feedStatusAt&&(this.clock().getTime()-Date.parse(p.feedStatusAt))<30*86400000) return false; return !company.exchange||US_EXCHANGE.test(company.exchange)||!!p.feedSymbol; }
 // ---- observations ----
 latestPrice(companyId){ const r=this.db.prepare('SELECT * FROM price_observations WHERE company_id=? ORDER BY date DESC, fetched_at DESC LIMIT 1').get(companyId); return r?{date:r.date,close:r.close,adjClose:r.adj_close,currency:r.currency,source:r.source,fetchedAt:r.fetched_at}:null; }
 priceHistory(companyId,{from=null,limit=400}={}){ return this.db.prepare(`SELECT date,close,adj_close AS adjClose,currency,source,fetched_at AS fetchedAt FROM price_observations WHERE company_id=? ${from?'AND date>=?':''} ORDER BY date DESC LIMIT ?`).all(...(from?[companyId,from,limit]:[companyId,limit])).reverse(); }
 recordObservation(companyId,{date,close,adjClose=null,currency,source}){ if(!(close>0)||!date||!currency) return false; this.db.prepare('INSERT INTO price_observations VALUES (?,?,?,?,?,?,?) ON CONFLICT(company_id,date,source) DO UPDATE SET close=excluded.close,adj_close=excluded.adj_close,currency=excluded.currency,fetched_at=excluded.fetched_at').run(companyId,date,source,close,adjClose,currency,now()); return true; }
 lastLog(kind=null){ return this.db.prepare(`SELECT * FROM feed_log ${kind?'WHERE kind=?':''} ORDER BY started_at DESC LIMIT 1`).get(...(kind?[kind]:[]))||null; }
 status(){
  const keys=this.keys(), last=this.lastLog(), daily=this.db.prepare("SELECT * FROM feed_log WHERE kind='daily' AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1").get()||null;
  const ny=newYork(this.clock()), due=dailyFetchDue(this.clock()), doneToday=daily&&daily.started_at.slice(0,10)===new Date(this.clock()).toISOString().slice(0,10)&&daily.note.startsWith(due||'none');
  return {keys,usage:{tiingo:this.limiters.tiingo.remaining(),edgar:this.limiters.edgar.remaining(),coingecko:this.limiters.coingecko.remaining()},observations:this.db.prepare('SELECT count(*) AS n FROM price_observations').get().n,companiesWithPrices:this.db.prepare('SELECT count(DISTINCT company_id) AS n FROM price_observations').get().n,lastFetch:last?{kind:last.kind,startedAt:last.started_at,finishedAt:last.finished_at,requests:last.requests,updated:last.updated,failed:last.failed,skipped:last.skipped,note:last.note}:null,dailyDoneToday:!!doneToday,dailySchedule:'Once per New York trading day after 16:45 ET, while the app is running',newYorkDate:ny.date,busy:this.busy,contactConfigured:keys.edgar};
 }
 // ---- daily close fetch ----
 async runScheduled(){
  const due=dailyFetchDue(this.clock()); if(!due||this.busy) return null;
  const done=this.db.prepare("SELECT id FROM feed_log WHERE kind='daily' AND note LIKE ? AND finished_at IS NOT NULL").get(due+'%'); if(done) return null;
  if(!this.keys().tiingo&&!this.anyCrypto()) return null;
  return this.refreshPrices({kind:'daily',note:due});
 }
 anyCrypto(){ return !!this.db.prepare("SELECT company_id FROM company_profile WHERE asset_type='Crypto' AND coingecko_id<>'' LIMIT 1").get(); }
 // Fetches the latest close for every active company the feeds cover. Refuses up front when the plan would exceed the hourly or daily quota.
 async refreshPrices({kind='manual',note='',companyIds=null}={}){
  if(this.busy) fail('A price fetch is already running.',409);
  const key=this.tiingoKey(), workspace=this.store.read().workspace;
  const active=workspace.companies.filter(c=>!c.archivedAt&&(!companyIds||companyIds.includes(c.id)));
  const equities=key?active.filter(c=>this.tiingoEligible(c)):[], crypto=active.filter(c=>this.profile(c.id).assetType==='Crypto'&&this.profile(c.id).coingeckoId);
  if(!equities.length&&!crypto.length) fail(key?'No company is eligible for a price feed (US-listed companies and funds, or crypto records with a CoinGecko id).':'Connect a Tiingo API key on the server (Connect feeds.command) to fetch prices.',key?409:503);
  const capacity=this.limiters.tiingo.capacity(), needed=equities.length;
  if(needed>capacity) fail(`This fetch needs ${needed} Tiingo requests but only ${capacity} remain in the current quota (${this.limiters.tiingo.perHour} an hour, ${this.limiters.tiingo.perDay} a day). Try again later.`,429);
  const logId=id(), started=now(); this.db.prepare('INSERT INTO feed_log (id,kind,started_at,note) VALUES (?,?,?,?)').run(logId,kind,started,note||kind); this.busy=true;
  const result={requests:0,updated:0,failed:0,skipped:0,details:[]}; const today=new Date(this.clock()).toISOString().slice(0,10);
  try {
   for(const c of equities){
    if(!this.limiters.tiingo.canCall()&&!(await this.limiters.tiingo.waitForSlot(70000))){result.skipped++;result.details.push({ticker:c.ticker,outcome:'skipped',reason:'rate limit'});continue;}
    const symbol=this.symbolFor(c), start=new Date(this.clock().getTime()-12*86400000).toISOString().slice(0,10);
    try {
     this.limiters.tiingo.recordCall(); result.requests++;
     const bars=await fetchDailyPrices(this.fetcher,key,symbol,{startDate:start,endDate:today});
     const last=bars.at(-1);
     if(!last){result.failed++;result.details.push({ticker:c.ticker,outcome:'no data'});this.markFeedStatus(c.id,'no_data');continue;}
     for(const b of bars) this.recordObservation(c.id,{date:b.date,close:b.close,adjClose:b.adjClose,currency:c.currency||'USD',source:'Tiingo close'});
     this.markFeedStatus(c.id,'ok'); result.updated++; result.details.push({ticker:c.ticker,outcome:'updated',date:last.date,close:last.close});
    } catch(error){
     result.failed++; result.details.push({ticker:c.ticker,outcome:'failed',reason:error.message});
     if(error instanceof FeedError&&error.type==='NOT_FOUND') this.markFeedStatus(c.id,'not_found');
     if(error instanceof FeedError&&error.type==='RATE_LIMITED'){result.skipped+=0;break;}
    }
   }
   if(crypto.length&&this.limiters.coingecko.canCall()){
    try {
     this.limiters.coingecko.recordCall(); result.requests++;
     const prices=await fetchSimplePrices(this.fetcher,crypto.map(c=>this.profile(c.id).coingeckoId));
     for(const c of crypto){ const p=prices[this.profile(c.id).coingeckoId]; if(p){ this.recordObservation(c.id,{date:(p.asOf||now()).slice(0,10),close:p.price,currency:'USD',source:'CoinGecko'}); result.updated++; result.details.push({ticker:c.ticker,outcome:'updated',date:(p.asOf||now()).slice(0,10),close:p.price}); } else { result.failed++; result.details.push({ticker:c.ticker,outcome:'failed',reason:'CoinGecko returned no price for this id'}); } }
    } catch(error){ result.failed+=crypto.length; result.details.push({ticker:'crypto',outcome:'failed',reason:error.message}); }
   }
  } finally {
   this.busy=false;
   this.db.prepare('UPDATE feed_log SET finished_at=?,requests=?,updated=?,failed=?,skipped=? WHERE id=?').run(now(),result.requests,result.updated,result.failed,result.skipped,logId);
  }
  return {id:logId,kind,startedAt:started,...result};
 }
 // ---- feed-first data for a financial snapshot ----
 async tickerMap(){
  const cached=this.db.prepare('SELECT fetched_at,body FROM feed_cache WHERE key=?').get('edgar:tickers');
  if(cached&&(this.clock().getTime()-Date.parse(cached.fetched_at))<7*86400000) return {map:JSON.parse(cached.body),fetched:false};
  const contact=this.edgarContact(); if(!contact) throw new FeedError('SEC EDGAR contact not configured','AUTH','SEC EDGAR');
  if(!this.limiters.edgar.canCall()) throw new FeedError('SEC EDGAR rate limit reached','RATE_LIMITED','SEC EDGAR');
  this.limiters.edgar.recordCall(); const map=await fetchTickerMap(this.fetcher,contact,this.version);
  this.db.prepare('INSERT INTO feed_cache VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET fetched_at=excluded.fetched_at,body=excluded.body').run('edgar:tickers',now(),JSON.stringify(map));
  return {map,fetched:true};
 }
 async edgarFinancials(company){
  const p=this.profile(company.id); if(p.assetType!=='Company') return {skipped:'not a company'};
  let cik=p.cik, requests=0;
  if(!cik){ const {map,fetched}=await this.tickerMap(); if(fetched) requests++; const hit=map[company.ticker.toUpperCase()]||map[this.symbolFor(company)]; if(!hit) return {skipped:'not an SEC filer in the EDGAR ticker list',requests}; cik=hit.cik; this.setCik(company.id,cik); }
  const key=`edgar:facts:${cik}`, cached=this.db.prepare('SELECT fetched_at,body FROM feed_cache WHERE key=?').get(key);
  if(cached&&(this.clock().getTime()-Date.parse(cached.fetched_at))<86400000) return {cik,...JSON.parse(cached.body),cached:true,requests};
  const contact=this.edgarContact(); if(!contact) throw new FeedError('SEC EDGAR contact not configured','AUTH','SEC EDGAR');
  if(!this.limiters.edgar.canCall()) throw new FeedError('SEC EDGAR rate limit reached','RATE_LIMITED','SEC EDGAR');
  this.limiters.edgar.recordCall(); requests++; const facts=await fetchCompanyFacts(this.fetcher,contact,this.version,cik), extracted=extractFinancials(facts);
  this.db.prepare('INSERT INTO feed_cache VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET fetched_at=excluded.fetched_at,body=excluded.body').run(key,now(),JSON.stringify(extracted));
  return {cik,...extracted,cached:false,requests};
 }
 // Returns feed-collected blocks in the snapshot draft shape plus the sources they cite, or nulls with reasons. Never throws.
 async collect(company,asOf){
  const out={price:null,shares:null,financials:null,history:[],sources:[],notes:[],requests:0,coverage:{price:false,financials:false}};
  const addSource=(url,title)=>{let s=out.sources.find(x=>x.url===url);if(!s){s={id:`F${out.sources.length+1}`,url,title};out.sources.push(s);}return s.id;};
  const p=this.profile(company.id);
  // Price: today's stored close if fresh, otherwise one Tiingo request (US-listed companies and funds) or CoinGecko (crypto).
  try {
   let obs=this.latestPrice(company.id);
   const expected=lastTradingDayOnOrBefore(asOf);
   if(p.assetType==='Crypto'&&p.coingeckoId){
    if(!obs||obs.date<asOf){ if(this.limiters.coingecko.canCall()){ this.limiters.coingecko.recordCall(); out.requests++; const prices=await fetchSimplePrices(this.fetcher,[p.coingeckoId]); const q=prices[p.coingeckoId]; if(q){this.recordObservation(company.id,{date:(q.asOf||now()).slice(0,10),close:q.price,currency:'USD',source:'CoinGecko'});obs=this.latestPrice(company.id);} } }
    if(obs){ const sid=addSource(coingeckoSourceURL(p.coingeckoId),`CoinGecko price for ${p.coingeckoId}`); out.price={value:obs.close,currency:obs.currency,asOfDate:obs.date,asOfTime:null,sourceId:sid}; out.coverage.price=true; }
   } else if(this.tiingoKey()&&this.tiingoEligible(company)){
    if(!obs||obs.date<expected){
     if(this.limiters.tiingo.canCall()){
      this.limiters.tiingo.recordCall(); out.requests++;
      try { const bars=await fetchDailyPrices(this.fetcher,this.tiingoKey(),this.symbolFor(company),{startDate:new Date(Date.parse(asOf)-12*86400000).toISOString().slice(0,10),endDate:asOf}); for(const b of bars) this.recordObservation(company.id,{date:b.date,close:b.close,adjClose:b.adjClose,currency:company.currency||'USD',source:'Tiingo close'}); this.markFeedStatus(company.id,bars.length?'ok':'no_data'); obs=this.latestPrice(company.id); }
      catch(error){ if(error instanceof FeedError&&error.type==='NOT_FOUND') this.markFeedStatus(company.id,'not_found'); out.notes.push(`Tiingo price not collected: ${error.message}`); }
     } else out.notes.push('Tiingo price not collected: hourly or daily quota reached.');
    }
    if(obs){ const sid=addSource(tiingoSourceURL(this.symbolFor(company)),`Tiingo end-of-day price for ${this.symbolFor(company)}`); out.price={value:obs.close,currency:obs.currency,asOfDate:obs.date,asOfTime:'market close',sourceId:sid}; out.coverage.price=true; }
   } else if(!this.tiingoKey()) out.notes.push('No Tiingo key configured; the price comes from web research.');
   else out.notes.push('Listing not covered by Tiingo (non-US or unsupported); the price comes from web research.');
  } catch(error){ out.notes.push(`Price feed error: ${error.message}`); }
  // Financials: SEC EDGAR fiscal-year facts for US filers.
  try {
   if(p.assetType==='Company'){
    if(!this.edgarContact()) out.notes.push('No SEC EDGAR contact configured; financials come from web research.');
    else {
     const f=await this.edgarFinancials(company); out.requests+=f.requests||0;
     if(f.skipped) out.notes.push(`SEC EDGAR skipped: ${f.skipped}.`);
     else if(f.years?.length){
      const latest=f.years[0], facts=addSource(factsURL(f.cik),`SEC EDGAR XBRL company facts, CIK ${f.cik}${f.entityName?' ('+f.entityName+')':''}`);
      const filing=latest.accn?addSource(filingIndexURL(f.cik,latest.accn),`${latest.form||'Annual report'} for ${latest.periodLabel}, filed ${latest.filed||'date unknown'}`):null;
      const ids=[facts,...(filing?[filing]:[])];
      out.financials={periodLabel:latest.periodLabel,periodType:'FY',periodEndDate:latest.periodEndDate,basis:f.basis||'XBRL as filed',currency:f.currency,revenue:latest.revenue,ebitda:latest.ebitda,ebit:latest.ebit,netIncome:latest.netIncome,dilutedEPS:latest.dilutedEPS,operatingCashFlow:latest.operatingCashFlow,capitalExpenditure:latest.capitalExpenditure!==null?Math.abs(latest.capitalExpenditure):null,freeCashFlow:null,totalDebt:latest.totalDebt,cashAndEquivalents:latest.cashAndEquivalents,sourceIds:ids};
      out.history=f.years.slice(0,4).map(y=>({periodLabel:y.periodLabel,periodEndDate:y.periodEndDate,revenue:y.revenue,ebitda:y.ebitda,netIncome:y.netIncome,freeCashFlow:y.operatingCashFlow!==null&&y.capitalExpenditure!==null?y.operatingCashFlow-Math.abs(y.capitalExpenditure):null,sourceIds:[facts]})).reverse();
      if(f.sharesOutstanding) out.shares={basicOutstanding:f.sharesOutstanding.value,dilutedOutstanding:latest.dilutedShares,asOfDate:f.sharesOutstanding.asOf,basis:'Cover-page common shares outstanding (SEC filing); diluted = weighted-average diluted shares for the latest fiscal year',sourceId:facts};
      out.coverage.financials=true; out.notes.push(...(f.notes||[]).map(n=>`SEC EDGAR: ${n}`));
      if(latest.periodEndDate&&(Date.parse(asOf)-Date.parse(latest.periodEndDate))/86400000>400) out.notes.push(`SEC EDGAR: the latest full fiscal year on file ended ${latest.periodEndDate}; a newer annual report may not be processed yet.`);
     } else out.notes.push('SEC EDGAR returned no fiscal-year figures for this filer.');
    }
   }
  } catch(error){ out.notes.push(`SEC EDGAR not collected: ${error.message}`); }
  return out;
 }
}
// Merges feed-collected blocks into the model's snapshot draft. Feed values are authoritative where present; the model fills the rest.
export function mergeFeedDraft(draft,feed){
 if(!feed) return draft;
 const d=JSON.parse(JSON.stringify(draft));
 if(feed.price) d.price={...d.price,...feed.price};
 if(feed.shares) d.shares={basicOutstanding:feed.shares.basicOutstanding??d.shares.basicOutstanding,dilutedOutstanding:feed.shares.dilutedOutstanding??d.shares.dilutedOutstanding,asOfDate:feed.shares.asOfDate,basis:feed.shares.basis,sourceId:feed.shares.sourceId};
 if(feed.financials){ d.financials={...feed.financials}; }
 if(feed.history?.length){ d.history=feed.history; }
 if(feed.financials&&(d.marketCap?.value!=null||d.enterpriseValue?.value!=null)){ /* keep sourced market cap / EV from the model; the app cross-checks them */ }
 d.notes=[d.notes,...(feed.notes||[])].filter(Boolean).join(' ').slice(0,4000);
 return d;
}
// Short text for the model: what the feeds already supplied, so web searches go to what is missing.
export function feedSummary(feed){
 if(!feed||(!feed.coverage.price&&!feed.coverage.financials)) return null;
 const lines=[];
 if(feed.price) lines.push(`Share price ${feed.price.currency} ${feed.price.value} at the ${feed.price.asOfDate} close [${feed.price.sourceId}].`);
 if(feed.financials){ const f=feed.financials; lines.push(`Fiscal-year financials ${f.periodLabel} (ended ${f.periodEndDate}, ${f.basis}, ${f.currency}, full currency units): revenue ${f.revenue}; operating income ${f.ebit}; EBITDA ${f.ebitda}; net income ${f.netIncome}; diluted EPS ${f.dilutedEPS}; operating cash flow ${f.operatingCashFlow}; capex ${f.capitalExpenditure}; total debt ${f.totalDebt}; cash ${f.cashAndEquivalents} [${f.sourceIds.join(', ')}]. Prior fiscal years on file: ${feed.history.map(h=>h.periodLabel).join(', ')}.`); }
 if(feed.shares) lines.push(`Shares outstanding ${feed.shares.basicOutstanding} as of ${feed.shares.asOfDate} [${feed.shares.sourceId}].`);
 return lines.join('\n');
}
