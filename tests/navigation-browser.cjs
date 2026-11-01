// npm install --no-save playwright ; npx playwright install chromium
// node tests/navigation-browser.cjs
// CHROMIUM_PATH may select an existing Chromium executable.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
let legacyWorker=false;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/sw.js'&&legacyWorker){
  res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
  res.end(`self.addEventListener('install',e=>e.waitUntil(caches.open('fdc-console-nuit-v8').then(c=>c.add('index.html')).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`);return;
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(err?'Not found':data);});
});
const modules=['dashboard','scenario','combat','sound','visual'];
const panelIds=['homePanel','scenario','combat','sound','visual'];
async function visible(page){return page.locator('.shell > .panel, .shell > .grid > .panel').evaluateAll(els=>els.filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>el.id));}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const size of (process.env.CACHE_ONLY?[]:[{width:1280,height:800},{width:800,height:1280},{width:600,height:960}])){
   const context=await browser.newContext({viewport:size,hasTouch:true,isMobile:true,serviceWorkers:'block'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin);await page.frameLocator('#combatFrame').locator('#homeScreen').waitFor({state:'attached'});
   assert.equal(await page.locator('header .nav button').count(),5);
   assert.equal(await page.locator('header .nav button svg').count(),5);
   assert.deepEqual(await visible(page),['homePanel']);
   const before=await page.evaluate(()=>({data:localStorage.getItem(key),frame:document.querySelector('#combatFrame').srcdoc}));
   await page.evaluate(()=>{window.testFrame=document.querySelector('#combatFrame').contentWindow;window.testPads=document.querySelector('#pads').firstChild;window.switchTimings=[];document.querySelector('header .nav').addEventListener('click',()=>{const start=performance.now();requestAnimationFrame(()=>window.switchTimings.push(performance.now()-start));},true)});
   const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   // Every source -> destination, including tapping the already selected module.
   for(const from of modules){
    await page.locator(`[data-module="${from}"]`).tap();
    for(const to of modules){
     await page.locator(`[data-module="${to}"]`).tap();
     assert.deepEqual(await visible(page),[panelIds[modules.indexOf(to)]],`${from} -> ${to}`);
     assert.equal(await page.locator('header .nav button.active').getAttribute('data-module'),to);
     await page.locator(`[data-module="${from}"]`).tap();
    }
   }
   for(let i=0;i<30;i++)for(const to of ['sound','visual']){
    await page.locator(`[data-module="${to}"]`).tap();
    assert.deepEqual(await visible(page),[to]);
   }
   assert(await page.evaluate(()=>window.testFrame===document.querySelector('#combatFrame').contentWindow&&window.testPads===document.querySelector('#pads').firstChild));
   assert.deepEqual(await page.evaluate(()=>({data:localStorage.getItem(key),frame:document.querySelector('#combatFrame').srcdoc})),before);
   await page.locator('[data-module="sound"]').tap();
   await page.locator('#pads .pad').first().tap();
   await page.waitForFunction(()=>playing.size===1);await page.locator('[data-module="visual"]').tap();
   assert(await page.evaluate(()=>playing.size===1&&![...playing.values()][0].paused));
   await page.locator('[data-module="sound"]').tap();await page.getByRole('button',{name:'TOUT ARRÊTER'}).click();
   assert.equal(await page.evaluate(()=>playing.size),0);
   const timings=await page.evaluate(()=>window.switchTimings);timings.sort((a,b)=>a-b);
   console.log(`${size.width}x${size.height}: five modules, all pairs + 60 sound/visual switches, audio persistence OK; click->frame p95=${timings[Math.floor(timings.length*.95)].toFixed(1)}ms (CPU x4)`);
   assert.deepEqual(errors,[]);await context.close();
  }
  // Real service worker: installation, scoped cleanup, local data, offline reopening.
  legacyWorker=true;
  const context=await browser.newContext({hasTouch:true});const page=await context.newPage();
  console.log('Cache: loading legacy worker');await page.goto(origin);console.log('Cache: page loaded');await page.evaluate(async()=>{
   await caches.open('unrelated-app');await caches.open('fdc-console-nuit-v8');
   localStorage.setItem('navigation-test','preserved');await putFile('navigation-test',new File(['kept'],'test.txt'));
   await navigator.serviceWorker.ready;
  });
  console.log('Cache: awaiting controller');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert((await page.evaluate(()=>caches.keys())).includes('fdc-console-nuit-v8'));
  legacyWorker=false;
  const reload=page.waitForEvent('load');
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update()});
  console.log('Cache: awaiting updated reload');await reload;
  console.log('Cache: awaiting controller');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.deepEqual((await page.evaluate(()=>caches.keys())).sort(),['fdc-console-nuit-v10','unrelated-app']);
  await context.setOffline(true);await page.reload();
  await page.locator('[data-module="visual"]').tap();assert.deepEqual(await visible(page),['visual']);
  assert.equal(await page.evaluate(()=>localStorage.getItem('navigation-test')),'preserved');
  assert.equal(await page.evaluate(async()=>(await getFile('navigation-test')).text()),'kept');
  console.log('Service worker v8 -> v10: automatic reload, offline reload, cache cleanup scope, localStorage and IndexedDB OK');
  await context.close();
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
