const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const handlers={},deleted=[],added=[];let claimed=false,skipped=false;
const context={location:{origin:'https://example.test'},URL,console,caches:{open:async()=>({add:async f=>{if(f!=='./')assert.ok(fs.existsSync(f),f);added.push(f)}}),keys:async()=>['fdc-console-nuit-v8','fdc-console-nuit-v9','unrelated-cache'],delete:async key=>deleted.push(key)},self:{addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:()=>{skipped=true},clients:{claim:async()=>{claimed=true}}}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),context);let pending;
handlers.install({waitUntil:p=>pending=p});await pending;
handlers.activate({waitUntil:p=>pending=p});await pending;
assert.deepEqual(deleted,['fdc-console-nuit-v8']);assert.ok(skipped&&claimed);console.log('Cache install/activation passed; '+added.length+' exact asset paths; old app cache removed; unrelated cache retained.');
})().catch(e=>{console.error(e);process.exit(1)});
