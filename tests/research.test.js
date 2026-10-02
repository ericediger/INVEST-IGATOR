import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {Store} from '../server/store.js';
import {ResearchService,validateAssessment,DEFAULT_MANDATE,contextFor} from '../server/research.js';
import {OpenAIResearchProvider,responseSources,responseText,readAPIKey} from '../server/research-provider.js';
import {createApp} from '../server/app.js';
const paragraph=(text='SYNTHETIC FIXTURE. Research is incomplete.',sourceIds=['S1'])=>({text,sourceIds});
const report=()=>({summary:paragraph(),recommendation:'Watch',rationale:paragraph(),evidenceConfidence:'Low',businessQuality:paragraph(),financialAssessment:paragraph(),valuationAssessment:paragraph('No numerical valuation available.',[]),bullCase:[paragraph()],bearCase:[paragraph('Synthetic contrary evidence.',['S2'])],changes:[],assumptions:['Test assumption'],missingEvidence:['No dated snapshot'],invalidationTriggers:['Test trigger'],nextSteps:['Verify a dated price']});
const response=(text,url='https://example.com/filing',title='Synthetic source')=>({id:'response-test',status:'completed',model:'test-model',usage:{input_tokens:10,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text,annotations:url?[{type:'url_citation',url,title}]:[]}]}]});
class Provider {
 constructor(){this.model='test-model';this.calls=[];this.enabled=true;}
 configured(){return this.enabled;}
 async request(input){this.calls.push(input);if(input.schema)return response(JSON.stringify(report()),null);return response('SYNTHETIC RESEARCH — not market data.',this.calls.length%2?'https://example.com/filing':'https://example.com/challenge');}
}
function setup(t,provider=new Provider()){
 const dir=mkdtempSync(join(tmpdir(),'ai-research-test-')),path=join(dir,'research.sqlite'),backups=join(dir,'backups');
 const store=new Store(path,backups),ai=new ResearchService(store,provider);t.after(()=>{ai.close();store.close();});
 return {dir,path,backups,store,ai,provider,cid:store.read().workspace.companies[0].id};
}
async function finished(ai,id){for(let i=0;i<200;i++){const run=ai.read(id);if(!['queued','running'].includes(run.status))return run;await new Promise(r=>setTimeout(r,5));}throw new Error('Research did not finish');}

test('three-stage research preserves context, sources, recommendation and usage without mutating workspace',async t=>{
 const {ai,store,provider,cid}=setup(t),before=store.read();const run=ai.enqueue({companyId:cid,kind:'review'});const done=await finished(ai,run.id);
 assert.equal(done.status,'completed');assert.equal(done.report.recommendation,'Watch');assert.equal(done.sources.length,2);assert.equal(done.usage.length,3);assert.equal(provider.calls.length,3);assert.equal(provider.calls[0].search,true);assert.equal(provider.calls[1].search,true);assert.ok(provider.calls[2].schema);assert.deepEqual(store.read(),before);assert.equal(done.context.company.ticker,'ETN');assert.ok(done.fingerprint);assert.equal(done.contextChanged,false);
});

test('missing key and daily cap fail before provider work, including follow-up questions',async t=>{
 const {ai,provider,cid}=setup(t);provider.enabled=false;assert.throws(()=>ai.enqueue({companyId:cid,kind:'review'}),e=>e.status===503);assert.equal(ai.list().length,0);provider.enabled=true;
 const settings=ai.settings();ai.saveSettings({...DEFAULT_MANDATE,dailyLimit:1},settings.revision);const run=ai.enqueue({companyId:cid,kind:'question',question:'Test question?'});await finished(ai,run.id);
 assert.throws(()=>ai.enqueue({companyId:cid,kind:'review'}),e=>e.status===429);assert.equal(provider.calls.length,1);assert.throws(()=>ai.saveSettings(DEFAULT_MANDATE,settings.revision),e=>e.status===409);
});

test('untrusted source references and insufficient citations fail validation; Consider is gated by dated valuation',t=>{
 const {store,cid}=setup(t),{context}=contextFor(store,cid,DEFAULT_MANDATE),sources=[{id:'S1'},{id:'S2'}];let r=report();r.recommendation='Consider';assert.equal(validateAssessment(r,sources,context).recommendation,'Research further');r=report();r.rationale.sourceIds=['invented'];assert.throws(()=>validateAssessment(r,sources,context),/not returned/);r=report();r.summary.sourceIds=[];assert.throws(()=>validateAssessment(r,sources,context),/lacks evidence/);assert.throws(()=>validateAssessment(report(),[{id:'S1'}],context));
});

