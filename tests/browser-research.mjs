import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'/private/tmp/research-browser-check/node_modules/playwright/index.mjs');
const root='http://127.0.0.1:5197',out=resolve('verification/browser');mkdirSync(out,{recursive:true});
const child=spawn(process.execPath,['tests/browser-fixture-server.mjs'],{stdio:['ignore','pipe','inherit']});
let browser;const checks=[],errors=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
async function waitFor(page,fn){await page.waitForFunction(fn,{},{timeout:15000});}
try{
 await Promise.race([once(child.stdout,'data'),once(child,'exit').then(([code])=>{throw new Error('Fixture exited '+code);})]);
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root);await page.locator('#research-toggle').waitFor();
 const companies=(await(await page.request.get(root+'/api/workspace')).json()).workspace.companies;
 await check('desktop panel opens, selects a company, and stays mounted during navigation',async()=>{
  await page.locator('#research-toggle').click();await page.locator('#research-panel').waitFor({state:'visible'});
  await page.locator('#ai-question').fill('Preserve this question draft');
  await page.locator('nav a[href="#scenarios"]').click();assert.equal(await page.locator('#ai-question').inputValue(),'Preserve this question draft');
  assert.equal(await page.locator('#research-toggle').getAttribute('aria-expanded'),'true');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:out+'/desktop-empty.png',fullPage:true});
 });
 await check('company navigation keeps separate question drafts',async()=>{
  await page.goto(root+'/#company/'+companies[0].id+'/overview');await page.locator('#ai-company').waitFor();
  await page.locator('#ai-question').fill('ETN draft');await page.locator('#ai-company').selectOption(companies[1].id);
  await page.locator('#ai-question').fill('VRT draft');await page.locator('#ai-company').selectOption(companies[0].id);assert.equal(await page.locator('#ai-question').inputValue(),'ETN draft');
 });
 await check('review runs to completion with inline citations and saved research basis',async()=>{
  await page.locator('#ai-review').click();await page.locator('.ai-verdict').waitFor({timeout:20000});
  assert.equal(await page.locator('.ai-verdict h2').textContent(),'Watch');assert.ok(await page.locator('.ai-cite').count());
  assert.ok((await page.locator('.ai-cite').first().getAttribute('href')).startsWith('https://example.com/'));
  assert.ok((await page.locator('#ai-result').textContent()).includes('Valuation incomplete'));
  await page.locator('.ai-verdict').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/desktop-assessment.png',fullPage:true});
 });
 await check('accepting a review preserves an unsaved main-form draft and saves exactly one evidence note',async()=>{
  await page.locator('#thesis').fill('UNSAVED MAIN DRAFT');
  await page.locator('#ai-accept').click();await page.locator('#ai-result .success').waitFor();assert.equal(await page.locator('#thesis').inputValue(),'UNSAVED MAIN DRAFT');
  const data=(await(await page.request.get(root+'/api/workspace')).json()).workspace;
  assert.equal(data.evidence.filter(e=>e.author==='AI research · reviewed by user').length,1);assert.equal(data.decisions.length,0);assert.equal(data.companies[0].thesis,'');
 });
 // Leave the unsaved main form through the application's own discard confirmation.
 await page.locator('nav a[href="#research"]').click();await page.locator('#confirm-ok').click();
 await check('inbox opens the saved assessment and history survives a browser reload',async()=>{
  await page.locator('[data-ai-run]').first().click();await page.locator('.ai-verdict').waitFor();await page.reload();await page.locator('.ai-verdict').waitFor();assert.equal(await page.locator('#research-toggle').getAttribute('aria-expanded'),'true');
 });
 await check('follow-up answer links sources and escapes source HTML',async()=>{
  await page.locator('#ai-question').fill('What evidence challenges this? <img src=x onerror=window.fixtureXSS=1>');await page.locator('#ai-ask').click();
  await waitFor(page,()=>document.querySelector('#ai-result h3')?.textContent.startsWith('What evidence challenges this?'));
  assert.equal(await page.evaluate(()=>window.fixtureXSS),undefined);assert.ok(await page.locator('#ai-result .note a').count());
  await page.reload();await waitFor(page,()=>document.querySelector('#ai-result h3')?.textContent.startsWith('What evidence challenges this?'));
 });
 await check('settings retain a dirty draft when another client saves; stale save is rejected',async()=>{
  await page.locator('#ai-settings summary').click();await page.locator('#ai-criteria').fill('Browser local mandate draft with sufficient length.');
  const info=await(await page.request.get(root+'/api/research/status')).json();const {revision,...settings}=info.settings;
  const response=await page.request.post(root+'/api/research/settings',{headers:{Origin:root,'X-Research-Request':'1','If-Match':revision},data:{...settings,horizonMonths:18}});assert.equal(response.status(),200);
  await page.waitForTimeout(2800);assert.equal(await page.locator('#ai-criteria').inputValue(),'Browser local mandate draft with sufficient length.');
  await page.locator('#ai-settings-form button[type=submit]').click();await waitFor(page,()=>document.querySelector('#ai-settings-feedback').textContent.includes('changed'));
  await page.locator('#ai-settings-reload').click();await waitFor(page,()=>document.querySelector('#ai-horizon').value==='18');
  await page.locator('#ai-settings summary').click();
 });
 await check('Escape closes the panel and returns focus to its launcher',async()=>{
  await page.locator('#ai-question').focus();await page.keyboard.press('Escape');assert.equal(await page.locator('#research-panel').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'research-toggle');
 });
 await check('mobile panel and report fit the viewport',async()=>{
  await page.setViewportSize({width:390,height:844});await page.locator('#research-toggle').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const box=await page.locator('#research-panel').boundingBox();assert.ok(box.x>=0&&box.width<=391);
  await page.locator('#ai-history').selectOption({index:1});await page.locator('.ai-verdict').waitFor();await page.locator('.ai-verdict').scrollIntoViewIfNeeded();
  await page.screenshot({path:out+'/mobile-assessment.png',fullPage:true});await page.locator('#ai-close').click();assert.equal(await page.locator('#research-panel').isVisible(),false);
 });
 await check('200%-equivalent CSS viewport fits and panel remains operable',async()=>{
  await page.setViewportSize({width:720,height:500});await page.locator('#research-toggle').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#ai-close').click();
 });
 assert.deepEqual(errors,[]);checks.push('No browser JavaScript errors');
 writeFileSync(out+'/results.json',JSON.stringify({checks,errors,provider:'Synthetic only; no OpenAI calls',viewportSizes:['1440×1000','390×844','720×500 (200%-equivalent)']},null,2));
 console.log(JSON.stringify({passed:checks.length,errors}));
}finally{await browser?.close();if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}}
