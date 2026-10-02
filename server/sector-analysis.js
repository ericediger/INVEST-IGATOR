// Sector analysis: company discovery, peer comparison context and ranked recommendation validation.
import {z} from 'zod';
import {parse,fail} from './model.js';
import {snapshotSummary} from './financial-snapshot.js';
import {clampOutput} from './bounds.js';

const CURRENCIES=new Set(Intl.supportedValuesOf('currency'));
const DISCOVERY_BOUNDS={arrays:{candidates:60,excluded:60,sourceIds:20},strings:{sectorDefinition:2000,relevance:1500,notes:3000,name:200,ticker:24,exchange:300,listingCountry:300,quoteCurrency:300,marketCapCurrency:300,reason:500}};
const COMPARISON_BOUNDS={arrays:{ranking:50,keyEvidence:6,catalysts:6,risks:8,invalidation:6,dataLimitations:8,sectorRisks:8,assumptions:10,caveats:10,sourceIds:30},strings:{text:3000,ticker:24,catalysts:1000,risks:1000,invalidation:1000,dataLimitations:1000,sectorRisks:1000,assumptions:1000,caveats:1000}};
export const RATINGS=['Consider','Watch','Pass','Research further'];
export const CONFIDENCE=['Low','Moderate','High'];
const TICKER=/^[A-Za-z0-9.^-]+$/;
export const analysisInputSchema=z.object({
 sector:z.string().trim().min(2).max(160),
 seedCompanies:z.array(z.string().trim().min(1).max(80)).max(10).default([]),
 criteria:z.string().trim().max(2000).default(''),
 maxCompanies:z.number().int().min(2).max(10).optional()
}).strict();
export function parseSeeds(text){ return [...new Set(String(text||'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean))].slice(0,10); }

const str=z.string().max(300).nullable();
const ids=z.array(z.string().max(20)).max(20);
export const discoverySchema=z.object({
 sectorDefinition:z.string().trim().min(1).max(2000),
 candidates:z.array(z.object({name:z.string().trim().min(1).max(200),ticker:z.string().trim().min(1).max(24),exchange:str,listingCountry:str,quoteCurrency:str,securityType:z.enum(['Common','ADR','GDR','Other']),relevance:z.string().max(1500),approximateMarketCap:z.number().finite().nullable(),marketCapCurrency:str,isSeed:z.boolean(),confidence:z.enum(CONFIDENCE),sourceIds:ids}).strict()).max(60),
 excluded:z.array(z.object({name:z.string().max(200),reason:z.string().max(500)}).strict()).max(60),
 notes:z.string().max(3000)
}).strict();
const S={type:['string','null']},IDS={type:'array',items:{type:'string'}};
const obj=props=>({type:'object',additionalProperties:false,properties:props,required:Object.keys(props)});
export const DISCOVERY_JSON=obj({
 sectorDefinition:{type:'string'},
 candidates:{type:'array',items:obj({name:{type:'string'},ticker:{type:'string'},exchange:S,listingCountry:S,quoteCurrency:S,securityType:{type:'string',enum:['Common','ADR','GDR','Other']},relevance:{type:'string'},approximateMarketCap:{type:['number','null']},marketCapCurrency:S,isSeed:{type:'boolean'},confidence:{type:'string',enum:CONFIDENCE},sourceIds:IDS})},
 excluded:{type:'array',items:obj({name:{type:'string'},reason:{type:'string'}})},
 notes:{type:'string'}
});
export const DISCOVERY_SEARCH_PROMPT=`Identify the publicly traded companies that an investor should compare when researching the given sector or industry. Use web search. Define the sector boundary in one or two sentences. Include every company the owner named (resolve names to their primary listing ticker and exchange). Then add the most relevant additional listed companies: pure plays first, then large diversified companies where the sector is a material business. Prefer primary listings; note ADR/GDR alternatives only as secondary information. Exclude ETFs, funds, private companies, SPACs and companies with no current listing. For each candidate give the legal name, ticker symbol as used on its primary exchange, exchange, listing country, quote currency, why it is relevant, an approximate market capitalization with its currency and date if a source states it, and a clickable citation. Apply the owner's criteria or constraints as data (for example geography, size, sub-segment). Order by relevance and fit with the criteria. State uncertainty about identities or listings rather than guessing.`;

export function validateDiscovery(raw,sources,{seeds,maxCompanies,existing}){
 const notes=[], d=parse(discoverySchema,clampOutput(raw,DISCOVERY_BOUNDS,notes)), allowed=new Set(sources.map(s=>s.id)), seen=new Set(), candidates=[], dropped=[];
 const norm=t=>String(t||'').trim().toUpperCase();
 // A seed matches a candidate by ticker, by name (either containing the other, so “Rheinmetall” matches “Rheinmetall AG”) or through the workspace company it maps to.
 const matchesSeed=(c,s)=>{const k=norm(s),n=norm(c.name);if(!k)return false;return norm(c.ticker)===k||n===k||n.includes(k)||k.includes(n)||(c.companyId&&existing.some(e=>e.id===c.companyId&&(norm(e.ticker)===k||norm(e.name)===k)));};
 for(const c of d.candidates){
  const ticker=norm(c.ticker).replace(/\s+/g,'-'); // share-class tickers such as “SAAB B” become SAAB-B
  if(!TICKER.test(ticker)||ticker.length>24){dropped.push({name:c.name,reason:`Unusable ticker “${c.ticker}”`});continue;}
  if(seen.has(ticker)){continue;}
  seen.add(ticker);
  const currency=c.quoteCurrency?c.quoteCurrency.trim().toUpperCase():null;
  const match=existing.find(e=>e.ticker===ticker)||existing.find(e=>e.name.trim().toLowerCase()===c.name.trim().toLowerCase());
  const entry={name:c.name.trim(),ticker,exchange:c.exchange?c.exchange.trim():'',listingCountry:c.listingCountry,quoteCurrency:currency&&CURRENCIES.has(currency)?currency:null,securityType:c.securityType,relevance:c.relevance,approximateMarketCap:c.approximateMarketCap,marketCapCurrency:c.marketCapCurrency,isSeed:false,confidence:c.confidence,sourceIds:c.sourceIds.filter(i=>allowed.has(i)),companyId:match?.id||null,existing:!!match,archived:!!match?.archivedAt};
  entry.isSeed=c.isSeed||seeds.some(s=>matchesSeed(entry,s));
  candidates.push(entry);
 }
 // Every owner-supplied seed must survive discovery; unresolved seeds are reported instead of silently dropped.
 const unresolved=()=>seeds.filter(s=>!candidates.some(c=>c.isSeed&&matchesSeed(c,s)));
 for(const s of unresolved()){ const match=existing.find(e=>norm(e.ticker)===norm(s)||norm(e.name)===norm(s)); if(match&&!seen.has(match.ticker)){seen.add(match.ticker);candidates.unshift({name:match.name,ticker:match.ticker,exchange:match.exchange||'',listingCountry:null,quoteCurrency:match.currency,securityType:'Common',relevance:'Named by the owner; already in the workspace.',approximateMarketCap:null,marketCapCurrency:null,isSeed:true,confidence:'Moderate',sourceIds:[],companyId:match.id,existing:true,archived:!!match.archivedAt});} }
 const stillUnresolved=unresolved();
 const active=candidates.filter(c=>!c.archived), archivedSeeds=candidates.filter(c=>c.archived&&c.isSeed);
 if(archivedSeeds.length) fail(`Restore ${archivedSeeds.map(c=>c.ticker).join(', ')} before including it in a sector analysis.`,409);
 for(const c of candidates.filter(c=>c.archived)) dropped.push({name:c.name,reason:'Archived in the workspace; restore it to include it.'});
 const order=[...active.filter(c=>c.isSeed),...active.filter(c=>!c.isSeed)];
 const selected=order.slice(0,maxCompanies), overflow=order.slice(maxCompanies);
 for(const c of overflow) dropped.push({name:`${c.name} (${c.ticker})`,reason:`Beyond the ${maxCompanies}-company limit for this analysis.`});
 if(!selected.length) fail('Discovery did not return any usable listed companies. Refine the sector description or name a company.',502);
 return {sectorDefinition:d.sectorDefinition,candidates:selected,excluded:[...d.excluded,...dropped],unresolvedSeeds:stillUnresolved,notes:[d.notes,...notes].filter(Boolean).join(' ')};
}

const paragraph=z.object({text:z.string().trim().min(1).max(3000),sourceIds:z.array(z.string()).max(30)}).strict();
const strings=z.array(z.string().max(1000));
export const comparisonSchema=z.object({
 sectorSummary:paragraph,
 ranking:z.array(z.object({ticker:z.string().max(24),rank:z.number().int().min(1).max(50),rating:z.enum(RATINGS),thesis:paragraph,keyEvidence:z.array(paragraph).max(6),valuation:paragraph,relativeAttractiveness:paragraph,catalysts:strings.max(6),risks:strings.max(8),invalidation:strings.max(6),confidence:z.enum(CONFIDENCE),dataLimitations:strings.max(8)}).strict()).max(50),
 preferredRationale:paragraph,
 sectorRisks:strings.max(8),
 assumptions:strings.max(10),
 caveats:strings.max(10)
}).strict();
const paraJSON=obj({text:{type:'string'},sourceIds:IDS});
export const COMPARISON_JSON=obj({
 sectorSummary:paraJSON,
 ranking:{type:'array',items:obj({ticker:{type:'string'},rank:{type:'integer'},rating:{type:'string',enum:RATINGS},thesis:paraJSON,keyEvidence:{type:'array',items:paraJSON},valuation:paraJSON,relativeAttractiveness:paraJSON,catalysts:IDS,risks:IDS,invalidation:IDS,confidence:{type:'string',enum:CONFIDENCE},dataLimitations:IDS})},
 preferredRationale:paraJSON,
 sectorRisks:IDS,assumptions:IDS,caveats:IDS
});
export const COMPARISON_PROMPT=`Compare the analyzed companies and produce a ranked sector recommendation. Use ONLY the company research, assessments and app-normalized financial snapshots supplied below as evidence; do not introduce new facts. Cite with source IDs from the registry only. Rank every analyzed company exactly once from most to least attractive over the mandate horizon, applying the owner's criteria as data. For each company give: rating (Consider = supported opportunity with a recent dated price and app-computed valuation evidence; Watch = promising but conditions unmet; Pass = unattractive on evidence; Research further = insufficient evidence), a thesis, key supporting evidence, a valuation view that quotes the app-computed multiples with their dates and periods, relative attractiveness versus the peers, material catalysts, key risks, what would invalidate the thesis, confidence in the evidence, and material data limitations (stale prices, missing figures, currency or period inconsistencies). Explain why the preferred companies rank above the alternatives. Comparisons across companies must respect the snapshot data-quality notes: do not compare absolute figures across different currencies; note when period types (fiscal year vs trailing twelve months) differ; treat derived values as derived. Never invent prices, targets or returns. This assesses company merits, not personal suitability.`;

const compactReport=(r,map)=>{ if(!r) return null; const p=v=>({text:v.text,sourceIds:v.sourceIds.map(i=>map.get(i)).filter(Boolean)}); return {recommendation:r.recommendation,evidenceConfidence:r.evidenceConfidence,summary:p(r.summary),rationale:p(r.rationale),businessQuality:p(r.businessQuality),financialAssessment:p(r.financialAssessment),valuationAssessment:p(r.valuationAssessment),bullCase:r.bullCase.map(p),bearCase:r.bearCase.map(p),catalysts:(r.catalysts||[]).map(p),assumptions:r.assumptions,missingEvidence:r.missingEvidence,invalidationTriggers:r.invalidationTriggers}; };
// Builds the comparison input: one shared source registry (A1..An) and each company's report/snapshot remapped onto it.
export function comparisonContext(companies){
 const registry=[], byUrl=new Map(), rows=[], caveats=[];
 for(const c of companies){
  const map=new Map();
  for(const s of c.sources||[]){ let g=byUrl.get(s.url); if(!g){g={id:`A${registry.length+1}`,url:s.url,title:s.title};registry.push(g);byUrl.set(s.url,g);} map.set(s.id,g.id); }
  const remapSnapshot=s=>{ if(!s) return null; const j=JSON.parse(JSON.stringify(s)); const walk=o=>{for(const k of Object.keys(o)){const v=o[k];if(k==='sourceId'&&typeof v==='string')o[k]=map.get(v)||null;else if(k==='sourceIds'&&Array.isArray(v))o[k]=v.map(i=>map.get(i)).filter(Boolean);else if(v&&typeof v==='object')walk(v);}}; walk(j); return j; };
  const snapshot=remapSnapshot(c.snapshot);
  rows.push({companyId:c.companyId,ticker:c.ticker,name:c.name,runId:c.runId,report:compactReport(c.report,map),snapshot,snapshotSummary:snapshotSummary(snapshot),sourceMap:Object.fromEntries(map)});
 }
 const withSnap=rows.filter(r=>r.snapshot);
 const periodTypes=new Set(withSnap.map(r=>r.snapshot.financials.periodType).filter(t=>t&&t!=='Unknown'));
 if(periodTypes.size>1) caveats.push(`Peer financials mix period types: ${withSnap.map(r=>`${r.ticker} (${r.snapshot.financials.periodType})`).join(', ')}. Multiples are internally consistent per company but not strictly like-for-like across companies.`);
 const currencies=new Set(withSnap.map(r=>r.snapshot.financials.currency).filter(Boolean));
 if(currencies.size>1) caveats.push(`Absolute figures are in each company's reporting currency (${[...currencies].join(', ')}) and were not converted. Compare multiples, margins and growth rather than absolute amounts.`);
 const stale=withSnap.filter(r=>r.snapshot.quality.priceAgeDays===null||r.snapshot.quality.priceAgeDays>7).map(r=>r.ticker);
 if(stale.length) caveats.push(`Share prices older than 7 days or undated: ${stale.join(', ')}.`);
 const notComparable=withSnap.filter(r=>!r.snapshot.quality.comparable).map(r=>r.ticker);
 if(notComparable.length) caveats.push(`Snapshots not fully comparable (missing price, revenue or currency, or suspected scaled units): ${notComparable.join(', ')}.`);
 const noSnapshot=rows.filter(r=>!r.snapshot).map(r=>r.ticker);
 if(noSnapshot.length) caveats.push(`No financial snapshot was collected for: ${noSnapshot.join(', ')}.`);
 return {companies:rows,registry,caveats};
}

export function validateComparison(raw,registry,companies){
 const notes=[], report=parse(comparisonSchema,clampOutput(raw,COMPARISON_BOUNDS,notes)), allowed=new Set(registry.map(s=>s.id));
 report.caveats=[...report.caveats,...notes.map(n=>`Model output bounded: ${n}`)].slice(0,20);
 const paragraphs=[report.sectorSummary,report.preferredRationale,...report.ranking.flatMap(r=>[r.thesis,r.valuation,r.relativeAttractiveness,...r.keyEvidence])];
 for(const p of paragraphs) p.sourceIds=p.sourceIds.filter(i=>allowed.has(i));
 const byTicker=new Map(companies.map(c=>[c.ticker.toUpperCase(),c])), seen=new Set(), ranking=[];
 for(const r of [...report.ranking].sort((a,b)=>a.rank-b.rank)){
  const key=r.ticker.trim().toUpperCase(), company=byTicker.get(key); if(!company||seen.has(key)) continue; seen.add(key);
  const s=company.snapshot, limitations=[...r.dataLimitations];
  let rating=r.rating;
  if(rating==='Consider'&&!(s&&s.quality.freshPrice&&s.quality.hasValuationMultiple)){ rating='Research further'; limitations.unshift('Consider requires a share price no more than 7 days old and at least one app-computed valuation multiple; the rating was downgraded to Research further.'); }
  if(!r.thesis.sourceIds.length&&!r.keyEvidence.some(k=>k.sourceIds.length)) limitations.unshift('The comparison did not cite sources for this company; treat the ranking rationale as unsupported.');
  ranking.push({...r,ticker:company.ticker,companyId:company.companyId,runId:company.runId,name:company.name,rating,requestedRating:r.rating,dataLimitations:limitations});
 }
 for(const c of companies) if(!seen.has(c.ticker.toUpperCase())) ranking.push({ticker:c.ticker,companyId:c.companyId,runId:c.runId,name:c.name,rank:ranking.length+1,rating:'Research further',requestedRating:null,thesis:{text:'The comparison stage did not rank this company.',sourceIds:[]},keyEvidence:[],valuation:{text:'Not compared.',sourceIds:[]},relativeAttractiveness:{text:'Not compared.',sourceIds:[]},catalysts:[],risks:[],invalidation:[],confidence:'Low',dataLimitations:['The comparison omitted this company; no ranking rationale was produced.']});
 if(!ranking.length) fail('The comparison did not rank any analyzed company. Start a new analysis to retry.',502);
 ranking.forEach((r,i)=>{r.rank=i+1;});
 if(!report.sectorSummary.sourceIds.length&&!ranking.some(r=>r.thesis.sourceIds.length)) fail('The comparison cited no sources from the collected research. Start a new analysis to retry.',502);
 return {...report,ranking};
}
