// Dispositions: one workflow state per company. The app derives it from the latest assessment; the owner can override it,
// and only the owner can mark a company Invested. Rows live in an additive SQLite table; the workspace document stays at schema 1.
import {z} from 'zod';
import {parse,fail} from './model.js';

export const DISPOSITIONS=['Research','Watch','Declined','Invested'];
export const APP_DISPOSITIONS=['Research','Watch','Declined']; // the app never sets Invested
export const RATING_MAP={Consider:'Watch',Watch:'Watch','Research further':'Research',Pass:'Declined'};
export const STATUS_MAP={Researching:'Research',Watching:'Watch',Passed:'Declined'};

// Missing or unknown ratings give Research, never Declined. Consider keeps a highlight so the stronger view stays visible.
export function dispositionForRating(rating){
 const disposition=RATING_MAP[rating]||'Research';
 return {disposition,highlight:rating==='Consider'?'Consider':null};
}
export function dispositionForStatus(status){ return STATUS_MAP[status]||'Research'; }

const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Use a valid calendar date');
const positive=z.number().finite().positive().max(1e15);
export const investedSchema=z.object({date,price:positive,currency:z.enum(Intl.supportedValuesOf('currency')),amount:positive.nullable().default(null),quantity:positive.nullable().default(null),note:z.string().trim().max(2000).default('')}).strict();
export const overrideSchema=z.object({companyId:z.string().uuid(),disposition:z.enum(['auto',...DISPOSITIONS]),note:z.string().trim().max(2000).default(''),invested:investedSchema.nullable().default(null)}).strict();

export function parseOverride(value,today){
 const o=parse(overrideSchema,value);
 if(o.disposition==='Invested'){
  if(!o.invested) fail('Marking a company Invested needs the entry date and the entry price.');
  if(o.invested.date>today) fail('The entry date cannot be in the future.');
 } else if(o.invested) fail('Entry details apply only when marking a company Invested.');
 return o;
}
