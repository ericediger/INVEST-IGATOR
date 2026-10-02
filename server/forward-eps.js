import {z} from 'zod';
import {parse,fail} from './model.js';
const optionalText=z.string().trim().min(1).max(1500).nullable();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Invalid calendar date').nullable();
export const epsDraftSchema=z.object({
  value:z.number().finite().min(-1e9).max(1e9).nullable(),period:optionalText,periodEndDate:date,basis:optionalText,
  currency:z.enum(Intl.supportedValuesOf('currency')).nullable(),shareBasis:optionalText,
  kind:z.literal('Analyst estimate'),sourceId:optionalText,publicationDate:date,estimateAsOfDate:date,
  explanation:z.string().trim().min(1).max(4000),sourceExcerpt:optionalText,missingFields:z.array(z.string().max(500)).max(15)
}).strict();
const text={type:['string','null']};
const properties={value:{type:['number','null']},period:text,periodEndDate:text,basis:text,currency:text,shareBasis:text,kind:{type:'string',enum:['Analyst estimate']},sourceId:text,publicationDate:text,estimateAsOfDate:text,explanation:{type:'string'},sourceExcerpt:text,missingFields:{type:'array',items:{type:'string'}}};
export const EPS_JSON={type:'object',additionalProperties:false,properties,required:Object.keys(properties)};
export function validateEPSDraft(raw,sources,asOf){
 const draft=parse(epsDraftSchema,raw);
 const source=draft.sourceId?sources.find(s=>s.id===draft.sourceId):null;
 if(draft.sourceId&&!source)fail('The EPS draft cited a source that was not returned by research.',502);
 if(draft.value!==null&&(!source||!draft.sourceExcerpt))fail('The EPS value has no cited supporting passage. A value was not filled.',502);
 if(draft.publicationDate&&draft.publicationDate>asOf)fail('The source publication date is in the future.',502);
 if(draft.estimateAsOfDate&&draft.estimateAsOfDate>asOf)fail('The EPS estimate date is in the future.',502);
 if(draft.value!==null&&draft.periodEndDate&&draft.periodEndDate<=asOf)fail('The EPS period has already ended. A forward estimate is required.',502);
 const labels={value:'Forward EPS value',period:'Fiscal period',basis:'GAAP or adjusted basis',currency:'Currency',shareBasis:'Share basis',sourceId:'Source',publicationDate:'Source publication date',estimateAsOfDate:'Estimate as-of date'};
 const missing=new Set(draft.missingFields.map(field=>labels[field]||field));
 for(const [field,label] of Object.entries(labels))if(draft[field]===null)missing.add(label);
 const warnings=[];
 if(draft.estimateAsOfDate&&(Date.parse(asOf)-Date.parse(draft.estimateAsOfDate))/86400000>90)warnings.push('This estimate is more than 90 days old. Review whether it remains relevant.');
 if(!draft.shareBasis)warnings.push('The estimate’s share basis was not stated. Confirm it matches the snapshot before saving.');
 if(!draft.estimateAsOfDate)warnings.push('The estimate as-of date is unknown; its freshness has not been established.');
 return {...draft,source:source?{title:source.title,url:source.url,publicationDate:draft.publicationDate}:null,missingFields:[...missing],warnings,
  canFill:draft.value!==null&&!!draft.currency&&!!draft.period&&!!source};
}
export const EPS_SEARCH_PROMPT=`Research a forward earnings-per-share ANALYST ESTIMATE for the selected listed company. This task populates a financial snapshot form. Verify company identity, listing, currency and share basis. Prefer a directly published analyst consensus or estimate from a reputable financial data publisher. Look for an explicitly labeled fiscal year or next-twelve-month period, preferably consistent with the requested period. Distinguish FY estimates from NTM, GAAP from adjusted EPS, diluted/common shares from ADRs, and single analyst estimates from consensus. Company management guidance is not an analyst estimate; report it only as an excluded alternative. Historical actual EPS and inferred price/P-E ratios must not be used. Do not calculate, average ranges, annualize quarterly EPS, convert currency/ADR ratios, or derive an EPS estimate. If the cited source does not provide a usable point estimate, leave the value unavailable. Capture the exact value, period, period end date if provided, basis, currency, share basis, estimate as-of date, source publication date if known, and a short supporting passage (at most 25 words per source). Cite the supporting source with a clickable URL. Unknown fields/dates stay unknown. Do not use retrieval date as publication date. Do not claim a paywalled source was read. If sources disagree, explain the disagreement and why a particular estimate was selected; do not silently blend them.`;
