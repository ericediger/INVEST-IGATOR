// Bounded live integration check: one financial snapshot (ETN) and one sector discovery in an isolated database.
// At most four provider requests; production data is never read or written.
import {mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {Store} from '../server/store.js';
import {ResearchService} from '../server/research.js';
import {OpenAIResearchProvider,readAPIKey} from '../server/research-provider.js';
import {today} from '../server/model.js';
const configuredDir=join(homedir(),'Library/Application Support/InvestmentResearch');
const provider=new OpenAIResearchProvider({key:()=>readAPIKey(configuredDir)});
if(!provider.configured())throw new Error('No configured API key; live check was not run.');
const dir=mkdtempSync(join(tmpdir(),'research-live-sector-check-'));
const store=new Store(join(dir,'research.sqlite'),join(dir,'backups')),ai=new ResearchService(store,provider,{concurrency:2});
const sector=process.argv[2]||'European defense', seed=process.argv[3]||'Rheinmetall', mode=process.argv[4]||'both';
const cid=store.read().workspace.companies.find(c=>c.ticker==='ETN').id;
const snapshotRun=mode!=='discovery'?ai.enqueue({companyId:cid,kind:'snapshot'}):null;
const discovery=mode!=='snapshot'?ai.enqueueRun({kind:'discovery',context:{analysis:{id:'live-check',sector,seedCompanies:[seed],criteria:'Primary listings only.',maxCompanies:6},existingCompanies:[]}}):null;
ai.drain();
console.log(JSON.stringify({status:'started',model:provider.model,reasoningEffort:provider.reasoningEffort,maximumProviderRequests:mode==='both'?4:2,productionModified:false,sector,seed,mode}));
const seen={};
const wait=async id=>{if(!id)return null;for(;;){const r=ai.read(id);if(seen[id]!==r.stage){seen[id]=r.stage;console.log(JSON.stringify({run:r.kind,stage:r.stage}));}if(!['queued','running'].includes(r.status))return r;await new Promise(res=>setTimeout(res,1000));}};
try{
 const [snap,disc]=await Promise.all([wait(snapshotRun?.id),wait(discovery?.id)]);
 const s=snap?.snapshot||null;
 const result={model:provider.model,reasoningEffort:provider.reasoningEffort,asOf:today(),productionModified:false,
  snapshot:!snap?null:{status:snap.status,error:snap.error,stage:snap.stage,usage:snap.usage,sources:snap.sources,snapshotResearch:snap.snapshotResearch||null,result:s?{identity:s.identity,price:s.price,shares:s.shares,marketCap:s.marketCap,enterpriseValue:s.enterpriseValue,financials:s.financials,growth:s.growth,history:s.history,consensus:s.consensus,operatingMetrics:s.operatingMetrics,derived:s.derived,quality:s.quality,notes:s.notes}:null},
  discovery:!disc?null:{status:disc.status,error:disc.error,stage:disc.stage,usage:disc.usage,sources:disc.sources,result:disc.discovery?{sectorDefinition:disc.discovery.sectorDefinition,candidates:disc.discovery.candidates.map(c=>({name:c.name,ticker:c.ticker,exchange:c.exchange,listingCountry:c.listingCountry,quoteCurrency:c.quoteCurrency,securityType:c.securityType,isSeed:c.isSeed,confidence:c.confidence,relevance:c.relevance})),excluded:disc.discovery.excluded,unresolvedSeeds:disc.discovery.unresolvedSeeds,notes:disc.discovery.notes}:null}};
 writeFileSync('verification/live-sector-'+provider.model+(mode==='both'?'':'-'+mode)+'.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({snapshot:!snap?null:{status:snap.status,error:snap.error,comparable:s?.quality.comparable,warnings:s?.quality.warnings,missing:s?.quality.missing,price:s?.price,marketCap:s?.marketCap.value,multiples:s?.derived.multiples},discovery:!disc?null:{status:disc.status,error:disc.error,candidates:disc.discovery?.candidates.map(c=>`${c.ticker} (${c.exchange}, ${c.quoteCurrency}${c.isSeed?', seed':''})`),unresolvedSeeds:disc.discovery?.unresolvedSeeds},tokens:[...(snap?.usage||[]),...(disc?.usage||[])].reduce((n,u)=>n+u.inputTokens+u.outputTokens,0)}));
 if((snap&&snap.status!=='completed')||(disc&&disc.status!=='completed'))process.exitCode=1;
}finally{ai.close();store.close();}
