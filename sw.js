/* Offline copy of the preflop ranges page.

   The page itself is fetched from the network first, so an edit shows up on the next reload,
   and falls back to the saved copy when there is no connection or the network stalls.
   Icons and fonts never change, so they are answered from the cache and refreshed in the background.
   Bump CACHE when the list of files below changes. */
var CACHE="pf-ranges-cache-v1";
var PAGE="./preflop-ranges.html";
var SHELL=[PAGE,"./manifest.webmanifest","./icon-180.png","./icon-192.png","./icon-512.png"];
var PATIENCE=2500; /* ms to wait for a slow network before showing the saved page */

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
function refresh(c,req){
  return fetch(req).then(function(res){
    /* opaque covers the font files, which come from another origin */
    if(res&&(res.ok||res.type==="opaque")) c.put(req,res.clone());
    return res;
  });
}
self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET"||!/^https?:/.test(req.url)) return;
  e.respondWith(caches.open(CACHE).then(function(c){
    var saved=function(){ return c.match(req).then(function(hit){ return hit||c.match(PAGE); }); };
    if(req.mode==="navigate"){
      return new Promise(function(resolve){
        var timer=setTimeout(function(){ saved().then(function(hit){ if(hit) resolve(hit); }); },PATIENCE);
        refresh(c,req).then(function(res){ clearTimeout(timer); resolve(res); },function(){ clearTimeout(timer); resolve(saved()); });
      });
    }
    return c.match(req).then(function(hit){
      var fresh=refresh(c,req).catch(function(){ return hit; });
      return hit||fresh;
    });
  }));
});
