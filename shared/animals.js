/* Animal line art. Drawing units, facing right. Parts are listed in draw order. */
(function () {
  const D = Math.PI / 180;
  const circle = (cx, cy, r) => {
    const k = r * 0.5523;
    return `M${cx + r},${cy} C${cx + r},${cy + k} ${cx + k},${cy + r} ${cx},${cy + r} ` +
      `C${cx - k},${cy + r} ${cx - r},${cy + k} ${cx - r},${cy} C${cx - r},${cy - k} ${cx - k},${cy - r} ${cx},${cy - r} ` +
      `C${cx + k},${cy - r} ${cx + r},${cy - k} ${cx + r},${cy} Z`;
  };
  const capsule = (x, y, w, r) =>
    `M${x + r},${y - r} L${x + w - r},${y - r} Q${x + w},${y - r} ${x + w},${y} Q${x + w},${y + r} ${x + w - r},${y + r} ` +
    `L${x + r},${y + r} Q${x},${y + r} ${x},${y} Q${x},${y - r} ${x + r},${y - r} Z`;
  /* Closed outline around a curved centre line, tapering from w0 to w1, with a round tip. */
  function tube(segs, w0, w1) {
    const pts = [];
    for (const s of segs) {
      for (let i = 0; i <= 18; i++) {
        const t = i / 18, u = 1 - t;
        pts.push([
          u * u * u * s[0][0] + 3 * u * u * t * s[1][0] + 3 * u * t * t * s[2][0] + t * t * t * s[3][0],
          u * u * u * s[0][1] + 3 * u * u * t * s[1][1] + 3 * u * t * t * s[2][1] + t * t * t * s[3][1]]);
      }
    }
    const L = [], R = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
      R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    const end = pts[n - 1], a = pts[n - 2];
    const ang = Math.atan2(end[1] - a[1], end[0] - a[0]);
    const cap = [];
    for (let i = 1; i < 8; i++) {
      const t = -Math.PI / 2 + Math.PI * i / 8;
      cap.push([end[0] + Math.cos(ang + t) * w1 / 2, end[1] + Math.sin(ang + t) * w1 / 2]);
    }
    const all = L.concat(cap.reverse(), R.reverse());
    return 'M' + all.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') + ' Z';
  }
  const legE = x => `M${x},165 L${x},250 Q${x},258 ${x + 8},258 L${x + 20},258 Q${x + 28},258 ${x + 28},250 L${x + 28},165 Z`;
  const legT = x => `M${x},168 L${x + 1},246 Q${x + 1},258 ${x + 12},258 L${x + 24},258 Q${x + 32},258 ${x + 28},248 L${x + 24},168 Z`;
  const legTu = x => `M${x},158 L${x},190 Q${x},198 ${x + 10},198 L${x + 18},198 Q${x + 26},198 ${x + 26},190 L${x + 26},158 Z`;
  const ease = v => v * v * (3 - 2 * v);

  /* shared parrot-like bird pose */
  function birdPose(parts, st) {
    const t = st.time || 0, seed = st.seed || 0, out = {};
    let head = 0, wing = 0, tail = 0, feet = 0, bob = 0;
    if (st.mode === 'fly' || st.mode === 'air') {
      wing = -22 + Math.sin(t * 26) * 40; tail = 10; head = -6; feet = 28; bob = Math.sin(t * 26) * 2;
    } else {
      const c = ((t + seed) % 6.5) / 6.5;
      head = c > 0.25 && c < 0.55 ? -10 * Math.sin((c - 0.25) / 0.3 * Math.PI) : 0;
      const f = ((t * 0.9 + seed * 1.7) % 9) / 9;
      wing = f > 0.82 ? -36 * Math.abs(Math.sin((f - 0.82) / 0.18 * Math.PI * 3)) : 0;
      tail = Math.sin(t * 1.4 + seed) * 3;
      if (st.call) head -= 14 * st.call;
    }
    for (const part of parts) {
      let r = 0;
      if (part.group === 'head') r = head; else if (part.group === 'wing') r = wing;
      else if (part.group === 'tail') r = tail; else if (part.group === 'foot') r = feet;
      out[part.id] = { r: r * D, dy: part.group === 'foot' ? 0 : bob };
    }
    return out;
  }

  /* snake body: tail to head */
  const snakeParts = [];
  for (let i = 0; i < 7; i++) {
    const r = 9 + i * 2, x = 40 + i * 42;
    snakeParts.push({ id: 's' + i, group: 'seg', idx: i, pivot: [x + 30, 120], paths: [capsule(x, 120, 64, r)] });
  }

  window.ANIMALS = {
    /* ---------------- ELEPHANT ---------------- */
    elephant: {
      id: 'elephant', name: 'Elephant', behavior: 'walker', size: [400, 280], view: [56, 34, 326, 242],
      anchor: [220, 258], height: 203, stroke: 5, sizeRatio: 1, badge: [255, 18], badgeR: 30,
      walk: { speed: [55, 80], stride: 22 }, sounds: ['elephant'],
      parts: [
        { id: 'bf', group: 'legA', paths: [legE(112)], pivot: [126, 180] },
        { id: 'ff', group: 'legB', paths: [legE(222)], pivot: [236, 180] },
        { id: 'bn', group: 'legB', paths: [legE(150)], pivot: [164, 180] },
        { id: 'fn', group: 'legA', paths: [legE(258)], pivot: [272, 180] },
        { id: 'tail', group: 'tail', pivot: [98, 138], paths: ['M100,134 C86,150 80,170 82,192 L89,192 C89,172 94,156 106,144 Z', 'M77,190 L94,190 L92,206 L86,199 L80,207 Z'] },
        { id: 'body', group: 'upper', pivot: [200, 135], paths: ['M95,150 C95,85 150,65 200,68 C255,70 290,90 295,140 C298,185 270,200 200,202 C130,204 95,195 95,150 Z'] },
        { id: 'trunk', group: 'trunk', pivot: [338, 130], paths: ['M326,128 C344,148 350,182 344,214 C342,226 356,230 361,219 C370,186 364,146 344,122 Z'] },
        { id: 'head', group: 'upper', pivot: [300, 110], dots: [[320, 98, 4.5]], paths: ['M262,95 C265,62 305,55 330,70 C352,84 352,120 340,140 C330,155 300,160 280,150 C265,142 260,120 262,95 Z'] },
        { id: 'ear', group: 'ear', pivot: [284, 86], paths: ['M283,82 C262,79 247,100 251,128 C254,148 270,156 286,148 C291,130 293,100 283,82 Z'] },
        { id: 'tusk', group: 'upper', pivot: [338, 140], paths: ['M334,138 C340,150 352,153 362,147 C353,146 345,141 341,134 Z'] }
      ],
      pose(st) {
        const p = st.phase || 0, t = st.time || 0, out = {};
        let legA = 0, legB = 0, bob = 0, tail = 0;
        if (st.mode === 'air') { legA = 24; legB = -24; tail = 22; }
        else if (st.mode === 'walk') { legA = Math.sin(p) * 13; legB = -legA; bob = -Math.abs(Math.sin(p)) * 3; tail = Math.sin(p) * 14; }
        else tail = Math.sin(t * 2.2) * 8;
        const k = Math.max(0, Math.min(1, st.call || 0));
        const amp = st.mode === 'walk' ? 7 : 11;
        const trunk = Math.sin(t * 2.6) * amp * (1 - k) + (-100 + Math.sin(t * 18) * 3) * k;
        const ear = (Math.sin(t * 3.4) * 0.5 - 0.5) * 12 * (1 - k) - 16 * k;
        for (const part of this.parts) {
          let r = 0, dy = bob;
          if (part.group === 'legA') { r = legA; dy = 0; } else if (part.group === 'legB') { r = legB; dy = 0; }
          else if (part.group === 'tail') r = tail; else if (part.group === 'trunk') r = trunk; else if (part.group === 'ear') r = ear;
          out[part.id] = { r: r * D, dy };
        }
        return out;
      }
    },

    /* ---------------- TIGER ---------------- */
    tiger: {
      id: 'tiger', name: 'Tiger', behavior: 'walker', size: [420, 280], view: [40, 40, 370, 236],
      anchor: [215, 258], height: 210, stroke: 5, sizeRatio: 0.85, badge: [335, 30], badgeR: 30,
      walk: { speed: [80, 110], stride: 26 }, sounds: ['tiger'],
      parts: [
        { id: 'bf', group: 'legA', paths: [legT(124)], pivot: [136, 180] },
        { id: 'ff', group: 'legB', paths: [legT(262)], pivot: [274, 180] },
        { id: 'tail', group: 'tail', pivot: [104, 140], paths: [tube([[[106, 142], [72, 150], [44, 128], [56, 92]], [[56, 92], [62, 76], [76, 74], [80, 84]]], 13, 9)] },
        { id: 'bn', group: 'legB', paths: [legT(152)], pivot: [164, 180] },
        { id: 'fn', group: 'legA', paths: [legT(292)], pivot: [304, 180] },
        { id: 'body', group: 'upper', pivot: [210, 140],
          lines: ['M170,106 C176,122 173,138 165,150', 'M202,104 C208,121 205,138 198,152', 'M234,105 C240,122 236,139 229,152', 'M264,108 C270,124 266,140 259,150'],
          paths: ['M100,150 C100,112 140,100 200,102 C260,104 300,108 316,135 C324,165 302,186 250,187 L150,189 C118,189 100,176 100,150 Z'] },
        { id: 'earB', group: 'head', pivot: [318, 146], paths: ['M306,92 L298,62 L326,76 Z'] },
        { id: 'earF', group: 'head', pivot: [318, 146], paths: ['M338,76 L348,48 L362,78 Z'] },
        { id: 'mouth', group: 'head', pivot: [318, 146], noColor: true, noEdge: true, fill: '#B8323A', paths: ['M336,140 L384,136 L382,160 L342,162 Z'] },
        { id: 'head', group: 'head', pivot: [318, 146], dots: [[352, 102, 4.6]],
          lines: ['M318,96 L328,104', 'M320,120 L332,122'],
          paths: ['M296,104 C298,76 326,64 352,72 C376,80 384,106 378,130 C372,148 352,150 334,148 C312,146 294,130 296,104 Z'] },
        { id: 'jaw', group: 'jaw', pivot: [340, 142], paths: ['M338,140 C352,146 372,146 384,138 C386,150 372,162 352,162 C340,162 334,152 338,140 Z'] },
        { id: 'nose', group: 'head', pivot: [318, 146], dots: [[384, 118, 4.5]], paths: ['M362,112 C374,106 392,112 392,124 C392,136 376,140 364,136 C356,132 354,118 362,112 Z'] }
      ],
      pose(st) {
        const p = st.phase || 0, t = st.time || 0, out = {};
        let legA = 0, legB = 0, bob = 0, tail = Math.sin(t * 1.8) * 10;
        if (st.mode === 'air') { legA = 30; legB = -30; tail = 25; }
        else if (st.mode === 'walk') { legA = Math.sin(p) * 17; legB = -legA; bob = -Math.abs(Math.sin(p)) * 2.5; tail = Math.sin(p) * 12; }
        const crouch = (st.crouch || 0) * 9;
        const jaw = Math.max(st.call || 0, st.yawn || 0) * 26;
        const lift = -Math.max(st.call || 0, st.yawn || 0) * 10;
        for (const part of this.parts) {
          const o = { r: 0, dy: bob + crouch };
          if (part.group === 'legA') { o.r = legA * D; o.dy = 0; } else if (part.group === 'legB') { o.r = legB * D; o.dy = 0; }
          else if (part.group === 'tail') o.r = tail * D;
          else if (part.group === 'head') { o.r = lift * D; }
          else if (part.group === 'jaw') { o.r = (lift + jaw) * D; }
          out[part.id] = o;
        }
        return out;
      }
    },

    /* ---------------- TURTLE ---------------- */
    turtle: {
      id: 'turtle', name: 'Turtle', behavior: 'walker', size: [360, 220], view: [56, 70, 290, 140],
      anchor: [185, 198], height: 116, stroke: 5, sizeRatio: 0.42, badge: [190, 40], badgeR: 30,
      walk: { speed: [10, 15], stride: 7 }, sounds: [],
      parts: [
        { id: 'l1', group: 'legA', paths: [legTu(110)], pivot: [123, 164] },
        { id: 'l2', group: 'legB', paths: [legTu(212)], pivot: [225, 164] },
        { id: 'tail', group: 'tail', pivot: [98, 174], paths: ['M100,166 L68,178 L100,186 Z'] },
        { id: 'head', group: 'head', pivot: [262, 160], dots: [[312, 148, 4.2]], lines: ['M304,162 C312,166 320,164 326,158'],
          paths: ['M250,148 C272,136 300,128 318,136 C336,144 336,166 318,172 C300,178 280,174 250,174 Z'] },
        { id: 'l3', group: 'legB', paths: [legTu(130)], pivot: [143, 164] },
        { id: 'l4', group: 'legA', paths: [legTu(234)], pivot: [247, 164] },
        { id: 'shell', group: 'body', pivot: [190, 140],
          lines: ['M138,168 L150,128 L190,110 L230,128 L242,168', 'M150,128 L118,148', 'M230,128 L264,148', 'M190,110 L190,86'],
          paths: ['M96,168 C100,110 150,84 190,84 C236,84 278,112 284,168 Z'] },
        { id: 'rim', group: 'body', pivot: [190, 172], paths: ['M88,164 L292,164 Q300,178 286,182 L94,182 Q80,178 88,164 Z'] },
      ],
      pose(st) {
        const p = st.phase || 0, t = st.time || 0, out = {};
        let legA = 0, legB = 0, bob = 0;
        if (st.mode === 'air') { legA = 20; legB = -20; }
        else if (st.mode === 'walk') { legA = Math.sin(p) * 12; legB = -legA; bob = -Math.abs(Math.sin(p)) * 1.2; }
        const hide = Math.max(0, Math.min(1, st.hide || 0));
        for (const part of this.parts) {
          const o = { r: 0, dy: bob };
          if (part.group === 'legA') { o.r = legA * (1 - hide) * D; o.dy = -16 * hide; }
          else if (part.group === 'legB') { o.r = legB * (1 - hide) * D; o.dy = -16 * hide; }
          else if (part.group === 'head') { o.dx = -56 * hide; o.r = Math.sin(t * 1.3) * 4 * (1 - hide) * D; }
          else if (part.group === 'tail') { o.dx = 18 * hide; }
          out[part.id] = o;
        }
        return out;
      }
    },

    /* ---------------- SNAKE ---------------- */
    snake: {
      id: 'snake', name: 'Snake', behavior: 'walker', size: [440, 170], view: [24, 70, 400, 90],
      anchor: [210, 142], height: 60, stroke: 5, sizeRatio: 0.32, badge: [360, 50], badgeR: 30,
      walk: { speed: [28, 40], stride: 12 }, sounds: ['snake'],
      parts: snakeParts.concat([
        { id: 'tongue', group: 'tongue', pivot: [384, 122], noColor: true, noEdge: true, fill: '#E5536B', hiddenAtRest: true,
          paths: ['M384,119 L414,119 L426,112 L420,121 L428,128 L414,125 L384,125 Z'] },
        { id: 'head', group: 'head', pivot: [330, 120], dots: [[360, 110, 4.5]], lines: ['M366,126 L382,124'],
          paths: ['M318,104 C340,94 372,98 384,112 C392,124 380,138 358,140 C338,142 318,134 312,124 C310,114 312,108 318,104 Z'] }
      ]),
      pose(st) {
        const p = st.phase || 0, t = st.time || 0, out = {};
        const moving = st.mode === 'walk' ? 1 : 0.35;
        const wave = i => Math.sin(p * 1.2 + t * (1 - moving) * 2 - i * 0.9) * 9 * moving;
        for (const part of this.parts) {
          const o = { r: 0, dy: 0 };
          if (part.group === 'seg') {
            const i = part.idx; o.dy = wave(i);
            o.r = (wave(i + 0.5) - wave(i - 0.5)) / 42;
          } else if (part.group === 'head') { o.dy = wave(7) - 6 * (st.call || 0); o.r = -0.12 * (st.call || 0); }
          else if (part.group === 'tongue') { const k = st.tongue || 0; o.dy = wave(7) - 6 * (st.call || 0); o.sx = k; o.hide = k < 0.02; }
          out[part.id] = o;
        }
        return out;
      }
    },

    /* ---------------- FROG ---------------- */
    frog: {
      id: 'frog', name: 'Frog', behavior: 'hopper', size: [300, 220], view: [44, 46, 216, 160],
      anchor: [150, 198], height: 136, stroke: 5, sizeRatio: 0.38, badge: [170, 20], badgeR: 30,
      sounds: ['frog'],
      parts: [
        { id: 'eyeB', group: 'head', pivot: [180, 140], paths: [circle(186, 82, 16)] },
        { id: 'armB', group: 'arm', pivot: [182, 172], paths: ['M176,170 L182,196 L202,198 L200,190 L190,188 L188,168 Z'] },
        { id: 'leg', group: 'leg', pivot: [112, 150], paths: ['M70,150 C60,120 100,104 128,118 C150,130 150,168 128,182 L74,196 C60,198 56,186 66,182 L104,172 C90,170 74,164 70,150 Z'] },
        { id: 'body', group: 'body', pivot: [160, 140], lines: ['M206,128 C220,136 236,134 246,124'],
          paths: ['M80,150 C80,104 130,80 180,86 C222,92 248,118 242,150 C236,176 200,190 150,190 C108,190 80,178 80,150 Z'] },
        { id: 'throat', group: 'throat', pivot: [206, 160], noColor: true, noEdge: true, fill: '#F6E7A8', paths: ['M200,150 C214,146 234,154 234,166 C234,180 214,184 200,180 Z'] },
        { id: 'arm', group: 'arm', pivot: [204, 168], paths: ['M196,166 L204,196 L226,198 L224,190 L212,188 L208,164 Z'] },
        { id: 'eye', group: 'head', pivot: [180, 140], dots: [[216, 82, 6]], paths: [circle(212, 84, 20)] }
      ],
      pose(st) {
        const t = st.time || 0, out = {};
        const air = st.mode === 'air' || st.mode === 'hop';
        const croak = st.call || 0, breathe = Math.sin(t * 2.4) * 0.04;
        for (const part of this.parts) {
          const o = { r: 0, dy: 0 };
          if (part.group === 'leg') o.r = (air ? 48 : 0) * D;
          else if (part.group === 'arm') o.r = (air ? -34 : 0) * D;
          else if (part.group === 'throat') { const s = 1 + croak * 0.7 + breathe; o.sx = s; o.sy = s; }
          else if (part.group === 'body') o.dy = air ? -2 : breathe * 20;
          else if (part.group === 'head') o.dy = air ? -2 : breathe * 20;
          out[part.id] = o;
        }
        return out;
      }
    },

    /* ---------------- BUTTERFLY ---------------- */
    butterfly: {
      id: 'butterfly', name: 'Butterfly', behavior: 'butterfly', size: [240, 200], view: [24, 16, 196, 150],
      anchor: [112, 142], height: 122, stroke: 4.5, sizeRatio: 0.3, badge: [116, 0], badgeR: 30, flyer: true,
      sounds: ['butterfly'],
      parts: [
        { id: 'wingBF', group: 'wingF', pivot: [118, 124], paths: ['M116,122 C102,70 120,26 150,30 C176,34 170,90 124,126 Z'] },
        { id: 'wingBH', group: 'wingH', pivot: [104, 130], paths: ['M102,128 C74,104 52,112 58,138 C64,160 94,158 106,134 Z'] },
        { id: 'body', group: 'body', pivot: [110, 130], lines: ['M164,118 C170,100 178,92 186,90', 'M160,118 C162,98 166,88 172,82'],
          dots: [[162, 124, 2.8]], paths: ['M70,130 C70,122 82,118 110,118 C140,118 150,121 152,130 C150,139 140,142 110,142 C82,142 70,138 70,130 Z', circle(160, 126, 11)] },
        { id: 'wingF', group: 'wingF', pivot: [116, 124], paths: ['M112,122 C106,58 146,16 184,32 C210,46 194,98 120,128 Z'] },
        { id: 'wingH', group: 'wingH', pivot: [104, 130], paths: ['M104,130 C78,96 40,98 44,134 C48,164 92,166 108,136 Z'] }
      ],
      pose(st) {
        const t = st.time || 0, out = {};
        const fast = st.mode === 'fly' || st.mode === 'air';
        const f = fast ? 0.55 + 0.45 * Math.cos(t * 30) : 0.75 + 0.25 * Math.cos(t * 2.2);
        for (const part of this.parts) {
          const o = { r: 0, dy: 0 };
          if (part.group === 'wingF') { o.sy = Math.max(0.15, f); o.r = (fast ? Math.sin(t * 30) * 6 : 0) * D; }
          else if (part.group === 'wingH') { o.sy = Math.max(0.2, f * 0.9 + 0.1); }
          out[part.id] = o;
        }
        return out;
      }
    },

    /* ---------------- MONKEY (hangs by one hand) ---------------- */
    monkey: {
      id: 'monkey', name: 'Monkey', behavior: 'monkey', size: [270, 340], view: [40, 18, 210, 306],
      anchor: [219, 31], height: 290, stroke: 5, sizeRatio: 0.72, badge: [212, 110], badgeR: 30, flyer: true, hanger: true,
      sounds: ['monkey'],
      parts: [
        { id: 'tail', group: 'tail', pivot: [104, 226], paths: [tube([[[106, 226], [66, 240], [52, 292], [86, 304]], [[86, 304], [104, 308], [112, 292], [100, 284]]], 13, 9)] },
        { id: 'armB', group: 'armB', pivot: [110, 154], paths: ['M100,150 C92,182 88,212 92,242 L110,244 C108,212 112,182 118,154 Z'] },
        { id: 'legB', group: 'legB', pivot: [122, 244], paths: ['M110,238 C100,268 98,292 104,316 L124,318 C122,296 124,272 132,246 Z'] },
        { id: 'body', group: 'body', pivot: [140, 180], paths: ['M98,160 C96,130 120,112 140,112 C164,112 180,132 178,170 C176,214 166,250 138,252 C110,252 100,212 98,160 Z'] },
        { id: 'belly', group: 'body', pivot: [140, 180], noEdge: true, paths: ['M120,172 C120,152 128,142 140,142 C152,142 158,154 158,174 C158,206 152,230 140,230 C128,230 120,204 120,172 Z'] },
        { id: 'legF', group: 'legF', pivot: [152, 244], paths: ['M140,242 C146,270 150,292 146,316 L166,318 C170,294 166,268 162,240 Z'] },
        { id: 'earL', group: 'head', pivot: [150, 128], paths: [circle(106, 94, 14)] },
        { id: 'earR', group: 'head', pivot: [150, 128], paths: [circle(194, 90, 14)] },
        { id: 'head', group: 'head', pivot: [150, 128], paths: ['M108,96 C108,66 128,50 150,50 C174,50 192,68 190,96 C188,120 170,134 150,134 C126,134 108,120 108,96 Z'] },
        { id: 'face', group: 'head', pivot: [150, 128], noEdge: true, dots: [[140, 92, 4.5], [162, 92, 4.5]], lines: ['M140,110 C146,116 156,116 162,110'],
          paths: ['M124,98 C124,80 136,72 150,74 C164,72 176,80 176,98 C176,116 164,126 150,126 C136,126 124,116 124,98 Z'] },
        { id: 'armF', group: 'armF', pivot: [178, 130], paths: ['M170,128 C198,104 214,72 210,34 L228,30 C234,72 216,114 184,138 Z'] }
      ],
      pose(st) {
        const t = st.time || 0, out = {};
        const air = st.mode === 'fly' || st.mode === 'air';
        const sw = Math.sin(t * 2.1);
        for (const part of this.parts) {
          const o = { r: 0, dy: 0 };
          if (part.group === 'legB') o.r = (air ? -30 : sw * 10) * D;
          else if (part.group === 'legF') o.r = (air ? -40 : -sw * 10) * D;
          else if (part.group === 'armB') o.r = (air ? -140 : sw * 12 + (st.call || 0) * -60) * D;
          else if (part.group === 'tail') o.r = Math.sin(t * 1.5) * 8 * D;
          else if (part.group === 'head') o.r = ((st.call || 0) * -10 + Math.sin(t * 1.1) * 3) * D;
          out[part.id] = o;
        }
        return out;
      }
    },

    /* ---------------- PARROT ---------------- */
    parrot: {
      id: 'parrot', name: 'Parrot', behavior: 'bird', size: [300, 320], view: [62, 40, 196, 276],
      anchor: [156, 238], height: 180, stroke: 5, sizeRatio: 0.62, badge: [182, 20], badgeR: 30, flyer: true,
      sounds: ['parrot1', 'parrot2'],
      parts: [
        { id: 'ptail', group: 'tail', pivot: [132, 210], paths: ['M120,206 C108,238 96,266 86,298 L106,302 C120,272 132,242 146,214 Z'] },
        { id: 'footL', group: 'foot', pivot: [145, 216], paths: ['M138,214 L152,214 L156,238 L134,238 Z'] },
        { id: 'footR', group: 'foot', pivot: [167, 214], paths: ['M160,212 L174,212 L178,236 L156,236 Z'] },
        { id: 'body', group: 'body', pivot: [150, 160], paths: ['M118,108 C148,88 192,100 196,142 C200,186 176,216 146,221 C120,224 104,202 104,170 C104,140 104,120 118,108 Z'] },
        { id: 'wing', group: 'wing', pivot: [138, 126], paths: ['M128,122 C158,110 186,132 182,164 C178,196 152,214 120,226 C126,196 118,158 128,122 Z'] },
        { id: 'beak', group: 'head', pivot: [168, 116], paths: ['M204,74 C222,70 236,84 232,104 C230,114 224,118 220,112 C222,104 216,96 206,96 Z'] },
        { id: 'head', group: 'head', pivot: [168, 116], paths: ['M150,92 C152,64 180,52 202,64 C220,74 222,104 208,118 C194,130 166,128 156,116 C150,108 149,100 150,92 Z'] },
        { id: 'eye', group: 'head', pivot: [168, 116], noColor: true, dots: [[191, 84, 3.6]], paths: [circle(190, 84, 8.5)] }
      ],
      pose(st) { return birdPose(this.parts, st); }
    },

    /* ---------------- TOUCAN ---------------- */
    toucan: {
      id: 'toucan', name: 'Toucan', behavior: 'bird', size: [330, 320], view: [62, 40, 250, 276],
      anchor: [150, 238], height: 180, stroke: 5, sizeRatio: 0.62, badge: [190, 20], badgeR: 30, flyer: true,
      sounds: ['toucan'],
      parts: [
        { id: 'ptail', group: 'tail', pivot: [126, 212], paths: ['M112,206 C104,232 100,256 98,284 L120,286 C122,260 128,236 140,214 Z'] },
        { id: 'footL', group: 'foot', pivot: [140, 216], paths: ['M132,214 L146,214 L150,238 L128,238 Z'] },
        { id: 'footR', group: 'foot', pivot: [162, 214], paths: ['M154,212 L168,212 L172,236 L150,236 Z'] },
        { id: 'body', group: 'body', pivot: [150, 160], paths: ['M112,108 C142,86 188,98 192,142 C196,186 172,218 142,222 C116,224 100,202 100,170 C100,140 100,120 112,108 Z'] },
        { id: 'chest', group: 'body', pivot: [150, 160], noEdge: true, paths: ['M162,104 C184,108 192,128 190,150 C178,150 164,140 158,124 C156,114 158,106 162,104 Z'] },
        { id: 'wing', group: 'wing', pivot: [132, 128], paths: ['M122,124 C152,112 178,134 174,166 C170,198 146,214 116,226 C122,196 114,158 122,124 Z'] },
        { id: 'head', group: 'head', pivot: [166, 116], paths: ['M146,94 C148,66 176,54 198,66 C214,76 216,104 204,118 C190,130 162,128 152,116 C146,108 145,102 146,94 Z'] },
        { id: 'beak', group: 'head', pivot: [166, 116], lines: ['M206,92 C240,90 270,92 300,94'],
          paths: ['M200,72 C232,62 280,70 304,92 C290,104 246,110 206,106 C198,96 196,80 200,72 Z'] },
        { id: 'eye', group: 'head', pivot: [166, 116], noColor: true, dots: [[184, 82, 3.6]], paths: [circle(183, 82, 9)] }
      ],
      pose(st) { return birdPose(this.parts, st); }
    },

    /* ---------------- CHAMELEON ---------------- */
    chameleon: {
      id: 'chameleon', name: 'Chameleon', behavior: 'chameleon', size: [430, 260], view: [34, 46, 322, 190],
      anchor: [220, 216], height: 158, stroke: 5, sizeRatio: 0.6, badge: [292, 26], badgeR: 30,
      walk: { speed: [16, 24], stride: 9 }, sounds: ['tongue'],
      parts: [
        { id: 'c1', group: 'legA', pivot: [174, 171], paths: ['M168,170 L180,170 L178,198 L194,206 L190,214 L168,205 Z'] },
        { id: 'c2', group: 'legB', pivot: [274, 166], paths: ['M268,165 L280,165 L290,195 L306,202 L303,210 L284,206 Z'] },
        { id: 'ctail', group: 'tail', pivot: [112, 158], paths: [tube([
          [[118, 158], [76, 160], [50, 186], [60, 214]], [[60, 214], [70, 238], [104, 230], [102, 208]], [[102, 208], [100, 190], [80, 190], [80, 206]]], 15, 7)] },
        { id: 'body', group: 'body', pivot: [200, 145], paths: ['M108,150 C118,104 190,88 252,102 C288,110 298,138 288,160 C274,182 204,188 152,183 C126,181 104,172 108,150 Z'] },
        { id: 'c3', group: 'legB', pivot: [151, 173], paths: ['M144,172 L158,172 L156,202 L174,211 L170,220 L144,209 Z'] },
        { id: 'c4', group: 'legA', pivot: [253, 169], paths: ['M246,168 L260,168 L270,200 L288,208 L284,217 L262,212 Z'] },
        { id: 'tongue', group: 'tongue', pivot: [318, 143], noColor: true, noEdge: true, fill: '#E5536B', hiddenAtRest: true,
          paths: ['M318,136 L394,136 C404,128 421,131 421,143 C421,155 404,158 394,150 L318,150 Z'] },
        { id: 'crest', group: 'head', pivot: [290, 120], paths: ['M258,92 L268,62 L292,76 Z'] },
        { id: 'head', group: 'head', pivot: [290, 120], lines: ['M296,140 C310,146 322,144 334,138'],
          paths: ['M248,104 C258,74 296,66 318,88 C336,104 342,134 330,148 C316,162 286,162 272,152 C262,140 250,124 248,104 Z'] },
        { id: 'eye', group: 'head', pivot: [290, 120], paths: [circle(304, 108, 14)] },
        { id: 'pupil', group: 'pupil', pivot: [304, 108], ink: true, paths: [circle(304, 108, 5)] }
      ],
      pose(st) {
        const p = st.phase || 0, t = st.time || 0, out = {};
        let legA = 0, legB = 0, bob = 0;
        if (st.mode === 'air') { legA = 18; legB = -18; }
        else if (st.mode === 'walk') { legA = Math.sin(p) * 10; legB = -legA; bob = -Math.abs(Math.sin(p)) * 1.5; }
        const tail = Math.sin(t * 1.1) * 5 + (st.mode === 'air' ? 10 : 0);
        const look = st.look || 0;
        const px = (Math.cos(t * 3.2) * 4) * look + (1 - look) * 2, py = Math.sin(t * 3.2) * 3 * look;
        const tg = Math.max(0, Math.min(1, st.tongue || 0));
        for (const part of this.parts) {
          const o = { r: 0, dy: bob };
          if (part.group === 'legA') { o.r = legA * D; o.dy = 0; } else if (part.group === 'legB') { o.r = legB * D; o.dy = 0; }
          else if (part.group === 'tail') o.r = tail * D;
          else if (part.group === 'pupil') { o.dx = px; o.dy = bob + py; }
          else if (part.group === 'tongue') { o.sx = tg; o.hide = tg < 0.02; }
          out[part.id] = o;
        }
        return out;
      }
    }
  };

  /* order shown to children */
  window.ANIMAL_ORDER = ['elephant', 'tiger', 'monkey', 'parrot', 'toucan', 'chameleon', 'frog', 'snake', 'turtle', 'butterfly'];
  /* a pose loop for the selection cards */
  window.ANIMAL_DEMO = function (id, t) {
    switch (id) {
      case 'parrot': case 'toucan': return { mode: 'perch', time: t, seed: 1 };
      case 'butterfly': return { mode: 'fly', time: t };
      case 'monkey': return { mode: 'hang', time: t };
      case 'frog': { const c = (t % 2.2) / 2.2; return { mode: c > 0.7 ? 'hop' : 'sit', time: t, call: c < 0.4 ? Math.sin(c / 0.4 * Math.PI) : 0 }; }
      case 'turtle': return { mode: 'walk', phase: t * 3, time: t };
      case 'chameleon': return { mode: 'walk', phase: t * 3, time: t };
      default: return { mode: 'walk', phase: t * 6, time: t };
    }
  };
})();
