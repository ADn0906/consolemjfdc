/* Text reference transcribed from the PDF supplied by the user. */
let fdcSpellLoadPromise=null;
function fdcSpellNormalize(text){return String(text).replace(/[Œœ]/g,'oe').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,' ').trim();}
function fdcSpellControlsMarkup(){return `<section id="spellReference" class="spell-reference" aria-label="Règles des sorts"><div class="spell-toolbar"><div><label for="spellSelect">Sorts D&D</label><select id="spellSelect" disabled><option>Chargement des sorts…</option></select></div><div><label for="spellSearch">Rechercher un sort ou une règle</label><input id="spellSearch" type="search" maxlength="100" placeholder="Ex. boule de feu, concentration…" autocomplete="off" disabled></div></div><p id="spellCount" class="muted" role="status" aria-live="polite">Chargement de la bibliothèque…</p><article id="spellRules" class="spell-rules" aria-label="Description du sort"><p>Choisis un sort dans la liste ou utilise la recherche.</p></article><p class="spell-source muted">Texte du PDF fourni · AideDD · <a href="assets/spells-source-notice.txt" target="_blank" rel="noopener">Source et mentions</a></p></section>`;}
function fdcInitSpellReference(info){if(info.dataset.spellReady==='1')return Promise.resolve();if(info.fdcSpellInitPromise)return info.fdcSpellInitPromise;info.fdcSpellInitPromise=fdcPopulateSpellReference(info).finally(()=>{delete info.fdcSpellInitPromise;});return info.fdcSpellInitPromise;}
async function fdcPopulateSpellReference(info){
 if(info.dataset.spellReady==='1'||info.dataset.spellLoading==='1')return;info.dataset.spellLoading='1';
 const select=info.querySelector('#spellSelect'),search=info.querySelector('#spellSearch'),count=info.querySelector('#spellCount'),rules=info.querySelector('#spellRules');
 try{
  const data=await fdcLoadSpellCatalog();const spells=data.spells.map(spell=>({...spell,nameIndex:fdcSpellNormalize(spell.name),searchIndex:fdcSpellNormalize([spell.name,...(spell.aliases||[]),spell.levelSchool,...spell.classes,...spell.paragraphs].join(' '))})).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  const byId=new Map(spells.map(spell=>[spell.id,spell]));
  function show(id){
   rules.replaceChildren();const spell=byId.get(id);if(!spell){const p=document.createElement('p');p.textContent=select.options.length>1?'Choisis un sort dans la liste ou utilise la recherche.':'Aucun sort ne correspond à cette recherche.';rules.append(p);return;}
   const title=document.createElement('h4');title.textContent=spell.name;const subtitle=document.createElement('p');subtitle.className='spell-subtitle';subtitle.textContent=spell.levelSchool+(spell.classes.length?' · '+spell.classes.join(', '):'');rules.append(title,subtitle);
   for(let i=0;i<spell.paragraphs.length;i++){
    const text=spell.paragraphs[i];
    if(text.includes(' | ')){
     const rows=[text.split(' | ')];let end=i+1;while(end<spell.paragraphs.length&&spell.paragraphs[end].includes(' | ')){rows.push(spell.paragraphs[end].split(' | '));end++;}
     if(rows.length>1&&rows.every(row=>row.length===rows[0].length)){
      const wrap=document.createElement('div');wrap.className='spell-table-wrap';const table=document.createElement('table');table.className='spell-data-table';
      rows.forEach((row,n)=>{const tr=document.createElement('tr');row.forEach(cell=>{const td=document.createElement(n===0?'th':'td');if(n===0)td.scope='col';td.textContent=cell;tr.append(td);});table.append(tr);});wrap.append(table);rules.append(wrap);i=end-1;continue;
     }
    }
    const p=document.createElement('p');if(/^(Temps d[’']incantation|Portée|Composantes|Durée)\s*:/.test(text)){p.className='spell-metadata';const colon=text.indexOf(':'),strong=document.createElement('strong');strong.textContent=text.slice(0,colon+1);p.append(strong,document.createTextNode(text.slice(colon+1)));}else{p.textContent=text;if(text.includes(' | '))p.className='spell-table-line';}rules.append(p);}
   const source=document.createElement('p');source.className='spell-page muted';source.textContent='Source : '+data.source.title+' · page'+(spell.sourcePages.length>1?'s ':' ')+spell.sourcePages.join(', ')+' du PDF.';rules.append(source);rules.scrollTop=0;
  }
  function filter(){
   const q=fdcSpellNormalize(search.value),words=q.split(' ').filter(Boolean),previous=select.value;const matches=spells.filter(s=>words.every(word=>s.searchIndex.includes(word)));const rank=s=>s.nameIndex===q?3:s.nameIndex.startsWith(q)?2:words.every(word=>s.nameIndex.includes(word))?1:0;if(q)matches.sort((a,b)=>rank(b)-rank(a)||a.name.localeCompare(b.name,'fr'));
   select.replaceChildren(new Option(matches.length?'Choisir un sort…':'Aucun sort trouvé',''));for(const spell of matches)select.append(new Option(spell.name+' — '+(spell.level===0?'sort mineur':'niveau '+spell.level),spell.id));select.value=q?(matches[0]?.id||''):(matches.some(s=>s.id===previous)?previous:'');count.textContent=matches.length+' sort'+(matches.length>1?'s':'')+' sur '+spells.length;show(select.value);
  }
  select.addEventListener('change',()=>show(select.value));search.addEventListener('input',filter);select.disabled=false;search.disabled=false;info.dataset.spellReady='1';filter();
 }catch(error){count.textContent='Impossible de charger les sorts. Réessaie après avoir ouvert la console en ligne.';select.replaceChildren(new Option('Bibliothèque indisponible',''));const retry=document.createElement('button');retry.type='button';retry.textContent='Réessayer';retry.onclick=()=>fdcInitSpellReference(info);rules.replaceChildren(retry);}finally{delete info.dataset.spellLoading;}
}

let fdcSpellCatalog=null,fdcSpellNameMatcher=null,fdcSpellNameIds=new Map();
function fdcSpellFold(text){return String(text).replace(/[Œœ]/g,'oe').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[’‘`]/g,"'").replace(/[‐‑–—]/g,'-');}
function fdcPrepareSpellLinks(data){
 fdcSpellCatalog=data;const names=[];fdcSpellNameIds=new Map();for(const spell of data.spells)for(const name of [spell.name,...(spell.aliases||[])]){const folded=fdcSpellFold(name);if(!fdcSpellNameIds.has(folded)){names.push(folded);fdcSpellNameIds.set(folded,spell.id);}}
 const patterns=names.sort((a,b)=>b.length-a.length).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'));fdcSpellNameMatcher=new RegExp('(^|[^a-z0-9])('+patterns.join('|')+')(?![a-z0-9])','g');
}
function fdcSpellLinkMarkup(text){
 if(fdcIsHomebrew())return escapeHTML(text);
 text=String(text||'');if(!fdcSpellNameMatcher)return escapeHTML(text);let folded='',starts=[],ends=[],offset=0;
 for(const char of text){const part=fdcSpellFold(char);for(let i=0;i<part.length;i++){starts.push(offset);ends.push(offset+char.length);}folded+=part;offset+=char.length;}
 let html='',last=0,match;fdcSpellNameMatcher.lastIndex=0;
 while((match=fdcSpellNameMatcher.exec(folded))!==null){const from=match.index+match[1].length,to=from+match[2].length,start=starts[from],end=ends[to-1],id=fdcSpellNameIds.get(match[2].replace(/\s+/g,' '));if(!id)continue;const spell=fdcSpellCatalog.spells.find(s=>s.id===id);html+=escapeHTML(text.slice(last,start))+'<button type="button" class="monster-spell-link" data-spell-id="'+id+'" title="Ouvrir le sort '+escapeHTML(spell.name)+'" onclick="fdcOpenSpellReference(this.dataset.spellId)">'+escapeHTML(text.slice(start,end))+'</button>';last=end;}
 return html+escapeHTML(text.slice(last));
}
function fdcLoadSpellCatalog(){
 if(!fdcSpellLoadPromise)fdcSpellLoadPromise=fetch('assets/spells-fr.json').then(r=>{if(!r.ok)throw new Error('Chargement impossible');return r.json()}).then(data=>{if(data.format!=='fdc-spell-reference'||!Array.isArray(data.spells))throw new Error('Bibliothèque invalide');fdcPrepareSpellLinks(data);return data;}).catch(error=>{fdcSpellLoadPromise=null;throw error;});return fdcSpellLoadPromise;
}
async function fdcEnableMonsterSpellLinks(frame){if(fdcIsHomebrew())return;try{await fdcLoadSpellCatalog();if(frame===document.getElementById('combatFrame')?.contentWindow&&typeof frame.fdcRefreshSpellLinks==='function')frame.fdcRefreshSpellLinks();}catch(error){console.warn('Référence des sorts indisponible',error.message);}}
async function fdcOpenSpellReference(id){
 showCombatInfo();if(typeof fdcSelectInfoTab==='function')fdcSelectInfoTab('spell');const info=document.getElementById('combatInfoDialog');await fdcInitSpellReference(info);if(info.dataset.spellReady!=='1')return;const spell=fdcSpellCatalog?.spells.find(s=>s.id===id);if(!spell)return;const search=info.querySelector('#spellSearch'),select=info.querySelector('#spellSelect');search.value=spell.name;search.dispatchEvent(new Event('input'));select.value=id;select.dispatchEvent(new Event('change'));
}
fdcEnableMonsterSpellLinks(document.getElementById('combatFrame')?.contentWindow);
