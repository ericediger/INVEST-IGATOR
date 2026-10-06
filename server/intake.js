// Company intake: resolve owner-typed names or tickers to verified primary listings (web search → strict JSON), validated locally.
// The model identifies listings and cites them; the app normalizes tickers, checks currencies, matches the workspace and decides
// whether an entry is resolved, needs the owner's choice, or could not be verified. Nothing is created from an unverified guess.
import {z} from 'zod';
import {parse} from './model.js';
import {clampOutput} from './bounds.js';

const CURRENCIES=new Set(Intl.supportedValuesOf('currency'));
const TICKER=/^[A-Za-z0-9.^-]+$/;
export const INTAKE_STATUSES=['resolved','ambiguous','unresolved','not_a_company'];
const CONFIDENCE=['Low','Moderate','High'];
const SECURITY_TYPES=['Common','ADR','GDR','Other'];
const BOUNDS={arrays:{entries:20,candidates:8,sourceIds:20},strings:{query:200,name:200,ticker:24,exchange:300,listingCountry:300,quoteCurrency:300,description:600,notes:1500}};
const str=z.string().max(300).nullable();
const candidateSchema=z.object({name:z.string().trim().min(1).max(200),ticker:z.string().trim().min(1).max(24),exchange:str,listingCountry:str,quoteCurrency:str,securityType:z.enum(SECURITY_TYPES),description:z.string().max(600),confidence:z.enum(CONFIDENCE),sourceIds:z.array(z.string().max(20)).max(20)}).strict();
export const intakeDraftSchema=z.object({entries:z.array(z.object({query:z.string().max(200),status:z.enum(INTAKE_STATUSES),candidates:z.array(candidateSchema).max(8),notes:z.string().max(1500)}).strict()).max(20)}).strict();
const S={type:['string','null']};
const obj=props=>({type:'object',additionalProperties:false,properties:props,required:Object.keys(props)});
export const INTAKE_JSON=obj({entries:{type:'array',items:obj({query:{type:'string'},status:{type:'string',enum:INTAKE_STATUSES},candidates:{type:'array',items:obj({name:{type:'string'},ticker:{type:'string'},exchange:S,listingCountry:S,quoteCurrency:S,securityType:{type:'string',enum:SECURITY_TYPES},description:{type:'string'},confidence:{type:'string',enum:CONFIDENCE},sourceIds:{type:'array',items:{type:'string'}}})},notes:{type:'string'}})}});

export const INTAKE_SEARCH_PROMPT=`Identify the primary public stock-market listing for each company name or ticker symbol the owner entered. Use web search. For each entry report: the legal company name; the ticker symbol as used on its primary exchange; the exchange; the listing country; the quote currency; the security type (Common, ADR, GDR or Other); one sentence on what the company does; and how confident you are that this is the company the owner meant. If an entry could refer to more than one listed company (the same name in different countries, several share classes, a parent and a listed subsidiary), list each possibility separately and say the entry is ambiguous. If the entry is a fund, ETF, index, private company or has no current listing, say so. Prefer primary listings over ADRs or secondary listings and mention an ADR only as an alternative. Cite a source for each identification. Never guess a ticker or exchange: if a listing cannot be verified, say the entry is unresolved.`;
export const INTAKE_EXTRACT_PROMPT=`Extract the listing resolution for each owner entry from the research below into the schema. Keep the owner's entries in order and copy the exact text of each entry into query. Status: resolved when exactly one listed company clearly matches; ambiguous when more than one could match or the identification is uncertain; unresolved when no current listing could be verified; not_a_company for funds, ETFs, indexes or private companies. Order candidates with the recommended primary listing first. Use sourceIds from the registry only. Unknown fields are null; never guess tickers, exchanges or currencies.`;

export function parseEntries(text){ return [...new Set(String(text||'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean))].slice(0,10); }

// Validates the model's resolution against the owner's entries and the workspace. Every entry the owner typed gets a result.
export function validateIntake(raw,sources,{queries,existing}){
 const notes=[], d=parse(intakeDraftSchema,clampOutput(raw,BOUNDS,notes)), allowed=new Set(sources.map(s=>s.id));
 const norm=t=>String(t||'').trim().toUpperCase();
 const byQuery=new Map(d.entries.map(e=>[norm(e.query),e]));
 return queries.map(query=>{
  const e=byQuery.get(norm(query))||d.entries.find(x=>norm(x.query)&&(norm(x.query).includes(norm(query))||norm(query).includes(norm(x.query))));
  if(!e) return {query,status:'unresolved',match:null,candidates:[],notes:'The listing search returned no result for this entry.',existingCompanyId:null};
  const seen=new Set(), dropped=[], candidates=[];
  for(const c of e.candidates){
   const ticker=norm(c.ticker).replace(/\s+/g,'-');
   if(!TICKER.test(ticker)){dropped.push(`“${c.ticker}” is not a usable ticker.`);continue;}
   if(seen.has(ticker)) continue; seen.add(ticker);
   const currency=c.quoteCurrency?norm(c.quoteCurrency):null;
   const match=existing.find(x=>x.ticker===ticker)||existing.find(x=>x.name.trim().toLowerCase()===c.name.trim().toLowerCase());
   candidates.push({name:c.name.trim(),ticker,exchange:c.exchange?c.exchange.trim():'',listingCountry:c.listingCountry,quoteCurrency:currency&&CURRENCIES.has(currency)?currency:null,securityType:c.securityType,description:c.description.trim(),confidence:c.confidence,sourceIds:c.sourceIds.filter(i=>allowed.has(i)),existingCompanyId:match?.id||null,archived:!!match?.archivedAt});
  }
  const extra=[e.notes,...dropped,...notes].filter(Boolean).join(' ');
  if(e.status==='not_a_company') return {query,status:'not_a_company',match:null,candidates,notes:extra||'Not a listed operating company (a fund, index or private company).',existingCompanyId:null};
  if(!candidates.length) return {query,status:'unresolved',match:null,candidates:[],notes:extra||'No current listing could be verified.',existingCompanyId:null};
  const first=candidates[0];
  if(e.status==='resolved'&&first.confidence!=='Low') return {query,status:first.existingCompanyId?'existing':'resolved',match:first,candidates,notes:extra,existingCompanyId:first.existingCompanyId};
  return {query,status:'ambiguous',match:null,candidates,notes:extra||'More than one listing could match; choose one.',existingCompanyId:null};
 });
}
export function intakeStage(resolution){
 const n=k=>resolution.entries.filter(e=>e.status===k).length, parts=[];
 const pending=n('pending'); if(pending) parts.push(`${pending} to verify`);
 const found=n('resolved')+n('existing'); if(found) parts.push(`${found} ${found===1?'company':'companies'} identified`);
 const amb=resolution.entries.filter(e=>e.status==='ambiguous'&&!e.outcome).length; if(amb) parts.push(`${amb} need${amb===1?'s':''} your choice`);
 const no=n('unresolved')+n('not_a_company')+resolution.entries.filter(e=>e.status==='ambiguous'&&e.outcome).length; if(no) parts.push(`${no} not added`);
 return parts.join(' · ')||'Nothing to add';
}
