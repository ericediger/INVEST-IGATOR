// Run interactively on the server Mac. The API key is never printed or sent to the app browser.
import {mkdirSync,writeFileSync,renameSync,chmodSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
process.umask(0o077);
if(!process.stdin.isTTY) throw new Error('Open this setup in a terminal on the server Mac. Do not paste API keys into chat.');
const dir=resolve(process.env.RESEARCH_DATA_DIR||join(homedir(),'Library/Application Support/InvestmentResearch'));
console.log('Connect Investment Research to OpenAI\n\nCreate an API key for a funded project at https://platform.openai.com/api-keys.\nSet your project budget there. API usage is billed separately from ChatGPT.\n\nPaste the API key below. Your input is hidden. Press Enter to save, or Escape to cancel.');
process.stdout.write('API key: ');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
let value='';
process.stdin.on('data',chunk=>{
 for(const char of chunk) {
  if(char==='\u0003'||char==='\u001b'){process.stdin.setRawMode(false);console.log('\nCancelled.');process.exit(0);}
  if(char==='\r'||char==='\n'){
   process.stdin.setRawMode(false);process.stdin.pause();const key=value.trim();value='';
   if(!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)){console.log('\nThat does not look like an OpenAI API key. Run setup again.');process.exit(1);}
   mkdirSync(dir,{recursive:true,mode:0o700});const path=join(dir,'openai-api-key'),temp=path+'.new';
   writeFileSync(temp,key+'\n',{mode:0o600,flag:'wx'});chmodSync(temp,0o600);renameSync(temp,path);
   console.log('\nSaved privately on this Mac. Reload the research panel to connect.\nThe first research run will verify provider access and billing.');process.exit(0);
  }
  if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' '&&value.length<4096)value+=char;
 }
});
