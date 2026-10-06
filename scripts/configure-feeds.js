// Run interactively on the server Mac. Stores the Tiingo key, an optional FMP key and the SEC EDGAR contact privately.
// Keys are never printed, sent to the browser or written anywhere but the private data folder.
import {mkdirSync,writeFileSync,renameSync,chmodSync,existsSync,unlinkSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {createInterface} from 'node:readline/promises';
process.umask(0o077);
if(!process.stdin.isTTY) throw new Error('Open this setup in a terminal on the server Mac. Do not paste API keys into chat.');
const dir=resolve(process.env.RESEARCH_DATA_DIR||join(homedir(),'Library/Application Support/InvestmentResearch'));
mkdirSync(dir,{recursive:true,mode:0o700});
const save=(name,value)=>{const path=join(dir,name),temp=path+'.new';if(existsSync(temp))unlinkSync(temp);writeFileSync(temp,value+'\n',{mode:0o600,flag:'wx'});chmodSync(temp,0o600);renameSync(temp,path);};
function hidden(prompt){
 return new Promise(resolve=>{process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');let value='';
  const onData=chunk=>{for(const ch of chunk){if(ch==='\u0003'||ch==='\u001b'){process.stdin.setRawMode(false);console.log('\nCancelled.');process.exit(0);}if(ch==='\r'||ch==='\n'){process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',onData);console.log('');resolve(value.trim());return;}if(ch==='\u007f'||ch==='\b')value=value.slice(0,-1);else if(ch>=' '&&value.length<4096)value+=ch;}};
  process.stdin.on('data',onData);});
}
console.log(`Connect INVEST-IGATOR to price and financials feeds

1. Tiingo (end-of-day prices, free tier): create a token at https://www.tiingo.com/account/api/token
2. SEC EDGAR (reported financials, free, no key): the SEC requires a contact in each request, usually "Name email@example.com"
3. Financial Modeling Prep (optional, not used yet): https://site.financialmodelingprep.com/developer/docs

Press Enter to keep an existing value or skip an item. Keys are hidden while you type.
`);
const tiingo=await hidden('Tiingo API token: ');
if(tiingo){ if(!/^[A-Za-z0-9]{20,80}$/.test(tiingo)){console.log('That does not look like a Tiingo token. Nothing saved for Tiingo.');} else {save('tiingo-api-key',tiingo);console.log('Tiingo token saved.');} }
const rl=createInterface({input:process.stdin,output:process.stdout});
const contact=(await rl.question('SEC EDGAR contact (name and email, visible): ')).trim();
if(contact){ if(!/@/.test(contact)||contact.length>200){console.log('The SEC contact must include an email address. Nothing saved for EDGAR.');} else {save('edgar-contact',contact);console.log('EDGAR contact saved.');} }
rl.close();
const fmp=await hidden('FMP API key (optional): ');
if(fmp){ if(!/^[A-Za-z0-9]{16,80}$/.test(fmp)){console.log('That does not look like an FMP key. Nothing saved for FMP.');} else {save('fmp-api-key',fmp);console.log('FMP key saved.');} }
console.log('\nSaved privately on this Mac. The app reads these files when it needs them; no restart is required.\nThe daily price fetch runs after the New York close while the app is running, and Data & backups shows the feed status.');
process.exit(0);
