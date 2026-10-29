const CACHE="fdc-console-nuit-v3";
const FILES=['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'assets/DIABLO.png', 'assets/Révélations malkor.mp3', 'assets/ambiance taverne.mp3', 'assets/la horde.mp3', 'assets/BALTUS.png', 'assets/ambiance village macabre.mp3', 'assets/explosions.mp3', 'assets/MALKOR VEYR.png', 'assets/discussion .mp3', 'assets/Ysilde.png', 'assets/Affiche de recherche de Malkor Veyr.png', 'assets/HYDRA.png', 'assets/la nuit des morts vivants .png', 'assets/VARNOK.png', 'assets/Borin.png', 'assets/NOVA.png', 'assets/Bourse rituelle et pièces d’or.png'];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(async c=>{
 for(const f of FILES){try{await c.add(f)}catch(err){console.warn("Cache",f,err)}}
}).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil((async()=>{
 for(const key of await caches.keys())if(key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
 const u=new URL(e.request.url);
 if(e.request.mode==="navigate"||u.pathname.endsWith("/index.html")||u.pathname.endsWith("/sw.js")){
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){let copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request)));
 }else{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{if(resp.ok){let copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return resp})));
 }
});
