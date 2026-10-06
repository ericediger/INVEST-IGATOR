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
async function waitFor(page,fn){try{await page.waitForFunction(fn,{},{timeout:15000});}catch(e){e.message+=' — while waiting for: '+fn.toString().slice(0,200);throw e;}}
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
  assert.match(await page.locator('.ai-cite').first().getAttribute('href'),/^https:\/\/(example\.com|www\.tiingo\.com|www\.sec\.gov|data\.sec\.gov)\//,'citations link to research or feed sources');
  assert.ok((await page.locator('#ai-result').textContent()).includes('Valuation incomplete'));
  await page.evaluate(()=>document.querySelector('.ai-verdict')?.scrollIntoView());await page.screenshot({path:out+'/desktop-assessment.png',fullPage:true});
 });
 await check('accepting a review preserves an unsaved main-form draft and saves exactly one evidence note',async()=>{
  await page.locator('#thesis').fill('UNSAVED MAIN DRAFT');
  await page.locator('#ai-accept').click();await page.locator('#ai-result .success').waitFor();assert.equal(await page.locator('#thesis').inputValue(),'UNSAVED MAIN DRAFT');
  const data=(await(await page.request.get(root+'/api/workspace')).json()).workspace;
  assert.equal(data.evidence.filter(e=>e.author==='AI research · reviewed by user').length,1);assert.equal(data.decisions.length,0);assert.ok(data.companies[0].thesis.includes('From the research assessment of'));assert.ok(data.companies[0].risks.includes('SYNTHETIC UI TEST'));
 });
 // Leave the unsaved main form through the application's own discard confirmation.
 await page.locator('nav a[href="#research"]').click();await page.locator('#confirm-ok').click();
 await check('inbox opens the saved assessment and history survives a browser reload',async()=>{
  await page.locator('[data-ai-run]').first().click();await page.locator('.ai-verdict').waitFor();await page.reload();await page.locator('.ai-verdict').waitFor();assert.equal(await page.locator('#research-toggle').getAttribute('aria-expanded'),'true');
 });
 await check('home shows the stored assessment, dated price, multiples and automatic disposition for a researched company',async()=>{
  if(await page.locator('#research-panel').isVisible())await page.locator('#ai-close').click();
  await page.goto(root+'/#home');await page.locator('.home-row[data-ticker="ETN"]').waitFor();
  const row=page.locator('.home-row[data-ticker="ETN"]'),text=await row.textContent();
  assert.ok(text.includes('USD 123.45'));assert.ok(text.includes('Fwd P/E'));assert.ok(text.includes('NYSE'));assert.ok(text.includes('SYNTHETIC UI TEST'));assert.ok(/Tiingo close|Research snapshot/.test(text),'the price is labeled with its source');
  assert.equal(await row.locator('.home-disposition .badge.watching').count(),1);assert.equal(await row.locator('.home-disposition .badge.owner').count(),0);assert.ok(text.includes('App decides'));assert.ok(/assessed (today|yesterday)/.test(text));assert.equal(await row.locator('.badge.warning').filter({hasText:'Stale'}).count(),0);
  assert.ok((await page.locator('#home-tabs').textContent()).includes('Research 6'));assert.ok((await page.locator('#home-rows').textContent()).includes('Invested'));assert.ok((await page.locator('#home-rows h2').first().textContent()).includes('Invested'));
  await row.locator('.row-details > summary').click();assert.ok(await row.locator('.row-details[open] .disp-select').isVisible());assert.ok((await row.locator('.row-triggers').textContent()).includes('Evidence still needed'));
  await page.locator('#home-tabs a[href="#home/research"]').click();await page.waitForFunction(()=>document.querySelectorAll('.home-row').length===6);
  assert.equal(await page.locator('.home-row[data-ticker="ETN"]').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(root+'/#home');await page.locator('.home-row[data-ticker="ETN"]').waitFor();await page.screenshot({path:out+'/home-desktop.png',fullPage:true});
 });
 await check('intake verifies listings, adds the company with research queued, asks about an ambiguous name and files the result automatically',async()=>{
  await page.locator('#intake-entries').fill('Intake Example Corp, Ambiguous Holdings, Nowhere Inc');await page.locator('#intake-submit').click();
  await page.locator('.intake-entries [data-choose]').first().waitFor({timeout:20000});
  const status=await page.locator('#intake-status').textContent();
  assert.ok(status.includes('Intake Example Corp'));assert.ok(status.includes('not found'));assert.ok(status.includes('Ambiguous Holdings plc'));assert.ok(status.includes('Ambiguous Holdings AG'));
  await page.waitForFunction(()=>document.querySelector('.home-row[data-ticker="IEX"] .home-disposition .badge.watching'),{},{timeout:30000});
  assert.ok((await page.locator('.home-row[data-ticker="IEX"] .home-figures').textContent()).includes('USD 123.45'));
  await page.locator('.intake-entries [data-choose][data-candidate="1"]').click();
  await page.waitForFunction(()=>document.querySelector('#intake-status')?.textContent.includes('already listed')||document.querySelector('#intake-status')?.textContent.includes('Ambiguous Holdings → '));
  const data=(await(await page.request.get(root+'/api/workspace')).json()).workspace;
  const iex=data.companies.find(c=>c.ticker==='IEX');assert.ok(iex);assert.equal(iex.exchange,'NYSE');assert.equal(iex.currency,'USD');assert.equal(iex.role,'SYNTHETIC UI TEST company.');assert.ok(data.evidence.some(e=>e.companyId===iex.id&&e.author==='Company intake'));
  assert.ok(data.companies.find(c=>c.ticker==='AMBG'));assert.ok(!data.companies.find(c=>c.ticker==='AMBH'));assert.ok(!data.companies.find(c=>/nowhere/i.test(c.name)));
  const overview=await(await page.request.get(root+'/api/workflow/overview')).json();
  assert.equal(overview.companies.find(c=>c.ticker==='IEX').disposition.value,'Watch');assert.equal(overview.companies.find(c=>c.ticker==='IEX').disposition.setBy,'app');
 });
 await check('owner overrides: Declined sticks and moves the company, Invested records the entry, and releasing returns the app value',async()=>{
  const openIEX=async()=>{const dt=page.locator('.home-row[data-ticker="IEX"] .row-details');if(!await dt.evaluate(d=>d.open))await dt.locator('> summary').click();};
  await openIEX();await page.locator('.home-row[data-ticker="IEX"] .disp-select').selectOption('Declined');
  await page.waitForFunction(()=>document.querySelector('.home-row[data-ticker="IEX"]')===null);
  await page.locator('#home-tabs a[href="#home/declined"]').click();await page.locator('.home-row[data-ticker="IEX"] .home-disposition .badge.owner').waitFor();
  assert.ok((await page.locator('.home-row[data-ticker="IEX"] .home-disposition').textContent()).includes('Declined'));
  await openIEX();await page.locator('.home-row[data-ticker="IEX"] .disp-select').selectOption('Invested');await page.locator('.home-row[data-ticker="IEX"] .invested-form').waitFor();
  await page.locator('.home-row[data-ticker="IEX"] input[name=price]').fill('120.5');await page.locator('.home-row[data-ticker="IEX"] input[name=quantity]').fill('10');await page.locator('.home-row[data-ticker="IEX"] .invested-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('.home-row[data-ticker="IEX"]')===null);
  await page.locator('#home-tabs a[href="#home"]').click();await page.locator('.home-row[data-ticker="IEX"] .home-disposition .badge.invested').waitFor();
  const t=await page.locator('.home-row[data-ticker="IEX"]').textContent();assert.ok(t.includes('Invested'),'badge');assert.ok(t.includes('120.5'),'entry price in details');assert.ok(t.includes('10 shares'),'quantity in details');assert.ok(t.includes('You decide'),'owner shown as decider');
  let overview=await(await page.request.get(root+'/api/workflow/overview')).json();let e=overview.companies.find(c=>c.ticker==='IEX');assert.equal(e.disposition.setBy,'owner');assert.equal(e.disposition.invested.price,120.5);assert.equal(e.disposition.invested.currency,'USD');assert.equal(e.disposition.invested.quantity,10);
  assert.ok((await page.locator('#home-rows h2').first().textContent()).includes('Invested'),'Invested companies sit in their own section');
  await openIEX();await page.locator('.home-row[data-ticker="IEX"] .disp-select').selectOption('auto');await page.locator('.home-row[data-ticker="IEX"] .home-disposition .badge.watching').waitFor();
  assert.equal(await page.locator('.home-row[data-ticker="IEX"] .home-disposition .badge.owner').count(),0);
  overview=await(await page.request.get(root+'/api/workflow/overview')).json();e=overview.companies.find(c=>c.ticker==='IEX');assert.equal(e.disposition.setBy,'app');assert.equal(e.disposition.value,'Watch');
 });
 await check('the company page shows the research summary with figures, challenges and the disposition control',async()=>{
  const iex=(await(await page.request.get(root+'/api/workspace')).json()).workspace.companies.find(c=>c.ticker==='IEX');
  await page.goto(root+'/#company/'+iex.id+'/overview');await page.locator('.research-summary .disp-select').waitFor(); // the company was created server-side; the page re-reads the workspace
  const text=await page.locator('.research-summary').textContent();
  assert.ok(text.includes('Research summary'));assert.ok(text.includes('What challenges the case'));assert.ok(text.includes('Forward P/E'));assert.ok(text.includes('USD 123.45'));
  assert.equal(await page.locator('#company-form select#status').count(),0);assert.equal(await page.locator('#company-form input[name=status]').count(),1);
  assert.ok((await page.locator('label[for=role]').textContent()).includes('What the company does'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 });
 await check('a running review shows a progress bar with its step, and the assistant explains why its buttons are disabled',async()=>{
  const vrt=companies[1],headers={Origin:root,'X-Research-Request':'1','Content-Type':'application/json'};
  const started=await page.request.post(root+'/api/research/runs',{headers,data:{companyId:vrt.id,kind:'review',withSnapshot:true}});assert.equal(started.status(),202);
  await page.goto(root+'/#home/research');await page.locator('.home-row[data-ticker="VRT"] .progress').waitFor({timeout:5000});
  const text=await page.locator('.home-row[data-ticker="VRT"] .progress').textContent();assert.ok(/of 5|queue|Starting/.test(text));assert.ok(text.includes('usually takes'));
  await page.goto(root+'/#company/'+vrt.id+'/overview');if(!await page.locator('#research-panel').isVisible())await page.locator('#research-toggle').click();
  await page.waitForFunction(id=>document.querySelector('#ai-company')?.value===id,vrt.id);
  const run=(await(await page.request.get(root+'/api/research/runs?companyId='+vrt.id)).json()).runs[0];
  if(['queued','running'].includes(run.status)){assert.equal(await page.locator('#ai-review').isDisabled(),true);assert.equal(await page.locator('#ai-progress').isVisible(),true);assert.ok((await page.locator('#ai-progress').textContent()).includes('Research in progress'));}
  await page.waitForFunction(()=>document.querySelector('#ai-progress')?.hidden===true,{},{timeout:20000});assert.equal(await page.locator('#ai-review').isDisabled(),false);
  await page.locator('#ai-close').click();
 });
 await check('the mobile home screen fits the viewport',async()=>{
  await page.setViewportSize({width:390,height:844});await page.goto(root+'/#home');await page.locator('.home-row').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:out+'/home-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
  await page.goto(root+'/#company/'+companies[0].id+'/overview');await page.locator('#company-form').waitFor();
  if(!await page.locator('#research-panel').isVisible())await page.locator('#research-toggle').click();await page.locator('#ai-question').waitFor();await page.waitForFunction(id=>document.querySelector('#ai-company')?.value===id,companies[0].id);
 });
 await check('follow-up answer links sources and escapes source HTML',async()=>{
  await page.locator('#ai-question').fill('What evidence challenges this? <img src=x onerror=window.fixtureXSS=1>');await page.locator('#ai-ask').click();
  await waitFor(page,()=>document.querySelector('#ai-result h3')?.textContent.startsWith('What evidence challenges this?'));
  assert.equal(await page.evaluate(()=>window.fixtureXSS),undefined);assert.ok(await page.locator('#ai-result .note a').count());
  await page.reload();await waitFor(page,()=>document.querySelector('#ai-result h3')?.textContent.startsWith('What evidence challenges this?'));
 });
 await check('late background polling cannot replace a newly selected history item',async()=>{
  const list=await(await page.request.get(root+'/api/research/runs?companyId='+companies[0].id)).json();
  const question=list.runs.find(r=>r.kind==='question'),assessment=list.runs.find(r=>r.kind==='review');
  let release,received;const held=new Promise(r=>release=r),started=new Promise(r=>received=r);let intercepted=false;
  const pattern=root+'/api/research/runs/'+question.id;
  await page.route(pattern,async route=>{if(!intercepted){intercepted=true;received();await held;}await route.continue();});
  await Promise.race([started,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Expected a background history poll')),6000))]);
  await page.locator('#ai-history').selectOption(assessment.id);await page.locator('.ai-verdict').waitFor();release();
  await page.waitForTimeout(300);assert.ok(await page.locator('.ai-verdict').isVisible());
  await page.unroute(pattern);
 });
 await check('settings retain a dirty draft when another client saves; stale save is rejected',async()=>{
  await page.locator('#ai-settings > summary').click();await page.locator('#ai-criteria').fill('Browser local mandate draft with sufficient length.');
  const info=await(await page.request.get(root+'/api/research/status')).json();const {revision,...settings}=info.settings;
  const response=await page.request.post(root+'/api/research/settings',{headers:{Origin:root,'X-Research-Request':'1','If-Match':revision},data:{...settings,horizonMonths:18}});assert.equal(response.status(),200);
  await page.waitForTimeout(2800);assert.equal(await page.locator('#ai-criteria').inputValue(),'Browser local mandate draft with sufficient length.');
  await page.locator('#ai-settings-form button[type=submit]').click();await waitFor(page,()=>document.querySelector('#ai-settings-feedback').textContent.includes('changed'));
  await page.locator('#ai-settings-reload').click();await waitFor(page,()=>document.querySelector('#ai-horizon').value==='18');
  await page.locator('#ai-settings > summary').click();
 });
 await check('the mandate form saves per-stage model settings and reloads them',async()=>{
  await page.locator('#ai-settings > summary').click();await page.locator('.ai-stages summary').click();
  await page.locator('#ai-stage-analyze-effort').selectOption('high');await page.locator('#ai-stage-extract-model').fill('fixture-extract');
  await page.locator('#ai-settings-form button[type=submit]').click();await waitFor(page,()=>document.querySelector('#ai-settings-feedback').textContent.includes('Saved'));
  const info=await(await page.request.get(root+'/api/research/status')).json();assert.equal(info.settings.stageSettings.analyze.effort,'high');assert.equal(info.settings.stageSettings.extract.model,'fixture-extract');assert.equal(info.settings.stageSettings.collect.model,null);
  await page.locator('#ai-settings-reload').click();await waitFor(page,()=>document.querySelector('#ai-stage-analyze-effort').value==='high');
  await page.locator('#ai-settings > summary').click();
 });
 await check('Data & backups shows the feed status, Home refreshes Tiingo closes, and the company page saves listing and feed settings',async()=>{
  await page.goto(root+'/#data');await waitFor(page,()=>document.querySelector('#feeds-status')?.textContent.includes('Tiingo connected'));
  assert.ok((await page.locator('#feeds-status').textContent()).includes('SEC EDGAR contact set'));
  await page.goto(root+'/#home');await page.locator('#feeds-refresh').waitFor();assert.ok((await page.locator('#feeds-line').textContent()).includes('Prices:'));
  await page.locator('#feeds-refresh').click();await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Prices refreshed'),{},{timeout:75000}); // paced at most 30 Tiingo requests a minute
  await waitFor(page,()=>document.querySelector('.home-row[data-ticker="ETN"] .home-figures')?.textContent.includes('Tiingo close'));
  const status=await(await page.request.get(root+'/api/feeds/status')).json();assert.ok(status.companiesWithPrices>=1);assert.ok(status.lastFetch.updated>=1);assert.equal(status.lastFetch.kind,'manual');
  await page.goto(root+'/#company/'+companies[0].id+'/overview');await page.locator('#feed-profile').waitFor();
  assert.ok((await page.locator('#feed-profile').textContent()).includes('Latest feed close USD 123.45'));
  await page.locator('#feed-profile select[name=assetType]').selectOption('Fund');await page.locator('#feed-profile button[type=submit]').click();await waitFor(page,()=>document.querySelector('#toast')?.textContent.includes('Listing and feed settings saved'));
  await page.locator('#feed-profile').waitFor();await waitFor(page,()=>document.querySelector('#feed-profile select[name=assetType]')?.value==='Fund');
  const overview=await(await page.request.get(root+'/api/workflow/overview')).json();assert.equal(overview.companies[0].profile.assetType,'Fund');
  await page.locator('#feed-profile select[name=assetType]').selectOption('Company');await page.locator('#feed-profile button[type=submit]').click();await waitFor(page,()=>document.querySelector('#toast')?.textContent.includes('Listing and feed settings saved'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 });
 await check('Escape closes the panel and returns focus to its launcher',async()=>{
  await page.locator('#ai-question').focus();await page.keyboard.press('Escape');assert.equal(await page.locator('#research-panel').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'research-toggle');
 });
 await check('mobile panel and report fit the viewport',async()=>{
  await page.setViewportSize({width:390,height:844});await page.locator('#research-toggle').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const box=await page.locator('#research-panel').boundingBox();assert.ok(box.x>=0&&box.width<=391);
  const list=await(await page.request.get(root+'/api/research/runs?companyId='+companies[0].id)).json();const reviewId=list.runs.find(r=>r.kind==='review').id;await page.locator('#ai-history').selectOption(reviewId);await page.waitForFunction(id=>document.querySelector('#ai-result').dataset.run===id,reviewId);await page.locator('.ai-verdict').waitFor();await page.evaluate(()=>document.querySelector('.ai-verdict')?.scrollIntoView());
  await page.screenshot({path:out+'/mobile-assessment.png',fullPage:true});await page.locator('#ai-close').click();assert.equal(await page.locator('#research-panel').isVisible(),false);
 });
 await check('200%-equivalent CSS viewport fits and panel remains operable',async()=>{
  await page.setViewportSize({width:720,height:500});await page.locator('#research-toggle').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#ai-close').click();
 });
 await check('agent fills forward EPS fields and leaves unrelated snapshot inputs intact',async()=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto(root+'/#company/'+companies[0].id+'/snapshots');
  await page.locator('#snapshot-form').waitFor();await page.locator('#price').fill('123.45');await page.locator('#quoteDate').fill('2026-09-06');
  await page.locator('#priceBasis').fill('Synthetic closing price');await page.locator('#priceSourceTitle').fill('SYNTHETIC price source');
  await page.locator('details.optional-metric').first().locator('summary').click();await page.locator('#research-forward-eps').click();
  await page.locator('#ai-fill-eps').waitFor({timeout:20000});await page.locator('#ai-fill-eps').click();
  assert.equal(await page.locator('#forwardEPSValue').inputValue(),'7.25');assert.equal(await page.locator('#forwardEPSPeriod').inputValue(),'FY 2027 analyst consensus');assert.equal(await page.locator('#forwardEPSBasis').inputValue(),'Adjusted diluted EPS');assert.equal(await page.locator('#forwardEPSKind').inputValue(),'Analyst estimate');assert.equal(await page.locator('#forwardEPSPublication').inputValue(),'');
  assert.ok((await page.locator('#forwardEPSURL').inputValue()).startsWith('https://example.com/'));assert.equal(await page.locator('#currency').inputValue(),'USD');assert.equal(await page.locator('#shareBasis').inputValue(),'Diluted common share');assert.equal(await page.locator('#price').inputValue(),'123.45');assert.equal(await page.locator('#priceBasis').inputValue(),'Synthetic closing price');
  const before=(await(await page.request.get(root+'/api/workspace')).json()).workspace;assert.equal(before.snapshots.length,0);
  await page.locator('#forwardEPSValue').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/forward-eps-filled.png',fullPage:true});
 });
 await check('EPS fill blocks mismatched currencies and preserves an existing field on cancelled replacement',async()=>{
  await page.locator('#currency').selectOption('EUR');await page.locator('#ai-fill-eps').click();await waitFor(page,()=>document.querySelector('#ai-fill-feedback').textContent.includes('snapshot uses EUR'));assert.equal(await page.locator('#currency').inputValue(),'EUR');
  await page.locator('#currency').selectOption('USD');await page.locator('#forwardEPSValue').fill('8.5');await page.locator('#ai-fill-eps').click();await page.locator('#confirm-cancel').click();assert.equal(await page.locator('#forwardEPSValue').inputValue(),'8.5');
  await page.locator('#ai-fill-eps').click();await page.locator('#confirm-ok').click();assert.equal(await page.locator('#forwardEPSValue').inputValue(),'7.25');
 });
 await check('reviewed agent fields save through the normal snapshot workflow with nullable source date',async()=>{
  await page.locator('#snapshot-form button[type=submit]').click();await page.locator('.copy-snapshot').waitFor();
  const data=(await(await page.request.get(root+'/api/workspace')).json()).workspace;assert.equal(data.snapshots.length,1);assert.equal(data.snapshots[0].forwardEPS.value,7.25);assert.equal(data.snapshots[0].forwardEPS.source.publicationDate,null);assert.equal(data.snapshots[0].forwardEPS.kind,'Analyst estimate');assert.equal(data.snapshots[0].price.value,123.45);
 });
 await check('a sector request runs discovery, company research and ranking, then renders the dashboard',async()=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto(root+'/#analysis');await page.locator('#analysis-form').waitFor();
  await page.locator('#an-sector').fill('SYNTHETIC fixture sector');await page.locator('#an-seeds').fill('ETN');await page.locator('#an-max').fill('2');
  assert.ok((await page.locator('#an-estimate').textContent()).includes('13 provider requests'));
  await page.locator('#analysis-form button[type=submit]').click();
  await page.waitForURL(/#analysis\/[0-9a-f-]+$/);await page.locator('.an-progress').waitFor();
  await page.locator('.an-ranking').waitFor({timeout:60000});
  const ranks=await page.locator('.an-rank').allTextContents();assert.equal(ranks.length,2);assert.ok(ranks[0].includes('ETN'));assert.ok(ranks[1].includes('SYN'));
  assert.equal(await page.locator('.an-rank .badge.consider').count(),1);
  assert.ok(await page.locator('.an-table').count()>=3);assert.ok(await page.locator('.bars rect').count()>=2);
  const text=await page.locator('#main').textContent();assert.ok(text.includes('EV / EBITDA'));assert.ok(text.includes('Why the leaders rank first'));assert.ok(text.includes('Not analyzed'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const data=(await(await page.request.get(root+'/api/workspace')).json()).workspace;const syn=data.companies.find(c=>c.ticker==='SYN');assert.ok(syn);assert.ok(data.evidence.some(e=>e.companyId===syn.id&&e.author==='AI sector discovery'));
  await page.screenshot({path:out+'/sector-dashboard.png',fullPage:true});
 });
 await check('dashboard drill-down opens the company research in the assistant with its snapshot',async()=>{
  const runId=await page.locator('.an-rank [data-run]').first().getAttribute('data-run');await page.locator('.an-rank [data-run]').first().click();await page.locator('#research-panel').waitFor({state:'visible'});await page.waitForFunction(id=>document.querySelector('#ai-result')?.dataset.run===id,runId);await page.locator('.ai-verdict').waitFor();
  const text=await page.locator('#ai-result').textContent();assert.ok(text.includes('Financial & market snapshot'));assert.ok(text.includes('part of a sector analysis'));assert.ok(text.includes('Catalysts'));
  await page.locator('#ai-close').click();
 });
 await check('analysis history and inbox link to the dashboard; the mobile dashboard fits the viewport',async()=>{
  await page.goto(root+'/#analysis');await page.locator('.analysis-row').waitFor();assert.ok((await page.locator('.analysis-row').first().textContent()).includes('Top: ETN'));
  await page.goto(root+'/#research');await page.locator('#ai-inbox-rows a[href^="#analysis/"]').first().waitFor();
  await page.setViewportSize({width:390,height:844});await page.locator('#ai-inbox-rows a[href^="#analysis/"]').first().click();await page.locator('.an-ranking').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:out+'/mobile-sector-dashboard.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 });
 assert.deepEqual(errors,[]);checks.push('No browser JavaScript errors');
 writeFileSync(out+'/results.json',JSON.stringify({checks,errors,provider:'Synthetic only; no OpenAI calls',viewportSizes:['1440×1000','390×844','720×500 (200%-equivalent)']},null,2));
 console.log(JSON.stringify({passed:checks.length,errors}));
}catch(error){console.error('FAILED after',checks.length,'checks:',error.message);console.error('Page errors:',JSON.stringify(errors));throw error;}finally{await browser?.close();if(child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}}