test('acceptance requires reviewed changed context, preserves source provenance and is idempotent',async t=>{
 const {ai,store,cid}=setup(t);const run=await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);
 store.update(store.read().revision,'evidence.add',{companyId:cid,note:'New fact since research',source:{title:'Test',url:null,publicationDate:null},asOfDate:null,author:'Test',supersedesId:null});
 assert.equal(ai.read(run.id).contextChanged,true);assert.throws(()=>ai.accept(run.id,store.read().revision,false),e=>e.status===409);
 const stale='stale';assert.throws(()=>ai.accept(run.id,stale,true),e=>e.status===409);
 const saved=ai.accept(run.id,store.read().revision,true);assert.equal(saved.workspace.decisions.length,0);assert.equal(saved.workspace.evidence.at(-1).author,'AI research · reviewed by user');assert.match(saved.workspace.evidence.at(-1).note,/https:\/\/example.com\/challenge/);
 const twice=ai.accept(run.id,'stale',true);assert.equal(twice.evidenceId,saved.evidenceId);assert.equal(twice.workspace.evidence.length,saved.workspace.evidence.length);
});

test('question carries recent company conversation; another company receives no cross-company history',async t=>{
 const {ai,store,provider,cid}=setup(t);await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);const q=await finished(ai,ai.enqueue({companyId:cid,kind:'question',question:'What evidence challenges this?'}).id);assert.equal(q.status,'completed');assert.equal(q.history.length,1);assert.ok(q.answer);assert.equal(provider.calls.at(-1).search,true);
 const other=await finished(ai,ai.enqueue({companyId:store.read().workspace.companies[1].id,kind:'question',question:'Test?'}).id);assert.equal(other.history.length,0);
});

test('cancellation aborts running work and never publishes a late answer',async t=>{
 const provider=new Provider();let release;provider.request=()=>new Promise(r=>{release=r;});const {ai,cid}=setup(t,provider),run=ai.enqueue({companyId:cid,kind:'review'});
 await new Promise(r=>setImmediate(r));assert.equal(ai.read(run.id).status,'running');assert.throws(()=>ai.enqueue({companyId:cid,kind:'question',question:'Duplicate?'}),e=>e.status===409);
 ai.cancel(run.id);release(response('Late result'));await new Promise(r=>setImmediate(r));assert.equal(ai.read(run.id).status,'cancelled');assert.equal(ai.read(run.id).report,null);
});

test('provider errors and malformed structured results remain failures without automatic retry',async t=>{
 const provider=new Provider();provider.request=async input=>{provider.calls.push(input);if(input.schema)return response('{broken',null);return response('Test',provider.calls.length===1?'https://example.com/one':'https://example.com/two');};const {ai,cid}=setup(t,provider);
 const run=await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);assert.equal(run.status,'failed');assert.match(run.error,/unreadable/);assert.equal(provider.calls.length,3);assert.equal(run.report,null);assert.equal(run.sources.length,2);
});

test('database backups retain AI archive and accepted evidence together; read-only archive records full history',async t=>{
 const {ai,store,cid,backups}=setup(t);const run=await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id);ai.accept(run.id,store.read().revision,false);const file=await store.backup();const db=new Database(join(backups,file),{readonly:true});
 try{assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.equal(db.prepare('SELECT count(*) AS n FROM ai_runs').get().n,1);assert.equal(db.prepare('SELECT count(*) AS n FROM ai_accepted').get().n,1);}finally{db.close();}
 assert.equal(ai.export().runs[0].report.recommendation,'Watch');assert.equal(store.export().workspace.evidence.at(-1).author,'AI research · reviewed by user');
});

test('reopening database preserves completed conversations and marks interrupted work without retrying',async t=>{
 const {ai,store,provider,cid,path,backups}=setup(t);const done=await finished(ai,ai.enqueue({companyId:cid,kind:'question',question:'Persistent?'}).id);
 const second=new Store(path,backups),reopened=new ResearchService(second,provider);
 try{assert.equal(reopened.read(done.id).answer,done.answer);assert.equal(reopened.settings().horizonMonths,12);}finally{reopened.close();second.close();}
 // Simulate an unclean process exit by persisting an in-flight state, then reconstructing only the service.
 store.db.prepare("UPDATE ai_runs SET status='running' WHERE id=?").run(done.id);const restarted=new ResearchService(store,provider);assert.equal(restarted.read(done.id).status,'interrupted');assert.equal(provider.calls.length,1);restarted.close();
});

