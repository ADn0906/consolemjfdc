const CACHE="fdc-console-nuit-v27-info-module";
const FILES=["assets/racines/intro.mp3","assets/racines/manoir.mp3","assets/racines/enquete.mp3","assets/racines/combat-amazonia.mp3","assets/racines/1HIt1vkG1wgusTZx06ROnjNKvPPTyMqRf.webp","assets/racines/1xTQU7ZYxabEzRL-Otm3Z-wz2OkNqpX6C.webp","assets/racines/1lSCa2yvtPJb7H3rOfAqOmp9KyUWm9cfJ.webp","assets/racines/1-3OYtLgIlGZS129FT1SJYtf_7TaKI-L6.webp","assets/racines/1XOIvM7IyYwL5s_Ghnj9pTSB-9kpX5_aB.webp","assets/racines/1ypkrExqn5qRKL5LVnqQU5Z5LQOamgkv7.webp","assets/racines/1NrZ7gKkw5Org3xJLtCKvuTPB_cJ9T1Y3.webp","assets/racines/1unuQNBzOoTKJDe_53S8bH1x7jY34kIJN.webp","assets/racines/1SZlOQzsovibcmMDbnNKdXbB8pXx170Jo.webp","assets/racines/1t9GH2hu58bVc7qECTRjg_L9qqErT3CZB.webp","assets/racines/1TlZXku7QZYzhixxOUEtOPQNMeRKQlmKE.webp","assets/racines/1SNMReVFFvkJv1RscAOVoUAfcrNbgW1PF.png","assets/racines/1y9efTPxn1OVVioANgEzLnYVbN-PtGeud.png","assets/racines/122ja09wJ_quD2uwmvMrSnsR0WKKHWIvv.png","assets/racines/1x9C7hKyC41xuktV2tjbtmEHBrzxiVPhN.png","assets/racines/1V1Gavmml0xxZG-q3BranofU2aRAqE7rw.png","assets/racines/11RCwVLJKRxzWHP0bf29wcqnPJcig7ade.png","assets/racines/1pGU4ejBbIqyC4C1d0WmcOx4QvAvswTbT.png","assets/racines/1EDT3FdffyxgGQu1sTprEiyhShTuqfbm5.png","assets/racines/12WcwivvqF5hXn3MNpRkCCw31ywbThEw8.png","assets/racines/1xw52ndj-RP1AFr7zHesqdDbHSQtb6RKl.png","assets/racines/11sIuh3fWGfcI67Q6Rt5cVVhk0uziuyU5.png","assets/racines/1riioLVv2IWJceOLenmIjeU3wCpzHPJE_.png","./", "index.html", "manifest.webmanifest", "fdc-icon.svg", "icon-192.png", "icon-512.png", "assets/BALTUS.png", "assets/Borin.png", "assets/DIABLO.png", "assets/HYDRA.png", "assets/MALKOR VEYR.png", "assets/NOVA.png", "assets/VARNOK.png", "assets/Ysilde.png", "assets/affiche de recherche de malkor veyr.png", "assets/ambiance taverne.mp3", "assets/ambiance village macabre.mp3", "assets/baltus.png", "assets/borin.png", "assets/bourse rituelle et pièces d’or.png", "assets/diablo.png", "assets/discussion .mp3", "assets/explosions.mp3", "assets/hydra.png", "assets/la horde.mp3", "assets/la nuit des morts vivants .png", "assets/malkor veyr.png", "assets/nova.png", "assets/orbe de vie.png", "assets/révélations malkor.mp3", "assets/varnok.png", "assets/ysilde.png"];
// Le code doit être frais avant l'activation ; les médias restent disponibles hors ligne.
self.addEventListener("install",e=>e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(['monster-reference.js','assets/monsters-fr.json','assets/monsters-source-notice.txt','index.html','manifest.webmanifest','campaign-transfer.js','spell-reference.js','assets/spells-fr.json','assets/spells-source-notice.txt'].map(url=>new Request(url,{cache:'reload'})));
 // Activer le code sans attendre tous les médias.
 await self.skipWaiting();
})()));
self.addEventListener("activate",e=>e.waitUntil((async()=>{
 // Ne toucher ni aux autres applications, ni à IndexedDB, ni à localStorage.
 // Conserver les médias déjà disponibles hors ligne.
 await self.clients.claim();
})()));
self.addEventListener("fetch",e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=="GET"||u.origin!==location.origin)return;
 const documentRequest=e.request.mode==='navigate'||u.pathname.endsWith('/index.html');
 const fresh=documentRequest||u.pathname.endsWith('/sw.js')||u.pathname.endsWith('/manifest.webmanifest')||u.pathname.endsWith('/campaign-transfer.js')||u.pathname.endsWith('/spell-reference.js')||u.pathname.endsWith('/spells-fr.json')||u.pathname.endsWith('/monster-reference.js')||u.pathname.endsWith('/monsters-fr.json');
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cacheKey=documentRequest?new URL('index.html',self.registration.scope).href:e.request;
  const repairedMedia=u.pathname.includes('/assets/racines/');
  if(!fresh){const cached=await cache.match(cacheKey);if(cached)return cached;for(const name of await caches.keys()){if(!repairedMedia && name!==CACHE && name.startsWith('fdc-console-nuit-')){const media=await (await caches.open(name)).match(cacheKey);if(media)return media;}}}
  try{
   const response=await fetch(e.request,fresh?{cache:'no-store'}:{});
   if(response.ok && response.status===200)e.waitUntil(cache.put(cacheKey,response.clone()));
   return response;
  }catch(error){
   const cached=await cache.match(cacheKey);
   if(cached)return cached;
   throw error;
  }
 })());
});
