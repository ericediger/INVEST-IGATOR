// Disposable browser-test service. Never reads production data or calls OpenAI.
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/store.js';
import {ResearchService} from '../server/research.js';
import {createApp} from '../server/app.js';
const dir=mkdtempSync(join(tmpdir(),'research-browser-fixture-'));
const store=new Store(join(dir,'research.sqlite'),join(dir,'backups'));
const p=(text,sourceIds=['S1'])=>({text,sourceIds});
const report={summary:p('SYNTHETIC UI TEST — this is not investment research. The fixture supports a watch recommendation until valuation evidence is available.'),recommendation:'Watch',rationale:p('SYNTHETIC UI TEST — await verified financial inputs and a dated valuation.'),evidenceConfidence:'Low',businessQuality:p('SYNTHETIC UI TEST — business quality needs primary-source verification.'),financialAssessment:p('SYNTHETIC UI TEST — financial metrics are deliberately absent.'),valuationAssessment:p('No snapshot or calculated valuation is available.',[]),bullCase:[p('SYNTHETIC UI TEST — illustrative supporting evidence.')],bearCase:[p('SYNTHETIC UI TEST — illustrative counterevidence.',['S2'])],changes:[],assumptions:['SYNTHETIC UI TEST — assumptions need verification.'],missingEvidence:['A current price and valuation inputs are missing.'],invalidationTriggers:['SYNTHETIC UI TEST — review new contrary evidence.'],nextSteps:['Verify the source documents and add a dated snapshot.']};
let calls=0;
const provider={model:'SYNTHETIC-browser-fixture',configured:()=>true,async request(input){
 await new Promise(r=>setTimeout(r,350));calls++;
 if(input.signal?.aborted)throw new Error('Test cancellation');
 const url=calls%2?'https://example.com/filing':'https://example.com/challenge';
 return {id:`fixture-${calls}`,model:this.model,status:'completed',usage:{input_tokens:10,output_tokens:20},output:[{type:'message',content:[{type:'output_text',text:input.schema?JSON.stringify(input.schema.properties.value?{value:7.25,period:'FY 2027 analyst consensus',periodEndDate:'2027-12-31',basis:'Adjusted diluted EPS',currency:'USD',shareBasis:'Diluted common share',kind:'Analyst estimate',sourceId:'S1',publicationDate:null,estimateAsOfDate:null,explanation:'SYNTHETIC UI TEST — an analyst estimate for form-fill verification only.',sourceExcerpt:'FY 2027 adjusted diluted EPS consensus is USD 7.25 per share.',missingFields:[]}:report):`SYNTHETIC UI TEST — a cited answer. [Fixture source](${url}) <script>window.fixtureXSS=1</script>`,annotations:input.schema?[]:[{type:'url_citation',url,title:'SYNTHETIC source'}]}]}]};
}};
const research=new ResearchService(store,provider),root='http://127.0.0.1:5197';
const server=createApp(store,{origin:root,research}).listen(5197,'127.0.0.1',()=>console.log('Browser fixture ready'));
process.on('SIGTERM',()=>{research.close();server.close(()=>{store.close();process.exit(0);});});
