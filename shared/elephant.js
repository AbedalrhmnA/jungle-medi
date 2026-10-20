/* Elephant line art: drawing units 400 x 280, facing right. Parts are listed in draw order. */
(function () {
  const leg = x => `M${x},165 L${x},250 Q${x},258 ${x + 8},258 L${x + 20},258 Q${x + 28},258 ${x + 28},250 L${x + 28},165 Z`;
  window.ANIMALS = window.ANIMALS || {};
  window.ANIMALS.elephant = {
    id: 'elephant',
    name: 'فيل',
    size: [400, 280],
    view: [66, 44, 306, 222],
    anchor: [220, 258],
    height: 203,
    stroke: 5,
    parts: [
      { id: 'bf', group: 'legA', paths: [leg(112)], pivot: [126, 180] },
      { id: 'ff', group: 'legB', paths: [leg(222)], pivot: [236, 180] },
      { id: 'bn', group: 'legB', paths: [leg(150)], pivot: [164, 180] },
      { id: 'fn', group: 'legA', paths: [leg(258)], pivot: [272, 180] },
      { id: 'tail', group: 'tail', paths: [
        'M100,134 C86,150 80,170 82,192 L89,192 C89,172 94,156 106,144 Z',
        'M77,190 L94,190 L92,206 L86,199 L80,207 Z'], pivot: [98, 138] },
      { id: 'body', group: 'upper', paths: [
        'M95,150 C95,85 150,65 200,68 C255,70 290,90 295,140 C298,185 270,200 200,202 C130,204 95,195 95,150 Z'], pivot: [200, 135] },
      { id: 'trunk', group: 'trunk', paths: [
        'M326,128 C344,148 350,182 344,214 C342,226 356,230 361,219 C370,186 364,146 344,122 Z'], pivot: [338, 130] },
      { id: 'head', group: 'upper', paths: [
        'M262,95 C265,62 305,55 330,70 C352,84 352,120 340,140 C330,155 300,160 280,150 C265,142 260,120 262,95 Z'],
        dots: [[320, 98, 4.5]], pivot: [300, 110] },
      { id: 'ear', group: 'ear', paths: [
        'M283,82 C262,79 247,100 251,128 C254,148 270,156 286,148 C291,130 293,100 283,82 Z'], pivot: [284, 86] },
      { id: 'tusk', group: 'upper', paths: [
        'M334,138 C340,150 352,153 362,147 C353,146 345,141 341,134 Z'], pivot: [338, 140] }
    ],
    /* Pose for each part: rotation in degrees and vertical offset in drawing units. */
    pose(st) {
      const p = st.phase || 0, t = st.time || 0, D = Math.PI / 180;
      const out = {};
      let legA = 0, legB = 0, bob = 0, tail = 0;
      if (st.mode === 'air') {
        legA = 24; legB = -24; tail = 22;
      } else if (st.mode === 'walk') {
        legA = Math.sin(p) * 13; legB = -legA;
        bob = -Math.abs(Math.sin(p)) * 3;
        tail = Math.sin(p) * 14;
      } else {
        tail = Math.sin(t * 2.2) * 8;
      }
      const trunkAmp = st.mode === 'walk' ? 7 : 11;
      const k = Math.max(0, Math.min(1, st.trumpet || 0)); // 0 = relaxed, 1 = trunk fully raised
      const trunk = Math.sin(t * 2.6) * trunkAmp * (1 - k) + (-100 + Math.sin(t * 18) * 3) * k;
      const ear = (Math.sin(t * 3.4) * 0.5 - 0.5) * 12 * (1 - k) - 16 * k;
      for (const part of this.parts) {
        let r = 0, dy = bob;
        if (part.group === 'legA') { r = legA; dy = 0; }
        else if (part.group === 'legB') { r = legB; dy = 0; }
        else if (part.group === 'tail') r = tail;
        else if (part.group === 'trunk') r = trunk;
        else if (part.group === 'ear') r = ear;
        out[part.id] = { r: r * D, dy };
      }
      return out;
    }
  };
})();
