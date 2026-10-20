/* Jungle online bridge.
 *
 * Replaces the laptop server. The pages keep calling fetch('/api/...') and
 * EventSource('/api/events') exactly as before; this file answers those calls
 * through Firebase Realtime Database instead.
 *
 *  - The big screen opened with ?tv (the projector app) is the "referee": it runs
 *    the turn rules (one child at a time, 60 s play, idle timeout, videos) that
 *    used to live in server.py.
 *  - Phones send their requests to Firebase; the screen answers them.
 *  - The big screen opened without ?tv (on a laptop) is a settings editor only.
 */
(function(){
  'use strict';

  var FIREBASE = {
    apiKey: 'AIzaSyC-HYF0uLsUVSLzOgWSYXYigM3melXIB44',
    authDomain: 'jungle-game-9e4e7.firebaseapp.com',
    databaseURL: 'https://jungle-game-9e4e7-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'jungle-game-9e4e7',
    appId: '1:1064044920764:web:a88c0372120873758df5b9'
  };

  var PLAY_SECONDS = 60, IDLE_SECONDS = 15, VIDEO_MAX = 3 * 3600;
  var ANIMAL_TYPES = ['elephant','tiger','monkey','parrot','toucan','chameleon','frog','snake','turtle','butterfly'];
  var ACTIONS = ['dance','jump','spin','clap','ball','wave','hide','visit','laugh'];
  var WHO = ['girl1','girl2','both'];
  var REQ_TIMEOUT = 8000;

  var script = document.currentScript;
  var ROOT = new URL('../', script ? script.src : location.href).href;   // site folder
  var isPhone = /tablet\.html$/i.test(location.pathname);
  var params = new URLSearchParams(location.search);
  var hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  var isReferee = !isPhone && (params.has('tv') || params.has('screen'));
  window.JUNGLE_TV = !isPhone && params.has('tv');

  function store(k, v){ try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }
  var KEY = hash.get('k') || store('jungle.k') || '';
  if(KEY) store('jungle.k', KEY);

  var realFetch = window.fetch.bind(window);
  var RealEventSource = window.EventSource;

  /* ---------------- Firebase ---------------- */
  var db = null, room = null, timeOffset = 0, initError = '';
  try{
    if(window.firebase && KEY.length >= 24){
      firebase.initializeApp(FIREBASE);
      db = firebase.database();
      room = db.ref('rooms/' + KEY);
      db.ref('.info/serverTimeOffset').on('value', function(s){ timeOffset = s.val() || 0; });
    }
  }catch(e){ db = null; room = null; initError = String(e && e.message || e); }
  var TS = (window.firebase && firebase.database) ? firebase.database.ServerValue.TIMESTAMP : 0;
  function serverNow(){ return Date.now() + timeOffset; }

  function json(obj){ return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  function withTimeout(p, ms, fallback){
    return new Promise(function(res){
      var done = false, t = setTimeout(function(){ if(!done){ done = true; res(fallback); } }, ms);
      p.then(function(v){ if(!done){ done = true; clearTimeout(t); res(v); } }, function(){ if(!done){ done = true; clearTimeout(t); res(fallback); } });
    });
  }
  function readOnce(path, ms){
    if(!room) return Promise.resolve(null);
    return withTimeout(room.child(path).once('value').then(function(s){ return s.val(); }), ms || 5000, null);
  }

  /* ---------------- shared cleaning (same rules as the old server) ---------------- */
  function cleanConfig(data){
    var numbers = ['v','entryX','size','girlSize','delay','ambience'], lists = ['walk','perches','girls'], cfg = {};
    Object.keys(data || {}).forEach(function(k){
      var v = data[k];
      if(numbers.indexOf(k) >= 0 && typeof v === 'number' && isFinite(v)) cfg[k] = v;
      else if(lists.indexOf(k) >= 0 && Array.isArray(v)){
        cfg[k] = v.slice(0, 64).filter(function(p){ return Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number'; })
                  .map(function(p){ return [Number(p[0]), Number(p[1])]; });
      }
    });
    return cfg;
  }
  function cleanScene(data){
    return ((data && data.animals) || []).slice(0, 40).filter(function(a){ return a && ANIMAL_TYPES.indexOf(a.kind) >= 0; }).map(function(a){
      return { uid: String(a.uid || '').slice(0, 20), kind: a.kind, thumb: (typeof a.thumb === 'string' && a.thumb.indexOf('data:image/') === 0) ? a.thumb : null };
    });
  }

  /* ======================================================================
   * BIG SCREEN
   * ==================================================================== */
  var screens = [];            // fake EventSource objects opened by display.html
  function broadcast(msg){
    var data = JSON.stringify(msg);
    screens.forEach(function(es){ setTimeout(function(){ if(es.onmessage) es.onmessage({ data: data }); }, 0); });
    return screens.length;
  }

  var stage = { owner: null, kind: null, started: 0, active: 0, file: null, who: 'both' };
  var phoneSeen = false, scene = [];
  function now(){ return Date.now() / 1000; }
  function status(pid){
    var busy = stage.owner !== null;
    var out = { busy: busy, mine: busy && stage.owner === pid, kind: stage.kind, file: stage.file, who: stage.who };
    if(stage.kind === 'play') out.remaining = Math.max(0, Math.round(PLAY_SECONDS - (now() - stage.started)));
    return out;
  }
  function publish(){
    if(!room || !isReferee) return;
    var rem = stage.kind === 'play' ? Math.max(0, Math.round(PLAY_SECONDS - (now() - stage.started))) : null;
    room.child('stage').set({ owner: stage.owner, kind: stage.kind, file: stage.file, who: stage.who, remaining: rem, alive: TS }).catch(function(){});
  }
  function release(reason){
    var kind = stage.kind;
    stage.owner = null; stage.kind = null; stage.started = 0; stage.active = 0; stage.file = null;
    if(kind === 'play') broadcast({ kind: 'play', cmd: 'end', reason: reason });
    else if(kind === 'video' && reason !== 'ended') broadcast({ kind: 'video', cmd: 'stop' });
  }

  function refereePost(path, data){
    data = data || {};
    if(path === '/api/animal'){
      var image = data.image;
      if(typeof image !== 'string' || image.indexOf('data:image/') !== 0) return { ok: false, error: 'no image' };
      var payload = { kind: 'animal', type: ANIMAL_TYPES.indexOf(data.type) >= 0 ? data.type : 'elephant', image: image };
      if(typeof data.photo === 'string' && data.photo.indexOf('data:image/') === 0) payload.photo = data.photo;
      return { ok: true, screens: broadcast(payload) };
    }
    if(path === '/api/_phone'){
      if(!phoneSeen){ phoneSeen = true; broadcast({ kind: 'phone' }); }
      return { ok: true };
    }
    var pid = String(data.id || '').slice(0, 40), t = now(), out;
    if(path === '/api/play/start'){
      var who = WHO.indexOf(data.who) >= 0 ? data.who : 'both';
      if(!screens.length) return { ok: false, error: 'screen' };
      if(stage.owner && stage.owner !== pid){ out = status(pid); out.ok = false; return out; }
      if(stage.owner === pid && stage.kind === 'video') release('stop');
      if(stage.owner !== pid){ stage.owner = pid; stage.kind = 'play'; stage.started = t; stage.file = null; }
      stage.active = t; stage.who = who;
      broadcast({ kind: 'play', cmd: 'start', who: who });
      out = status(pid); out.ok = true; return out;
    }
    if(path === '/api/play/cmd'){
      if(stage.kind !== 'play' || stage.owner !== pid){ out = status(pid); out.ok = false; return out; }
      var msg = null;
      if(data.cmd === 'action' && ACTIONS.indexOf(data.name) >= 0){
        msg = { kind: 'play', cmd: 'action', name: data.name };
        if(data.target !== undefined && data.target !== null) msg.target = String(data.target).slice(0, 20);
      }else if(data.cmd === 'who' && WHO.indexOf(data.who) >= 0){
        stage.who = data.who; msg = { kind: 'play', cmd: 'who', who: data.who };
      }else if(data.cmd === 'move'){
        msg = moveMsg(data.x, data.y);
      }
      stage.active = t;
      if(msg) broadcast(msg);
      out = status(pid); out.ok = true; return out;
    }
    if(path === '/api/play/touch'){
      if(stage.kind === 'play' && stage.owner === pid) stage.active = t;
      out = status(pid); out.ok = true; return out;
    }
    if(path === '/api/play/end'){
      if(stage.kind === 'play' && stage.owner === pid) release('left');
      return { ok: true };
    }
    if(path === '/api/video/play'){
      var name = String(data.file || '').split('/').pop();
      if(!name || videoNames.indexOf(name) < 0) return { ok: false, error: 'missing' };
      if(!screens.length) return { ok: false, error: 'screen' };
      if(stage.owner && stage.owner !== pid){ out = status(pid); out.ok = false; return out; }
      if(stage.kind === 'play') release('left');
      stage.owner = pid; stage.kind = 'video'; stage.started = t; stage.active = t; stage.file = name;
      broadcast({ kind: 'video', cmd: 'play', file: name });
      out = status(pid); out.ok = true; return out;
    }
    if(path === '/api/video/stop'){
      if(stage.kind === 'video' && stage.owner === pid) release('stop');
      return { ok: true };
    }
    if(path === '/api/video/ended'){
      if(stage.kind === 'video') release('ended');
      return { ok: true };
    }
    return { ok: false, error: 'not found' };
  }
  function moveMsg(x, y){
    x = Math.max(-1, Math.min(1, Number(x) || 0)); y = Math.max(-1, Math.min(1, Number(y) || 0));
    lastMove = { x: x, y: y, at: Date.now() };
    return { kind: 'play', cmd: 'move', x: x, y: y };
  }

  var videoNames = [];
  function loadVideoNames(){
    return realFetch(ROOT + 'videos.json', { cache: 'no-store' }).then(function(r){ return r.json(); })
      .then(function(j){ videoNames = (j.videos || []).map(function(v){ return v.file; }); store('jungle.videos', JSON.stringify(videoNames)); })
      .catch(function(){ try{ videoNames = JSON.parse(store('jungle.videos') || '[]'); }catch(e){ videoNames = []; } });
  }

  var lastMove = null, sceneTimer = 0;
  function startReferee(){
    loadVideoNames();
    if(!room) return;
    var since = serverNow() - 5000;
    room.child('req').remove().catch(function(){});
    room.child('res').remove().catch(function(){});
    room.child('stage/alive').onDisconnect().set(0);
    publish();

    room.child('req').on('child_added', function(snap){
      var r = snap.val() || {}, key = snap.key;
      snap.ref.remove().catch(function(){});
      if(typeof r.t === 'number' && r.t < since) return;          // left over from before this start
      var out;
      try{ out = refereePost(String(r.p || ''), r.b || {}); }catch(e){ out = { ok: false, error: 'bad request' }; }
      publish();                                                   // stage first, answer second
      room.child('res/' + key).set(out).catch(function(){});
    });

    var first = { move: true, touch: true };
    room.child('move').on('value', function(s){
      if(first.move){ first.move = false; return; }
      var v = s.val(); if(!v) return;
      if(stage.kind === 'play' && stage.owner === v.id){ stage.active = now(); broadcast(moveMsg(v.x, v.y)); }
    });
    room.child('touch').on('value', function(s){
      if(first.touch){ first.touch = false; return; }
      var v = s.val(); if(v && stage.kind === 'play' && stage.owner === v.id) stage.active = now();
    });

    // settings saved from the laptop: apply them by restarting the forest
    var firstCfg = true;
    room.child('config').on('value', function(s){
      var c = s.val();
      if(c) store('jungle.cfg', JSON.stringify(c));
      if(firstCfg){ firstCfg = false; return; }
      if(window.JUNGLE_TV) setTimeout(function(){ location.reload(); }, 300);
    });

    // turn timer (same as the old watchdog) + "the screen is on" heartbeat
    var lastPub = 0;
    setInterval(function(){
      var t = now(), changed = false;
      if(stage.kind === 'play'){
        if(t - stage.started > PLAY_SECONDS){ release('time'); changed = true; }
        else if(t - stage.active > IDLE_SECONDS){ release('idle'); changed = true; }
      }else if(stage.kind === 'video' && t - stage.started > VIDEO_MAX){ release('stop'); changed = true; }
      if(changed || Date.now() - lastPub > 1000){ lastPub = Date.now(); publish(); }
    }, 400);

    // keep the joystick smooth when a network packet arrives late
    setInterval(function(){
      if(!lastMove || stage.kind !== 'play') return;
      var age = Date.now() - lastMove.at;
      if(age < 1200 && Math.hypot(lastMove.x, lastMove.y) > 0.01) broadcast({ kind: 'play', cmd: 'move', x: lastMove.x, y: lastMove.y });
    }, 250);
  }

  function screenApi(method, path, data){
    if(method === 'GET'){
      if(path === '/api/info') return Promise.resolve({ ip: '', port: 0, phoneSeen: phoneSeen, phoneUrl: ROOT + 'tablet.html' + (KEY ? '#k=' + KEY : '') });
      if(path === '/api/config'){
        return readOnce('config', 4000).then(function(c){
          if(c){ store('jungle.cfg', JSON.stringify(c)); return c; }
          try{ return JSON.parse(store('jungle.cfg') || '{}'); }catch(e){ return {}; }
        });
      }
      if(path === '/api/videos') return realFetch(ROOT + 'videos.json', { cache: 'no-store' }).then(function(r){ return r.json(); });
      if(path === '/api/scene') return Promise.resolve({ animals: scene });
      if(path === '/api/stage') return Promise.resolve(status(''));
      return Promise.resolve({ ok: false, error: 'not found' });
    }
    if(path === '/api/config'){
      if(!room) return Promise.reject(new Error('offline'));
      var cfg = cleanConfig(data);
      store('jungle.cfg', JSON.stringify(cfg));
      return withTimeout(room.child('config').set(cfg).then(function(){ return { ok: true }; }), 8000, null)
        .then(function(r){ if(!r) throw new Error('offline'); return r; });
    }
    if(path === '/api/scene'){
      scene = cleanScene(data);
      if(isReferee && room){
        clearTimeout(sceneTimer);
        sceneTimer = setTimeout(function(){ room.child('scene').set({ animals: scene }).catch(function(){}); }, 400);
      }
      return Promise.resolve({ ok: true });
    }
    if(!isReferee) return Promise.resolve({ ok: true });
    var out = refereePost(path, data);
    publish();
    return Promise.resolve(out);
  }

  /* ======================================================================
   * PHONE
   * ==================================================================== */
  var lastStage = null, moveN = 0, touchN = 0;
  function screenAlive(){ return !!(lastStage && lastStage.alive && serverNow() - lastStage.alive < 7000); }
  function phoneStatus(pid){
    if(!lastStage) return null;
    if(!screenAlive()) return { busy: false, mine: false, kind: null, file: null, who: 'both', error: 'screen' };
    var busy = !!lastStage.owner;
    var out = { busy: busy, mine: busy && lastStage.owner === pid, kind: lastStage.kind || null, file: lastStage.file || null, who: lastStage.who || 'both' };
    if(out.kind === 'play') out.remaining = typeof lastStage.remaining === 'number' ? lastStage.remaining : PLAY_SECONDS;
    return out;
  }
  function ask(path, data){
    if(!room) return Promise.resolve(null);
    return new Promise(function(resolve){
      var ref = room.child('req').push(), resRef = room.child('res/' + ref.key), done = false;
      function finish(v){
        if(done) return; done = true;
        resRef.off(); clearTimeout(timer);
        resRef.remove().catch(function(){});
        if(v === null) ref.remove().catch(function(){});
        resolve(v);
      }
      var timer = setTimeout(function(){ finish(null); }, REQ_TIMEOUT);
      resRef.on('value', function(s){ if(s.exists()) finish(s.val()); });
      ref.set({ p: path, b: data || {}, t: TS }).catch(function(){ finish(null); });
    });
  }
  function startPhone(){
    if(!room) return;
    room.child('stage').on('value', function(s){ lastStage = s.val(); });
    // tell the screen a phone is here (hides the QR code), like opening the page used to
    setTimeout(function(){ ask('/api/_phone', {}); }, 800);
  }
  function phoneApi(method, path, data, query){
    if(method === 'GET'){
      if(path === '/api/stage') return Promise.resolve(phoneStatus(query.get('id') || ''));
      if(path === '/api/scene') return readOnce('scene', 5000).then(function(v){ return v || { animals: [] }; });
      if(path === '/api/videos') return realFetch(ROOT + 'videos.json', { cache: 'no-store' }).then(function(r){ return r.json(); });
      if(path === '/api/info') return Promise.resolve({ ip: '', port: 0, phoneSeen: true });
      return Promise.resolve(null);
    }
    if(!room) return Promise.resolve(null);
    var pid = String((data && data.id) || '');
    if(path === '/api/play/cmd' && data && data.cmd === 'move'){
      room.child('move').set({ id: pid, x: Number(data.x) || 0, y: Number(data.y) || 0, n: ++moveN }).catch(function(){});
      var st = phoneStatus(pid) || {};
      return Promise.resolve(st.mine ? Object.assign({ ok: true }, st) : { ok: true });
    }
    if(path === '/api/play/touch'){
      room.child('touch').set({ id: pid, n: ++touchN }).catch(function(){});
      return Promise.resolve({ ok: true });
    }
    if(lastStage && !screenAlive()){
      if(path === '/api/animal') return Promise.resolve({ ok: true, screens: 0 });
      if(path === '/api/play/start' || path === '/api/video/play') return Promise.resolve({ ok: false, error: 'screen' });
      return Promise.resolve({ ok: true });
    }
    return ask(path, data);
  }

  /* ======================================================================
   * fetch / EventSource stand-ins
   * ==================================================================== */
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if(url.indexOf('/api/') !== 0) return realFetch(input, init);
    var u = new URL(url, location.origin), method = ((init && init.method) || 'GET').toUpperCase(), data = null;
    if(init && typeof init.body === 'string'){ try{ data = JSON.parse(init.body); }catch(e){ data = {}; } }
    var p = isPhone ? phoneApi(method, u.pathname, data, u.searchParams) : screenApi(method, u.pathname, data);
    return Promise.resolve(p).then(function(obj){
      if(obj === null || obj === undefined) throw new TypeError('Failed to fetch');
      return json(obj);
    });
  };

  window.EventSource = function(url, opts){
    if(String(url).indexOf('/api/events') !== 0) return new RealEventSource(url, opts);
    var es = { onmessage: null, onerror: null, onopen: null, readyState: 1, close: function(){ var i = screens.indexOf(es); if(i >= 0) screens.splice(i, 1); es.readyState = 2; } };
    screens.push(es);
    return es;
  };

  /* ---------------- device report (helps fixing problems on the projector) ---------------- */
  function restReport(why){
    // Firebase library did not start: report straight to the database over plain HTTP
    try{
      var x = new XMLHttpRequest();
      x.open('PUT', FIREBASE.databaseURL + '/rooms/' + KEY + '/device.json', true);
      x.setRequestHeader('Content-Type', 'text/plain');
      x.send(JSON.stringify({ ua: navigator.userAgent, why: why, fb: typeof window.firebase, keyLen: KEY.length,
        w: window.innerWidth, h: window.innerHeight, t: Date.now() }));
    }catch(e){}
  }
  function report(){
    if(isPhone || !isReferee) return;
    if(!room){ if(KEY.length >= 24) restReport(initError || 'no firebase'); return; }
    try{
      room.child('device').set({ ua: navigator.userAgent, w: window.innerWidth, h: window.innerHeight,
        dpr: window.devicePixelRatio || 1, sw: 'serviceWorker' in navigator, t: TS }).catch(function(){});
    }catch(e){}
    var sent = 0;
    window.addEventListener('error', function(e){
      if(sent++ > 20) return;
      room.child('errors').push({ m: String(e.message || e.error || 'error').slice(0, 300), f: String(e.filename || '').slice(-80), l: e.lineno || 0, t: TS }).catch(function(){});
    });
    window.addEventListener('unhandledrejection', function(e){
      if(sent++ > 20) return;
      room.child('errors').push({ m: 'promise: ' + String(e.reason && (e.reason.message || e.reason)).slice(0, 300), t: TS }).catch(function(){});
    });
  }
  report();

  /* ---------------- start ---------------- */
  if(isPhone) startPhone();
  else{
    if(isReferee) startReferee(); else loadVideoNames();
    if(window.parent !== window){
      try{ window.parent.postMessage({ jungle: 'ready' }, '*'); }catch(e){}
      // inside the projector app: let the app see the remote control keys (Back opens its menu)
      window.addEventListener('keydown', function(e){
        if(e.keyCode === 10009 || e.keyCode === 27) e.preventDefault();
        try{ window.parent.postMessage({ jungle: 'key', keyCode: e.keyCode }, '*'); }catch(_){}
      });
    }
    window.addEventListener('message', function(e){ if(e.data && e.data.jungle === 'ping' && e.source){ try{ e.source.postMessage({ jungle: 'pong' }, '*'); }catch(_){} } });
    setupOfflineFiles();
  }

  /* ---------------- keep the media on the projector (service worker) ---------------- */
  function setupOfflineFiles(){
    if(!('serviceWorker' in navigator) || !window.caches) return;
    var badge = null;
    function show(text){
      if(!badge){
        badge = document.createElement('div');
        badge.style.cssText = 'position:fixed;right:14px;top:12px;z-index:50;font:600 13px/1.3 "Segoe UI",Roboto,Arial,sans-serif;color:#A9BFAE;background:rgba(0,0,0,.5);padding:5px 10px;border-radius:8px;pointer-events:none';
        (document.body || document.documentElement).appendChild(badge);
      }
      badge.textContent = text; badge.hidden = !text;
    }
    navigator.serviceWorker.register(ROOT + 'sw.js', { scope: ROOT }).then(function(reg){
      navigator.serviceWorker.addEventListener('message', function(e){
        var m = e.data || {};
        if(m.type === 'progress') show(m.total ? 'Saving forest files ' + Math.floor(100 * m.done / m.total) + '%' : '');
        else if(m.type === 'done') show('');
        else if(m.type === 'error') show('');
      });
      return navigator.serviceWorker.ready.then(function(r){ (r.active || reg.active).postMessage({ type: 'precache' }); });
    }).catch(function(){});
  }
})();
