import {resolve} from 'node:path';
import {ResearchService} from './research.js';
import {OpenAIResearchProvider,readAPIKey} from './research-provider.js';
import {Store} from './store.js';
import {createApp} from './app.js';
import {accessPolicy} from './access.js';
process.umask(0o077);
const port=Number(process.env.PORT||5191), data=resolve(process.env.RESEARCH_DATA_DIR||'runtime');
if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('Invalid port');
const options={origin:`http://127.0.0.1:${port}`,lanAddress:process.env.RESEARCH_LAN_ADDRESS||null,trustedSubnet:process.env.RESEARCH_TRUSTED_SUBNET||null};
const policy=accessPolicy(options),store=new Store(resolve(data,'research.sqlite'),resolve(data,'backups'));
const research=new ResearchService(store,new OpenAIResearchProvider({key:()=>readAPIKey(data)}));
const app=createApp(store,{...options,research});
const servers=policy.addresses.map(address=>{
  const server=app.listen(port,address,()=>console.log(`INVEST-IGATOR: http://${address}:${port}`));
  server.requestTimeout=30000; server.headersTimeout=15000;
  server.on('error',error=>{console.error('Listener unavailable:',error.code);process.exit(1);});
  return server;
});
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{
  research.close();
  let remaining=servers.length;
  for(const server of servers) server.close(()=>{if(--remaining===0){store.close();process.exit(0);}});
});
