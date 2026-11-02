/* Names in scenario notes link only to visuals in the active campaign. */
function fdcScenarioFold(text){return String(text).replace(/[Œœ]/g,'oe').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'");}
function fdcScenarioTargets(){
 const candidates=new Map();
 const aliases={'varn de valcour':['Varn'],'malkor veyr':['Malkor'],'beladone':['Belladone'],'coeur de ronces':['Cœur de Ronces','Cœur de Ronce','Syndal Val-Boisé'],'sylvania':['Sylvana'],'bourse rituelle et pieces d’or':['bourse','100 Pièces du Passage'],'bourse rituelle et pieces d\'or':['bourse','100 Pièces du Passage']};
 for(const v of state.visuals){if((v.campaign||'La Nuit des Morts-Vivants')!==state.campaign||!(v.url||v.fileName||v.bundledFile))continue;
  const names=[v.name,...(Array.isArray(v.aliases)?v.aliases:[]),...(aliases[fdcScenarioFold(v.name)]||[])];
  for(const name of names){const k=fdcScenarioFold(name).trim();if(k.length<3)continue;if(!candidates.has(k))candidates.set(k,new Map());candidates.get(k).set(v.id,v);}
 }
 return new Map([...candidates].filter(([,v])=>v.size===1).map(([k,v])=>[k,[...v.values()][0]]));
}
function fdcRenderScenarioLinks(){
 const el=document.getElementById('scenarioContent');if(!el)return;const text=state.notes[state.campaign]||'Aucun mémo',targets=fdcScenarioTargets();el.replaceChildren();if(!targets.size){el.textContent=text;return;}
 let folded='',starts=[],ends=[],offset=0;for(const char of text){const part=fdcScenarioFold(char);for(let i=0;i<part.length;i++){starts.push(offset);ends.push(offset+char.length);}folded+=part;offset+=char.length;}
 const pattern=[...targets.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));const regex=new RegExp('(^|[^a-z0-9])('+pattern.join('|')+')(?![a-z0-9])','g');let match,last=0;
 while((match=regex.exec(folded))){const from=match.index+match[1].length,start=starts[from],end=ends[from+match[2].length-1],visual=targets.get(match[2]);el.append(document.createTextNode(text.slice(last,start)));const button=document.createElement('button');button.type='button';button.className='scenario-visual-link';button.textContent=text.slice(start,end);button.title='Voir '+visual.name;button.dataset.visualId=visual.id;button.onclick=()=>fdcOpenScenarioVisual(visual.id);el.append(button);last=end;}
 el.append(document.createTextNode(text.slice(last)));
}
let fdcScenarioPreviewRequest=0;
async function fdcOpenScenarioVisual(vid){
 const request=++fdcScenarioPreviewRequest,campaign=state.campaign,v=state.visuals.find(v=>v.id===vid&&(v.campaign||'La Nuit des Morts-Vivants')===campaign);if(!v)return;
 let preview=document.getElementById('scenarioVisualDialog');if(!preview){preview=document.createElement('dialog');preview.id='scenarioVisualDialog';preview.className='scenario-visual-dialog';preview.setAttribute('aria-labelledby','scenarioVisualTitle');preview.innerHTML='<div class="scenario-preview-head"><h3 id="scenarioVisualTitle"></h3><button type="button" aria-label="Fermer le visuel">✕ Fermer</button></div><div class="scenario-preview-content"></div>';preview.querySelector('button').onclick=()=>preview.close();preview.addEventListener('close',()=>{fdcScenarioPreviewRequest++;if(preview.objectUrl){URL.revokeObjectURL(preview.objectUrl);preview.objectUrl=null;}preview.querySelector('.scenario-preview-content').replaceChildren();});document.body.append(preview);}
 preview.querySelector('h3').textContent=v.name;const content=preview.querySelector('.scenario-preview-content');content.textContent='Chargement du visuel…';if(!preview.open)preview.showModal();
 try{const file=await getFile(vid);if(request!==fdcScenarioPreviewRequest||state.campaign!==campaign)return;const url=file?URL.createObjectURL(file):v.url||(typeof FDC_IMAGES!=='undefined'?FDC_IMAGES[v.bundledFile]:null);if(!url)throw Error('Aucune image associée');if(preview.objectUrl)URL.revokeObjectURL(preview.objectUrl);preview.objectUrl=file?url:null;
 const pdf=file?.type==='application/pdf'||v.mime==='application/pdf'||/\.pdf(?:\?|$)/i.test(v.fileName||url);const media=document.createElement(pdf?'iframe':'img');media.src=url;if(pdf)media.title=v.name;else{media.alt=v.name;media.onerror=()=>{content.textContent='Ce visuel ne peut pas être chargé. Vérifie son fichier dans le module Visuels.';};}content.replaceChildren(media);
 }catch(e){if(request===fdcScenarioPreviewRequest)content.textContent='Visuel indisponible. Vérifie le fichier associé dans le module Visuels.';}
}
const fdcRenderVisualsBeforeScenarioLinks=renderVisuals;
renderVisuals=function(){fdcRenderVisualsBeforeScenarioLinks();fdcRenderScenarioLinks();};
fdcRenderScenarioLinks();
