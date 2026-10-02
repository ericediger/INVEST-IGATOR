// Bounded live integration check: public seeded company data, isolated database, no production writes.
import {mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {Store} from '../server/store.js';
import {ResearchService} from '../server/research.js';
import {OpenAIResearchProvider,readAPIKey} from '../server/research-provider.js';
const configuredDir=join(homedir(),'Library/Application Support/InvestmentResearch');
const provider=new OpenAIResearchProvider({key:()=>readAPIKey(configuredDir)});
if(!provider.configured())throw new Error('No configured API key; live check was not run.');
const dir=mkdtempSync(join(tmpdir(),'research-live-eps-check-'));
const store=new Store(join(dir,'research.sqlite'),join(dir,'backups')),ai=new ResearchService(store,provider);
const cid=store.read().workspace.companies.find(c=>c.ticker==='ETN').id;
const run=ai.enqueue({companyId:cid,kind:'forward_eps',metricRequest:{currency:'USD',shareBasis:'',period:''}});
console.log(JSON.stringify({status:'started',model:provider.model,reasoningEffort:provider.reasoningEffort,company:'ETN',maximumProviderRequests:2,productionModified:false}));
let last='';
try{
 while(true){const current=ai.read(run.id);if(current.stage!==last){last=current.stage;console.log(JSON.stringify({stage:last}));}
  if(!['queued','running'].includes(current.status)){
   const result={status:current.status,model:provider.model,reasoningEffort:provider.reasoningEffort,error:current.error,canFill:current.epsDraft?.canFill??false,value:current.epsDraft?.value??null,period:current.epsDraft?.period??null,basis:current.epsDraft?.basis??null,currency:current.epsDraft?.currency??null,source:current.epsDraft?.source??null,missingFields:current.epsDraft?.missingFields||[],usage:current.usage,productionModified:false};
   writeFileSync('verification/live-eps-'+provider.model+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(current.status!=='completed')process.exitCode=1;break;
  }
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
}finally{ai.close();store.close();}
