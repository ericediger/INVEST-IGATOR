import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateEPSDraft} from '../server/forward-eps.js';
import {Store} from '../server/store.js';
import {ResearchService} from '../server/research.js';
const sources=[{id:'S1',url:'https://example.com/estimates',title:'SYNTHETIC estimate source'}];
const draft=()=>({value:7.25,period:'FY 2027 analyst consensus',periodEndDate:'2027-12-31',basis:'Adjusted diluted EPS',currency:'USD',shareBasis:'Diluted common share',kind:'Analyst estimate',sourceId:'S1',publicationDate:null,estimateAsOfDate:null,explanation:'SYNTHETIC TEST FIXTURE only.',sourceExcerpt:'FY 2027 adjusted diluted EPS consensus is USD 7.25 per share.',missingFields:[]});
test('EPS draft keeps exact source metadata, nullable publication dates and analyst provenance',()=>{
 const d=validateEPSDraft(draft(),sources,'2026-09-07');assert.equal(d.value,7.25);assert.equal(d.source.url,sources[0].url);assert.equal(d.source.title,sources[0].title);assert.equal(d.source.publicationDate,null);assert.equal(d.kind,'Analyst estimate');assert.equal(d.canFill,true);assert.ok(d.missingFields.includes('Source publication date'));assert.ok(d.warnings.some(w=>w.includes('unknown')));
});
test('unknown basis stays blank; negative and zero estimates remain valid',()=>{
 for(const value of [-2.5,0]){const d=validateEPSDraft({...draft(),value,basis:null},sources,'2026-09-07');assert.equal(d.value,value);assert.equal(d.canFill,true);assert.equal(d.basis,null);}
});
test('invented sources, unsupported estimate kinds and impossible dates are rejected',()=>{
 for(const fields of [{sourceId:'S99'},{sourceExcerpt:null},{kind:'Observed'},{kind:'Company guidance'},{publicationDate:'2028-01-01'},{estimateAsOfDate:'2026-02-30'},{periodEndDate:'2025-12-31'},{currency:'ZZZ'},{value:Infinity}])assert.throws(()=>validateEPSDraft({...draft(),...fields},sources,'2026-09-07'));
});
test('missing value or units cannot fill a form; stale estimates are called out',()=>{
 for(const fields of [{value:null,sourceId:null,sourceExcerpt:null},{currency:null},{period:null}])assert.equal(validateEPSDraft({...draft(),...fields},sources,'2026-09-07').canFill,false);
 assert.equal(validateEPSDraft({...draft(),shareBasis:null},sources,'2026-09-07').canFill,true);
 const d=validateEPSDraft({...draft(),estimateAsOfDate:'2026-01-01'},sources,'2026-09-07');assert.ok(d.warnings.some(w=>w.includes('90 days')));
});
test('two-stage EPS research persists a draft, captures requested fields, and makes no workspace writes',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'eps-research-test-')),store=new Store(join(dir,'research.sqlite'),join(dir,'backups'));let calls=[];
 const provider={model:'SYNTHETIC',configured:()=>true,async request(input){calls.push(input);return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:input.schema?JSON.stringify(draft()):'SYNTHETIC source evidence',annotations:input.schema?[]:[{type:'url_citation',url:sources[0].url,title:sources[0].title}]}]}]};}};
 const ai=new ResearchService(store,provider);t.after(()=>{ai.close();store.close();});
 const before=store.read(),run=ai.enqueue({companyId:before.workspace.companies[0].id,kind:'forward_eps',metricRequest:{currency:'USD',shareBasis:'Diluted common share',period:'FY 2027'}});
 for(let i=0;i<100&&['running','queued'].includes(ai.read(run.id).status);i++)await new Promise(r=>setTimeout(r,5));
 const saved=ai.read(run.id);assert.equal(saved.status,'completed');assert.equal(saved.epsDraft.value,7.25);assert.equal(saved.epsDraft.publicationDate,null);assert.equal(calls.length,2);assert.equal(calls[0].search,true);assert.ok(calls[1].schema.properties.value);assert.equal(saved.metricRequest.period,'FY 2027');assert.deepEqual(store.read(),before);assert.equal(ai.export().runs[0].epsDraft.source.url,sources[0].url);
 assert.throws(()=>ai.accept(run.id,store.read().revision,false),/Only a completed assessment/);
});
