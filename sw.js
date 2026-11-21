const CACHE='intern-shadowing-v43-meeting-sync';
const FILES=['./','./index.html','./manifest.webmanifest','./firebase-config.js','./cloud-sync.js','./version.json','./icons/icon-192.png','./icons/icon-512.png',...Array.from({length:7},(_,i)=>`./data/part${i+1}.json`)];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(k=>k.startsWith('intern-shadowing-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL('./',self.registration.scope).pathname))return;
 if(req.mode==='navigate'||url.pathname.endsWith('/version.json')){
  event.respondWith(fetch(req,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy))}return response}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));return;
 }
 // Network first for JSON and scripts to avoid indefinitely stale captions.
 if(/\.(?:json|js)$/.test(url.pathname)){
  event.respondWith(fetch(req,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy))}return response}).catch(()=>caches.match(req)));return;
 }
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy))}return response})));
});
