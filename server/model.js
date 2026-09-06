import { z } from 'zod';
import { randomUUID } from 'node:crypto';

export const now = () => new Date().toISOString();
export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const id = () => randomUUID();
const text = z.string().max(20000);
const required = text.trim().min(1);
const ident = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Use a valid calendar date');
const timestamp = z.string().datetime({offset:true});
const optionalDate = date.nullable();
const currency = z.enum(Intl.supportedValuesOf('currency'));
const number = z.number().finite().min(-1e15).max(1e15);
const url = z.string().max(2000).refine(v => {try {const u = new URL(v); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password;} catch {return false;}}, 'Use an ordinary HTTP or HTTPS source URL');
export const sourceSchema = z.object({title:required, url:url.nullable(), publicationDate:optionalDate}).strict();
export const companyInput = z.object({ticker: z.string().trim().min(1).max(24).regex(/^[A-Za-z0-9.^-]+$/).transform(v=>v.toUpperCase()), name:required, exchange:text, currency:currency.nullable(), role:required, status:z.enum(['Researching','Watching','Passed']), thesis:text, risks:text, disconfirming:text, reviewDate:optionalDate, reviewTrigger:text}).strict();
const companyVersion = companyInput.extend({id:ident, revision:z.number().int().positive(), archivedAt:timestamp.nullable(), createdAt:timestamp, updatedAt:timestamp}).strict();
const companySchema = companyVersion.extend({history:z.array(companyVersion).max(10000)}).strict();
export const evidenceInput = z.object({note:required, source:sourceSchema, asOfDate:optionalDate, author:required, supersedesId:ident.nullable()}).strict();
const evidenceSchema = evidenceInput.extend({id:ident,companyId:ident,enteredAt:timestamp}).strict();
export const metricSchema = z.object({value:number.nullable(), unit:z.enum(['currency/share','currency','percent']), currency:currency.nullable(), period:required, basis:required, source:sourceSchema, kind:z.enum(['Observed','Analyst estimate','User assumption'])}).strict();
export const snapshotInput = z.object({quoteDate:date, quoteTime:text.refine(v=>v==='' || /^([01]\d|2[0-3]):[0-5]\d(?: [A-Za-z_\/+-]+)?$/.test(v),'Use HH:MM with an optional timezone'), currency, shareBasis:required, price:metricSchema, forwardEPS:metricSchema.nullable(), revenueGrowth:metricSchema.nullable(), operatingMargin:metricSchema.nullable(), debt:metricSchema.nullable(), cash:metricSchema.nullable(), freeCashFlow:metricSchema.nullable(), analystTarget:metricSchema.nullable(), supersedesId:ident.nullable()}).strict();
const snapshotSchema = snapshotInput.extend({id:ident, companyId:ident, enteredAt:timestamp, provenance:z.literal('Manual snapshot')}).strict();
const assumption = z.object({eps:number.nullable(), pe:number.nullable(), source:sourceSchema}).strict();
export const scenarioInput = z.object({referenceSnapshotId:ident, referenceDate:date, targetDate:date, epsPeriod:required, basis:required, currency, shareBasis:required, rationale:required, bear:assumption,base:assumption,bull:assumption,supersedesId:ident.nullable()}).strict();
const scenarioSchema = scenarioInput.extend({id:ident,companyId:ident,version:z.number().int().positive(),createdAt:timestamp,formulaVersion:z.literal(1)}).strict();
const result = z.object({price:number,priceReturn:number}).strict();
const resultsSchema = z.object({bear:result,base:result,bull:result}).strict().nullable();
const decisionBasis = z.object({company:companyVersion, evidence:z.array(evidenceSchema), snapshot:snapshotSchema.nullable(), scenario:scenarioSchema.nullable(), calculations:resultsSchema, formulaVersion:z.literal(1)}).strict();
export const decisionInput = z.object({action:z.enum(['Research','Watch','Pass','Revisit']),date, rationale:required,evidenceIds:z.array(ident),snapshotId:ident.nullable(),scenarioId:ident.nullable(),supersedesId:ident.nullable()}).strict();
const decisionSchema = decisionInput.extend({id:ident,companyId:ident,createdAt:timestamp,basis:decisionBasis}).strict();
export const workspaceSchema = z.object({schemaVersion:z.literal(1), companies:z.array(companySchema).max(2000), evidence:z.array(evidenceSchema).max(20000), snapshots:z.array(snapshotSchema).max(20000), scenarios:z.array(scenarioSchema).max(20000), decisions:z.array(decisionSchema).max(20000)}).strict();
export function fail(message,status=400) {throw Object.assign(new Error(message),{status});}
export function parse(schema, value) {const r=schema.safeParse(value); if(!r.success) fail(r.error.issues.slice(0,5).map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')); return r.data;}
export function pe(snapshot) {const p=snapshot?.price, e=snapshot?.forwardEPS; return p?.value>0 && e?.value>0 && p.currency===e.currency && p.unit===e.unit ? p.value/e.value : null;}
export function priceReturn(value,ref) {const r=(value/ref-1)*100; if(!Number.isFinite(r) || Math.abs(r)>1e15) fail('Calculation exceeds supported numeric range'); return r;}
export function results(scenario,snapshot) {
  if(!scenario || !snapshot || !(snapshot.price.value>0)) return null;
  if(scenario.currency!==snapshot.currency || scenario.shareBasis!==snapshot.shareBasis) fail('Scenario currency and share basis must match the reference snapshot');
  const out={};
  for(const label of ['bear','base','bull']) {const s=scenario[label]; if(!(s.eps>0) || !(s.pe>0)) return null; const price=s.eps*s.pe; if(!Number.isFinite(price) || price>1e15) fail('Implied price exceeds supported numeric range'); out[label]={price,priceReturn:priceReturn(price,snapshot.price.value)};}
  if(out.bear.price>out.base.price || out.base.price>out.bull.price) fail('Bear implied price must be ≤ base, and base ≤ bull. Correct assumptions before saving.');
  return out;
}
function validateSnapshot(s) {
  if(s.quoteDate>today()) fail('Future quote dates are invalid');
  if(!(s.price.value>0)) fail('Price must be greater than zero');
  if(s.price.kind!=='Observed') fail('Reference price must be labeled as an observed value');
  if(s.price.period!==s.quoteDate) fail('Price effective date must match quote date');
  for(const key of ['price','forwardEPS','revenueGrowth','operatingMargin','debt','cash','freeCashFlow','analystTarget']) {
    const m=s[key]; if(!m) continue;
    const unit=['revenueGrowth','operatingMargin'].includes(key)?'percent':['price','forwardEPS','analystTarget'].includes(key)?'currency/share':'currency';
    if(m.unit!==unit || (unit==='percent'? m.currency!==null : m.currency!==s.currency)) fail(`${key}: currency or unit does not match this snapshot`);
    if(key==='analystTarget' && m.value!==null && m.value<=0) fail('Analyst target must be positive');
  }
  if(s.analystTarget?.value>0) priceReturn(s.analystTarget.value,s.price.value);
  const ratio=pe(s); if(ratio!==null && (!Number.isFinite(ratio)||ratio>1e15)) fail('P/E exceeds supported numeric range');
}
function validateScenario(s, w) {
  const snapshot=w.snapshots.find(x=>x.id===s.referenceSnapshotId && x.companyId===s.companyId); if(!snapshot) fail('Reference snapshot does not belong to this company');
  if(s.targetDate<=s.referenceDate) fail('Target date must be after the reference date');
  if(s.currency!==snapshot.currency || s.shareBasis!==snapshot.shareBasis) fail('Currency and share basis must match the reference snapshot');
  for(const k of ['bear','base','bull']) if(s[k].pe!==null && s[k].pe<=0) fail(`${k}: P/E assumption must be positive`);
  results(s,snapshot);
}
export function companyCopy(c) {const {history,...v}=c; return structuredClone(v);}
export function validateWorkspace(input) {
  const w=parse(workspaceSchema,input), seen=new Set();
  for(const collection of ['companies','evidence','snapshots','scenarios','decisions']) for(const row of w[collection]) {
    if(seen.has(row.id)) fail('Duplicate record ID'); seen.add(row.id);
    if(collection!=='companies' && !w.companies.some(c=>c.id===row.companyId)) fail('Record references an unknown company');
    if(row.supersedesId && !w[collection].some(x=>x.id===row.supersedesId && x.companyId===row.companyId && x.id!==row.id)) fail('Invalid correction reference');
  }
  if(new Set(w.companies.map(c=>`${c.ticker}|${c.exchange}`)).size!==w.companies.length) fail('Duplicate ticker and exchange');
  for(const c of w.companies) {
    if(c.history.length!==c.revision-1 || c.history.some((h,i)=>h.id!==c.id||h.revision!==i+1)) fail('Invalid company revision history');
  }
  for(const collection of ['evidence','snapshots','scenarios','decisions']) {
    const prior=new Set(); for(const row of w[collection]) {if(row.supersedesId && !prior.has(row.supersedesId)) fail('Correction must reference an earlier record'); prior.add(row.id);}
  }
  w.snapshots.forEach(validateSnapshot);
  const versions=new Map();
  for(const s of w.scenarios) {const expected=(versions.get(s.companyId)||0)+1; if(s.version!==expected) fail('Invalid scenario version order'); versions.set(s.companyId,expected); validateScenario(s,w);}
  for(const d of w.decisions) {
    const c=w.companies.find(c=>c.id===d.companyId), matching=[...c.history,companyCopy(c)].find(x=>x.revision===d.basis.company.revision);
    if(JSON.stringify(matching)!==JSON.stringify(d.basis.company)) fail('Decision company evidence does not match its preserved revision');
    if(new Set(d.evidenceIds).size!==d.evidenceIds.length) fail('Duplicate evidence reference');
    const evidence=d.evidenceIds.map(i=>w.evidence.find(e=>e.id===i&&e.companyId===d.companyId));
    if(evidence.some(e=>!e)||JSON.stringify(evidence)!==JSON.stringify(d.basis.evidence)) fail('Invalid decision evidence');
    const snapshot=d.snapshotId?w.snapshots.find(s=>s.id===d.snapshotId&&s.companyId===d.companyId):null;
    const scenario=d.scenarioId?w.scenarios.find(s=>s.id===d.scenarioId&&s.companyId===d.companyId):null;
    if((d.snapshotId&&!snapshot)||(d.scenarioId&&!scenario)) fail('Invalid decision reference');
    if(scenario && scenario.referenceSnapshotId!==snapshot?.id) fail('Decision snapshot differs from its scenario reference');
    if(JSON.stringify(snapshot)!==JSON.stringify(d.basis.snapshot)||JSON.stringify(scenario)!==JSON.stringify(d.basis.scenario)||JSON.stringify(results(scenario,snapshot))!==JSON.stringify(d.basis.calculations)) fail('Decision basis or calculation mismatch');
  }
  return w;
}
export function mutate(w, action, payload) {
  if(!payload || typeof payload!=='object' || Array.isArray(payload)) fail('An object payload is required');
  const stamp=now();
  if(action==='company.create') {
    const c=parse(companyInput,payload); w.companies.push({...c,id:id(),revision:1,archivedAt:null,createdAt:stamp,updatedAt:stamp,history:[]});
  } else {
    const c=w.companies.find(c=>c.id===payload.companyId); if(!c) fail('Company not found',404);
    const {companyId,...input}=payload;
    if(action==='company.update' || action==='company.archive' || action==='company.restore') {
      const changes=action==='company.update'?parse(companyInput,input):{};
      if(action==='company.archive'&&input.confirm!==true) fail('Archive confirmation required');
      c.history.push(companyCopy(c)); Object.assign(c,changes,{revision:c.revision+1,updatedAt:stamp});
      if(action==='company.archive') c.archivedAt=stamp;
      if(action==='company.restore') c.archivedAt=null;
    } else if(action==='evidence.add') {
      w.evidence.push({...parse(evidenceInput,input),id:id(),companyId,enteredAt:stamp});
    } else if(action==='snapshot.add') {
      w.snapshots.push({...parse(snapshotInput,input),id:id(),companyId,enteredAt:stamp,provenance:'Manual snapshot'});
    } else if(action==='scenario.add' || action==='scenario.recalculate') {
      let s;
      if(action==='scenario.recalculate') {
        const old=w.scenarios.find(s=>s.id===input.scenarioId&&s.companyId===companyId); if(!old) fail('Scenario not found');
        const latest=w.snapshots.filter(s=>s.companyId===companyId).sort((a,b)=>a.quoteDate.localeCompare(b.quoteDate)||a.enteredAt.localeCompare(b.enteredAt)).at(-1); if(!latest) fail('Add a snapshot first');
        const {id:_,companyId:__,version,createdAt,formulaVersion,...rest}=old;
        s={...rest,referenceSnapshotId:latest.id,supersedesId:old.id};
      } else s=parse(scenarioInput,input);
      w.scenarios.push({...s,id:id(),companyId,version:w.scenarios.filter(s=>s.companyId===companyId).length+1,createdAt:stamp,formulaVersion:1});
    } else if(action==='decision.add') {
      const d=parse(decisionInput,input);
      const snapshot=d.snapshotId?w.snapshots.find(s=>s.id===d.snapshotId):null,scenario=d.scenarioId?w.scenarios.find(s=>s.id===d.scenarioId):null;
      w.decisions.push({...d,id:id(),companyId,createdAt:stamp,basis:{company:companyCopy(c),evidence:d.evidenceIds.map(i=>w.evidence.find(e=>e.id===i)),snapshot,scenario,calculations:results(scenario,snapshot),formulaVersion:1}});
    } else fail('Unknown action',404);
  }
  return validateWorkspace(w);
}
export function seed() {
  const w={schemaVersion:1,companies:[],evidence:[],snapshots:[],scenarios:[],decisions:[]};
  const rows=[
    ['ETN','Eaton','Power distribution, switchgear and backup power','Company products','https://www.eaton.com/us/en-us/catalog/low-voltage-power-distribution-controls-systems/modular-data-center.html'],
    ['VRT','Vertiv','Data-center power, cooling and racks','Company disclosures','https://investors.vertiv.com/news/default.aspx'],
    ['NVT','nVent','Electrical connection/protection and liquid cooling','Cooling expansion','https://investors.nvent.com/press-releases/press-release-details/2026/nVent-Expands-Data-Center-Liquid-Cooling-Capacity/default.aspx'],
    ['APH','Amphenol','Connectors and high-speed cable assemblies','Company products','https://www.amphenol.com/products'],
    ['PWR','Quanta Services','Grid connections, substations and electrical construction','Electric power','https://www.quantaservices.com/capabilities/electric-power'],
    ['FIX','Comfort Systems USA','Mechanical and electrical installation','Company overview','https://investors.comfortsystemsusa.com/'],
    ['ANET','Arista Networks','Data-center and AI networking','Company overview','https://investors.arista.com/Home/default.aspx?LanguageId=1']
  ];
  for(const [ticker,name,role,title,url] of rows) {
    const cid=id(),stamp=now();
    w.companies.push({id:cid,ticker,name,role,exchange:'',currency:null,status:'Researching',thesis:'',risks:'',disconfirming:'',reviewDate:null,reviewTrigger:'',revision:1,archivedAt:null,createdAt:stamp,updatedAt:stamp,history:[]});
    w.evidence.push({id:id(),companyId:cid,note:'Carried forward from planning discussion, September 6, 2026.',source:{title,url,publicationDate:null},asOfDate:null,author:'Planning discussion',supersedesId:null,enteredAt:stamp});
  }
  return validateWorkspace(w);
}
