/* Portable campaign archives. Files stay on the user's devices. */
const FDC_TRANSFER_FORMAT='fdc-campaign';
const FDC_TRANSFER_MAX=256*1024*1024;
function fdcCombatKey(name){return name===RACINES.name?'fdc-combat-racines-v1':name==='La Nuit des Morts-Vivants'?'fdc-combat-v12-demo-3':'fdc-combat-custom-'+encodeURIComponent(name);}
function fdcTransferStatus(message){const el=document.getElementById('fdcTransferStatus');if(el)el.textContent=message;}
function fdcTransferDialog(){
 dialog('Transférer une campagne',`<p>Campagne sélectionnée : <strong>${escapeHTML(state.campaign)}</strong></p><p>Prépare sur PC, exporte le fichier, puis ouvre-le avec « Importer » sur la tablette. Le transfert comprend le scénario, les PJ, les monstres, les images et les sons associés.</p><button id="fdcExportButton" type="button" style="min-height:48px;width:100%" onclick="fdcExportCampaign()">↓ Exporter cette campagne</button><label for="fdcImportFile">↑ Importer une campagne depuis un fichier</label><input id="fdcImportFile" type="file" accept=".fdc,.json,application/json,application/gzip" onchange="fdcChooseImport(this.files[0])"><p id="fdcTransferStatus" role="status" aria-live="polite"></p>`,closeDialog,'Fermer');
}
async function fdcStoredFile(id){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('files','readonly'),request=tx.objectStore('files').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function fdcBlobBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.slice(reader.result.indexOf(',')+1));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
function fdcSafeMediaUrl(url){try{const u=new URL(url,document.baseURI);return ['http:','https:','blob:'].includes(u.protocol)||/^data:(image\/|audio\/|application\/pdf[;,])/i.test(url);}catch{return false;}}
async function fdcBuildCampaignArchive(){
 const name=state.campaign;
 const frame=$('combatFrame');
 if(!frame.contentWindow?.fdcExportSnapshot||frame.contentWindow.fdcSnapshotStorageKey!==fdcCombatKey(name))throw new Error('Le module Combat se charge encore. Réessaie dans un instant.');
 const combat=frame.contentWindow.fdcExportSnapshot();
 const visuals=structuredClone(state.visuals.filter(v=>(v.campaign||'La Nuit des Morts-Vivants')===name));
 const tables=structuredClone(state.tables.filter(t=>t.name===name));
 const library=JSON.parse(localStorage.getItem('fdc-global-monster-library-v1')||'[]');
 const resources=[],files=[],cached=new Map();let total=0;
 async function addBlob(blob,label){
  if(!(blob instanceof Blob)||!blob.size)throw new Error('Fichier vide ou illisible : '+label);
  total+=blob.size;if(total>FDC_TRANSFER_MAX*.7)throw new Error('Cette campagne est trop volumineuse pour un transfert sur tablette (environ 180 Mo de médias maximum).');
  const id='r'+resources.length;resources.push({id,name:blob.name||label,mime:blob.type||'application/octet-stream',data:await fdcBlobBase64(blob)});return id;
 }
 async function remote(url,label){
  if(url.startsWith('fdc-file:')){if(!cached.has(url))cached.set(url,(async()=>{const file=await fdcStoredFile(url.slice(9));if(!file)throw new Error('Fichier manquant : '+label);return addBlob(file,label);})());return cached.get(url);}
  if(!fdcSafeMediaUrl(url))throw new Error('Adresse de fichier invalide : '+label);
  if(!cached.has(url))cached.set(url,(async()=>{fdcTransferStatus('Préparation : '+label+'…');const response=await fetch(url);if(!response.ok)throw new Error('Fichier inaccessible : '+label);return addBlob(await response.blob(),label);})());
  return cached.get(url);
 }
 async function attachment(id,url,label){const local=await fdcStoredFile(id);if(local){fdcTransferStatus('Préparation : '+label+'…');files.push({id,resource:await addBlob(local,label)});}else if(url)files.push({id,resource:await remote(url,label)});}
 for(const v of visuals){await attachment(v.id,v.url||FDC_IMAGES[v.bundledFile],v.fileName||v.name);}
 for(const t of tables)for(const sound of t.sounds){await attachment(sound.id,sound.url||FDC_AUDIO[sound.id],sound.fileName||sound.name);}
 // Embed portraits and original stat sheets once, even when shared by the library.
 for(const pj of combat.pj){if(!pj.photo){const bundled=Object.entries(FDC_IMAGES).find(([name])=>name.toLocaleLowerCase('fr')===pj.name.trim().toLocaleLowerCase('fr')+'.png');if(bundled)pj.photo=bundled[1];}}
 for(const record of [...combat.pj,...combat.bestiary,...library])for(const property of ['photo','sourceImage']){
  if(record[property])record[property]='fdc-resource:'+await remote(record[property],record.name||'Portrait');
 }
 return {format:FDC_TRANSFER_FORMAT,version:1,createdAt:new Date().toISOString(),campaign:name,notes:state.notes[name]||'',visuals,tables,combat,library,files,resources,settings:{master:state.master,loop:state.loop},dismissed:JSON.parse(localStorage.getItem('fdc-oneshot-dismissed-v1')||'[]')};
}
async function fdcEncodeArchive(packet){const json=JSON.stringify(packet);if(new Blob([json]).size>FDC_TRANSFER_MAX)throw new Error('Le fichier de campagne dépasse la limite de 256 Mo.');const source=new Blob([json],{type:'application/json'});if(typeof CompressionStream==='function')return new Response(source.stream().pipeThrough(new CompressionStream('gzip'))).blob();return source;}
async function fdcExportCampaign(){
 const button=$('fdcExportButton');if(button)button.disabled=true;
 try{const packet=await fdcBuildCampaignArchive();fdcTransferStatus('Création du fichier de transfert…');const archive=await fdcEncodeArchive(packet);const name=packet.campaign.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'_');const url=URL.createObjectURL(archive),link=document.createElement('a');link.href=url;link.download='FDC_'+name+'_'+new Date().toISOString().slice(0,10)+'.fdc';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);fdcTransferStatus('Fichier exporté. Transfère-le sur la tablette, puis choisis « Importer » dans la console.');}
 catch(error){fdcTransferStatus('Export impossible : '+error.message);}finally{if(button)button.disabled=false;}
}
async function fdcReadBounded(stream){const reader=stream.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>FDC_TRANSFER_MAX)throw new Error('Fichier trop volumineux (256 Mo maximum après décompression).');chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}return new Blob(chunks);}
async function fdcDecodeArchive(file){
 if(!file||file.size>FDC_TRANSFER_MAX)throw new Error('Choisis un fichier de campagne de moins de 256 Mo.');
 const signature=new Uint8Array(await file.slice(0,2).arrayBuffer());let source=file;
 if(signature[0]===31&&signature[1]===139){if(typeof DecompressionStream!=='function')throw new Error('Ce navigateur ne peut pas lire ce fichier compressé. Mets le navigateur à jour.');source=await fdcReadBounded(file.stream().pipeThrough(new DecompressionStream('gzip')));}
 let packet;try{packet=JSON.parse(await source.text(),(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw new Error('Propriété interdite');return value;});}catch{throw new Error('Ce fichier n’est pas une sauvegarde de campagne FDC valide.');}
 fdcValidateArchive(packet);return packet;
}
function fdcValidateArchive(p){
 const fail=()=>{throw new Error('Fichier de campagne incomplet ou endommagé.');};
 const text=(v,max=1000000)=>typeof v==='string'&&v.length<=max;
 const array=(v,max=10000)=>Array.isArray(v)&&v.length<=max;
 const unique=items=>new Set(items.map(v=>v.id)).size===items.length;
 if(!p||p.format!==FDC_TRANSFER_FORMAT||p.version!==1||!text(p.campaign,150)||!p.campaign.trim()||['__proto__','constructor','prototype'].includes(p.campaign)||!text(p.notes)||!array(p.visuals)||!array(p.tables)||!array(p.library)||!array(p.files)||!array(p.resources)||!p.combat)fail();
 const c=p.combat;if(!array(c.pj)||!array(c.bestiary)||!array(c.mobs)||!array(c.done)||!unique([...c.pj,...c.mobs])||!unique(c.bestiary))fail();
 const id=v=>v&&text(v.id,250)&&v.id.length>0;
 for(const v of p.visuals)if(!id(v)||!text(v.name,500)||!['PJ','PNJ','Lieux','Indices'].includes(v.tab))fail();
 for(const t of p.tables){if(!id(t)||!array(t.sounds))fail();for(const v of t.sounds)if(!id(v)||!text(v.name,500)||!/^#[a-f0-9]{6}$/i.test(v.color))fail();}
 if(!unique(p.visuals)||!unique(p.tables.flatMap(t=>t.sounds)))fail();
 for(const v of [...c.bestiary,...p.library])if(!id(v)||!text(v.name,500)||!Number.isFinite(v.ca)||v.ca<0||!Number.isFinite(v.hp)||v.hp<1||!text(v.abilities||'')||!text(v.description||''))fail();
 for(const v of c.pj)if(!id(v)||!text(v.name,500)||(v.ca!==null&&(!Number.isFinite(v.ca)||v.ca<0)))fail();
 for(const v of c.mobs)if(!id(v)||!text(v.name,500)||!Number.isFinite(v.hp)||!c.bestiary.some(t=>t.id===v.type))fail();
 if(!Number.isInteger(c.round)||c.round<1||c.done.some(id=>![...c.pj,...c.mobs].some(v=>v.id===id))||(c.current!=null&&![...c.pj,...c.mobs].some(v=>v.id===c.current)))fail();
 if(!unique(p.resources)||!p.resources.every(r=>id(r)&&text(r.name,1000)&&text(r.mime,150)&&/^[\w.+-]+\/[\w.+-]+$/.test(r.mime)&&text(r.data,FDC_TRANSFER_MAX)&&r.data.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(r.data)))fail();
 const resourceIds=new Set(p.resources.map(r=>r.id)),owners=new Set([...p.visuals,...p.tables.flatMap(t=>t.sounds)].map(v=>v.id));
 if(!unique(p.files)||p.files.some(f=>!id(f)||!owners.has(f.id)||!resourceIds.has(f.resource)))fail();
 for(const v of [...c.pj,...c.bestiary,...p.library])for(const property of ['photo','sourceImage'])if(v[property]&&(!text(v[property],500)||!v[property].startsWith('fdc-resource:')||!resourceIds.has(v[property].slice(13))))fail();
 if(p.dismissed!==undefined&&(!array(p.dismissed)||p.dismissed.some(v=>!text(v,250))))fail();
 return p;
}
async function fdcChooseImport(file){
 if(!file)return;fdcTransferStatus('Lecture du fichier…');try{const packet=await fdcDecodeArchive(file);fdcPreviewImport(packet);}catch(error){fdcTransferStatus('Import impossible : '+error.message);}
}
function fdcPreviewImport(packet){
 const exists=state.visuals.some(v=>v.campaign===packet.campaign)||Object.hasOwn(state.notes,packet.campaign);
 dialog('Importer « '+packet.campaign+' »',`<p><strong>${escapeHTML(packet.campaign)}</strong></p><ul><li>${packet.combat.pj.length} PJ · ${packet.combat.bestiary.length} types de monstres</li><li>${packet.visuals.length} visuels · ${packet.tables.reduce((n,t)=>n+t.sounds.length,0)} sons</li><li>Scénario et ${packet.resources.length} fichiers inclus</li></ul><p>${exists?'Le contenu de cette campagne sera remplacé par celui du fichier.':'Cette campagne sera ajoutée à la console.'} Les autres campagnes sont conservées. La bibliothèque de monstres sera enrichie.</p><p id="fdcTransferStatus" role="status" aria-live="polite"></p>`,async()=>{const button=$('dialogOk');button.disabled=true;try{fdcTransferStatus('Import en cours…');await fdcApplyCampaignArchive(packet);closeDialog();dialog('Campagne importée',`<p>« ${escapeHTML(packet.campaign)} » est prête, avec ses fichiers et ses monstres.</p>`,closeDialog,'Fermer');}catch(error){fdcTransferStatus('Import impossible : '+error.message);}finally{button.disabled=false;}},exists?'Remplacer cette campagne':'Importer cette campagne');
}
function fdcRestoreStorage(snapshot){for(const [key,value] of snapshot){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}}
async function fdcApplyCampaignArchive(packet){
 fdcValidateArchive(packet);const p=structuredClone(packet),prefix='fdci-'+crypto.randomUUID()+'-',remapped=new Map();
 const resources=new Map();let total=0;
 for(const r of p.resources){const bytes=Uint8Array.from(atob(r.data),c=>c.charCodeAt(0));total+=bytes.length;if(total>FDC_TRANSFER_MAX*.7)throw new Error('Les médias de ce fichier sont trop volumineux.');resources.set(r.id,{...r,blob:new Blob([bytes],{type:r.mime})});}
 const media=ref=>{const r=resources.get(ref.slice(13));if(!r||!r.mime.startsWith('image/'))throw new Error('Portrait ou fiche originale invalide.');return 'fdc-file:'+prefix+r.id;};
 for(const v of [...p.combat.pj,...p.combat.bestiary,...p.library])for(const property of ['photo','sourceImage'])if(v[property])v[property]=media(v[property]);
 for(const [index,v] of p.visuals.entries()){const old=v.id;v.id=prefix+'visual-'+index;remapped.set(old,v.id);v.campaign=p.campaign;delete v.url;delete v.bundledFile;}
 for(const [index,t] of p.tables.entries()){t.id=prefix+'table-'+index;t.name=p.campaign;for(const [i,v] of t.sounds.entries()){const old=v.id;v.id=prefix+'sound-'+index+'-'+i;remapped.set(old,v.id);delete v.url;}}
 for(const f of p.files){const r=resources.get(f.resource);const owner=[...p.visuals,...p.tables.flatMap(t=>t.sounds)].find(v=>v.id===remapped.get(f.id));if(owner){owner.fileName=r.name;owner.mime=r.mime;}}
 const actors=new Map(),types=new Map();for(const [i,t] of p.combat.bestiary.entries()){const old=t.id;t.id=prefix+'type-'+i;types.set(old,t.id);}
 for(const [i,v] of p.combat.pj.entries()){const old=v.id;v.id=prefix+'pj-'+i;actors.set(old,v.id);if(v.crop)v.crop={x:Number(v.crop.x)||50,y:Number(v.crop.y)||50,z:Number(v.crop.z)||1};}
 for(const [i,v] of p.combat.mobs.entries()){const old=v.id;v.id=prefix+'mob-'+i;v.type=types.get(v.type);actors.set(old,v.id);}
 p.combat.done=p.combat.done.map(id=>actors.get(id));p.combat.current=p.combat.current==null?null:actors.get(p.combat.current);
 // Keep built-in type IDs: startup migrations can recognize these instead of re-adding them.
 for(const [old,replacement] of types)if(old.startsWith('racines-')||old.startsWith('fdc-oneshot-')){p.combat.bestiary.find(t=>t.id===replacement).id=old;for(const m of p.combat.mobs)if(m.type===replacement)m.type=old;}
 const next=structuredClone(state);next.notes[p.campaign]=p.notes;next.visuals=next.visuals.filter(v=>(v.campaign||'La Nuit des Morts-Vivants')!==p.campaign).concat(p.visuals);next.tables=next.tables.filter(t=>t.name!==p.campaign).concat(p.tables);next.campaign=p.campaign;next.table=p.tables[0]?.id||'';next.racinesImportedV1=true;
 if(p.settings&&Number.isFinite(p.settings.master))next.master=Math.max(0,Math.min(100,p.settings.master));if(typeof p.settings?.loop==='boolean')next.loop=p.settings.loop;
 next.transferCampaigns=[...new Set([...(next.transferCampaigns||[]),p.campaign])];
 const libraryKey='fdc-global-monster-library-v1',merged=JSON.parse(localStorage.getItem(libraryKey)||'[]');
 for(const [i,v] of p.library.entries()){const found=merged.findIndex(t=>t.id===v.id||t.name.toLocaleLowerCase('fr')===v.name.toLocaleLowerCase('fr'));if(found>=0)merged[found]={...v,id:merged[found].id};else merged.push({...v,id:prefix+'library-'+i});}
 const updates=new Map([[key,JSON.stringify(next)],[fdcCombatKey(p.campaign),JSON.stringify(p.combat)],[libraryKey,JSON.stringify(merged)]]);
 if(p.campaign==='La Nuit des Morts-Vivants')updates.set('fdc-oneshot-dismissed-v1',JSON.stringify(p.dismissed||[]));
 const before=new Map([...updates.keys()].map(k=>[k,localStorage.getItem(k)]));const database=await db();
 await new Promise((resolve,reject)=>{const tx=database.transaction('files','readwrite');let failure;tx.oncomplete=resolve;tx.onabort=()=>{try{fdcRestoreStorage(before);}catch{}reject(failure||tx.error||new Error('Stockage insuffisant ; les données précédentes ont été conservées.'));};tx.onerror=()=>{};
 try{for(const [id,r] of resources)tx.objectStore('files').put(new File([r.blob],r.name,{type:r.mime}),prefix+id);for(const f of p.files){const r=resources.get(f.resource);tx.objectStore('files').put(new File([r.blob],r.name,{type:r.mime}),remapped.get(f.id));}for(const [k,v] of updates)localStorage.setItem(k,v);}catch(error){failure=error;tx.abort();}});
 stopAll();closeFdcImageViewer();state=next;fdcRegisterTransferCampaigns();render();fdcLoadCombat();goModule('dashboard');
}
function fdcRegisterTransferCampaigns(){for(const name of state.transferCampaigns||[])if(![...$('campaign').options].some(o=>o.value===name)){const option=document.createElement('option');option.value=name;option.textContent=name;option.selected=name===state.campaign;$('campaign').append(option);}}
fdcRegisterTransferCampaigns();
