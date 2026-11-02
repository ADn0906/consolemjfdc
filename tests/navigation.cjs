const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1280,height:800},{width:800,height:1280},{width:600,height:900}]){
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.FDC_URL||'http://localhost:8765');
  await page.waitForFunction(()=>document.body.dataset.activeModule==='dashboard');
  assert.equal(await page.locator('header .nav button[data-module]').count(),5);
  const sequence=['scenario','combat','sound','visual','dashboard',...Array.from({length:40},(_,i)=>i%2?'visual':'sound'),'combat','scenario','dashboard'];
  for(const module of sequence){
   await page.locator(`header button[data-module="${module}"]`).click();
   const visible=await page.locator('#homePanel,.shell>.grid>.panel').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height).map(n=>n.id));
   assert.deepEqual(visible,module==='dashboard'?['scenario','combat','sound','visual']:[module]);
  }
  assert.equal(await page.locator('#combatFrame').getAttribute('data-loaded'),'1');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({viewport,clicks:sequence.length,visiblePanels:'one per click',errors}));
  await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
