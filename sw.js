const CACHE="fdc-console-nuit-v10";
const FILES=["./", "index.html", "manifest.webmanifest", "fdc-icon.svg", "icon-192.png", "icon-512.png", "assets/BALTUS.png", "assets/Borin.png", "assets/DIABLO.png", "assets/HYDRA.png", "assets/MALKOR VEYR.png", "assets/NOVA.png", "assets/VARNOK.png", "assets/Ysilde.png", "assets/affiche de recherche de malkor veyr.png", "assets/ambiance taverne.mp3", "assets/ambiance village macabre.mp3", "assets/baltus.png", "assets/borin.png", "assets/bourse rituelle et pièces d’or.png", "assets/diablo.png", "assets/discussion .mp3", "assets/explosions.mp3", "assets/hydra.png", "assets/la horde.mp3", "assets/la nuit des morts vivants .png", "assets/malkor veyr.png", "assets/nova.png", "assets/orbe de vie.png", "assets/révélations malkor.mp3", "assets/varnok.png", "assets/ysilde.png"];
// Le code doit être frais avant l'activation ; les médias restent disponibles hors ligne.
self.addEventListener("install",e=>e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(['index.html','manifest.webmanifest'].map(url=>new Request(url,{cache:'reload'})));
 await Promise.all(FILES.filter(f=>f!=='index.html'&&f!=='manifest.webmanifest').map(async url=>{
  try{await cache.add(new Request(url,{cache:'reload'}))}catch(err){console.warn('Cache média',url,err)}
 }));
 await self.skipWaiting();
})()));
self.addEventListener("activate",e=>e.waitUntil((async()=>{
 // Ne toucher ni aux autres applications, ni à IndexedDB, ni à localStorage.
 for(const key of await caches.keys())if(key.startsWith('fdc-console-nuit-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener("fetch",e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=="GET"||u.origin!==location.origin)return;
 const documentRequest=e.request.mode==='navigate'||u.pathname.endsWith('/index.html');
 const fresh=documentRequest||u.pathname.endsWith('/sw.js')||u.pathname.endsWith('/manifest.webmanifest');
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cacheKey=documentRequest?new URL('index.html',self.registration.scope).href:e.request;
  if(!fresh){const cached=await cache.match(cacheKey);if(cached)return cached;}
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
