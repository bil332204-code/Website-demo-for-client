import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import { mkdtempSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { pages } from '../src/pages.js';
let base=process.env.TEST_BASE_URL,server,store,tempDir;
const token=randomBytes(32).toString('hex');
if(!base){
 if(!existsSync('dist/index.html'))throw new Error('Run npm run build before browser tests.');
 tempDir=mkdtempSync(join(tmpdir(),'samp-browser-'));store=createStore(join(tempDir,'test.sqlite'));
 server=createApp({store,config:{adminToken:token,appOrigin:'',distPath:resolve('dist'),trustProxy:0},notifier:{enabled:false}}).listen(0,'127.0.0.1');
 await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
}

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>errors.push(e.message));
let checks=0;
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
try{
 await page.goto(base,{waitUntil:'networkidle'});
 await check('Homepage and WebGL hero render',async()=>{await page.getByRole('heading',{level:1}).waitFor();await page.locator('.hero .design-scene[data-state=playing] canvas').waitFor();assert.match(await page.title(),/SAMP —/);assert.equal((await page.locator('.header .brand').innerText()).trim(),'SAMP');assert.doesNotMatch(await page.locator('body').innerText(),/SAMP\s+Ventures/);});
 await check('Cinematic background changes frames and pauses cleanly',async()=>{
  const clip={x:1100,y:200,width:200,height:220};
  const first=await page.screenshot({clip});await page.waitForTimeout(400);assert.notDeepEqual(await page.screenshot({clip}),first);
  await page.getByRole('button',{name:'Pause ambient motion'}).click();await page.locator('.hero .design-scene[data-state=still]').waitFor();
  const still=await page.screenshot({clip});await page.waitForTimeout(400);assert.deepEqual(await page.screenshot({clip}),still);
  await page.getByRole('button',{name:'Enable ambient motion'}).click();await page.locator('.hero .design-scene[data-state=playing]').waitFor();
 });
 await check('All nine disciplines show correct details',async()=>{await page.goto(base+'/expertise',{waitUntil:'networkidle'});const tabs=page.getByRole('tab');assert.equal(await tabs.count(),9);for(let i=0;i<9;i++){const tab=tabs.nth(i);await tab.click();assert.equal(await tab.getAttribute('aria-selected'),'true');const panel=page.getByRole('tabpanel');await panel.getByRole('button',{name:'Discover the possibilities'}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.locator('.feature-list li').count(),5);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);}});
 await check('Service tab keyboard navigation',async()=>{await page.getByRole('tab').first().click();await page.keyboard.press('ArrowDown');assert.equal(await page.getByRole('tab').nth(1).getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await page.getByRole('tab').last().getAttribute('aria-selected'),'true');});
 await check('Consultation handles API failures, preserves fields, and saves a receipt',async()=>{
  await page.getByRole('button',{name:'Book a consultation',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Send my inquiry'}).click();assert.equal(await dialog.getByRole('status').count(),0);
  await dialog.getByLabel('Your name').fill('Test Engineer');await dialog.getByLabel('Email address').fill('engineer@example.com');await dialog.getByLabel('What are you exploring?').selectOption({label:'Engineering analysis'});await dialog.getByLabel('Tell us about your idea').fill('We need structural analysis for our prototype assembly.');await dialog.getByRole('checkbox').check();
  const keys=[];const collect=req=>{if(req.url().endsWith('/api/inquiries')&&req.method()==='POST')keys.push(req.headers()['idempotency-key']);};page.on('request',collect);
  await page.route('**/api/inquiries',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporarily unavailable. Please retry.'})}),{times:1});
  await dialog.getByRole('button',{name:'Send my inquiry'}).click();await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('Your name').inputValue(),'Test Engineer');
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/inquiries')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Send my inquiry'}).click();const response=await responsePromise;assert.equal(response.status(),201);const receipt=await response.json();
  await dialog.getByRole('status').waitFor();assert.ok((await dialog.getByRole('status').textContent()).includes(receipt.id));assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);page.off('request',collect);
  if(store)assert.equal(store.db.prepare('SELECT name FROM inquiries WHERE id=?').get(receipt.id).name,'Test Engineer');
  await page.keyboard.press('Escape');
 });
 await check('Learning inquiries preselect the mentorship',async()=>{await page.goto(base+'/learning',{waitUntil:'networkidle'});await page.getByRole('button',{name:/01 \/ MENTORSHIP SolidWorks/}).click();assert.equal(await page.getByRole('dialog').locator('select').inputValue(),'SolidWorks mentorship');await page.keyboard.press('Escape');});
 await check('Product catalogue accurately offers inquiries',async()=>{await page.goto(base+'/products',{waitUntil:'networkidle'});await page.getByText('Our public product catalogue is not available yet.',{exact:false}).waitFor();await page.getByRole('button',{name:'Talk products with us'}).click();assert.equal(await page.getByRole('dialog').locator('select').inputValue(),'Product inquiry');await page.keyboard.press('Escape');});
 await check('FAQ opens and closes',async()=>{await page.goto(base+'/contact',{waitUntil:'networkidle'});const button=page.getByRole('button',{name:'Do you work with startups and students?'});await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');await button.click();assert.equal(await button.getAttribute('aria-expanded'),'false');});
 await check('All local images load and anchor targets exist',async()=>{for(const image of await page.locator('img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode());}const invalid=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash));assert.deepEqual(invalid,[]);});
 await check('All eight pages support direct visits, refresh, unique metadata, backgrounds, and responsive content',async()=>{
  const audit=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});audit.on('pageerror',e=>errors.push(e.message));
  try{const titles=new Set();for(const route of pages){
   const response=await audit.goto(base+route.path,{waitUntil:'networkidle'});assert.equal(response.status(),200);const html=await response.text();assert.ok(html.includes(route.title.replaceAll('&','&amp;')));assert.ok(html.includes('rel="canonical"'));
   await audit.locator('.design-scene[data-state=still]').first().waitFor();assert.equal(await audit.locator('h1').count(),1);assert.equal(await audit.locator('.design-scene-'+route.variant).count(),1);titles.add(await audit.title());
   if(route.key!=='home')assert.equal(await audit.locator('.header [aria-current=page]').getAttribute('href'),route.path);
   for(const image of await audit.locator('img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(i=>i.decode());}
   const invalid=await audit.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash));assert.deepEqual(invalid,[]);
   for(const width of [1920,1440,1366,1024,820,768,600,430,390,360,320]){await audit.setViewportSize({width,height:900});assert.equal(await audit.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow on ${route.path} at ${width}`);}
   await audit.setViewportSize({width:1440,height:1000});
  }assert.equal(titles.size,8);const response=await audit.reload({waitUntil:'networkidle'});assert.equal(response.status(),200);assert.equal(new URL(audit.url()).pathname,'/contact');
  }finally{await audit.close();}
 });
 await check('Navigation changes documents and browser history restores pages',async()=>{
  await page.goto(base+'/');await page.locator('.header .navigation a[href="/about"]').click();await page.waitForURL(base+'/about');assert.equal(await page.locator('#page-title').count(),1);
  await page.goBack({waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,'/');await page.goForward({waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,'/about');
 });
 await check('Unknown URLs return a useful 404 and sitemap lists public pages only',async()=>{
  const response=await page.goto(base+'/missing-page',{waitUntil:'networkidle'});assert.equal(response.status(),404);await page.getByRole('link',{name:'Return home',exact:true}).waitFor();assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex, nofollow');
  const sitemap=await (await page.request.get(base+'/sitemap.xml')).text();assert.equal((sitemap.match(/<url>/g)||[]).length,8);assert.ok(!sitemap.includes('/admin'));assert.ok((await (await page.request.get(base+'/robots.txt')).text()).includes('Disallow: /admin'));
 });
 await check('No horizontal overflow at desktop, tablet, mobile widths',async()=>{const fresh=await browser.newPage({viewport:{width:1366,height:768}});try{await fresh.goto(base,{waitUntil:'networkidle'});for(const width of [390,320,820]){await fresh.setViewportSize({width,height:844});assert.equal(await fresh.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Unrevealed animations overflow at ${width}`);}}finally{await fresh.close();}for(const width of [1920,1440,1366,1024,820,768,600,430,390,360,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Overflow at ${width}`);}});
 await page.goto(base+'/',{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});
 await check('Mobile navigation, dropdown, and anchors work',async()=>{await page.evaluate(()=>window.scrollTo(0,0));await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('button',{name:'Browse engineering disciplines',exact:true}).click();await page.getByRole('link',{name:'AI & intelligent systems',exact:true}).click();await page.waitForURL('**/expertise?discipline=ai-intelligent-systems#expertise');assert.equal(await page.getByRole('button',{name:'Open menu'}).getAttribute('aria-expanded'),'false');assert.equal(await page.getByRole('tab').nth(3).getAttribute('aria-selected'),'true');});
 await check('Motion control pauses animation',async()=>{await page.getByRole('button',{name:'Pause ambient motion'}).click();assert.equal(await page.locator('html').getAttribute('data-motion'),'off');await page.locator('.page-backdrop .design-scene[data-state=still]').waitFor();await page.goto(base+'/learning',{waitUntil:'networkidle'});assert.equal(await page.locator('html').getAttribute('data-motion'),'off');await page.locator('.page-backdrop .design-scene[data-state=still]').waitFor();});
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await check('Operating system reduced-motion preference is honored',async()=>{await reduced.goto(base,{waitUntil:'networkidle'});assert.equal(await reduced.locator('html').getAttribute('data-motion'),'off');await reduced.locator('.hero .design-scene[data-state=still]').waitFor();});
 await reduced.close();
 if(store)await check('Admin login, search, status updates, and deletion work end to end',async()=>{
  const admin=await browser.newPage({viewport:{width:1280,height:900}});admin.on('pageerror',e=>errors.push(e.message));
  await admin.goto(base+'/admin',{waitUntil:'networkidle'});await admin.getByLabel('Administrator token').fill('wrong-token');await admin.getByRole('button',{name:'Open the inbox'}).click();await admin.getByRole('alert').waitFor();
  await admin.getByLabel('Administrator token').fill(token);await admin.getByRole('button',{name:'Open the inbox'}).click();await admin.getByRole('heading',{name:'Incoming possibilities.'}).waitFor();
  await admin.getByRole('button',{name:/Test Engineer engineer@example.com/}).click();await admin.getByRole('heading',{name:'Test Engineer'}).waitFor();assert.ok((await admin.locator('.inquiry-message').textContent()).includes('structural analysis'));
  await admin.getByLabel('Update status').selectOption('in_progress');await admin.locator('.status-badge.in_progress').waitFor();
  await admin.getByLabel('Search inquiries').fill('no-such-person');await admin.getByRole('button',{name:'Search',exact:true}).click();await admin.getByText('No inquiries match this filter.').waitFor();
  await admin.getByLabel('Search inquiries').fill('Test Engineer');await admin.getByRole('button',{name:'Search',exact:true}).click();await admin.getByRole('button',{name:/Test Engineer engineer@example.com/}).click();
  await admin.getByRole('button',{name:'Delete inquiry',exact:true}).click();await admin.getByRole('button',{name:'Yes, delete permanently'}).click();await admin.getByText('No inquiries match this filter.').waitFor();assert.equal(store.db.prepare('SELECT count(*) AS n FROM inquiries').get().n,0);
  await admin.setViewportSize({width:390,height:844});assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await admin.getByRole('button',{name:'Sign out'}).click();await admin.getByLabel('Administrator token').waitFor();await admin.close();
 });
 await check('No uncaught browser errors',async()=>assert.deepEqual(errors,[]));
 console.log(`\n${checks} checks passed.`);
}finally{await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();rmSync(tempDir,{recursive:true,force:true});}}
