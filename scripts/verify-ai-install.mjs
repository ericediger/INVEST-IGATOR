import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'/private/tmp/research-browser-check/node_modules/playwright/index.mjs');
// Addresses to check: RESEARCH_VERIFY_TARGETS (comma-separated) or, by default, loopback plus the LAN address configured in the installed LaunchAgent.
function installedTargets(){
 if(process.env.RESEARCH_VERIFY_TARGETS) return process.env.RESEARCH_VERIFY_TARGETS.split(',').map(s=>s.trim()).filter(Boolean);
 const plist=resolve(homedir(),'Library/LaunchAgents/com.investmentresearch.app.plist');
 const env=JSON.parse(execFileSync('plutil',['-convert','json','-o','-',plist],{encoding:'utf8'})).EnvironmentVariables||{};
 const port=env.PORT||'5191';
 return ['http://127.0.0.1:'+port,...(env.RESEARCH_LAN_ADDRESS?['http://'+env.RESEARCH_LAN_ADDRESS+':'+port]:[])];
}
const targets=installedTargets();
const checks=[],version=JSON.parse(readFileSync('package.json','utf8')).version;
for(const root of targets){
 const w=await(await fetch(root+'/api/workspace')).json();assert.equal(w.version,version);
 const ai=await(await fetch(root+'/api/research/status')).json();assert.ok(ai.model&&ai.reasoningEffort,'research status must report a model and reasoning effort');
 checks.push({address:root,version:w.version,keyConfigured:ai.configured,model:ai.model,reasoningEffort:ai.reasoningEffort,researchRuns:(await(await fetch(root+'/api/research/runs')).json()).runs.length});
}
for(const check of checks){assert.equal(check.model,checks[0].model);assert.equal(check.reasoningEffort,checks[0].reasoningEffort);}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(targets[0]);await page.locator('#research-toggle').click();await page.waitForFunction(()=>document.querySelector('#ai-connection').textContent.includes('runs today'));
 assert.match(await page.locator('#ai-connection').textContent(),new RegExp(escape(checks[0].model)+'.*'+escape(checks[0].reasoningEffort)+' reasoning'));
 if(!checks[0].keyConfigured){assert.equal(await page.locator('#ai-setup').isVisible(),true);assert.equal(await page.locator('#ai-review').isDisabled(),true);assert.equal(await page.locator('#ai-ask').isDisabled(),true);}
 await page.locator('nav a[href="#research"]').click();await page.locator('#ai-inbox-rows').waitFor();
 const workspace=await(await page.request.get(targets[0]+'/api/workspace')).json();
 await page.goto(targets[0]+'/#company/'+workspace.workspace.companies[0].id+'/snapshots');
 await page.locator('details.optional-metric').first().locator('summary').click();await page.locator('#research-forward-eps').waitFor();
 assert.deepEqual(errors,[]);
 await page.screenshot({path:resolve('verification/browser/installed-setup.png'),fullPage:true});
 writeFileSync('verification/installed-ai-'+version+'.json',JSON.stringify({checks,browser:'Installed model status, research inbox and EPS research action verified without starting paid research',errors,liveProviderTest:false},null,2));
 console.log(JSON.stringify({checks,installedBrowser:'passed',errors,liveProviderTest:false}));
}finally{await browser.close();}