test('workspace replacement exposes orphaned AI history and prevents accepting it into an unrelated company',async t=>{
 const {ai,store,cid}=setup(t);const done=await finished(ai,ai.enqueue({companyId:cid,kind:'review'}).id),env=store.export();for(const key of ['companies','evidence','snapshots','scenarios','decisions'])env.workspace[key]=[];
 store.restore(store.read().revision,env,store.preview(env).digest,'REPLACE WORKSPACE');assert.equal(ai.read(done.id).orphaned,true);assert.throws(()=>ai.accept(done.id,store.read().revision,true),e=>e.status===409);assert.equal(ai.list().length,1);
});

test('Responses adapter enforces server-only credentials, request bounds and cited output parsing',async()=>{
 let called;const provider=new OpenAIResearchProvider({key:()=> 'sk-SYNTHETIC-NOT-A-REAL-KEY',fetcher:async(url,options)=>{called={url,options};return {ok:true,json:async()=>response('Example text')};}});
 await provider.request({instructions:'test',input:'test',search:true});const body=JSON.parse(called.options.body);assert.equal(called.url,'https://api.openai.com/v1/responses');assert.equal(body.store,false);assert.equal(body.max_tool_calls,4);assert.equal(body.max_output_tokens,6500);assert.equal(body.tools[0].type,'web_search');assert.equal(body.tool_choice,'required');assert.ok(called.options.headers.Authorization);
 const bad=response('test','javascript:alert(1)');assert.equal(responseSources(bad).length,0);assert.throws(()=>responseText({...bad,status:'incomplete'}));
 const good=response('Test [1]','https://example.com/a','A source');good.output[0].content[0].annotations[0].start_index=5;good.output[0].content[0].annotations[0].end_index=8;assert.equal(responseText(good),'Test [A source](https://example.com/a)');
});

test('provider status errors are actionable and do not expose credential or response body',async()=>{
 const provider=new OpenAIResearchProvider({key:()=> 'SECRET',fetcher:async()=>({ok:false,status:401,json:async()=>({error:'SECRET'})})});await assert.rejects(()=>provider.request({instructions:'test',input:'test'}),e=>e.status===502&&!e.message.includes('SECRET')&&/rejected/.test(e.message));
});

test('server key file must have private permissions and is never exposed by status',t=>{
 if(process.env.OPENAI_API_KEY||process.env.OPENAI_API_KEY_FILE){t.skip('Environment supplies a server key');return;}
 const {dir,ai}=setup(t),file=join(dir,'openai-api-key');writeFileSync(file,'sk-SYNTHETIC',{mode:0o600});assert.equal(readAPIKey(dir),'sk-SYNTHETIC');chmodSync(file,0o644);assert.equal(readAPIKey(dir),'');assert.ok(!JSON.stringify(ai.status()).includes('sk-'));
});

test('research HTTP endpoints use existing origin protections, return jobs immediately and persist acceptance',async t=>{
 const {ai,store,cid}=setup(t);const root='http://127.0.0.1:5196',app=createApp(store,{origin:root,research:ai}),server=app.listen(5196,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const headers={Origin:root,'Content-Type':'application/json','X-Research-Request':'1'};
 let res=await fetch(root+'/api/research/runs',{method:'POST',headers,body:JSON.stringify({companyId:cid,kind:'review'})});assert.equal(res.status,202);const run=await res.json();await finished(ai,run.id);
 res=await fetch(root+'/api/research/runs/'+run.id);assert.equal((await res.json()).status,'completed');
 res=await fetch(root+'/api/research/runs/'+run.id+'/accept',{method:'POST',headers:{...headers,'If-Match':store.read().revision},body:'{}'});assert.equal(res.status,200);
 for(const path of ['/api/research/runs','/api/research/settings','/api/research/runs/'+run.id+'/accept','/api/research/runs/'+run.id+'/cancel'])assert.equal((await fetch(root+path,{method:'POST',headers:{...headers,Origin:'https://attacker.example'},body:'{}'})).status,403);
 const exported=await (await fetch(root+'/api/research/export')).json();assert.equal(exported.runs.length,1);assert.ok(exported.runs[0].acceptedEvidenceId);
});
