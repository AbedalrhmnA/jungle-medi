/* Shared drawing helpers: crayons and brushes, paper look (grain, cut-out edge, lifted shadow), part baking and posing. */
(function () {
  const LAYER_SCALE = 3;          // color layer pixels per drawing unit
  const INK = '#1B1F1A';
  const EDGE = 9;                 // white cut-out margin, drawing units

  const CRAYONS = [
    { name: 'Red', c: '#E2342B' }, { name: 'Orange', c: '#F57F17' }, { name: 'Peach', c: '#FFB38A' }, { name: 'Yellow', c: '#FBD130' }, { name: 'Lemon', c: '#FFF176' },
    { name: 'Light green', c: '#8BC34A' }, { name: 'Mint', c: '#A8E6A1' }, { name: 'Green', c: '#2E8B3E' }, { name: 'Turquoise', c: '#3CC8C0' }, { name: 'Sky blue', c: '#36B5E8' },
    { name: 'Blue', c: '#2457C5' }, { name: 'Purple', c: '#8E44AD' }, { name: 'Lilac', c: '#C3A6E8' }, { name: 'Pink', c: '#F06AA0' }, { name: 'Light pink', c: '#F9B7D0' },
    { name: 'Light skin', c: '#F5D0B5' }, { name: 'Tan skin', c: '#C68B59' }, { name: 'Brown', c: '#8B5A2B' }, { name: 'Gold', c: '#D4A017' }, { name: 'Gray', c: '#9E9E9E' }
  ];

  /* ---------- deterministic random ---------- */
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  /* ---------- wax texture ---------- */
  const texCache = new Map();
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function waxTexture(color) {
    if (texCache.has(color)) return texCache.get(color);
    const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data, [r, g, b] = hexToRgb(color);
    const GX = 24, GY = 8, grid = [];
    for (let j = 0; j < GY; j++) { grid.push([]); for (let i = 0; i < GX; i++) grid[j].push(Math.random()); }
    const low = (px, py) => {
      const fx = px / S * GX, fy = py / S * GY, i0 = Math.floor(fx), j0 = Math.floor(fy);
      const tx = fx - i0, ty = fy - j0, i1 = (i0 + 1) % GX, j1 = (j0 + 1) % GY;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const A = grid[j0 % GY][i0 % GX] * (1 - sx) + grid[j0 % GY][i1] * sx;
      const B = grid[j1][i0 % GX] * (1 - sx) + grid[j1][i1] * sx;
      return A * (1 - sy) + B * sy;
    };
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
      const k = (y * S + i) * 4, n = Math.random(), row = low(i, y);
      let a = 0.72 + 0.24 * row + 0.22 * (n - 0.5);
      if (n < 0.035 && row < 0.45) a = 0.18;
      a = Math.max(0, Math.min(1, a));
      const shade = 0.92 + 0.12 * row;
      d[k] = Math.min(255, r * shade); d[k + 1] = Math.min(255, g * shade); d[k + 2] = Math.min(255, b * shade); d[k + 3] = a * 255;
    }
    x.putImageData(img, 0, 0); texCache.set(color, c); return c;
  }
  const patCache = new WeakMap();
  function cachedPattern(ctx, key, make) {
    let m = patCache.get(ctx); if (!m) { m = new Map(); patCache.set(ctx, m); }
    if (!m.has(key)) m.set(key, make());
    return m.get(key);
  }
  function waxPattern(ctx, color) {
    return cachedPattern(ctx, 'wax' + color, () => {
      const p = ctx.createPattern(waxTexture(color), 'repeat');
      if (p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().rotate(-28));
      return p;
    });
  }
  function waxStroke(ctx, color, x0, y0, x1, y1, width) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.88;
    ctx.strokeStyle = waxPattern(ctx, color); ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke();
    ctx.restore();
  }
  function eraseStroke(ctx, x0, y0, x1, y1, width) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke();
    ctx.restore();
  }

  /* ---------- colored pencil ---------- */
  function pencilTexture(color) {
    const key = 'p' + color;
    if (texCache.has(key)) return texCache.get(key);
    const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data, [r, g, b] = hexToRgb(color);
    const rows = []; for (let y = 0; y < S; y++) rows.push(0.75 + Math.random() * 0.25);
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
      const k = (y * S + i) * 4, n = Math.random();
      let a = rows[y] * (0.5 + 0.5 * n);
      if (n < 0.12) a *= 0.25;
      const shade = 0.88 + 0.1 * n;
      d[k] = r * shade; d[k + 1] = g * shade; d[k + 2] = b * shade; d[k + 3] = Math.max(0, Math.min(1, a)) * 255;
    }
    x.putImageData(img, 0, 0); texCache.set(key, c); return c;
  }
  function pencilPattern(ctx, color) {
    return cachedPattern(ctx, 'pencil' + color, () => {
      const p = ctx.createPattern(pencilTexture(color), 'repeat');
      if (p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().rotate(-28).scale(0.8));
      return p;
    });
  }
  function pencilStroke(ctx, color, x0, y0, x1, y1, width) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.95;
    ctx.strokeStyle = pencilPattern(ctx, color); ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke();
    ctx.restore();
  }

  /* ---------- spray: soft dots around the finger ---------- */
  function sprayDots(ctx, color, x, y, radius, count, rnd) {
    rnd = rnd || Math.random;
    ctx.save(); ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const u = Math.max(1e-6, rnd()), v = rnd();
      const d = Math.min(1.25, Math.sqrt(-2 * Math.log(u)) * 0.45) * radius, a = v * Math.PI * 2;
      ctx.globalAlpha = 0.35 + rnd() * 0.45;
      const s = (0.9 + rnd() * 1.6) * Math.max(1, radius / 26);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- watercolor: paint on a wet sheet, then let it dry on the paper ---------- */
  let waterNoise = null;
  function waterTexture() {
    if (waterNoise) return waterNoise;
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data, G = 8, grid = [];
    for (let j = 0; j < G; j++) { grid.push([]); for (let i = 0; i < G; i++) grid[j].push(Math.random()); }
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
      const fx = i / S * G, fy = y / S * G, i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), i1 = (i0 + 1) % G, j1 = (j0 + 1) % G;
      const v = (grid[j0][i0] * (1 - sx) + grid[j0][i1] * sx) * (1 - sy) + (grid[j1][i0] * (1 - sx) + grid[j1][i1] * sx) * sy;
      const k = (y * S + i) * 4; d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = (0.62 + 0.38 * v - Math.random() * 0.1) * 255;
    }
    x.putImageData(img, 0, 0); waterNoise = c; return c;
  }
  function wetStroke(ctx, color, x0, y0, x1, y1, width) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke();
    ctx.restore();
  }
  const WET_ALPHA = 0.5;
  function dryWet(ctx, wet) {
    const w = wet.width, h = wet.height;
    const body = scratch(w, h, 'wbody'), b = body.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.clearRect(0, 0, w, h);
    b.drawImage(wet, 0, 0);
    b.globalCompositeOperation = 'destination-in'; b.fillStyle = b.createPattern(waterTexture(), 'repeat'); b.fillRect(0, 0, w, h);
    b.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.62; ctx.drawImage(body, 0, 0, w, h, 0, 0, w, h);
    if ('filter' in b) {
      // darker rim where the paint dried at the edge
      b.clearRect(0, 0, w, h); b.drawImage(wet, 0, 0);
      b.globalCompositeOperation = 'destination-out'; b.filter = 'blur(6px)'; b.drawImage(wet, 0, 0); b.filter = 'none';
      b.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.5; ctx.drawImage(body, 0, 0, w, h, 0, 0, w, h);
    }
    ctx.restore();
  }

  /* ---------- fill a whole part in one tap, in the chosen brush ---------- */
  function fillPart(ctx, def, part, tool, color, k, wet) {
    k = k || LAYER_SCALE;
    const bx = part.box.x * k, by = part.box.y * k, bw = part.box.w * k, bh = part.box.h * k;
    const target = tool === 'water' ? wet.getContext('2d') : ctx;
    target.save();
    target.setTransform(k, 0, 0, k, 0, 0); target.clip(part.p2d); target.setTransform(1, 0, 0, 1, 0, 0);
    if (tool === 'erase') target.clearRect(bx - 2, by - 2, bw + 4, bh + 4);
    else if (tool === 'water') { target.fillStyle = color; target.fillRect(bx - 2, by - 2, bw + 4, bh + 4); }
    else if (tool === 'pencil') {
      target.globalAlpha = 0.95; target.fillStyle = pencilPattern(target, color); target.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    } else if (tool === 'spray') {
      const n = Math.round(bw * bh / 26);
      target.fillStyle = color;
      for (let q = 0; q < 4; q++) {
        target.globalAlpha = 0.38 + q * 0.13; target.beginPath();
        for (let i = 0; i < n / 4; i++) { const x = bx + Math.random() * bw, y = by + Math.random() * bh, r = 1 + Math.random() * 2.2; target.moveTo(x + r, y); target.arc(x, y, r, 0, Math.PI * 2); }
        target.fill();
      }
    } else {
      target.globalAlpha = 0.92; target.fillStyle = waxPattern(target, color); target.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    }
    target.restore();
    if (tool === 'water') { dryWet(ctx, wet); wet.getContext('2d').clearRect(0, 0, wet.width, wet.height); }
  }

  /* The texture of a brush, for painting a whole stroke at once. */
  function brushPattern(ctx, tool, color) { return tool === 'pencil' ? pencilPattern(ctx, color) : waxPattern(ctx, color); }

  /* Which colorable part is under a point (drawing units)? Top-most first. */
  function partAt(ctx, def, x, y) {
    prepare(def);
    for (let i = def.parts.length - 1; i >= 0; i--) {
      const p = def.parts[i];
      if (p.hiddenAtRest || p.ink) continue;
      if (ctx.isPointInPath(p.p2d, x, y)) return p.noColor ? null : p;
    }
    return null;
  }

  /* ---------- paper grain ---------- */
  let grainCanvas = null;
  function grainTexture() {
    if (grainCanvas) return grainCanvas;
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
    for (let i = 0; i < S * S; i++) {
      const n = Math.random();
      const v = 236 + n * 19;
      d[i * 4] = v; d[i * 4 + 1] = v - 2; d[i * 4 + 2] = v - 7; d[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // fibres
    x.globalAlpha = 0.09; x.strokeStyle = '#7A6A50'; x.lineWidth = 0.6;
    for (let i = 0; i < 140; i++) {
      const px = Math.random() * S, py = Math.random() * S, a = Math.random() * Math.PI, l = 4 + Math.random() * 14;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + 2, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    grainCanvas = c; return c;
  }
  function grainPattern(ctx) {
    return cachedPattern(ctx, 'grain', () => {
      const p = ctx.createPattern(grainTexture(), 'repeat');
      if (p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(0.45));
      return p;
    });
  }

  /* ---------- geometry ---------- */
  function prepare(def) {
    if (def._ready) return def;
    def.parts.forEach((p, idx) => {
      p.p2d = new Path2D();
      for (const s of p.paths) p.p2d.addPath(new Path2D(s));
      if (p.lines) { p.l2d = new Path2D(); for (const s of p.lines) p.l2d.addPath(new Path2D(s)); }
      const nums = p.paths.join(' ').match(/-?\d+(\.\d+)?/g).map(Number);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]); y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
      }
      p.raw = { x0, y0, x1, y1 };
      const pad = def.stroke + 2;
      p.box = { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
      const ep = EDGE + 4;
      p.ebox = { x: Math.floor(x0 - ep), y: Math.floor(y0 - ep), w: Math.ceil(x1 - x0 + ep * 2), h: Math.ceil(y1 - y0 + ep * 2) };
      const r = rng(idx * 977 + def.id.length * 131);
      p.jit = [[r() * 2.4 - 1.2, r() * 2.4 - 1.2, EDGE * 2 + r() * 3], [r() * 2.4 - 1.2, r() * 2.4 - 1.2, EDGE * 2 - 2 + r() * 3], [r() * 2 - 1, r() * 2 - 1, EDGE * 2 - 1]];
    });
    def._ready = true;
    return def;
  }

  /* White cut-out margin for one part (slightly uneven, like scissors). */
  function drawPartEdge(ctx, part) {
    if (part.noEdge || part.ink) return;
    ctx.save();
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#FFFFFF'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [dx, dy, w] of part.jit) {
      ctx.save(); ctx.translate(dx, dy); ctx.lineWidth = w; ctx.stroke(part.p2d); ctx.fill(part.p2d); ctx.restore();
    }
    ctx.restore();
  }

  /* The drawing itself for one part: paper, child's colors, grain, outline. */
  function drawPartArt(ctx, def, part, layer) {
    if (part.ink) { ctx.fillStyle = INK; ctx.fill(part.p2d); return; }
    ctx.save();
    ctx.clip(part.p2d);
    ctx.fillStyle = part.fill || '#FFFFFF';
    ctx.fill(part.p2d);
    if (layer && !part.noColor) {
      for (const L of (Array.isArray(layer) ? layer : [layer])) {
        if (!L) continue;
        const img = L.img || L;
        ctx.globalAlpha = L.alpha === undefined ? 1 : L.alpha;
        ctx.drawImage(img, 0, 0, def.size[0], def.size[1]);
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(part.box.x, part.box.y, part.box.w, part.box.h);
    ctx.restore();
    ctx.lineWidth = def.stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    ctx.stroke(part.p2d);
    if (part.l2d) { ctx.lineWidth = def.stroke * 0.8; ctx.stroke(part.l2d); }
    if (part.dots) { ctx.fillStyle = INK; for (const [cx, cy, r] of part.dots) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); } }
  }

  /* Apply one part's pose transform (ctx in drawing units). */
  function applyPose(ctx, part, t) {
    if (!t) return;
    ctx.translate(t.dx || 0, t.dy || 0);
    if (t.r || t.sx !== undefined || t.sy !== undefined) {
      ctx.translate(part.pivot[0], part.pivot[1]);
      if (t.r) ctx.rotate(t.r);
      if (t.sx !== undefined || t.sy !== undefined) ctx.scale(Math.max(0.001, t.sx === undefined ? 1 : t.sx), Math.max(0.001, t.sy === undefined ? 1 : t.sy));
      ctx.translate(-part.pivot[0], -part.pivot[1]);
    }
  }

  /* Whole figure, straight from the color layer (used while coloring). */
  function drawStatic(ctx, def, layer, opts) {
    prepare(def);
    opts = opts || {};
    const pose = opts.pose || {};
    const live = def.parts.filter(p => pose[p.id] ? !pose[p.id].hide : !p.hiddenAtRest);
    if (opts.shadow !== false) {
      // silhouette of the cut-out on its own canvas, then drawn once with a soft shadow
      const m = ctx.getTransform(), cw = ctx.canvas.width, ch = ctx.canvas.height;
      const sil = scratch(cw, ch), sx = sil.getContext('2d');
      sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, cw, ch); sx.setTransform(m);
      for (const p of live) { sx.save(); applyPose(sx, p, pose[p.id]); drawPartEdge(sx, p); sx.restore(); }
      const k = Math.hypot(m.a, m.b);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.shadowColor = 'rgba(40,30,15,0.32)'; ctx.shadowBlur = 9 * k; ctx.shadowOffsetX = 2.5 * k; ctx.shadowOffsetY = 4.5 * k;
      ctx.drawImage(sil, 0, 0);
      ctx.restore();
    }
    for (const p of live) { ctx.save(); applyPose(ctx, p, pose[p.id]); drawPartArt(ctx, def, p, layer); ctx.restore(); }
  }
  const scratches = {};
  function scratch(w, h, key) {
    key = key || 'main';
    let c = scratches[key];
    if (!c) { c = scratches[key] = document.createElement('canvas'); }
    if (c.width < w) c.width = w; if (c.height < h) c.height = h;
    return c;
  }

  /* Bake each part (art + cut-out edge) into small canvases so it can move freely. */
  function bake(def, layer, k) {
    prepare(def);
    k = k || LAYER_SCALE;
    return def.parts.map(p => {
      const art = document.createElement('canvas');
      art.width = Math.ceil(p.box.w * k); art.height = Math.ceil(p.box.h * k);
      const a = art.getContext('2d'); a.scale(k, k); a.translate(-p.box.x, -p.box.y);
      drawPartArt(a, def, p, layer);
      let edge = null;
      if (!(p.noEdge || p.ink)) {
        edge = document.createElement('canvas');
        edge.width = Math.ceil(p.ebox.w * k); edge.height = Math.ceil(p.ebox.h * k);
        const e = edge.getContext('2d'); e.scale(k, k); e.translate(-p.ebox.x, -p.ebox.y);
        drawPartEdge(e, p);
      }
      return { part: p, art, edge };
    });
  }

  /* Draw a baked, posed figure. ctx carries the full device transform (drawing units). */
  function drawBaked(ctx, def, baked, pose, opts) {
    opts = opts || {};
    const m = ctx.getTransform();
    if (opts.shadow !== false) {
      // device-space bounds of the figure
      const [q0, r0, q1, r1] = def.bounds || [0, 0, def.size[0], def.size[1]];
      const pts = [[q0, r0], [q1, r0], [q0, r1], [q1, r1]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
      const pad = 24;
      const bx = Math.floor(Math.min(...pts.map(p => p[0])) - pad), by = Math.floor(Math.min(...pts.map(p => p[1])) - pad);
      const bw = Math.ceil(Math.max(...pts.map(p => p[0])) - bx + pad), bh = Math.ceil(Math.max(...pts.map(p => p[1])) - by + pad);
      if (bw > 0 && bh > 0 && bw < 6000 && bh < 6000) {
        const sil = scratch(bw, bh, 'sil'), s = sil.getContext('2d');
        s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, bw, bh);
        s.setTransform(m.a, m.b, m.c, m.d, m.e - bx, m.f - by);
        for (const b of baked) {
          const t = pose[b.part.id];
          if (!b.edge || (t && t.hide)) continue;
          s.save(); applyPose(s, b.part, t);
          s.drawImage(b.edge, b.part.ebox.x, b.part.ebox.y, b.part.ebox.w, b.part.ebox.h);
          s.restore();
        }
        const k = Math.hypot(m.a, m.b);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
        ctx.shadowColor = 'rgba(20,15,5,0.38)'; ctx.shadowBlur = Math.max(2, 8 * k); ctx.shadowOffsetX = 3 * k; ctx.shadowOffsetY = 5 * k;
        ctx.drawImage(sil, 0, 0, bw, bh, bx, by, bw, bh);
        ctx.restore();
      }
    }
    for (const b of baked) {
      const t = pose[b.part.id];
      if (t && t.hide) continue;
      ctx.save(); applyPose(ctx, b.part, t);
      ctx.drawImage(b.art, b.part.box.x, b.part.box.y, b.part.box.w, b.part.box.h);
      ctx.restore();
    }
  }

  function newLayer(def) {
    const c = document.createElement('canvas');
    c.width = def.size[0] * LAYER_SCALE; c.height = def.size[1] * LAYER_SCALE;
    return c;
  }

  /* A random colored layer, as if a child had colored it (for testing without a phone). */
  function randomLayer(def) {
    prepare(def);
    const L = newLayer(def), x = L.getContext('2d'), k = LAYER_SCALE;
    const pick = () => CRAYONS[Math.floor(Math.random() * CRAYONS.length)].c;
    const legColor = pick(), mainColor = pick();
    for (const p of def.parts) {
      if (p.noColor || p.ink) continue;
      const color = /^leg/.test(p.group) ? legColor : (p.group === 'body' || p.group === 'upper' || p.id === 'head' || p.id === 'trunk') && Math.random() < 0.65 ? mainColor : pick();
      x.save();
      x.scale(k, k); x.clip(p.p2d); x.setTransform(1, 0, 0, 1, 0, 0);
      const bx = p.box.x * k, by = p.box.y * k, bw = p.box.w * k, bh = p.box.h * k;
      const step = 20 + Math.random() * 10;
      for (let y = by; y < by + bh + step; y += step) {
        const jit = () => (Math.random() - 0.5) * 18;
        waxStroke(x, color, bx - 10, y + jit(), bx + bw + 10, y + step * 0.6 + jit(), 34);
      }
      x.restore();
    }
    return L;
  }

  window.Figure = { LAYER_SCALE, CRAYONS, WET_ALPHA, brushPattern, waxStroke, pencilStroke, sprayDots, wetStroke, dryWet, fillPart, partAt, eraseStroke, prepare, drawStatic, bake, drawBaked, applyPose, newLayer, randomLayer };
})();
