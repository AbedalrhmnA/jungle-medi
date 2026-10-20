/* Keeps the forest files on the device so the projector downloads them only once.
 * media/*  : served from the saved copy (with byte ranges for video), network if not saved yet
 * the rest : network first, saved copy when the internet is down
 */
var MEDIA = 'jungle-media-v1', SHELL = 'jungle-shell-v2', INDEX = '__index__';
var SCOPE = self.registration.scope;
var busy = null;

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url = new URL(req.url);
  if(url.origin !== location.origin || req.url.indexOf(SCOPE) !== 0) return;
  var rel = url.pathname.slice(new URL(SCOPE).pathname.length);
  if(rel.indexOf('media/') === 0) e.respondWith(media(req, url));
  else if(rel !== 'media-manifest.json' && rel !== 'videos.json') e.respondWith(shell(req));
});

function key(url){ return url.origin + url.pathname; }

function media(req, url){
  return caches.open(MEDIA).then(function(c){ return c.match(key(url)); }).then(function(hit){
    if(!hit) return fetch(req);
    var range = req.headers.get('range');
    if(!range) return hit;
    return hit.blob().then(function(blob){
      var size = blob.size, m = /bytes=(\d*)-(\d*)/.exec(range), start = 0, end = size - 1;
      if(m){
        if(m[1] !== '') { start = parseInt(m[1], 10); if(m[2] !== '') end = Math.min(size - 1, parseInt(m[2], 10)); }
        else if(m[2] !== '') { start = Math.max(0, size - parseInt(m[2], 10)); }
      }
      if(start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
      return new Response(blob.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: {
        'Content-Type': hit.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
    });
  }).catch(function(){ return fetch(req); });
}

function shell(req){
  // saved copy first (instant start), fresh copy fetched in the background for next time
  var k = key(new URL(req.url));
  return caches.open(SHELL).then(function(c){
    return c.match(k).then(function(hit){
      var net = fetch(req).then(function(res){ if(res.ok && res.type === 'basic') c.put(k, res.clone()); return res; });
      if(hit){ net.catch(function(){}); return hit; }
      return net.catch(function(){ return Response.error(); });
    });
  });
}

function tell(msg){
  return self.clients.matchAll({ includeUncontrolled: true }).then(function(list){ list.forEach(function(c){ c.postMessage(msg); }); });
}

self.addEventListener('message', function(e){
  if(e.data && e.data.type === 'precache'){
    if(!busy) busy = precache().then(function(){ busy = null; }, function(){ busy = null; });
    if(e.waitUntil) e.waitUntil(busy);
  }
});

function precache(){
  var cache, index = {}, list;
  return fetch(SCOPE + 'media-manifest.json', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(man){
    list = man.files || [];
    return caches.open(MEDIA);
  }).then(function(c){
    cache = c;
    return cache.match(SCOPE + INDEX).then(function(r){ return r ? r.json() : {}; }).catch(function(){ return {}; });
  }).then(function(idx){
    index = idx || {};
    var wanted = {}, todo = [], total = 0, done = 0;
    list.forEach(function(f){ var u = new URL(f.path, SCOPE).href; wanted[u] = 1; if(index[u] !== f.hash){ todo.push(f); total += f.size; } });
    // drop files that are no longer used
    var drops = Object.keys(index).filter(function(u){ return !wanted[u]; }).map(function(u){ delete index[u]; return cache.delete(u); });
    if(!todo.length) return Promise.all(drops).then(saveIndex).then(function(){ return tell({ type: 'done' }); });
    tell({ type: 'progress', done: 0, total: total });
    var chain = Promise.all(drops);
    todo.forEach(function(f){
      chain = chain.then(function(){
        var u = new URL(f.path, SCOPE).href;
        return fetch(u + '?v=' + f.hash, { cache: 'no-store' }).then(function(r){
          if(!r.ok) throw new Error('download');
          return r.blob();
        }).then(function(blob){
          return cache.put(u, new Response(blob, { headers: { 'Content-Type': f.type, 'Content-Length': String(blob.size) } }));
        }).then(function(){
          index[u] = f.hash; done += f.size;
          return saveIndex().then(function(){ return tell({ type: 'progress', done: done, total: total }); });
        });
      });
    });
    return chain.then(function(){ return tell({ type: 'done' }); });
  }).catch(function(err){ return tell({ type: 'error', message: String(err && err.message || err) }); });

  function saveIndex(){ return cache.put(SCOPE + INDEX, new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } })); }
}
