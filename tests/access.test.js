import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {accessPolicy} from '../server/access.js';
import {Store} from '../server/store.js';
import {createApp} from '../server/app.js';
const options={origin:'http://127.0.0.1:5195',lanAddress:'172.20.30.179',trustedSubnet:'172.20.30.0/24'};

test('LAN access requires explicit private address and bounded canonical subnet',()=>{
 for(const override of [{lanAddress:'0.0.0.0'},{lanAddress:'8.8.8.8'},{trustedSubnet:null},{trustedSubnet:'0.0.0.0/0'},{trustedSubnet:'172.20.30.0/8'},{trustedSubnet:'172.20.30.1/24'},{trustedSubnet:'172.20.31.0/24'},{lanAddress:'::'},{origin:'https://other.example'}])assert.throws(()=>accessPolicy({...options,...override}));
 const local=accessPolicy();assert.equal(local.allows('172.20.30.5','127.0.0.1:5191'),false);assert.deepEqual(local.addresses,['127.0.0.1']);
});
test('LAN allowlist accepts configured subnet and exact hosts while denying other networks and addresses',()=>{
 const policy=accessPolicy(options);assert.deepEqual(policy.addresses,['127.0.0.1','172.20.30.179']);
 for(const address of ['172.20.30.2','172.20.30.179','172.20.30.254','::ffff:172.20.30.23','127.0.0.1'])assert.equal(policy.allows(address,'172.20.30.179:5195'),true);
 for(const address of ['172.20.31.2','192.168.0.2','8.8.8.8','::ffff:8.8.8.8','2001:db8::1',null,'172.20.30.5.example','172.20.30.999'])assert.equal(policy.allows(address,'172.20.30.179:5195'),false);
 for(const host of ['evil.example:5195','172.20.30.179:3000','172.20.30.179.evil:5195','localhost:5195'])assert.equal(policy.allows('172.20.30.23',host),false);
});
test('LAN-origin page, API, saving and cross-origin rejection use the same workspace',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'investment-research-lan-test-')),store=new Store(join(dir,'research.sqlite'),join(dir,'backups'));
 const server=createApp(store,options).listen(5195,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 t.after(async()=>{await new Promise(r=>server.close(r));store.close();});
 const send=(path,{host='172.20.30.179:5195',origin,body,revision,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=request('http://127.0.0.1:5195'+path,{method:body?'POST':'GET',headers:{Host:host,...(body?{'Content-Type':'application/json','X-Research-Request':'1'}:{}),...(origin?{Origin:origin}:{}),...(revision?{'If-Match':revision}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 assert.equal((await send('/')).status,200);
 const current=JSON.parse((await send('/api/workspace')).text);assert.equal(current.access,'Trusted home network');
 const payload={action:'evidence.add',payload:{companyId:current.workspace.companies[0].id,note:'SYNTHETIC LAN TEST',source:{title:'Test only',url:null,publicationDate:null},asOfDate:null,author:'Test',supersedesId:null}};
 const saved=await send('/api/actions',{origin:'http://172.20.30.179:5195',body:payload,revision:current.revision});assert.equal(saved.status,200);
 const local=JSON.parse((await send('/api/workspace',{host:'127.0.0.1:5195'})).text);assert.equal(local.workspace.evidence.at(-1).note,'SYNTHETIC LAN TEST');
 for(const origin of ['http://127.0.0.1:5195','http://172.20.30.179:3000','https://evil.example'])assert.equal((await send('/api/actions',{origin,body:payload,revision:local.revision})).status,403);
 assert.equal((await send('/api/workspace',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
 assert.equal((await send('/api/export',{host:'evil.example'})).status,403);
 assert.equal((await send('/api/workspace',{host:'evil.example',headers:{'X-Forwarded-Host':'172.20.30.179:5195','X-Forwarded-For':'172.20.30.2'}})).status,403);
 assert.equal(store.read().revision,local.revision);
});
