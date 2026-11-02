/* Global reference from the user's DD5-Monstres.pdf. */
let fdcMonsterCatalogPromise=null;
function fdcLoadMonsterCatalog(){
 if(!fdcMonsterCatalogPromise)fdcMonsterCatalogPromise=fetch('assets/monsters-fr.json').then(r=>{if(!r.ok)throw Error('Bestiaire indisponible');return r.json()}).then(d=>{if(d.format!=='fdc-monster-reference'||!Array.isArray(d.monsters))throw Error('Bestiaire invalide');return d;}).catch(e=>{fdcMonsterCatalogPromise=null;throw e;});return fdcMonsterCatalogPromise;
}
function fdcMonsterKey(name){return fdcSpellNormalize(name).replace(/^zombie$/,'zombi');}
function fdcMergeMonsterProfiles(library,bestiary,profiles){
 // Only replace recognized demo text; campaign-specific rules and running HP stay intact.
 const placeholder=t=>/^CRÉATURE PERSONNALISÉE|^Attaques, pouvoirs et règles : consulter/.test(t.abilities||'')||!t.abilities;
 for(const p of profiles){
  let entry=library.find(t=>t.id===p.id||fdcMonsterKey(t.name)===fdcMonsterKey(p.name));
  if(!entry)library.push({...p});
  else if(placeholder(entry)||(entry.id==='lib-b1'&&entry.abilities.includes('profil classique D&D 5e'))){Object.assign(entry,p,{id:entry.id});}
  for(const t of bestiary){if(fdcMonsterKey(t.name)!==fdcMonsterKey(p.name))continue;
   if(placeholder(t)||(t.id==='b1'&&t.abilities.includes('profil classique D&D 5e')))Object.assign(t,p,{id:t.id});
  }
 }
}
async function fdcEnableMonsterCatalog(frame){
 try{const data=await fdcLoadMonsterCatalog();if(frame!==document.getElementById('combatFrame')?.contentWindow||typeof frame.fdcInstallGlobalMonsters!=='function')return;frame.fdcInstallGlobalMonsters(data.monsters);}catch(e){console.warn('Bestiaire global indisponible',e.message);}
}
function fdcMonsterControlsMarkup(){return `<section id="monsterReference" class="spell-reference" hidden aria-label="Bestiaire global"><div class="spell-toolbar"><div><label for="monsterSelect">Monstres</label><select id="monsterSelect" disabled><option>Chargement…</option></select></div><div><label for="monsterSearch">Rechercher un monstre ou une capacité</label><input id="monsterSearch" type="search" placeholder="Ex. gobelin, dragon, poison…" disabled></div></div><p id="monsterCount" class="muted" role="status"></p><article id="monsterRules" class="spell-rules" aria-label="Fiche du monstre"></article><div class="actions"><button id="monsterImport" class="blue" disabled>Ajouter au bestiaire de la campagne</button><span id="monsterImportStatus" role="status"></span></div><p class="spell-source muted">PDF fourni · AideDD · <a href="assets/monsters-source-notice.txt" target="_blank" rel="noopener">Source et mentions</a></p></section>`;}
function fdcSelectInfoTab(tab){const info=document.getElementById('combatInfoDialog');for(const name of ['spell','monster']){info.querySelector('#'+name+'Reference').hidden=name!==tab;info.querySelector('[data-info-tab="'+name+'"]').setAttribute('aria-selected',String(name===tab));}if(tab==='monster')fdcInitMonsterReference(info);}
async function fdcInitMonsterReference(info){
 const select=info.querySelector('#monsterSelect'),search=info.querySelector('#monsterSearch'),count=info.querySelector('#monsterCount'),rules=info.querySelector('#monsterRules'),add=info.querySelector('#monsterImport'),status=info.querySelector('#monsterImportStatus');
 if(info.fdcMonsterRefresh){info.fdcMonsterRefresh();return;}if(info.dataset.monsterLoading)return;info.dataset.monsterLoading='1';
 try{
  const data=await fdcLoadMonsterCatalog();const frame=document.getElementById('combatFrame').contentWindow;await fdcEnableMonsterCatalog(frame);
  const all=frame.fdcGlobalMonsterSnapshot?frame.fdcGlobalMonsterSnapshot():data.monsters;
  const seen=new Set(),monsters=all.filter(t=>{const k=fdcMonsterKey(t.name);if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const index=new Map(monsters.map(t=>[t.id,fdcSpellNormalize(t.name+' '+t.description+' '+t.abilities)]));
  function refresh(){const p=monsters.find(t=>t.id===select.value),w=document.getElementById('combatFrame').contentWindow;add.textContent='Ajouter au bestiaire de « '+state.campaign+' »';const exists=p&&w.fdcHasMonster?.(p);add.disabled=!p||!!exists||!w.fdcAddGlobalMonster;status.textContent=exists?'Déjà dans cette campagne':'';}
  function show(){const p=monsters.find(t=>t.id===select.value);rules.replaceChildren();if(!p){rules.textContent='Choisis un monstre dans la liste.';refresh();return;}
   const heading=document.createElement('h4');heading.textContent=p.name;const sub=document.createElement('p');sub.textContent=p.description+' · CA '+p.ca+' · '+p.hp+' PV';rules.append(heading,sub);
   const stats=document.createElement('table');stats.className='spell-data-table';stats.setAttribute('aria-label','Caractéristiques');const names=['FOR','DEX','CON','INT','SAG','CHA'];const values={};for(const m of (p.abilities||'').matchAll(/\b(FOR|DEX|CON|INT|SAG|CHA)\s+(\d+)\s*(?:\(([+−-]?\d+)\))?/g)){if(!values[m[1]])values[m[1]]={score:Number(m[2]),mod:m[3]===undefined?Math.floor((Number(m[2])-10)/2):Number(m[3].replace('−','-'))};if(Object.keys(values).length===6)break;}
   stats.innerHTML='<thead><tr>'+names.map(n=>'<th scope="col">'+n+'</th>').join('')+'</tr></thead><tbody><tr>'+names.map(n=>'<td>'+(values[n]?values[n].score+' ('+(values[n].mod>=0?'+':'')+values[n].mod+')':'—')+'</td>').join('')+'</tr></tbody>';rules.append(stats);
   const text=(p.abilities||'').replace(/^(?:(?:FOR|DEX|CON|INT|SAG|CHA)\s+\d+(?:\s*\([+−-]?\d+\))?[,;]?\s*)+\.\s*/,'');for(const para of text.split(/\n+/)){if(!para.trim())continue;const el=document.createElement('p');el.innerHTML=fdcSpellLinkMarkup(para);rules.append(el);}
   if(p.sourcePages){const source=document.createElement('p');source.className='muted';source.textContent='Source : DD5-Monstres.pdf · pages '+p.sourcePages.join(', ');rules.append(source);}rules.scrollTop=0;refresh();
  }
  function filter(){const q=fdcSpellNormalize(search.value),words=q.split(' ').filter(Boolean),previous=select.value;const matches=monsters.filter(p=>words.every(w=>index.get(p.id).includes(w)));if(q)matches.sort((a,b)=>Number(fdcSpellNormalize(b.name)===q)-Number(fdcSpellNormalize(a.name)===q));select.replaceChildren(new Option(matches.length?'Choisir un monstre…':'Aucun résultat',''));for(const p of matches)select.append(new Option(p.name,p.id));select.value=q?(matches[0]?.id||''):(matches.some(p=>p.id===previous)?previous:'');count.textContent=matches.length+' créatures sur '+monsters.length+' · dont '+data.monsters.length+' fiches du PDF';show();}
  search.oninput=filter;select.onchange=show;add.onclick=()=>{const p=monsters.find(t=>t.id===select.value),w=document.getElementById('combatFrame').contentWindow;if(!p||!w.fdcAddGlobalMonster)return;const added=w.fdcAddGlobalMonster(p);refresh();if(added)status.textContent=p.name+' ajouté à '+state.campaign;};select.disabled=false;search.disabled=false;info.fdcMonsterRefresh=refresh;filter();
 }catch(e){count.textContent='Impossible de charger le bestiaire. Ouvre la console en ligne puis réessaie.';const retry=document.createElement('button');retry.textContent='Réessayer';retry.onclick=()=>fdcInitMonsterReference(info);rules.replaceChildren(retry);}finally{delete info.dataset.monsterLoading;}
}
fdcEnableMonsterCatalog(document.getElementById('combatFrame')?.contentWindow);
